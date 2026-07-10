# CHANGELOG — 專案變更紀錄（AI agent 交接用）

規則：
- 新紀錄加在**最上面**（reverse chronological）。
- 每完成一個任務追加一筆，格式照下方模板。git log 記「改了什麼檔案」，
  這裡記「為什麼改、狀態怎麼變、下一棒要知道什麼」——兩者不重複。
- 不要改寫或刪除歷史紀錄；寫錯就追加更正紀錄。

## 紀錄模板

```markdown
## YYYY-MM-DD — 〔一句話標題〕

- **任務**：〔任務單標題或一句話描述〕
- **變更**：〔改了什麼，工程視角，2-5 行〕
- **狀態變化**：〔PROJECT_STATE 的哪些項目從未完成→完成，或新增了什麼未完成項〕
- **遺留**：〔未完成/已知問題/給下一棒的注意事項；沒有就寫「無」〕
- **版本**：〔version.js 的新版本號；未 bump 寫「無程式碼變更」〕
```

---

## 2026-07-10 — 五份 Review 收齊、彙整定案、產出 Spec v1.0 RC

- **任務**：收集 5 份 Architecture Review（Codex/ChatGPT/Gemini/Claude Fable
  ［含 F2 立場修正］/Perplexity）→ 彙整 → 使用者裁決 → 撰寫 Specification v1.0 RC。
- **變更**：新增 `docs/platform-integration-reviews/`（五份一份一檔）、
  `docs/platform-integration-review-consolidation.md`（共識定案＋裁決紀錄）、
  `docs/platform-integration-spec-v1.md`（**Spec v1.0 RC，凍結條文 S1–S38**）。
- **狀態變化**：四項裁決已定——D1 Ready 介面＝inline Promise stub（await
  Jonaminz.ready 為唯一保證路徑，不做 command queue）；D2 跨源身份＝v1 外部
  專案一律匿名；D3＝11 個 Service 名與 components/full/self 降為 reserved；
  D4 合約核准＝observed/approved 兩態＋手動核准。共識定案含：錯誤模型
  reject（4:1）、loader＋版本指標（5:0）、推送≠採信、物件定址凍結、
  交集公式在 Worker 算、CSS token `--jz-` 前綴等，見彙整報告第壹部分。
- **遺留**：Spec v1.0 RC **待使用者驗收後才標 Frozen**；驗收後下一步＝
  JSON Schema＋Contract 範本＋SDK 骨架。既有 theme-runtime 變數改名
  `--jz-*`（S36）屬未來實作項。
- **版本**：無程式碼變更（未 bump）。

## 2026-07-10 — 發布 Platform Integration RFC，固定規格定稿流程

- **任務**：把 Review Request 定稿為正式 RFC，固定「先收齊意見再定稿」的流程。
- **變更**：新增 `docs/platform-integration-review-request.md`（RFC，已凍結）。
  內容＝使用者草稿＋四項補完：①尺度與限制節（兩位使用者、first-party only、
  靜態託管無 build、一人維護——要求審查者以此校準，不照搬大平台做法）；
  ②新增挑戰問題 9-12（錯誤模型二選一、SDK ready 介面、常青 SDK kill-switch、
  推模式 Origin 威脅模型）；③回覆格式要求（嚴重度標註＋對應問題編號）；
  ④檔頭狀態標記與 Review 收檔位置。
- **狀態變化**：Platform Integration 流程固定為
  Draft Spec → RFC → 收集 3~5 份 Review → 彙整 → Spec v1.0（Frozen）→
  Schema → SDK。**收 Review 期間不改規格**。目前＝RFC 已發布、等待 Review。
- **遺留**：`docs/platform-integration-reviews/` 資料夾等第一份 Review 進來時
  建立，一份一檔。彙整由使用者發起，不要收到一份就動規格。
- **版本**：無程式碼變更（未 bump）。

## 2026-07-10 — 建立 AI_CONTEXT 記憶水庫（含使用者審查修正後定案）

- **任務**：建立 AI 專案記憶水庫，讓任何 agent 不依賴聊天記憶即可接手；
  使用者審查後修正並定案數項規則。
- **變更**：新增 `AI_CONTEXT/` 七份文件：PROJECT_STATE.md（現況盤點）、
  RULES.md（禁止/允許事項）、ARCHITECTURE.md（分層/資料流/設定流/部署流）、
  TASK_TEMPLATE.md（任務單模板）、ACCEPTANCE.md（通用驗收清單）、
  CHANGELOG.md（本檔）、AGENT_BOOT_PROMPT.md（新 agent 啟動 prompt）。
  另新增三個等價的工具入口檔：`CLAUDE.md`（Claude Code）、`AGENTS.md`
  （Codex 等 CLI agent）、`.github/copilot-instructions.md`（VS Code 聊天
  agent）——內容只指向 `AI_CONTEXT/`，單一事實來源在 `AI_CONTEXT/` 內。
  純文件任務，未動任何程式碼/HTML/CSS/JS/設定檔/DB schema。
- **狀態變化**：無功能變化。文件化既有狀態之外，使用者審查定案了以下規則
  （已寫入 RULES.md / ACCEPTANCE.md）：
  1. 版本 bump 規則：純 `AI_CONTEXT/`、`docs/`、README 類文件修改**不 bump**
     `version.js`；程式碼/HTML/CSS/JS/設定檔/DB schema/部署行為變更才 bump。
  2. 新增檔案僅限任務單白名單明確允許的路徑，不得成為繞過白名單的手段。
  3. `wrangler deploy` 須任務單明確授權，否則部署前先問。
  4. `saveThemeCssRules` 在 Auth 落地前僅限任務單明確要求時才能呼叫寫入。
  5. `docs/external-project-manifest.md`（v0 機制）不因 Platform 規格定稿
     而作廢；須「新 SDK 實作完成＋遷移完成＋使用者明確宣布 deprecated」
     三條件全成立才作廢。
  另實測確認（VERIFIED 2026-07-10）：apex `https://jonaminz.com` 301 轉址至
  `https://www.jonaminz.com/`；SDK canonical host 待 Platform 規格定稿時凍結，
  暫定保留 `https://jonaminz.com/sdk/...`，apex 轉址視為平台基礎設施合約。
- **遺留**：PROJECT_STATE.md §7 剩 2 個 UNKNOWN（Supabase 專案位置、兩張表
  實際資料內容）。RULES.md §4 已無待確認項。
- **版本**：無程式碼變更（未 bump，符合本次定案的版本規則）。
