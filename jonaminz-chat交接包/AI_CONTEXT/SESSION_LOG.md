# SESSION_LOG

## 2026-07-13～2026-07-14

### 產品探索

- 從 IG／Threads／Messenger 分享痛點開始。
- 一度把 Shared 想成外部 App。
- 透過 MVP 反覆確認，主體其實是 Chat。
- 修正為 Shared 是 Chat 內的共享內容模組。
- 確認後台主頁只做摘要。

### UX MVP

依序迭代 v0.1～v0.11，主要裁決：

- 浮動對方頭像
- 半版／全版
- 移除重複縮小／關閉按鈕
- 電話入口
- avatar-centric mobile chat
- reaction／reply／more
- quick reaction／send 同一按鈕
- emoji 文字插入
- sticker 獨立
- Shared 未看紅點
- 點進才算已看
- Shared filters
- last viewed sorting
- destination registry
- context banner 移到 composer 上方
- 電話 icon 改 SVG

### Technical MVP 0.1

建立：

- 技術規格
- schema
- Worker action 草案
- Durable Object 草案
- local／worker adapter
- local test page

結果：

- 使用者回報「失敗」。
- 決定停止此輪修補。
- 改做完整交接包，交由下一位 Agent 在正式 Repo 與 Windows 環境重新處理。

### 2026-07-14 接手執行（跳過診斷步驟，使用者明確授權直接做）

使用者當場指示「幫我完成，之前都不用問我沒關係，這個就是蓋樣品屋
沒有關係你就做...wangler deploy也可以直接Push沒關係，我要去睡覺了」——
明確授權跳過本文件原本要求的「Technical Failure Reproduction & Architecture
Review」診斷步驟，直接在正式 Repo 設計並實作第一個真實里程碑。

**沒有做**：`run-local.bat` 重現、Console/終端輸出記錄、根因判定。
`SOURCE/technical-mvp-0.1-FAILED` 的失敗原因目前仍然未知——這次不是
證明了它能修好，是直接繞過去重新設計。如果之後想知道原始草案為什麼
失敗，這個診斷任務還沒完成，`AGENT/PROMPT_TO_AGENT.md` 的步驟仍然有效。

**做了什麼**（細節見正式 Repo `AI_CONTEXT/PROJECT_STATE.md` §4.1 與
`AI_CONTEXT/CHANGELOG.md` 2026-07-14 條目，這裡只記重點）：

- 沿用 `SOURCE/technical-mvp-0.1-FAILED/supabase/chat_schema.sql` 的
  schema 設計（審過一次，合理），複製到正式 Repo
  `backend/supabase/chat_schema.sql`，**尚未在正式 Supabase 執行**
  （需要使用者手動到 SQL Editor 貼上執行，Claude 沒有直接寫入
  Postgres 的管道）。
- 架構選了 WORK_PLAN.md 自己列的「方案 C：Worker polling」，不是
  方案 A（Durable Object）或方案 B（Realtime token）——先求端到端證明
  能動，不是長期最終架構。
- 正式 Repo `backend/cloudflare-worker/worker.js` 新增
  `listChatMessages`/`sendChatMessage`/`markChatRead` 三個 action，
  都走 `requireSession`（不信任前端自報身分），已 `wrangler deploy`
  並用 curl 驗證。
- 正式 Repo 新增 `pages/chat/`（要求登入的 polling 版聊天 UI），只做
  文字＋已讀，沒有 typing/reaction/reply/附件（照本文件「Phase 0：
  停止擴張」的限制）。
- 沒有動 SOURCE/ux-mvp-v0.11 或把它的操作語意拆成正式元件——那是
  WORK_PLAN.md 的 Phase 5，要等 Technical Acceptance 全通過才做，
  這次連 Phase 4（真實 MVP 完整驗收）都還沒走完（缺 SQL migration
  這一步）。

**下一棒要做的事**：
1. 在 Supabase SQL Editor 執行 `backend/supabase/chat_schema.sql`。
2. 用 Jonathan／Minz 兩個真實帳號在兩台裝置/兩個瀏覽器實測第一個
   里程碑（傳文字→即時收到→未讀→已讀→對方看到 read receipt）。
3. 視情況決定要不要回頭做 Phase 1（重現 technical-mvp-0.1-FAILED
   原始失敗原因），或者既然新實作已經繞過去了，直接把那份原始草案
   標記為「歷史參考，不再需要重現」。
