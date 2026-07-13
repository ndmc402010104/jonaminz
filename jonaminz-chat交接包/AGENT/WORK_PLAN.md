# WORK_PLAN

## Phase 0：停止擴張

- 不加新 UX。
- 不加附件。
- 不加電話。
- 不加 Shared DB。
- 不加 SKHPSv2 實例。

## Phase 1：重現失敗

### 1A 靜態啟動

依序測：

```powershell
python --version
py --version
python -m http.server 8765
py -m http.server 8765
```

不要一開始依賴 `.bat`。

### 1B Browser

確認：

```text
GET /web/
GET /web/app.js
GET /web/local-adapter.js
GET /web/config.example.js
```

記錄 Network 與 Console。

### 1C 雙分頁

確認：

- BroadcastChannel 是否建立
- identity query 是否正確
- send event 是否發生
- localStorage state 是否寫入
- reload 是否恢復

### 1D 切割

把失敗分類：

- launcher script
- HTTP server
- HTML load
- syntax/runtime
- state initialization
- event transport
- UI rendering

## Phase 2：Repo Architecture Review

檢查正式最新版：

- Worker action dispatch
- `requireSession`
- Supabase helper
- `backend-client.js`
- `header.js`
- App deep link
- Wrangler config
- 現有資料表 naming／grant／RLS pattern

## Phase 3：架構決策

Agent 應至少比較：

### A. Worker＋Durable Object

- 與現有 session 最一致
- 即時狀態集中
- 增加 DO 複雜度

### B. Worker-issued short-lived Realtime token

- 可利用 Supabase Realtime
- 需要安全設計與 token flow
- 不得讓 browser 冒充 identity

### C. Worker polling／SSE 作為極簡 MVP

- 可能最簡單
- typing／presence 效果有限
- 可作 first proof，不一定作長期架構

不要先選最華麗的，選能最安全證明端到端的。

## Phase 4：真實 MVP

只做：

- messages
- room members
- reactions
- last read
- typing
- realtime delivery

## Phase 5：接 UX Shell

只有 Technical Acceptance 全通過後：

- 把 v0.11 操作語意拆成正式元件
- 接 Chat adapter
- 保持 Theme token architecture
