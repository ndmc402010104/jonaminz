# 可直接貼給接手 Agent 的 Prompt

你正在接手 **Jonaminz Chat**。

正式 Repo：

```text
ndmc402010104/jonaminz
```

我會提供一個交接包。請先完整閱讀：

```text
00_START_HERE.md
AI_CONTEXT/FACTS.md
AI_CONTEXT/DECISIONS.md
AI_CONTEXT/CURRENT_STATE.md
AI_CONTEXT/KNOWN_ISSUES.md
AI_CONTEXT/EXPERIMENTS.md
AI_CONTEXT/CHECKPOINTS.md
```

再查看：

```text
SOURCE/ux-mvp-v0.11
SOURCE/technical-mvp-0.1-FAILED
```

## 重要背景

- UX 概念已經足夠，不要再花時間雕畫面。
- Chat 是 Core＋System App。
- Shared 是 Chat 裡的共享內容模組，不是獨立 App。
- 後台主頁只顯示摘要。
- UX v0.11 是概念 checkpoint。
- Technical MVP 0.1 使用者只回報「失敗」，沒有錯誤紀錄。
- 你不可假設根因。
- 你必須先在 Windows／瀏覽器環境重現並留下具體證據。

## 你的第一個任務

不要直接做正式功能，也不要部署。

請完成一份 **Technical Failure Reproduction & Architecture Review**：

1. 檢查正式 Repo 最新狀態。
2. 確認現有登入 session、Worker、backend-client、Capacitor App。
3. 重現 `technical-mvp-0.1-FAILED`。
4. 記錄：
   - 執行指令
   - 終端輸出
   - HTTP 結果
   - Console error
   - 哪個檔案／哪行
5. 判斷：
   - 可最小修復
   - 應重建 local technical harness
   - 技術架構本身需調整
6. 更新結構化紀錄：
   - FACTS
   - DECISIONS
   - CURRENT_STATE
   - KNOWN_ISSUES
   - EXPERIMENTS
   - SESSION_LOG
   - CHECKPOINTS

## 第一個真實里程碑

只有這條：

```text
Jonathan 真實登入
→ 傳文字
→ Minz 真實登入即時收到
→ 未讀增加
→ Minz 打開
→ 已讀 committed
→ Jonathan 看見 read receipt
```

再加：

```text
typing
reaction
reconnect
```

## 禁止事項

- 不再做 UX v0.12 美化。
- 不把 Prototype 單檔 HTML 當正式架構。
- 不把 Supabase secret 放前端。
- 不信 client 自報 identity。
- 不建立平行的未受控 Auth。
- 不先做 OneDrive、電話、Shared 正式資料或 Android Overlay。
- 不改 Frozen Platform S1–S39。
- 不動 reservoir 01–06。
- 未經使用者明確授權，不部署 Worker、不執行正式 DB migration。
- 不要一邊猜一邊 patch。

## 回報格式

請先只交付：

1. 失敗重現結果
2. 根因清單（已證實／待證實分開）
3. 可保留成果
4. 建議技術架構
5. 最小修改白名單
6. Technical MVP 驗收案例
7. 安全回退點

等使用者裁決後才動正式程式。
