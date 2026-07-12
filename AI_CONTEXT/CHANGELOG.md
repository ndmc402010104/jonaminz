# CHANGELOG — 專案變更紀錄（AI agent 交接用）

規則：
- 新紀錄加在**最上面**（reverse chronological）。
- 每完成一個任務追加一筆，格式照下方模板。git log 記「改了什麼檔案」，
  這裡記「為什麼改、狀態怎麼變、下一棒要知道什麼」——兩者不重複。
- 不要改寫或刪除歷史紀錄；寫錯就追加更正紀錄。

## 紀錄模板

```markdown
## YYYY-MM-DD — 〔一句話標題〕

- **任務**：〔任務單標題或一句話描述〕
- **變更**：〔改了什麼，工程視角，2-5 行〕
- **狀態變化**：〔PROJECT_STATE 的哪些項目從未完成→完成，或新增了什麼未完成項〕
- **遺留**：〔未完成/已知問題/給下一棒的注意事項；沒有就寫「無」〕
- **版本**：〔version.js 的新版本號；未 bump 寫「無程式碼變更」〕
```

---

## 2026-07-12 — 後台整站加登入保護，統一掉 JONAMINZ_ADMIN_TOKEN

- **任務**：第 9 項階段 A（jonaminz 主站登入）落地並在正式環境驗證後，
  使用者透過 AskUserQuestion 明確選定：整個後台（`/pages/admin/`、
  `/pages/admin/theme/`、`/pages/admin/contracts/`）都要登入才能進來，
  不只是單一 write action；順便統一掉現有的 `JONAMINZ_ADMIN_TOKEN`
  獨立密語機制，改用同一套 session 登入。過程中先用 Plan agent 設計
  方案、寫成 plan 檔請使用者核准後才動工。
- **變更**：
  - `worker.js`：新增共用 `requireSession(env, payload)`（複用
    `getCurrentIdentity` 既有的 Supabase 查詢邏輯，`getCurrentIdentity`
    改成直接包一層）。`saveThemeCssRules`／`approveContract`／
    `rejectContract` 三個寫入動作都改成要求 `payload.token` 是有效
    session，不符合回 `UNAUTHORIZED`（200，跟既有 style 一致）。
    `checkAdminToken` 已整個刪除。**`p_actor`（Contract 核准/否決的
    操作人）直接用登入身分決定，不再吃 `payload.actor`**——原本是
    前端按鈕手動切換 Jonathan/Minz 自報身分，沒有真的驗證是誰在按，
    這裡堵掉「可以假裝是另一個人」的漏洞。esbuild 打包＋`node --check`
    ＋eval/new Function grep 驗證語法乾淨。
  - `assets/js/header.js`：`window.JonaminzIdentity` 新增
    `requireLogin()`（沒登入導去 `/pages/login/?next=<原路徑>`，任何
    失敗——包含網路錯誤——都導頁，是「失敗關閉」）與匯出
    `readToken()`。刻意跟既有 `mount()` 的「失敗開放」（網路錯誤時
    顯示登入連結、頁面照常運作，適合單純打招呼的場合）不同：
    `requireLogin()` 是給真正的權限關卡用的，2 人用的後台寧可短暫
    故障時進不去，也不要意外讓沒登入的人看到內容。
  - 三個後台頁（`pages/admin/`、`admin/theme/`、`admin/contracts/`）
    的 `init()` 都改成先過 `requireLogin()` 這關，現有 render/loadRows
    邏輯整個包進 `.then()`。`admin/theme/` 的 `saveRules()` 呼叫
    `saveThemeCssRules` 時 payload 加上 token。
  - `pages/login/assets/js/app.js` 新增 `getNextUrl()`：解析並驗證
    `?next=` 查詢參數（只接受同源相對路徑，拒絕含 `://` 或 `//` 開頭
    的值，避免開放式重導向），內部密語登入成功後導去 `next` 而不是
    固定回首頁；已登入時的「回首頁」連結也用同一個函式。Google OAuth
    這條路這次沒有把 `next` 一起帶回（`worker.js` 的
    `handleGoogleCallback` 固定導回首頁），是已知、刻意先不修的小
    缺口（要處理要把 next 塞進 OAuth 的 `state` 參數，工程量不小，
    跟這次範圍無關）。
  - `pages/admin/contracts/assets/js/app.js`：拿掉 Admin token 輸入框
    跟操作人切換按鈕（連同對應的 `sessionStorage` 常數與事件監聽），
    改成唯讀顯示登入身分（「登入身分：Jonathan」）。`decide()` 改送
    `token` 而非 `adminToken`/`actor`。已裁決列表顯示 `decidedBy` 時
    統一轉換大小寫（`IDENTITY_LABEL[row.decidedBy] || row.decidedBy`）
    ——舊資料是使用者手打的 `"Jonathan"/"Minz"`，新資料是登入身分的
    `"jonathan"/"minz"`，顯示層統一，DB 值本身不用回填。CSS 同步拿掉
    對應的 actor 按鈕樣式。
  - 文件同步：`docs/platform-integration-v1-implementation-plan.md`
    新增「後台整站登入保護」段落，`saveThemeCssRules` 技術債標記解決；
    `backend/README.md` 補完整套登入 action／路由的說明（原本完全沒
    記錄，第 9 項階段 A 時漏補）、拿掉 `JONAMINZ_ADMIN_TOKEN` 設定步驟、
    改寫 approve/reject 的 API 說明；`AI_CONTEXT/PROJECT_STATE.md` 多處
    更新（§2 資料夾說明、§4 已完成功能、§5 Worker secrets/API 表、
    §6 版本狀態），2026-07-11 第 3 項的歷史敘述保留原樣、加一句後續
    更新指引到這裡，不覆寫歷史。
- **本機驗證**（Playwright + `page.route()` mock `/api/action`，
  `node dev-server.js`）：(1) 未登入訪問三個後台頁都正確導去
  `/pages/login/?next=<urlencoded 原路徑>`；(2) mock 已登入後三頁都
  正常載入、不被導頁；(3) Contracts 頁核准動作攔截到的 payload 確認
  帶 `token`、不帶 `adminToken`/`actor`，畫面確認 admin token 輸入框
  與操作人按鈕都已移除、工具列正確顯示登入身分；(4) Theme 頁存檔
  payload 確認帶 `token`；(5) `next` 參數正常流程（登入後導回原本要
  去的後台頁）與開放式重導向防護（`?next=https://evil.example.com`／
  `?next=//evil.example.com` 都被擋下、導回首頁）皆通過。全部截圖
  確認視覺正常（工具列簡化後排版正常、身分正確顯示）。
- **狀態變化**：實作＋本機驗證完成，**尚未部署**（`wrangler deploy`
  待授權）。完成部署後 implementation plan 原本標記的
  `saveThemeCssRules` 技術債正式解決，`JONAMINZ_ADMIN_TOKEN` 機制正式
  淘汰。
- **遺留**：部署後需要使用者到正式環境親自驗證三個後台頁的登入關卡、
  Contract 核准/否決（操作人是否正確帶入登入身分）、Theme 存檔是否
  正常；確認無誤後可自行 `npx wrangler secret delete JONAMINZ_ADMIN_TOKEN`
  清掉已淘汰的 secret（不會自動做）。前台 IA 調整（SKHPS 連結搬去
  前台、Jonathan 頁籤內容頁）這次明確不做，是討論中提過但使用者選擇
  「先不動」的獨立想法，之後如果要做需要另外開一輪。
- **版本**：`v0.9.1-202607121400`（`version.js`）。

---

## 2026-07-12 — 第 9 項階段 A 正式環境端到端驗證通過，implementation-plan.md 原始範圍完成

- **任務**：接續上一筆部署，使用者親自在正式環境測試登入功能。
- **變更**：
  - 使用者自行用 `wrangler secret put` 設定六個新 secret
    （`JONAMINZ_LOGIN_JONATHAN`／`JONAMINZ_LOGIN_MINZ`／
    `JONAMINZ_GOOGLE_CLIENT_ID`／`JONAMINZ_GOOGLE_CLIENT_SECRET`／
    `JONAMINZ_GOOGLE_EMAIL_JONATHAN`／`JONAMINZ_GOOGLE_EMAIL_MINZ`）。
    過程中一次操作失誤把 `JONAMINZ_ADMIN_TOKEN`（既有的合約核准密語）
    也重設了一次（PowerShell 用全形頓號串指令失敗、user 誤貼成
    admin token 的指令），已提醒使用者若值有變要記得用新值登入
    `/pages/admin/contracts/`；後續用 `wrangler secret list` 確認六個
    新 secret 名稱都存在（只看名字不看值）。
  - 使用者去 Google Cloud Console 設定 OAuth 品牌（App 名稱
    `Jonaminz`）、建立 Web application 類型的 OAuth Client、redirect
    URI 設定正確。過程中發現 Google 同意畫面一度顯示原始網域
    `ndmc402010104.workers.dev` 而非設定好的 App 名稱——判斷是 Google
    branding 快取生效延遲（OAuth Client 剛建立就馬上測試），不是設定
    錯誤，等待後應會恢復正常，不影響功能。
  - **使用者親自完整測試兩條登入路，皆正常**：內部密語登入成功、
    Google OAuth 完整走過同意畫面成功登入、兩者登入後身分顯示都正確、
    登出正常清除狀態。
  - 一併新增 `.gitignore` 規則 `*pw*.json`（原本只有 `*pw*.txt`）：
    使用者存 Google OAuth Client Secret 用的檔案是 `.json`，沒被舊規則
    擋到，發現時檔案還沒被 commit，已補規則防堵。
  - 討論中確認 Google OAuth Testing 模式（未發布、未做 Search Console
    網域驗證）對本系統完全足夠：只有白名單內的 Test users（Jonathan/
    Minz 的 Google 帳號）能通過同意畫面，公開發布／網域驗證是給不特定
    公眾使用的服務才需要的機制，2 人固定身分系統不需要；Testing 模式
    下 Google refresh token 7 天過期的限制也不影響本系統，因為系統
    從未使用 Google refresh token（身分改用自己的 `sessions` 表
    30 天 TTL 管理）。
  - 更新 `docs/platform-integration-v1-implementation-plan.md` 第 9 項
    標記完成。
- **狀態變化**：**implementation-plan.md 原始範圍的第 9 項（主站登入）
  正式完成**——至此 implementation-plan.md 列出的 9 個項目全部完成並
  驗證過。討論中額外擴大的階段 B（identity capability）與階段 C
  （skhpsv2 接入）尚未開始，是否/何時進行由使用者決定。
- **遺留**：`saveThemeCssRules` 等既有寫入 action 仍未接上這套新的
  登入驗證（見 `PROJECT_STATE.md` Auth 段落）；階段 B/C 待辦。
- **版本**：無程式碼變更（純測試+文件更新），`version.js` 不動。

---

## 2026-07-12 — 第 9 項階段 A 部署：DB schema 套用 + wrangler deploy

- **任務**：接續上一筆（階段 A 程式碼完成但未部署），取得使用者透過
  AskUserQuestion 的明確授權後執行部署。
- **變更**：
  - 直連 `jonaminz-db`（用根目錄密碼檔＋pg client，跑完立刻刪除含密碼
    的 scratchpad script）套用 `backend/supabase/auth_schema.sql`。
    套用前先查 `information_schema.tables` 確認連的是正確資料庫、
    套用後再查一次確認新增 `sessions`／`oauth_states` 兩張表且沒動到
    既有五張表，並查 `role_table_grants` 確認 `service_role` 權限正確。
  - `cd backend/cloudflare-worker && npx wrangler deploy`，上傳成功
    （Version ID `22eaa5a1-759c-4175-a6c4-38832f82a1c8`）。
  - 正式環境 curl smoke test：`getCurrentIdentity`（無 token）正確回
    `{ok:true, identity:null}`；`loginWithInternalToken`（錯密語）正確
    回 `INVALID_TOKEN`；`GET /auth/google/start` 因 Google secrets 尚未
    設定回 500（**這是預期行為**，不是部署失敗，代表路由本身已經
    正確掛上去了）；既有 `getSdkVersion` 回應不受影響，確認這次部署
    沒有動到既有功能。
- **狀態變化**：DB schema／Worker 部署都已完成。**Auth 功能仍然
  「上線但打不開」**——`loginWithInternalToken` 現在會一律回
  `INVALID_TOKEN`（因為 `JONAMINZ_LOGIN_JONATHAN`／`JONAMINZ_LOGIN_MINZ`
  secret 還沒設定，沒有任何字串比對得中）、Google 登入完全不能用
  （四個 Google secret 都沒設）。這是刻意的：secret 值不該由 Claude
  經手，要使用者自己用 `wrangler secret put` 設定。
- **遺留**：(1) 使用者自行 `wrangler secret put JONAMINZ_LOGIN_JONATHAN`／
  `JONAMINZ_LOGIN_MINZ`，設定完內部密語登入就會真的可用；(2) 使用者
  自行去 Google Cloud Console 建立 OAuth Client（redirect URI
  `https://jonaminz-backend.ndmc402010104.workers.dev/auth/google/callback`），
  設定 `JONAMINZ_GOOGLE_CLIENT_ID`／`JONAMINZ_GOOGLE_CLIENT_SECRET`／
  `JONAMINZ_GOOGLE_EMAIL_JONATHAN`／`JONAMINZ_GOOGLE_EMAIL_MINZ` 四個
  secret；(3) 兩者都設定好後，需要在正式環境重新端到端驗證一次（尤其
  Google OAuth 全流程，本機/mock 測試完全沒覆蓋到真實 Google 那一段）；
  (4) 之後才進階段 B（identity capability）與階段 C（skhpsv2 接入）。
- **版本**：無程式碼變更（純部署操作＋文件更新），`version.js` 不動。

---

## 2026-07-12 — Implementation plan 第 9 項階段 A：jonaminz 主站登入（程式碼完成，尚未部署）

- **任務**：接續第 8 項，做第 9 項（原計畫最後一項）。範圍在討論中被
  使用者明確擴大成三件事：內部密語登入＋Google OAuth 兩條路都要有、
  身分要能單向傳給 skhpsv2（僅供前端顯示問候語）、整件事要做成
  jonaminz 可以選擇要不要開放給外部專案的 capability（不是硬依賴）。
  分三階段，這次做階段 A（jonaminz 自己的登入/登出）。
- **變更**：
  - 新表 `sessions`（token/identity/provider/expires_at）、`oauth_states`
    （CSRF state，短 TTL）：`backend/supabase/auth_schema.sql`，含
    service_role grant（照第 2 項踩過的 Supabase Management API 建表
    坑，這次先補不等出事）。
  - `worker.js`：新增兩個非 `/api/action` 的 GET 路由
    `/auth/google/start`（產生 state、302 去 Google 同意畫面）、
    `/auth/google/callback`（核對 state、換 token、解 ID token 的
    email、比對允許清單、建立 session、302 導回首頁並把 token 帶在
    URL fragment）；新增三個 action：`loginWithInternalToken`（比對
    `JONAMINZ_LOGIN_JONATHAN`／`JONAMINZ_LOGIN_MINZ` 兩個新 secret）、
    `getCurrentIdentity`（查 session 是否有效）、`logout`（刪 session
    row）。esbuild 打包＋`node --check`＋eval/new Function grep 驗證
    語法乾淨，**這批改動尚未 `wrangler deploy`**。
  - `assets/js/backend-client.js` 新增三個對應 wrapper。
  - 新頁 `pages/login/`（`index.html`／`assets/js/app.js`／
    `assets/css/page-login.css`，照 `pages/README.md` 標準流程，已在
    `config.json` 註冊），兩條登入路都在這頁。
  - 新頁 `pages/identity-relay/index.html`：極簡、不走 entry-core.js
    bootstrap，給未來 skhpsv2 之類的專案隱藏嵌入 iframe 用，讀
    localStorage token、查 `getCurrentIdentity`、`postMessage` 給父
    頁面（階段 B/C 才會真的被用到，這次先把頁面本身寫好）。
  - `assets/js/header.js` 大幅擴充：暴露 `window.JonaminzIdentity`
    （`captureTokenFromHash`／`mount`），共用 header 元素存在時顯示
    「OO你好」＋登出按鈕，或「登入」連結。
  - `assets/css/reservoir/04-layout.css` 新增 `.jonaminz-header`
    flex 版面＋身分區塊樣式（共用 shell 層，非頁面專屬）。
- **自己抓到並修好的 bug**：header.js 第一版把「讀 URL hash 存
  session token」的邏輯包在「找不到 `[data-jonaminz-header]` 元素就
  return」的判斷式裡——但首頁（Google OAuth callback 固定導回的目的
  地）是簽名式導覽版型，本來就沒有這個共用元素，會導致 OAuth 登入
  永遠存不進 token。改成 hash 擷取邏輯移到模組最外層無條件執行；
  同時發現首頁的身分顯示原本也會整個消失（同一個原因），所以額外
  改了 `index.html`（`nav-links` 新增 `[data-nav-identity]` 容器）、
  `assets/js/app.js`（呼叫 `JonaminzIdentity.mount()`）、
  `assets/css/page-home.css`（新增 `.nav-identity` 系列樣式，只加
  規則、不動既有 `.nav-links` 規則），讓身分狀態在首頁也看得到。
  這個發現是本機 Playwright 端到端測試（mock `/api/action` 的登入/
  身分查詢回應）跑出來的，不是純程式碼審查抓到的。
- **本機驗證**：內部密語登入成功/失敗、登入後首頁 nav 與各頁共用
  header 正確顯示身分、登出正確清 token、hash-fragment token 擷取
  （模擬 OAuth 導回）正確運作，皆截圖確認視覺正常。Google OAuth 那段
  完全沒測過（需要真實 Google Client Secret，等使用者申請完才能測）。
- **狀態變化**：implementation plan 第 9 項**階段 A 程式碼完成、本機
  驗證通過，尚未部署**（DB schema 未套用、Worker 未 deploy、Google
  OAuth secrets 未設定）。細節見 `AI_CONTEXT/PROJECT_STATE.md` §4。
- **遺留**：部署前需要：(1) 使用者授權直連套用 `auth_schema.sql` 到
  `jonaminz-db`；(2) 使用者授權 `wrangler deploy`；(3) 使用者自行設定
  `JONAMINZ_LOGIN_JONATHAN`／`JONAMINZ_LOGIN_MINZ` 兩個 secret；
  (4) 使用者自行去 Google Cloud Console 申請 OAuth Client（redirect
  URI 見上）並設定四個 Google 相關 secret。部署完才能做正式環境端到端
  驗證（尤其 Google OAuth 全流程本機測不到）。之後才進階段 B（identity
  變成正式 `identity.currentUser@1` capability）與階段 C（skhpsv2
  接入，另一個 repo，需要另外授權）。
- **版本**：`v0.9.0-202607120900`（`version.js`，前端程式碼/HTML/CSS/
  設定檔變更需要 bump；worker.js／SQL 這批還沒部署，不影響此版號）。

---

## 2026-07-12 — Implementation plan 第 8 項：smoke app（純驗證，無程式碼變更）

- **任務**：接續 tokens CSS（第 7 項），做第 8 項——把
  `implementation-plan.md` 的固定情境清單（無合約／合約無效／
  project disabled／Settings timeout／optional capability／Shell
  none/tokens／SDK 重複載入／SDK rollback／未知欄位／舊 schema 配新
  SDK／snippet 逾時降級，共 13 項，來源 ChatGPT Review AR-18）逐條跑過。
- **變更**：
  - **決定不另外養一個專用 smoke app**：第 6、7 項的驗證方式（拿
    jonaminz-movies 這個真實、已登記、已核准的專案當宿主頁面，
    Playwright `page.route()` 只在需要製造邊界情況時竄改 Worker 回應，
    其餘打真實 production Worker）已經就是 smoke test 的做法，另外
    養一個假專案是多餘的維護負擔，換不到好處。這個方向有先跟使用者
    確認過。
  - 13 項情境裡：8 項已經在第 6、7 項驗證過（無合約、正常合約、合約
    無效、Shell tokens 等），本輪只需要新測 5 項：Settings timeout
    （mock `getEffectiveSettings` 斷線 → `degraded`/`NETWORK_ERROR`）、
    SDK 重複載入（同頁面手動再插入一次 loader，確認不拋錯、不弄壞
    `ready` 狀態）、SDK rollback（mock `getSdkVersion` 指回第 6 項的
    舊 Kernel hash，確認舊 release 對現在的資料形狀仍相容）、Worker
    回傳未知欄位（mock 回應夾帶額外欄位，確認正常忽略不崩潰）、
    snippet 載入失敗降級（mock loader 腳本本身載入失敗，確認官方
    snippet 的 `onerror` 正確觸發 degraded）。全部零 JS 錯誤、行為
    符合預期。
  - 3 項情境（optional capability 不存在、Shell none、舊 Contract
    schema 配新 SDK）判定 v1 範圍內**不適用**，不是測試遺漏——背後
    對應的系統（真實 service／Shell／第二個 schema 版本）根本還沒做，
    沒有東西可以測，等對應項目做出來才有意義補測。project disabled
    情境確認等同於已驗證過的 `NOT_APPROVED` 反面路徑，不用重複測。
  - 新增 `docs/platform-integration-v1-acceptance-tests.md` 逐條記錄
    上述 13 項的狀態與測試方式。
- **狀態變化**：implementation plan **第 8 項完成**。下一步是第 9 項
  （Google OAuth 主站登入）——implementation plan 剩下的最後一項，也是
  目前為止規模最大的一塊。
- **遺留**：**發現一個誠實記錄但這次不修的行為**：SDK 重複載入不是
  嚴格意義的 no-op——S22 規定的冪等目前只保證「不覆寫既有
  `__snippetVersion` 物件、不炸房子」，沒有做「偵測到已經初始化過就
  整個跳過」的優化，重複載入會重打一次 `submitContract`／
  `getEffectiveSettings`。正常使用下 snippet 只會被貼一次，這是異常
  情況的容錯而非效能關鍵路徑，判定可以接受；如果之後真的有案例受
  影響，要加一個 init 旗標判斷。
- **版本**：無程式碼變更（`sdk-src/sdk.js` 沒有改，純文件產出，
  RULES.md 規則純文件不 bump）。

---

## 2026-07-12 — Implementation plan 第 7 項：tokens CSS 收編進 SDK

- **任務**：接續 SDK Kernel（第 6 項，能算出「准不准套用 tokens」但
  什麼都沒做），做第 7 項——把 CSS custom properties 真的送到外部專案
  頁面上。對應 S34（CSS 生效等級）、S35（tokens 最小語意）、S36
  （token 命名）。
- **變更**：
  - 現有 `assets/js/theme-runtime.js` 已經做了「讀 Supabase
    `theme_css_rules`、組 CSS、注入 `<style>`」，但走 v0 舊模式：任何
    人貼一行 script 標籤就拿得到外觀，不經 Contract／Integration
    Settings 審核。這次是在 Kernel 裡新增一份**收編後、gated** 的邏輯
    ——`theme-runtime.js` 本身沒動，jonaminz 自己網站繼續用原本機制
    （v0 尚未作廢，RULES.md §4 三條件未全部成立）。
  - **範圍收窄**：重讀 `docs/external-project-manifest.md` 與 S35 後
    確認只有 `:root` 那些列是「跨專案共用介面」，其他 selector（例如
    `.card`）是 jonaminz 自己共用元件的微調，外部專案沒有同名 class
    對它們來說沒有意義——Kernel 只挑 `:root` 列轉成 CSS 變數，其餘不送。
  - `sdk/sdk-src/sdk.js` 新增 `jzTokenName()`（S36 機械式轉換：
    `--color-primary` → `--jz-primary`，拿掉舊前綴、換 `--jz-`，其餘
    語意名稱不變，不引入新的命名意見）與 `applyTokens()`（呼叫既有
    `getThemeCssRules`——不改 Worker、不改 Supabase——只處理 `:root`
    列，每個變數同時輸出舊名與新名，值相同，S36 別名過渡規定）。
    `effectiveCss === "tokens"` 時呼叫，**不 await、不擋 `ready`
    settle**——S23 沒有把 CSS 套用列進 ready 必要條件，tokens 純視覺、
    best-effort，套用失敗只 `console.warn`，不影響核心 lifecycle
    （跟 `theme-runtime.js` 一樣的容錯哲學，S24）。
- **驗證**：
  1. 直連 Supabase 核對 `theme_css_rules` 目前實際只有一筆資料
     （`:root { --color-primary: #6366f1 }`），確認這次是照現有機制的
     真實行為收編，不是憑空造了一套沒人在用的假資料在測。
  2. 用 Playwright mock `getEffectiveSettings`（回 `approved:true,
     css:"tokens"`）與 `getThemeCssRules`（回兩筆 `:root` 規則＋一筆
     `.card` selector 規則），其餘打真實 production Worker：確認注入的
     `<style id="jonaminz-sdk-tokens">` 同時含舊名與 `--jz-*` 新名、
     `.card` 規則正確被排除、`window.Jonaminz.ready` 正確 resolve
     `status:"ready"`。
  3. 驗證 `effectiveCss` 不是 `"tokens"`（mock 成 `"none"`）時完全不會
     呼叫 `getThemeCssRules`——gated 路徑真的擋住，不是永遠套用。
  4. 驗證 `getThemeCssRules` mock 成 500 時：`ready` 仍正確 resolve、
     沒有插入 `<style>` 標籤、`console.warn` 有印但零 JS 錯誤。
  5. `node sdk/generate-sdk-release.mjs` 產生新 hash
     （`c0d679686951`），`sdk-versions.json` 兩個 channel 都指過去、
     `wrangler deploy`，curl 確認 `getSdkVersion` 正確回傳新 hash。
- **狀態變化**：implementation plan **第 7 項完成並已上線**。下一步是
  第 8 項（smoke app 完整生命週期測試）。
- **遺留**：`theme-runtime.js` 本身沒有收編／作廢，繼續作為 jonaminz
  自己網站的獨立機制存在。沒有真實外部專案端到端測過「tokens 正向
  成功」（jonaminz-movies 的 Contract 沒宣告 `css`、Settings 授予也是
  `"none"`，維持第 4 項的保守選擇，等真的有專案要用 tokens 才一併
  做）。沒有補建完整 24 個 token 的 baseline 交付系統（現有機制本來就
  只送「已客製的 delta」，這次是照原樣收編，不是新功能）。
- **版本**：`v0.8.0-202607120206`（已 bump；SDK Kernel、
  `sdk-versions.json` 皆屬程式碼變更）。

---

## 2026-07-12 — Implementation plan 第 6 項：SDK Kernel

- **任務**：接續 SDK Loader（第 5 項，只蓋了運送機制），做第 6 項——把
  被載入的 placeholder 換成真正的 Kernel：讀合約、推送給平台、查
  Effective Settings、正確 settle S21 官方 snippet 的 `ready` Promise。
  對應 S18-23（contract discovery、snippet 協定）、S26（lifecycle）、
  S27-29（錯誤模型）。
- **變更**：
  - **範圍再收窄一次（照規格推論，不是漏做）**：v1 沒有任何已正式發布
    的 service，S32「未授權的工具存在但婉拒」只適用於已發布的
    service——現在一個都沒有，所以 `window.Jonaminz.*` 這次不掛任何
    service 命名空間；`JonaminzError` 形狀（S27）只在 `SDK_INIT_FAILED`
    這唯一的 reject 情況用到，沒有生一個沒有呼叫端的 constructor。
  - **重讀 S21 原文凍結的 snippet 程式碼後發現第 5 項沒處理到的銜接點**：
    `data-contract` 屬性寫在載入 `jonaminz-entry.js` 的那個 `<script>`
    標籤上（S18），但 Contract Discovery 邏輯屬於 Kernel，Kernel 是
    loader 動態插入的「另一個」`<script>` 標籤，自己的
    `document.currentScript` 讀不到原始標籤的屬性。小幅修改已上線的
    `sdk/jonaminz-entry.js`：同步階段先讀出 `data-contract`，動態插入
    Kernel `<script>` 時轉貼 `dataset.contract`／`dataset.release`
    （Kernel 自己的 hash，Kernel 讀不到自己檔名）／`dataset.stale`
    （這次版本指標是不是從 localStorage 快取來的，只有 loader 知道，
    給 Kernel 填 `diagnostics.staleCache`）。
  - `sdk/sdk-src/sdk.js` 整份改寫：(1) 判斷 `window.Jonaminz.__snippetVersion`
    標記決定要不要初始化（S22：沒標記＝命名空間被占用或沒走官方
    snippet，靜默退場）；(2) contract discovery（S18-20）：
    `data-contract` 或預設 `/jonaminz.contract.json`，`new URL(path,
    location.origin)` 解析後核對 origin，跨源直接視為 discovery 失敗
    （S19，拒絕絕對 URL 覆寫同源限制）；(3) F5/S8 最小必填客戶端粗篩；
    (4) 呼叫 `submitContract` 推送——**推送失敗用 `.catch()` 吞掉、不
    中斷後續流程**（S13/S16：推送 ≠ 採信，即使這次推送失敗，只要之前
    approved 過，整合仍應正常運作）；(5) 呼叫 `getEffectiveSettings`
    決定 `ready`/`degraded`（S23/S31）；(6) `report()` 依 `__bootstrap`
    是否還在決定呼叫 `.settle()` 或就地更新 `status`/`reason`/
    `diagnostics`（S21：Kernel 姍姍來遲、bootstrap 已被 15 秒逾時
    settle 過的情況，不重播 Promise）。
  - **自己動手後的一個小改進**：`getEffectiveSettings` 回傳 `ok:false`
    時，第一版寫死回傳泛用的 `SETTINGS_UNAVAILABLE`，測試時發現 Worker
    其實有給更精確的 `code`（例如 `PROJECT_NOT_REGISTERED`）——改成優先
    用 Worker 給的實際 code，`SETTINGS_UNAVAILABLE` 只留給 Worker 真的
    打不通的情況，diagnostics 因此有意義得多。
- **驗證**：
  1. 對 **jonaminz-movies 真實已上線頁面**
     （`https://ndmc402010104.github.io/jonaminz-movies/`，有真實
     Contract、已 registered、已 approved）注入完整 S21 官方 snippet，
     loader 網址指本機 `http://localhost:5500/sdk/jonaminz-entry.js`；
     直接對真實 HTTPS 頁面測試時撞到 Chromium 的 Private Network
     Access 限制（公開網站不能對 loopback 位址發請求，被 CORS 擋下）
     ——改用本機頁面（同源 localhost）＋Playwright `page.route()` 只
     mock `getSdkVersion` 這一個 action 指向新 Kernel，`submitContract`／
     `getEffectiveSettings` 照樣打**真實production Worker**：
     `await window.Jonaminz.ready` 正確 resolve `status:"ready"`、
     `diagnostics.release` 吻合新 hash（證明轉貼機制真的通了）、
     `settingsRevision` 是真實數字、`rejectedCapabilities` 空陣列。
  2. 三條降級路徑（合約 404、合約有效但 projectId 未登記、合約缺必填
     欄位）皆用同一套本機＋mock 手法測過，`status` 正確變 `degraded`、
     `reason` 精確對應（`CONTRACT_NOT_FOUND`／`PROJECT_NOT_REGISTERED`／
     `CONTRACT_INVALID`），全程零 JS 錯誤（S24 底線）。
  3. `node sdk/generate-sdk-release.mjs` 產生新 hash（`0c9953079f7a`），
     `sdk-versions.json` 的 `stable`/`next` 都指過去、`wrangler deploy`，
     curl 確認 `getSdkVersion` 正確回傳新 hash。
- **狀態變化**：implementation plan **第 6 項完成並已上線**。下一步是
  第 7 項（tokens CSS 收編進 SDK）。
- **遺留**：`sdk/` 資料夾（含這次改的 `jonaminz-entry.js` 與新的
  Kernel）本次跟這篇 CHANGELOG 一起 push，push 之後才會是
  `https://jonaminz.com/sdk/jonaminz-entry.js` 這個常青網址真正在跑
  新 Kernel（Worker 端 `getSdkVersion` 已經上線）。`window.Jonaminz.*`
  真實 service、CSS tokens 套用、smoke app、Google OAuth 都還沒做，是
  第 7-9 項的事。
- **版本**：`v0.7.0-202607120134`（已 bump；SDK Kernel、loader 轉貼
  邏輯、`sdk-versions.json` 皆屬程式碼變更）。

---

## 2026-07-11 — Implementation plan 第 5 項：SDK Loader ＋ 版本指標

- **任務**：接續 Effective Settings 端點（第 4 項），做第 5 項——把「怎麼
  把 SDK 送到外部專案頁面上」這條運送機制蓋好，對應 S37（常青
  loader＋immutable release＋版本指標＋kill-switch＋金絲雀）與 S39
  （Contract schema／SDK 回滾相容 checklist）。
- **變更**：
  - 範圍刻意跟第 6 項（SDK Kernel）切開：implementation plan 把
    「loader＋版本指標」跟「官方 snippet 對接、lifecycle 狀態機、錯誤
    模型、contract discovery」（S18-23、S26-29）分成兩項不是巧合——
    S37 說 loader 該是「極小、幾乎永不改動」的東西，這次只證明「pointer
    →immutable 檔案→執行」這條運送鏈是通的，不做 `window.Jonaminz.*`
    骨架或 Promise/ready 語意。
  - 新增 `sdk/generate-sdk-release.mjs`（跟
    `generate-contract-validator.mjs` 同精神的 build-time 腳本）：讀
    `sdk/sdk-src/sdk.js`、算 sha256 前 12 碼、寫出 immutable 的
    `sdk/sdk-<hash>.js`，不自動改版本指標——發不發版是人的決定。這次
    `sdk-src/sdk.js` 放極簡 placeholder（`window.Jonaminz.status=
    "degraded"`），真正的 SDK 邏輯是第 6 項的事。另準備
    `sdk/sdk-empty.js`（真的什麼都不做，kill-switch 目標）。
  - 新增 `backend/cloudflare-worker/sdk-versions.json`（git 檔案，跟
    `integration-settings.json` 同模式）：`stable`/`next` channel 各自
    指向哪個 hash/url。`worker.js` 新增 `getSdkVersion` action（公開
    唯讀）：`payload.projectId` 選填，v1 的 loader 呼叫時不帶（一律拿
    stable），端點本身先支援有給時查 `integration-settings.json`
    （新增選填 `channel` 欄位）決定金絲雀，形狀先定、v1 沒有專案會設
    非 stable 的 channel。
  - 新增 `sdk/jonaminz-entry.js` 常青 loader：讀 localStorage 短 TTL
    快取（5 分鐘）→ 沒有才打 `getSdkVersion`（5 秒逾時）→ 動態插入
    `<script>` 載入拿到的 immutable 檔案；抓不到指標時退回
    last-known-good（不論多舊），兩者都沒有就靜默退場；全程 `try/catch`
    （S24 不燒房子）。
  - **自己寫完後測試時抓到一個真的 bug**：第一版把載入 SDK 檔案的網址
    誤用 `window.location.origin`（宿主頁面的 origin）——但
    `sdk-<hash>.js` 是放在 jonaminz.com，不是外部專案自己的網域，本機
    測試網址（`localhost:5500`）跟正式站不一樣時會直接拿錯網址。改用
    `document.currentScript.src` 反推 loader 自己是從哪個網域載入的，
    在同步執行階段先存成常數（`document.currentScript` 在非同步 fetch
    callback 裡不可靠，要先存起來）。
  - 新增 `docs/sdk-release-checklist.md`（S39 回滾相容 checklist，純
    流程文件）：發布新 Contract schema 前，要先確認「如果現在要回滾，
    回滾目標支不支援這個新 schema」，兩階段發布順序寫成可照做的步驟。
- **驗證**：
  1. headless browser 測試（真實載入 `http://localhost:5500/sdk/
     jonaminz-entry.js`，不是用 `page.setContent()` 的 about:blank
     頁面——那個環境下 localStorage/fetch 行為跟真實頁面不一樣，第一次
     測試因此得到誤導性的空結果，改用真實 `goto()` 頁面才測出正確
     行為）：確認 `getSdkVersion` 被呼叫、`sdk-<hash>.js` 被正確載入
     並執行、`window.Jonaminz.status === "degraded"`、console 印出
     placeholder 訊息、零 JS 錯誤。
  2. **在正式環境實際操作 kill-switch 並復原**：把 `stable` channel
     指到 `sdk/sdk-empty.js`、`wrangler deploy`，headless browser 確認
     `sdk-empty.js` 真的被請求並執行（200，不是請求失敗導致的假陽性）、
     `window.Jonaminz` 是 `undefined`；改回原本的 placeholder hash、
     `wrangler deploy`，確認恢復 `status:"degraded"`。這兩次部署都各自
     另外用 AskUserQuestion 取得授權（跟原本「開發完部署一次」的授權
     內容不同，classifier 正確擋下要求重新確認）。
  3. `npx esbuild worker.js --bundle` 與 `node --check` 確認 `worker.js`
     與 `sdk/jonaminz-entry.js` 語法正確、無 eval。
- **狀態變化**：implementation plan **第 5 項完成並已上線**。下一步是
  第 6 項（SDK Kernel：官方 snippet 對接、lifecycle 狀態機、錯誤模型、
  contract discovery）。
- **遺留**：`sdk/` 資料夾本次只在本機 `dev-server.js` 驗證過，git push
  後才會是 `https://jonaminz.com/sdk/jonaminz-entry.js` 這個常青網址
  真正上線（Worker 端 `getSdkVersion` 已經上線，只有靜態檔案還沒推）。
  金絲雀（`next` channel）目前沒有真實專案在用，純粹機制就位。S39
  checklist 沒有自動化檢查，純靠人工遵守（規格允許的簡化）。
- **版本**：`v0.6.0-202607112352`（已 bump；Worker action、新 git
  設定檔、新靜態檔案皆屬程式碼變更）。

---

## 2026-07-11 — Implementation plan 第 4 項：Flattened Effective Settings 端點

- **任務**：接續核准後台（第 3 項），做第 4 項——approve 完的 Contract
  現在還是「資料庫裡的旗標翻成 approved」，沒有下游因此改變行為；這次
  蓋一個端點讓「approved 狀態」真的能被查詢、算出「這個外部專案現在被
  允許做什麼」，對應 S31（Effective capability 公式）、S38（flattened
  Effective Settings 供應方式）。
- **變更**：
  - 範圍刻意收窄：`docs/platform-integration-consensus.md` 把「Integration
    Settings 內容 schema」列在保留層（形狀已定、內容留白），v1 SDK
    （第 5、6 項，還沒寫）規劃是 `window.Jonaminz.*` 全部 service 一律
    婉拒（F7/S32），現在唯一有真實內容可算的授權維度只有 CSS（S34：
    `Effective CSS = min(Contract 聲明, Settings 授予)`）。這次只把
    CSS 這個維度做完整，`capabilities` 固定回空陣列佔位——第 6 項有
    真實 service 時只是往這個既有形狀加內容，不需要改 response 結構。
  - `integration-settings.json` 新增每個 environment 選填的 `css` 欄位
    （只認 `"none"`/`"tokens"`，省略視為 `"none"`）＋檔案層級 `revision`
    整數（S38 要求回應帶版本資訊，這份檔案是 git 檔案沒有資料庫版號
    可用，改一次手動 +1）。
  - `worker.js` 新增 `getEffectiveSettings` action（公開唯讀，跟
    `getThemeCssRules`／`listPendingContracts` 同慣例）。environment
    不從 payload 讀，一律用 Worker 自己的 `JONAMINZ_ENVIRONMENT`（跟
    `submitContract` 同樣理由：避免呼叫端謊報 environment 繞過檢查）。
    計算順序：projectId 未登記 → `PROJECT_NOT_REGISTERED`；查
    `contract_active_snapshots` join `contract_snapshots` 找 active
    approved snapshot，沒有 → `approved:false, css:"none",
    reason:"NO_APPROVED_SNAPSHOT"`（S31 明文降級：沒 approved snapshot
    不啟用任何能力）；有的話 → `css = min(該 snapshot 的 raw_contract.css,
    Settings 授予的 css)`，未知值一律視同沒宣告（S11 must-ignore）。
  - `assets/js/backend-client.js` 新增 `getEffectiveSettings(payload)`
    具名 wrapper。這次不需要新前端頁面——沒有 UI 要顯示這個，純粹是
    給未來 SDK 呼叫的端點。
- **驗證**：
  1. `min` 計算的純函式邏輯先寫 node 腳本窮舉 16 種組合（4 種已知值 ×
     4 種已知值，含 `undefined`／未知值如 `"components"`）全部通過才
     接進 `worker.js`。
  2. `npx esbuild worker.js --bundle` 確認語法正確、無 eval（沿用第 2、
     3 項已建立的驗證方式）。
  3. `wrangler deploy` 後 curl 驗證三條路徑：未登記 projectId →
     `PROJECT_NOT_REGISTERED`；缺 `projectId` → `PROJECT_ID_REQUIRED`；
     `jonaminz-movies`（已 approved，但 Contract 沒宣告 `css`）→ 正確回
     `{approved:true, css:"none", settingsVersion:1, revision:2,
     capabilities:[]}`。部署後第一次呼叫收到 `Unknown action`，等了
     幾秒重試就正常了——Cloudflare 全球節點的部署傳播延遲，不是真的
     bug，之後遇到類似狀況先重試再懷疑程式碼。
- **狀態變化**：implementation plan **第 4 項完成並已上線**。下一步是
  第 5 項（SDK loader＋版本指標）。
- **遺留**：「tokens 正向成功」路徑（Contract 宣告 tokens 且 Settings
  也授予）目前沒有真實資料可測——jonaminz-movies 沒宣告 `css`，純函式
  窮舉測試已覆蓋邏輯本身，等真的有專案要用 tokens 時再一併做真實端到端
  驗證，不補假資料。`capabilities` 真實內容、SDK 本身、`getThemeCssRules`
  收編進 SDK（第 7 項）都還沒做，是後續項目的事，不是這次遺漏。
- **版本**：`v0.5.0-202607112206`（已 bump；Worker action、schema 欄位
  皆屬程式碼變更）。

---

## 2026-07-11 — Implementation plan 第 3 項：核准後台完成並上線，修正改判設計缺陷

- **任務**：接續 Contract 收取（第 2 項），做 implementation plan 第 3 項——
  讓 pending Contract 能被人工核准/否決，`/pages/admin/contracts/` 後台，
  用 Worker secret `JONAMINZ_ADMIN_TOKEN` 當臨時保護（整站還沒有登入系統）。
- **變更**：
  - `backend/supabase/contract_schema.sql` 新增 `approve_contract_snapshot`／
    `reject_contract_snapshot` 兩個 `security definer` Postgres function，
    透過 Supabase RPC 一次呼叫完成「改狀態＋切換 active 指標＋寫 audit
    log」的原子操作。`worker.js` 新增 `listPendingContracts`／
    `approveContract`／`rejectContract` 三個 action；`backend-client.js`
    新增對應 wrapper；新頁面 `pages/admin/contracts/`（pending 清單、diff
    檢視、核准/否決按鈕）；`config.json` 登記新頁面；`pages/admin/` 首頁
    加連結卡片；`backend/README.md`／`pages/README.md` 同步更新。
  - 直連 `jonaminz-db` 套用 SQL function（第一版：approve/reject 都限定
    只能從 `pending` 狀態發動）；`wrangler deploy` 上線；本機 `dev-server.js`
    + headless browser 驗證頁面結構，過程中發現並修好一個真的 CSS 漏樣式
    （新頁面複製了 Theme 頁的 `.jonaminz-theme-*` class 命名，但那份 CSS
    是 Theme 頁專屬的 Page Layer，沒被這頁載入，工具列/區塊完全沒框線——
    補上基礎樣式到 `page-admin-contracts.css`）；curl 驗證錯 token 正確被
    擋（`UNAUTHORIZED`，DB 無變化）。
  - **使用者實際操作時發現一個真的設計缺陷**：否決一筆 Contract 後永遠
    卡死，無法改判回核准（第一版 SQL function 寫死「只能從 pending 發動」）。
    使用者質疑「否決應該像 pending 一樣可以再被改判，不是終態」——重讀
    frozen 規格 S13 原文「核准/否決只改狀態與 active 指標，**永不覆寫
    歷史**」，確認「歷史」指 audit log 不可竄改，不是 status 定了不能再變，
    第一版是我自己多加的限制，規格沒有要求。改寫兩個 function：不論目前
    狀態都能核准/否決，可自由在 approved/rejected 間改判；否決時如果那筆
    正好是目前生效版本才撤回 `contract_active_snapshots` 指標（沒有版本
    歷史堆疊可自動退回上一版，安全預設是「暫時沒有生效版本」，要人工
    重新核准）；每次改判在 audit log 多插入一筆，不覆寫舊紀錄。取得使用者
    明確同意後重新套用到 jonaminz-db。前端 `rowActionsHtml` 同步改成
    已核准顯示「撤回核准」、已否決顯示「改為核准」，pending 兩個都顯示。
  - **使用者實際操作時發現的 UX 問題也一併修**：admin token／操作人輸入框
    在畫面重畫時（按重新整理、核准/否決完自動刷新）會被 sessionStorage
    舊值蓋掉，逼人重打——改成 token 用 `input` 事件即時存檔；操作人從
    自由輸入改成 Jonathan/Minz 兩個切換按鈕；欄位順序改成操作人在前、
    token 在後（貼近帳號密碼慣例）；否決備註原本有存但畫面看不到，補上
    顯示；已裁決列表摺疊列預設只顯示裁決時間/操作人/備註，技術性的
    snapshot id／hash 移到展開區才顯示，減少視覺雜訊。
  - **驗證**：使用者用 jonaminz-movies 真實 pending（snapshot #3）實際
    跑過 submit→reject→approve→撤回核准→再核准 全流程，直連 DB 確認
    `contract_snapshots.status='approved'`、`contract_active_snapshots`
    正確指向該 snapshot、`contract_audit_log` 累積 5 筆且無覆寫，跟預期
    完全一致。
- **狀態變化**：implementation plan **第 3 項（核准後台）完成並已上線**。
  下一步是第 4 項（Effective Settings endpoint）。
- **遺留**：`docs/contract-schema/README.md` 的「進 Worker 前 release
  checklist」（`$id` 正式發布）仍是唯一未收尾項目，不擋任何後續工作。
  完整 rate limit（KV binding）依然正式留白，見 backend/README.md。
- **版本**：`v0.4.3-202607111911`（已 bump；SQL function、Worker action、
  前端頁面、schema 皆屬程式碼/schema 變更）。

---

## 2026-07-11 — jonaminz-movies 正向成功路徑驗證完成，修好 GRANT 權限漏洞

- **任務**：接續上一筆記錄，使用者授權 `wrangler deploy` 把
  `jonaminz-movies` 的 Integration Settings 登記上線，接著實際跑一次
  `submitContract` 驗證正向成功路徑。
- **變更**：
  - `wrangler deploy` 成功，線上 Worker 認得 `jonaminz-movies` 這個
    projectId。
  - 帶正確 `Origin: https://ndmc402010104.github.io` header 呼叫
    `submitContract`，**第一次回應是 HTTP 200 但 `ok:false`**：
    `Supabase read failed: HTTP 403 ... permission denied for table
    contract_snapshots`。查證後發現：三張 `contract_*` 表是這次
    implementation plan 第 2 項透過 Supabase Management API 的
    `database/query` 端點建立的（不是儀表板 SQL Editor），`service_role`
    沒有像既有 `external_app_registrations`／`theme_css_rules` 那樣自動
    拿到表格層級的 SELECT/INSERT/UPDATE/DELETE 權限——RLS 開了沒錯，但
    Postgres 的 GRANT 是分開一層，兩者都要過才能讀寫。使用者另外授權
    （範圍明確限定在這三張表、不動 RLS、不碰 skhps-db）後直連補上
    `GRANT SELECT, INSERT, UPDATE, DELETE ON ... TO service_role`，並回寫
    進 `backend/supabase/contract_schema.sql`（新增一段註解說明踩坑經過，
    避免以後用同樣管道重建表格再漏）。
  - 補完權限後重打 `submitContract`，回應
    `{"ok":true,"snapshotId":3,"status":"pending",...,"validationResult":
    {"valid":true,...}}`，canonical hash 跟本機（node 直接跑
    `contract-validation.js`）算出來的完全一致。直連 DB 確認
    `contract_snapshots` 真的多一筆（`status='pending'`、
    `submitted_origin` 正確記成呼叫時帶的 Origin header）、
    `contract_audit_log` 正確關聯到那筆 snapshot（`action='submit'`,
    `previous_hash=null`, `actor=null`）。
- **狀態變化**：**implementation plan 第 2 項的正向成功路徑第一次被真實
  資料完整驗證過**，先前 review 抓到的缺口正式關閉。附帶修好一個
  DB 權限設定漏洞。
- **遺留**：`docs/contract-schema/README.md` 的「進 Worker 前 release
  checklist」（`$id` 正式發布）依然是唯一還沒收尾的項目，不擋任何後續
  工作。下一步是 implementation plan 第 3 項（核准後台）。
- **版本**：`v0.4.1-202607111602`（已 bump；`contract_schema.sql` 補
  GRANT 語句，屬 DB schema 變更）。

## 2026-07-11 — 登記第一個真實外部專案 jonaminz-movies

- **任務**：使用者提供 ChatGPT Work 產出的 jonaminz-movies MVP source
  snapshot（電影討論／想看清單／訂票 demo，給 Jonathan/Minz 用），提議當
  Platform Integration 的第一個真實外部專案，直接補上先前 review 抓到的
  缺口：submitContract 正向成功路徑從未被真正測過。用 Plan Mode 列出步驟
  （拆鷹架/建 repo/部署/寫 Contract/登記/驗證）經使用者確認後執行。
- **變更**（`jonaminz-movies` 是新的獨立 repo，不是 jonaminz 本身；這裡只
  記跟 jonaminz 有關的部分，完整過程見該 repo 自己的 commit 紀錄）：
  - jonaminz-movies 原始匯出依賴 OpenAI 自家 `vinext`／site-creator 鷹架
    （Next.js on Cloudflare Workers、D1、`.openai/hosting.json` 設定），
    匯出時刻意排除部署身分導致那份設定檔缺失、建置直接壞掉。使用者裁決
    拆掉鷹架：UI（`app/page.tsx`、`app/globals.css`，純 client-side
    React，沒有 server component/next-image，Tailwind v4 無外部圖片
    參照）逐字移植成單純 Vite + React 19 + Tailwind v4 SPA，部署到
    GitHub Pages（`gh repo create` 公開 repo，GitHub Actions 建置部署，
    `vite.config.ts` 設 `base: "/jonaminz-movies/"` 對應 project site
    子路徑）。上線網址：`https://ndmc402010104.github.io/jonaminz-movies/`
    （已用 curl 確認回 200、`<title>` 正確）。
  - jonaminz-movies 根目錄新增 `jonaminz.contract.json`：只填 S8 必填
    （`contractVersion`/`app.projectId`/`app.title`）+ 一個
    path-absolute entry（`/jonaminz-movies/`），不宣告用不到的
    capabilities/objects/css/shell。用 `ajv-cli` 對 schema 驗證合法，
    另外直接呼叫 jonaminz Worker 實際在用的
    `contract-validation.js`（`validateCrossFields`/`validateUrls`/
    `computeCanonicalHash`）確認 cross-field 與 URL 同源解析都正確
    （解析出的完整 URL 跟已確認上線的網址完全吻合）。
  - jonaminz 這邊：`backend/cloudflare-worker/integration-settings.json`
    新增 `jonaminz-movies` 的 `prod` origin 登記
    （`https://ndmc402010104.github.io`——只到 host，不含路徑，路徑差異
    由 Contract 的 path-absolute URL 表達，這是 origin 定義本身決定的）。
    用 `npx esbuild --bundle` 直接打包（不透過 wrangler）確認新登記正確
    被包進 Worker、沒有語法錯誤。
- **狀態變化**：`integration-settings.json` 從空的變成有第一筆真實登記，
  但**這筆變更尚未 `wrangler deploy`**——線上 Worker 還不認得
  `jonaminz-movies` 這個 projectId。submitContract 正向成功路徑的實際
  驗證（呼叫線上 endpoint、直連 DB 確認 pending snapshot／audit log）
  排在部署授權之後，見下一筆 CHANGELOG 記錄。
- **遺留**：`wrangler deploy` 待授權；部署後才能真正驗證正向路徑。
- **版本**：`v0.4.0-202607111553`（已 bump；新增第一個外部專案登記，
  視為功能性里程碑，走 minor bump）。

## 2026-07-11 — pre-parse body size 限制部署上線

- **任務**：使用者授權部署上一筆 commit（`293f929`）新增的 pre-parse
  `Content-Length` 限制。
- **變更**：`wrangler deploy` 成功（bundle 104.23 KiB / gzip 11.83 KiB）。
- **驗證**：線上三項 smoke test 全過——`getThemeCssRules` 正常回傳資料；
  `submitContract` 對未登記 projectId 仍正確回 `PROJECT_NOT_REGISTERED`；
  送一個 300,000 bytes 的 request body 確認收到 HTTP 413（新限制生效）。
- **狀態變化**：repo 版本與線上部署版本重新同步，`PROJECT_STATE.md`§6
  的「尚未部署」註記已移除。
- **遺留**：無新遺留。
- **版本**：`v0.3.2-202607111415`（不變，這筆是部署動作，不是程式碼變更）。

## 2026-07-11 — 外部 review 核對、文件過期修正、pre-parse body size 限制

- **任務**：使用者拿另一個 AI（ChatGPT，透過 GitHub 純讀取）對 jonaminz
  Platform Integration 進度的盤點回來核對，指定這輪「只核對＋規劃，不改
  程式碼/DB/Schema/Frozen Spec，不 deploy」。核對完回報後，使用者依報告
  裁決了幾項，這次任務把裁決落地。
- **核對結果**（完整推理見對話紀錄，這裡只記結論）：ChatGPT 的技術盤點
  （已完成 7 項、未完成 8 項、body size/rate limit 缺口）全部正確；建議
  順序第 9 項「SKHPSv2 接入」不是 repo 既有計畫的一部分（`implementation-
  plan.md` 第 9 項明文是 Google OAuth），是使用者昨天口頭跟 ChatGPT 提過
  的另一個意圖，經使用者確認屬實但裁決不急。
- **變更**：
  - `AI_CONTEXT/ARCHITECTURE.md`：§2 架構圖補三張新表；新增「Contract
    收取（Platform Integration，推模式）」小節在 §4；§5 補
    `integration-settings.json`／`JONAMINZ_ENVIRONMENT`；§6 部署流補兩條
    陷阱（改 schema 要重跑預編譯腳本；Workers 禁 eval/new Function，
    dry-run 測不出來，要用 esbuild 打包驗證）；§7 從「規劃中、零實作」
    改成只列真正還沒做的部分（核准後台／Effective Settings／SDK／tokens
    CSS／smoke app／OAuth），移除已完成的 Contract Schema／Worker 收取。
    **這是本次核對抓到落差最大的檔案**——整個 Worker 實作與部署期間都
    沒碰過。
  - `docs/contract-schema/README.md`：標題與「下一步」段落從「即將開工」
    改成「已完成並部署」的時態；補一句正向成功路徑尚未經真正 Worker
    endpoint 驗證、留到第一個真實外部專案登記時一併測。
  - `docs/platform-integration-v1-implementation-plan.md`：第 1、2 項加
    ✅ 完成標記；第 2 項下补記 body size／rate limit 的正式裁決；底部
    補 SKHPSv2 是真實但不急的意圖，避免下次規劃時漏掉或誤植入優先序。
  - `backend/cloudflare-worker/worker.js`：新增 `MAX_REQUEST_BODY_BYTES`
    （256KB）與 pre-parse 檢查——`request.json()` 之前先看
    `Content-Length` header，超過直接回 413，不無條件把整個 body 讀進
    記憶體才發現太大。跟既有的 post-parse `MAX_CONTRACT_SIZE_CHARS`
    是兩層獨立防線（Content-Length 缺席/造假時第一層擋不住，第二層還在）。
    **完整 rate limit 正式裁決留白**，理由寫進 `backend/README.md`。
  - `backend/README.md`：同步記錄兩層 size 限制與 rate limit 的正式裁決。
- **驗證**：這輪明確禁止 `wrangler deploy`（含 `--dry-run`，Claude Code
  的 auto mode 分類器把兩者都當成同一個受限動作擋下），改用
  `npx esbuild worker.js --bundle --platform=neutral --format=esm` 直接
  打包（不透過 wrangler），grep 產物確認零 `new Function`/`eval(`、
  `node --check` 確認語法合法。**這次的 pre-parse body size 檢查邏輯
  沒有部署到線上**，只是 commit 進 repo——下一次 `wrangler deploy` 時才會
  生效，部署前需要另外跟使用者確認（RULES.md §2-2）。
- **狀態變化**：交接文件與實際部署狀態重新同步。implementation plan
  第 2 項的兩個安全留白（body size、rate limit）從「單方面記在 README」
  變成「使用者正式裁決」。SKHPSv2 接入意圖正式記錄但排在低優先序。
- **遺留**：`worker.js` 的新 pre-parse 檢查待部署；submitContract 正向
  成功路徑待第一個真實外部專案登記時一併驗證；approve/reject 寫入端點
  上線前的臨時防護方式（討論中提出「比照直連 DB 的每次明確授權模式，或
  加陽春 shared-secret，等 OAuth 落地再換正式驗證」的建議）尚待使用者
  在真的要動工核准後台時裁決，這次沒有定案。
- **版本**：`v0.3.2-202607111415`（已 bump；程式碼有變更但**未部署**，
  見上方驗證段落）。

## 2026-07-10 — submitContract 部署修正：ajv standalone 預編譯，正式上線

- **任務**：使用者授權 `wrangler deploy`。第一次部署直接失敗：
  `Code generation from strings disallowed for this context`——Cloudflare
  Workers 的 V8 isolate 禁止 `new Function`/`eval`，而 `ajv.compile()`
  預設在 runtime 就是用這個機制把 schema 編成驗證函式。前一輪的
  `wrangler deploy --dry-run` 沒抓到，因為 dry-run 只測 esbuild bundle
  過不過，不會真的在 V8 isolate 裡執行模組頂層程式碼。
- **變更**：新增 `backend/cloudflare-worker/generate-contract-validator.mjs`
  （build-time 腳本，用 ajv 的 standalone code 機制把
  `docs/contract-schema/jonaminz.contract.schema.json` 預編成純 JS）與其
  產出 `contract-schema-validator.generated.js`；`worker.js` 改成 import
  這份預編譯產出，移除 runtime `ajv.compile()` 呼叫。`backend/README.md`
  新增「Contract Schema 改了要重新產生 validator」一節，明講改 schema 後
  部署前要重跑 `node generate-contract-validator.mjs`，否則 Worker 用的是
  舊規則。
- **驗證**：這次不只信賴 `wrangler --dry-run`——用 `npx esbuild` 把產出檔案
  實際打包成 CJS（跟 wrangler 內部用同一顆 bundler），grep 打包後的產物
  確認零 `new Function`/`eval`，再用 Node 對打包產物跑功能測試（合法合約
  valid、禁用欄位/非法 projectId/反斜線 URL 皆 invalid）確認邏輯沒有在
  轉換過程中跑掉。修好後 `wrangler deploy` 成功（bundle 從 309KB 降到
  104KB，因為不用再帶整個 ajv 編譯器），對線上 Worker 做了三項 smoke
  test：舊 action（`getThemeCssRules`）正常回傳真實資料、新 action
  （`submitContract`）對未登記的 projectId 正確回
  `{ok:false, code:"PROJECT_NOT_REGISTERED"}`、直查 `contract_snapshots`
  確認這次測試呼叫沒有寫入任何資料列（設計上該檢查發生在任何 DB 操作
  之前）。
- **狀態變化**：**implementation plan 第 2 項（Worker 端合約收取）正式
  上線**，`https://jonaminz-backend.ndmc402010104.workers.dev` 現在跑的
  就是含 `submitContract` 的版本。
- **遺留**：無新遺留，前一筆紀錄列的遺留項目（`integration-settings.json`
  待填真實專案、KV rate limit、`$id` release checklist）依然有效。
  **給下一棒的重要提醒**：以後改 `jonaminz.contract.schema.json` 之後，
  部署 Worker 前一定要先跑 `node generate-contract-validator.mjs` 重新
  產生 `contract-schema-validator.generated.js`，不然 Worker 用的還是
  舊 schema——這個依賴關係容易忘記，因為兩個檔案在 git diff 上看起來
  無關。
- **版本**：`v0.3.1-202607110300`（已 bump）。

## 2026-07-10 — Implementation plan 第 2 項：Worker 端合約收取（submitContract）

- **任務**：使用者授權開工的 implementation plan 第 2 項，範圍：Integration
  Settings 的 environment origin 資料模型、Contract snapshot 三態生命週期、
  audit table、schema/cross-field/URL 驗證、一切寫入先進 pending。用 Plan
  Mode 先列出檔案層級計畫、經使用者確認兩項技術選擇（ajv 讀 schema.json、
  wrangler `[vars]` 決定 Worker 自己的 environment）後才動手。
- **變更**：
  - 新增 `backend/cloudflare-worker/integration-settings.json`：Contract
    收取用的 Integration Settings（S38：v1 為 git 檔案＋Worker 供應），
    `projects` 目前為空（尚無真實外部專案登記）。
  - 新增 `backend/cloudflare-worker/contract-validation.js`：純函式模組
    （`computeCanonicalHash`／`validateCrossFields`／`validateUrls`），
    實作 JSON Schema 本身做不到的 S12 cross-field 檢查（entryId/objectType
    重複、requests/requires ⊆ supports、requires.entryId 參照）與 S15 URL
    同源檢查（`new URL()` 解析、反斜線防禦、origin 精確比對、禁帳密）。
    用 node 直接跑了 23 項正反例（含「絕對 URL 但 origin 對不上目前
    environment」這個使用者特別點名的情境），全部通過。
  - 新增 `backend/cloudflare-worker/package.json`（`ajv` 依賴，`"type":
    "module"`），`npm install` 確認可用。
  - `backend/cloudflare-worker/worker.js`：頂部 import ajv（`ajv/dist/2020.js`，
    `strict: false`）、`docs/contract-schema/jonaminz.contract.schema.json`
    （跨目錄相對 import，已用 `wrangler deploy --dry-run` 驗證 esbuild 能
    正確 bundle，不需要 import attribute 語法）、`integration-settings.json`、
    `contract-validation.js`；新增 `submitContract` action：驗必填 →
    `env.JONAMINZ_ENVIRONMENT` 查 Integration Settings（projectId 未登記／
    該 environment 未登記 origin 都拒絕）→ payload size 上限 →
    請求 Origin header 對登記 origin 的交叉驗證 → ajv 驗 schema →
    cross-field／URL 驗證 → canonical hash 去重 → insert `contract_snapshots`
    （`status='pending'`）＋ `contract_audit_log`（`action='submit'`）。
    `payload.environment` 只做跟 `env.JONAMINZ_ENVIRONMENT` 的健檢比對，
    不是權威來源——避免任何人靠 payload 宣告 environment 來繞過同源檢查。
  - `backend/cloudflare-worker/wrangler.toml` 新增 `[vars]
    JONAMINZ_ENVIRONMENT = "prod"`（對應現有唯一部署；未來開 dev 環境時
    加 `[env.dev]`，指向同一個 Supabase 專案即可，不需要第二套基礎設施）。
  - 新增 `backend/supabase/contract_schema.sql`（`contract_snapshots` /
    `contract_active_snapshots` / `contract_audit_log` 三張表，皆開 RLS
    無 public policy）。**已直連 `jonaminz-db` 套用並 smoke test**（合法列
    插入成功、非法 `status` 值被 check constraint 擋下、測試列已清除）——
    使用者明確授權用根目錄密碼檔的 Supabase Management API token 直接執行；
    過程中發現這把 token 同時能碰同一組織下的 `skhps-db`，套用前先用唯讀
    查詢核對 project ref／表名，確認打在 `jonaminz-db` 上才動手（細節見
    PROJECT_STATE.md §7）。
  - `backend/README.md`：新增 `submitContract` 說明、`contract_schema.sql`
    建表步驟、`npm install` 步驟、Integration Settings 登記範例、
    Environment 由 `JONAMINZ_ENVIRONMENT` 決定（非 payload 宣告）的說明、
    rate limit 已知留白的說明。
  - `AI_CONTEXT/PROJECT_STATE.md`：§2 補新增檔案、§4 Platform Integration
    段落改寫為精簡的現況摘要（詳細沿革移交 CHANGELOG，不再兩處重複累積）、
    §5 補 `jonaminz-db` project ref 與五張表、`submitContract` action、
    §7 UNKNOWN 項改為 VERIFIED 並記錄 Management API token 跨專案的風險。
- **驗證**：`contract-validation.js` 23 項 node 正反例全過；
  `npx wrangler deploy --dry-run --outdir=./dist-check` bundle 成功
  （309KB / gzip 61KB，`JONAMINZ_ENVIRONMENT: "prod"` 正確顯示在 bindings
  裡），確認 JSON import 路徑與 ajv 依賴在真正的 wrangler/esbuild 打包
  流程下沒問題，不是只在 Node 環境下測試過；DB 三張表用 Management API
  直接建表＋smoke test（見上）。**尚未 `wrangler deploy` 到線上**——這一步
  RULES.md §2-2 需要另外授權，本次未做，程式碼與 DB schema 已就緒待部署。
- **狀態變化**：implementation plan 第 1 項（Contract Schema）→ 完成 RC3.1；
  第 2 項（Worker 端合約收取，限「收取＋pending」範圍）→ **程式碼與 DB
  schema 完成，待部署**。第 3 項（核准後台）**未開始**。
- **遺留**：`wrangler deploy` 授權待確認；`integration-settings.json`
  目前是空的，要接第一個真實外部專案時才會有內容；KV rate limit 是刻意
  留白（見 backend/README.md）；`docs/contract-schema/README.md` 的
  「進 Worker 前 release checklist」（`$id` 正式發布）仍待辦，不擋這次
  Worker 開工但擋第一份真實合約 approve 前。
- **版本**：`v0.3.0-202607110246`（本次動到程式碼與 DB schema，已 bump）。

## 2026-07-10 — Contract JSON Schema RC3.1：Environment Resolution 模型，授權開工 Worker

- **任務**：使用者對 RC3 範例合約提出最後一個問題（`entries[0].url` 寫死
  prod 網域，容易誤導成 Contract 攜帶部署位址），裁決改成 path-absolute
  並補上 environment 解析規則；同時裁決 implementation plan 第 2 項
  （Worker 端合約收取）可以開工，並給了明確範圍。
- **變更**：`jonaminz.contract.example.json` 的 `entries[0].url` 從
  `https://example-project.jonaminz.com/` 改成 `"/"`。
  `docs/contract-schema/README.md` 新增「Environment Resolution」一節：
  Contract 不宣告 prod/dev/local；path-absolute URL 由接收 ingestion 的
  Worker 依它查到的 Integration Settings（每個 projectId 每個
  environment 各自登記一個 origin）解析，公式＝該 environment 的
  registered origin ＋ Contract 裡的 path-absolute 字串；絕對
  `https://` URL 仍合法，但其 origin 必須精確等於**目前這個
  environment** 登記的 origin，不得用其他 environment（如 prod）的
  登記值滿足這次（如 dev）的同源檢查，避免跨 environment 來源混淆。
  `platform-integration-v1-implementation-plan.md` 第 2 項補上
  「Integration Settings 的 environment-scoped registered origin
  資料模型」作為明確子項，並在既有 URL 驗證清單裡把 `registeredOrigin`
  改註明「取自目前 environment」；同時在第 2 項開頭重申 S13/S16：
  所有寫入一律先進 pending，不得因提交 Contract 自動 approve 或 grant。
  用 `npx ajv-cli` 重新驗證範例（改用 `"/"` 後仍 valid）。
- **狀態變化**：Contract Schema RC3 → **RC3.1，設計面全部定案**（含
  environment 解析模型，此模型屬規格第三部分演進層允許的 additive
  Settings 欄位，不牴觸 Frozen S1-S39）。**implementation plan 第 2 項
  （Worker 端合約收取）使用者已明確授權開工**——這是本次交接最重要的
  狀態變化，下一棒接手時直接讀 implementation-plan.md 第 2 項開始，
  不需要再等額外確認；仍要遵守 RULES.md §2-2：`wrangler deploy`
  本身仍需開工當下另外確認（開工授權不等於部署授權）。
- **遺留**：無。
- **版本**：無程式碼變更（未 bump；純 `docs/` 修訂）。

## 2026-07-10 — Contract JSON Schema 第二輪 review 修正 → RC3，設計面定案

- **任務**：使用者再拿 RC2 給外部 review，帶回 1 個真正的安全漏洞＋
  3 個開放設計決策的裁決意見，逐條核實後修正、落成 RC3。
- **變更**：`jonaminz.contract.schema.json`：`contractUrl` 的 pattern 從
  `^(https://\S+|/(?!/)\S*)$` 改成
  `^(https://[^\s\\]+|/(?![/\\])[^\s\\]*)$`——用 Node 的 `new URL()`
  實測確認 WHATWG URL parser 對 https 這類 special scheme 會把 `\`
  正規化成 `/`，導致 `/\evil.example/a` 這種「看起來是 path-absolute」
  的字串實際解析成 `https://evil.example/a`（跟 RC2 修過的 `//` protocol-
  relative 繞過是同一類問題的變形，RC2 沒堵住）；新 pattern 全面禁止
  反斜線出現在字串任何位置。`capabilities.requires` 加上
  `uniqueItems: true`（只能擋完全相同的物件重複，語意重複仍留給
  Worker）。用 7 組新反例（4 種反斜線變體皆 invalid、2 種既有合法形式
  仍 valid、requires 完全重複 invalid）驗證修正正確。`README.md`：
  補充反斜線繞過的說明與教訓（「regex 對 URL 只能語法粗篩，真正邊界要
  在 Worker 用標準 URL parser 重算」）；`entries`/`objects` 陣列形狀、
  `css` 單一字串兩點設計決策改列「已確認」；`$id` 是否/何時正式發布
  改列進新增的「進 Worker 前的 release checklist」小節。
  `platform-integration-v1-implementation-plan.md` 第 2 項補上完整的
  Worker 端 URL 驗證清單（反斜線直接拒絕、WHATWG URL parser、https-only、
  origin 精確比對、禁帳密、redirect 逐跳重驗、正規化後存值+原始值
  audit）與 cross-field 檢查清單（entryId/objectType 重複處理、
  requests/requires ⊆ supports、requires.entryId 參照一致性），避免
  這輪 review 的具體建議在交接時流失。
- **狀態變化**：Contract Schema 草稿 → RC2 → **RC3，設計面視為定案**。
  implementation plan 第 1 項完成度：schema 本體已無已知漏洞，僅剩
  `$id` 正式發布時機一個待辦（不擋 Worker 開工）。第 2 項（Worker 端
  合約收取）**仍未開始**，但工作清單已比 RC2 時更具體。
- **遺留**：無新遺留；既有的「schema 做不到的 cross-field 檢查」已從
  README 的敘述性提醒，落實成 implementation-plan.md 裡可執行的清單。
- **版本**：無程式碼變更（未 bump；純 `docs/` 修訂）。

## 2026-07-10 — Contract JSON Schema 一輪外部 review 修正 → RC2

- **任務**：使用者拿草稿給外部 review，帶回 4 點問題，逐條核實後修正。
- **變更**：`jonaminz.contract.schema.json`：①`css` 從 `enum: ["none","tokens"]`
  改成語法層 pattern（`^[a-z][a-z-]{0,49}$`）——閉合 enum 會讓未來出現
  `components` 時整份合約直接 invalid，違反 S11「未知 enum 值視為不支援，
  不得整份判失敗」；②`contractUrl` pattern 從 `^(https://|/)\S*$` 改成
  `^(https://\S+|/(?!/)\S*)$`——原本 `//evil.example.com/a` 這種
  protocol-relative URL 會被誤判合法，實際上瀏覽器會解析成任意網域的
  https:，是真的安全漏洞；同時刻意仍不開放無開頭斜線的相對路徑（如
  `assets/icon.png`），因為那與 `javascript:`/`data:` 等 scheme:opaque URL
  在字串層難以可靠區分；③新增 `$defs/forbiddenFieldsGuard` 並套用到
  `app`／`objects[]` 項目／`capabilities`／`capabilities.requires[]`
  項目——原本只有頂層和 `entry` 有 S9 禁用欄位守衛，`app.permissions`
  這類寫法會靜默通過 schema；④capability 文法改純 kebab-case，拿掉
  camelCase（`sharedCache` 這類保留名字本身是「發布前可改名」，現在改
  是免費的）。同時修正 `forbiddenFieldsGuard` 的 `anyOf` 分支補上
  `type: object`，消除 ajv strict-mode 警告。`jonaminz.contract.example.json`
  修正 `supports` 未涵蓋 `requests`/`requires` 用到的能力這個自相矛盾
  （這個不變式本身留給 Worker 端 cross-field 檢查，schema 做不到）。
  `README.md` 大幅補充「URL 驗證」「css 欄位」「capability 文法」「禁用欄位
  守衛」四節說明修正理由，並補上一張正反例驗證結果表。用
  `npx ajv-cli validate --spec=draft2020` 跑過範例＋7 組正反例（protocol-relative
  URL、巢狀禁用欄位×2、css 保留值、camelCase/kebab-case capability、
  無斜線相對路徑）全數符合預期。
- **狀態變化**：草稿 → RC2（1 輪外部 review 已吸收）。開放設計決策從
  6 點收斂為 5 點（其中 2 點仍是已確認定案，3 點暫定未挑戰）。
- **遺留**：`requests`/`requires[].capability` ⊆ `supports` 的 cross-field
  不變式、`entryId` 參照一致性，都明確記在 README／schema description 裡
  留給 Worker ingestion（implementation plan 第 2 項），非本次遺漏。
- **版本**：無程式碼變更（未 bump；純 `docs/` 修訂）。

## 2026-07-10 — Contract JSON Schema 兩點設計決策定案

- **任務**：使用者針對草稿 README 列出的 6 點開放設計決策中的 2 點
  （最具結構影響力的兩點）做出裁決。
- **變更**：`jonaminz.contract.schema.json` 的 `capabilityRequirement`
  改為 `entryId` 必填（原草稿是可選，代表「省略＝綁定整個合約」）；
  裁決結果：v1 不支援合約層級 requires，每筆 requires 都必須明確指到
  一個 entry，避免「省略到底是指整個 App 還是忘記填」的模糊狀態，未來
  真的需要時再加明確的 scope 欄位。`README.md` 的「not 反面表列是否過嚴」
  一點裁決維持現狀（出現 enabled/permissions/token 等禁用欄位＝整份
  合約 invalid，不只是忽略該欄位）。README 兩點決策改標「已確認」，
  範例＋新反例（requires 缺 entryId）重跑 `npx ajv-cli` 確認行為正確。
- **狀態變化**：6 點開放設計決策中 2 點定案，4 點仍待挑戰（見
  PROJECT_STATE.md §4）。
- **遺留**：剩 4 點（entries/objects 陣列形狀、css 欄位形狀、`$id`
  placeholder、capability 正則允許 camelCase）風險較低、暫定可用；
  下一棒若要動 implementation plan 第 2 項（Worker 端合約收取），開工前
  最後確認一次這 4 點是否也要處理，或直接視為定案。
- **版本**：無程式碼變更（未 bump；純 `docs/` 修訂）。

## 2026-07-10 — Contract JSON Schema 草稿（implementation plan 第 1 項）

- **任務**：使用者指示開始做 Contract JSON Schema，依
  `docs/platform-integration-v1-implementation-plan.md` 排定的第 1 項。
- **變更**：新增 `docs/contract-schema/`：`jonaminz.contract.schema.json`
  （JSON Schema draft 2020-12，逐條對應 S1-S39）、
  `jonaminz.contract.example.json`（範本，欄位命名沿用 v0
  `jonaminz-app.json` 習慣）、`README.md`（逐欄位對應規格條文＋6 點
  規格未明文釘死、由本次判斷的設計決策，標記待使用者確認）。用
  `npx ajv-cli validate --spec=draft2020` 跑過範例（valid）與三個反例
  （缺 `enabled` 等禁用欄位／非法 `projectId`／非法 capability 文法，
  皆 invalid）確認 schema 本身邏輯正確。純文件/schema 草稿，未動任何
  程式碼/HTML/CSS/JS/設定檔，也未讓任何現行系統消費這份 schema。
- **狀態變化**：PROJECT_STATE.md §4「尚未完成的功能」更新：implementation
  plan 第 1 項從「尚未開始」→「已產出草稿，待確認」。第 2 項（Worker
  端合約收取）**未開始**，等第 1 項確認後才進行。
- **遺留**：README 列的 6 點設計決策（entries/objects 陣列形狀、
  `capabilities.requires` 綁定方式、`css` 欄位形狀、防呆 `not` 清單是否
  過嚴、`$id` 為未架設的 placeholder、capability 正則允許 camelCase）
  需使用者確認或修正；schema 本身只做結構驗證，S12 fail-soft／S15 同源
  ／跨欄位 entryId 一致性檢查明確留給 implementation plan 第 2 項的
  Worker ingestion validator，不是這份 schema 檔案的職責（已在 README
  註明範圍）。
- **版本**：無程式碼變更（未 bump；純 `docs/` 草稿，依 RULES.md §2-1
  不 bump `version.js`）。

## 2026-07-10 — Specification v1.0 正式 Frozen

- **任務**：RC2 通過驗收，做兩項一致性最小修訂後標 Frozen。
- **變更**：①`status`／`diagnostics` 職責分離——`Jonaminz.status` 是生命
  週期狀態字串，詳細診斷面統一為 `Jonaminz.diagnostics`（S26）；
  ②snippet 加永久身分標記 `__snippetVersion: 1`（settle 後保留，
  `__bootstrap` 內部 reference 仍刪除），S22 明定 SDK 以此標記辨識官方
  snippet 物件、無標記才視為命名空間被佔用。
  `platform-integration-spec-v1.md` 狀態改為 **Frozen**；RULES.md 新增
  第 12 條禁令（S1–S39 條文不可修改）。
- **狀態變化**：Platform Integration 規格定稿流程**全部完成**。
  下一階段＝JSON Schema → Contract 範本 → SDK（依 implementation-plan），
  **本次未開始任何實作**（遵使用者指示）。
- **遺留**：無。
- **版本**：無程式碼變更（未 bump）。

## 2026-07-10 — RC 驗收 review 修正 → Spec v1.0 RC2

- **任務**：使用者轉交一份驗收階段 review（判定「RC 合格、Frozen 暫緩」，
  七項架構級＋數項文字級修正），全數採納修入規格。
- **變更**：`platform-integration-spec-v1.md` 升為 **RC2**——S21 snippet
  全面重寫（reject/onerror/15s timeout/settle 清理/jz===window.Jonaminz）、
  S13 snapshot 三態＋active 指標、S14 canonical hash＋audit 欄位、S15 擴及
  全部 URL 欄位、S31 明定 Approved Contract、S32 限定已發布 service、
  S5 resolver 移保留層、新增 S39 回滾相容規則、retryable 改字、S7 用語
  統一。新增 `platform-integration-v1-implementation-plan.md`（工作清單
  自規格拆出）；驗收 review 歸檔於
  `platform-integration-reviews/acceptance-review-spec-v1-rc.md`（含處置表）。
- **狀態變化**：Spec 狀態 RC → **RC2，待使用者最終驗收後標 Frozen**。
- **遺留**：驗收通過後標 Frozen ＋ 把「S 條文不可修改」寫進 RULES.md，
  才進 JSON Schema／SDK。
- **版本**：無程式碼變更（未 bump）。

## 2026-07-10 — 五份 Review 收齊、彙整定案、產出 Spec v1.0 RC

- **任務**：收集 5 份 Architecture Review（Codex/ChatGPT/Gemini/Claude Fable
  ［含 F2 立場修正］/Perplexity）→ 彙整 → 使用者裁決 → 撰寫 Specification v1.0 RC。
- **變更**：新增 `docs/platform-integration-reviews/`（五份一份一檔）、
  `docs/platform-integration-review-consolidation.md`（共識定案＋裁決紀錄）、
  `docs/platform-integration-spec-v1.md`（**Spec v1.0 RC，凍結條文 S1–S38**）。
- **狀態變化**：四項裁決已定——D1 Ready 介面＝inline Promise stub（await
  Jonaminz.ready 為唯一保證路徑，不做 command queue）；D2 跨源身份＝v1 外部
  專案一律匿名；D3＝11 個 Service 名與 components/full/self 降為 reserved；
  D4 合約核准＝observed/approved 兩態＋手動核准。共識定案含：錯誤模型
  reject（4:1）、loader＋版本指標（5:0）、推送≠採信、物件定址凍結、
  交集公式在 Worker 算、CSS token `--jz-` 前綴等，見彙整報告第壹部分。
- **遺留**：Spec v1.0 RC **待使用者驗收後才標 Frozen**；驗收後下一步＝
  JSON Schema＋Contract 範本＋SDK 骨架。既有 theme-runtime 變數改名
  `--jz-*`（S36）屬未來實作項。
- **版本**：無程式碼變更（未 bump）。

## 2026-07-10 — 發布 Platform Integration RFC，固定規格定稿流程

- **任務**：把 Review Request 定稿為正式 RFC，固定「先收齊意見再定稿」的流程。
- **變更**：新增 `docs/platform-integration-review-request.md`（RFC，已凍結）。
  內容＝使用者草稿＋四項補完：①尺度與限制節（兩位使用者、first-party only、
  靜態託管無 build、一人維護——要求審查者以此校準，不照搬大平台做法）；
  ②新增挑戰問題 9-12（錯誤模型二選一、SDK ready 介面、常青 SDK kill-switch、
  推模式 Origin 威脅模型）；③回覆格式要求（嚴重度標註＋對應問題編號）；
  ④檔頭狀態標記與 Review 收檔位置。
- **狀態變化**：Platform Integration 流程固定為
  Draft Spec → RFC → 收集 3~5 份 Review → 彙整 → Spec v1.0（Frozen）→
  Schema → SDK。**收 Review 期間不改規格**。目前＝RFC 已發布、等待 Review。
- **遺留**：`docs/platform-integration-reviews/` 資料夾等第一份 Review 進來時
  建立，一份一檔。彙整由使用者發起，不要收到一份就動規格。
- **版本**：無程式碼變更（未 bump）。

## 2026-07-10 — 建立 AI_CONTEXT 記憶水庫（含使用者審查修正後定案）

- **任務**：建立 AI 專案記憶水庫，讓任何 agent 不依賴聊天記憶即可接手；
  使用者審查後修正並定案數項規則。
- **變更**：新增 `AI_CONTEXT/` 七份文件：PROJECT_STATE.md（現況盤點）、
  RULES.md（禁止/允許事項）、ARCHITECTURE.md（分層/資料流/設定流/部署流）、
  TASK_TEMPLATE.md（任務單模板）、ACCEPTANCE.md（通用驗收清單）、
  CHANGELOG.md（本檔）、AGENT_BOOT_PROMPT.md（新 agent 啟動 prompt）。
  另新增三個等價的工具入口檔：`CLAUDE.md`（Claude Code）、`AGENTS.md`
  （Codex 等 CLI agent）、`.github/copilot-instructions.md`（VS Code 聊天
  agent）——內容只指向 `AI_CONTEXT/`，單一事實來源在 `AI_CONTEXT/` 內。
  純文件任務，未動任何程式碼/HTML/CSS/JS/設定檔/DB schema。
- **狀態變化**：無功能變化。文件化既有狀態之外，使用者審查定案了以下規則
  （已寫入 RULES.md / ACCEPTANCE.md）：
  1. 版本 bump 規則：純 `AI_CONTEXT/`、`docs/`、README 類文件修改**不 bump**
     `version.js`；程式碼/HTML/CSS/JS/設定檔/DB schema/部署行為變更才 bump。
  2. 新增檔案僅限任務單白名單明確允許的路徑，不得成為繞過白名單的手段。
  3. `wrangler deploy` 須任務單明確授權，否則部署前先問。
  4. `saveThemeCssRules` 在 Auth 落地前僅限任務單明確要求時才能呼叫寫入。
  5. `docs/external-project-manifest.md`（v0 機制）不因 Platform 規格定稿
     而作廢；須「新 SDK 實作完成＋遷移完成＋使用者明確宣布 deprecated」
     三條件全成立才作廢。
  另實測確認（VERIFIED 2026-07-10）：apex `https://jonaminz.com` 301 轉址至
  `https://www.jonaminz.com/`；SDK canonical host 待 Platform 規格定稿時凍結，
  暫定保留 `https://jonaminz.com/sdk/...`，apex 轉址視為平台基礎設施合約。
- **遺留**：PROJECT_STATE.md §7 剩 2 個 UNKNOWN（Supabase 專案位置、兩張表
  實際資料內容）。RULES.md §4 已無待確認項。
- **版本**：無程式碼變更（未 bump，符合本次定案的版本規則）。
