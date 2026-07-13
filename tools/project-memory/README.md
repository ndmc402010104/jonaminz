# Project Memory v0.1

輕量級跨 session 記憶工具，降低 Claude／Codex／Cursor 等 agent 跨
session 工作時的失憶、重複決策與文件污染。純 Node.js built-in
module，沒有資料庫、沒有雲端同步、沒有 LLM API、沒有任何 npm 依賴。

## 這個工具做什麼

1. **每次開工前**：`memory.mjs start` 產生一份精簡、確定性組成的
   `AI_CONTEXT/CONTEXT_PACK.md`——把 RULES／FACTS／DECISIONS／
   CURRENT_STATE／KNOWN_ISSUES／CHECKPOINTS／SESSION_LOG／PENDING
   八份文件的重點濃縮進一份檔案，agent 開工前只要讀這一份。
2. **工作中**：`memory.mjs record` 把新發現的事實、決策、問題、實驗
   想法寫進 `PENDING.md`（未確認候選），不直接動 `FACTS.md`／
   `DECISIONS.md` 這類正式真相文件。
3. **收尾時**：`memory.mjs close` 把這輪做了什麼、改了哪些檔案、驗證
   結果、下一步，結構化寫進 `SESSION_LOG.md`（append-only）。

## 核心規則（不能違反）

- **正式真相文件（`FACTS.md`／`DECISIONS.md`）只能由人決定要不要收下
  candidate。** 這個 CLI 沒有任何指令會自動把 `PENDING.md` 的內容搬進
  正式文件——把某筆 pending 標成 `confirmed`／`promoted`，或手動把內容
  抄進 `FACTS.md`／`DECISIONS.md`，永遠是使用者在當前任務中明確要求
  才能做的動作。
- **`CONTEXT_PACK.md` 是唯一的自動產物，不能手動編輯。** 每次
  `start`／`close`／`record`（僅限 fact/decision/issue/experiment）都
  會重新產生，手動改過的版本會被 `check` 抓到。
- **`ledger.jsonl` 只能 append**，不會重寫或刪除任何一行既有事件。

## 安裝

沒有安裝步驟。第一次使用先跑：

```powershell
node tools/project-memory/memory.mjs init
```

`init` 只會新增缺少的檔案／目錄，不會覆蓋任何已存在的內容，可以重複
執行。它同時會：

- 在 `.gitignore` 補上 `.project-memory/current-session.json`／
  `.project-memory/snapshots/`（一律不進版控），以及依照
  `.project-memory/config.json` 的 `commitLedger` 決定
  `.project-memory/ledger.jsonl` 要不要一併排除（預設 `false`，也就是
  預設排除——本機事件記錄，不是給團隊共用的紀錄）。
- 在 `AGENTS.md`／`CLAUDE.md`（如果存在）插入一段標記包起來的
  Workflow 說明（`<!-- PROJECT_MEMORY_START -->`…
  `<!-- PROJECT_MEMORY_END -->`），重複執行只會更新標記內的內容，不會
  重複插入、也不會動標記以外的原有內容。

## 六個指令

```powershell
node tools/project-memory/memory.mjs init
node tools/project-memory/memory.mjs start --agent <agent> --task "<task>" [--force]
node tools/project-memory/memory.mjs record <fact|decision|issue|experiment|note|checkpoint|validation> --summary "<text>" [--reason "<text>"] [--scope <scope>] [--file <path>]...
node tools/project-memory/memory.mjs close --done "<text>" [--changed <path>] [--validation "<text>"] [--next "<text>"] [--issue "<text>"] ...（除 --done 外皆可重複多次）
node tools/project-memory/memory.mjs check
node tools/project-memory/memory.mjs status
```

### `record` 的兩種行為

- `decision`／`fact`／`issue`／`experiment`：寫進 ledger（type 是
  `<type>_candidate`）**且**新增一筆到 `PENDING.md`。`decision` 一定要
  帶 `--reason`，其餘可省略。
- `note`／`checkpoint`／`validation`：只寫進 ledger（type 就是這個
  名字本身），不進 `PENDING.md`——這些是操作記錄，不是需要人工確認的
  候選真相。

## 已知限制（v0.1，誠實記錄不是藏起來）

- **`DECISIONS.md`／`FACTS.md` 目前不是結構化格式。** 這個 repo 既有的
  `DECISIONS.md` 是自由文字記述（編號清單＋大量說明文字），不是
  `## DEC-NNN` + `- Status: active` 這種機器可讀格式。`Context Pack` 的
  Active Decisions 抽取邏輯（`lib/context.mjs` 的
  `extractActiveDecisions`）**優先嘗試**辨識 `## DEC-NNN` 結構化條目；
  掃不到任何一筆時會明確標註「改用文字截取，不是結構化清單」並退回
  確定性截斷——這是刻意的誠實備援，不是假裝解析成功。之後如果決定要
  把既有決策遷移成結構化格式，`extractActiveDecisions` 不用改，會自動
  開始正確運作。
- **Context Pack 的截斷是逐段固定預算，不是動態配平。** 每個區塊
  （Critical Rules／Confirmed Facts／…）各自有一個字數上限
  （`lib/context.mjs` 的 `DEFAULT_BUDGETS`），總長度超過
  `config.json` 的 `contextMaxCharacters` 時，依優先序（低優先度先犧牲：
  Pending → Recent Sessions → Recent Checkpoints → Confirmed Facts →
  Known Issues → Current State → Active Decisions → Critical Rules）
  逐段再砍一半，不是真正的動態字數配平演算法——對一份文件動輒上萬字的
  repo 而言，這個簡化在實務上夠用，但不是理論最佳解。
- **`status` 的「Active decisions」計數只算結構化 `DEC-NNN` 條目**，
  目前這個 repo 是 0（因為還是自由文字格式），不代表真的沒有任何已裁決
  的架構方向——真實決策數量要看 `DECISIONS.md` 本身。
- **沒有多 agent 併發鎖定。** 兩個 agent 同時對同一個 repo 跑
  `memory.mjs` 可能互相覆蓋 `current-session.json`（`start` 的
  active-session 檢查只防「同一個 agent 忘記 close 又重新 start」，
  不是真正的鎖）——v0.1 明確排除這個範圍（見任務指示的絕對限制）。

## 測試

```powershell
node --test tools/project-memory/test/memory.test.mjs
```

14 個測試，全部在 `os.tmpdir()` 底下的臨時目錄執行（透過
`PROJECT_MEMORY_ROOT` 環境變數覆蓋 root，見 `lib/files.mjs`），不會碰
真實的 `AI_CONTEXT/`。

## 檔案結構

```text
tools/project-memory/
├── memory.mjs              CLI 入口，六個指令的實作
├── lib/
│   ├── files.mjs           路徑解析、檔案讀寫（唯一支援
│   │                       PROJECT_MEMORY_ROOT 環境變數覆蓋的地方）
│   ├── ids.mjs              eventId／sessionId／PEND-NNN 產生器
│   ├── ledger.mjs           ledger.jsonl 的 append／讀取
│   ├── context.mjs          CONTEXT_PACK.md 生成邏輯（確定性文字截取，
│   │                       不用 LLM）
│   └── validators.mjs       check 指令的檢查邏輯
├── test/
│   └── memory.test.mjs      node --test，14 項驗收情境
└── README.md                本檔
```
