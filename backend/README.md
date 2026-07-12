# jonaminz 後端

八件事：
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
4. Effective Settings（`getEffectiveSettings`）：核准完的 Contract 要真的
   影響行為，靠這個端點——S31 公式在這裡算，目前只算 CSS 這一個維度
   （`min(Contract 聲明, Settings 授予)`，S34），`capabilities` 先留空陣列
   佔位。對應 `docs/platform-integration-v1-implementation-plan.md` 第 4 項。
5. SDK Loader（`getSdkVersion` ＋ `sdk/jonaminz-entry.js`）：常青 loader
   向這個端點問「現在 stable/next channel 該載哪個 immutable
   `sdk/sdk-<hash>.js`」，回滾／kill-switch 都是改
   `backend/cloudflare-worker/sdk-versions.json` 的指標再部署。對應
   `docs/sdk-release-checklist.md`（S39）與 implementation plan 第 5 項。
6. SDK Kernel（`sdk/sdk-src/sdk.js`）：loader 載入的內容，真的做
   contract discovery、推送合約（呼叫 `submitContract`）、查
   `getEffectiveSettings`、settle S21 官方 snippet 的 `ready` Promise。
   v1 沒有已發布的 service，`window.Jonaminz.*` 不掛任何 service 命名
   空間。對應 implementation plan 第 6 項。
7. tokens CSS 收編（`applyTokens()`，同樣在 `sdk/sdk-src/sdk.js`）：
   `effectiveCss === "tokens"` 時呼叫既有的 `getThemeCssRules`（第 2 點
   那個 action，沒改），只挑 `:root` 列輸出成 CSS custom properties，
   舊名與 `--jz-*` 新名並存（S36）。`assets/js/theme-runtime.js` 本身
   沒動，繼續是 jonaminz 自己網站用的 v0 機制。對應 implementation
   plan 第 7 項。
8. 主站登入（implementation plan 第 9 項階段 A）：內部密語（`loginWithInternalToken`）
   跟 Google OAuth（`GET /auth/google/start` / `GET /auth/google/callback`，
   兩個唯二非 `/api/action` 的路由）兩條路，登入成功建立一筆 Supabase
   `sessions` row（不是自簽 JWT，可以真的登出/撤銷）。`getCurrentIdentity`／
   `logout` 供前端查身分/登出。**這套 session 同時也是整個後台
   （`/pages/admin/`、`/pages/admin/theme/`、`/pages/admin/contracts/`）
   跟 `saveThemeCssRules`／`approveContract`／`rejectContract` 三個寫入
   動作的唯一權限機制**（2026-07-12 追加，取代原本第 3 點寫的
   `JONAMINZ_ADMIN_TOKEN`）。

機密（Supabase secret key，新版命名 `sb_secret_...`，不是 `sb_publishable_...`）只存在
Cloudflare Worker 的 secret 裡，不會出現在這個 repo、對話紀錄或前端程式碼中。

## 1. Supabase：建表

打開你的 Supabase 專案 → SQL Editor，依序貼上並執行：
- `supabase/schema.sql`（外部專案回報）
- `supabase/theme_schema.sql`（Theme CSS 規則）
- `supabase/contract_schema.sql`（Contract snapshot / active snapshot / audit log 三張表）
- `supabase/auth_schema.sql`（`sessions` / `oauth_states` 兩張表，主站登入用）

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

npx wrangler secret put JONAMINZ_LOGIN_JONATHAN
npx wrangler secret put JONAMINZ_LOGIN_MINZ
# 各自想一組只有 Jonathan/Minz 自己知道的字串，這是 /pages/login/ 內部密語
# 登入用來分辨身分的密語。Claude 不會知道、也不需要知道這兩個值。

npx wrangler secret put JONAMINZ_GOOGLE_CLIENT_ID
npx wrangler secret put JONAMINZ_GOOGLE_CLIENT_SECRET
# 去 Google Cloud Console 建立 OAuth Client（類型選「網頁應用程式」，
# Authorized redirect URI 填 <你的 Worker 網址>/auth/google/callback），
# 貼這兩個值。

npx wrangler secret put JONAMINZ_GOOGLE_EMAIL_JONATHAN
npx wrangler secret put JONAMINZ_GOOGLE_EMAIL_MINZ
# 貼 Jonathan/Minz 各自要用來登入的 Google 帳號 email，Worker 拿這個白名單
# 擋掉不在名單內的 Google 帳號（這不是開放註冊系統）。
```

**`JONAMINZ_ADMIN_TOKEN` 已淘汰（2026-07-12）**：這個 secret 曾經是
`approveContract`/`rejectContract` 的臨時保護機制，現在整個後台跟這三個
寫入動作（`saveThemeCssRules`／`approveContract`／`rejectContract`）都改
成要求上面設定好的登入 session，`JONAMINZ_ADMIN_TOKEN` 這個 Cloudflare
secret 部署後不會再被 Worker 讀取。如果你之前設定過，可以用
`npx wrangler secret delete JONAMINZ_ADMIN_TOKEN` 刪掉（不會自動刪）。

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
  `payload.deleteIds` 是要刪除的規則 id 陣列。**要求 `payload.token` 是一筆有效的
  登入 session**（見下方 `requireSession`／登入相關 action），沒登入回
  `{ ok:false, code:"UNAUTHORIZED" }`（200，不是 401，跟現有 style 一致）。
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
- `approveContract` / `rejectContract`：implementation plan 第 3 項。
  `payload.snapshotId` 必填；`payload.token` 必填，要是一筆有效的登入
  session，不符合回 `{ ok:false, code:"UNAUTHORIZED" }`（200，不是
  401，跟現有 style 一致）。**操作人（`p_actor`）直接用登入身分決定，
  不是 payload 欄位**（2026-07-12 前是 `payload.actor` 自由填，已改成
  這樣避免自報身分不可信）。`payload.note`（選填，否決原因）。
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
- `getEffectiveSettings`：implementation plan 第 4 項，公開唯讀。
  `payload.projectId` 必填；**environment 不是 payload 欄位**，一律用這個
  Worker 部署自己的 `JONAMINZ_ENVIRONMENT`（跟 `submitContract` 同理，避免
  謊報繞過檢查）。回傳 S31 公式算出來的結果：
  ```json
  {
    "ok": true,
    "projectId": "jonaminz-movies",
    "environment": "prod",
    "approved": true,
    "settingsVersion": 1,
    "revision": 2,
    "generatedAt": "2026-07-11T14:22:33.894Z",
    "css": "none",
    "capabilities": []
  }
  ```
  沒有 active approved snapshot 時 `approved:false`、`css:"none"`、多一個
  `reason:"NO_APPROVED_SNAPSHOT"`（S31：沒 approved snapshot 就不啟用任何
  能力、不掛 Shell）。`css` 是 `min(Contract 聲明的 css, Settings 授予的
  css)`（S34，v1 只有 `none`/`tokens` 兩級，Contract 宣告了 schema 認不得
  的值視同沒宣告，S11 must-ignore）。`capabilities` 目前固定空陣列——
  第一個真實 service 出現時才會有內容，這裡先把回應形狀定下來，之後
  只加內容不改形狀。**這個端點只回答「准不准套用 tokens」，不回答
  「tokens 的規則長怎樣」**，後者仍是 `getThemeCssRules` 的事，這次
  沒有動它。實際呼叫端是 SDK Kernel（`sdk/sdk-src/sdk.js`，implementation
  plan 第 6 項）。
- `getSdkVersion`：implementation plan 第 5 項（S37），公開唯讀，
  `sdk/jonaminz-entry.js` loader 專用。`payload.projectId` 選填——
  v1 的 loader 呼叫時不帶，一律拿 `stable` channel；有給的話查
  `integration-settings.json` 該專案任一 environment 的 `channel`
  欄位是不是 `"next"`，是的話才走金絲雀（v1 沒有專案會這樣設，形狀先
  定）。回傳：
  ```json
  { "ok": true, "channel": "stable", "hash": "58350efc5a86",
    "url": "/sdk/sdk-58350efc5a86.js", "revision": 3,
    "generatedAt": "2026-07-11T..." }
  ```
  讀的是 `backend/cloudflare-worker/sdk-versions.json`（git 檔案，跟
  `integration-settings.json` 同模式）——回滾／kill-switch 都是改這份
  檔案再 `wrangler deploy`，不是複雜系統（S39）。完整發版/回滾/
  kill-switch 操作流程見 `docs/sdk-release-checklist.md`。

- `loginWithInternalToken`：`payload.token` 是使用者輸入的密語，比對
  `JONAMINZ_LOGIN_JONATHAN`／`JONAMINZ_LOGIN_MINZ` 兩個 secret，對中就
  建立一筆 `sessions` row，回 `{ ok:true, identity, token, expiresAt }`
  （這裡的 `token` 是新產生的 session token，不是使用者輸入的密語）；
  對不中回 `{ ok:false, code:"INVALID_TOKEN" }`。
- `getCurrentIdentity`：`payload.token` 是 session token，查 `sessions`
  表，有效回 `{ ok:true, identity:"jonathan"|"minz" }`，過期/查無資料/
  沒帶 token 都回 `{ ok:true, identity:null }`（不是錯誤，單純沒登入）。
- `logout`：`payload.token`，刪掉對應的 `sessions` row。前端另外自己清
  `localStorage`。
- `GET /auth/google/start`／`GET /auth/google/callback`：**唯二不是
  `/api/action` 的路由**，標準 OAuth authorization code flow。`start`
  產生一次性 `state`（存 `oauth_states`，10 分鐘 TTL）並 302 去 Google
  同意畫面；`callback` 核對 `state`、拿 `code` 換 token、解出 Google
  帳號 email、比對 `JONAMINZ_GOOGLE_EMAIL_JONATHAN`／
  `JONAMINZ_GOOGLE_EMAIL_MINZ` 白名單（不在名單一律 403，這不是開放
  註冊系統），建立 session、302 導回首頁，token 帶在 URL fragment
  （`#jonaminzSessionToken=...`，不會送到伺服器；前端 `header.js` 讀
  出來存進 localStorage 再清掉網址列）。

### Contract 收取的先決條件與已知留白

- **要先在 `integration-settings.json` 登記 projectId**，否則一律回
  `PROJECT_NOT_REGISTERED`（S15：只收已登記的 projectId）。目前一個 project
  entry 長這樣（`css` 選填，省略視為 `"none"`，是 `getEffectiveSettings`
  第 4 項用的 Settings 授予值，見下方）：
  ```json
  {
    "schemaVersion": 1,
    "revision": 2,
    "projects": {
      "example-project": {
        "environments": {
          "prod": { "origin": "https://example-project.jonaminz.com", "css": "none" }
        }
      }
    }
  }
  ```
  `revision` 是整數，S38 要求 Effective Settings 回應要帶版本資訊——這份
  檔案是 git 檔案沒有資料庫版號可用，**改這份檔案的內容時記得手動 +1**。
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
