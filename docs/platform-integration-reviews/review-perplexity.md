<!--
來源：Perplexity（免費版）
收件日：2026-07-10
對應 RFC：docs/platform-integration-review-request.md（凍結版，12 問）
狀態：原文照錄，未經編輯。首次輸出在 Q11 開頭截斷，Q11/Q12 由
      使用者以後續訊息補齊，已接回。彙整前不據此修改任何規格文件。
-->

以下是一份針對「Jonaminz Platform Integration v1」的架構審查回覆。我以「十年可維護、一人維護、10–15 個 first‑party app、無 build pipeline」為尺度，直接挑戰你的設計，並標註嚴重度與對應問題編號。

***

## 總體判斷

你的方向整體合理：以 Contract 為自我聲明、Platform 控制 enabled/placement/permissions、SDK 常青但安全回滾、Platform API 先凍結名稱再凍結方法，這些都是對小規模長期系統有利的選擇。主要風險不在「概念錯誤」，而在「凍結層選錯」與「缺少必要的逃生艙門」。下面分點說明。

***

## 1. 哪些凍結層你現在沒想到，但以後很難改（架構級）

### 1.1 Contract 的「版本語意」與「相容性規則」未凍結

**問題編號：** 1、4、7
**嚴重度：** 架構級

你已決定「SDK 必須向下相容所有歷史 Contract」，但沒有凍結：

- Contract 本身的版本編號規則（semver？自訂？）
- 哪些欄位變更算 breaking vs non-breaking
- SDK 遇到「未知欄位 / 未知能力」的行為（忽略？警告？失敗？）

十年後一旦有多個 Contract 版本在場上，若沒有明確的「Contract 相容性政策」，SDK 會被迫用硬編碼處理歷史特例，技術債會快速累積。

**建議凍結：**

- Contract 使用 `version` 欄位（例如 `"contractVersion": "1"`），並定義：
  - major 變更：需要新 `contractVersion` 並可能依賴新 SDK 行為
  - minor/patch：SDK 必須能忽略未知欄位並保持相容
- 明確定義：「SDK 對未知欄位一律忽略，對未知能力回報 `capabilityNotSupported`，不拋出 exception」。

這不會限制你未來擴充，但會避免「隱含行為」變成技術債。

***

### 1.2 Platform API 的「capability 版本識別方式」未凍結

**問題編號：** 1、7
**嚴重度：** 架構級

你已凍結「Service 名稱、Namespace、Promise 模型、錯誤模型、Capability Version 機制」，但沒有凍結：

- capability 版本在程式碼中的「呼叫形狀」
  例如：
  - `platform.search.query({ q: 'x' }, { capability: 'search@1' })`
  - `platform.search@1.query({ q: 'x' })`
  - `platform.search.v1.query(...)`

一旦外部專案開始寫 `platform.search.xxx`，再改版本識別方式會非常痛苦。

**建議凍結：**

- 採用 `service@major` 作為 namespace 一部分，例如：
  - `platform['search@1'].query(...)`
  - 或 `platform.search.v1.query(...)`（若你希望 `search` 這個名字本身穩定）
- 明確定義：「major 變更 = 新 namespace / 新能力物件，舊版本永不移除，只標 deprecated」。

這與你「名稱先凍結、方法晚凍結」哲學一致，但要把「版本如何出現在 API 表面」先凍結。

***

### 1.3 SDK 的「全域名字空間與衝突規則」未凍結

**問題編號：** 1、5、10
**嚴重度：** 架構級

你提到 `window.Jonaminz.ready` 等選項，但尚未凍結：

- 全域變數名稱（`window.Jonaminz`？`window.jonaminz`？大小寫？）
- 是否允許同時存在多個 SDK（例如不同版本、不同專案測試）
- 若外部專案自己也有 `Jonaminz` 變數時的行為

一旦 10–15 個專案都寫 `window.Jonaminz.xxx`，要改名字幾乎不可能。

**建議凍結：**

- 固定為 `window.jonaminz`（小寫，避免與可能被框架使用的 PascalCase 衝突）
- 明確定義：
  - 第二次載入同款 SDK 應偵測並跳過初始化，或拋出非破壞性警告
  - 外部專案不應自行寫入 `window.jonaminz`，此命名空間保留給 SDK

***

### 1.4 Contract 的「projectId 與身份模型」未凍結

**問題編號：** 1、4、12
**嚴重度：** 架構級

你提到 `projectId` 與 Integration Settings 裡的網域綁定，但未凍結：

- `projectId` 的產生與所有權（平台分配？合約自填？）
- 是否允許一個專案有多個 `projectId`（例如 staging / prod）
- `projectId` 是否出現在 Contract 中，或只在 Settings 中

若未來想加「多環境」、「多團隊」，身份模型會卡住。

**建議凍結：**

- `projectId` 由平台分配，寫在 Integration Settings，不在 Contract 中自填
- Contract 中可選 `environment`（例如 `"dev"`, `"prod"`），但身份仍以 `projectId` 為準
- 明確定義：「一個 `projectId` 可對應多個網域（例如 `*.example.com`），但需在 Settings 中明確列出」

這不會限制你未來擴充，但避免身份模型後來被 Contract 綁死。

***

## 2. 哪些地方現在合理，十年後很可能變成技術債（架構級 / 建議級）

### 2.1 「常青 SDK」＋「無 build pipeline」組合

**問題編號：** 11
**嚴重度：** 架構級

模式本身沒問題，但組合起來的風險是：

- 一次壞部署 → 所有外部專案同時受影響
- 沒有自動測試 / 建構流程 → 人為失誤機率較高
- 「失敗不得破壞宿主頁面」很難在複雜邏輯下完全保證

**長期技術債來源：**

- 為了安全，SDK 內部會累積大量防禦式程式碼與 fallback，導致難以維護
- 你會在「快速迭代」與「絕對安全」之間反覆妥協

**改善方案（不違背一人維護）：**

- 至少建立一個「最小部署防護」：
  - 部署前自動跑一組基本 contract 驗證（可在 CI 中，不用 build pipeline）
  - 提供一個「版本標籤」機制（例如 `jonaminz-entry@2026-07-10.js`），必要時可手動改外部專案的 script src 回滾
- 在 SDK 內部實作「金絲雀開關」：
  - 從平台拉取一個「feature flag / kill switch」設定，若某版本被標記為 bad，可直接跳過高風險功能

「可以安全回滾」應明確為：
- SDK 部署可回滾（換 URL 或內部 flag）
- Contract 版本不回滾，只新增/棄用

***

### 2.2 CSS 整合層級 `none / tokens / components / full / self`

**問題編號：** 3
**嚴重度：** 建議級（目前不算架構級，但若實作過深會變）

第一版只做 `none` 與 `tokens` 是明智的。風險在於：

- 一旦實作了 `components` 或 `full`，未來要改 CSS 架構（例如設計系統大改）會牽一髮動全身
- 外部專案可能開始依賴某些「隱含的 component class」

**建議：**

- 永遠將 `components` 與 `full` 視為「選用、可被移除」的實驗性功能
- 在文件與 Contract 中明確定義：「只有 `tokens` 視為長期穩定介面，components 不保證相容性」

***

## 3. Platform Core / Shell / Services 的切分是否合理

**問題編號：** 3
**嚴重度：** 建議級

目前的三分法：

- Core：Runtime、SDK、Contract Loader、Settings Loader、Platform Bridge
- Shell：Header、Footer、Theme、Navigation、CSS
- Services：Search、Pin、Relationship、AI、Analytics、Notification、Calendar、File、Health、Profile、Shared Cache

在小規模、first‑party 情境下，這切分是合理的。潛在問題是：

- 「Platform Bridge」的職責未明：是 Core 與 Services 的橋？還是 Core 與外部專案的橋？
- Shell 若與特定 HTML 結構強綁定，未來換主題或加新 layout 會受限

**建議：**

- 明確定義：
  - Core：只負責「平台與外部專案的通訊協定、能力協商、安全邊界」
  - Shell：只負責「平台自身的 UI 呈現」，不應該知道 Contract 細節
  - Services：只透過 Core 暴露 API，不直接與外部專案互動
- 避免 Shell 依賴 Services 的實作細節（例如直接 import Search 邏輯）

以你目前的描述，方向是對的，只要在實作時嚴守「依賴方向」即可。

***

## 4. Contract 的責任邊界是否還混到 SDK 或 Integration Settings

**問題編號：** 4
**嚴重度：** 架構級

你的哲學正確：Contract 只自我聲明，不決定 enabled/placement/permissions。風險在於：

- 實作時容易把「平台策略」寫進 Contract（例如「預設 visible: true」）
- 或把「驗證規則」寫進 SDK，導致 Contract 語意被 SDK 實作綁死

**建議凍結：**

- Contract 只描述「能力與需求」，不描述「是否允許」
- 所有「是否允許」的決策邏輯，必須在平台後端（Integration Settings）
- SDK 只負責：
  - 讀取 Contract
  - 送至平台
  - 根據平台回傳的 Settings 啟用能力
  - 不提供任何「預設允許」的邏輯

只要在實作初期就守住這條線，未來不會有大問題。

***

## 5. SDK Lifecycle 是否遺漏重要步驟

**問題編號：** 5
**嚴重度：** 架構級

典型 SDK 生命週期應包含：

1. 載入與全局命名空間建立
2. 讀取 Contract（URL 可配置，預設 `/jonaminz.contract.json`）
3. 基本格式驗證（本地）
4. 向平台回報 Contract（push）
5. 拉取 Integration Settings
6. 建立 Platform API（含 capability 版本解析）
7. 觸發 Ready（event / promise / command queue replay）
8. 定期或事件驅動重新拉取 Settings（可選）

你目前的描述涵蓋大部分，但缺少：

- **Contract 變更偵測與重新初始化策略**
  當 Contract 內容改變時，SDK 要不要重新 push？外部專案要不要重新初始化？
- **平台不可用時的退化行為**
  若平台暫時掛掉，SDK 要完全禁用能力？還是使用上次已知 Settings（local cache）？

**建議：**

- 明確定義：
  - SDK 在每次頁面載入時都重新 pull Settings，但可使用短期 cache（例如 5 分鐘）
  - 若平台不可用，SDK 進入「安全模式」：只開放明確標示為「offline-safe」的能力，或完全禁用平台 API
- 在生命週期中加入「reconfigure」步驟，允許平台在下一次 Settings 拉取時改變能力集，而不需要外部專案重新載入 SDK

***

## 6. Contract Discovery 機制（根目錄 vs 其他方式）

**問題編號：** 6
**嚴重度：** 建議級（以你的尺度，不必過度設計）

目前預設 `/jonaminz.contract.json` 對 first‑party、靜態託管非常合適。額外機制（HTML meta、HTTP header）的優點是彈性，缺點是：

- 增加 SDK 複雜度
- 增加未來維護成本
- 對你目前的用例幫助有限

**建議：**

- 第一版只支援「根目錄固定路徑」：`/jonaminz.contract.json`
- 保留未來擴充的可能性，但不要現在實作：
  - 可在 Contract 中加一個可選欄位 `contractUrl`（若未來需要）
  - 或在 SDK 初始化參數中允許 `contractUrl` 覆寫（進階用法）

若你希望有一個「十年後仍值得維護」的擴充點，推薦：

- 先在 SDK 內部抽象一個 `resolveContractUrl(projectId, baseOrigin)` 函式
- 現在只實作「回傳 `${baseOrigin}/jonaminz.contract.json`」
- 未來可依需要加入 meta/header 邏輯，而不改外部專案

***

## 7. Platform API「名稱先凍結、方法晚凍結」是否最安全

**問題編號：** 7
**嚴重度：** 架構級

以你的尺度，這是正確策略。風險在於：

- 若「名稱」本身選錯（例如 `search` 後來發現語意太窄），改名會很痛
- 若 capability 版本機制不夠清楚，外部專案會誤用未穩定方法

**建議：**

- 選擇「語意穩定」的名稱，例如：
  - `search` 比 `siteSearch` 好（避免綁定特定實作）
  - `notification.send` 比 `notification.push` 好（避免綁定技術）
- 明確定義：
  - 名稱凍結 = 外層 namespace 穩定
  - 方法凍結 = 每個 `service@major` 內部方法簽名穩定
  - 新 major = 新 namespace（例如 `search@2`），舊版保留但不擴展

這與你目前的想法一致，只是要更明確地寫進「凍結層清單」。

***

## 8. Integration Settings 抽象（Git vs DB）是否足夠

**問題編號：** 8
**嚴重度：** 建議級

你的抽象（SDK 不知道背後是 Git 或 DB）是正確的。長期風險在於：

- 若未來 Settings 結構大改（例如加入多環境、多角色），SDK 拉取的 Settings 格式可能變
- 若現在把太多「平台策略」寫進 Settings 欄位，未來改動會牽動 SDK

**建議：**

- 定義一個「Settings 穩定子集」：
  - 例如 `enabledCapabilities`, `placements`, `visibilityRules`
  - 這部分十年內不大幅改結構
- 允許 Settings 中有「實驗性欄位」，SDK 應忽略未知結構，而不是依賴它

只要守住「SDK 只讀、不解讀複雜策略」這條線，Git vs DB 的切換不會是問題。

***

## 9. 錯誤模型：A（resolve + ok:false）還是 B（reject）？

**問題編號：** 9
**嚴重度：** 架構級（這不是小事，會滲透所有外部專案的呼叫習慣）

**明確選擇：B. reject 帶固定錯誤碼（呼叫端用 catch，符合 Promise 慣例）**

理由（十年尺度）：

1. **與 JavaScript/Promise 生態一致**
   - 外部專案開發者習慣 `try/catch` 或 `.catch()` 處理錯誤
   - 若走 A，所有 Platform API 呼叫都要多一層 `if (!res.ok)`，容易忘記
2. **可區分「業務邏輯失敗」與「真正異常」**
   - 你可以定義一組固定的 error codes（例如 `CAPABILITY_NOT_SUPPORTED`, `PERMISSION_DENIED`, `SERVICE_UNAVAILABLE`）
   - 這些都以 `reject(error)` 呈現，caller 用 `catch` 統一處理
3. **未來若加 retry / fallback 機制較自然**
   - 例如：特定錯誤碼可重試，其他直接拋出
   - 若走 A，retry 邏輯會散落在各處 `if` 中

**錯誤物件建議形狀：**

```js
// 在 catch 中接到的 error
{
  code: 'PERMISSION_DENIED',
  message: 'Capability "notification.send" is not enabled for this project.',
  service: 'notification',
  capability: 'notification@1.send',
  // 可選：platform 內部 trace id
  traceId: 'abc123'
}
```

這樣十年後要加 logging、監控、除錯工具都比較容易。

***

## 10. SDK Ready 介面：event / promise / command queue？

**問題編號：** 10
**嚴重度：** 架構級（外部專案每天都會寫到的那一行）

**明確選擇：`window.jonaminz.ready` 作為 Promise，搭配可選的 command queue stub**

理由：

1. **Promise 最符合現代 JS 習慣**
   - 外部專案可以：
     ```js
     await window.jonaminz.ready;
     // 開始呼叫 platform.xxx
     ```
   - 或：
     ```js
     window.jonaminz.ready.then(() => { ... });
     ```
2. **比 DOM event 更簡單**
   - 不需要處理 event listener 註冊時機（先綁還是後綁）
   - 不需要擔心 event name 拼錯
3. **command queue 可作為進階安全網，但不是唯一介面**
   - 你可以實作：
     - 在 ready 之前呼叫 `platform.xxx` 時，先塞進 queue
     - ready 後自動重放
   - 但對外公開的主要介面仍是 `ready` Promise

**建議凍結：**

- 固定為：
  ```js
  window.jonaminz.ready // Promise<void>
  ```
- 明確定義：
  - 在 ready 之前呼叫 Platform API 的行為：
    - 要麼拋出明確錯誤（例如 `SDK_NOT_READY`）
    - 要麼進入 command queue（若你決定實作）
  - 不支援其他 ready 檢測方式（例如 `window.jonaminz.isReady` 布林值）

這樣十年後，所有文件與範例都只用一種模式，降低混亂。

***

## 11. 常青 SDK 的部署風險：kill-switch / 金絲雀 / 回滾機制

**問題編號：** 11
**嚴重度：** 架構級

### 問題本質

「失敗不得破壞宿主頁面」是必要條件，但不夠覆蓋「一次壞部署同時打到所有外部專案」的風險。尤其在：

- 一人維護
- 無 build pipeline
- 無自動回歸測試

的情況下，人為失誤（例如誤刪一個判斷、改錯一個全域變數）可能讓所有 10–15 個專案同時出問題。

### 「可以安全回滾」的語意必須釐清

你提到「可以安全回滾」，但這裡至少有兩層：

1. **SDK 部署回滾**
   - 指 `jonaminz-entry.js` 檔案內容回滾到前一版
   - 這是最關鍵的：因為所有外部專案都載入同一個 URL
2. **Contract 版本回滾**
   - 指某個外部專案把自己的 `jonaminz.contract.json` 改回舊版
   - 這只會影響單一專案，風險較小

在十年尺度下，你真正需要保護的是 **SDK 部署回滾能力**。

### 在你目前的尺度下，什麼程度的保護是值得的？

完全不設防：

- 優點：最簡單
- 缺點：一次手誤 = 全站同時出包，只能靠「趕緊手動改回程式碼 + 重新部署」

我會建議一個「最小可行防護組合」，不違背一人維護、無 build pipeline 的前提：

### 建議方案（架構級）

**1. SDK 版本標籤 + 可切換 URL（建議級 → 實作上很重要）**

現在：

```html
<script src="https://jonaminz.com/sdk/jonaminz-entry.js"></script>
```

保留能力：

```html
<script src="https://jonaminz.com/sdk/jonaminz-entry@2026-07-10.js"></script>
```

規則：

- 預設外部專案都用 `jonaminz-entry.js`（常青）
- 但你隨時可以把某個外部專案的 script src 改指向特定日期標籤，做「單點回滾」
- 若真的遇到災難性部署，可以：
  - 快速把 `jonaminz-entry.js` 指回舊版（部署回滾）
  - 或先改幾個關鍵專案的 URL 到穩定版本（金絲雀回滾）

這不需要 build pipeline，只要你在部署時順手打一個帶日期的拷貝即可。

**2. SDK 內部的 kill-switch / feature flag（架構級）**

在 SDK 啟動時，先向平台拉取一個極小的「bootstrap config」，例如：

```js
{
  sdkVersion: "2026-07-10",
  killSwitch: {
    "new-capability-negotiation": false,
    "aggressive-cache": true
  },
  forbiddenVersions: ["2026-07-09-bad"]
}
```

行為：

- 若當前部署版本被標為 forbidden，SDK 直接進入安全模式（只輸出 warning，不執行高風險邏輯）
- 若某些功能被 killSwitch 關閉，SDK 跳過那些路徑

這讓你在「來不及重新部署」時，仍能透過改一個小設定檔，快速止血。

**3. 明確定義「安全回滾」的語意（架構級）**

文件與內部規範中明確定義：

- 「安全回滾」預設指 **SDK 部署回滾**：
  - `jonaminz-entry.js` 內容回滾到前一穩定版
  - 所有載入常青 URL 的外部專案自動回到舊版行為
- Contract 回滾是「單一專案的自救手段」，不是平台級保護
- 若未來有需要，可引入 `jonaminz-entry@stable.js` 作為「手動升級才吃得到新版」的通道，但第一版不必實作

### 結論（第 11 題）

「失敗不得破壞宿主頁面」是必要但不充分條件。

在你目前的尺度下，值得投資的最小防護是：

1. SDK 版本標籤 + 可手動切換 URL（建議級，但實作成本低、長期價值高）
2. SDK 內部 kill-switch / feature flag（架構級）
3. 明確定義「安全回滾」指 SDK 部署回滾，而非 Contract 回滾（架構級）

這樣既能維持「一人維護、無 build pipeline」的簡單性，又不會把你自己關進「一次失誤全站掛」的死角。

***

## 12. 推模式收合約的威脅模型：Origin 檢查是否足夠？

**問題編號：** 12
**嚴重度：** 架構級（但結論是：在你目前的假設下，風險可控）

### 目前的設計

- SDK 在瀏覽器中執行，把 Contract 推送給平台後端
- 後端驗證請求的 Origin header
- 檢查 Origin 是否等於該 projectId 在 Integration Settings 中登記的網域
- 上架與授權永遠只看 Integration Settings，Contract 只是「自我聲明」

你的假設是：

> 偽造者最多塞進一份「不被採信」的合約副本，無害。

### 這個假設有沒有洞？

在你目前的尺度下（10–15 個 first‑party app、沒有陌生第三方開發者），這個模型是合理的，但要注意以下幾點：

**1. 非瀏覽器偽造請求（curl / 自寫 script）**

- Origin header 可以被偽造
- 攻擊者可以：
  - 直接 curl 你的平台 API，帶上任意 Origin
  - 或寫一個假 SDK，送出假 Contract

你的防護是：

> 最終決策只看 Integration Settings，Contract 只是「建議」。

只要：

- 平台後端**不因為收到 Contract 就自動啟用任何能力**
- 所有 enabled / permissions / placements 都只在 Settings 中控制

那麼：

- 偽造的 Contract 頂多讓平台「知道有一份假自我聲明」，但不會改變實際行為
- 真正能改變行為的，只有有人手動去改 Integration Settings

在你的使用情境（只有你和另一位使用者，且都是開發者）下，這個風險是可接受的。

**2. 中間人 / DNS 劫持（較極端的情境）**

若攻擊者能：

- 劫持 DNS 或中間人攻擊
- 讓外部專案載入「假的 SDK」或連到「假的平台」

那問題就不只是 Contract 推送，而是整個系統被繞過。這類攻擊在你的尺度下（first‑party、靜態託管、少量專案）通常不是主要威脅模型，除非你未來要處理敏感資料或金錢交易。

目前不需要為了這種情境加複雜的簽章機制，但可以保留未來擴充的空間（例如在 Contract 中加入可選的 signature 欄位）。

**3. 內部誤操作（更實際的風險）**

更可能的風險不是外部攻擊，而是：

- 你或另一位使用者誤改 Integration Settings
- 把某個 projectId 的允許網域改成錯誤的值
- 導致 Contract 推送被錯誤接受或拒絕

這類風險的防護是：

- Settings 的變更留 audit log（Git 本身就做到）
- 若未來遷移到 DB，保留版本紀錄與回滾能力

這比在 Contract 推送層加複雜認證更值得投資。

### 是否需要在現在加更多機制？

在你目前的尺度下，我會建議：

現在：

- 維持「Origin 檢查 + Settings 為唯一真相來源」
- 明確定義：
  - Contract 推送失敗只影響「平台對該專案的認識」，不影響既有的 enabled 設定
  - 任何新的能力啟用都必須透過修改 Settings，不能只靠 Contract

未來若需要更高安全（例如開放第三方）：

- 再引入：
  - Contract 簽章（例如 JWS）
  - 客戶端憑證或 OAuth2 之類機制

以「十年可維護」為目標，你現在要做的是：

- 不要把「高安全機制」寫死在 SDK 與 Contract 的基礎協定裡
- 保留欄位與流程的擴充空間（例如 Contract 中可選 signature、平台可選更嚴格的驗證），但第一版不實作

### 結論（第 12 題）

在「first‑party、少量專案、沒有陌生第三方」的前提下：

- 「Origin 檢查 + Settings 為唯一授權來源」是足夠的
- 偽造 Contract 的風險可控，因為不能改變實際 enabled/permissions
- 需要明確寫進架構文件：
  - Contract 推送僅供平台「認識」專案，不具備授權效力
  - 所有授權與能力啟用，都以 Integration Settings 為準
- 未來若要開放第三方或處理更高敏資料，再在五分鐘內可擴充的欄位與流程上疊加簽章與認證機制，而不是現在就背複雜度
