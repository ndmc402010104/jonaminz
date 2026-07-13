# Jonaminz Chat 交接包

日期：2026-07-14  
正式 Repo：`ndmc402010104/jonaminz`  
交接狀態：**UX 概念已完成；Technical MVP 0.1 使用者回報失敗，尚未取得具體錯誤紀錄。**

## 先看哪幾份

1. `AI_CONTEXT/FACTS.md`
2. `AI_CONTEXT/DECISIONS.md`
3. `AI_CONTEXT/CURRENT_STATE.md`
4. `AI_CONTEXT/KNOWN_ISSUES.md`
5. `AGENT/PROMPT_TO_AGENT.md`
6. `AGENT/WORK_PLAN.md`

## 包內兩份原型

### `SOURCE/ux-mvp-v0.11`

目前最後的 UX 概念 checkpoint。

用途：

- 理解產品方向
- 驗證互動語意
- 不代表正式元件架構
- 不要再繼續雕畫面

### `SOURCE/technical-mvp-0.1-FAILED`

第一次 Technical MVP 草案。

內容包含：

- SQL schema
- Worker action 草案
- Durable Object WebSocket 草案
- local adapter
- worker adapter
- technical demo

**使用者只回報「失敗」；沒有錯誤畫面、Console、終端輸出或失敗步驟。**

所以：

- 不可宣稱已知道根因
- 不可直接在上面盲目 patch
- 先完整重現並記錄失敗
- 可以保留規格與資料模型
- 程式碼是否沿用，由接手 Agent 驗證後決定

## 這個專案真正的結論

```text
Jonaminz Chat
＝核心通訊能力＋完整 Chat System App

Shared
＝Chat 裡的共享內容收件匣／模組
≠ 獨立 App
≠ 後台主頁

後台主頁
＝只顯示摘要與入口
```

## 下一個里程碑

不是再做 v0.12 畫面，而是：

```text
兩個真實登入身分
兩個瀏覽器／兩台裝置
真實傳訊息
真實未讀
真實已讀
真實輸入中
```

在此之前不要做 OneDrive、電話、Android Overlay 或 Shared 正式化。
