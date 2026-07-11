# jonaminz 後端

三件事：
1. 接收外部專案「我上線了」的回報（registerExternalApp），存進 Supabase，後台可以讀出來
   看「誰接進來、最後一次回報是什麼時候」。
2. Theme：全站（含外部專案）共用的外觀來源，selector+property+value 規則存在 Supabase
   的 `theme_css_rules`，`assets/js/theme-runtime.js` 讀出來組成 CSS 套用（見
   `docs/external-project-manifest.md` 的「Theme（共用外觀）」章節）。
3. Contract 收取＋核准（Platform Integration，圖書館模型）：外部專案推送
   `jonaminz.contract.json` 給 `submitContract`，存成 immutable snapshot，
   一律先進 `pending`——推送 ≠ 採信。`/pages/admin/contracts/` 後台可以看
   pending 清單、跟目前 active 版本的 diff，手動核准（approveContract）或
   否決（rejectContract）。對應規格 `docs/platform-integration-spec-v1.md`
   （Frozen, S13-S16）與 `docs/platform-integration-v1-implementation-plan.md`
   第 2、3 項。

機密（Supabase secret key，新版命名 `sb_secret_...`，不是 `sb_publishable_...`）只存在
Cloudflare Worker 的 secret 裡，不會出現在這個 repo、對話紀錄或前端程式碼中。

## 1. Supabase：建表

打開你的 Supabase 專案 → SQL Editor，依序貼上並執行：
- `supabase/schema.sql`（外部專案回報）
- `supabase/theme_schema.sql`（Theme CSS 規則）
- `supabase/contract_schema.sql`（Contract snapshot / active snapshot / audit log 三張表）

## 2. Cloudflare：安裝依賴、部署 Worker

`worker.js` 現在依賴 `ajv`（驗證 Contract JSON Schema）跟 `wrangler`，部署前先
`npm install`：

```bash
cd backend/cloudflare-worker
npm install                 # 裝 ajv + wrangler
npx wrangler login          # 瀏覽器登入 Cloudflare
npx wrangler deploy         # 部署，完成後會印出 Worker 網址，例如
                             # https://jonaminz-backend.<your-subdomain>.workers.dev
```

**Contract Schema 改了要重新產生 validator**：Cloudflare Workers 的 V8 isolate
禁止動態產生程式碼（`new Function`/`eval`），而 `ajv.compile()` 預設在 runtime
就是靠這個機制把 schema 編成驗證函式——2026-07-10 第一次部署 `submitContract`
時就是栽在這裡（`wrangler deploy` 直接失敗：`Code generation from strings
disallowed for this context`）。修法是用 ajv 的 standalone code 機制在
**build time**（不是 Worker runtime）先把
`docs/contract-schema/jonaminz.contract.schema.json` 編譯成一份純 JS：

```bash
cd backend/cloudflare-worker
node generate-contract-validator.mjs
```

這會覆寫 `contract-schema-validator.generated.js`（自動產生的檔案，但要
commit 進 repo——Workers 部署時不會執行這支腳本，只會直接 bundle 產出檔案）。
`worker.js` import 的是這份產出檔案，不是在 Worker 裡呼叫 `ajv.compile()`。
**每次改了 `jonaminz.contract.schema.json` 之後，部署前都要先重跑這支腳本**，
否則 Worker 用的還是舊 schema。

部署完成後設定兩個 secret（指令會互動式提示你貼值，值不會留在終端機歷史）：

```bash
npx wrangler secret put SUPABASE_URL
# 貼你的 Supabase 專案網址，例如 https://xxxxx.supabase.co（這個不是機密）

npx wrangler secret put SUPABASE_SECRET_KEY
# 貼 Supabase 專案設定 → API Keys → secret key（sb_secret_ 開頭，不是 sb_publishable_）

npx wrangler secret put JONAMINZ_ADMIN_TOKEN
# 自己想一個只有 Jonathan/Minz 知道的字串。這是 approveContract/rejectContract
# 目前唯一的保護（整站還沒有登入系統，這是臨時關卡，見下方 API 說明），
# 貼進 /pages/admin/contracts/ 頁面的「Admin token」欄位才能核准/否決。
# Claude 不會知道、也不需要知道這個值。
```

## 3. 把 Worker 網址接進 jonaminz

部署完把 `wrangler deploy` 印出的網址（不是機密）貼給我，我會把它填進根目錄
`config.json` 的 `backend.worker.baseUrl`。填好之後：

- 後台頁會顯示目前有哪些外部專案回報過、最後上線時間。
- 外部專案自己要怎麼回報，見 `docs/external-project-manifest.md` 的「回報自己上線」章節。

## API

只有一個端點 `POST /api/action`，body 是 `{ "action": "...", "payload": {...} }`：

- `registerExternalApp`：`payload.projectId` 必填，其餘（title/href/version/env）皆為顯示用途。
- `listExternalAppRegistrations`：不需要 payload，回傳 `{ ok: true, rows: [...] }`。
- `getThemeCssRules`：不需要 payload，公開唯讀，回傳 `{ ok: true, rows: [...] }`
  （每列是 `selector` / `property` / `value`）。
- `saveThemeCssRules`：後台 Theme 頁存檔用。`payload.upsert` 是要新增/更新的規則陣列，
  `payload.deleteIds` 是要刪除的規則 id 陣列。**目前沒有身分驗證**，任何知道 Worker
  網址的人都能改全站外觀——這是已知的暫時限制，之後 jonaminz 有登入系統時要補上。
- `submitContract`：外部專案推送合約。`payload.projectId` 必填；
  `payload.contract` 必填、是已解析的 JSON 物件（不是字串），依
  `docs/contract-schema/jonaminz.contract.schema.json` 驗證；`payload.environment`
  選填，只用來跟 Worker 自己的 `JONAMINZ_ENVIRONMENT` 做健檢比對，不是權威來源。
  回傳 `{ ok: true, snapshotId, status: "pending", canonicalHash, deduped, validationResult }`
  或 `{ ok: false, code, error }`（`code` 例如 `PROJECT_NOT_REGISTERED` /
  `ENVIRONMENT_NOT_REGISTERED` / `SCHEMA_INVALID` / `ORIGIN_MISMATCH` /
  `CONTRACT_TOO_LARGE`）。request body 過大（見下）時沒有 `code`，直接回
  HTTP 413。
- `listPendingContracts`：不需要 payload，公開唯讀。回傳
  `{ ok: true, rows: [...] }`，每列含 `status`／`rawContract`／
  `validationResult`／`previousApproved`（該 (projectId, environment) 目前
  active 的版本，沒有就是 `null`，給後台做 diff 用）。
- `approveContract` / `rejectContract`：implementation plan 第 3 項，**唯一
  有保護的寫入動作**。`payload.snapshotId` 必填；`payload.adminToken` 必填，
  要吻合 Worker secret `JONAMINZ_ADMIN_TOKEN`，不符合回
  `{ ok:false, code:"UNAUTHORIZED" }`（200，不是 401，跟現有 style 一致）。
  `payload.actor`（選填，操作人名字）、`payload.note`（選填，否決原因）。
  實際的狀態切換是呼叫 Supabase RPC（`approve_contract_snapshot` /
  `reject_contract_snapshot`，見 `supabase/contract_schema.sql`）——這兩個
  Postgres function 把「改 snapshot 狀態＋切換 active 指標＋寫 audit log」
  包成同一個原子操作，不是 Worker 端連續三次 fetch。approve 成功後，該
  `(projectId, environment)` 的 `contract_active_snapshots` 指標會切到這筆
  snapshot。**核准/否決都不是終態，可以互相改判**（S13：「核准/否決只改
  狀態與 active 指標，永不覆寫歷史」——歷史指 audit log 不可竄改，不是
  status 定了就不能再變）：否決一筆已核准的 snapshot，如果它正好是目前
  生效版本，會把 `contract_active_snapshots` 整個撤掉（沒有版本歷史堆疊，
  無法自動退回上一版，安全預設是「暫時沒有生效版本」，要人工重新核准
  一筆才會再有東西生效）；核准一筆已否決的 snapshot 則會照常把它設為
  active。每次改判都會在 `contract_audit_log` 多插入一筆，不會覆寫或
  刪除舊紀錄。

### Contract 收取的先決條件與已知留白

- **要先在 `integration-settings.json` 登記 projectId**，否則一律回
  `PROJECT_NOT_REGISTERED`（S15：只收已登記的 projectId）。目前這份檔案是空的
  （`{"schemaVersion":1,"projects":{}}`），因為還沒有任何真實外部專案——新增一筆
  範例：
  ```json
  {
    "schemaVersion": 1,
    "projects": {
      "example-project": {
        "environments": {
          "prod": { "origin": "https://example-project.jonaminz.com" }
        }
      }
    }
  }
  ```
  改完要重新 `wrangler deploy`（這份檔案是 build-time 打包進 Worker 的 git 檔案，
  不是 runtime 讀 Supabase，改了不部署不會生效）。
- **Environment 由 Worker 自己的 `JONAMINZ_ENVIRONMENT`（`wrangler.toml` 的
  `[vars]`）決定，不是 payload 能宣告的**——這是刻意設計，避免有人在 payload
  裡謊報 environment 來繞過同源檢查（見
  `docs/contract-schema/README.md` 的 Environment Resolution 一節）。現在只有
  一個部署，`JONAMINZ_ENVIRONMENT="prod"`；要開 dev 環境時在 `wrangler.toml`
  加 `[env.dev]` / `[env.dev.vars] JONAMINZ_ENVIRONMENT="dev"` 另外部署一份，
  指向同一個 Supabase 專案即可，不需要第二套資料庫。
- **submitContract 一律寫 `status='pending'`**（S13, S16），永不自動
  approve——approve/reject 一定要透過 `/pages/admin/contracts/` 後台手動觸發。
- **Size 限制分兩層**：`fetch()` 一開始（`request.json()` 之前）先檢查
  `Content-Length` header，超過 256KB 直接回 HTTP 413，不無條件把整個 body
  讀進記憶體才發現太大——這層是所有 action 共用的 pre-parse 粗防，不是
  `submitContract` 專屬。`submitContract` 內部另外對 `payload.contract`
  做 post-parse 的字串長度檢查（200,000 字元，回 `CONTRACT_TOO_LARGE`）。
  兩層是獨立防線：Content-Length 缺席或造假（例如 chunked encoding）時第一層
  擋不住，但第二層還在。
- **完整 rate limit（依 request 頻率擋濫用）2026-07-11 使用者正式裁決留白，
  不是遺漏**：S15 要求 rate limit，但需要 Cloudflare KV binding，現在沒有，
  也沒有真實外部專案在打這支 API，風險低。真的要接第一個真實外部專案時，
  要加 KV binding 做完整 rate limit。
- **本機驗證邏輯不需要部署 Worker**：`contract-validation.js` 是純函式模組，
  可以直接 `node` import 測試 canonical hash／cross-field／URL 驗證的邏輯。
