# KNOWN_ISSUES

## KI-001 Technical MVP 本機執行失敗

狀態：OPEN  
嚴重度：BLOCKER  
根因：未知

使用者回報：

```text
失敗
```

沒有提供：

- 錯誤訊息
- 畫面
- Console
- PowerShell／CMD 輸出
- 執行到哪一步

### 不可做

- 不可假設只是 Python 沒裝。
- 不可假設只是 `run-local.bat` 問題。
- 不可直接繼續 patch。
- 不可宣稱 local adapter 已通過。

### 接手步驟

1. 在 Windows 環境重現。
2. 先直接用終端啟動靜態 server。
3. 記錄 HTTP 狀態與 Console。
4. 確認兩分頁是否能載入。
5. 再確認 BroadcastChannel。
6. 將每個失敗拆成獨立 issue。

### 可檢查但尚未驗證的假說

以下只是檢查方向，不是已知根因：

- Windows 沒有 `py` launcher。
- 瀏覽器先開、server 尚未完成啟動。
- `file://` 或路徑位置不正確。
- BroadcastChannel 在目前開啟方式下行為不符。
- JS runtime error。
- 原型資料初始化錯誤。

## KI-002 Technical Worker code 只是整合草案

- `chat-actions.js` 依賴正式 Worker 內的 helper。
- 尚未真正合併。
- 尚未通過 Wrangler build。
- 尚未通過 Durable Object migration。
- 尚未驗證 WebSocket auth。
- Query-string session token 只是 MVP 草案，正式版應考慮一次性 socket ticket。

## KI-003 Technical 架構尚未最後定案

候選方案：

- 既有 Worker＋Durable Object
- 既有 Worker＋Supabase Realtime proxy
- 導入 Supabase Auth 後 browser direct Realtime
- 其他

目前只有「不能破壞既有 session 安全模型」是硬規則。

## KI-004 UX Prototype 與正式資料模型尚未接合

- Prototype 是單檔 HTML。
- 使用 localStorage。
- 訊息、reaction、read state 都是 demo state。
- 正式 UI 應在 Technical MVP 通過後再接 adapter。

## KI-005 Presence 語意

- Prototype 有綠色在線點。
- 正式版不能假裝在線。
- 只有真實 presence 可用時才顯示。
- 否則顯示最後活動時間或不顯示。

## KI-006 電話

- UX 有電話入口。
- Technical MVP 不做電話。
- Android direct call 涉及 runtime permission 與安全確認。
- 正式實作前需重新設計權限與誤觸防護。
