# AGENTS.md — jonaminz（Codex 及其他 CLI agent 的入口）

本專案的 AI 交接文件單一事實來源是 **`AI_CONTEXT/`** 資料夾。
本檔與 `CLAUDE.md`、`.github/copilot-instructions.md` 內容等價，
只是各工具的慣例入口不同；修改規則時**只改 `AI_CONTEXT/` 內的文件**，
這三個入口檔只放指引不放內容。

**開始任何任務前，先讀 `AI_CONTEXT/` 內的全部文件**，依此順序：

1. `AI_CONTEXT/RULES.md` — 禁止/允許事項（違反任何一條都算任務失敗）
2. `AI_CONTEXT/PROJECT_STATE.md` — 專案現況與 UNKNOWN 清單
3. `AI_CONTEXT/ARCHITECTURE.md` — 分層、資料流、部署流
4. `AI_CONTEXT/ACCEPTANCE.md` — 完工前必跑的通用驗收
5. `AI_CONTEXT/CHANGELOG.md` — 最近幾筆，了解上一棒做到哪

最常違反的規則（完整版在 RULES.md）：

- 不依賴聊天記憶、不腦補；文件與程式碼不符時以程式碼為準並回報。
- 只改任務白名單內的檔案；新增檔案也要白名單明確允許，不順手重構。
- 標記 `UNKNOWN` / `NEEDS_CONFIRMATION` 的內容不可當事實使用。
- 版本規則：改程式碼/HTML/CSS/JS/設定檔/schema 才 bump `version.js`，
  純文件不 bump。改 Worker 要另外 `wrangler deploy`（需任務單授權，否則先問）。
- 完工後更新 `AI_CONTEXT/PROJECT_STATE.md`、追加 `AI_CONTEXT/CHANGELOG.md`。
- 回覆一律繁體中文。
