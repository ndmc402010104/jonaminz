# INTEGRATION_TASK

## 任務名稱

Jonaminz Chat Technical MVP 0.1 真實整合

## 本輪允許新增／修改白名單

正式動工時應另開任務，建議白名單：

```text
backend/supabase/chat_schema.sql                         新增
backend/cloudflare-worker/chat-actions.js               新增
backend/cloudflare-worker/chat-room-hub.js              新增
backend/cloudflare-worker/worker.js                      最小接線
backend/cloudflare-worker/wrangler.jsonc 或 toml         增加 DO binding/migration
assets/js/backend-client.js                              增加 chat methods
assets/js/chat-runtime.js                                新增
pages/admin/chat-technical-mvp/...                       新增測試頁
config.json                                              登錄頁面
version.js                                               bump
AI_CONTEXT/PROJECT_STATE.md                              更新
AI_CONTEXT/CHANGELOG.md                                  更新
```

## 禁止事項

- 不動 reservoir 01–06。
- 不改 Frozen Platform S1–S39。
- 不把 Supabase secret key 放前端。
- 不直接讓 browser 讀寫 chat tables。
- 不把 Jonathan / Minz 身分放在 payload 當權威。
- 不部署 Worker，除非任務明確授權。
- 不先做 OneDrive、電話、Shared、Android overlay。

## 實作順序

1. 建表與 seed。
2. Worker chat actions 單元測試。
3. Durable Object socket auth。
4. backend-client methods。
5. 無 UI 的 technical page。
6. 兩帳號、兩瀏覽器驗收。
7. 才接 v0.11 UX Shell。
