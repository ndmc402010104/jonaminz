# CLAUDE.md — jonaminz

本專案的 AI 交接文件單一事實來源是 **`AI_CONTEXT/`** 資料夾。
本檔與 `AGENTS.md`、`.github/copilot-instructions.md` 內容等價（各工具入口
不同）；修改規則時只改 `AI_CONTEXT/` 內的文件，入口檔只放指引。

**開始任何任務前，先讀 `AI_CONTEXT/` 內的全部文件**，依此順序：

1. `AI_CONTEXT/RULES.md` — 禁止/允許事項（違反任何一條都算任務失敗）
2. `AI_CONTEXT/PROJECT_STATE.md` — 專案現況與 UNKNOWN 清單
3. `AI_CONTEXT/ARCHITECTURE.md` — 分層、資料流、部署流
4. `AI_CONTEXT/ACCEPTANCE.md` — 完工前必跑的通用驗收
5. `AI_CONTEXT/CHANGELOG.md` — 最近幾筆，了解上一棒做到哪
6. `pages/admin/journal/assets/js/app.js` 的 `DECISION_TIMELINE` 陣列
   ——「決策與待辦」頁的精選決策時間軸，看過去累積了哪些重大決策

行為要求（完整版在 RULES.md，這裡只列最常違反的）：

- 不依賴聊天記憶、不腦補；文件與程式碼不符時以程式碼為準並回報。
- 只改任務白名單內的檔案，不順手重構、不順手整理。
- 標記 `UNKNOWN` / `NEEDS_CONFIRMATION` 的內容不可當事實使用。
- 版本規則：改程式碼/HTML/CSS/JS/設定檔/schema 才 bump `version.js`，
  純文件不 bump。改 Worker 要另外 `wrangler deploy`（需任務單授權，否則先問）。
- 完工後更新 `AI_CONTEXT/PROJECT_STATE.md`、追加 `AI_CONTEXT/CHANGELOG.md`；
  這次任務如果做了「有取捨、值得記住為什麼這樣決定」的重大決策，同時
  在 `DECISION_TIMELINE` 加一筆（不是每個小修都要加，只有真正的決策）。
- **每一次回覆都要查一次 `project_tasks`（尤其 `for_claude` 泳道）**
  ——不是「每個大任務」，是每一次對話來回，見 RULES.md §2-6 的完整
  措辭（這條被使用者連續糾正過，別再簡化）。看過一次不代表這輪就
  結束了：只要使用者還在追問同一件事，先處理完再回應其他訊息。
- 回覆一律繁體中文。

<!-- PROJECT_MEMORY_START -->
## Project Memory Workflow

Before making changes:

1. Run `node tools/project-memory/memory.mjs start --agent <agent> --task "<task>"`
2. Read `AI_CONTEXT/CONTEXT_PACK.md`
3. Respect active decisions and known issues.

During work:

- Record new candidates with `memory.mjs record`.
- Do not directly promote pending content into formal truth documents.

Before finishing:

1. Run relevant tests.
2. Run `memory.mjs close`.
3. Run `memory.mjs check`.
4. Report changed files, validation results, pending decisions, and unresolved issues.
<!-- PROJECT_MEMORY_END -->
