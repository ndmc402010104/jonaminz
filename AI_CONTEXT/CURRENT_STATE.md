# CURRENT_STATE — 現況速覽（給第一次接手的 agent）

最後盤點：2026-07-12（文件真實性盤點，見 `SESSION_LOG.md` 同日條目）。
本檔是「現在系統長什麼樣子」的濃縮版；逐條證據見 `FACTS.md`，裁決方向
（含尚未實作的部分）見 `DECISIONS.md`，已知風險見 `KNOWN_ISSUES.md`，
未決的技術選型見 `EXPERIMENTS.md`。**與 `AI_CONTEXT/PROJECT_STATE.md`
的關係**：`PROJECT_STATE.md` 是逐任務的完整工程流水帳（含每個里程碑的
實作細節與驗證過程），本檔是給第一次接手、只想快速建立正確心智模型的
人看的濃縮結論，兩者不衝突，細節有出入時以 `PROJECT_STATE.md`／程式碼
為準。

---

## 一、Auth／Session 做到哪裡

**已完成並上線**：
- 兩條登入路徑並存：Google OAuth（authorization code flow）＋內部密語
  （`loginWithInternalToken`），兩者建立的 session 格式完全相同。
- Session 是 Supabase `sessions` 表的真實 database row（`token` 為
  primary key），**不是自簽 JWT**。TTL 30 天。查驗與登出都是直接對這張
  表做 SELECT／DELETE，沒有 JWT 簽章驗證或 blocklist。
- 瀏覽器端憑證存放方式：**`localStorage`，key 固定 `jonaminz.sessionToken`**。
  **完全沒有使用 Cookie**——Worker 沒有 `Set-Cookie`，前端沒有讀寫
  `document.cookie`。原因是 `jonaminz.com` 的 DNS 掛在 Squarespace（不是
  Cloudflare），Worker 無法對 `.jonaminz.com` 設跨子網域 cookie。
- Google OAuth callback 用 URL fragment 傳遞 token
  （`#jonaminzSessionToken=...`，fragment 不送到伺服器），前端
  `header.js` 的 `captureTokenFromHash()` 讀出來寫進 localStorage 後
  立刻用 `history.replaceState` 清掉網址列。
- 整個後台（`/pages/admin/`、`/pages/admin/theme/`、
  `/pages/admin/contracts/`）都要求登入（`requireLogin()`，失敗必定
  導頁到 `/pages/login/?next=...`）。三個寫入 action
  （`saveThemeCssRules`／`approveContract`／`rejectContract`）在 Worker
  端也各自要求有效 session（`requireSession()`），操作人直接用登入身分
  決定，不是前端自報。
- 舊的 `JONAMINZ_ADMIN_TOKEN` 固定密語機制**已完全淘汰**：Cloudflare
  secret 已刪除，`worker.js` 沒有任何讀取它的邏輯，前端沒有殘留的
  token 輸入框。
- `identity.currentUser@1` capability（S30-33 規格意義下的正式
  service）機制已上線：`window.Jonaminz.identity.currentUser()` 一定存在
  （不論呼叫端有沒有被授權），未授權時 reject `CAPABILITY_NOT_GRANTED`；
  真正的授權判斷由 `pages/identity-relay/` 背後的 `getGrantedIdentity`
  action 逐請求重算，不信任 SDK 端快取的 capabilities 陣列。
- **但目前沒有任何專案被授權使用這個 capability**——唯一登記的外部專案
  `jonaminz-movies` 的 `capabilities` 欄位是空陣列。機制就位、沒開通給
  任何人，是刻意的（跟當初 `css` 授予的保守策略一致）。

**尚未完成／已知缺口**：
- ~~Google OAuth 登入這條路沒有把 `?next=` 帶回~~ **已於 2026-07-12
  修復**：`oauth_states` 新增 `next` 欄位、`handleGoogleStart`/
  `handleGoogleCallback` 驗證後帶著走，跟內部密語登入行為一致。機制
  已部署驗證，但還沒有人親自走完一次完整 Google 登入流程確認最終導頁
  正確（見 `KNOWN_ISSUES.md` 第 2 條）。
- 沒有跨子網域的 App SSO——`pages/identity-relay/` 只做「單向查詢身分」
  （用於 SDK 的 `identity.currentUser()`），不是完整的單一登入態同步。
- 沒有跨 App 的 `returnTo`（從外部 App 導去 jonaminz 登入、登入完再導回
  外部 App 那個確切頁面）——現有 `?next=` 只處理 jonaminz 站內導頁。
- 沒有 Cookie／自訂 Auth domain（`auth.jonaminz.com` 之類）——這是
  DNS 掛在 Squarespace 的直接後果，不是還沒做，是目前架構下做不到（除非
  改 DNS，見 `EXPERIMENTS.md`）。
- 過期的 `sessions`／`oauth_states` row 不會自動清理（`requireSession()`
  只是判定過期 row 視同未登入，不會主動 DELETE），沒有排程清理機制。
- 登出這條路（清 localStorage＋刪除 Supabase session row）目前只在本機
  Playwright（mock 環境）驗證過，沒有 CHANGELOG 記錄使用者在正式環境
  親自點過登出並確認 DB row 真的消失。

## 二、Contract／外部 App 平台做到哪裡

**已完成並上線**（Platform Integration implementation plan 第 1-7 項、
第 9 項階段 A/B，見 `docs/platform-integration-v1-implementation-plan.md`）：
- Contract JSON Schema（`docs/contract-schema/`）定案 RC3.1，Worker 用
  build-time 預編譯的 ajv standalone validator 驗證。
- `submitContract`：收到合約一律先進 `pending`，永不自動 approve；核對
  登記的 origin、cross-field 檢查、canonical hash 去重。
- 核准後台 `/pages/admin/contracts/`：pending 清單、跟 active 版本的
  diff、核准／否決（可互相改判，不是終態），走 Postgres function 原子
  更新三張表（`contract_snapshots`／`contract_active_snapshots`／
  `contract_audit_log`）。
- `getEffectiveSettings`：S31 公式，`css = min(Contract 聲明, Settings
  授予)`，`capabilities` 是真實交集（不再是佔位空陣列）。
- SDK 常青 loader（`sdk/jonaminz-entry.js`）＋ SDK Kernel
  （`sdk/sdk-src/sdk.js`）：contract discovery、推送、查 Effective
  Settings、settle `ready`/`degraded`、`tokens` CSS 收編、
  `identity.currentUser@1` 首個正式 service。
- **唯一真實登記並跑過完整流程（submit→approve→撤回→再核准）的外部
  專案是 `jonaminz-movies`**（獨立 repo、GitHub Pages 部署）。

**尚未完成**：
- `window.Jonaminz.*` 除了 `identity.currentUser@1` 以外，**沒有任何
  其他已發布的 service**（`search`／`notification` 等在 F11/S30 名單
  上的名字都還沒有實作，只是保留名稱）。
- SKHPSv2 尚未透過 Contract 機制正式登記（另一個 repo，使用者已明確
  裁決「不急」，目前是另一個 AI 工具在處理該 repo）。
- v0 機制（`registry.json` 拉模式＋`jonaminz-app.json`）與 Platform
  Integration（Contract 推模式）**兩套並存**，v0 尚未作廢（作廢需三
  條件，見 `DECISIONS.md` #15），`registry.json` 目前是空的。

## 三、Chat／AI participant／跨 App 導航

- **Chat 是 Core 的裁決方向，repo 內完全沒有任何實作**（沒有 UI、沒有
  訊息表、沒有 Worker action）。
- **AI participant framework／Gemini as provider 同樣是純方向裁決**，
  沒有對應程式碼。
- **App Launcher／跨 App 導航（Navigation Gateway）只有雛形**：登入頁
  `?next=` 站內導回、`identity-relay` 單向身分查詢，沒有統一的
  App Launcher UI，沒有完整的跨 App `returnTo`。

## 四、正式架構 vs 未來方向（一句話對照表）

| 主題 | 目前正式架構 | 未來方向（尚未拍板細節，見 EXPERIMENTS.md） |
|---|---|---|
| Session 憑證 | localStorage bearer token | 是否改 HttpOnly Cookie（需先解決 DNS 掛 Squarespace 的限制） |
| Session 儲存 | Supabase `sessions` 表，database session | 未變更方向 |
| 跨 App 身分 | iframe + postMessage 單向查詢（identity-relay） | 是否做完整 SSO |
| 外部 App 接入 | Contract 推模式（新）＋ registry.json 拉模式（舊，並存） | v0 何時真正作廢 |
| Auth domain | 沒有獨立網域，Worker 用 `*.workers.dev` | 是否搬 `auth.jonaminz.com`／`api.jonaminz.com` |
| Chat/AI | 完全未實作 | 尚無時程 |
