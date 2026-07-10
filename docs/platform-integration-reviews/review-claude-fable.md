<!--
來源：Claude Fable 5（另一個對話）
收件日：2026-07-10
對應 RFC：docs/platform-integration-review-request.md（凍結版，12 問）
狀態：⚠️ 目前只有總結版——該 agent 表示產出了完整的一份一檔 Review，
      但只有以下總結被轉貼過來。完整版收到後整份取代本檔。
      彙整前不據此修改任何規格文件。
-->

Review 完成，一份一檔，可直接放進 `docs/platform-integration-reviews/`。

三個最需要你在凍結 Spec v1.0 前處理的結論：

1. **F1（新增，架構級）**：RFC 完全沒有定義跨 origin 的使用者身份與授權模型，而你的 Services 清單裡有 Health、File、Calendar 這些個人資料。第三方 cookie 已死、15 個 origin、任一 hobby app 的 XSS 都是爆炸半徑——這是比任何 API 都深的凍結層。就算 v1 的答案是「外部專案一律匿名」，也必須明示凍結。

2. **F2（Q12）**：「偽造合約無害」的假設有洞——entry 的標題和 URL 來自 Contract，Settings 只負責 enable。偽造者能讓你的導覽列指向他的網址。建議整個改回你前身系統的**拉模式**（Worker 向 Settings 登記的網域主動拉），推送降級為刷新提示。這順帶解掉 F6：根目錄探索在 GitHub Pages 子路徑部署下本來就會直接失效。

3. **兩個明確投票**：Q9 投 **B（reject + 固定錯誤碼）**，核心理由是失敗的不對稱性——忘記 catch 會在 console 大聲報錯，忘記檢查 `.ok` 則是靜默錯誤，一人維護十年要選吵的那種。Q10 推薦 **array-push command queue**（gtag 模式）作為唯一保證路徑，因為 SDK 必須 async 載入（否則你的網域一掛全站白屏），而三個候選裡只有 queue 在所有載入時序下都正確。

另外值得留意 F3：真正最凍的不是 API，是 Pin/Relationship 寫進 Supabase 的**物件引用格式**——API 錯了能出 `@2`，資料外鍵錯了要 migration。
