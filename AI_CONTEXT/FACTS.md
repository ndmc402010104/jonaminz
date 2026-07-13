# FACTS — 已驗證事實清單

本檔只收錄「已經用程式碼／schema／設定檔實際核對過」的事實，不收錄規劃、
裁決方向或未驗證的說法（那些分別放 `DECISIONS.md`／`EXPERIMENTS.md`／
`KNOWN_ISSUES.md`）。每項事實標三個獨立狀態，互不蘊含：

- **repo 已實作**：程式碼／schema／設定檔裡確實存在這個邏輯（本次盤點親自讀過原始碼）。
- **已部署**：有 `wrangler deploy`／`git push` 的紀錄（Version ID、`wrangler secret
  list`、GitHub Pages 建置）證明正式環境在跑這份程式碼。本次盤點**沒有**重新執行
  `wrangler deploy` 或對正式環境發出新的驗證請求，「已部署」的判定來自
  `AI_CONTEXT/CHANGELOG.md` 裡記載的部署紀錄（Version ID、`wrangler secret list`
  輸出等），不是本次盤點自己重新打過的證據。
- **已人工驗證**：CHANGELOG 裡有紀錄顯示真人（使用者）在正式環境實際操作過，或有
  curl／Playwright 對正式環境的驗證紀錄。同上，本次盤點沒有重新執行這些驗證，是
  引用 CHANGELOG 既有紀錄。

驗證日期（本次盤點讀取程式碼的日期，已用 `date` 指令查證系統時間）：**2026-07-12**。

---

## 一、登入與 Session

| # | 事實 | 驗證檔案 | repo 已實作 | 已部署 | 已人工驗證 |
|---|---|---|---|---|---|
| 1 | 已實作 Google OAuth（authorization code flow） | `backend/cloudflare-worker/worker.js` `handleGoogleStart`/`handleGoogleCallback`（第979-1095行） | 是 | 是（CHANGELOG 2026-07-12「後台整站加登入保護」條目記錄 Version ID `22eaa5a1-...`） | 是（CHANGELOG 記載使用者親自在 `https://www.jonaminz.com/pages/login/` 走完 Google 同意畫面並成功登入） |
| 2 | 仍保留內部密語登入（`loginWithInternalToken`），與 Google OAuth 並存，不是互斥的兩代機制 | `worker.js` 第883-902行；`pages/login/assets/js/app.js` 第98-143行同時渲染兩個入口 | 是 | 是（同上） | 是（CHANGELOG 記載使用者親自測過內部密語登入成功） |
| 3 | Session 存放在 Supabase `sessions` table（不是自簽 JWT） | `backend/supabase/auth_schema.sql` 第9-15行 `create table sessions(token text primary key, identity text, provider text, created_at, expires_at)`；`worker.js` `createSession()`/`requireSession()` | 是 | 是（CHANGELOG 記載已直連套用到 `jonaminz-db`，套用前後查過 `information_schema` 確認） | 是（CHANGELOG 記載使用者登入後直連查過 `sessions` 表確認產生新 row） |
| 4 | Session 是 server-side database session，不是自簽 JWT——查驗靠 DB row 是否存在＋`expires_at`，登出靠刪除 DB row，不需要 blocklist | `worker.js` `requireSession()`（第908-932行）：查 `sessions?token=eq...`，比對 `expires_at`；`logout()`（第965-977行）：`DELETE .../sessions?token=eq...` | 是 | 是 | 是 |
| 5 | 瀏覽器端 Session 憑證存在 `localStorage`，key 固定是 `jonaminz.sessionToken` | `assets/js/header.js` 第37行 `var TOKEN_KEY = "jonaminz.sessionToken"`；`pages/login/assets/js/app.js` 第25行同一個字串；`pages/identity-relay/index.html` 第38行同一個字串 | 是（三處字串完全一致，非各自為政） | 是 | 是 |
| 6 | **沒有使用 Cookie**——Worker 端沒有 `Set-Cookie`，前端沒有讀寫 `document.cookie` | 全 repo grep `Set-Cookie`／`document.cookie` 無結果；`worker.js` 註解明講「不是 cookie（`jonaminz.com` 的 DNS 掛在 Squarespace，Worker 沒辦法對 `.jonaminz.com` 設 cookie）」（第56-57行） | 是（確認沒有） | 是 | 是 |
| 7 | 使用 `localStorage`（非 sessionStorage、非 IndexedDB）存 session token | `header.js` `readToken()`/`writeToken()` 用 `window.localStorage.getItem/setItem`（第40-63行） | 是 | 是 | 是 |
| 8 | Google OAuth callback 把 token 放在 URL fragment：`#jonaminzSessionToken=...` | `worker.js` 第1093行：`redirectUrl = returnOrigin + "/#jonaminzSessionToken=" + encodeURIComponent(session.token)` | 是 | 是 | 是（CHANGELOG 記載使用者實測過 OAuth 完整流程） |
| 9 | 前端會讀取 URL fragment、寫入 localStorage，再用 `history.replaceState` 清除網址列上的 token | `header.js` `captureTokenFromHash()`（第65-80行），在 IIFE 最外層無條件執行（不等 `[data-jonaminz-header]` 元素存在），因為首頁沒有這個共用元素但正是 OAuth 導回的目的地 | 是 | 是 | 是（CHANGELOG 記載本機 Playwright 驗證過 hash 擷取＋清除網址） |
| 10 | Session TTL 是 30 天 | `worker.js` 第839行：`const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 天` | 是 | 是 | 未直接驗證到期後真的失效（邏輯上靠 `requireSession()` 比對 `expires_at`，未見有意等 30 天後的實測紀錄，屬合理推論但非人工驗證過整個週期） |
| 11 | `requireSession()` 驗證方式：查 `sessions` 表拿 `identity`/`expires_at`，`expires_at < now` 視為未登入（不主動刪除過期 row） | `worker.js` 第908-932行 | 是 | 是 | 是（curl smoke test 有測「不帶 token」「帶已淘汰的 adminToken 欄位」的拒絕路徑，CHANGELOG 記錄） |
| 12 | 登出同時做兩件事：(1) 前端清除 localStorage token；(2) 呼叫 Worker `logout` action 刪除 Supabase `sessions` row | `header.js` `buildIdentityBox()` 的登出按鈕 handler（第123-134行）：先 `clearToken()`，再 `window.JonaminzBackend.logout({token})` | 是 | 是 | 未見 CHANGELOG 明確記載使用者親自點過登出並驗證 DB row 消失（僅驗證過登入/身分顯示，登出這條路是本機 Playwright mock 測試，非正式環境人工驗證——見 `KNOWN_ISSUES.md`） |
| 13 | `requireLogin()`（後台權限關卡，跟 `mount()` 的「失敗開放」相反，是「失敗關閉」）保護的頁面：`/pages/admin/`、`/pages/admin/theme/`、`/pages/admin/contracts/` 三頁 | 逐一讀過三頁的 `app.js`：`pages/admin/assets/js/app.js` 第88行、`pages/admin/theme/assets/js/app.js` 第561行、`pages/admin/contracts/assets/js/app.js` 第291行，皆在 `init()` 呼叫 `window.JonaminzIdentity.requireLogin()` | 是（三頁，不多不少；首頁 `assets/js/app.js`、登入頁 `pages/login/assets/js/app.js` 皆未呼叫） | 是 | 是（CHANGELOG 記載使用者親自用真實帳號驗證過三頁的登入關卡） |
| 14 | 要求有效 session 的 Worker action：`saveThemeCssRules`／`approveContract`／`rejectContract`（共用 `requireSession(env, payload)` helper，沒有 session 回 `{ok:false, code:"UNAUTHORIZED"}`，HTTP 200 不是 401） | `worker.js` 第313行、第622-626行、第651-655行 | 是（僅此三個 action；`registerExternalApp`／`listExternalAppRegistrations`／`getThemeCssRules`／`submitContract`／`listPendingContracts`／`getEffectiveSettings`／`getSdkVersion`／`loginWithInternalToken`／`getCurrentIdentity`／`logout`／`getGrantedIdentity` 皆為公開或不需登入） | 是 | 是（CHANGELOG 記載 curl smoke test：不帶 token 與帶舊 `adminToken` 欄位皆正確回 `UNAUTHORIZED`） |
| 15 | `JONAMINZ_ADMIN_TOKEN` 已從 Worker 程式碼與 Cloudflare secret 中完全移除，不是「仍是正式機制」 | 全 repo grep `JONAMINZ_ADMIN_TOKEN`：`worker.js` 僅在註解裡出現（說明「已淘汰」），沒有任何 `env.JONAMINZ_ADMIN_TOKEN` 讀取或比對邏輯；`pages/admin/contracts/assets/js/app.js` 沒有 `adminToken` 欄位或輸入框 | 是（確認已刪除，不是殘留） | 是（CHANGELOG 記載 `npx wrangler secret delete JONAMINZ_ADMIN_TOKEN` 已執行，`wrangler secret list` 確認剩 8 個 secret，名單不含它） | 是 |
| 16 | Google OAuth 與內部密語登入建立的 session 格式完全相同（同一張 `sessions` 表，只有 `provider` 欄位值不同：`"google"` 或 `"internal"`） | `auth_schema.sql` 第12行 `provider text not null check (provider in ('google', 'internal'))`；`worker.js` `createSession(env, identity, provider)` 被兩條登入路徑共用呼叫 | 是 | 是 | 是 |
| 17 | `identity.currentUser@1` capability 機制已在程式碼與正式環境就位，但**目前沒有任何專案被授權使用** | `backend/cloudflare-worker/integration-settings.json`：唯一登記的專案 `jonaminz-movies` 的 `capabilities` 欄位是空陣列 `[]`；`worker.js` `resolveEffectiveCapabilities()`／`getGrantedIdentity` 邏輯已完整存在 | 是 | 是（CHANGELOG 記載已 `wrangler deploy`，`getSdkVersion` 指向含此 capability 的 SDK hash `5d8e909081bf`） | 部分：機制本身的六種情境（未授權/已授權+已登入/已授權+未登入/雙重防線/逾時/偽造來源）已用 Playwright 對 mock+真實 Worker 混合環境驗證過（CHANGELOG 記載）；「正向授權」（某真實專案真的被授權、真的透過已登入 session 取得身分）**沒有真實資料可測**，因為沒有專案的 Contract 宣告支援這個 capability——這條路目前只在 mock 環境驗證過 |
| 18 | `pages/identity-relay/` 頁面存在且已接上真實授權判斷（`getGrantedIdentity`），不是仍停在階段 A 的空殼 | `pages/identity-relay/index.html`：讀自己 URL 的 `projectId` query string，呼叫 `getGrantedIdentity`（不是舊版的 `getCurrentIdentity`） | 是 | 是 | 是（Playwright 端到端驗證過六種情境，CHANGELOG 記載） |

## 二、Contract 與外部 App 架構

| # | 事實 | 驗證檔案 | repo 已實作 | 已部署 | 已人工驗證 |
|---|---|---|---|---|---|
| 19 | 外部 App 使用 `jonaminz.contract.json`（不是舊的 `jonaminz-app.json`）向平台推送合約 | `docs/contract-schema/jonaminz.contract.schema.json`／`.example.json`；`sdk/sdk-src/sdk.js` `DEFAULT_CONTRACT_PATH = "/jonaminz.contract.json"` | 是 | 是 | 是（jonaminz-movies 真實推送並被記錄進 `contract_snapshots`，CHANGELOG 記載直連 DB 確認） |
| 20 | 外部 App 載入共用 `sdk/jonaminz-entry.js`（常青 loader），不是直接載 `sdk-<hash>.js` | `sdk/jonaminz-entry.js`：向 `getSdkVersion` 問 channel 指標，動態載入對應的 immutable 檔案 | 是 | 是 | 是（CHANGELOG 記載 kill-switch／回滾已在正式環境操作並復原過） |
| 21 | Contract snapshot 是 immutable：每次推送寫入新的一列 `contract_snapshots`，不是覆寫舊列 | `backend/supabase/contract_schema.sql` 第11-25行：`id bigint generated always as identity`，`worker.js` `submitContract()` 一律 `INSERT` | 是 | 是 | 是 |
| 22 | submit 後一律先進 `pending`，不等於採信；沒有任何路徑自動 approve | `worker.js` `submitContract()` 第512行 `status: "pending"`；全 repo grep 找不到任何把 status 直接設成 `"approved"` 的路徑，approve 只能經 `approveContract` action | 是 | 是 | 是 |
| 23 | approve／reject 有 audit log，且每次操作都新增一筆記錄（不覆寫舊紀錄） | `contract_schema.sql` `contract_audit_log` 表 + `approve_contract_snapshot`/`reject_contract_snapshot` 兩個 Postgres function，皆用 `insert into contract_audit_log` | 是 | 是 | 是（CHANGELOG 記載對 jonaminz-movies 真實 snapshot 跑過 submit→reject→approve→撤回→再核准，直連 DB 確認 audit log 5 筆、一筆未覆寫） |
| 24 | Effective Settings（`css`／`capabilities`）由平台（Worker 的 `getEffectiveSettings`）計算，不是外部專案自己算或宣告 | `worker.js` `getEffectiveSettings()`：公式 `min(Contract 聲明, Settings 授予)`（css）與交集（capabilities），environment 一律用 Worker 自己的 `JONAMINZ_ENVIRONMENT`，不採信 payload | 是 | 是 | 是（curl 驗證過三條路徑，CHANGELOG 記載） |
| 25 | capability 已由「佔位空陣列」改成真實交集運算，不再是形狀先定、內容空白 | `worker.js` `resolveEffectiveCapabilities()`（第704-727行）：`supports.filter(c => granted.indexOf(c) !== -1)`，`getEffectiveSettings` 回應的 `capabilities` 欄位改讀這個 helper 的結果，不再寫死 `[]` | 是 | 是 | 是（node 腳本窮舉 8 種組合驗證交集邏輯，CHANGELOG 記載） |
| 26 | Registry（`registry.json`）／Integration Settings（`integration-settings.json`）與 Contract 是兩個獨立機制，責任邊界不同：前者是 v0 拉模式（外部專案自報 `jonaminz-app.json`，jonaminz 決定 enabled/position/order），後者是 Platform Integration 推模式（外部專案推 Contract，Worker 依 Integration Settings 判斷同源與授權） | `assets/js/registry-loader.js` 讀 `registry.json`；`worker.js` `submitContract`/`getEffectiveSettings` 讀 `integration-settings.json`；兩份設定檔互不參照 | 是（兩者並存，v0 未作廢） | 是 | 是 |
| 27 | Movies（`jonaminz-movies`）是獨立 repo、獨立部署（GitHub Pages）的 first-party 外部專案，不是 jonaminz Core 內部模組 | `integration-settings.json` 唯一登記的專案 `jonaminz-movies`，origin `https://ndmc402010104.github.io`；PROJECT_STATE.md 記載獨立 repo `ndmc402010104/jonaminz-movies` | 是 | 是（該 repo 已公開部署） | 是（曾用其真實 pending snapshot 完整跑過 submit→approve 流程） |
| 28 | SKHPSv2 定位是外部接入 App（透過 Contract／identity capability 機制），不是 jonaminz Core 的一部分；截至本次盤點，SKHPSv2 尚未透過 Contract 機制正式登記（`integration-settings.json` 只有 `jonaminz-movies` 一筆） | `integration-settings.json` 只有一個 project entry；`docs/platform-integration-v1-implementation-plan.md` 明文「SKHPSv2 正式接入 jonaminz……2026-07-11 明確裁決不急」 | 是（尚未登記是事實，不是遺漏） | — | — |
| 29 | `registry.json` 的 `externalProjects` 目前是空陣列，v0 拉模式沒有任何真實外部專案掛在上面 | `registry.json`：`{"schemaVersion":1,"externalProjects":[]}` | 是 | 是 | 是 |

## 三、公開／私人入口與導航

| # | 事實 | 驗證檔案 | repo 已實作 | 已部署 | 已人工驗證 |
|---|---|---|---|---|---|
| 30 | 登入頁支援 `?next=` 參數，登入成功後導回原頁面，且做了開放式重導向防護（只接受同源相對路徑，拒絕 `://`／`//` 開頭與非 `/` 開頭的值） | `pages/login/assets/js/app.js` `getNextUrl()`（第70-81行） | 是 | 是 | 是（CHANGELOG 記載 Playwright 驗證過 next 正常流程與開放式重導向防護） |
| 31 | Google OAuth 這條登入路（2026-07-12 修復後）**已經**把 `next` 一起帶回——`handleGoogleStart` 驗證存進 `oauth_states.next`，`handleGoogleCallback` 重新驗證後拼進最終 redirect（`returnOrigin + returnNext + "#jonaminzSessionToken=..."`），跟內部密語登入行為一致 | `worker.js` 的 `resolveOauthReturnNext()`／`handleGoogleStart`／`handleGoogleCallback`；`backend/supabase/auth_schema.sql` 的 `oauth_states.next` 欄位；`pages/login/assets/js/app.js` `googleStartUrl()` 帶 `&next=` | 是 | 是（`wrangler deploy` Version ID `03659c8e-ecbc-4051-a368-8ffd3c1d85cd`；DB migration 已套用到 `jonaminz-db`） | 部分：node 腳本窮舉 10 種 edge case 確認 sanitize 邏輯正確、curl 確認轉址正常、直連 DB 確認 `next` 欄位正確存值；但 Google 同意畫面那段需要真人瀏覽器互動，**還沒有人親自走完一次完整登入流程確認最終導頁正確** |
| 32 | Access policy 不是整個 App 二分 public/private，而是以 `entryId`／頁面為粒度個別決定（後台四頁——`admin`／`admin-theme`／`admin-contracts`／`admin-design`——各自 `requireLogin()`，首頁、登入頁、`jonathan`、`minz` 不需要登入） | 逐頁核對 `init()` 邏輯：`pages/admin/design/assets/js/app.js` 2026-07-13 盤點時確認也呼叫 `requireLogin()`，本條原文只列「後台三頁」是 2026-07-11 該頁尚未存在時的舊事實，本次已更正為四頁 | 是 | 是 | 是 |
| 33 | Contract 的 `not` 反面表列明文禁止合約自己宣告 `enabled`／`visibility`／`placement`／`permissions`／`grantedCapabilities` 等定位類欄位——定位永遠由平台（Integration Settings）決定，不是合約自己說了算 | `docs/contract-schema/jonaminz.contract.schema.json` 的 `$defs/forbiddenFieldsGuard`；`docs/contract-schema/README.md` 逐欄位對應表 | 是 | 是 | 是（ajv-cli 跑過反例確認這些欄位出現會讓合約 invalid） |
| 34 | `/pages/admin/design/` 的專案卡片「進入」按鈕（2026-07-13 起）在有合法入口時是真的 `<a href>`，不是 disabled 假按鈕；URL 用 `previousApproved.rawContract.entries`（entryId==="main" 優先，否則第一個有 url 的 entry）＋`previousApproved.origin` 解析，origin 來自 Worker 端查 `integration-settings.json`（不是 Contract 自己宣告的值，也不是 snapshot 的 `submitted_origin`——後者已證實同一專案不同筆會不一致甚至是 `null`，不可信） | `worker.js` `listPendingContracts()`：`activeByKey` 新增 `origin` 欄位；`pages/admin/design/assets/js/app.js` `pickMainEntry()`／`resolveEntryHref()` | 是 | 是（`wrangler deploy` Version ID `2d96d19e-1d51-4ac0-93cd-4b67c3b09758`） | 是（curl 對正式 Worker 確認 `jonaminz-movies` 回傳 `origin:"https://ndmc402010104.github.io"`；Playwright 對正式環境端到端確認卡片渲染出 `href="https://ndmc402010104.github.io/jonaminz-movies/"` 且該網址真的回 HTTP 200；另外 mock 測試涵蓋「有 origin 無 entries」「有 entries 無 origin」「無 main entry 退回第一個」「pending 列不覆蓋 active 入口」四種邊界情境，鍵盤 focus 與桌機/手機皆確認可用） |

---

## 備註：本次盤點方法

以上事實全部經由直接讀取以下原始檔案得出，不是憑記憶或猜測：
`backend/cloudflare-worker/worker.js`（1095 行全讀）、
`backend/supabase/auth_schema.sql`、`backend/supabase/contract_schema.sql`、
`assets/js/header.js`、`assets/js/app.js`、`assets/js/backend-client.js`、
`assets/js/registry-loader.js`、`pages/login/assets/js/app.js`、
`pages/identity-relay/index.html`、`pages/admin/assets/js/app.js`、
`pages/admin/theme/assets/js/app.js`、`pages/admin/contracts/assets/js/app.js`、
`sdk/sdk-src/sdk.js`、`sdk/jonaminz-entry.js`、
`backend/cloudflare-worker/integration-settings.json`、`registry.json`、
`config.json`、`version.js`、`index.html`。
