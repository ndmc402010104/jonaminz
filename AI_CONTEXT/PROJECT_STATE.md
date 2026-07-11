# PROJECT_STATE — jonaminz 專案現況

最後更新：2026-07-12（第 9 項階段 A 進行中）
維護規則：任何 agent 完成會改變「已完成/未完成」狀態的任務後，必須更新本檔並在
`CHANGELOG.md` 追加一筆。標記慣例：`UNKNOWN`＝掃描不到、`INFERRED`＝由程式碼推論、
`NEEDS_CONFIRMATION`＝需使用者確認。

---

## 1. 專案定位

jonaminz 是 Jonathan 與 Minz 兩人共用的長期「數位家」（Digital Home）平台。
它**不是** dashboard / CMS / portfolio，而是連接所有未來模組（旅行、相簿、臨床相片、
書籤、聊天……）的平台本體。架構精神沿用 SKHPS 專案的「水庫理論」，但 jonaminz
完全獨立自足，不依賴 SKHPS 任何 runtime 檔案——**它自己就是自己的水庫本體**。

正在進行中的大方向：把 jonaminz 升級為「Platform」，外部專案透過一個 script 標籤
＋一份 `jonaminz.contract.json` 接入（圖書館模型，見
`docs/platform-integration-consensus.md`）。此規格**已有共識、尚未定稿、尚未實作**。

## 2. 資料夾與檔案用途

```
jonaminz/
  index.html                  首頁（簽名式導覽版型），最小入口：只直接載
                              jonaminz-loading.css + entry-core.js，其餘全由 entry-core 疊加
  version.js                  window.JONAMINZ_APP_VERSION（業務版本，顯示在 footer）
  config.json                 站台設定 + 頁面登錄表（pages: home / admin / admin-theme）
                              + backend.worker.baseUrl
  registry.json               外部專案登錄表（externalProjects 目前是空陣列）
  CNAME                       www.jonaminz.com（GitHub Pages 自訂網域）
  dev-server.js               本機預覽伺服器（node dev-server.js → http://localhost:5500/）
                              固定以 jonaminz 自己為網站根目錄
  suprabase db pw.txt         Supabase Postgres 密碼（敏感！已被 .gitignore 的 *pw*.txt
                              規則排除，永不 commit；使用前要先問過使用者）
  assets/
    css/jonaminz-loading.css  唯一「早期 CSS」，只做 loading 遮罩
    css/reservoir/01~06       CSS 疊加第 1-6 層（reset/tokens/base/layout/components/variants）
    css/page-home.css         第 7 層（Page Layer），只有首頁載
    img/home-hero.jpg         首頁背景相片
    js/entry-core.js          水庫本體：loading gate、CSS 八層疊加、shell、載入頁面 app.js
    js/header.js / footer.js  共用 shell（footer 顯示版本）。header.js 額外暴露
                              window.JonaminzIdentity（{captureTokenFromHash, mount}）
                              ——implementation plan 第 9 項：讀 localStorage session
                              token、查 getCurrentIdentity、顯示「OO你好」＋登出，或
                              「登入」連結。首頁 index.html 是簽名式導覽版型沒有共用
                              [data-jonaminz-header] 元素，所以 assets/js/app.js 自己
                              呼叫 mount() 插進 nav-links 的 [data-nav-identity]
    js/registry-loader.js     讀 registry.json、抓外部專案 manifest 顯示卡片（目前拉模式）
    js/backend-client.js      呼叫 Cloudflare Worker 的統一入口
    js/theme-runtime.js       CSS 第 8 層：從 Worker 讀 theme_css_rules 動態組 CSS 注入；
                              獨立可攜，外部專案可單獨引用；有 localStorage 快取 + 8s 逾時降級
    js/app.js                 首頁業務入口
  pages/
    README.md                 新增頁面的標準流程（重要：新頁面照這份做）
    admin/                    後台首頁（佔位 + Theme 頁連結 + Contract 核准連結）
    admin/theme/              Theme 編輯頁：讀寫 Supabase CSS 規則，存檔全站立即換外觀
    admin/contracts/          Contract 核准後台（implementation plan 第 3 項）：pending
                              清單、diff 檢視、核准／否決／改判，唯一有身分驗證保護的
                              寫入動作（Worker secret JONAMINZ_ADMIN_TOKEN 臨時關卡）
    login/                    登入頁（implementation plan 第 9 項階段 A）：內部密語
                              表單＋Google 登入連結，兩條路都能選。**程式碼已寫完、
                              本機 Playwright 驗證過完整流程，尚未部署／尚未套用 DB
                              schema，見 §4 第 9 項**
    identity-relay/           跨子網域身分轉發頁（implementation plan 第 9 項階段
                              A，給 skhpsv2 之類的其他 *.jonaminz.com 專案未來用）：
                              極簡、不走 entry-core.js bootstrap，讀自己
                              （www.jonaminz.com）的 localStorage token、查
                              getCurrentIdentity、postMessage 給嵌入它的父頁面
  sdk/
    jonaminz-entry.js          常青 SDK loader（implementation plan 第 5 項，S37）：
                              向 getSdkVersion 問版本指標 → 動態載入對應的
                              sdk-<hash>.js，並把 data-contract／是否來自快取／
                              自己的 release hash 轉貼給 Kernel（第 6 項新增，
                              S18 銜接缺口，見 §4）。極簡、try/catch 全包
    sdk-src/sdk.js             SDK Kernel 真實邏輯（implementation plan 第 6、
                              7 項）：contract discovery、推送合約、查
                              Effective Settings、settle S21 官方 snippet 的
                              ready Promise、effectiveCss==="tokens" 時套用
                              CSS custom properties（收編 theme-runtime.js，
                              舊名＋--jz-* 新名並存）。v1 不掛任何
                              window.Jonaminz.* service 命名空間（見 §4）
    generate-sdk-release.mjs   build-time 腳本：讀 sdk-src/sdk.js、算 sha256 前 12 碼、
                              產生 immutable 的 sdk-<hash>.js（不自動改 sdk-versions.json，
                              要不要發版是人的決定）
    sdk-<hash>.js               上面腳本的產出，immutable，內容一改檔名就要換
    sdk-empty.js                kill-switch 目標，內容真的什麼都不做
  backend/
    README.md                 後端部署說明
    cloudflare-worker/worker.js   唯一後端入口 POST /api/action，10 個 action（見 §5）
    cloudflare-worker/wrangler.toml   含 [vars] JONAMINZ_ENVIRONMENT（見 §4 Platform Integration）
    cloudflare-worker/package.json    ajv 依賴（Contract JSON Schema 驗證用）
    cloudflare-worker/integration-settings.json  Integration Settings（git 檔案，
                                      S38）：projectId→environment→registered origin
                                      ＋選填 css 授予值（getEffectiveSettings 用，
                                      省略視為 none）＋選填 channel 值（getSdkVersion
                                      用，省略視為 stable）＋檔案層級 revision 整數
    cloudflare-worker/sdk-versions.json  SDK 版本指標（git 檔案，S37）：
                                      stable/next channel → 各自指向哪個 hash/url，
                                      回滾／kill-switch＝改這份檔案再 wrangler deploy
    cloudflare-worker/contract-validation.js  Contract 收取的純函式驗證模組
                                      （canonical hash / cross-field / URL 同源），
                                      可獨立用 node 測試，不需部署 Worker
    cloudflare-worker/generate-contract-validator.mjs  build-time 腳本：把
                                      Contract JSON Schema 編成 ajv standalone
                                      validator（Workers 禁止 runtime new
                                      Function/eval，改了 schema 要重跑這支）
    cloudflare-worker/contract-schema-validator.generated.js  上面腳本的產出，
                                      worker.js 直接 import，不在 Worker 裡
                                      呼叫 ajv.compile()
    supabase/schema.sql       external_app_registrations 表
    supabase/theme_schema.sql theme_css_rules 表
    supabase/auth_schema.sql  sessions／oauth_states 兩張表（implementation plan
                              第 9 項階段 A）：已寫好、esbuild 驗證過，**尚未套用到
                              正式 jonaminz-db**（見 §4 第 9 項，等待授權）
    supabase/contract_schema.sql  contract_snapshots / contract_active_snapshots /
                                  contract_audit_log 三張表 + approve_contract_snapshot /
                                  reject_contract_snapshot 兩個 Postgres function
                                  （原子改狀態＋切換 active 指標＋寫 audit log，已套用到
                                  jonaminz-db；核准/否決不是終態，可互相改判，見 §4）
  docs/
    external-project-manifest.md          v0 外部專案接入方式（現行有效；作廢需三條件，見 RULES §4）
    platform-integration-spec-review.md   Platform 規格 v1 的架構審查
    platform-integration-consensus.md     共識版理解（凍結層 F1-F12）
    platform-integration-review-request.md RFC（已凍結）：發給所有審查 Agent 的同一份
                                          Review Request，含 12 個挑戰問題；收到的
                                          Review 一份一檔放 docs/platform-integration-reviews/
    platform-integration-v1-implementation-plan.md  Spec Frozen 後的工作清單（非規格）
    sdk-release-checklist.md              S39 回滾相容 checklist（實作計畫第 5 項產出，
                                          純流程文件，發版/回滾/kill-switch 操作步驟）
    platform-integration-v1-acceptance-tests.md  第 8 項產出：smoke test
                                          情境清單逐條驗收紀錄（純驗證，非規格）
    contract-schema/                      實作計畫第 1 項產出：Contract JSON Schema 草稿
                                          （RC，未定案，見該資料夾 README 的 6 點待確認設計決策）
  AI_CONTEXT/                 本資料夾：AI agent 交接文件
```

## 3. 已完成的功能

- 首頁（簽名式導覽版型）＋ loading gate（css/shell/main 三段）。
- CSS 八層疊加架構全部運作中（reservoir 六層 + Page Layer + Theme 動態層）。
- Theme 系統端到端可用：後台 `/pages/admin/theme/` 編輯 → Worker →
  Supabase `theme_css_rules` → `theme-runtime.js` 全站即時套用。
- 外部專案 v0 接入機制：`registry.json` 登錄 + 外部放 `jonaminz-app.json` +
  `registry-loader.js` 拉取顯示卡片 + `registerExternalApp` 背景回報。
  （目前 `externalProjects` 為空，機制在但沒有實際外部專案。）
- Cloudflare Worker 後端已部署：`https://jonaminz-backend.ndmc402010104.workers.dev`。
- 本機預覽 `dev-server.js`。
- 多頁架構：新頁面只改 `config.json` + 建資料夾（見 `pages/README.md`）。
- **Platform Integration 核准後台（implementation plan 第 3 項）端到端可用**：
  `/pages/admin/contracts/` 後台輸入 Worker secret `JONAMINZ_ADMIN_TOKEN`
  後可核准／否決／改判 pending Contract，Postgres function 原子處理狀態
  切換＋active 指標＋audit log，2026-07-11 已用 jonaminz-movies 真實那筆
  pending（snapshot #3）跑過完整流程（submit→reject→approve→撤回→再核准）
  並直連 DB 驗證三張表資料正確，細節見 §4。
- **Flattened Effective Settings 端點（implementation plan 第 4 項）已上線**：
  `getEffectiveSettings` 算 S31 公式，目前只算 CSS 這個維度，細節見 §4。
- **SDK Loader（implementation plan 第 5 項）已上線**：`sdk/jonaminz-entry.js`
  常青 loader＋`getSdkVersion` 版本指標，運送機制（pointer→immutable 檔案
  →執行）、kill-switch、回滾都已在正式環境實際操作驗證過，細節見 §4。
- **SDK Kernel（implementation plan 第 6 項）已上線**：`sdk/sdk-src/sdk.js`
  取代第 5 項的 placeholder，真的做 contract discovery、推送合約、查
  Effective Settings、settle S21 官方 snippet 的 ready Promise。對
  jonaminz-movies 真實已上線頁面注入完整官方 snippet 測過 ready 路徑跟
  三條降級路徑，全部正確，細節見 §4。
- **tokens CSS 收編（implementation plan 第 7 項）已上線**：Kernel 的
  `applyTokens()` 在 `effectiveCss === "tokens"` 時收編既有
  `getThemeCssRules` 的資料，只送 `:root` 變數，舊名／`--jz-*` 新名
  都輸出。`theme-runtime.js` 本身沒動，仍是 jonaminz 自己網站用的 v0
  機制，細節見 §4。

## 4. 尚未完成的功能

- **Platform Integration（圖書館模型）**：規格 `docs/platform-integration-spec-v1.md`
  正式 **Frozen（S1–S39）**，S 條文不可修改（RULES.md §一-12）。實作依
  `docs/platform-integration-v1-implementation-plan.md` 的順序推進，目前狀態：
  - **第 1 項（Contract JSON Schema ＋ 範本）：完成，RC3.1 定案。**
    `docs/contract-schema/`（schema.json + example.json + README）。過程中
    兩輪外部 review 抓到並修正了兩個真實的 URL 驗證繞過漏洞（protocol-relative
    `//host/...`、反斜線正規化 `/\host/...`——WHATWG URL parser 會把 `\`
    轉成 `/`），細節與其餘修正見 CHANGELOG 對應日期條目、定案細節見
    `docs/contract-schema/README.md`。RC3.1 定下「Environment Resolution」
    模型：Contract 不宣告 prod/dev/local，path-absolute URL 由接收 ingestion
    的 Worker 依 Integration Settings 解析；絕對 https:// URL 的 origin
    必須精確等於**目前 environment** 登記的 origin，不得跨 environment 混用。
  - **第 2 項（Worker 端合約收取）：完成並已部署上線**，範圍限於「收取＋存
    pending snapshot」。`backend/cloudflare-worker/`：`contract-validation.js`
    （純函式：canonical hash / cross-field 檢查 / URL 同源檢查，已用 node 跑過
    23 項正反例）、`integration-settings.json`（Integration Settings，S38：git
    檔案＋Worker 供應，目前 `projects` 為空，尚無真實外部專案登記）、
    `worker.js` 的 `submitContract` action（schema 驗證 → cross-field →
    URL/origin → canonical hash 去重 → insert pending snapshot + audit log）、
    `wrangler.toml` 新增 `[vars] JONAMINZ_ENVIRONMENT="prod"`（Worker 自己
    是哪個 environment 由部署決定，不是 payload 能宣告的，避免跨 environment
    origin 混淆攻擊）。**不包含**：approve/reject 動作、核准後台（第 3 項）、
    KV-based rate limit（已知留白，見 backend/README.md）。
    **重要教訓（2026-07-10）**：第一次 `wrangler deploy` 直接失敗——
    Cloudflare Workers 的 V8 isolate 禁止 `new Function`/`eval`，而
    `ajv.compile()` 預設在 runtime 就是靠這個機制編譯 schema。改用 ajv 的
    standalone code 機制，在 **build time**（`generate-contract-validator.mjs`）
    把 schema 預編成純 JS（`contract-schema-validator.generated.js`），
    `worker.js` 直接 import 這份產出、不在 Worker 裡呼叫 `ajv.compile()`。
    修好後用 esbuild 實際打包＋Node 功能測試（不只 `wrangler --dry-run`——
    dry-run 只測 bundle 過不過，測不出 runtime 才會炸的 eval 限制）確認乾淨，
    才重新部署成功並在線上 smoke test（舊 action 正常、新 action 正確擋下
    未登記 projectId、DB 沒被寫入）。**下一棒改 Contract Schema 時記得**：
    改完 `docs/contract-schema/jonaminz.contract.schema.json` 一定要重跑
    `node generate-contract-validator.mjs` 才能讓 Worker 吃到新規則。
    **2026-07-11：外部 review（ChatGPT，純讀取盤點）核對＋文件同步**。
    盤點基本正確，抓到 `ARCHITECTURE.md` §7 仍寫「Platform Integration
    零實作」的嚴重過期問題（已修正）、`docs/contract-schema/README.md`
    仍是「即將開工」語氣（已修正）、`implementation-plan.md` 第 2 項沒標
    完成（已補）。也發現一個真的存在的驗證缺口：submitContract 的正向
    成功路徑（已登記專案→合法 Contract→pending snapshot→audit log）
    **從未透過真正部署的 Worker HTTP endpoint 測過**，只測過反向路徑
    （未登記 projectId 被拒絕）——使用者裁決不急著補測，留到第一個真實
    外部專案登記時一併驗證。使用者同時正式裁決：加 pre-parse request
    body 大小限制（已寫進 `worker.js`，見上方版本注意事項，**尚未部署**）；
    完整 rate limit 正式留白（不是遺漏）；SKHPSv2 正式接入 jonaminz 是
    真實意圖但不急，排在第 3-9 項之後。
  - **第 3 項（核准後台）：完成並已部署上線（2026-07-11）。**
    `backend/supabase/contract_schema.sql` 新增 `approve_contract_snapshot`／
    `reject_contract_snapshot` 兩個 `security definer` Postgres function，
    透過 Supabase RPC 端點呼叫，一次 function call 在 DB 端就是原子
    transaction（改 snapshot 狀態＋切換 `contract_active_snapshots`
    指標＋寫 `contract_audit_log`），不是 Worker 端連續多次 fetch。
    `worker.js` 新增 `listPendingContracts`（公開唯讀）／`approveContract`／
    `rejectContract`（`payload.adminToken` 須吻合 Worker secret
    `JONAMINZ_ADMIN_TOKEN`，不符合回 `UNAUTHORIZED`，200 not 401）。新頁面
    `/pages/admin/contracts/`：pending 清單、跟目前 active 版本的逐 key
    diff、核准／否決按鈕。
    **設計修正（使用者當場發現的真實 bug）**：第一版把 approve/reject
    寫成只能從 `pending` 狀態發動，否決後永遠卡死無法改判。使用者指出
    這不合理，重讀規格後確認 S13 原文「核准/否決只改狀態與 active 指標，
    **永不覆寫歷史**」——「歷史」指 audit log 不可竄改，不是 status 定了
    就不能再變。改寫兩個 function：不管目前狀態都能核准/否決（可自由
    在 approved/rejected 間改判）；否決時如果那筆正好是目前生效版本，
    撤回 `contract_active_snapshots` 指標（沒有版本歷史堆疊可自動退回
    上一版，安全預設是「暫時沒有生效版本」，要人工重新核准）；每次改判
    都在 audit log 多插入一筆，不覆寫舊紀錄。前端 `rowActionsHtml` 同步
    改成已核准顯示「撤回核准」、已否決顯示「改為核准」。
    **順手修的 UX 問題**（使用者實際操作時發現）：admin token／操作人
    輸入框在畫面重畫（按重新整理／核准後自動刷新）時會被 `sessionStorage`
    舊值蓋掉，逼人重打——改成 `input` 事件即時存檔；操作人從自由輸入
    改成 Jonathan/Minz 兩個切換按鈕（就兩人在用，不用打字）；欄位順序
    改成操作人在前、token 在後（貼近帳號密碼慣例）；否決備註原本存了
    但畫面看不到，補上顯示；已裁決列表預設收起技術性欄位（snapshot id／
    hash）到展開區，摺疊列只留使用者真的會看的資訊。
    **驗證**：使用者用 jonaminz-movies 那筆真實 pending（snapshot #3）
    實際跑過 submit→reject→approve→撤回核准→再核准 全流程，直連 DB
    確認 `contract_snapshots.status`／`contract_active_snapshots`／
    `contract_audit_log`（5 筆，一筆未覆寫）三張表狀態全部正確。
  - **第 4 項（Flattened Effective Settings 端點）：完成並已部署上線
    （2026-07-11）。** `worker.js` 新增 `getEffectiveSettings`（公開唯讀，
    environment 不從 payload 讀、一律用 Worker 自己的
    `JONAMINZ_ENVIRONMENT`，理由跟 `submitContract` 一樣）算 S31 公式：
    沒有 active approved snapshot → `approved:false, css:"none"`
    （S31 明文降級）；有的話 → `css = min(Contract 聲明的 css, Settings
    授予的 css)`（S34，v1 只有 none/tokens 兩級，未知值視同沒宣告，
    S11 must-ignore）。**範圍刻意收窄**：`docs/platform-integration-consensus.md`
    把「Integration Settings 內容 schema」列在保留層，v1 SDK（第 5、6 項）
    規劃是 `window.Jonaminz.*` 全部 service 一律婉拒（F7/S32），現在唯一
    有真實內容可算的授權維度只有 CSS，所以這次 `capabilities` 固定回空
    陣列佔位（形狀先定，第 6 項才填內容，之後不用改 response 形狀）。
    `integration-settings.json` 新增每個 environment 選填的 `css` 欄位
    （省略視為 `"none"`）＋檔案層級 `revision` 整數（S38 要求回應帶版本
    資訊，這份檔案是 git 檔案沒有 DB 版號可用，改一次手動 +1）。純函式
    的 min 計算邏輯（4 種已知值 × 4 種組合＝16 種）先用 node 窮舉測試過
    才接進 worker.js。curl 驗證過三條路徑：未登記 projectId →
    `PROJECT_NOT_REGISTERED`；缺 `projectId` → `PROJECT_ID_REQUIRED`；
    `jonaminz-movies`（已 approved，但 Contract 沒宣告 `css`）→ 正確回
    `approved:true, css:"none"`。**這次沒做**：SDK 本身（沒有東西會真的
    呼叫這個端點）、`capabilities` 真實內容、把 `getThemeCssRules` 的
    CSS 規則傳遞邏輯收編進來（第 7 項的事，這個端點只回答「准不准」）、
    「tokens 正向成功」路徑的真實端到端驗證（jonaminz-movies 沒宣告
    css，等真的有專案要用 tokens 時再一併補）。
  - **第 5 項（SDK Loader＋版本指標）：完成並已部署上線（2026-07-11）。**
    範圍刻意跟第 6 項（SDK Kernel）切開——這裡只蓋「運送機制」，不做
    S21-23 的 `window.Jonaminz.*` 骨架／Promise/ready 語意。
    `sdk/jonaminz-entry.js`：常青 loader（`https://jonaminz.com/sdk/`
    這個路徑），向 `getSdkVersion`（新 Worker action，S37，公開唯讀）
    問某個 channel（stable/next）目前指向哪個 immutable
    `sdk/sdk-<hash>.js`，全程 `try/catch`（S24 不燒房子），localStorage
    5 分鐘短 TTL 快取，抓不到指標時退回 last-known-good（不論多舊），
    兩者都沒有就靜默退場。**踩過一個真的 bug 並自己抓到修好**：第一版
    把載入 SDK 檔案的網址誤用 `window.location.origin`（宿主頁面的
    origin）——但 SDK 檔案是放在 jonaminz.com，不是外部專案自己的網域，
    本機測試網址跟正式站不同時會直接載入失敗。改用
    `document.currentScript.src` 反推 loader 自己是從哪個網域載入的，
    在同步階段先存起來（`document.currentScript` 在非同步 callback 裡
    不可靠）。`sdk/generate-sdk-release.mjs`：build-time 腳本，讀
    `sdk/sdk-src/sdk.js`、算 sha256 前 12 碼產生 immutable 檔名，跟
    `generate-contract-validator.mjs` 同精神；不自動改
    `sdk-versions.json`，發版是人的決定。這次放的是極簡 placeholder
    release（`window.Jonaminz.status="degraded"`），只證明「pointer→
    immutable 檔案→執行」這條鏈通了，不假裝實作真正的 SDK 邏輯。
    **kill-switch 與回滾都已在正式環境實際操作驗證過**（不是只看程式碼
    推論）：把 `stable` channel 指到 `sdk/sdk-empty.js`（真的什麼都不做）
    並部署，headless browser 確認 `window.Jonaminz` 變成 `undefined`；
    改回 placeholder hash 再部署，確認恢復正常。S39 回滾相容 checklist
    見新文件 `docs/sdk-release-checklist.md`（純流程文件，S39 原文允許
    不做自動化系統）。`integration-settings.json` 新增選填的 `channel`
    欄位（getSdkVersion 用來決定金絲雀，v1 沒有專案會設，形狀先定）。
  - **第 6 項（SDK Kernel）：完成並已部署上線（2026-07-12）。**
    `sdk/sdk-src/sdk.js` 整份改寫，取代第 5 項的 placeholder：
    (1) 判斷 `window.Jonaminz.__snippetVersion` 標記決定要不要初始化
    （S22：沒標記＝命名空間被占用或沒走官方 snippet，靜默退場，不覆寫）；
    (2) contract discovery（S18-20）：`data-contract`（loader 轉貼來的
    值）或預設 `/jonaminz.contract.json`，`new URL(path, location.origin)`
    解析後核對 origin 是否吻合，跨源直接視為 discovery 失敗（S19，拒絕
    絕對 URL 覆寫同源限制）；(3) F5/S8 最小必填客戶端粗篩
    （contractVersion／app.projectId／app.title）；(4) 呼叫
    `submitContract` 推送，**推送失敗用 `.catch()` 吞掉、不中斷後續流程**
    （S13/S16：推送 ≠ 採信，即使這次推送失敗，只要之前 approved 過，
    整合仍應正常運作）；(5) 呼叫 `getEffectiveSettings` 決定
    `ready`/`degraded`（S23/S31：`approved:true`→ready，否則
    degraded，reason 用 Worker 回的實際 code 如 `PROJECT_NOT_REGISTERED`，
    比泛用的 `SETTINGS_UNAVAILABLE` 更有意義）；(6) `report()` 依
    `__bootstrap` 是否還在決定呼叫 `.settle()` 或就地更新（S21：
    Kernel 姍姍來遲、bootstrap 已被 15 秒逾時 settle 過的情況）。
    **範圍刻意收窄（照規格推論，不是漏做）**：v1 沒有任何已正式發布的
    service，`window.Jonaminz.*` 這次不掛任何 service 命名空間（S32
    只保障已發布 service 永久存在）；`JonaminzError` 形狀（S27）只在
    `SDK_INIT_FAILED` 這唯一 reject 情況用到，沒有生沒人呼叫的
    constructor；`diagnostics.rollback` 恆 `false`（沒有 caller 需要，
    判斷需要額外追蹤上一個已知穩定版本）。
    **銜接第 5 項的設計缺口**：S18 規定 `data-contract` 寫在載入 loader
    的 `<script>` 標籤上，但 Kernel 是 loader 動態插入的「另一個」
    `<script>` 標籤，自己的 `document.currentScript` 讀不到原始標籤的
    屬性——小幅修改已上線的 `sdk/jonaminz-entry.js`：同步階段先讀出
    `data-contract`，動態插入 Kernel `<script>` 時轉貼
    `dataset.contract`／`dataset.release`（Kernel 自己的 hash，讀不到
    自己檔名）／`dataset.stale`（這次指標是不是從 localStorage 快取來的，
    只有 loader 知道）。
    **驗證**：對 jonaminz-movies 真實已上線頁面（有真實 Contract、已
    registered、已 approved）注入完整 S21 官方 snippet，loader 網址指
    本機、`getSdkVersion` 用 Playwright route 攔截 mock 成指向新 Kernel、
    `submitContract`／`getEffectiveSettings` 打真實 Worker：
    `await window.Jonaminz.ready` 正確 resolve `status:"ready"`，
    `diagnostics.release` 吻合新 hash（證明轉貼機制真的通了）、
    `settingsRevision` 是真實數字。另外驗證三條降級路徑（合約 404、
    projectId 未登記、合約缺必填欄位）皆正確 `degraded` 且 reason 正確、
    零 JS 錯誤（S24 底線）。
  - **第 7 項（tokens CSS 收編進 SDK）：完成並已部署上線（2026-07-12）。**
    `sdk/sdk-src/sdk.js` 新增 `applyTokens()`：`effectiveCss === "tokens"`
    時呼叫既有的 `getThemeCssRules`（不改 Worker、不改 Supabase），只挑
    `:root` 那些列（S35：這才是跨專案共用介面，其他 selector 如 `.card`
    是 jonaminz 自己共用元件的微調，對外部專案沒有意義，不送）；每個
    變數同時輸出舊名（`--color-primary`）與 `--jz-*` 新名
    （`--jz-primary`，S36 機械式轉換：拿掉舊前綴、換 `--jz-`，其餘語意
    名稱不變，值相同）。套用是 fire-and-forget，不 await、不擋 `ready`
    settle（S23 沒有把 CSS 套用列進 ready 必要條件）；失敗只
    `console.warn`，不影響 `ready`/`degraded` 判定。**`theme-runtime.js`
    本身這次沒動**：它是 jonaminz 自己網站依賴的 v0 機制（任何人貼
    script 標籤就拿到外觀，不經 Contract／Settings 審核），RULES.md
    §4 規定作廢需三條件都成立，這次沒有要作廢它——第 7 項是在 Kernel
    裡新增一份收編後的 gated 邏輯，不是重構原檔案。**驗證**：Playwright
    mock `getEffectiveSettings`／`getThemeCssRules`（其餘走真實
    production Worker），確認 tokens 正向路徑（舊名+新名都輸出、
    `.card` 這類非 `:root` selector 正確排除）、`css:"none"` 時完全
    不呼叫 `getThemeCssRules`（gated 真的擋住）、`getThemeCssRules`
    失敗時 `ready` 仍正確 resolve（不影響核心 lifecycle），三種情況
    皆零 JS 錯誤。**這次沒做**：真實外部專案端到端跑一次「tokens 正向
    成功」（jonaminz-movies 的 Contract 沒宣告 css、Settings 授予也是
    `"none"`，維持第 4 項的保守選擇，等真的有專案要用 tokens 才一併
    做）；補建完整 24 個 token 的 baseline 交付（現有機制本來就只送
    「已客製的 delta」，這次是照原樣收編，不是新功能）。
  - **第 8 項（smoke app）：完成（2026-07-12，純驗證，無程式碼變更）。**
    沒有另外養一個專用假專案——拿 jonaminz-movies（真實、已登記、已
    核准）當宿主頁面，Playwright `page.route()` 只在需要製造邊界情況時
    竄改 Worker 回應，其餘打真實 production Worker。固定情境清單
    （implementation-plan.md 下方，來源 ChatGPT Review AR-18）13 項：
    8 項驗證通過（含本輪新測的 Settings timeout／SDK 重複載入／SDK
    rollback／Worker 回傳未知欄位／snippet 載入失敗降級）、2 項確認
    等同於已驗證情境（project disabled＝NOT_APPROVED 的反面路徑）、
    3 項 v1 範圍內不適用（optional capability／Shell none／舊 Contract
    schema 配新 SDK，背後系統還沒做，不是測試遺漏）。**發現一個誠實
    記錄但不修的行為**：SDK 重複載入不是嚴格 no-op（S22 只保證不覆寫、
    不炸房子，沒做「偵測已初始化就整個跳過」，重複載入會重打一次
    網路請求）——判定可接受，真的有案例受影響再回頭加 init 旗標。完整
    逐條紀錄見新文件 `docs/platform-integration-v1-acceptance-tests.md`。
    `sdk-src/sdk.js` 這次沒有變更，不需要重新部署。
  - **第 9 項（Google OAuth 主站登入 ＋ identity capability）：階段 A
    程式碼完成、本機驗證通過，尚未部署／尚未套用 DB schema（2026-07-12）。**
    範圍比原始 implementation-plan.md 寫的（只做主站身分識別）擴大成
    三件事（使用者明確要求）：內部密語登入＋Google OAuth 兩條路都要有；
    Jonathan/Minz 在 jonaminz 登入後身分要能傳給 skhpsv2（單向、僅供
    前端顯示「OO你好」，不是真的跨系統授權）；整件事必須是 jonaminz
    可以選擇要不要開放給外部專案調用的**能力**（S30-33 capability
    機制），不是外部專案硬依賴的東西——這正好對上第 4/6 項刻意留白的
    `getEffectiveSettings.capabilities` 陣列。完整設計見核准過的計畫檔
    `docs/platform-integration-v1-implementation-plan.md` 第 9 項段落
    （若尚未同步，另見對話歷史的 plan mode 產出）。三階段：
    **階段 A**（這次做的）＝jonaminz 自己的登入／登出；**階段 B**＝把
    identity 接成正式 `identity.currentUser@1` capability（`getEffectiveSettings`
    的 `capabilities` 陣列這次才真的有內容）；**階段 C**＝skhpsv2 正式
    接入（另一個 repo，需要另外授權、先讀那邊的 AI_CONTEXT）。
    **DNS 查證發現**：`jonaminz.com` 掛在 Squarespace DNS（不是
    Cloudflare），Worker 無法掛 `*.jonaminz.com` custom domain，原本設想
    的 `Domain=.jonaminz.com` 共用 cookie 不可行——改用 iframe +
    postMessage 轉發（`pages/identity-relay/`）+ localStorage 存 token，
    對外的穩定介面仍是未來 `window.Jonaminz.identity.currentUser()`
    （階段 B 才會掛這個命名空間），DNS 若未來真的搬去 Cloudflare只需要
    換掉這段內部實作，外部呼叫端程式碼不用改。
    **階段 A 已完成的部分**：新表 `sessions`／`oauth_states`
    （`backend/supabase/auth_schema.sql`，含 service_role grant，尚未
    套用到正式 DB）；`worker.js` 新增非 `/api/action` 路由
    `GET /auth/google/start`／`GET /auth/google/callback`（標準
    authorization code flow，ID token 解碼不驗簽名——來源是 server-to-server
    對 Google 的 TLS 連線，理由跟瀏覽器端第三方 ID token 不同）＋三個新
    action `loginWithInternalToken`／`getCurrentIdentity`／`logout`
    （esbuild 打包＋`node --check`＋eval/new Function grep 驗證過語法乾淨，
    **尚未 `wrangler deploy`**）；`assets/js/backend-client.js` 新增對應
    wrapper；新頁 `pages/login/`（內部密語表單＋Google 登入連結）；
    `assets/js/header.js` 擴充暴露 `window.JonaminzIdentity`（見 §2）。
    **本機驗證（Playwright，mock `/api/action` 的登入/身分查詢回應，
    dev-server.js 起本機站）**：內部密語登入成功/失敗兩條路、登入後
    首頁與各頁共用 header 都正確顯示「OO你好」＋登出、登出正確清除
    token 並重新整理、Google OAuth callback 的 hash-fragment token 擷取
    （模擬 `#jonaminzSessionToken=...` 導回首頁）正確存進 localStorage
    並清掉網址列。**過程中自己抓到並修好一個真的會發生的 bug**：
    `header.js` 第一版把「讀 URL hash 存 token」的邏輯包在
    「找不到 `[data-jonaminz-header]` 元素就 return」的判斷式裡面——
    但首頁（Google OAuth 固定導回的目的地）剛好沒有這個共用元素（自己的
    簽名式導覽版型），導致 OAuth 登入永遠存不進 token。改成 hash 擷取
    邏輯搬到 IIFE 最外層無條件執行，元素存不存在只影響要不要 render
    身分區塊；同時讓首頁自己的 `assets/js/app.js` 呼叫
    `JonaminzIdentity.mount()` 把身分狀態插進它自己的 nav-links。
    **這次還沒做（尚未部署／需要使用者操作）**：`auth_schema.sql` 套用
    到正式 `jonaminz-db`（需要直連 DB 授權）；`worker.js` 這批改動
    `wrangler deploy`（需要部署授權）；使用者自行
    `wrangler secret put JONAMINZ_LOGIN_JONATHAN`／`JONAMINZ_LOGIN_MINZ`；
    使用者自行去 Google Cloud Console 建立 OAuth Client（redirect URI
    `https://jonaminz-backend.ndmc402010104.workers.dev/auth/google/callback`）
    並設定 `JONAMINZ_GOOGLE_CLIENT_ID`／`JONAMINZ_GOOGLE_CLIENT_SECRET`／
    `JONAMINZ_GOOGLE_EMAIL_JONATHAN`／`JONAMINZ_GOOGLE_EMAIL_MINZ` 四個
    secret；部署後在正式環境端到端驗證內部登入與 Google OAuth 全流程
    （Google 那段目前完全沒測過，本機只測得到內部密語登入，因為 OAuth
    需要真實 Google Client Secret 才能跑完整流程）。之後才會做階段
    B（identity capability）與階段 C（skhpsv2 接入）。
  - **2026-07-11：第一個真實外部專案 `jonaminz-movies` 已登記**
    （`integration-settings.json` 新增 `prod` origin
    `https://ndmc402010104.github.io`）。獨立 repo
    [`ndmc402010104/jonaminz-movies`](https://github.com/ndmc402010104/jonaminz-movies)
    （公開），部署在 GitHub Pages（`https://ndmc402010104.github.io/jonaminz-movies/`，
    GitHub Actions 自動建置）。原始 UI 由 ChatGPT Work 產出、依賴 OpenAI
    自家 `vinext`／site-creator 鷹架且缺一份 `.openai/hosting.json`（匯出時
    刻意排除、建置直接壞掉），已拆掉鷹架改成單純 Vite + React 19 +
    Tailwind v4 SPA，畫面邏輯逐字保留。根目錄 `jonaminz.contract.json`
    只填 S8 必填欄位 + 一個 entry，用 ajv-cli 與 Worker 實際的
    cross-field/URL 驗證模組都驗證過合法。**implementation plan 第 2 項的
    正向成功路徑已完整驗證過**（上面「外部 review 核對」那筆記的驗證缺口
    已補齊）：已部署＋真的呼叫線上 `submitContract`（帶正確 Origin
    header）、直連 DB 確認 `contract_snapshots` 多一筆
    `status='pending'`、`contract_audit_log` 正確連到那筆 snapshot。
    過程中發現並修好一個真實 bug：**三張 contract_* 表透過 Supabase
    Management API（而不是儀表板 SQL Editor）建立時，`service_role`
    沒有自動拿到表格層級 DML 權限**（RLS 設定沒問題，但 Postgres GRANT
    是分開一層）——第一次呼叫直接收到 403。已直連補上
    `GRANT SELECT/INSERT/UPDATE/DELETE ... TO service_role`，跟既有兩張表
    權限一致，並回寫進 `backend/supabase/contract_schema.sql` 避免下次
    重建再踩到。
- **Auth**：目前整站無登入（第 9 項階段 A 程式碼已寫完但未部署，見上）。
  `saveThemeCssRules` 無身分驗證，任何知道 Worker 網址的人都能改全站
  外觀——已知安全缺口，第 9 項部署後這個缺口本身仍不會自動補上（那是
  另一個 action 的事，這次沒有把 `saveThemeCssRules` 接上登入驗證，
  純粹是新增獨立的登入系統，之後要不要把既有寫入動作接上身分驗證是
  未來的事，不在這次範圍內）。
- 後台 `/pages/admin/` 只是佔位頁。
- Reservoir 願景中的 Slot Engine、Home Portal slots、Global Search、AI Gateway、
  Storage Layer：全部只在願景/規格層面，未實作。
- Roadmap Phase 1-5 見使用者記憶與 `docs/platform-integration-consensus.md`；
  目前處於 Phase 1 早期。

## 5. 外部服務、API、部署方式

| 項目 | 內容 |
|---|---|
| 前端託管 | GitHub Pages，repo `ndmc402010104/jonaminz`，branch `main`，網域 `www.jonaminz.com`（CNAME） |
| 後端 | Cloudflare Worker `jonaminz-backend.ndmc402010104.workers.dev`，部署指令 `npx wrangler deploy`（在 `backend/cloudflare-worker/` 下） |
| 資料庫 | Supabase Postgres，專案 `jonaminz-db`（ref `xhwrizmacantlubasixe`，AWS ap-southeast-1）。五張表：`external_app_registrations`、`theme_css_rules`、`contract_snapshots`、`contract_active_snapshots`、`contract_audit_log`，皆開 RLS 無 public policy（只有 Worker 用 secret key 能碰）。**注意**：同一個 Supabase 組織下還有 `skhps-db`（另一專案，ref `ybixaibejrigqbrostnq`）——共用同一把 Management API token，操作前務必核對 project ref，不要碰錯專案 |
| Worker secrets | `SUPABASE_URL`、`SUPABASE_SECRET_KEY`、`JONAMINZ_ADMIN_TOKEN`（approve/reject 臨時關卡，存在 Cloudflare，不在 repo，Claude 不經手實際值） |
| Worker API | 唯一端點 `POST /api/action`，action：`registerExternalApp` / `listExternalAppRegistrations` / `getThemeCssRules`（公開唯讀）/ `saveThemeCssRules`（**無驗證**）/ `submitContract`（Contract 收取，一律存 pending）/ `listPendingContracts`（公開唯讀）/ `approveContract` / `rejectContract`（**唯一有 `adminToken` 保護的寫入動作**，可互相改判）/ `getEffectiveSettings`（公開唯讀，S31 公式）/ `getSdkVersion`（公開唯讀，S37 版本指標，`sdk/jonaminz-entry.js` 用，見 backend/README.md） |
| CORS | Worker 回 `Access-Control-Allow-Origin: *` |

**部署鏈注意**：前端改動＝git push 到 main 即上線（GitHub Pages）；Worker 改動＝
必須另外 `wrangler deploy`，git push 不會部署 Worker。兩者是獨立動作。

## 6. 版本與分支狀態（2026-07-12 掃描）

- 業務版本：`v0.9.0-202607120900`（`version.js`，第 9 項階段 A 前端
  bump）。規則：每次 push 前要 bump。**注意**：這次 bump 只反映前端
  程式碼變更（新頁面/header.js/首頁 nav），worker.js 這批新 action/路由
  還沒部署——`getSdkVersion` 等既有端點回的 Kernel hash 不受這次 bump
  影響，Worker 沒有自己的 version.js 版號，靠 `wrangler deploy` 本身
  當作部署時間點。
  **2026-07-11～12 implementation plan 第 3-7 項皆完成並已上線**：第 3 項
  （核准後台）Worker 已 `wrangler deploy`、`contract_schema.sql` 的 approve/
  reject Postgres function（含改判邏輯修正版）已套用到 jonaminz-db、
  `JONAMINZ_ADMIN_TOKEN` secret 使用者已自行設定、`pages/admin/contracts/`
  已 push 上線。第 4 項（`getEffectiveSettings`）Worker 已
  `wrangler deploy`、`integration-settings.json` 的 `css`/`revision`
  欄位已隨部署生效，curl 已驗證三條路徑正確。第 5 項（SDK Loader）、
  第 6 項（SDK Kernel）、第 7 項（tokens CSS 收編）都已 `wrangler deploy`
  （`getSdkVersion` 指標現在指向含 tokens 邏輯的 Kernel，hash
  `c0d679686951`）；`sdk/` 資料夾本次收尾會一併 git push（push 之後
  `https://jonaminz.com/sdk/jonaminz-entry.js` 才會是真的常青網址上線，
  之前都在 localhost／mock 指標測試）。第 5 項的 kill-switch／回滾已在
  正式環境的 `sdk-versions.json` 上實際操作並復原過。Worker 線上版本與
  repo（push 完後）完全同步。
- 分支：只有 `main`，remote 只有 `origin`（GitHub）。與 SKHPS 的 skhpsv2 不同，
  **沒有** prod/dev 雙 remote 切換機制。
- 未 commit 檔案（建檔當下）：`docs/platform-integration-spec-review.md`、
  `docs/platform-integration-consensus.md`（皆 untracked）＋本次新增的 `AI_CONTEXT/`。
- `.gitignore` 已涵蓋 `*pw*.txt` / `*secret*.txt` / `.env*` / `.wrangler/` / `.codemap/`。

## 7. UNKNOWN / 待確認清單

- `VERIFIED 2026-07-10`：Supabase 專案是 `jonaminz-db`（ref `xhwrizmacantlubasixe`，
  AWS ap-southeast-1）。根目錄「`suprabase db pw.txt`」除了 DB 密碼，還有一把
  Supabase **Management API** token（`sbp_...`，標記 `jonaminz-migration-temp`）——
  這把 token 能碰同一個 Supabase 組織下的**所有**專案，目前該組織還有 `skhps-db`
  （ref `ybixaibejrigqbrostnq`，另一個專案）。用這把 token 直連操作前，**務必先
  用唯讀查詢核對 project ref／查表名，確認打對 `jonaminz-db`**，不要假設自己在
  對的專案上——2026-07-10 建 `contract_schema.sql` 三張表時已示範這個核對流程
  （見 CHANGELOG 對應條目）。直連 DB 屬敏感操作，每次都要先問過使用者
  （RULES.md §一-7）。
- `UNKNOWN`：`theme_css_rules` 與 `external_app_registrations` 兩張表目前的實際
  資料內容（需透過 Worker API 或 Supabase 後台查詢才知道）。
- `VERIFIED 2026-07-10`：`https://jonaminz.com`（apex）目前回 301 轉址至
  `https://www.jonaminz.com/`（curl 實測）。SDK 的 canonical host 尚需在
  Platform 規格定稿時正式凍結；暫定保留 `https://jonaminz.com/sdk/...` 寫法，
  並把「apex 301 轉址至 www」視為平台基礎設施合約的一部分——動 DNS/Pages
  網域設定前必須意識到 SDK 常青網址依賴這條轉址。
- `INFERRED`：首頁 Jonathan / Minz 兩個 name-link 目前只是錨點（`#jonathan`/`#minz`），
  尚無對應內容頁。
