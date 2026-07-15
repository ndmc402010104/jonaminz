# PENDING — 未確認候選內容

本檔收 `memory.mjs record` 寫入的候選內容。Status 只有四種：
`pending`／`confirmed`／`rejected`／`promoted`。**只有使用者在當前
任務中明確要求，Agent 才能把某筆 pending 改成其他狀態或把內容搬進
FACTS.md／DECISIONS.md 等正式文件**，不得自行判斷「這應該算確認過了」。

每筆格式固定：

```markdown
### PEND-NNN
- Type: <fact|decision|issue|experiment>
- Status: <pending|confirmed|rejected|promoted>
- Created: <ISO timestamp>
- Session: <sessionId>
- Scope: <字串，可留空>
- Summary: <一句話>
- Reason: <理由或證據，可留空>
- Files:
  - <相關檔案路徑，可省略整個清單>
```

（上面是格式範例，標題 `PEND-NNN` 不是真實編號，不會被工具當成一筆
候選內容解析——真實條目的編號永遠是純數字接在 `PEND-` 後面，由
`memory.mjs record` 自動編號，不需要手動填寫。）

---

## Pending Facts

### PEND-002
- Type: fact
- Status: pending
- Created: 2026-07-15T14:25:30.891Z
- Session: session_20260715142203_50cfb2a4
- Scope: 
- Summary: ensureImageUrls整批失敗未標記itemId，導致下載連結永遠卡在「還在準備中」
- Reason: 
- Files: (none)

## Pending Decisions

### PEND-001
- Type: decision
- Status: pending
- Created: 2026-07-13T05:17:20.557Z
- Session: session_20260713051704_e0823ba0
- Scope: memory
- Summary: 正式文件與自動紀錄分離
- Reason: 避免自動抽取污染正式真相
- Files: (none)

## Pending Issues

## Pending Experiments
