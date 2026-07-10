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

## 2026-07-10 — Contract JSON Schema 第二輪 review 修正 → RC3，設計面定案

- **任務**：使用者再拿 RC2 給外部 review，帶回 1 個真正的安全漏洞＋
  3 個開放設計決策的裁決意見，逐條核實後修正、落成 RC3。
- **變更**：`jonaminz.contract.schema.json`：`contractUrl` 的 pattern 從
  `^(https://\S+|/(?!/)\S*)$` 改成
  `^(https://[^\s\\]+|/(?![/\\])[^\s\\]*)$`——用 Node 的 `new URL()`
  實測確認 WHATWG URL parser 對 https 這類 special scheme 會把 `\`
  正規化成 `/`，導致 `/\evil.example/a` 這種「看起來是 path-absolute」
  的字串實際解析成 `https://evil.example/a`（跟 RC2 修過的 `//` protocol-
  relative 繞過是同一類問題的變形，RC2 沒堵住）；新 pattern 全面禁止
  反斜線出現在字串任何位置。`capabilities.requires` 加上
  `uniqueItems: true`（只能擋完全相同的物件重複，語意重複仍留給
  Worker）。用 7 組新反例（4 種反斜線變體皆 invalid、2 種既有合法形式
  仍 valid、requires 完全重複 invalid）驗證修正正確。`README.md`：
  補充反斜線繞過的說明與教訓（「regex 對 URL 只能語法粗篩，真正邊界要
  在 Worker 用標準 URL parser 重算」）；`entries`/`objects` 陣列形狀、
  `css` 單一字串兩點設計決策改列「已確認」；`$id` 是否/何時正式發布
  改列進新增的「進 Worker 前的 release checklist」小節。
  `platform-integration-v1-implementation-plan.md` 第 2 項補上完整的
  Worker 端 URL 驗證清單（反斜線直接拒絕、WHATWG URL parser、https-only、
  origin 精確比對、禁帳密、redirect 逐跳重驗、正規化後存值+原始值
  audit）與 cross-field 檢查清單（entryId/objectType 重複處理、
  requests/requires ⊆ supports、requires.entryId 參照一致性），避免
  這輪 review 的具體建議在交接時流失。
- **狀態變化**：Contract Schema 草稿 → RC2 → **RC3，設計面視為定案**。
  implementation plan 第 1 項完成度：schema 本體已無已知漏洞，僅剩
  `$id` 正式發布時機一個待辦（不擋 Worker 開工）。第 2 項（Worker 端
  合約收取）**仍未開始**，但工作清單已比 RC2 時更具體。
- **遺留**：無新遺留；既有的「schema 做不到的 cross-field 檢查」已從
  README 的敘述性提醒，落實成 implementation-plan.md 裡可執行的清單。
- **版本**：無程式碼變更（未 bump；純 `docs/` 修訂）。

## 2026-07-10 — Contract JSON Schema 一輪外部 review 修正 → RC2

- **任務**：使用者拿草稿給外部 review，帶回 4 點問題，逐條核實後修正。
- **變更**：`jonaminz.contract.schema.json`：①`css` 從 `enum: ["none","tokens"]`
  改成語法層 pattern（`^[a-z][a-z-]{0,49}$`）——閉合 enum 會讓未來出現
  `components` 時整份合約直接 invalid，違反 S11「未知 enum 值視為不支援，
  不得整份判失敗」；②`contractUrl` pattern 從 `^(https://|/)\S*$` 改成
  `^(https://\S+|/(?!/)\S*)$`——原本 `//evil.example.com/a` 這種
  protocol-relative URL 會被誤判合法，實際上瀏覽器會解析成任意網域的
  https:，是真的安全漏洞；同時刻意仍不開放無開頭斜線的相對路徑（如
  `assets/icon.png`），因為那與 `javascript:`/`data:` 等 scheme:opaque URL
  在字串層難以可靠區分；③新增 `$defs/forbiddenFieldsGuard` 並套用到
  `app`／`objects[]` 項目／`capabilities`／`capabilities.requires[]`
  項目——原本只有頂層和 `entry` 有 S9 禁用欄位守衛，`app.permissions`
  這類寫法會靜默通過 schema；④capability 文法改純 kebab-case，拿掉
  camelCase（`sharedCache` 這類保留名字本身是「發布前可改名」，現在改
  是免費的）。同時修正 `forbiddenFieldsGuard` 的 `anyOf` 分支補上
  `type: object`，消除 ajv strict-mode 警告。`jonaminz.contract.example.json`
  修正 `supports` 未涵蓋 `requests`/`requires` 用到的能力這個自相矛盾
  （這個不變式本身留給 Worker 端 cross-field 檢查，schema 做不到）。
  `README.md` 大幅補充「URL 驗證」「css 欄位」「capability 文法」「禁用欄位
  守衛」四節說明修正理由，並補上一張正反例驗證結果表。用
  `npx ajv-cli validate --spec=draft2020` 跑過範例＋7 組正反例（protocol-relative
  URL、巢狀禁用欄位×2、css 保留值、camelCase/kebab-case capability、
  無斜線相對路徑）全數符合預期。
- **狀態變化**：草稿 → RC2（1 輪外部 review 已吸收）。開放設計決策從
  6 點收斂為 5 點（其中 2 點仍是已確認定案，3 點暫定未挑戰）。
- **遺留**：`requests`/`requires[].capability` ⊆ `supports` 的 cross-field
  不變式、`entryId` 參照一致性，都明確記在 README／schema description 裡
  留給 Worker ingestion（implementation plan 第 2 項），非本次遺漏。
- **版本**：無程式碼變更（未 bump；純 `docs/` 修訂）。

## 2026-07-10 — Contract JSON Schema 兩點設計決策定案

- **任務**：使用者針對草稿 README 列出的 6 點開放設計決策中的 2 點
  （最具結構影響力的兩點）做出裁決。
- **變更**：`jonaminz.contract.schema.json` 的 `capabilityRequirement`
  改為 `entryId` 必填（原草稿是可選，代表「省略＝綁定整個合約」）；
  裁決結果：v1 不支援合約層級 requires，每筆 requires 都必須明確指到
  一個 entry，避免「省略到底是指整個 App 還是忘記填」的模糊狀態，未來
  真的需要時再加明確的 scope 欄位。`README.md` 的「not 反面表列是否過嚴」
  一點裁決維持現狀（出現 enabled/permissions/token 等禁用欄位＝整份
  合約 invalid，不只是忽略該欄位）。README 兩點決策改標「已確認」，
  範例＋新反例（requires 缺 entryId）重跑 `npx ajv-cli` 確認行為正確。
- **狀態變化**：6 點開放設計決策中 2 點定案，4 點仍待挑戰（見
  PROJECT_STATE.md §4）。
- **遺留**：剩 4 點（entries/objects 陣列形狀、css 欄位形狀、`$id`
  placeholder、capability 正則允許 camelCase）風險較低、暫定可用；
  下一棒若要動 implementation plan 第 2 項（Worker 端合約收取），開工前
  最後確認一次這 4 點是否也要處理，或直接視為定案。
- **版本**：無程式碼變更（未 bump；純 `docs/` 修訂）。

## 2026-07-10 — Contract JSON Schema 草稿（implementation plan 第 1 項）

- **任務**：使用者指示開始做 Contract JSON Schema，依
  `docs/platform-integration-v1-implementation-plan.md` 排定的第 1 項。
- **變更**：新增 `docs/contract-schema/`：`jonaminz.contract.schema.json`
  （JSON Schema draft 2020-12，逐條對應 S1-S39）、
  `jonaminz.contract.example.json`（範本，欄位命名沿用 v0
  `jonaminz-app.json` 習慣）、`README.md`（逐欄位對應規格條文＋6 點
  規格未明文釘死、由本次判斷的設計決策，標記待使用者確認）。用
  `npx ajv-cli validate --spec=draft2020` 跑過範例（valid）與三個反例
  （缺 `enabled` 等禁用欄位／非法 `projectId`／非法 capability 文法，
  皆 invalid）確認 schema 本身邏輯正確。純文件/schema 草稿，未動任何
  程式碼/HTML/CSS/JS/設定檔，也未讓任何現行系統消費這份 schema。
- **狀態變化**：PROJECT_STATE.md §4「尚未完成的功能」更新：implementation
  plan 第 1 項從「尚未開始」→「已產出草稿，待確認」。第 2 項（Worker
  端合約收取）**未開始**，等第 1 項確認後才進行。
- **遺留**：README 列的 6 點設計決策（entries/objects 陣列形狀、
  `capabilities.requires` 綁定方式、`css` 欄位形狀、防呆 `not` 清單是否
  過嚴、`$id` 為未架設的 placeholder、capability 正則允許 camelCase）
  需使用者確認或修正；schema 本身只做結構驗證，S12 fail-soft／S15 同源
  ／跨欄位 entryId 一致性檢查明確留給 implementation plan 第 2 項的
  Worker ingestion validator，不是這份 schema 檔案的職責（已在 README
  註明範圍）。
- **版本**：無程式碼變更（未 bump；純 `docs/` 草稿，依 RULES.md §2-1
  不 bump `version.js`）。

## 2026-07-10 — Specification v1.0 正式 Frozen

- **任務**：RC2 通過驗收，做兩項一致性最小修訂後標 Frozen。
- **變更**：①`status`／`diagnostics` 職責分離——`Jonaminz.status` 是生命
  週期狀態字串，詳細診斷面統一為 `Jonaminz.diagnostics`（S26）；
  ②snippet 加永久身分標記 `__snippetVersion: 1`（settle 後保留，
  `__bootstrap` 內部 reference 仍刪除），S22 明定 SDK 以此標記辨識官方
  snippet 物件、無標記才視為命名空間被佔用。
  `platform-integration-spec-v1.md` 狀態改為 **Frozen**；RULES.md 新增
  第 12 條禁令（S1–S39 條文不可修改）。
- **狀態變化**：Platform Integration 規格定稿流程**全部完成**。
  下一階段＝JSON Schema → Contract 範本 → SDK（依 implementation-plan），
  **本次未開始任何實作**（遵使用者指示）。
- **遺留**：無。
- **版本**：無程式碼變更（未 bump）。

## 2026-07-10 — RC 驗收 review 修正 → Spec v1.0 RC2

- **任務**：使用者轉交一份驗收階段 review（判定「RC 合格、Frozen 暫緩」，
  七項架構級＋數項文字級修正），全數採納修入規格。
- **變更**：`platform-integration-spec-v1.md` 升為 **RC2**——S21 snippet
  全面重寫（reject/onerror/15s timeout/settle 清理/jz===window.Jonaminz）、
  S13 snapshot 三態＋active 指標、S14 canonical hash＋audit 欄位、S15 擴及
  全部 URL 欄位、S31 明定 Approved Contract、S32 限定已發布 service、
  S5 resolver 移保留層、新增 S39 回滾相容規則、retryable 改字、S7 用語
  統一。新增 `platform-integration-v1-implementation-plan.md`（工作清單
  自規格拆出）；驗收 review 歸檔於
  `platform-integration-reviews/acceptance-review-spec-v1-rc.md`（含處置表）。
- **狀態變化**：Spec 狀態 RC → **RC2，待使用者最終驗收後標 Frozen**。
- **遺留**：驗收通過後標 Frozen ＋ 把「S 條文不可修改」寫進 RULES.md，
  才進 JSON Schema／SDK。
- **版本**：無程式碼變更（未 bump）。

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
