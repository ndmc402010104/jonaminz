# OneDrive 線設計規格 v2.0（2026-07-15，雙帳號模式；Fable 設計，Phase A 已實作部署）

> 讀者：接手實作的 agent（預定 Sonnet）。照 Phase 順序做，每個 Phase
> 真機驗收過才進下一個。規則照舊：schema 先於 Worker deploy、
> wrangler deploy 用 AskUserQuestion 先問、push 前 bump version.js、
> 完工補 CHANGELOG。
>
> **v1.0 → v2.0 變更**：原設計是「單一帳號」（只有 Jonathan 連
> OneDrive，兩人共用他的容量）。使用者 2026-07-15 追問後改成**雙帳號
> 模式**：Jonathan／Minz 各自連自己的 OneDrive，各自都能從自己帳號
> 查得到聊天圖庫。決策過程與取捨記錄見 §0.1。
>
> **Phase A 已實作完成並部署**（雙帳號版）。**Phase B（圖片訊息）已於
> 2026-07-15 實作完成、schema 已套用、Worker 已部署**，待辦：Azure
> Portal 補 `Files.ReadWrite` 權限（已由使用者完成）＋ Jonathan／Minz
> 各自重新走一次 OneDrive 連接（後台已補「重新連接」按鈕），真人端到
> 端傳圖測試還沒做。**Phase C（APK 自架）已實作完成並部署、真機驗證過**
>（2026-07-15 上線，2026-07-16 追加 Agent 專用上傳密鑰），見
> CHANGELOG 第四十六次條目與 2026-07-16「APK 上傳專用固定密鑰」條目。

## 0. 目標與邊界

兩個交付物，共用同一條授權底座：

1. **聊天圖片分享**——圖片儲存在 OneDrive。使用者明訂**不准用
   Supabase 存圖片**（Supabase 只存訊息列＋中繼資料）。
2. **自架 APK 發佈**——APK 放 OneDrive（Jonathan 帳號即可，這件事跟
   雙帳號決策無關），Worker 給固定下載網址；驗證可用後**收回暫時
   公開的 GitHub Release**（app-latest）。

不做（本線範圍外）：影片訊息、相簿/多選、圖片編輯。

### 0.1 雙帳號決策記錄（2026-07-15）

使用者的原話是「兩邊都想要有自己的資料可以查詢」，後續釐清是「未來
想連資料庫抓照片」「現在建置的時候先做完整比較方便」。討論過兩種
寫法：

- **雙寫鏡射**：每張圖分別上傳進兩人各自帳號，兩份實體副本。優點是
  兩邊完全獨立，一邊斷線不影響另一邊；缺點是佔用兩倍容量、要上傳
  兩次。
- **單一副本＋原生分享**（**最終選擇**）：圖片只上傳一份到傳送者
  自己的帳號，用 Graph 的「分享給特定人」機制授權對方帳號讀取，不
  複製位元組。使用者的原話「這樣有比較省空間嗎？我們兩個一直都是
  共用的」——確認過這個模式的代價（傳送者若之後斷開 OneDrive 連線，
  對方連同舊照片一起看不到，因為那是授權連結不是獨立副本）之後，
  使用者的判斷是：他們兩人的使用模式本來就是共用資源池（「等於把
  獨立的 1+1TB 改成 2TB」），這個代價可以接受。

**這個決策只影響 Phase B 的寫入/讀取邏輯**（§2.1/§2.2），不影響
Phase A 已經部署的雙帳號授權底座——不管 Phase B 最後寫法是哪一種，
兩人都要各自連自己的帳號這件事是共同前提。

**實際斷線頻率評估**（使用者追問「會常常斷線嗎」，2026-07-15）：真正
會讓某一方連線失效的情境只有兩種，且都跟鏡射／分享的選擇無關：
(1) Azure client secret 到期（最長可設 24 個月，排定好的維護，兩人
一起受影響，不是單邊問題）；(2) 個人帳號密碼重設／安全事件（只影響
那一人，但正常使用下很少發生——refresh token 是滾動式的，只要 App
持續被使用就不會因久未使用而過期，預設門檻約 90 天）。日常聊天這種
使用頻率下，「傳送者斷線、對方看不到舊圖」是低機率事件。

**改鏡像的退路**：現在先做「單一副本＋分享」，之後如果實際使用發現
常斷線，要改成雙寫鏡射是可行的、成本可控——只需要換 Worker 的上傳
邏輯（傳一次＋授權 → 傳兩次），Phase A 的雙帳號基礎不用重做。唯一
額外的工作是：改版前**已經傳過的舊照片**如果也想補成獨立副本，需要
另外寫一支搬移腳本把舊圖複製到對方帳號，不會自動轉換——這是要不要
做的選項，不是換寫法時的必要條件。

## 1. 架構總覽（Phase B，2026-07-15 已實作部署）

```
Jonathan 傳圖 ──(1) requestImageUpload──▶ Cloudflare Worker
        │                                   │ (2) 用 Jonathan 的 access token
        │                                   │    對 Graph createUploadSession
        │◀──(3) uploadUrl───────────────── │
        │
        ├──(4) PUT 圖片位元組 直傳──▶ Microsoft Graph（存進 Jonathan 的 App Folder，不經過 Worker）
        │
        ├──(5) Worker 呼叫 Graph /items/{id}/invite，
        │      把這個項目分享給 Minz 的帳號（唯讀）
        │
        └──(6) sendChatMessage kind='image' {itemId, ownerIdentity, w, h, thumbDataUri}

Minz 讀圖 ──▶ Worker 用 Minz 自己的 access token 查
              me/drive/sharedWithMe 或直接用分享後的 remote item 參照
              → 換一個短效 downloadUrl 回傳給 Minz 的瀏覽器
```

- **Azure App 註冊**：一次性，使用者在 portal 操作（步驟見 §6，只做
  一次，不因為雙帳號變成兩次——App 註冊是「這個 App 的身分」，不是
  「哪個使用者」）。
- **OAuth2 授權碼流程**：Jonathan、Minz 各自跑一次，各自把自己的
  OneDrive 連上（已實作，見 §3）。
- **憑證分工**：client secret → Worker secret（wrangler secret，
  兩人共用同一組 client id/secret）；refresh token → Supabase
  （`onedrive_account` 表，`identity` 為 key，兩人各一列）；access
  token → Worker module-scope 記憶體快取，依 identity 分開存，不落地。
- **Worker 不碰圖片位元組**：上傳直傳 Graph、下載換短效
  downloadUrl——免費版 Worker 的 CPU/流量都省下來。

## 2. 資料流（Phase B，2026-07-15 已實作部署）

### 2.1 傳圖

1. 選圖（`<input type="file" accept="image/*">`）→ 前端 canvas 壓縮：
   最長邊 1600px、JPEG q0.8（實測聊天圖大多落在 100–400KB）。
2. 同時產 **blur-up 縮圖**：最長邊 ~24px 的 JPEG data URI（1–2KB），
   直接存進訊息 metadata——歷史訊息即開即看，不用等 Graph。
3. **Optimistic UI**：本地 `URL.createObjectURL` 立即上泡泡（沿用
   pendingMessages 機制，`is-pending` 樣式＋「傳送中...」）。
4. `requestImageUpload`（Worker action，需 session）→ Worker 用
   **傳送者自己**的 access token（`getOnedriveAccessToken(env,
   senderIdentity)`）對 `me/drive/special/approot:/chat/{uuid}.jpg
   :/createUploadSession` → 回 `uploadUrl` 給前端。
5. 前端直接 `PUT` 到 uploadUrl（pre-authenticated，不帶 Authorization
   header；≤4MB 一個 chunk 就結束）。完成的回應就是 driveItem，拿
   `id`。
   - **Phase B 第一件事先驗證**：consumer OneDrive 的 uploadUrl 是否
     接受瀏覽器 CORS PUT。若被擋，**fallback**：改走 Worker 傳遞
     （壓縮後圖夠小，`uploadImageViaWorker` 收 base64 轉存 Graph
     simple upload `PUT :/content`）。架構其餘部分不變。
6. `sendChatMessage` 前，Worker 呼叫 Graph
   `POST /me/drive/items/{id}/invite`（用傳送者的 token），
   `recipients` 帶對方的 Microsoft 帳號 email（連接 OneDrive 時順便
   跟 Graph `/me` 要來存進 `onedrive_account`，見 §4 待補欄位），
   `roles:["read"]`、`requireSignIn:true`——**這一步失敗不擋訊息
   發送**（例如對方剛好還沒連接），只是對方暫時看不到這張圖，訊息
   本身照樣送出，metadata 記下分享失敗（前端可顯示「對方尚未能看到
   這張圖」之類的提示，細節留給實作時判斷）。
7. `sendChatMessage` 帶 `kind:'image'`、`metadata:{itemId,
   ownerIdentity, w, h, thumbDataUri, sharedOk}`。失敗照既有
   optimistic 回滾。

### 2.2 顯示圖

- 泡泡先渲染 `thumbDataUri`（模糊、按 w/h 佔位防跳版）。
- 進入可視範圍的圖批次換真圖：`getImageUrls {items:[{itemId,
  ownerIdentity}, ...]}` → Worker 依目前登入身分分兩種情況：
  - **自己就是 ownerIdentity**（圖是自己傳的）：直接用自己的 token
    查 `GET /me/drive/items/{itemId}?select=id,
    @microsoft.graph.downloadUrl`。
  - **對方傳的圖**：用**自己的** token 查
    `GET /me/drive/sharedWithMe`，比對 remote item 的原始 `id`／
    `driveId` 找到對應項目，取得的 remote item 一樣有
    `@microsoft.graph.downloadUrl`。查不到（分享還沒生效／被撤銷）
    就回一個明確的「尚未分享」狀態，前端顯示對應提示而不是壞圖示。
  downloadUrl 效期約 1 小時：前端記憶體快取＋`<img>` onerror 時重換
  一次。
- 點圖 → 簡單全螢幕 lightbox（既有 modal 寫法，兩個外殼 CSS 各一份）。

### 2.3 APK 自架（Phase C，2026-07-15 程式碼完成，已部署並真機驗證過）

- 本機建完 APK 後用 Node 腳本（`tools/upload-apk.mjs`）經 Worker
  `createApkUploadSession` action 用 **Jonathan** 的 access token 上傳到
  `approot/releases/jonaminz-<時間戳>.apk`（**每次獨立檔名，不覆蓋**
  ——2026-07-15 同日稍後從原本固定覆蓋 `jonaminz.apk` 改的，使用者
  反映「怕裝錯」分不出新舊下載；這件事跟雙帳號無關，固定用 Jonathan
  的帳號存放即可）。
- Worker `GET /appDownload` → 列出 `releases/` 資料夾挑 `createdDateTime`
  最新一筆 → 換 fresh downloadUrl → `302` 轉址。固定網址從此是
  `https://<worker網域>/appDownload`（也是工具包頁面「下載最新 APK」
  連結指向的網址）。
- **`createApkUploadSession` 的認證方式（2026-07-16 新增第二種）**：
  原本只接受一般登入 session；使用者反映每次 build 完都要重新跟他要
  session token 太麻煩，新增一把跟個人登入分開、不會過期的密鑰認證
  路徑（見 `requireSessionOrAgentToken()`）。值存在 `agent_secrets`
  表（`name='apk_upload_token'` 那筆）——使用者要求要像「Cloudflare
  secret api 儲存那種模式」，在 `pages/admin/toolkit/`「Agent 存取」
  小節自己輸入名稱／值存進去，不是 Worker 自動產生（第一版是自動
  產生、只看一次不能讀回，使用者當面回饋不是他要的，改成這版取代
  第一版）。`payload.token` 放這把鑰匙一樣能用，
  `tools/upload-apk.mjs` 完全不用改。細節見
  `AI_CONTEXT/CHANGELOG.md` 2026-07-16「APK 上傳專用固定密鑰」與
  「Agent 密鑰保管箱改版」兩則條目。
- 真機驗證下載安裝已完成（2026-07-15 起多次真機測試成功）：
  `gh release delete app-latest`，公開通道收回（使用者 2026-07-15
  之前明訂的回收計畫）——**這個收回動作本身是否已執行未在本文件
  查證，需要時直接 `gh release list` 確認現況，不要假設**。

## 3. Token 生命週期（Phase A，已實作部署）

- **不走 jonaminz.com 中繼頁**：跟 Google 登入完全同一個模式
  （`GOOGLE_REDIRECT_URI` 一樣是 Worker 自己的網域），Azure 的
  redirect_uri 直接設成
  `https://jonaminz-backend.ndmc402010104.workers.dev/auth/onedrive/callback`。
  這是瀏覽器導向流程（302），不是 `POST /api/action`：
  - `GET /auth/onedrive/start?token=<session token>`——`requireSession`
    驗證呼叫者已登入即可發起（**兩個身分都可以**，各自只能連接
    自己的帳號，`start` 不接受指定要連誰）；產生 `state`（存進既有
    的 `oauth_states` 表，跟 Google 登入共用同一張表擋 CSRF，
    `return_origin` 欄位這裡存的是發起連接的登入身分，不是要導回的
    網域），導去 Microsoft 同意畫面。
  - `GET /auth/onedrive/callback?code=&state=`——核對 `state`、拿
    `code` 跟 Microsoft 換 access+refresh token、以 `state` 對應的
    身分為 key upsert 進 `onedrive_account` 表，回一頁純文字結果
    （`成功`/`失敗`原因）。**沒有 session token 要交回瀏覽器**——
    refresh token 全程只活在 Supabase，前端從頭到尾拿不到，跟
    Google 登入那套「導回帶 fragment token」不是同一件事。
- 之後 Worker 需要時（`getOnedriveAccessToken(env, identity)`）用該
  身分的 refresh token 換 access token，module 變數快取（物件，key
  是 identity，同 isolate 存活期間重複用，過期前 5 分鐘換新，跟
  `getFcmAccessToken` 同一個模式）；**個人帳號的 refresh token 會
  滾動更新**——回應裡有新的就覆蓋存檔，否則幾個月後斷線。
- scope：`Files.ReadWrite.AppFolder offline_access`（App Folder＝
  Graph 只能碰 `應用程式/jonaminz` 資料夾，最小權限；使用者自己的
  OneDrive 其他內容碰不到）。`start` 帶 `prompt=consent`，確保
  consumers 端點每次都真的核發 refresh_token（不會因為之前同意過就
  跳過畫面、不核發）。
- **Phase B 待補**：`/invite` 分享機制需要對方的 Microsoft 帳號
  email（`recipients` 參數）——連接 OneDrive 當下可以順便呼叫 Graph
  `GET /me` 拿 `mail`／`userPrincipalName` 存進 `onedrive_account`
  多一個 `account_email` 欄位（現在 schema 還沒有這欄，Phase B 開工
  時用 `alter table ... add column if not exists` 補）。

## 4. DB schema（`backend/supabase/onedrive_schema.sql`，已套用到 jonaminz-db）

```sql
create table if not exists onedrive_account (
  identity text primary key check (identity in ('jonathan', 'minz')),
  refresh_token text not null,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table onedrive_account enable row level security;
grant select, insert, update, delete on onedrive_account to service_role;
```

雙帳號版：`identity` 是 primary key，Jonathan／Minz 各自一列，不是
單列表。`chat_messages` 的 `kind` 加 `'image'`、`metadata` 欄位、
`onedrive_account` 補 `account_email` 都是 Phase B 的事，到那時再改
（不在這次 schema 檔裡）。

## 5. 前端/頁面新增

- **已實作**：`assets/js/backend-client.js` 加
  `getOnedriveStatus`／`testOnedriveConnection`／
  `getWorkerBaseUrlForRedirect`；`pages/admin/` 首頁新增 OneDrive
  區塊，**兩張並排卡片**（Jonathan／Minz 各一張）：登入者自己那張
  卡片未連接時顯示「連接 OneDrive」連結（`href` 指到
  `/auth/onedrive/start?token=...`，這是一般 `<a>` 導頁，不是
  fetch），已連接時顯示連接時間＋「測試連線」按鈕（呼叫
  `testOnedriveConnection`，只測呼叫者自己的帳號，實際打 Graph
  `me/drive/special/approot` 驗證，不只是「有沒有存 refresh_token」
  這種表面狀態）；另一半那張卡片永遠是唯讀狀態，沒有按鈕（不能代替
  對方連接/測試）。
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
   `Files.ReadWrite.AppFolder`、`offline_access`（Phase B 開工後
   還要加 `Files.ReadWrite`，因為 `/invite` 分享別人項目、讀
   `sharedWithMe` 不在 AppFolder 權限範圍內——這點跟 v1.0 單帳號
   設計不同，那時候完全不需要碰對方的東西）
6. 把 **Application (client) ID** 給 agent，另外設一個 Worker secret
   `wrangler secret put JONAMINZ_ONEDRIVE_CLIENT_ID`（雖然 client id
   本身不是機密，但這個專案的憑證統一走 secret，不寫進
   `wrangler.toml` 的 `[vars]`，跟其他 OAuth client id 一致）
7. **這一次註冊、這一組 client id/secret，Jonathan 跟 Minz 兩人都會
   用**——不用各自申請 Azure App，只是各自在後台按「連接
   OneDrive」時走同一個 App 的同意畫面、各自用自己的 Microsoft 帳號
   登入同意。

## 7. 實作順序

- **Phase A：授權底座（雙帳號）**——✅ schema／Worker
  `/auth/onedrive/start` `/auth/onedrive/callback`／token 刷新模組
  （per-identity 快取）／`getOnedriveStatus`（回兩人狀態）／
  `testOnedriveConnection`（只測自己）／後台雙卡片連接入口都已寫好
  並部署（2026-07-15）。剩下：使用者跑 §6 → 設兩個 secret →
  Jonathan 上後台按「連接 OneDrive」→ Minz 也上後台按「連接
  OneDrive」→ 兩人各自按「測試連線」看到 App Folder 名稱＝驗收通過。
- **Phase B：圖片訊息（單一副本＋Graph 原生分享）**——✅ schema／
  Worker（`requestImageUpload`／`sendImageMessage`／`getImageUrls`）／
  前端上傳/顯示/lightbox 都已寫好並部署（2026-07-15）。`Files.ReadWrite`
  權限已由使用者在 Azure Portal 加好，後台已補「重新連接」按鈕。
  剩下：Jonathan／Minz 各自重新走一次連接拿新 scope → 驗收＝兩台真機
  互傳圖，兩人各自都能看到對方傳的圖（**尚未做這步真人驗證**）。
- **Phase C：APK 自架**——✅ 已完成並部署（2026-07-15：
  `createApkUploadSession` action／`GET /appDownload`／
  `tools/upload-apk.mjs`，用 Jonathan 帳號存放；真機下載安裝已驗證
  過多次）。2026-07-16 追加：`createApkUploadSession` 除了原本的登入
  session，也接受一把跟個人登入分開、不會過期的密鑰（存在
  `agent_secrets` 表，`pages/admin/toolkit/`「Agent 存取」小節自己
  輸入名稱／值管理，像 Cloudflare secret 保管箱），解決「agent 每次
  build 完都要跟使用者要 token」的協作痛點。
