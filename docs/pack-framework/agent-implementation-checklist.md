# Agent Implementation Checklist — ADPF

原始附件，使用者與 ChatGPT 驗證 ADPF 提案時一併提供，逐字保留（英文
原文）。完整脈絡見同資料夾 `README.md`。

## Before coding
- Read the report.
- Identify one concrete Pack Type and its owner App.
- Separate App Theme, layout/master, domain data, and Pack payload.
- Freeze `packType`, envelope version, and forbidden fields.

## Must implement
- Prompt Recipe version.
- Prompt Builder.
- fenced JSON extraction.
- envelope validation.
- app payload validation.
- semantic validation.
- forbidden-field guard.
- preview fixture and renderer.
- import without apply.
- exact-version binding.
- optimistic queue, retry, rollback, offline state.
- export and audit metadata.

## Must not implement
- arbitrary CSS / JS / HTML import.
- `eval` or dynamic script insertion.
- silent Pack upgrade.
- direct DB calls from UI components.
- Core interpretation of App-specific payload.
- AI-generated auth, permissions, SQL, secrets, deployment commands.

## Required handoff files

原文列的是通用建議，本專案實際對應到
`AI_CONTEXT/{FACTS,DECISIONS,CURRENT_STATE,KNOWN_ISSUES,EXPERIMENTS,
SESSION_LOG}.md`（`CHECKPOINTS.md` 也存在，收動作級記錄）——不是另外
新建一組同名檔案。
