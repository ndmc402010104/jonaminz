# Jonaminz Chat Technical MVP 0.1

日期：2026-07-13  
狀態：技術實作包，**尚未部署、尚未修改正式 Jonaminz repo、尚未執行正式 Supabase SQL**。

這一版停止雕 UI，只驗證：

```text
Jonathan 傳文字
→ Worker 驗證 session
→ Supabase 保存
→ ChatRoomHub 即時推送
→ Minz 收到未讀
→ Minz 打開聊天室
→ 更新 last_read_message_id
→ Jonathan 看見已讀位置
```

另包含：

- typing start / stop
- presence join / leave
- reaction
- reply
- reconnect 後重新 bootstrap
- client_message_id 去重
- 兩個 Chat Library instance 的資料隔離概念

## 為什麼不是瀏覽器直接連 Supabase

現有 Jonaminz 身分是：

```text
localStorage session token
→ Cloudflare Worker requireSession()
→ Supabase sessions table
```

前端沒有 Supabase Auth JWT，而且所有正式資料表都 RLS 鎖死、只允許 Worker 的 service role 存取。

因此本包維持原則：

```text
瀏覽器不直接讀寫 chat tables
瀏覽器不取得 Supabase secret key
所有永久寫入都經 Worker
Realtime WebSocket 也先由 Worker 驗證 session
```

## 資料夾

```text
docs/
  CHAT_LIBRARY_SPEC.md
  CHAT_DATA_MODEL.md
  CHAT_STATE_MACHINE.md
  CHAT_CAPABILITIES.md
  CHAT_MVP_ACCEPTANCE.md
  INTEGRATION_TASK.md

supabase/
  chat_schema.sql

worker/
  chat-actions.js
  chat-room-hub.js
  worker-integration-example.js
  wrangler.chat.example.jsonc

web/
  index.html
  app.js
  app.css
  local-adapter.js
  worker-adapter.js
  config.example.js

tests/
  MANUAL_TEST.md

run-local.bat
run-local.ps1
```

## 先測本機雙分頁

### Windows

雙擊：

```text
run-local.bat
```

再開：

```text
http://localhost:8765/web/?identity=jonathan
http://localhost:8765/web/?identity=minz
```

本機 Demo 使用 `BroadcastChannel + localStorage`，不連正式 DB，但使用與正式 adapter 相同的事件模型，可驗證：

- 傳訊息
- 未讀
- 已讀
- 輸入中
- 在線
- reaction
- reconnect / reload

## 正式整合順序

1. 閱讀 `docs/INTEGRATION_TASK.md`。
2. 在**非正式 DB 或備份完成後**執行 `supabase/chat_schema.sql`。
3. 將 `worker/chat-room-hub.js` 合併進既有 Worker。
4. 將 `worker/chat-actions.js` 中的 actions 接進既有 `/api/action` switch。
5. 依 `wrangler.chat.example.jsonc` 增加 Durable Object binding 與 migration。
6. 部署前依現有規則重新確認；本包不會自行 deploy。
7. 前端先使用 `worker-adapter.js` 驗證兩個真實登入帳號。
8. 真實聊天通過後，再把 v0.11 UX Shell 接到 adapter。

## 本輪不做

- Shared 正式資料表
- OneDrive
- 圖片與檔案
- Android floating overlay
- 電話
- Push notification
- 完整搜尋
- 訊息編輯
- 群組聊天室
- SKHPSv2 實際接入
