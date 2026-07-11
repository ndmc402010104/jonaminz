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
