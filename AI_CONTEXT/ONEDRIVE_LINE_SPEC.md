# OneDrive 線設計規格 v1.0（2026-07-15，Fable 設計定案）

> 讀者：接手實作的 agent（預定 Sonnet）。照 Phase 順序做，每個 Phase
> 真機驗收過才進下一個。規則照舊：schema 先於 Worker deploy、
> wrangler deploy 用 AskUserQuestion 先問、push 前 bump version.js、
> 完工補 CHANGELOG。

## 0. 目標與邊界

兩個交付物，共用同一條授權底座：

1. **聊天圖片分享**——圖片儲存在 OneDrive。使用者明訂**不准用
   Supabase 存圖片**（Supabase 只存訊息列＋中繼資料）。
2. **自架 APK 發佈**——APK 放 OneDrive，Worker 給固定下載網址；
   驗證可用後**收回暫時公開的 GitHub Release**（app-latest）。

不做（本線範圍外）：影片訊息、相簿/多選、圖片編輯、Minz 自己的
OneDrive 帳號（用 Jonathan 單一帳號存兩人的圖）。

## 1. 架構總覽

```
瀏覽器/App WebView ──(1) requestImageUpload──▶ Cloudflare Worker
        │                                        │ (2) Graph createUploadSession
        │◀──(3) uploadUrl──────────────────────  │    （access token 只活在 Worker）
        │
        ├──(4) PUT 圖片位元組 直傳──▶ Microsoft Graph（不經過 Worker）
        │
        └──(5) sendChatMessage kind='image' {itemId, w, h, thumbDataUri}
```

- **Azure App 註冊**：一次性，使用者在 portal 操作（步驟見 §6）。
- **OAuth2 授權碼流程**：一次性把 Jonathan 的個人 OneDrive 連上。
- **憑證分工**：client secret → Worker secret（wrangler secret）；
  refresh token → Supabase（service_role 專用表）；access token →
  Worker module-scope 記憶體快取（~50 分鐘），不落地。
- **Worker 不碰圖片位元組**：上傳直傳 Graph、下載 302/發短效
  downloadUrl——免費版 Worker 的 CPU/流量都省下來。

## 2. 資料流

### 2.1 傳圖（Phase B）

1. 選圖（`<input type="file" accept="image/*">`）→ 前端 canvas 壓縮：
   最長邊 1600px、JPEG q0.8（實測聊天圖大多落在 100–400KB）。
2. 同時產 **blur-up 縮圖**：最長邊 ~24px 的 JPEG data URI（1–2KB），
   直接存進訊息 metadata——歷史訊息即開即看，不用等 Graph。
3. **Optimistic UI**：本地 `URL.createObjectURL` 立即上泡泡（沿用
   pendingMessages 機制，`is-pending` 樣式＋「傳送中...」）。
4. `requestImageUpload`（Worker action，需 session）→ Worker 對
   `me/drive/special/approot:/chat/{uuid}.jpg:/createUploadSession`
   → 回 `uploadUrl` 給前端。
5. 前端直接 `PUT` 到 uploadUrl（pre-authenticated，不帶 Authorization
   header；≤4MB 一個 chunk 就結束）。完成的回應就是 driveItem，拿
   `id`。
   - **Phase B 第一件事先驗證**：consumer OneDrive 的 uploadUrl 是否
     接受瀏覽器 CORS PUT。若被擋，**fallback**：改走 Worker 傳遞
     （壓縮後圖夠小，`uploadImageViaWorker` 收 base64 轉存 Graph
     simple upload `PUT :/content`）。架構其餘部分不變。
6. `sendChatMessage` 帶 `kind:'image'`、`metadata:{itemId, w, h,
   thumbDataUri}`。失敗照既有 optimistic 回滾。

### 2.2 顯示圖

- 泡泡先渲染 `thumbDataUri`（模糊、按 w/h 佔位防跳版）。
- 進入可視範圍的圖批次換真圖：`getImageUrls {itemIds:[...]}` →
  Worker 對 Graph `GET /items/{id}?select=id,@microsoft.graph.downloadUrl`
  （$batch 或平行 fetch）→ 回 `{itemId: downloadUrl}` map。
  downloadUrl 效期約 1 小時：前端記憶體快取＋`<img>` onerror 時重換
  一次。
- 點圖 → 簡單全螢幕 lightbox（既有 modal 寫法，兩個外殼 CSS 各一份）。

### 2.3 APK 自架（Phase C）

- 本機建完 APK 後用 Node 腳本（`tools/upload-apk.mjs`）經 Worker
  admin action（或直接 Graph，帶一組 admin key）上傳到
  `approot/releases/jonaminz.apk`（覆蓋）。
- Worker `GET /appDownload` → 換 fresh downloadUrl → `302` 轉址。
  固定網址從此是 `https://<worker網域>/appDownload`。
- 真機驗證下載安裝 OK 後：`gh release delete app-latest`，公開通道
  收回（使用者 2026-07-15 之前明訂的回收計畫）。

## 3. Token 生命週期

- 授權碼 → Worker `onedriveConnect` → 對
  `login.microsoftonline.com/consumers/oauth2/v2.0/token` 換
  access+refresh → refresh token 寫入 DB。
- 之後 Worker 需要時用 refresh token 換 access token；**個人帳號的
  refresh token 會滾動更新**——回應裡有新 refresh token 就要寫回 DB，
  否則幾個月後斷線。
- scope：`Files.ReadWrite.AppFolder offline_access`（App Folder＝
  Graph 只能碰 `應用程式/jonaminz` 資料夾，最小權限；使用者自己的
  OneDrive 其他內容碰不到）。
- 授權 URL 帶隨機 `state` 存 sessionStorage，callback 頁驗證（CSRF）。

## 4. DB schema（`backend/supabase/onedrive_schema.sql`，冪等寫法）

```sql
create table if not exists onedrive_account (
  id integer primary key check (id = 1),   -- 單列表：只有 Jonathan 一個帳號
  refresh_token text not null,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table onedrive_account enable row level security;
grant select, insert, update, delete on onedrive_account to service_role;

alter table chat_messages drop constraint if exists chat_messages_kind_check;
alter table chat_messages add constraint chat_messages_kind_check
  check (kind in ('text','system','shared_item','image'));
-- metadata jsonb 欄位：實作時先查現況，沒有就 add column if not exists
```

## 5. 前端/頁面新增

- `pages/onedrive-callback/`：極簡頁——收 `?code=&state=`，驗 state，
  POST 給 Worker `onedriveConnect`，顯示成功/失敗。一次性用，但留著
  供日後重新授權。
- 聊天 composer 的「＋」選單加「傳圖片」項（面板＋整頁兩個外殼）。
  file input／fetch PUT 在 iframe 內應該可行（不像 Notification 要
  top-level）——Phase B 真機先驗，不行才走宿主 relay（協定已有現成
  模式）。

## 6. Azure App 註冊（使用者一次性操作，Phase A 開工前）

1. portal.azure.com → **Microsoft Entra ID → App registrations →
   New registration**
2. 名稱 `jonaminz`；Supported account types 選
   **Personal Microsoft accounts only**
3. Redirect URI：平台 **Web**，值
   `https://www.jonaminz.com/pages/onedrive-callback/`
4. **Certificates & secrets → New client secret**——Value 只顯示
   一次，用 `wrangler secret put ONEDRIVE_CLIENT_SECRET` 存（跟
   FCM_SERVICE_ACCOUNT_JSON 同規格：不進 repo、不留對話）
5. **API permissions → Microsoft Graph → Delegated**：
   `Files.ReadWrite.AppFolder`、`offline_access`
6. 把 **Application (client) ID** 給 agent（公開值，可進 config）

## 7. 實作順序

- **Phase A：授權底座**——schema、callback 頁、Worker
  `onedriveConnect`＋token 刷新模組、驗收＝Worker 能列出 approot。
- **Phase B：圖片訊息**——CORS 驗證 → 上傳/顯示/optimistic/blur-up/
  lightbox，雙外殼 CSS。驗收＝兩台真機互傳圖。
- **Phase C：APK 自架**——上傳腳本、`/appDownload`、真機下載安裝
  驗證後刪 GitHub Release。

Phase A 的 schema/頁面/Worker 骨架不需要 Azure 憑證就能先寫；
憑證到位後才能端到端測。
