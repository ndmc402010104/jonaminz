# PROJECT_STATE — jonaminz 專案現況

最新新增：`assets/img/jonaminz-stacked-stones.svg` 是 animation-ready 的獨立四層疊石元件；四顆石頭與 `ground-brush` 各自擁有穩定且帶元件前綴的 `<g id>`，紋理、高光與裂紋跟隨各自石頭群組，未內建動畫、未接入頁面。2026-07-13 依使用者回饋完成精細紋理版：粗長龜裂改為短礦脈、髮絲紋、低對比不規則礦物斑與較細 grain，主要細節為純向量 path，不依賴加重濾鏡。要從外頁 CSS/JS 控制內部群組時必須 inline SVG（一般 `<img>` 無法選取內部 ID）。

最後更新：2026-07-13（**新增 `assets/img/jonaminz-wordmark.svg` 獨立文字標誌元件**：透明背景、緊密 viewBox、字標為純 path，不依賴外部字型；建議數位最小顯示寬度 160px，目前未接入頁面。另有 `assets/img/jonaminz-zen-logo.svg` 完整禪意構圖草案：依使用者提供的參考圖原創重繪，包含圓相、向量字標、竹枝與疊石；透明背景、無外部字型或點陣圖依賴，目前未接入任何頁面。**`docs/roadmap-202607.md` 順序①-⑦全部完成、驗證並 push**——接手前先看那份文件了解每項細節；第 9 項階段 A/B、前端品質重建計畫三階段皆已上線；文件真實性盤點完成。**⑦之後追加的視覺方向工作已全部完成並驗證**：Contract schema 新增 `app.visualIdentity` 自報欄位；jonaminz-movies 正式環境 Contract 帶 `visualIdentity`（酒紅 Editorial，snapshot #5 active）；`pages/admin/design/`（新頁面）讀真實已核准 Contract 展示各專案視覺方向；jonaminz 全站套用「亞麻米 Flax & Ink」（改 reservoir tokens，含修好一個關鍵 bug——Supabase Theme 系統裡有舊配色快照疊在 tokens 之上蓋掉新值，已刪除該快照 4 筆舊資料）；`pages/admin/contracts/` 改成按專案分組、摺疊歷史（含修好一個 `<details>` 展開狀態被 render() 重置的真實 bug）。全部經 Playwright 全站回歸驗證通過，細節見 `CHANGELOG.md` 同日「Platform Service 化的視覺方向」條目。**尚待 commit/push**（jonaminz 與 jonaminz-movies 兩邊）。使用者提出的「視覺方向應該存進 Theme 系統」長期方向已記錄在 `EXPERIMENTS.md` #9，未拍板不是現在做。**下一步是順序⑧手機 App 包裝**；順序⑤麵包屑維持延後不做）
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
    js/layout-metrics.js      RWD/viewport 量測層（待辦總表順序③，2026-07-12，搬自
                              SKHPSV2 同名檔案重寫）：只量測、寫 data-jonaminz-* 屬性、
                              發事件，不改畫面；目前沒有頁面訂閱，機制先上線
    js/backend-client.js      呼叫 Cloudflare Worker 的統一入口
    js/theme-runtime.js       CSS 第 8 層：從 Worker 讀 theme_css_rules 動態組 CSS 注入；
                              獨立可攜，外部專案可單獨引用；有 localStorage 快取 + 8s 逾時降級
    js/app.js                 首頁業務入口
  pages/
    README.md                 新增頁面的標準流程（重要：新頁面照這份做）
    admin/                    後台首頁（佔位 + Theme 頁連結 + Contract 核准連結）。
                              **整頁要求登入**（見下方「後台整站登入保護」）
    admin/theme/              Theme 編輯頁：讀寫 Supabase CSS 規則，存檔全站立即換外觀。
                              **整頁要求登入，存檔動作也要求登入 session**
    admin/contracts/          Contract 核准後台（implementation plan 第 3 項）：pending
                              清單、diff 檢視、核准／否決／改判。**整頁要求登入，
                              操作人由登入身分決定，不再是自報的按鈕（原本的
                              JONAMINZ_ADMIN_TOKEN 臨時關卡已淘汰，見 §4）**
    login/                    登入頁（implementation plan 第 9 項階段 A）：內部密語
                              表單＋Google 登入連結，兩條路都能選，已上線並經正式
                              環境驗證。支援 `?next=` 登入後導回原本要去的頁面
                              （後台整站登入保護追加的功能，見 §4）
    identity-relay/           跨子網域身分轉發頁（implementation plan 第 9 項
                              階段 A 建立、階段 B 接上真實授權判斷，給
                              skhpsv2 之類的其他 *.jonaminz.com 專案未來用）：
                              極簡、不走 entry-core.js bootstrap，讀自己
                              （www.jonaminz.com）的 localStorage token＋自己
                              URL 的 projectId query string，呼叫
                              getGrantedIdentity（不是 getCurrentIdentity，
                              階段 B 起改用會做授權判斷的這支），postMessage
                              {granted, identity} 給嵌入它的父頁面（SDK Kernel）
  sdk/
    jonaminz-entry.js          常青 SDK loader（implementation plan 第 5 項，S37）：
                              向 getSdkVersion 問版本指標 → 動態載入對應的
                              sdk-<hash>.js，並把 data-contract／是否來自快取／
                              自己的 release hash 轉貼給 Kernel（第 6 項新增，
                              S18 銜接缺口，見 §4）。極簡、try/catch 全包
    sdk-src/sdk.js             SDK Kernel 真實邏輯（implementation plan 第 6、
                              7、9 項階段 B）：contract discovery、推送合約、查
                              Effective Settings、settle S21 官方 snippet 的
                              ready Promise、effectiveCss==="tokens" 時套用
                              CSS custom properties（收編 theme-runtime.js，
                              舊名＋--jz-* 新名並存）。**第一個正式發布的
                              service**：window.Jonaminz.identity.currentUser()
                              （identity.currentUser@1，S30-33，見 §4）
    generate-sdk-release.mjs   build-time 腳本：讀 sdk-src/sdk.js、算 sha256 前 12 碼、
                              產生 immutable 的 sdk-<hash>.js（不自動改 sdk-versions.json，
                              要不要發版是人的決定）
    sdk-<hash>.js               上面腳本的產出，immutable，內容一改檔名就要換
    sdk-empty.js                kill-switch 目標，內容真的什麼都不做
  backend/
    README.md                 後端部署說明
    cloudflare-worker/worker.js   唯一後端入口 POST /api/action，11 個 action（見 §5）
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

- **Platform Service 化的視覺方向（2026-07-13，roadmap ⑦之後追加，非
  編號項目）：完成並已驗證，尚待 push。** 完整細節見
  `AI_CONTEXT/CHANGELOG.md` 同日「Platform Service 化的視覺方向」條目，
  這裡只列結論：
  - Contract schema 新增 `app.visualIdentity` 自報欄位（非 breaking，
    跟 `description`/`icon` 同一類自我描述欄位），ajv validator 已重新
    產生。
  - `pages/admin/design/`（新頁面）讀真實 `listPendingContracts` 的
    `previousApproved`（Worker 權威計算出的「現在真的生效中」的合約，
    不是猜某筆 row 的 `status`）展示各專案宣告的視覺方向，含 jonaminz
    自己（唯一寫死的一筆，因為平台本身不對自己送 Contract）。
  - jonaminz-movies 的 `jonaminz.contract.json` 加上 `visualIdentity`
    （酒紅 Editorial），過程中用 `curl -d` shell 字串內插把中文字送壞過
    一次（snapshot #4，亂碼留在歷史不刪），改用 `curl --data-binary`
    重新提交乾淨版本，snapshot #5 現在是 active。
  - jonaminz 全站套用「亞麻米 Flax & Ink」（reservoir tokens 全面改暖
    色調＋新增 `--font-display` serif）。**修好三個真的會讓新配色顯示
    不完整的問題**：頁面 CSS 裡寫死的舊靛紫 rgba、`jonaminz-loading.css`
    的 bootstrap fallback 值忘了同步、以及最關鍵的一個——**Supabase
    `theme_css_rules` 表裡有一份 2026-07-12 的舊配色快照疊在 tokens
    之上把新值整個蓋掉**（已刪除該快照裡 4 筆衝突的舊資料）。
  - `pages/admin/contracts/` 改成按 `(projectId, environment)` 分組、
    只攤開目前 active 版本、其餘歷史摺進原生 `<details>`，過程中人工
    覆核抓到並修好一個真實 bug（`<details>` 展開狀態原本會被每次
    `render()` 重置）。
  - **驗證**：Playwright 對全站 8 個頁面截圖＋console 零錯誤確認；直接
    讀 `getComputedStyle` 確認 token 實際生效值；針對 `<details>` bug
    修復另外寫專項互動測試確認修好。
  - **遺留**：使用者提出視覺方向未來應該存進 Theme 系統（Supabase，可
    即時切換不用重新部署）而不是寫死進 reservoir tokens，已記錄
    `EXPERIMENTS.md` #9，未拍板。
- **前端品質重建計畫階段③：後台首頁 Dashboard 化（2026-07-13，
  `docs/roadmap-202607.md` 順序⑦）：完成、已驗證並已 push（14051c0）。**
  `pages/admin/` 從路線佔位卡片升級成 dashboard：登入身分徽章（沿用
  `.jonaminz-identity-badge` 視覺，jonathan/minz 各自配色）、pending
  Contract 數量（跟 `pages/admin/contracts/` 同一套
  `status==="pending"` 篩選邏輯，兩邊數字保證一致，不是各自算一套）、
  外部專案回報清單（既有功能不變）、Theme/Contracts 快速入口。全程
  沒有動 `worker.js`，純前端聚合既有的 `listPendingContracts`／
  `listExternalAppRegistrations` 兩個既有 action。
  - **跟原計畫的差異**：pending 數量原計畫是「徽章」，實作時改成卡片
    描述文字（如「2 筆待審核」／「無待審」），才能自然滿足「0 筆顯示
    無待審」跟「Worker 打不通顯示錯誤文字」這兩條驗收——純數字徽章
    沒有空間放這些文字狀態。
  - **驗證**：Playwright 三情境——①正常路徑（mock 登入 jonathan／2 筆
    pending／1 筆外部專案，畫面全部正確、零 console 錯誤）；②0 筆
    pending＋minz 身分（正確顯示「無待審」跟「Minz 你好」）；③Worker
    全斷線（`route.abort`），pending／registrations 兩區塊各自顯示
    「XXX讀取失敗：Failed to fetch」，gate 仍在 ~400ms 正常放行，沒有
    任何未捕捉例外。桌機/手機截圖確認排版正常。
  - **待辦總表①-⑦全部完成**，roadmap 只剩順序⑧手機 App 包裝。
- **文件真實性盤點與同步（2026-07-12，已 commit+push，25b341e）：** 使用者
  交辦一次完整審計，用實際程式碼／schema／設定檔逐項核對登入/Session/
  Contract/外部 App 邊界等主題，不信任文件自稱「已完成」。新增
  `AI_CONTEXT/FACTS.md`／`DECISIONS.md`／`CURRENT_STATE.md`／
  `KNOWN_ISSUES.md`／`EXPERIMENTS.md`／`SESSION_LOG.md`／
  `CHECKPOINTS.md`／`DOCUMENT_STATUS.md` 八份新文件，修正 13 份既有
  文件的過期說法（`pages/README.md` 仍講已淘汰的 `JONAMINZ_ADMIN_TOKEN`、
  根目錄 `README.md` 檔案結構圖過舊、10 份 Platform Integration 規劃期
  文件補上 Historical/Superseded 標記指向 Frozen 規格）。全程只碰 .md
  檔案，零程式碼異動（已用 `git diff --name-only` 驗證過副檔名清單只有
  `.md`）。**盤點過程意外挖到一個真的功能缺口**（不是文件錯誤，是程式碼
  本身的行為缺口）：Google OAuth 登入沒有保留 `?next=`，永遠導回網站
  根目錄，只有內部密語登入才有完整的登入後導回原頁功能——已記錄進
  `KNOWN_ISSUES.md`，同一批工作接著修掉，見下一條。
- **Google OAuth `next` 缺口修復（2026-07-12，已部署並直連 DB 驗證）：**
  上面文件盤點挖到的缺口。根因：`return_origin`（哪個網站）跟 `next`
  （網站裡的哪一頁）是兩個獨立參數，Google OAuth 走 Worker 302 中轉，
  `oauth_states` 表原本只存了 `return_origin`，沒有把 `next` 一起帶著走，
  導致 Google 登入完永遠回網站根目錄，跟內部密語登入（純前端 POST，
  登入完直接用 JS 導去 `next`）行為不一致。修法：
  `backend/supabase/auth_schema.sql` 新增 `oauth_states.next` 欄位
  （已直連套用到 `jonaminz-db`，套用前查過 `information_schema`）；
  `worker.js` 新增 `resolveOauthReturnNext()`（跟既有
  `resolveOauthReturnOrigin()` 同一套白名單邏輯：只接受同源相對路徑，
  開頭單一個 `/`，不含 `://` 也不是 `//` 開頭），`handleGoogleStart`
  驗證後存進 DB，`handleGoogleCallback` 讀出來重新驗證一次再拼進最終
  redirect 網址；`pages/login/assets/js/app.js` 的 `googleStartUrl()`
  帶上 `&next=`（複用既有 `getNextUrl()` 的同一套 sanitize 邏輯，函式
  宣告 hoist，呼叫順序跟定義順序無關）。**驗證**：node 腳本窮舉 10 種
  edge case（含 `//evil.com`、`javascript://`、`https://evil.com` 等
  開放式重導向嘗試）確認 `resolveOauthReturnNext()` 全部正確擋下；
  `wrangler deploy` 前用 esbuild 打包＋`node --check` 確認乾淨；部署後
  curl 打 `/auth/google/start?origin=...&next=/pages/admin/theme/`
  確認正確轉址去 Google；直連 DB 查最新 `oauth_states` 列確認
  `next` 欄位真的存成 `/pages/admin/theme/`。Google 同意畫面那段一樣
  需要真人瀏覽器互動，機制本身已驗證正確，**還需要使用者自己實際點一次
  完整登入流程確認最終導回頁面正確**（跟階段 A 當初 Google OAuth 上線
  時的驗證缺口是同一種、需要真人操作的部分）。
- **前端品質重建計畫階段②：Jonathan/Minz 門戶頁（2026-07-12，
  `docs/roadmap-202607.md` 順序⑥）：完成並已驗證，尚待 push。** 見
  `docs/frontend-quality-plan-202607.md` 階段②同日更新的完整細節。
  新增 `pages/jonathan/`（真實內容：石益昇，整形外科醫師，簡介文字＋
  SKHPS 專案卡片）、`pages/minz/`（骨架佔位頁，內容留白等本人提供）。
  首頁兩個 name-link 從 `#jonathan`/`#minz` 死錨點改成真實路徑，
  `pages/admin/` 移除 SKHPS 卡片（原本在後台，現在搬到 Jonathan 頁，
  後台是管理入口不該混業務連結）。
  - **跟原計畫的差異（使用者當場糾正）**：原計畫 Jonathan 專案卡片要放
    SKHPS **跟 jonaminz-movies** 兩張，實作時使用者指出 jonaminz-movies
    是 Jonathan／Minz 兩人共用的後台功能，不是 Jonathan 個人專案，
    已從卡片移除，不歸類在這裡（真正該放哪裡，之後再決定）。
  - **SKHPS 連結環境感知（使用者測試時追加，原計畫沒有）**：本機測試
    時 SKHPS 連結要連本機的 `/skhpsv2/`，不是永遠連正式站
    `https://skhps.jonaminz.com`。第一版曾考慮寫死一個 port，使用者
    立刻指出這跟 OAuth `origin` 白名單當初「不要寫死單一 port」的教訓
    重複——改成 `pages/jonathan/assets/js/app.js` 的
    `LOOPBACK_HOSTNAME_PATTERN` 判斷 `window.location.hostname`
    是不是 loopback（`localhost`／`127.0.0.1`，任何 port），是的話用
    `window.location.origin + "/skhpsv2/"`（同 origin 下的相對路徑，
    自動跟著目前的 port 走），不是的話才用正式站網址。跟 worker.js 的
    `OAUTH_LOOPBACK_RETURN_ORIGIN_PATTERN` 判斷精神一致，但這裡更單純：
    依據是頁面自己的 `window.location`，不是外部輸入，不需要另外驗證
    protocol 或防偽造。
  - **素材處理**：使用者提供 Jonathan 形象照原始檔（PNG，3840×5760，
    24MB），用 `sharp-cli` 壓成 `assets/img/jonathan-portrait.jpg`
    （JPEG，1000×1500，quality 78，80KB）。同一批也把首頁
    `assets/img/home-hero.jpg` 換成使用者提供的高解析度原始檔重壓版本
    （原本的來源檔畫質較差；新來源 2200×1467、quality 70、408KB，
    取代舊版 1800×1200、quality 62、267KB），兩張原始檔用完即刪，
    repo 裡只留最終壓縮版本。
  - **驗證**：Playwright 對 jonathan/minz/admin/home 四頁跑桌機
    （1280px）與手機（375px）截圖，確認零 console error、首頁連結指向
    真實路徑、admin 頁不再有 SKHPS 卡片、jonathan 頁卡片只有 SKHPS
    （沒有 jonaminz-movies）；SKHPS 連結環境感知邏輯額外用 node 腳本
    窮舉 6 種 hostname 組合（含 `127.0.0.1.evil.com` 這種試圖矇混的
    變形網址）＋實際跑在本機 dev server 上驗證 href 屬性正確算出
    `http://127.0.0.1:<實際 port>/skhpsv2/`。
  - **這次沒做**：Minz 簡介文字與照片（尚未提供，維持骨架佔位）；
    jonaminz-movies 真正該放在哪個入口（使用者裁決之後再說）。
- **Runtime 診斷系統拉高層級（2026-07-12，`docs/roadmap-202607.md`
  順序④）：完成並已驗證，尚待 push。** 新檔 `assets/js/runtime.js`：
  `window.JonaminzRuntime`（`log()`／`registerModule(name, meta)`／
  `setModuleStatus(name, status, detail)`／`getState()`／
  `getModuleState(name)`／`subscribe(handler)`）。**跟 SKHPS 版本的關鍵
  差異、也是這次重新設計的重點**：SKHPS 把子系統名稱
  （config/backend/css/externalApps/loadingGate）寫死在 API 裡
  （`setConfig()`／`setBackend()`／`setCssRuntime()`…），沒辦法讓不同
  專案登記自己的模組；jonaminz 版本改成完全可插拔，任何呼叫端用同一組
  `registerModule`/`setModuleStatus` 登記自己的模組名稱，核心本身不
  認得任何特定專案的子系統名字。log 用環狀緩衝只留最近 200 筆，避免
  長駐分頁記憶體無限成長。**刻意沒做**：SKHPS 版本另外有一整套 footer
  五盞燈號＋可展開診斷面板的 UI（將近 2000 行）——這次只把資料層／
  事件蓋好，UI 要不要做、做成什麼樣子留給真的有需求時再設計，避免
  猜一個沒人用過的介面。
  - `entry-core.js` 登記 `loading-gate` 模組（跟 version.js 同批載入、
    同樣不帶版本 buster，理由跟 version.js 一致：核心啟動檔），把
    gate 生命週期關鍵時間點（init 開始／version.js 載完／config 解析
    完／css ready／shell ready／每個 task done or fail／all-ready／
    8 秒逾時保底／init 失敗）發成 log、更新模組狀態
    （`ok`/`warn`/`error`）。`runtimeLog()`/`runtimeSetStatus()` 兩個
    helper 都先檢查 `window.JonaminzRuntime` 存不存在才呼叫——
    runtime.js 是 best-effort 診斷，它自己載入失敗或還沒載完，不能
    反過來卡住或弄壞真正的 loading gate 邏輯。`checkAllReady()` 用
    `!allReady` 防止逾時保底已經放行過 gate 之後，事後補到的 task
    完成事件把 timeout 寫的 `warn` 狀態覆蓋回 `ok`——那次放行本來就
    不是正常結束，狀態要保留逾時紀錄。
  - **驗證**：本機 Playwright 兩條路徑——①正常路徑：全部 7 筆 log
    依序出現（init 開始→version 載完→config 解析完→shell ready→css
    ready→task done→all-ready），最終 `loading-gate` 模組狀態
    `ok`，console 零錯誤，布幕正常掀幕。②逾時路徑：故意讓
    `header.js` 卡 9 秒（超過 8 秒 `GATE_TIMEOUT_MS`），確認在
    ~8.45 秒放行（在 7.5~12 秒的合理逾時窗內）、模組狀態正確標成
    `warn`（不是被之後補到的 task 蓋掉），console 零錯誤。過程中第一次
    用 `page.route()` 攔截時漏算 cache-buster query string（glob
    pattern `**/assets/js/header.js` 沒配到帶 `?v=...` 的實際請求
    URL），改成 `**/assets/js/header.js*` 才真的攔到——跟上次驗證讀條
    演算法時踩過的 `waitUntil` 坑同一類「Playwright 測試方法本身要
    先驗證有攔對」的教訓。
  - **這次沒做**：skhpsv2 自己遷移過去用這個版本（待另開新 prompt
    交辦，skhpsv2 目前是 Codex 在處理）；除了 `loading-gate` 之外，
    目前沒有其他模組登記（例如 theme／shell／layout-metrics 各自的
    狀態）——先驗證這一個模組的機制正確，之後真的需要更細的診斷粒度
    再加，不預先猜。
- **RWD/viewport 量測層拉高層級（2026-07-12，`docs/roadmap-202607.md`
  順序③）：完成並已上線。** 新增 `assets/js/layout-metrics.js`（搬自
  SKHPSV2 同名檔案，重寫成 jonaminz 版本：命名空間改
  `window.JonaminzLayoutMetrics`、HTML 屬性字首改
  `data-jonaminz-*`、header/footer 選擇器改認
  `[data-jonaminz-header]`／`[data-jonaminz-footer]`、config 來源改讀
  `window.JONAMINZ_SITE_CONFIG.layout.rwd`）。補上 `config.json` 裡
  `layout.rwd.groups` 早就宣告、但一直沒有 JS 真的去讀、算出「現在是
  哪個 RWD group」的洞。
  - 量測：`layoutWidth`/`layoutHeight`、`visualViewport`（含鍵盤高度
    感知 `keyboardGap`）、`orientation`、RWD mode（預設斷點
    480/720/960/1200，對到 phone-compact/phone/tablet/desktop/wide
    五種，跟 config.json 的五個 mode 命名對得上）、RWD group
    （small/large，讀 config.json 的 groups 宣告）、header/footer
    邊界＋可用內容區高度。只量測、寫 `data-jonaminz-*` 屬性、發
    CustomEvent（`jonaminz-layout-metrics-updated`）＋
    `subscribe()` API，不主動改畫面（跟原版同一個水庫法則）。
    `resize`/`orientationchange`/`visualViewport` 事件＋
    `ResizeObserver`（監看 body/header/footer）＋`MutationObserver`
    （監看 class/style 變化，因為 header/footer 是非同步載入，量測完
    當下可能還沒真的渲染出高度）都會觸發重算。
  - `entry-core.js` 的 shell 平行載入群組（跟 header/footer/
    registry-loader 同一批）新增 `layout-metrics.js`，純廣播不改
    畫面，不影響現有載入順序或依賴關係。
  - **驗證**：Playwright 確認桌機 1280px 判定 `wide`/`large`、手機
    375px 判定 `phone-compact`/`small`，且 `configSource` 真的顯示
    `JONAMINZ_SITE_CONFIG.layout.rwd`（不是預設值，證明真的讀到
    config.json）；resize 觸發後屬性即時更新（`large`→`small`）；
    首頁（沒有共用 header/footer 元素的簽名式版型）正確回報
    `header.exists`/`footer.exists` 為 `false`，不是誤判成 bug；
    全站 5 頁 regression 零錯誤，`window.JonaminzLayoutMetrics` 都
    正確掛上。
  - **這次沒做（刻意，YAGNI）**：目前 jonaminz 沒有任何頁面/CSS 真的
    訂閱這個訊號（2026-07-13 複查仍然成立）——這次只是把機制蓋好、
    開始廣播，跟 identity capability 當初「機制先上線、沒有專案被
    授權」同樣的做法。等 Jonathan/Minz 門戶頁深度真的增加，或麵包屑
    （順序⑤）需要 header 高度時才會有真正的消費者。使用者原本提過的
    「手機自動導去內部密語登入」設計考量**已作廢**（2026-07-13）：
    當初是想繞開手機用區網 IP 測試時 Google OAuth 白名單不認 LAN IP
    的問題，現在改用 `jonaminz-mobile-app`（Capacitor＋Custom
    Tabs＋deep link）解決，跟 RWD 判斷無關，見
    `docs/roadmap-202607.md` 順序③段落同日更新。
    skhpsv2 自己遷移過去用 jonaminz 提供的版本，待另開新 prompt。
- **讀條演算法拉高層級（2026-07-12，`docs/roadmap-202607.md` 順序②）：
  完成並已上線。** 把 SKHPSV2 `loading-gate.js` 的「Runway Chase」平滑
  讀條演算法搬進 jonaminz（重寫，不是複製檔案），取代 `entry-core.js`
  原本「里程碑硬寫死百分比、跳格前進」的陽春寫法。
  - `assets/js/entry-core.js`：`setProgress(percent)` 改成
    `setProgressTarget(percent)`——只設定「下一個要追到的目標」，
    target 只會前進不會後退；實際顯示的 `current` 值由新的
    ticker（`requestAnimationFrame` + 16ms `setInterval`）每幀平滑
    追趕，速度＝距離÷剩餘時間預算，越接近預算終點追得越快，不會有
    「卡住不動」的觀感。all-ready 後不是立刻掀幕，是先讓 `current`
    衝刺 260ms 補滿到 100（最多再等 520ms 保底），衝刺完才真的呼叫
    `hideCurtainNow()` 拿掉 loading class，讓使用者看到讀條真的走完。
  - **順便補上一個舊版就有的缺口**：新增 `GATE_TIMEOUT_MS`（8 秒）
    逾時保底——舊版完全沒有逾時機制，如果某個資源真的卡住
    （`onload`/`onerror` 都不觸發），布幕會永遠不消失。這不是本次
    額外加的新功能，是 runway chase 演算法本身就需要一個時間預算才有
    意義，8 秒逾時只是這個預算的另一半，順手補齊。
  - **刻意簡化、沒有搬的部分**：SKHPS 版本逾時/失敗時有「WARN
    hold」——停在目前進度 1 秒，搭配 footer 五盞診斷燈號讓使用者知道
    「這不是正常結束」。jonaminz 沒有對應的診斷 UI，單純停頓沒有燈號
    說明只會像卡住，這次逾時/失敗一樣衝刺到 100 掀幕，不做 WARN hold
    停頓。
  - **驗證**：Playwright 三項測試——①人工延遲部分資源，採樣讀條數值
    在多個時間點確認是平滑遞增（0.1→0.9→2→3→4.1→11→48.6→85.1→100）
    不是跳格；②延遲 9 秒才回應其中一個資源（比 8 秒逾時長），確認布幕
    在約 8.3 秒（8 秒逾時＋短暫衝刺時間）就自動掀幕，不會傻等到 9 秒
    那個真的回應才放行；③全站 5 頁 regression 確認零錯誤、都能正常
    走到 progress 100。過程中第一版逾時測試方法本身有 bug
    （`page.goto()` 預設等 `load` 事件，被動態插入的 `<link>` 卡住，
    測到的其實是 `goto()` 自己等多久，不是 `entry-core.js` 的邏輯）
    ——改用 `waitUntil:"commit"` 才測到真實行為，這個教訓對之後任何
    要模擬「資源卡住」的 Playwright 測試都適用。
  - **這次沒做**：skhpsv2 自己遷移過去用 jonaminz 提供的版本（待另開
    新 prompt 交辦，skhpsv2 目前是 Codex 在處理）。
- **Google OAuth 本機導頁修復（2026-07-12，`docs/roadmap-202607.md` 順序①）：
  完成並已部署。** 根因：`handleGoogleCallback` 最後導回的網址原本寫死
  `https://www.jonaminz.com/`，不管從哪裡發起登入都會被導去正式站，
  `localhost:5500` 測不了 Google OAuth 這條路（內部密語登入是純 POST，
  不受影響）。修法：登入頁 `googleStartUrl()` 把
  `window.location.origin` 帶進 `/auth/google/start?origin=...`；
  `handleGoogleStart` 用新增的 `ALLOWED_OAUTH_RETURN_ORIGINS` 白名單
  （`https://www.jonaminz.com`／`http://localhost:5500`）驗證後存進
  `oauth_states` 表新增的 `return_origin` 欄位；`handleGoogleCallback`
  改用查出來的 `return_origin` 導回，不再寫死。**刻意不信任呼叫端傳來
  的 origin 字串直接拿去導頁**——只信白名單，不在白名單內一律 fallback
  回正式站，避免變成開放式重導向（任何人把登入 session token 導到自己
  網域的漏洞，跟登入頁 `?next=` 參數當初的防護同一個精神）。
  DB schema：`backend/supabase/auth_schema.sql` 新增
  `return_origin text` 欄位（`ALTER TABLE ADD COLUMN IF NOT EXISTS`，
  已直連套用到 jonaminz-db，套用前後都查過 `information_schema` 確認
  連對專案、欄位真的加上）。**驗證**：`wrangler deploy` 後直接查
  `oauth_states` 最新幾筆資料——`origin=localhost:5500` 真的存成
  `http://localhost:5500`；`origin=https://evil.example.com`（模擬
  攻擊）被擋下、`return_origin` 變成 fallback 值不是攻擊者塞的值；
  沒帶 origin 也正確 fallback。Google 同意畫面那段需要真人瀏覽器互動，
  沒有自動化跑完整條路，**還需要你自己在本機實際測一次登入到底能不能
  正常導回 localhost**（Google Cloud Console 的 redirect URI 只登記了
  Worker 自己的網域 `jonaminz-backend.../auth/google/callback`，這個
  不用改，改的是 callback 完成後 Worker 自己 302 去哪裡，跟 Google 端
  設定無關）。**使用者實測後續追加修正（同日）**：第一版白名單只放了
  `http://localhost:5500`，使用者實際操作時開的是
  `http://127.0.0.1:5500`——瀏覽器把這兩個當成不同 origin（主機名稱
  不同即使指向同一台機器），沒對到白名單就 fallback 回正式站，症狀
  跟原本一樣。已補上 `http://127.0.0.1:5500` 進白名單並重新部署，curl
  確認能正常導去 Google。**教訓記錄**：本機開發網址至少有
  `localhost`／`127.0.0.1` 兩種常見寫法，白名單類的網域比對要兩個都
  放，不能只顧一種。**再追加一版（同日）**：使用者指出列舉單一 port
  永遠補不完（本機工具換 port 就要再補一次），改成正規式比對整個
  loopback（`localhost`／`127.0.0.1`，任何 port，只認 `http`）——
  `OAUTH_LOOPBACK_RETURN_ORIGIN_PATTERN`。**這樣放寬沒有安全疑慮**：
  loopback 網址不管誰塞在連結裡，瀏覽器永遠只會解析成使用者自己這台
  機器，外部攻擊者無法讓別人的瀏覽器把它導去攻擊者控制的伺服器，跟
  精確比對單一網域要防的「導去別人網域」完全是不同的威脅模型。已用
  幾個邊界案例（含 `127.0.0.1.evil.com`、`127.0.0.1:5500.evil.com`
  這種試圖用正規式漏洞矇混的變形網址）跑過 node 腳本確認 regex 的
  `^...$` 錨點正確擋下，curl 對 3 個不同 port 都驗證過能正常導去
  Google。**使用者接著問了另一個相關但沒有實作的問題**：手機用區網
  IP（例如 `192.168.1.101:5500`）測本機開發時要怎麼辦？區網 IP 跟
  loopback 不是同一個安全等級（同一個 WiFi 網路上的其他裝置理論上
  可能架設同 IP:port 的東西聽），使用者裁決**先不處理**，等順序③
  RWD/裝置辨識系統做出來後，考慮改成「偵測到手機就自動導去內部密語
  登入」繞開這個問題（內部密語登入是純 POST，沒有導頁、沒有這個風險）
  ——現在手機要測本機開發，直接用內部密語登入即可，Google OAuth 這
  條路本機測試先只用 loopback（桌機瀏覽器）或正式環境。
- **前端品質重建計畫階段①（效能重建＋全站布幕）：完成並已上線
  （2026-07-12，`docs/frontend-quality-plan-202607.md`）。** 診斷出的
  最大元凶：舊版 5 個頁面的 bootstrap script 都用 `String(Date.now())`
  當全站資源的 cache buster，每次載入都是新值，瀏覽器快取命中率恆為
  0%。修法：`assets/js/entry-core.js`／`assets/css/jonaminz-loading.css`
  這兩個「bootstrap 前置檔」本身改成靜態 `<link>`/`<script>` 標籤、
  完全不帶版號（吃 GitHub Pages 原生快取，最壞下次部署後 10 分鐘內
  看到舊版，可接受）；`version.js` 本身也不帶版號；version.js 讀到之後，
  其餘所有資源（config.json、reservoir/page CSS、theme-runtime.js、
  header/footer/registry-loader、頁面 app.js）改用 `window.
  JONAMINZ_APP_VERSION.version` 當 buster——同版本內重複造訪全部命中
  快取，只有 push 前 bump 版本號（既有規則）才會讓資源網址改變。
  `window.JONAMINZ_ENTRY_VERSION` 全域變數保留（給 `registry-loader.js`
  讀，那個檔案沒有改），但指派成同一個版本字串而不是 `Date.now()`。
  同時把 `entry-core.js` 的載入鏈從全序列改成並行：reservoir CSS
  一次全送出（DOM append 順序仍同步保留，cascade 順序不受影響）、
  config.json 抓取與 reservoir CSS／theme-runtime.js 預載三者同時開始；
  config 解析完後 page CSS 與 header/footer/registry-loader 三支 shell
  script 同時開始（header.js 的 render() 依賴 `window.
  JONAMINZ_SITE_CONFIG`，必須等 config 解析完才能開始，這條依賴保留
  未變）。Theme 首次造訪不再無上限等 Worker/Supabase（原本最長 8 秒）
  ——`loadThemeWithCap(800)` 跟 800ms 賽跑，逾時就先放行 gate，
  `theme-runtime.js` 自己的 promise 繼續在背景跑，資料到了照樣呼叫
  `applyCss()` 補套上去（`theme-runtime.js` 本身完全沒改）。首頁
  `assets/img/home-hero.jpg` 用 `sharp-cli` 壓縮（581KB→267KB，
  quality 62、寬度上限 1800px，人物/場景細節目視確認沒有明顯劣化），
  並加 `<link rel="preload" as="image">`。
  **布幕重寫**：`jonaminz-loading.css` 從只有 12 行的
  `body{visibility:hidden}` 死白遮罩，改成全站共用的「標題＋進度條」
  布幕（`html.jonaminz-loading` 的 `::before`/`::after` 兩個
  pseudo-element：前者顯示 `attr(data-loading-title)` 並帶脈動動畫，
  後者用 hard-stop `linear-gradient` 同時畫出進度條的已完成／軌道兩段，
  不用額外的第三個元素，也不受 `body{visibility:hidden}` 的繼承問題
  影響——因為兩者都掛在 `html` 上，不在 `body` 底下）。**跟 skhpsv2 的
  差異（刻意簡化）**：skhpsv2 對 header/main/footer 做逐階段分開淡入，
  前提是每頁固定有 `[data-skhps-header]`/`main`/`[data-skhps-footer]`
  結構；jonaminz 首頁是簽名式導覽版型、沒有這些共用元素（見
  `index.html` 開頭註解），改成「整個 `body` 用同一塊布幕蓋住，
  all-ready 才一次揭幕」，不分階段掀布——邏輯更簡單、對所有頁面型態
  都成立。進度百分比由 `entry-core.js` 在里程碑（version 載完 15%、
  config 解完 30%、CSS chain 完成 55%→65%、shell chain 完成 85%、
  all-ready 100%）寫入 CSS 變數 `--jonaminz-loading-progress`。
  配色沿用 `--color-bg-dark`/`--color-text-dark`/`--color-primary`
  （跟首頁深色相片版型同色系，避免亮→暗閃爍；admin/login 系頁面是
  淺色版，布幕→揭幕會有一次短暫深→淺切換，可接受）。
  **驗證**：本機 Playwright 對 5 頁（home/admin/admin-theme/
  admin-contracts/login）逐一截圖確認布幕出現＋正確揭幕＋zero console
  錯誤（含 admin 系頁面未登入時正確導去 `/pages/login/?next=...`、
  導頁後布幕正確重新出現一輪）；同一個 browser context 對首頁連續
  載入兩次比對請求網址，確認完全一致（證明快取修復生效，不再每次
  產生新版號）；確認 `<link rel="stylesheet">` 的 DOM 順序（reservoir
  01→06→page CSS）在並行載入前後不變，cascade 沒有被打亂。
  **這次沒做**：Jonathan/Minz 個人門戶頁（階段②）、後台首頁 Dashboard
  化（階段③），見 `docs/frontend-quality-plan-202607.md` 對應段落。
- **首頁/後台三個視覺缺陷修復（2026-07-12，階段①收尾後追加）**：使用者
  實際看過網站後發現三個問題，當場修掉。
  1. 首頁右上角同時有動態插入的「登入」連結（`header.js`
     `mount()`，網址 `/pages/login/`）與寫死在 `index.html` 的
     「Login」按鈕（網址 `/pages/admin/`，未登入會再被 `requireLogin()`
     轉一手才到登入頁）——兩個功能重疊、視覺重複。使用者裁決只留動態
     那個（登入後自動變「OO你好＋登出」），`index.html` 刪掉靜態
     Login `<a>`，`page-home.css` 同步刪掉變成孤兒規則的
     `.nav-links a.login`。
  2. 後台/Theme/Contracts/登入頁共用 header 的品牌字（「Jonaminz」）
     原本是 `<span>`，點了沒反應，這些巢狀頁面沒有其他回首頁的路
     （只能靠瀏覽器上一頁）。`assets/js/header.js` 的 `render()`
     改成建立 `<a href="/">`（既有全域 `a{color:inherit;
     text-decoration:none}` reset 已經處理好樣式，不用另外加 CSS）。
  3. 首頁封面照片（橫向構圖，新娘在左新郎在右）在手機窄螢幕下完全
     沒辦法 RWD——`background-size:cover` 在極窄長的 viewport 上只
     露出原圖寬度的一小段（例如 375px 寬時只看得到約 25% 的圖片
     寬度）。**這一版的修法（改 `background-position`）後來被下面
     「首頁改版」整個取代**：background-position 調整只能治標（換一
     個裁切點還是會裁掉一個人），根本問題是「全螢幕背景圖」這個設計
     本身跟窄長 viewport 不相容，見下一條的徹底解法。
  本機 Playwright 驗證：首頁桌機／375px／768px 三種寬度截圖確認裁切
  結果與登入按鈕只剩一個；mock 登入後點擊後台 header 品牌字實際導航
  到 `/`，確認連結真的生效（不是只有 `href` 屬性對但沒綁事件）。
- **首頁改版：全螢幕背景圖→固定比例小相片框（2026-07-12，取代上面
  第 3 點的治標修法）**：使用者看過調整裁切點後的效果仍不滿意（一個
  視窗寬度下兩人都只露出一小角），直接指示改變設計方向——「縮小顯示
  在標題上面不用堅持全螢幕」。同時要求拿掉右上角跟 Jonathan/Minz
  重複的導覽按鈕（下面 signature 區已經有 name-link 可以點）、拿掉
  沒有實際功能的「共用入口」按鈕、拿掉 name-link 的「PIECE 01/02」
  小標籤（只留 Minz/Jonathan 名字本身）。
  - `index.html`：`.photo` 全螢幕背景 div 整個拿掉，改成
    `<main class="hero">` 內含 `.hero-photo`（`<img>` 而非 CSS
    background）＋ `<h1>jonaminz</h1>` ＋ tagline，三者都在正常文件
    流裡由上到下排列，不再是絕對定位疊在照片上。`.signature` 現在
    只剩 Minz／Jonathan 兩個 `<a>`（拿掉 `.center` 那個放標題跟
    「共用入口」的欄位，也拿掉 `<small>piece 01/02</small>`）。
  - `page-home.css` 整份重寫：`.page` 從 `height:100dvh` +
    `overflow:hidden` + 絕對定位疊層，改成 `min-height:100dvh` 的
    正常 flex 直向排列（nav → hero → line → signature），拿掉
    `.photo::after` 的暗化漸層遮罩（照片不再需要疊文字，不用暗化）。
    `.hero-photo` 用 `width:min(560px,88vw)` ＋ `aspect-ratio:16/9`
    固定框，`img { object-fit:cover }`——**這才是根本解法**：裁切
    比例是相對值、不隨容器實際寬度改變，桌機跟手機看到的裁切「比例」
    完全一樣，不會再有窄螢幕特別嚴重裁切的問題，兩人在任何寬度都
    完整入鏡，不用再為不同斷點手動調 `background-position`。
  - **驗證**：Playwright 四種寬度（桌機 1280px／平板 768px／手機
    375px／窄長視窗 760×1200，最後這個是使用者截圖回報問題時的實際
    視窗尺寸）截圖確認兩人都完整入鏡、登入連結只剩一個、零 JS 錯誤
    （唯一的 console 錯誤是瀏覽器自動要 `/favicon.ico` 的 404，
    jonaminz 本來就沒有 favicon 檔案，是既有小問題，跟這次改動
    無關，這次沒有順手修）。
  - **這次沒做**：真的替換封面照片本身（使用者提過的另一個選項，
    這次用「縮小＋固定比例」解決，沒有新照片可換）；favicon 缺失
    （順手發現但不在範圍內）。
  - **後續兩個小修正（同日）**：①使用者看過覺得桌機下照片相對整個
    畫面太小，`.hero-photo` 從 `width:min(560px,88vw)` 放大成
    `width:min(1100px,78vw)`，大螢幕下更有存在感，固定 aspect-ratio
    機制不受影響。②**真的漏洞**：拿掉「共用入口」按鈕後，登入態下
    首頁完全沒有路徑回後台了（原本共用入口是唯一的路）。
    `header.js` 的 `buildIdentityBox()` 新增 `options.showAdminLink`
    （預設不開，只有首頁的 `mountIdentity()` 呼叫時傳 `true`，避免
    在已經身處後台的頁面也顯示多餘的「回後台」），登入後顯示
    「OO你好／後台／登出」三個元素，「後台」連去 `/pages/admin/`。
    mock 登入態驗證過連結 `href` 跟顯示順序都正確。
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
  `/pages/admin/contracts/` 後台登入後可核准／否決／改判 pending
  Contract（2026-07-12 起改成要求登入 session，原本的 Worker secret
  `JONAMINZ_ADMIN_TOKEN` 已淘汰，見下方「後台整站登入保護」），
  Postgres function 原子處理狀態
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
    **後續更新（2026-07-12）**：上面這套 `JONAMINZ_ADMIN_TOKEN`／操作人
    按鈕機制已淘汰，改成整站登入保護的一部分，見下方「後台整站登入
    保護」條目——這段歷史敘述保留原樣，反映的是 2026-07-11 當時的
    設計，不是現在的實作。
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
    完成，已在正式環境端到端驗證通過（2026-07-12）。implementation-plan.md
    原始第 9 項需求（主站登入）到此全部完成；階段 B/C 是討論中額外
    擴大的範圍，見下方。**
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
    對外的穩定介面是 `window.Jonaminz.identity.currentUser()`（階段 B
    已完成，見下方該項條目），DNS 若未來真的搬去 Cloudflare 只需要
    換掉這段內部實作，外部呼叫端程式碼不用改。
    **階段 A 已完成的部分**：新表 `sessions`／`oauth_states`
    （`backend/supabase/auth_schema.sql`，含 service_role grant，**已於
    2026-07-12 直連套用到正式 jonaminz-db**，套用前後各查了一次
    `information_schema.tables` 跟 `role_table_grants` 確認兩張新表跟
    grant 都正確、沒動到既有五張表）；`worker.js` 新增非 `/api/action`
    路由 `GET /auth/google/start`／`GET /auth/google/callback`（標準
    authorization code flow，ID token 解碼不驗簽名——來源是 server-to-server
    對 Google 的 TLS 連線，理由跟瀏覽器端第三方 ID token 不同）＋三個新
    action `loginWithInternalToken`／`getCurrentIdentity`／`logout`
    （esbuild 打包＋`node --check`＋eval/new Function grep 驗證過語法
    乾淨，**已於 2026-07-12 `wrangler deploy` 上線**，curl smoke test
    確認 `getCurrentIdentity`/`loginWithInternalToken` 回應正確、
    `/auth/google/start` 因 secrets 未設回 500（預期行為）、既有
    `getSdkVersion` 不受影響）；`assets/js/backend-client.js` 新增對應
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
    **DB schema 套用與 `wrangler deploy` 都已完成（2026-07-12，使用者
    透過 AskUserQuestion 明確授權）。這次還沒做（需要使用者自行操作）**：
    `wrangler secret put JONAMINZ_LOGIN_JONATHAN`／`JONAMINZ_LOGIN_MINZ`；
    使用者自行去 Google Cloud Console 建立 OAuth Client（redirect URI
    `https://jonaminz-backend.ndmc402010104.workers.dev/auth/google/callback`）
    並設定 `JONAMINZ_GOOGLE_CLIENT_ID`／`JONAMINZ_GOOGLE_CLIENT_SECRET`／
    `JONAMINZ_GOOGLE_EMAIL_JONATHAN`／`JONAMINZ_GOOGLE_EMAIL_MINZ` 四個
    secret；部署後在正式環境端到端驗證內部登入與 Google OAuth 全流程
    （Google 那段目前完全沒測過，本機只測得到內部密語登入，因為 OAuth
    需要真實 Google Client Secret 才能跑完整流程）。
    **正式環境部署與驗證（2026-07-12，使用者親自測試）**：DB schema
    已直連套用到 `jonaminz-db`（套用前後查 `information_schema.tables`／
    `role_table_grants` 確認）、`worker.js` 已 `wrangler deploy`（Version
    ID `22eaa5a1-759c-4175-a6c4-38832f82a1c8`）、六個新增 secret
    （`JONAMINZ_LOGIN_JONATHAN`／`JONAMINZ_LOGIN_MINZ`／
    `JONAMINZ_GOOGLE_CLIENT_ID`／`JONAMINZ_GOOGLE_CLIENT_SECRET`／
    `JONAMINZ_GOOGLE_EMAIL_JONATHAN`／`JONAMINZ_GOOGLE_EMAIL_MINZ`）
    使用者已自行用 `wrangler secret put` 設定完成（`wrangler secret list`
    確認名稱都存在）。使用者親自在 `https://www.jonaminz.com/pages/login/`
    完整測過兩條路：內部密語登入成功並正確顯示身分、Google OAuth
    完整走一次同意畫面並成功登入、登出正確清除狀態，**兩條路皆正常，
    無 bug**。Google Cloud OAuth Client 目前是「測試中」狀態（只有
    Jonathan/Minz 兩個 Google 帳號被加進 Test users 白名單），**刻意
    不發布成正式應用程式／不做網域驗證**——這是給公開服務用的機制，
    2 人固定身分系統不需要；Testing 模式下 Google refresh token 7 天
    會過期的限制對本系統無影響，因為本系統從未使用 Google refresh
    token（每次都重新走一次 authorization code flow，身分靠自己的
    `sessions` 表 30 天 TTL 管理，跟 Google token 生命週期無關）。
    至此 implementation-plan.md 原始第 9 項（主站登入）需求已全部
    達成並驗證完畢；之後才會做討論中額外擴大的階段 B（identity
    capability）與階段 C（skhpsv2 接入），排程見 implementation-plan.md
    SKHPSv2 段落（不急，等核心架構做完再排）。
  - **第 9 項階段 B（identity.currentUser@1 capability）：完成並已部署
    上線（2026-07-12）。** 目的是把 jonaminz 的登入身分包裝成符合 Frozen
    規格 S30-33 的正式 capability，讓外部專案（未來的 skhpsv2）能透過
    SDK 用同一套 Contract／Integration Settings 授權機制取得身分，而不是
    走專案間互踩的捷徑。**只做機制，這次沒有授權給任何專案**（`jonaminz-movies`
    的 `capabilities` 仍是空陣列）。
    - `worker.js` 新增共用 helper `resolveEffectiveCapabilities(env,
      projectId, environment, envSettings)`（S31 公式：Approved Contract
      `capabilities.supports` ∩ Integration Settings 授權的 `capabilities`
      陣列），`getEffectiveSettings` 的 `capabilities` 欄位從寫死的 `[]`
      改成真實計算值（這只是給 SDK 的提示，S33 規定不能當授權證明）。
    - 新增 action `getGrantedIdentity`：只給 `pages/identity-relay/`
      呼叫（token 不離開 jonaminz.com 自己的瀏覽器），用同一個 helper
      逐請求重新計算是否授權 `identity.currentUser@1`，未授權直接回
      `granted:false, identity:null`，不查 session（避免洩漏「現在有沒有
      人登入」這個資訊本身）。
    - `integration-settings.json` 每個 environment 新增選填的
      `capabilities` 陣列（省略視為 `[]`），`revision` 3。
    - `pages/identity-relay/index.html` 改讀自己 URL 的 `projectId` query
      string（SDK Kernel 建立 iframe 時帶上），呼叫新 action
      `getGrantedIdentity`，postMessage 內容加上 `granted` 欄位。
    - `sdk/sdk-src/sdk.js`：**第一個正式發布的 service**——
      `window.Jonaminz.identity.currentUser()`。照 S32 字面走：在
      `init()` 一開始（contract discovery 完成前）就無條件掛上
      `jz.identity = {currentUser}`，不論這個專案有沒有被授權都不會變成
      `undefined`；呼叫時才用新的 `whenSettingsSettled()`/`settleSettings()`
      gate（搭 `report()` 的既有呼叫點順便 settle）等 `getEffectiveSettings`
      這輪跑完，檢查 `effectiveCapabilities` 有沒有包含這個 capability，
      沒有就 reject `CAPABILITY_NOT_GRANTED`（S27 形狀）。有的話動態建立
      隱藏 iframe 打 `https://www.jonaminz.com/pages/identity-relay/`，
      **`event.origin` 驗證在這裡做**（relay 頁面本身刻意不驗證，見該
      檔案註解），5 秒逾時 reject `IDENTITY_TIMEOUT`（`retryable:true`）；
      relay 說 `granted:false` 一樣 reject `CAPABILITY_NOT_GRANTED`——
      這是 S33 的雙重防線，SDK 端快取的 capabilities 陣列可能過期，
      relay 背後的 Worker 才是真正的權威判斷。identity 是否成功跟
      `ready`/`degraded` 生命週期完全獨立，不互相影響。
      `sdk/generate-sdk-release.mjs` 產生新 hash `5d8e909081bf`，
      `stable`/`next` channel 都已指過去並 `wrangler deploy`。
    - **驗證**：`resolveEffectiveCapabilities` 交集邏輯先用 node 腳本
      窮舉 8 種組合（比照第 4 項 `computeEffectiveCss` 的做法）；
      `esbuild --bundle` + `node --check` 確認 `worker.js`／`sdk.js`／
      `identity-relay` 內嵌 script 語法乾淨、無 eval；curl 驗證正式環境
      未登記/未授權都正確回 `granted:false`，`getEffectiveSettings` 對
      `jonaminz-movies` 正確回真實 `capabilities:[]`，既有 action 不受
      影響；Playwright 端到端（本機 harness 頁 + `page.route()` mock
      `getEffectiveSettings`／`getGrantedIdentity`，其餘走真實 Worker/
      relay 程式碼）驗證六種情境全數正確：未授權 reject、已授權+已登入
      resolve 正確 `{id, displayName}`、已授權+未登入 resolve `null`、
      SDK 端快取誤判但 Worker 真正判斷擋下（S33 雙重防線）、relay 逾時
      5 秒後正確 reject、**偽造來源的 `postMessage` 被 `event.origin`
      檢查正確忽略**（安全性質，不是行為正確性）。全程零 JS 錯誤，
      `window.Jonaminz.status` 全程不受 identity 呼叫結果影響。
    - **這次沒做**：階段 C（真的把這個 capability 接進 skhpsv2 頁面）——
      使用者說 skhpsv2 repo 目前是另一個 AI 工具（Codex）在處理，之後才會
      另外交辦，**接手 jonaminz 任務時不要主動跨去碰 skhpsv2 repo**。
      `identity.currentUser@1` 以外的其他 capability（`search`／
      `notification` 等 reserved 名稱）也不在範圍內。「正向授權」路徑
      （某個真實專案的 Contract 宣告支援 identity、Settings 也真的授權、
      實際透過已登入 session 拿到身分）目前只在 mock 環境驗證過，沒有
      真實 DB 資料可測（沒有任何專案的 Contract 宣告 `capabilities.supports`
      含這個值）——跟第 4 項當初「tokens 正向成功」路徑一樣的保留，等
      真的有專案（很可能是 skhpsv2）要用時再一併做真實端到端驗證。
  - **後台整站登入保護（2026-07-12，第 9 項之後的追加工作）**：使用者
    透過 AskUserQuestion 明確選定兩件事——整個後台（`/pages/admin/`、
    `/pages/admin/theme/`、`/pages/admin/contracts/`）都要登入才能進來，
    不只是單一 write action；順便統一掉 `JONAMINZ_ADMIN_TOKEN` 這個
    獨立的固定密語機制，改用同一套 session 登入。`worker.js` 新增共用
    `requireSession(env, payload)`，`saveThemeCssRules`／`approveContract`／
    `rejectContract` 三個寫入動作都改成要求有效 session，
    `checkAdminToken` 已刪除；`p_actor`（Contract 核准/否決的操作人）
    直接用登入身分決定，不再吃前端傳的 `payload.actor`（原本是按鈕
    自報身分，沒有真的驗證，這裡堵掉可以假裝是另一個人的漏洞）。
    `assets/js/header.js` 的 `window.JonaminzIdentity` 新增
    `requireLogin()`（沒登入導去 `/pages/login/?next=<原路徑>`，任何
    失敗都導頁——刻意跟 `mount()` 的「失敗開放」不同，這是給真正的
    權限關卡用的「失敗關閉」）與匯出 `readToken()`。登入頁支援
    `?next=`（只接受同源相對路徑，拒絕 `://`／`//` 開頭的值，避免開放式
    重導向），內部密語登入成功後導回原本要去的頁面；Google OAuth 這條
    路這次沒有把 next 一起帶回（已知、刻意先不修的小缺口）。Contracts
    後台頁拿掉 Admin token 輸入框跟操作人切換按鈕，改成唯讀顯示登入
    身分。**這次明確不做**：前台 IA 調整（SKHPS 連結搬去前台、Jonathan
    頁籤內容頁）——使用者選了「這次先不動」。本機 Playwright 完整驗證
    過（未登入導頁、已登入正常載入、Contract/Theme payload 格式、
    `next` 正常流程與開放式重導向防護）；`JONAMINZ_ADMIN_TOKEN` 這個
    Cloudflare secret 部署後不再被使用，可自行
    `npx wrangler secret delete JONAMINZ_ADMIN_TOKEN` 刪除（未自動做）。
    **已於 2026-07-12 `wrangler deploy` 上線**（Version ID
    `bedbbb7b-50ed-453c-b3ad-6837ae1b9fe5`），curl smoke test 確認
    `saveThemeCssRules`／`approveContract` 不帶 token 都正確回
    `UNAUTHORIZED`、改帶舊的 `adminToken` 欄位測試也一樣被拒絕
    （確認舊機制真的失效）、其餘既有 action 不受影響。**仍待使用者
    親自到正式環境用真實帳號登入驗證**（curl 只能測「擋沒登入的」，
    測不到「真的登入後操作是否正常」）。**2026-07-12 使用者已親自到正式
    環境用真實帳號驗證通過（內部密語登入、Google OAuth、Contract 核准/
    否決操作人正確帶入、Theme 存檔皆正常），並要求刪除
    `JONAMINZ_ADMIN_TOKEN`——已用 `npx wrangler secret delete` 刪除，
    `wrangler secret list` 確認移除。**
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
- **Auth**：主站登入（內部密語＋Google OAuth）已上線並驗證通過，見上
  第 9 項。**2026-07-12 起已接到既有寫入動作上**（見上「後台整站登入
  保護」條目）：`saveThemeCssRules`／`approveContract`／`rejectContract`
  都要求有效登入 session，整個 `/pages/admin/*` 後台也要求登入才能
  進入。這個已知安全缺口已解決。
- 後台 `/pages/admin/` 首頁本身內容仍是佔位頁（連結卡片），但已加登入保護。
- Reservoir 願景中的 Slot Engine、Home Portal slots、Global Search、AI Gateway、
  Storage Layer：全部只在願景/規格層面，未實作。
- Roadmap Phase 1-5 見使用者記憶與 `docs/platform-integration-consensus.md`；
  目前處於 Phase 1 早期。

## 5. 外部服務、API、部署方式

| 項目 | 內容 |
|---|---|
| 前端託管 | GitHub Pages，repo `ndmc402010104/jonaminz`，branch `main`，網域 `www.jonaminz.com`（CNAME） |
| 後端 | Cloudflare Worker `jonaminz-backend.ndmc402010104.workers.dev`，部署指令 `npx wrangler deploy`（在 `backend/cloudflare-worker/` 下） |
| 資料庫 | Supabase Postgres，專案 `jonaminz-db`（ref `xhwrizmacantlubasixe`，AWS ap-southeast-1）。七張表：`external_app_registrations`、`theme_css_rules`、`contract_snapshots`、`contract_active_snapshots`、`contract_audit_log`、`sessions`、`oauth_states`（後兩張 2026-07-12 新增，第 9 項階段 A），皆開 RLS 無 public policy（只有 Worker 用 secret key 能碰）。**注意**：同一個 Supabase 組織下還有 `skhps-db`（另一專案，ref `ybixaibejrigqbrostnq`）——共用同一把 Management API token，操作前務必核對 project ref，不要碰錯專案 |
| Worker secrets | `SUPABASE_URL`、`SUPABASE_SECRET_KEY`；`JONAMINZ_LOGIN_JONATHAN`／`JONAMINZ_LOGIN_MINZ`（內部密語登入，已設定）、`JONAMINZ_GOOGLE_CLIENT_ID`／`JONAMINZ_GOOGLE_CLIENT_SECRET`／`JONAMINZ_GOOGLE_EMAIL_JONATHAN`／`JONAMINZ_GOOGLE_EMAIL_MINZ`（Google OAuth，已設定）。**`JONAMINZ_ADMIN_TOKEN` 已於 2026-07-12 用 `wrangler secret delete` 移除**（`wrangler secret list` 確認不在清單內）。全部存在 Cloudflare，不在 repo，Claude 不經手實際值 |
| Worker API | `POST /api/action`，action：`registerExternalApp` / `listExternalAppRegistrations` / `getThemeCssRules`（公開唯讀）/ `saveThemeCssRules`（**要求登入 session**）/ `submitContract`（Contract 收取，一律存 pending）/ `listPendingContracts`（公開唯讀）/ `approveContract` / `rejectContract`（**要求登入 session，操作人＝登入身分**，可互相改判）/ `getEffectiveSettings`（公開唯讀，S31 公式，`capabilities` 是真實計算值）/ `getSdkVersion`（公開唯讀，S37 版本指標）/ `loginWithInternalToken`／`getCurrentIdentity`／`logout`（第 9 項階段 A）/ `getGrantedIdentity`（第 9 項階段 B，只給 `pages/identity-relay/` 呼叫，逐請求重算 `identity.currentUser@1` 是否授權）。另有兩個非 `/api/action` 的 GET 路由：`/auth/google/start`／`/auth/google/callback`（Google OAuth）。三個要求登入的 action 共用 `requireSession(env, payload)` helper，`payload.token` 須是有效 session |
| CORS | Worker 回 `Access-Control-Allow-Origin: *` |

**部署鏈注意**：前端改動＝git push 到 main 即上線（GitHub Pages）；Worker 改動＝
必須另外 `wrangler deploy`，git push 不會部署 Worker。兩者是獨立動作。

## 6. 版本與分支狀態（2026-07-12 掃描）

- 業務版本：`v0.12.0-202607121631`（`version.js`；`v0.11.0` 是階段①，
  `v0.11.1` 是隨後的首頁/後台三個視覺缺陷修復，`v0.12.0` 是首頁改版
  ——全螢幕背景圖改成固定比例小相片框，取代 `v0.11.1` 那次治標的
  background-position 調整）。規則：每次 push 前要 bump，且要先查真的
  系統時間再填 `buildTime`/`updatedAt`（不能用猜的，見 `RULES.md`
  §二-1）。**這個版本字串 2026-07-12 起兼任全站資源的 cache-buster**
  （見 §3 前端品質重建條目），bump 這個檔案現在同時是「讓使用者肉眼
  確認上線」跟「強制瀏覽器拿新資源」兩件事的唯一機制，比以前更重要，
  不能漏。
  **2026-07-11～12 implementation plan 第 3-7 項、第 9 項階段 A、第 9
  項階段 B、後台整站登入保護（第 9 項之後追加）皆完成並已上線**：第 3
  項（核准後台）Worker 已 `wrangler deploy`、`contract_schema.sql` 的
  approve/reject Postgres function（含改判邏輯修正版）已套用到
  jonaminz-db、`pages/admin/contracts/` 已 push 上線；**2026-07-12 起
  改成要求登入 session，`JONAMINZ_ADMIN_TOKEN` 已淘汰**。第 4 項
  （`getEffectiveSettings`）Worker 已 `wrangler deploy`、
  `integration-settings.json` 的 `css`/`revision` 欄位已隨部署生效，
  curl 已驗證三條路徑正確。第 5 項（SDK Loader）、第 6 項（SDK
  Kernel）、第 7 項（tokens CSS 收編）、第 9 項階段 B（identity
  capability）都已 `wrangler deploy`（`getSdkVersion` 指標現在指向含
  identity capability 的 Kernel，hash `5d8e909081bf`）；`sdk/` 資料夾
  本次收尾會一併 git push（push 之後 `https://jonaminz.com/sdk/
  jonaminz-entry.js` 才會是真的常青網址上線目前這個新 hash，之前都在
  localhost／mock 指標測試）。第 5 項的 kill-switch／回滾已在正式環境的
  `sdk-versions.json` 上實際操作並復原過。Worker 線上版本與 repo（push
  完後）完全同步。
- 分支：只有 `main`，remote 只有 `origin`（GitHub）。與 SKHPS 的 skhpsv2 不同，
  **沒有** prod/dev 雙 remote 切換機制。
- `.gitignore` 已涵蓋 `*pw*.txt` / `*pw*.json` / `*secret*.txt` / `.env*` / `.wrangler/` / `.codemap/`。
- `2026-07-12 重新掃描確認`：`JONAMINZ_ADMIN_TOKEN` 已用 `wrangler secret list`
  直接查證線上真實清單，確認不存在（剩 8 個 secret：`JONAMINZ_GOOGLE_CLIENT_ID`／
  `JONAMINZ_GOOGLE_CLIENT_SECRET`／`JONAMINZ_GOOGLE_EMAIL_JONATHAN`／
  `JONAMINZ_GOOGLE_EMAIL_MINZ`／`JONAMINZ_LOGIN_JONATHAN`／
  `JONAMINZ_LOGIN_MINZ`／`SUPABASE_SECRET_KEY`／`SUPABASE_URL`）。
  `pages/admin/contracts/assets/js/app.js` 也重新 grep 確認乾淨，僅
  `worker.js` 註解裡還提到這把密語（說明已淘汰），不是真的還在用。

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
