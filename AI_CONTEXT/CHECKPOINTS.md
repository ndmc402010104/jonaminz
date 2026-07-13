# CHECKPOINTS — 文件同步檢查點

用途：記錄「文件盤點/大範圍文件修改」這類任務的 checkpoint，方便使用者
事後決定要不要 commit，以及需要時怎麼回退。跟工程任務的部署 checkpoint
（`wrangler deploy` 的 Version ID 之類）分開，那些記在 `CHANGELOG.md`。

---

## Checkpoint: `docs-audit-202607`（2026-07-12 文件真實性盤點）

**Commit 前狀態**：`git status` 為 clean，`main` 分支與 `origin/main`
同步，最新 commit 為 `eac0efb`（「文件小修正：順序④已 push，更新
PROJECT_STATE 開頭狀態描述」）。本次盤點開始前沒有任何未提交的變更。

**修改範圍（僅 Markdown，未執行 git add/commit/push）**：

- 新增 8 個檔案（`AI_CONTEXT/` 底下，全部是本次盤點建立，先前不存在）：
  - `AI_CONTEXT/FACTS.md`
  - `AI_CONTEXT/DECISIONS.md`
  - `AI_CONTEXT/CURRENT_STATE.md`
  - `AI_CONTEXT/KNOWN_ISSUES.md`
  - `AI_CONTEXT/EXPERIMENTS.md`
  - `AI_CONTEXT/SESSION_LOG.md`
  - `AI_CONTEXT/CHECKPOINTS.md`（本檔）
  - `AI_CONTEXT/DOCUMENT_STATUS.md`
- 修改 13 個既有 Markdown 檔案：
  - `README.md`（補充檔案結構圖、加現況指引）
  - `pages/README.md`（修正過期的 JONAMINZ_ADMIN_TOKEN 描述，補
    login/identity-relay 頁面說明）
  - `docs/frontend-quality-plan-202607.md`（階段①加註完成狀態）
  - `docs/platform-integration-consensus.md`（加 Historical 標記）
  - `docs/platform-integration-spec-review.md`（加 Historical 標記）
  - `docs/platform-integration-review-request.md`（加 Historical 標記）
  - `docs/platform-integration-review-consolidation.md`（加 Historical 標記）
  - `docs/platform-integration-reviews/review-chatgpt.md`（加 Historical 標記）
  - `docs/platform-integration-reviews/review-claude-fable.md`（加 Historical 標記）
  - `docs/platform-integration-reviews/review-codex.md`（加 Historical 標記）
  - `docs/platform-integration-reviews/review-gemini.md`（加 Historical 標記）
  - `docs/platform-integration-reviews/review-perplexity.md`（加 Historical 標記）
  - `docs/platform-integration-reviews/acceptance-review-spec-v1-rc.md`（加 Historical 標記）

**未修改的檔案類型**：`.js`／`.html`／`.css`／`.json`／`.sql`／`.toml`
一律未動。逐一核對方式：`git diff --name-only` 的輸出只包含 `.md`
副檔名的路徑（見最終報告第 8-10 項的實際指令輸出）。

**驗收方式**：

1. `git status --porcelain` 確認變動檔案清單與上面列的 21 個檔案
   （8 新增 + 13 修改）完全一致，沒有意外檔案混入。
2. `git diff --name-only` 逐行檢查副檔名，確認全部是 `.md`。
3. 六份供未來 agent 快速理解現況的檔案（`FACTS.md`／`DECISIONS.md`／
   `CURRENT_STATE.md`／`KNOWN_ISSUES.md`／`EXPERIMENTS.md`／
   `DOCUMENT_STATUS.md`）互相讀過一次，確認彼此沒有互相矛盾（例如
   `FACTS.md` 說「已部署」的項目，`CURRENT_STATE.md` 不會說「未實作」）。
4. 本次盤點過程沒有執行 `wrangler deploy`、沒有對正式環境發出任何寫入
   請求、沒有執行 `git add`／`git commit`／`git push`——這條本身也是
   驗收項目之一（任務的絕對限制）。

**確認無程式碼變更**：是。本 checkpoint 只涉及 Markdown 文件，沒有任何
`.js`／`.css`／`.html`／`.json`／`.sql`／`.toml` 或其他執行程式碼／設定檔
被修改。因此依照 `AI_CONTEXT/RULES.md` §二-1 的版本 bump 規則，**不需要
bump `version.js`**（純文件修改不 bump），本次也確實沒有動 `version.js`。

**回退方式**（使用者事後決定要不要保留這次的修改）：

- 全部回退（回到盤點前的 clean 狀態）：
  ```
  git checkout -- README.md pages/README.md docs/frontend-quality-plan-202607.md docs/platform-integration-consensus.md docs/platform-integration-spec-review.md docs/platform-integration-review-request.md docs/platform-integration-review-consolidation.md docs/platform-integration-reviews/
  rm AI_CONTEXT/FACTS.md AI_CONTEXT/DECISIONS.md AI_CONTEXT/CURRENT_STATE.md AI_CONTEXT/KNOWN_ISSUES.md AI_CONTEXT/EXPERIMENTS.md AI_CONTEXT/SESSION_LOG.md AI_CONTEXT/CHECKPOINTS.md AI_CONTEXT/DOCUMENT_STATUS.md
  ```
  （`git checkout --` 只能還原已追蹤檔案的修改，新增的 8 個檔案是
  untracked，要用 `rm` 手動刪除，不是 `git checkout` 能處理的對象。）
- 只回退某一份修改：`git checkout -- <該檔案路徑>`（已追蹤檔案適用）
  或直接刪除／手動改回（新增檔案適用）。
- 檢視完整差異但還不決定：`git diff`（已追蹤檔案的逐行差異）＋
  `git status --porcelain`（含新增的 untracked 檔案清單）。
- 確認滿意後要正式收下這次變更：由使用者自己執行
  `git add <檔案清單>` 與 `git commit`（本次盤點依規則不會自動執行）。

---

## Checkpoint: `admin-home-declutter-202607`（2026-07-13，後台畫面打磨前）

**任務性質**：使用者要求 Jonaminz 登入後畫面（`/pages/admin/` 系列）擺脫
「另一個 SKHPSv2 後台」的感覺，往「兩人共用的 Digital Home／數位圖書館」
方向打磨，同時要求 Theme tokens 化、確認內部/外部展示與 Placement
架構現況。本 checkpoint 記錄動手改動前的狀態。

**Commit 前狀態**：`main` 分支，HEAD = `ade3875`（「feat: Minz Page v0.1
Phase 1（純展示骨架）實作完成」），已 push 到 `origin/main`，兩者同步。

**工作目錄現況（非本任務造成，刻意不動）**：另一個並行 session（session
log 記錄為 `codex`）有未 commit 的 logo 相關變更仍在工作目錄：
`AI_CONTEXT/CHANGELOG.md`／`AI_CONTEXT/PROJECT_STATE.md` 各有一段未提交
的 logo 敘述、`assets/img/jonaminz-zen-logo.svg` 已修改、
`jonaminz-bamboo-sprig.svg`／`jonaminz-enso-c.svg`／
`jonaminz-stacked-stones.svg`／`jonaminz-wordmark.svg` 四個新檔未追蹤。
**本任務範圍完全不涉及這些檔案**，回退時不要誤刪。

**診斷發現（詳見本輪回報，暫不記錄進 FACTS/DECISIONS，等使用者確認範圍
後再視需要正式記錄）**：
- `AI_CONTEXT/` 全文搜尋「內部展示元件／外部展示元件／Placement／釘選」
  等關鍵字，**沒有找到任何既有的 Placement 資料模型或內部/外部展示
  架構**——現有最接近的機制是 v0 `registry.json`（目前是空陣列）的
  粗粒度 enabled/position/group/order，以及 ADPF（`DECISIONS.md` §五）
  的 Theme Pack 架構（只管視覺，不管排列）。使用者說「昨晚已定案」的
  細粒度 Placement 系統目前在本 repo 找不到對應紀錄，已透過
  AskUserQuestion 向使用者確認來源，不自行假設存在或動手重建。
- `pages/admin/index.html` 現況是置中單一小卡片（兩個連結：Theme／
  Contract 核准）＋外部專案回報清單，結構偏「工具選單」而非「家」，
  但本身資訊密度並不高；真正密集的表格/狀態/monospace 畫面在
  `/pages/admin/contracts/`（技術管理頁，已跟日常首頁分開，這個分離
  本身值得保留）。
- `/pages/admin/design/`（專案視覺方向頁）已經是「內部 Core entry ＋
  外部 Contract entries 混在同一份清單」的雛形，但卡片尺寸統一
  （`grid-template-columns: repeat(auto-fit, minmax(360px,1fr))`），
  是使用者明確不想要的「全部一樣尺寸的圖示＋標題＋說明＋按鈕卡片」。
- Theme tokens 紀律大致良好：admin 系列 CSS 沒有寫死色碼（僅
  `color:#fff` 這種固定對比色徽章文字，不受 Theme 影響，可接受）；
  唯一的「寫死視覺值」是 `pages/admin/design/assets/js/app.js` 的
  `JONAMINZ_CORE_ENTRY.app.visualIdentity.palette`，鏡射
  `02-tokens.css` 目前的亞麻米數值，屬於「jonaminz 對自己視覺身分的
  自我宣告」（因為 jonaminz 不是 Contract 登記者），不是真正意義上的
  Theme 破窗，但若之後 tokens 換了會跟這裡不同步，值得留意。

**回退方式**：本 checkpoint 之後如果對打磨結果不滿意，`git diff ade3875`
可看到本輪之後的所有異動；`git checkout -- <檔案>` 個別還原，或
`git reset --hard ade3875`（會連同 Codex 未 commit 的 logo 變更一起
清掉，使用前務必先確認那些內容是否已經另外備份／不需要保留）。

**任務性質**：新增純本機工具（`tools/project-memory/`）與對應的
`AI_CONTEXT/` 補充檔案，不修改任何正式產品功能／HTML／CSS／既有 JS
runtime／API／Worker／Supabase schema／Contract schema／Authentication
／Deployment 設定／業務資料——白名單範圍見任務指示原文「二、安全範圍」。

**修改範圍**：

- 新增：`tools/project-memory/`（`memory.mjs`、`lib/*.mjs` 五個模組、
  `test/memory.test.mjs`、`README.md`）、`.project-memory/`
  （`config.json`、`ledger.jsonl`、`snapshots/.gitkeep`；
  `current-session.json`／`snapshots/` 已排除進版控）、
  `AI_CONTEXT/PENDING.md`、`AI_CONTEXT/CONTEXT_PACK.md`（自動產物）、
  `AI_CONTEXT/README.md`。
- 修改（皆為既有內容之外的補充，原文一字未刪）：`.gitignore`（加
  project-memory 相關排除規則）、`AGENTS.md`／`CLAUDE.md`（標記區塊
  `<!-- PROJECT_MEMORY_START/END -->` 插入 Workflow 說明）、
  `AI_CONTEXT/CHANGELOG.md`（追加一筆）、`AI_CONTEXT/CURRENT_STATE.md`
  （新增 §五）、`AI_CONTEXT/KNOWN_ISSUES.md`（新增 #9，並修正 #8 一句
  過期敘述——當時寫「沒有找到任何自動化測試套件」，本次新增了
  `tools/project-memory` 自己的測試，需要區分清楚那不是主站測試）、
  `AI_CONTEXT/PROJECT_STATE.md`（頂端摘要更新）、
  `AI_CONTEXT/SESSION_LOG.md`（`memory.mjs close` 自動 append 的 smoke
  test 記錄，見下方「Smoke test 副作用」）。

**確認無正式產品程式碼變更**：是。`git diff --stat` 只會列出以上檔案，
沒有任何 `assets/`／`pages/`／`backend/`（`tools/` 除外）路徑。

**Smoke test 副作用（刻意保留，不是誤觸）**：任務指示的 Phase 3 smoke
test 在真實 repo 上跑過一次完整 `init → start → record decision →
close → check → status`，因此：

- `AI_CONTEXT/PENDING.md` 有一筆 `PEND-001`（decision candidate，
  summary「正式文件與自動紀錄分離」，Status 仍是 `pending`——**沒有**
  被升級進 `DECISIONS.md`，也不會被自動升級。
- `AI_CONTEXT/SESSION_LOG.md` 最上面多一筆
  `session_20260713051704_e0823ba0` 的結構化記錄。
- `.project-memory/ledger.jsonl`（不進版控）有 3 筆事件
  （`session_started`／`decision_candidate`／`session_closed`）。

這些都是任務指示明文要求的驗收步驟本身產生的資料，使用者驗收時如果
不想保留這筆測試用的 pending decision，直接編輯
`AI_CONTEXT/PENDING.md` 刪掉 `PEND-001` 那個區塊即可，不影響工具本身
的正確性。

**回退方式**：

- 全部回退：`git checkout -- .gitignore AGENTS.md CLAUDE.md AI_CONTEXT/CHANGELOG.md AI_CONTEXT/CURRENT_STATE.md AI_CONTEXT/KNOWN_ISSUES.md AI_CONTEXT/PROJECT_STATE.md AI_CONTEXT/SESSION_LOG.md` 還原已追蹤檔案的修改，再
  `rm -rf tools/project-memory .project-memory AI_CONTEXT/PENDING.md AI_CONTEXT/CONTEXT_PACK.md AI_CONTEXT/README.md` 刪除新增的檔案／目錄
  （`tools/` 底下若還有其他工具子資料夾，只刪
  `tools/project-memory`，不要整個 `tools/` 資料夾一起刪）。
- 只想拿掉 smoke test 產生的那筆 pending：手動編輯
  `AI_CONTEXT/PENDING.md` 刪除 `### PEND-001` 那個區塊即可，其餘檔案
  不用動。
- 確認滿意後要正式收下：`git add` 上面列出的檔案清單並 `git commit`
  （依 RULES.md §二-2，`git push` 預設不用先問，但本次任務指示要求先
  commit、等使用者確認後才進一步動作，所以這次連 commit 都先讓使用者
  過目 diff 再決定）。
