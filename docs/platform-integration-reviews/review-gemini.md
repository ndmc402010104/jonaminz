<!--
來源：Gemini
收件日：2026-07-10
對應 RFC：docs/platform-integration-review-request.md（凍結版，12 問）
狀態：原文照錄，未經編輯。彙整前不據此修改任何規格文件。

Status: Historical / Superseded
此文件是規格定稿前的一份審查意見，不代表目前實作，內容已由
docs/platform-integration-review-consolidation.md 彙整、
docs/platform-integration-spec-v1.md（S1-S39，唯一權威）吸收定案。
目前狀態請參考：AI_CONTEXT/CURRENT_STATE.md 與 docs/platform-integration-spec-v1.md。
-->

這是一份基於「一人開發、無建置流程、靜態為主、十年維護」尺度的架構審查（Architecture Review）。

在這樣的尺度下，我們追求的不是「企業級的極致擴充性」，而是「極簡的介面、單向的資料流、以及對宿主環境的絕對防禦」。以下是針對你提出的 12 個問題與系統設計的挑戰：

---

### 1. 漏掉的凍結層 (Missing Frozen Layers)

* **嚴重度**：**架構級**
* **問題**：全域命名空間（Global Namespace）與 DOM 污染的凍結。
* **分析**：你定義了 SDK 怎麼跟 Contract 互動，但沒有定義 SDK 怎麼跟「宿主瀏覽器環境」互動。一旦你的 Shell (Theme/CSS) 或 SDK 在 DOM 上加了東西，十年內只要外部專案的 ID 或 CSS Class 跟你衝突，系統就會無預警破版。
* **改善方案**：
1. **DOM 凍結**：規定 Jonaminz Shell 只能掛載在特定的 Custom Element 內（例如 `<jonaminz-shell>`）或 Shadow DOM 中，徹底隔離 CSS 污染。
2. **CSS 變數凍結**：若採取 Token 整合，必須明確凍結前綴（例如 `--jmz-`），避免與外部專案（例如 Bootstrap 或 Tailwind）衝突。
3. **Storage 凍結**：SDK 使用的 `localStorage` / `sessionStorage` / `IndexedDB` 必須有固定的 Prefix 策略，否則清除快取時會誤刪宿主專案的資料。

### 2. 十年技術債 (10-Year Tech Debt)

* **嚴重度**：**架構級**
* **問題**：常青網址 `jonaminz-entry.js` 的「單一入口」迷思。
* **分析**：你說「永遠載入最新版 SDK」，這在 V1 到 V3 可能沒問題。但如果五年後，瀏覽器淘汰了某個 API，或是你的 Core Runtime 需要經歷一次完全不相容的底層重構（V2），強制所有舊專案吃同一個 Entry 是在拿石頭砸自己的腳。
* **改善方案**：
保留 Major Version 在 URL 中。例如 `sdk/v1/entry.js`。這不違背常青原則（V1 永遠常青並向下相容），但給了你未來開發 `v2/entry.js` 且不需立刻強迫 15 個舊專案遷移的退路。這對於單人開發的心理壓力與維護彈性至關重要。

### 3. Core / Shell / Services 的切分

* **嚴重度**：**建議級**
* **問題**：Shell 與 Core 的耦合邊界不夠清晰。
* **分析**：有些外部專案可能只需要 Services（例如純粹呼叫 AI 或 Search），完全不想要 Shell（Header/Footer）。
* **改善方案**：Core 應該是純粹的 Headless Runtime。Shell 應該被視為「第一順位的內部 Service」。外部專案的 Contract 應該能宣告 `shell: false`，此時 Core 只建立 Platform API，不進行任何 UI 渲染。

### 4. Contract 的責任邊界

* **嚴重度**：**架構級**
* **問題**：誰負責計算 Capability 的「交集」？
* **分析**：Contract 宣告「我需要 Search」，Settings 決定「你只能用 Search 讀取，不能寫入」。如果這個交集邏輯寫在 SDK 裡，只要驗證邏輯一改，所有前端行為都會變，且容易被破解。
* **改善方案**：交集計算必須發生在 **Platform Backend (Cloudflare Worker)**。SDK 把 Contract 送上去後，後端回傳的 `Settings` 應該已經是「過濾且授權後的最終狀態（Granted Capabilities）」。SDK 只要負責「照做」，不要做任何權限推導。

### 5. SDK Lifecycle

* **嚴重度**：**架構級**
* **問題**：缺少 **Identity (Authentication) Check** 與 **Teardown (Cleanup)**。
* **分析**：
1. 你只有兩位使用者。但 SDK 載入時，怎麼知道現在是哪位使用者登入？如果未登入，SDK 是直接終止還是進入 Guest 模式？這是載入 Settings 前必須確認的狀態。
2. 這些外部專案若有 SPA (Single Page Application)，路由切換時，SDK 的狀態、監聽器是否需要銷毀重建？

* **改善方案**：Lifecycle 必須加入 `Auth Check` (取得 Session Token) -> `Load Contract` -> `Fetch Settings`。同時，SDK 暴露一個 `Jonaminz.destroy()` 供 SPA 清理記憶體。

### 6. Contract Discovery

* **嚴重度**：**架構級**
* **問題**：強制根目錄 `/jonaminz.contract.json` 缺乏部署彈性。
* **分析**：GitHub Pages 常常是一個 Repo 放多個小專案（使用 Sub-directories）。如果寫死根目錄，多個專案會打架。
* **改善方案**：效仿 Web Manifest 標準。
在 `<head>` 中使用：`<link rel="jonaminz-contract" href="./my-app-contract.json">`
SDK 初始化時先找這行，找不到再 fallback 到根目錄。這不增加你的開發負擔，但大幅增加了未來佈署的靈活性。

### 7. Platform API 凍結策略

* **嚴重度**：**建議級**
* **問題**：「名稱先凍結，方法晚凍結」的實作方式。
* **分析**：如果你將 API 設計為 `Jonaminz.Search.query(...)`，一旦方法簽名變了，向後相容就很痛苦。
* **改善方案**：採用 **Message Passing (RPC 模式)**，而不是直接暴露方法。
介面永遠凍結為：`Jonaminz.invoke('Service.Method@Version', Payload)`
例如：`Jonaminz.invoke('search.query@1', { q: 'test' })`
這樣你可以無限期延遲方法實作，且 SDK 永遠不需要為了新 Service 更新介面。

### 8. Integration Settings 抽象

* **嚴重度**：**建議級**
* **問題**：SDK 是否真的「不知道」背後是 Git 或 DB？
* **分析**：只要 SDK 是透過 HTTP API (Cloudflare Worker) 去拿 Settings，它在物理上就已經不知道背後實作了。
* **改善方案**：你目前的抽象已經足夠。只要確保 API 的 Response Schema 嚴格版本化（例如 `/api/v1/settings`），後端高興從哪裡讀取資料都無所謂。

### 9. 錯誤模型的具體形狀

* **選擇**：**A. resolve 帶 `{ ok: false, code, message }`**
* **理由**：在平台整合的場景中，Platform API 呼叫失敗（例如：網路斷線、沒有權限、Service 未開通）是「業務邏輯的常態」，而不是「系統執行期的異常」。
在原生 JS 無建置環境中，強迫宿主專案為每個平台呼叫寫 `try...catch` 是一種極度糟糕的開發體驗。只要漏寫一個 catch，Unhandled Promise Rejection 就可能中斷宿主專案自己的核心邏輯。
採用 A 方案（類似 Rust 的 Result 或 Go 的多回傳值概念），迫使開發者用 `if (!res.ok)` 來優雅降級，這在十年尺度下，對宿主環境是最安全、侵入性最低的選擇。

### 10. SDK Ready 介面

* **選擇**：**command queue stub (類似 gtag 的設計)**
* **理由**：在沒有 Build pipeline 且使用原生 JS 的環境中，腳本載入的順序（Race condition）是最大痛點。如果你用 Event 或 Promise，外部專案必須寫一堆等待邏輯，且萬一 SDK 載入失敗，等待邏輯可能會卡死。
**實作建議**：
在 `<head>` 放入：
`window.Jonaminz = window.Jonaminz || function(){ (window.Jonaminz.q=window.Jonaminz.q||[]).push(arguments) };`
外部專案隨時可以呼叫 `Jonaminz('invoke', 'search@1', {...})`。如果 SDK 還沒載入，這只是把指令推入陣列；等 SDK 載入完成，再把陣列裡的指令拿出來重放。這是十年來業界驗證過最無痛、最防呆的跨網域 SDK 整合方式。

### 11. 常青 SDK 的部署風險

* **嚴重度**：**架構級**
* **問題**：「一次壞部署同時打到所有外部專案」的單點故障風險。
* **分析**：一人維護不需要搞複雜的金絲雀發佈（Canary），但需要防禦「Cloudflare Cache 導致壞 code 停留在所有使用者的瀏覽器裡」。
* **改善方案**：採用 **Bootstrapper Pattern**。
`jonaminz-entry.js` 永遠只做兩件事：
1. 建立 Command Queue Stub。
2. 呼叫後端 API 取得「真正要執行的 Core SDK URL (帶有 Hash)」，然後動態載入它。
這樣一來，`entry.js` 幾乎永遠不需要改版（不會有壞掉的風險）。所有的業務邏輯都在 `core-[hash].js` 中。如果要 rollback，只要在 Cloudflare Worker 把指向的 Hash 換回上一版，使用者重新整理頁面就立刻復原，完全不需要處理 CDN 快取清除的惡夢。

### 12. 推模式收合約的威脅模型

* **嚴重度**：**建議級**
* **問題**：Origin header 偽造與惡意攻擊。
* **分析**：你的假設「偽造者最多塞進一份不被採信的合約副本」在**權限上**是成立的（無害）。但從**基礎設施**來看，這個洞在於「阻斷服務攻擊 (DoS) 或儲存空間耗盡」。
* **改善方案**：一人平台不需要複雜的 WAF。但 Cloudflare Worker 必須加上基礎的 Rate Limiting。對於未知 Origin 推進來的 Contract，可以在 Worker 層直接 Drop 掉（因為你事先知道那 15 個專案的合法 Domain），不要進到 Supabase 浪費 Database 資源。這能在不增加複雜度的情況下，防禦 99% 的無聊攻擊。
