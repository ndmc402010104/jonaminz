# DOCUMENT_STATUS — 文件狀態總表

本次盤點（2026-07-12）檢查過的所有主要文件，狀態欄位定義：

- **Current**：內容與程式碼／schema 現況一致，可直接信任。
- **Partially outdated**：大部分仍準確，但有具體過期段落（已修正或已標註）。
- **Historical / Superseded**：描述早期設計，已被更新的文件取代，本次已加狀態標記。
- **Draft**：規劃中文件，內容會隨進度改寫，非規格本身。
- **Needs verification**：內容看起來合理但本次盤點無法用程式碼交叉核對（多半是純流程/操作說明，或涉及正式環境當下狀態，本次未重新執行驗證）。

「是否權威」＝這份文件是不是對應主題目前唯一該信任的來源（同一主題如果
有多份文件，只有一份是權威，其餘是輔助或歷史）。

---

## AI_CONTEXT/（交接文件核心）

| 文件路徑 | 狀態 | 是否權威 | 最後核對日期 | 備註 |
|---|---|---|---|---|
| `AI_CONTEXT/RULES.md` | Current | Yes（規則類唯一權威） | 2026-07-12 | 逐條與程式碼／使用者裁決核對，內容準確，本次未修改 |
| `AI_CONTEXT/PROJECT_STATE.md` | Current | Yes（工程流水帳唯一權威） | 2026-07-12 | 全文 976 行逐段核對，與 `worker.js` 等原始碼高度一致，本次未修改 |
| `AI_CONTEXT/ARCHITECTURE.md` | Current | Yes（架構分層唯一權威） | 2026-07-12 | §7 已正確標示 Platform Integration 已實作範圍，未發現過期內容，本次未修改 |
| `AI_CONTEXT/ACCEPTANCE.md` | Current | Yes（驗收清單唯一權威） | 2026-07-12 | 純流程檢查清單，未發現與現況矛盾之處 |
| `AI_CONTEXT/CHANGELOG.md` | Current | Yes（變更歷史唯一權威） | 2026-07-12 | 1742 行，本次盤點大量引用其中的部署／驗證紀錄作為 FACTS.md 的證據來源 |
| `AI_CONTEXT/AGENT_BOOT_PROMPT.md` | Needs verification | No | 2026-07-12 | 未列入本次任務的必查清單，僅確認存在，未逐行核對內容 |
| `AI_CONTEXT/TASK_TEMPLATE.md` | Needs verification | No | 2026-07-12 | 同上，流程範本類文件，未逐行核對 |
| `AI_CONTEXT/FACTS.md` | Current | Yes（本次新增） | 2026-07-12 | 本次盤點新建 |
| `AI_CONTEXT/DECISIONS.md` | Current | Yes（本次新增） | 2026-07-12 | 本次盤點新建 |
| `AI_CONTEXT/CURRENT_STATE.md` | Current | Yes（本次新增） | 2026-07-12 | 本次盤點新建 |
| `AI_CONTEXT/KNOWN_ISSUES.md` | Current | Yes（本次新增） | 2026-07-12 | 本次盤點新建 |
| `AI_CONTEXT/EXPERIMENTS.md` | Current | Yes（本次新增） | 2026-07-12 | 本次盤點新建 |
| `AI_CONTEXT/SESSION_LOG.md` | Current | Yes（本次新增） | 2026-07-12 | 本次盤點新建 |
| `AI_CONTEXT/CHECKPOINTS.md` | Current | Yes（本次新增） | 2026-07-12 | 本次盤點新建 |
| `AI_CONTEXT/DOCUMENT_STATUS.md` | Current | Yes（本次新增） | 2026-07-12 | 本檔 |

## 入口指引檔（三份內容等價）

| 文件路徑 | 狀態 | 是否權威 | 最後核對日期 | 備註 |
|---|---|---|---|---|
| `CLAUDE.md` | Current | No（只是指引，內容以 AI_CONTEXT 為準） | 2026-07-12 | 與 AGENTS.md／copilot-instructions.md 內容等價，本次未修改 |
| `AGENTS.md` | Current | No | 2026-07-12 | 同上 |
| `.github/copilot-instructions.md` | Current | No | 2026-07-12 | 同上 |

## 根目錄與後端 README

| 文件路徑 | 狀態 | 是否權威 | 最後核對日期 | 備註 |
|---|---|---|---|---|
| `README.md` | Partially outdated → 已修正 | Yes（架構骨架說明唯一權威，但功能現況以 AI_CONTEXT 為準） | 2026-07-12 | 檔案結構圖原本漏列 `pages/admin/contracts/`／`pages/login/`／`pages/identity-relay/`／`sdk/`，本次已補充並加上指向 `AI_CONTEXT/CURRENT_STATE.md` 的提示 |
| `backend/README.md` | Current | Yes（Worker API 唯一權威） | 2026-07-12 | 逐項與 `worker.js` 核對（8 大功能、API 清單、JONAMINZ_ADMIN_TOKEN 淘汰說明）完全一致，本次未修改 |
| `pages/README.md` | Partially outdated → 已修正 | Yes（新增頁面流程唯一權威） | 2026-07-12 | 原本仍寫 2026-07-11 版「approve/reject 唯一有保護、靠 JONAMINZ_ADMIN_TOKEN」的舊敘述，本次已修正為現況（整站登入保護、ADMIN_TOKEN 已淘汰），並補上 login/identity-relay 兩頁說明 |

## docs/（Platform Integration 系列）

| 文件路徑 | 狀態 | 是否權威 | 最後核對日期 | 備註 |
|---|---|---|---|---|
| `docs/platform-integration-spec-v1.md` | Current（Frozen） | Yes（規格唯一權威，S1-S39） | 2026-07-12 | 本次僅讀取核對，**未修改**（RULES.md §一-12 明文禁止修改凍結條文，任何身分皆不可破例） |
| `docs/platform-integration-v1-implementation-plan.md` | Current | Yes（實作進度唯一權威，非規格） | 2026-07-12 | 第 1-9 項完成度標記與程式碼、CHANGELOG 完全吻合，本次未修改 |
| `docs/platform-integration-v1-acceptance-tests.md` | Current | Yes（驗收紀錄） | 2026-07-12 | 13 項情境逐條核對，狀態標記準確，未修改 |
| `docs/sdk-release-checklist.md` | Current | Yes（發版流程唯一權威） | 2026-07-12 | 純流程文件，與 `sdk/generate-sdk-release.mjs` 等實際腳本行為一致，未修改 |
| `docs/contract-schema/README.md` | Current | Yes（Contract Schema 設計依據） | 2026-07-12 | RC3.1 定案內容與 `jonaminz.contract.schema.json`／`contract-validation.js` 一致，未修改 |
| `docs/roadmap-202607.md` | Current | Yes（待辦排序唯一權威） | 2026-07-12 | 順序①-④已標記完成且與 CHANGELOG 對應日期條目吻合，未修改 |
| `docs/frontend-quality-plan-202607.md` | Partially outdated → 已修正 | Yes（階段②③規劃依據；階段①已完成） | 2026-07-12 | 階段①原本整份寫成未來式規劃語氣，未標記完成，本次已在標題加註「✅ 完成並已上線」並指向實際落地檔案與 CHANGELOG 條目，階段②③維持原樣（未實作） |
| `docs/external-project-manifest.md` | Current（v0 現行機制） | Yes（v0 拉模式唯一權威） | 2026-07-12 | 仍是現行有效機制（作廢需三條件，見 RULES.md §四，均未成立），本次未修改 |
| `docs/platform-integration-consensus.md` | Historical / Superseded → 已標記 | No（已被 spec-v1.md 取代） | 2026-07-12 | 本次加上狀態標記，內容本身未刪改 |
| `docs/platform-integration-spec-review.md` | Historical / Superseded → 已標記 | No | 2026-07-12 | 同上 |
| `docs/platform-integration-review-request.md` | Historical / Superseded → 已標記 | No | 2026-07-12 | 同上（RFC 本體，文件自身已註明「已凍結、不再修改」，本次標記與此不衝突，只新增指向現況的說明） |
| `docs/platform-integration-review-consolidation.md` | Historical / Superseded → 已標記 | No | 2026-07-12 | 同上 |
| `docs/platform-integration-reviews/review-chatgpt.md` | Historical / Superseded → 已標記 | No | 2026-07-12 | 五份 Review 原文照錄之一，本次僅新增狀態標記，原文未改 |
| `docs/platform-integration-reviews/review-claude-fable.md` | Historical / Superseded → 已標記 | No | 2026-07-12 | 同上 |
| `docs/platform-integration-reviews/review-codex.md` | Historical / Superseded → 已標記 | No | 2026-07-12 | 同上 |
| `docs/platform-integration-reviews/review-gemini.md` | Historical / Superseded → 已標記 | No | 2026-07-12 | 同上 |
| `docs/platform-integration-reviews/review-perplexity.md` | Historical / Superseded → 已標記 | No | 2026-07-12 | 同上 |
| `docs/platform-integration-reviews/acceptance-review-spec-v1-rc.md` | Historical / Superseded → 已標記 | No | 2026-07-12 | RC 驗收意見，已全數處置並吸收進 Frozen 規格，本次僅新增狀態標記 |

## 其他

| 文件路徑 | 狀態 | 是否權威 | 最後核對日期 | 備註 |
|---|---|---|---|---|
| `sdk/` 底下的 SDK README／註解 | Needs verification | No | 2026-07-12 | `sdk/` 資料夾沒有獨立 README，說明都在各檔案頂部註解裡，本次已隨程式碼一併讀過（見 `FACTS.md`），未發現矛盾，但未列出獨立條目逐一核對每個 `sdk-<hash>.js` 產出檔案本身（immutable 產物，本來就不該手動核對內容） |

---

## 本次未觸碰、但屬於敏感/非文件範圍的檔案（提醒用，非狀態表項目）

- 根目錄 `google oAuth pw.json`、`suprabase db pw.txt`：敏感憑證檔案，
  `.gitignore` 已排除，本次盤點沒有讀取、搬移或處理這兩個檔案，任務範圍
  也明確不涉及。
