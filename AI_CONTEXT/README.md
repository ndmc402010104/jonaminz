# AI_CONTEXT/ 目錄說明

本資料夾是這個 repo 的 AI 交接文件單一事實來源。每份文件的責任互不
重疊，寫入前先確認你要寫的內容屬於哪一份，不要混著寫。

| 文件 | 只能放 | 不能放 |
|---|---|---|
| `FACTS.md` | 已用程式碼／schema／設定檔驗證過的事實 | 推測、偏好、未驗證說法、未完成構想 |
| `DECISIONS.md` | 使用者已明確裁決或已正式採用的決策 | 討論中、未拍板的想法（那些放 EXPERIMENTS.md） |
| `CURRENT_STATE.md` | 目前真實的實作狀態 | 理想架構、未來規劃、未驗證的完成宣稱 |
| `KNOWN_ISSUES.md` | 已知且仍存在的問題 | 已修好卻沒標記 resolved 的舊問題 |
| `EXPERIMENTS.md` | 未定案的想法、測試、候選方案 | 被當成既定決策使用 |
| `SESSION_LOG.md` | 每輪工作的結構化記錄（append-only） | 正式事實或決策本體 |
| `CHECKPOINTS.md` | 可安全回退的版本、驗收狀態、已知限制 | 一般工程流水帳（那些放 PROJECT_STATE.md／CHANGELOG.md） |
| `PENDING.md` | 尚未被確認的候選內容（fact/decision/issue/experiment） | 直接當成正式真相使用 |
| `CONTEXT_PACK.md` | 什麼都不要手動寫，這是自動產物 | — |

## 寫入規則

1. 新事實與新決策一律先進 `PENDING.md`（透過
   `node tools/project-memory/memory.mjs record`），不得由 Agent
   直接寫進 `FACTS.md`／`DECISIONS.md`。
2. 把 pending 內容「升級」成正式內容，必須是使用者在當前任務中明確
   要求的動作，不是 Agent 自行判斷。
3. `DECISIONS.md` 不得直接刪除舊決策；新決策取代舊決策時，把舊決策
   標記為 `superseded` 並互相引用。
4. `CONTEXT_PACK.md` 只能透過 `memory.mjs start`／`close` 重新產生，
   不得手動編輯——手動編輯過的版本會被 `memory.mjs check` 抓到（缺少
   或內容跟 AUTO-GENERATED 標記不符）。

## 禁止事項

- 不得把本資料夾以外的正式產品程式碼／Worker／Supabase schema 當成
  這個文件系統的一部分來管理。
- 不得為了讓 Context Pack 看起來更完整而在正式文件裡塞未驗證內容。
- 不得繞過 `PENDING.md` 直接修改正式真相文件來「省一步」。

完整工具說明見 `tools/project-memory/README.md`。
