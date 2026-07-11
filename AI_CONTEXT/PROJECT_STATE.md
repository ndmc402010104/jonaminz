# PROJECT_STATE — jonaminz 專案現況

最後更新：2026-07-10（建檔）
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
    js/header.js / footer.js  共用 shell（footer 顯示版本）
    js/registry-loader.js     讀 registry.json、抓外部專案 manifest 顯示卡片（目前拉模式）
    js/backend-client.js      呼叫 Cloudflare Worker 的統一入口
    js/theme-runtime.js       CSS 第 8 層：從 Worker 讀 theme_css_rules 動態組 CSS 注入；
                              獨立可攜，外部專案可單獨引用；有 localStorage 快取 + 8s 逾時降級
    js/app.js                 首頁業務入口
  pages/
    README.md                 新增頁面的標準流程（重要：新頁面照這份做）
    admin/                    後台首頁（佔位 + Theme 頁連結）
    admin/theme/              Theme 編輯頁：讀寫 Supabase CSS 規則，存檔全站立即換外觀
  backend/
    README.md                 後端部署說明
    cloudflare-worker/worker.js   唯一後端入口 POST /api/action，5 個 action（見 §5）
    cloudflare-worker/wrangler.toml   含 [vars] JONAMINZ_ENVIRONMENT（見 §4 Platform Integration）
    cloudflare-worker/package.json    ajv 依賴（Contract JSON Schema 驗證用）
    cloudflare-worker/integration-settings.json  Contract 收取用的 Integration
                                      Settings（git 檔案，S38；projectId→environment→
                                      registered origin，目前為空，尚無真實外部專案）
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
    supabase/contract_schema.sql  contract_snapshots / contract_active_snapshots /
                                  contract_audit_log 三張表（已套用到 jonaminz-db）
  docs/
    external-project-manifest.md          v0 外部專案接入方式（現行有效；作廢需三條件，見 RULES §4）
    platform-integration-spec-review.md   Platform 規格 v1 的架構審查
    platform-integration-consensus.md     共識版理解（凍結層 F1-F12）
    platform-integration-review-request.md RFC（已凍結）：發給所有審查 Agent 的同一份
                                          Review Request，含 12 個挑戰問題；收到的
                                          Review 一份一檔放 docs/platform-integration-reviews/
    platform-integration-v1-implementation-plan.md  Spec Frozen 後的工作清單（非規格）
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
  - 尚未開始：第 3 項（核准後台）→ 第 9 項（Google OAuth）。SDK
    （`jonaminz-entry.js`，常青網址 `/sdk/`）、`window.Jonaminz.*` 一行都
    還沒寫。
- **Auth**：目前整站無登入。`saveThemeCssRules` 無身分驗證，任何知道 Worker 網址
  的人都能改全站外觀——已知安全缺口，規劃由 Google OAuth 補上。
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
| Worker secrets | `SUPABASE_URL`、`SUPABASE_SECRET_KEY`（存在 Cloudflare，不在 repo） |
| Worker API | 唯一端點 `POST /api/action`，action：`registerExternalApp` / `listExternalAppRegistrations` / `getThemeCssRules`（公開唯讀）/ `saveThemeCssRules`（**無驗證**）/ `submitContract`（Contract 收取，一律存 pending，見 backend/README.md） |
| CORS | Worker 回 `Access-Control-Allow-Origin: *` |

**部署鏈注意**：前端改動＝git push 到 main 即上線（GitHub Pages）；Worker 改動＝
必須另外 `wrangler deploy`，git push 不會部署 Worker。兩者是獨立動作。

## 6. 版本與分支狀態（2026-07-10 掃描）

- 業務版本：`v0.3.2-202607111415`（`version.js`）。規則：每次 push 前要 bump。
  **2026-07-11 已 `wrangler deploy`**：pre-parse `Content-Length` 限制
  （256KB，超過回 413）已上線，線上 smoke test 過三項：既有 action 正常、
  `submitContract` 仍正確拒絕未登記 projectId、送一個 300KB 的 request
  body 確認收到 413。repo 版本與線上部署版本目前同步。
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
