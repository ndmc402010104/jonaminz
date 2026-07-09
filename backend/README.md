# jonaminz 後端

兩件事：
1. 接收外部專案「我上線了」的回報（registerExternalApp），存進 Supabase，後台可以讀出來
   看「誰接進來、最後一次回報是什麼時候」。
2. Theme：全站（含外部專案）共用的外觀來源，selector+property+value 規則存在 Supabase
   的 `theme_css_rules`，`assets/js/theme-runtime.js` 讀出來組成 CSS 套用（見
   `docs/external-project-manifest.md` 的「Theme（共用外觀）」章節）。

機密（Supabase secret key，新版命名 `sb_secret_...`，不是 `sb_publishable_...`）只存在
Cloudflare Worker 的 secret 裡，不會出現在這個 repo、對話紀錄或前端程式碼中。

## 1. Supabase：建表

打開你的 Supabase 專案 → SQL Editor，依序貼上並執行：
- `supabase/schema.sql`（外部專案回報）
- `supabase/theme_schema.sql`（Theme CSS 規則）

## 2. Cloudflare：部署 Worker

```bash
cd backend/cloudflare-worker
npx wrangler login          # 瀏覽器登入 Cloudflare
npx wrangler deploy         # 部署，完成後會印出 Worker 網址，例如
                             # https://jonaminz-backend.<your-subdomain>.workers.dev
```

部署完成後設定兩個 secret（指令會互動式提示你貼值，值不會留在終端機歷史）：

```bash
npx wrangler secret put SUPABASE_URL
# 貼你的 Supabase 專案網址，例如 https://xxxxx.supabase.co（這個不是機密）

npx wrangler secret put SUPABASE_SECRET_KEY
# 貼 Supabase 專案設定 → API Keys → secret key（sb_secret_ 開頭，不是 sb_publishable_）
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
