# CURRENT_STATE

## UX Checkpoint

目前 UX checkpoint：

```text
SOURCE/ux-mvp-v0.11
```

它已驗證產品方向，但不是正式前端架構。

不要：

- 繼續做 v0.12 美化
- 直接把單檔 HTML 貼進正式 Repo
- 把 prototype localStorage 當資料模型
- 為了保留原型而綁架正式實作

可以保留：

- 操作語意
- 狀態定義
- 資訊層級
- 使用者裁決

## Technical MVP 0.1

位置：

```text
SOURCE/technical-mvp-0.1-FAILED
```

包含：

- Chat spec
- Chat data model
- Chat state machine
- Supabase schema 草案
- Worker action 草案
- Durable Object ChatRoomHub 草案
- Local adapter
- Worker adapter
- 技術測試頁

使用者回報執行失敗。

**未完成事項：**

- 未取得 Console error
- 未取得終端輸出
- 未確認 `run-local.bat` 是否有啟動 server
- 未確認電腦是否有 `py`
- 未確認瀏覽器是否載入頁面
- 未確認是 HTML、JS、BroadcastChannel 或啟動腳本失敗
- 未部署 Worker
- 未執行正式 SQL
- 未做真實 session 整合

因此 Technical MVP 0.1 應視為：

```text
規格與草案可參考
執行結果未驗證
不可宣稱可用
```

## 正式 Repo 已確認的可利用基礎

- 現有 `backend/cloudflare-worker/worker.js`
- 現有 `/api/action`
- 現有 `requireSession`
- 現有 `sessions` table
- 現有 `assets/js/backend-client.js`
- 現有 `window.JonaminzIdentity`
- 現有 Capacitor Android App
- 現有 Google OAuth deep link

下一位 Agent 應在正式 Repo 中重新檢查最新版本，不可只依本交接文字。
