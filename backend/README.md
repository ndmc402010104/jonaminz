# jonaminz 後端（外部專案回報機制）

只做一件事：接收外部專案「我上線了」的回報（registerExternalApp），存進 Supabase，
後台可以讀出來看「誰接進來、最後一次回報是什麼時候」。

機密（Supabase service role key）只存在 Cloudflare Worker 的 secret 裡，不會出現在
這個 repo、對話紀錄或前端程式碼中。

## 1. Supabase：建表

打開你的 Supabase 專案 → SQL Editor，貼上並執行 `supabase/schema.sql` 的內容。

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
# 貼你的 Supabase 專案網址，例如 https://xxxxx.supabase.co

npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
# 貼 Supabase 專案設定 → API → service_role key（不是 anon key）
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
