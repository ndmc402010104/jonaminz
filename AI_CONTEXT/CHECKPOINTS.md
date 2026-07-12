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
