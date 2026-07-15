# OneDrive 線設計規格 v1.0（2026-07-15，Fable 設計定案；同日 Phase A 實作完成）

> 讀者：接手實作的 agent（預定 Sonnet）。照 Phase 順序做，每個 Phase
> 真機驗收過才進下一個。規則照舊：schema 先於 Worker deploy、
> wrangler deploy 用 AskUserQuestion 先問、push 前 bump version.js、
> 完工補 CHANGELOG。
>
> **Phase A 已實作完成**（本文件 §3/§4/§5 已依實際程式碼更新，跟最初
> 設計有兩個出入：callback 改走 Worker 自己的網域，不經 jonaminz.com
> 中繼頁；`onedrive_account` 多一個 `connected_by` 欄位）。Phase A
> 待辦只剩：使用者跑一次 §6 的 Azure 註冊、套用 schema、設兩個 Worker
> secret、部署、上後台按「連接 OneDrive」。Phase B/C 尚未開工。

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

## 3. Token 生命週期（已實作）

- **不走 jonaminz.com 中繼頁**：跟 Google 登入完全同一個模式
  （`GOOGLE_REDIRECT_URI` 一樣是 Worker 自己的網域），Azure 的
  redirect_uri 直接設成
  `https://jonaminz-backend.ndmc402010104.workers.dev/auth/onedrive/callback`。
  這是瀏覽器導向流程（302），不是 `POST /api/action`：
  - `GET /auth/onedrive/start?token=<session token>`——`requireSession`
    驗證呼叫者已登入**且是 jonathan**（單一帳號的儲存空間，不接受
    Minz 發起連接）才產生 `state`（存進既有的 `oauth_states` 表，跟
    Google 登入共用同一張表擋 CSRF，`return_origin` 欄位這裡存的是
    發起連接的登入身分，不是要導回的網域），導去 Microsoft 同意畫面。
  - `GET /auth/onedrive/callback?code=&state=`——核對 `state`、拿
    `code` 跟 Microsoft 換 access+refresh token、存進
    `onedrive_account` 表，回一頁純文字結果（`成功`/`失敗`原因）。
    **沒有 session token 要交回瀏覽器**——refresh token 全程只活在
    Supabase，前端從頭到尾拿不到，跟 Google 登入那套「導回帶
    fragment token」不是同一件事。
- 之後 Worker 需要時（`getOnedriveAccessToken`）用 refresh token 換
  access token，module 變數快取（同 isolate 存活期間重複用，過期前
  5 分鐘換新，跟 `getFcmAccessToken` 同一個模式）；**個人帳號的
  refresh token 會滾動更新**——回應裡有新的就覆蓋存檔，否則幾個月後
  斷線。
- scope：`Files.ReadWrite.AppFolder offline_access`（App Folder＝
  Graph 只能碰 `應用程式/jonaminz` 資料夾，最小權限；使用者自己的
  OneDrive 其他內容碰不到）。`start` 帶 `prompt=consent`，確保
  consumers 端點每次都真的核發 refresh_token（不會因為之前同意過就
  跳過畫面、不核發）。

## 4. DB schema（`backend/supabase/onedrive_schema.sql`，冪等寫法，已寫好待套用）

```sql
create table if not exists onedrive_account (
  id integer primary key check (id = 1),   -- 單列表：只有 Jonathan 一個帳號
  refresh_token text not null,
  connected_by text not null check (connected_by in ('jonathan', 'minz')),
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table onedrive_account enable row level security;
grant select, insert, update, delete on onedrive_account to service_role;
```

`chat_messages` 的 `kind` 加 `'image'`、`metadata` 欄位是 Phase B 的事，
到那時再改（不在這次 schema 檔裡）。

## 5. 前端/頁面新增

- **已實作**：`assets/js/backend-client.js` 加
  `getOnedriveStatus`／`testOnedriveConnection`／
  `getWorkerBaseUrlForRedirect`；`pages/admin/` 首頁新增一段
  OneDrive 狀態卡片——未連接時（且登入身分是 jonathan）顯示「連接
  OneDrive」連結（`href` 指到 `/auth/onedrive/start?token=...`，這是
  一般 `<a>` 導頁，不是 fetch）；已連接時顯示連接者/時間＋「測試
  連線」按鈕（呼叫 `testOnedriveConnection`，實際打 Graph
  `me/drive/special/approot` 驗證，不只是「有沒有存 refresh_token」
  這種表面狀態）。
- **Phase B 待做**：聊天 composer 的「＋」選單加「傳圖片」項（面板＋
  整頁兩個外殼）。file input／fetch PUT 在 iframe 內應該可行（不像
  Notification 要 top-level）——Phase B 真機先驗，不行才走宿主 relay
  （協定已有現成模式）。

## 6. Azure App 註冊（使用者一次性操作，Phase A 剩下唯一的待辦）

1. portal.azure.com → **Microsoft Entra ID → App registrations →
   New registration**
2. 名稱 `jonaminz`；Supported account types 選
   **Personal Microsoft accounts only**
3. Redirect URI：平台 **Web**，值
   `https://jonaminz-backend.ndmc402010104.workers.dev/auth/onedrive/callback`
   （**不是** jonaminz.com 底下的頁面——跟 Google 登入的 redirect_uri
   同一個模式，直接指到 Worker 自己）
4. **Certificates & secrets → New client secret**——Value 只顯示
   一次，記下來給 agent 用 `wrangler secret put
   JONAMINZ_ONEDRIVE_CLIENT_SECRET` 存（跟 FCM_SERVICE_ACCOUNT_JSON
   同規格：不進 repo、不留對話）
5. **API permissions → Microsoft Graph → Delegated**：
   `Files.ReadWrite.AppFolder`、`offline_access`
6. 把 **Application (client) ID** 給 agent，另外設一個 Worker secret
   `wrangler secret put JONAMINZ_ONEDRIVE_CLIENT_ID`（雖然 client id
   本身不是機密，但這個專案的憑證統一走 secret，不寫進
   `wrangler.toml` 的 `[vars]`，跟其他 OAuth client id 一致）

## 7. 實作順序

- **Phase A：授權底座**——✅ schema／Worker `/auth/onedrive/start`
  `/auth/onedrive/callback`／token 刷新模組／`getOnedriveStatus`／
  `testOnedriveConnection`／後台連接入口都已寫好（2026-07-15）。
  剩下：使用者跑 §6 → 套用 schema → 設兩個 secret → `wrangler
  deploy` → 後台按「連接 OneDrive」→ 按「測試連線」看到 App Folder
  名稱＝驗收通過。
- **Phase B：圖片訊息**——CORS 驗證 → 上傳/顯示/optimistic/blur-up/
  lightbox，雙外殼 CSS。驗收＝兩台真機互傳圖。
- **Phase C：APK 自架**——上傳腳本、`/appDownload`、真機下載安裝
  驗證後刪 GitHub Release。
