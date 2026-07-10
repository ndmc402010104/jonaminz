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
    cloudflare-worker/worker.js   唯一後端入口 POST /api/action，4 個 action（見 §5）
    cloudflare-worker/wrangler.toml
    supabase/schema.sql       external_app_registrations 表
    supabase/theme_schema.sql theme_css_rules 表
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

- **Platform Integration（圖書館模型）整套**：`jonaminz.contract.json` schema、
  JSON Schema 驗證、SDK（`jonaminz-entry.js`，常青網址 `/sdk/`）、推模式合約回報、
  `window.Jonaminz.*` API 骨架、Google OAuth。**一行程式碼都還沒寫**。
  規格定稿流程已於 2026-07-10 **全部完成**：RFC → 5 份 Review →
  彙整＋四項裁決 → RC → 驗收修正（RC2）→ 一致性修訂 →
  **`docs/platform-integration-spec-v1.md` 正式 Frozen（S1–S39）**。
  該文件是唯一權威；S 條文不可修改（RULES.md §一-12）。
  下一階段＝JSON Schema → Contract 範本 → SDK 骨架，依
  `docs/platform-integration-v1-implementation-plan.md` 的順序。
  **JSON Schema ＋ 範本（implementation plan 第 1 項）已產出草稿，經兩輪
  外部 review 修正，現為 RC3——設計面已定案，準備進第 2 項**
  （`docs/contract-schema/`：`jonaminz.contract.schema.json` +
  `jonaminz.contract.example.json` + README），已用 `npx ajv-cli
  --spec=draft2020` 驗證多組正反例通過（含兩輪 review 抓到的 URL
  bypass 反例）。兩輪 review 共修正 5 項真實問題：①`css` 欄位改掉閉合
  enum（違反 S11 must-ignore）；②③`contractUrl` regex 先後補上
  protocol-relative（`//host/...`）與反斜線正規化（`/\host/...`，WHATWG
  URL parser 會把 `\` 轉成 `/`）兩種繞過漏洞；④禁用欄位 `not` 守衛擴大到
  所有已知巢狀物件；⑤capability 文法改純 kebab-case。範例合約也修正了
  `requests`/`requires` 未落在 `supports` 裡的自相矛盾，`requires` 加了
  `uniqueItems`。README 的 5 點設計決策中，1、2 在草稿階段裁決，3
  （entries/objects 用陣列）、4（css 是單一字串）在這輪裁決，僅第 5 點
  （`$id` 何時正式發布）留一個「進 Worker 前」的 release checklist 待辦。
  Worker 端要做的 URL 驗證清單（WHATWG URL parser、同源比對、禁帳密、
  redirect 重新驗證等）與 cross-field 檢查清單，已記進
  `platform-integration-v1-implementation-plan.md` 第 2 項。第 2 項本身
  （Worker 端合約收取：Supabase schema、Cloudflare Worker 程式碼）
  **尚未開始**。
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
| 資料庫 | Supabase Postgres，兩張表：`external_app_registrations`、`theme_css_rules`，皆開 RLS 無 public policy（只有 Worker 用 secret key 能碰） |
| Worker secrets | `SUPABASE_URL`、`SUPABASE_SECRET_KEY`（存在 Cloudflare，不在 repo） |
| Worker API | 唯一端點 `POST /api/action`，action：`registerExternalApp` / `listExternalAppRegistrations` / `getThemeCssRules`（公開唯讀）/ `saveThemeCssRules`（**無驗證**） |
| CORS | Worker 回 `Access-Control-Allow-Origin: *` |

**部署鏈注意**：前端改動＝git push 到 main 即上線（GitHub Pages）；Worker 改動＝
必須另外 `wrangler deploy`，git push 不會部署 Worker。兩者是獨立動作。

## 6. 版本與分支狀態（2026-07-10 掃描）

- 業務版本：`v0.2.0-202607100017`（`version.js`）。規則：每次 push 前要 bump。
- 分支：只有 `main`，remote 只有 `origin`（GitHub）。與 SKHPS 的 skhpsv2 不同，
  **沒有** prod/dev 雙 remote 切換機制。
- 未 commit 檔案（建檔當下）：`docs/platform-integration-spec-review.md`、
  `docs/platform-integration-consensus.md`（皆 untracked）＋本次新增的 `AI_CONTEXT/`。
- `.gitignore` 已涵蓋 `*pw*.txt` / `*secret*.txt` / `.env*` / `.wrangler/` / `.codemap/`。

## 7. UNKNOWN / 待確認清單

- `UNKNOWN`：Supabase 專案的 URL 與 dashboard 位置（secret 只存在 Cloudflare Worker，
  repo 掃不到；根目錄密碼檔屬敏感，未讀取）。
- `UNKNOWN`：`theme_css_rules` 與 `external_app_registrations` 兩張表目前的實際
  資料內容（需透過 Worker API 或 Supabase 後台查詢才知道）。
- `VERIFIED 2026-07-10`：`https://jonaminz.com`（apex）目前回 301 轉址至
  `https://www.jonaminz.com/`（curl 實測）。SDK 的 canonical host 尚需在
  Platform 規格定稿時正式凍結；暫定保留 `https://jonaminz.com/sdk/...` 寫法，
  並把「apex 301 轉址至 www」視為平台基礎設施合約的一部分——動 DNS/Pages
  網域設定前必須意識到 SDK 常青網址依賴這條轉址。
- `INFERRED`：首頁 Jonathan / Minz 兩個 name-link 目前只是錨點（`#jonathan`/`#minz`），
  尚無對應內容頁。
