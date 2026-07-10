<!--
來源：ChatGPT
收件日：2026-07-10
對應 RFC：docs/platform-integration-review-request.md（凍結版，12 問）
狀態：原文照錄，未經編輯。彙整前不據此修改任何規格文件。
-->

# Jonaminz Platform Integration v1 — Architecture Review

## Review 結論

整體方向正確，而且尺度校準合理。

這套設計沒有必要引入 API Gateway、微服務、多租戶隔離、流量百分比灰度發布、分散式追蹤或企業級 SLA 系統。以兩位使用者、10–15 個 first-party app、一人維護來看，那些會增加維護成本，並不會增加十年穩定性。

但目前仍**不適合直接凍結成 Specification v1.0**。

問題不是缺少更多 Service API，而是尚有幾個真正會成為十年相容性負擔的基礎規則沒有定義：

1. Project、Origin、Environment、User 的身分模型。
2. Contract、Settings、Actor Permission、Runtime Availability 的合併規則。
3. SDK 與後端之間的 Protocol Version。
4. SDK 初始化狀態與 `ready` 的精確語意。
5. 常青 SDK 的不可變版本、發布與回滾模型。
6. Push Contract 的可信度與污染防護。
7. Shell 對宿主 DOM 與 CSS 的所有權邊界。

這些應先補進 Specification，再開始 Schema 與 SDK。

---

# Findings

## AR-01 — 缺少完整的身分模型

**嚴重度：架構級**
**對應問題：1、4、8、12**

目前的架構中，`projectId`、網域、環境與使用者身分仍容易被混在一起。

### 為什麼會變成問題

十年內最容易變動的是：

* 專案改網域。
* 專案從 GitHub Pages 搬到其他靜態託管。
* 同一專案同時存在 local、dev、prod。
* Jonathan 與 Minz 對同一專案擁有不同權限。
* 一個專案拆成多個入口或合併網域。

如果 `projectId` 是從 hostname、repo 名稱或 URL 推導，任何搬遷都會變成身分遷移。

Origin 也不能代表使用者。它只能表示「這個瀏覽器頁面聲稱從哪個來源載入」。

### 改善方案

至少凍結四種不同身分：

* **Project Identity**：不可變、無語意的 `projectId`。
* **Deployment Identity**：某個 project 在特定 environment 中允許的 origin。
* **Actor Identity**：目前登入的是 Jonathan、Minz 或 anonymous。
* **Resource Identity**：專案內穩定的 `entryId`、`objectTypeId`。

建議規則：

* `projectId` 永遠不因名稱、URL、repo 或網域改變。
* Origin 與 environment 的綁定只存在 Integration Settings。
* Contract 原則上不需要知道自己是 dev 或 prod。
* 同一份 Contract 應盡可能可以部署到不同 environment。
* `entryId` 與 `objectTypeId` 在 project namespace 內永久穩定。
* 顯示名稱可以修改，ID 不修改。

### 相容性影響

現在補上幾乎沒有成本。

若 SDK 實作後才發現 project identity 等同於 hostname，會影響 Contract、Settings、資料關聯、快取與歷史紀錄，屬於高成本拆除。

---

## AR-02 — 必須分離六種不同的 Version

**嚴重度：架構級**
**對應問題：1、2、5、11**

目前的 `Contract Version`、`Capability Version` 與 SDK 向下相容方向是正確的，但版本維度仍不足。

### 為什麼會變成問題

若只使用一個「version」，之後會無法回答：

* 是 Contract 格式改了，還是 Contract 內容改了？
* 是 SDK 部署版本改了，還是 SDK 與 Worker 的通訊協定改了？
* 回滾 SDK 時，舊 SDK 能否讀目前 Settings？
* Contract 回到昨天的內容，算不算 schema downgrade？
* `search@1` 的方法增加一個 optional field，需不需要升版？

### 改善方案

至少分離：

1. **Contract Schema Version**
   表示 JSON 結構規格版本。

2. **Contract Content Revision / Hash**
   表示某專案這次發布的 Contract 內容，不等同 schema version。

3. **SDK Release Version**
   表示實際部署的 SDK 程式版本。

4. **Platform Protocol Version**
   表示 SDK 與 Worker 之間的通訊協定。

5. **Capability Major Version**
   例如 `search@1`、`search@2`。

6. **Integration Settings Schema Version 與 Revision**
   Schema 表示格式；revision 表示這次設定內容。

需要同時凍結相容性規則：

* 同一個 Contract major schema 內只能做向下相容的新增。
* 未知欄位不得因此讓舊 SDK 崩潰。
* 未知 capability 或 enum 值必須視為不支援，不能自動 fallback 成權限更大的模式。
* SDK 回滾版本必須仍支援目前使用中的 Platform Protocol。
* Contract 內容回滾是「重新發布舊內容」，不是 Contract Schema 降版。

### 相容性影響

如果所有概念先共用一個 `version`，日後拆開時會影響所有 Contract、Settings、診斷資訊與快取鍵。

---

## AR-03 — 必須凍結 Effective Integration 的計算規則

**嚴重度：架構級**
**對應問題：1、4、8、12**

目前已確定 Contract 不能決定 grant，這是正確的。但仍缺少各資料來源相遇時的固定規則。

### 為什麼會變成問題

例如 Contract 宣告：

* 支援 `search@1`
* 需要 `notification@1`

Integration Settings：

* grant `search@1`
* grant `calendar@1`

Platform Runtime：

* Search 暫時故障
* Calendar 正常

Actor：

* Minz 可以使用 Search
* Anonymous 不可以使用 Search

此時 SDK 到底應該暴露什麼能力，目前沒有唯一答案。

### 改善方案

凍結以下原則：

> Effective Capability
> = Contract 宣告支援
> ∩ Integration Settings 授權
> ∩ Platform Runtime 可用
> ∩ Actor Permission 允許

其中：

* Contract 的 `required` 只表示「缺少後，專案無法完成某種整合」。
* `required` 永遠不會造成自動 grant。
* Settings grant 一個 Contract 未宣告支援的能力時，該 grant 不生效並產生診斷警告。
* Contract 移除某個 entry，但 Settings 仍有其 placement 時，應忽略該 placement，不應自動刪除 Settings。
* SDK 顯示的 granted capability 只用於 UI 與 client behavior。
* 真正的 Platform API 權限必須由 Worker 再次驗證，不能相信瀏覽器中的 Settings 或 SDK 狀態。

### 相容性影響

這個公式一旦有不同實作版本，會產生「同一份 Contract 在不同 SDK 上權限不同」的問題，之後極難修正。

---

## AR-04 — Actor Authentication 與 Project Authorization 尚未分離

**嚴重度：架構級**
**對應問題：1、8、12；新增**

即使平台只有 Jonathan 與 Minz，也需要明確區分「誰在使用」與「哪個 app 在呼叫」。

### 為什麼會變成問題

Integration Settings 可以決定某 app 是否被允許使用 Calendar，但不能單獨回答：

* 目前是哪位使用者？
* 此使用者是否有權讀取這一筆 Calendar 資料？
* Anonymous 是否可以執行相同動作？
* 某個 app 是否可以代表使用者執行寫入？

此外，所有前端內容都能被使用者修改。SDK、Contract 與瀏覽器中的 Integration Settings 都不能成為最終授權依據。

### 改善方案

凍結三層權限：

1. **App Grant**：這個 project 可以呼叫哪些 capability。
2. **Actor Permission**：目前使用者可以執行哪些操作。
3. **Resource Authorization**：使用者是否可以操作這一筆資源。

Worker 每次收到 Platform API 請求時，重新計算最終權限。

SDK 可提前阻止明顯不允許的操作，但不能成為安全邊界。

目前不必先實作完整登入流程，但 Specification 必須保留 Actor Context，避免將來把 actor identity 硬塞進每個 Service API。

### 相容性影響

若第一版 API 預設只有 project identity，之後加入 actor identity 很可能改動每一個方法、快取鍵與錯誤碼。

---

## AR-05 — Core / Shell / Services 的分類方向正確，但 Core 太容易變成垃圾桶

**嚴重度：架構級**
**對應問題：1、3、5**

目前三層分類可以保留作為對外解釋，但內部 dependency boundary 應更精確。

### 為什麼會變成問題

`Runtime`、`Platform Bridge`、`Contract Loader`、`Settings Loader` 全部放在 Core，幾年後 Core 很可能包含：

* Protocol
* 網路請求
* DOM 操作
* 快取
* Theme
* Auth
* Error handling
* Service routing

最後任何東西都宣稱是 Core，無法判斷依賴方向。

### 改善方案

建議採四個邏輯層，不一定需要四個 repository 或四套 build：

### 1. Platform Kernel

只包含：

* Identity
* Lifecycle
* Capability Registry
* Version Negotiation
* Error Model
* API Broker
* State

Kernel 不直接操作 Header、Footer 或 Theme。

### 2. Platform Adapters

包含：

* Contract Discovery
* Contract Validation
* Settings Transport
* Worker Transport
* Auth Adapter
* Cache Adapter

這些是可替換的輸入輸出方式，不是核心規則。

### 3. Platform Shell

包含：

* Header
* Footer
* Navigation
* Theme
* CSS Tokens
* UI Mounting

Shell 是 Kernel 的 consumer，不能成為 Services 運作的必要條件。

### 4. Platform Services

包含真正的 capability provider。

依賴方向應固定為：

> Shell / Services / Adapters → Kernel

Kernel 不應反向依賴某個具體 Shell 或 Service。

### 相容性影響

這主要影響內部架構，不一定影響外部 API。但越晚切開，`Runtime` 越容易成為無法拆除的巨大檔案。

---

## AR-06 — CSS Mode 現在混合了兩個不同維度

**嚴重度：架構級**
**對應問題：1、2、3；新增**

`none / tokens / components / full / self` 中，`none` 與 `self` 的可觀察差異目前不清楚。

### 為什麼會變成問題

這個 enum 可能同時在描述：

* Shell 有沒有被載入。
* 平台有沒有注入 CSS。
* app 使用自己的 CSS 還是平台 CSS。
* 平台是否控制整個 layout。
* app 是否使用平台 components。

這些是不同維度。合併成一個 enum，日後很容易出現無法命名的組合，例如：

* 有 Header/Footer。
* 使用平台 tokens。
* 不使用平台 components。
* app 自己控制主畫面 layout。

這究竟是 `tokens`、`self` 還是 `full`，會開始模糊。

### 改善方案

v1 對外只發布：

* `none`
* `tokens`

目前尚未實作的 `components / full / self` 不應先成為 Frozen Contract enum。

未來至少拆成：

* **Shell Participation**：是否顯示平台 Shell。
* **Style Integration**：none / tokens / components。
* **Layout Ownership**：app-owned / platform-owned。

同時凍結 DOM 與 CSS 所有權：

* 平台只能修改自己建立或明確指定的 mount node。
* 平台不得注入 global reset。
* CSS custom properties 必須使用固定 namespace，例如 `--jm-*`。
* Shell class 名稱必須 namespace 化。
* `tokens` 可注入宿主範圍；components 應限制在平台自己的 DOM 範圍。
* 不可任意修改宿主既有 class、body layout 或 z-index 系統。

### 相容性影響

目前只實作 `none` 與 `tokens`，現在修正沒有成本。若先讓 `full/self` 出現在正式 Contract，之後重新拆維度會成為 breaking change。

---

## AR-07 — Contract 邊界大致正確，但 `needs` 的語意必須更精確

**嚴重度：架構級**
**對應問題：4、5、7**

Contract 作為自我聲明是正確設計。

真正的風險在於「我需要哪些能力」可能被不同實作者解讀成不同含義。

### 為什麼會變成問題

`requires: ["search@1"]` 可能被解釋為：

1. 沒有 Search，整個 SDK 初始化失敗。
2. 只有某個 Entry 不可用。
3. 專案仍可運作，但 Search 整合不啟用。
4. Platform 應該自動授權 Search。

第四種解讀尤其危險。

### 改善方案

Contract 中能力至少區分：

* **supports**：專案能與此 capability 整合。
* **requests**：希望平台啟用，但缺少時可降級。
* **requires**：某個明確整合單元缺少它就不能啟用。

`requires` 最好能綁定 scope，例如某個 entry 或某個 object integration，而不是一律視為整個 project 無法啟動。

同時凍結：

* Contract 是靜態、可重現的聲明文件。
* Contract 不包含 user-specific 狀態。
* Contract 不包含 enabled、placement、visibility 或 grant。
* Contract 不包含秘密。
* Contract 不包含平台後端 endpoint。
* Contract 不應包含由 runtime 即時計算的狀態。
* 環境差異優先透過 relative URL 與 Settings 解決。

### 相容性影響

若 `requires` 的失敗範圍日後才決定，同一份舊 Contract 可能在新版 SDK 中突然從「部分功能不可用」變成「整個初始化失敗」。

---

## AR-08 — Contract Validation 需要固定 Fail-soft 規則

**嚴重度：架構級**
**對應問題：2、4、5**

「SDK 驗證 Contract」仍不足以保證不同版本 SDK 得到一致結果。

### 為什麼會變成問題

例如 Contract 有一個 entry URL 格式錯誤：

* 是整份 Contract 無效？
* 只忽略該 entry？
* Project identity 是否仍可被接受？
* 已存在的其他 objects 是否仍可使用？

如果沒有固定規則，每次 SDK 重構都可能改變結果。

### 改善方案

建議：

* Project identity、schema version 或頂層結構錯誤：整份 Contract 無效。
* 單一 entry 錯誤：排除該 entry，其餘繼續。
* 單一 object declaration 錯誤：排除該 object，其餘繼續。
* 未知 optional 欄位：保留 warning，但不使 Contract 失敗。
* 未知 capability：視為 unsupported，不自動映射。
* 重複 ID：相關區段無效，不採用「最後一個覆蓋前一個」。
* Contract 大小、陣列數量與巢狀深度需有上限。
* 所有顯示文字在管理 UI 呈現時必須 escape。

應輸出結構化 validation result，而不只是 true/false。

### 相容性影響

Validation 規則本身就是 Contract 相容性的一部分，應在第一版凍結。

---

## AR-09 — Entries 與 Objects 還缺少永久 ID 規則

**嚴重度：架構級**
**對應問題：1、4**

Entries 與 Objects 的概念清楚，但需要避免使用 URL 或顯示名稱當作身分。

### 為什麼會變成問題

如果 Settings 使用 entry URL 當 placement key：

* URL 改名會失去 placement。
* 路由重整會被視為刪除再新增。
* 顯示名稱改變可能破壞 Pin 或 Navigation 關聯。

Objects 也可能因顯示名稱或 schema 名稱調整而失去歷史關係。

### 改善方案

每一個 Entry 至少有：

* 穩定 `entryId`
* 可變 label
* relative URL
* entry kind
* 可選 capability requirements

每一個 Object Type 至少有：

* 穩定 `objectTypeId`
* object schema version
* 可變 label
* ownership project

需要明確聲明：

> 宣告 Object Type 不代表資料可被 Platform 自動讀取。

真正的 query、resolve、open 或 mutate 行為仍必須由未來的 capability 定義。

### 相容性影響

現在補 ID 很容易。若 Settings 已經以 URL 和名稱建立大量關係，日後更換會需要資料遷移。

---

## AR-10 — SDK Lifecycle 需要正式狀態機

**嚴重度：架構級**
**對應問題：1、5、10、11**

目前列出的 SDK 工作項目是流程清單，但還不是可測試的 Lifecycle Contract。

### 為什麼會變成問題

以下情況都需要一致行為：

* Contract 找不到。
* Contract 格式錯誤。
* Project 未註冊。
* Project 被 disabled。
* Settings 暫時連不到。
* 使用者尚未登入。
* 某個 optional Service 載入失敗。
* SDK 被重複載入。
* SDK 初始化尚未完成時，app 已開始呼叫 API。

### 改善方案

內部至少區分：

1. `bootstrapping`
2. `contract-loaded`
3. `identified`
4. `settings-loaded`
5. `negotiated`
6. `ready`
7. `degraded`
8. `disabled`
9. `failed`

不必把所有狀態都變成外部 API，但要固定：

* 哪些狀態會 resolve `ready`。
* 哪些狀態會 reject `ready`。
* `ready` resolve 時保證哪些東西已經存在。
* optional Service 失敗是否影響 baseline ready。
* 重複載入 SDK 是否保持 idempotent。
* 初始化 retry 是否有上限。
* 失敗是否會留下可讀診斷資訊。

建議定義：

> `ready` 代表 Contract、Project Identity、Effective Settings 與 Capability Negotiation 已完成，基礎 Platform Context 可以使用。

它不代表所有 optional Service 都已預載完成。Service 可以 lazy initialize。

`disabled`、無法識別 project 或基礎初始化失敗時，`ready` 應 reject；宿主頁面本身仍繼續運作。

### 相容性影響

Lifecycle 一旦被外部專案依賴，之後改變 ready 時點會產生 race condition，因此必須先凍結語意。

---

## AR-11 — SDK Ready 應選擇 `window.Jonaminz.ready` Promise

**嚴重度：架構級**
**對應問題：10**

明確建議：

> 使用 `window.Jonaminz.ready` Promise 作為唯一主要 Ready 介面。

外部專案的標準使用方式應是：

`const jonaminz = await window.Jonaminz.ready`

### 不選 DOM event 的理由

DOM event 有 missed-event 問題。

如果 app 在 event 發出後才註冊 listener，就永遠收不到。為了修正，還是得再增加一個 state check，最後會形成兩套介面。

### 不選 command queue 的理由

Command queue 適合單向 analytics event，不適合一般 Platform API。

因為 Platform API 會有：

* Promise return value
* 失敗
* 權限拒絕
* 呼叫順序
* retry
* cancellation
* caller context

自動重放可能在使用者已離開頁面、狀態已變更後執行，產生隱性副作用。

### 建議細節

SDK 程式開始執行後，應第一時間同步建立穩定的 `window.Jonaminz` root 與 `ready` Promise，再進行非同步初始化。

DOM event 可以額外提供給 diagnostics 或 Shell 使用，但不能作為主要整合方式。

`ready` 初始化失敗時應 reject 固定錯誤，而不是永遠 pending，也不應 resolve 一個表面成功但其實不可用的 API。

### 相容性影響

這是每個 app 最常寫的入口，應立即凍結。

---

## AR-12 — Platform API 錯誤模型應選 B

**嚴重度：架構級**
**對應問題：9**

### 明確投票

> **選 B：失敗時 reject，並攜帶固定錯誤碼。**

### 理由

Promise 的基本語意是：

* resolve：操作成功完成。
* reject：操作未能完成。

若所有失敗都 resolve `{ ok: false }`，呼叫端很容易忘記檢查 `ok`，錯誤會被當成正常資料繼續傳遞。

這對十年維護尤其危險，因為新 Service、舊 Service、第三方函式庫與 `async/await` 都預設 reject/catch 模型。

### 建議錯誤形狀

所有 Platform API failure 使用固定的 `JonaminzError`，至少包含：

* `code`：穩定、供程式判斷。
* `message`：供人閱讀，不保證穩定。
* `service`
* `operation`
* `retryable`
* `requestId`
* 可選 `details`
* 可選 `cause`

呼叫端只能依賴 `code`，不能解析 `message`。

正常但結果為否定的情況仍然 resolve，例如：

* Search 沒有結果。
* Pin 原本就已存在。
* Calendar 查詢結果為空。

真正未完成操作的情況 reject，例如：

* 未授權。
* Service unavailable。
* 請求格式錯誤。
* 網路失敗。
* Capability 不存在。

不應同時讓部分 Service 採 A、部分 Service 採 B。

### 相容性影響

錯誤模型一旦發布後非常難統一，必須在第一個 Service 前凍結。

---

## AR-13 — 「Service 名稱先凍結」仍然太早

**嚴重度：架構級**
**對應問題：2、7**

「方法晚凍結」比提前設計所有 API 好，但直接凍結目前的 Service 名稱仍有風險。

### 為什麼會變成問題

目前名稱中已有幾個語意不穩定：

* `Health` 可能是系統健康狀態，也可能是醫療健康資料。
* `Relationship` 範圍可能過大。
* `Profile` 可能與 Auth / Identity 重疊。
* `Shared Cache` 是實作方式，不是使用者能力。
* `Analytics` 可能是使用行為上報，也可能是資料分析 Service。

一旦它們成為 `window.Jonaminz.services.health` 這類固定 property，就會形成永久承諾。

### 改善方案

真正應先凍結的是：

* Root namespace。
* Capability identifier grammar。
* Capability acquisition 方法。
* Version negotiation。
* Promise 模型。
* Error 模型。

而不是先凍結所有 property name。

概念上建議使用：

* `search@1`
* `calendar@1`
* `notification@1`

並透過固定的 capability registry 取得，而不是預先在 root 上建立所有 Service property。

目前的 Service 名稱可保留為 roadmap 或 reserved names，但在第一個真實使用案例前，不應被視為正式 API。

尤其應移除或延後 `shared-cache` 對外名稱。快取應先視為 Platform 內部實作；只有當 app 確實需要跨專案共享狀態時，再根據真實需求定義 capability。

### 相容性影響

目前沒有 caller，現在調整沒有成本。若 root property 已被 10–15 個 app 使用，再重新命名就會成為永久 alias。

---

## AR-14 — Contract Discovery 應保留一個明確 override，但不要建立多套 discovery

**嚴重度：架構級**
**對應問題：6**

### 明確建議

保留預設：

`/jonaminz.contract.json`

另外只增加一種 override：

> 在載入 SDK 的 script element 上使用 `data-contract` 指定 Contract URL。

概念形式：

`<script src="..." data-contract="/some/path/contract.json"></script>`

### 為什麼值得保留 override

根目錄規則在以下情況會不足：

* GitHub Pages 專案部署在 subpath。
* 同一個 origin 下存在多個專案。
* 遷移期間需要暫時保留舊位置。
* Contract 不方便放在網站根目錄。

### 為什麼不建議 HTML meta

Meta 與 SDK script 分離，容易出現：

* 頁面模板留下舊 meta。
* 多個 meta。
* SDK 與 meta 的責任不清楚。
* 一個頁面載入不同 integration bootstrap 時產生衝突。

將 override 放在 SDK script 自身，設定與 consumer 綁定，較容易理解。

### 為什麼不建議 HTTP Header

目前使用 GitHub Pages，HTTP Header 控制能力有限。

Header 也不利於靜態除錯，且增加 Worker、CDN 與託管平台差異，沒有足夠收益。

### 應凍結的 precedence

1. SDK script 上的明確 `data-contract`。
2. 否則使用 `/jonaminz.contract.json`。
3. 找不到即失敗，不再猜其他路徑。

不要依序掃描 meta、header、well-known、相對目錄與多個 filename。Discovery heuristic 越多，十年後越難除錯。

Contract URL 原則上應限制為目前頁面的 same-origin URL。

### 相容性影響

新增 `data-contract` 是向下相容的。之後仍能再新增其他 mechanism，但目前沒有必要。

---

## AR-15 — Integration Settings 的儲存抽象方向正確，但需要凍結「Effective Settings」邊界

**嚴重度：架構級**
**對應問題：1、8**

「現在 Git、未來 DB、SDK 不知道來源」是正確方向，但只有在 SDK 不直接讀 raw Git document 時才成立。

### 為什麼會變成問題

如果 SDK 直接依賴 Git JSON 的：

* 資料夾結構
* inheritance
* comment conventions
* project grouping
* default merge
* environment override

那未來換成 DB，雖然 URL 不同，SDK 仍然綁死 Git 的資料模型。

### 改善方案

SDK 只能取得由 Worker 計算完成的：

> Flattened Effective Integration Settings

SDK 不應知道：

* 原始設定來自幾個檔案。
* 是否有 global defaults。
* 是否有 environment inheritance。
* 是否來自 Git、DB、KV 或 Supabase。
* 管理者如何編輯設定。

Effective Settings 至少包含：

* settings schema version
* revision
* projectId
* matched environment / origin
* enabled state
* effective entries configuration
* effective Shell configuration
* effective capability grants
* 可公開的 feature flags

不包含：

* Secrets
* Service role key
* 私密管理備註
* Server-side authorization rule 的完整內容

Git 作為 v1 source of truth 完全合理。

Worker 應在套用新設定前先驗證；若新版本無效，繼續使用 last-known-good，而不是讓所有 app 同時讀到壞設定。

### 相容性影響

若 SDK 已直接解析 Git 結構，未來 DB migration 會變成 SDK breaking change。若現在只發布 Effective Settings，後端可以自由遷移。

---

## AR-16 — Settings Cache 不得被視為授權證明

**嚴重度：架構級**
**對應問題：2、5、8、12**

### 為什麼會變成問題

為了離線、速度或 Worker 暫時故障，SDK 未來很可能快取 Integration Settings。

但若快取中曾經 grant File Write，而平台之後撤銷權限，舊快取仍可能顯示為允許。

### 改善方案

區分兩種用途：

* Shell placement、Theme、Navigation 等非安全設定，可以有限度使用 stale cache。
* Platform API authorization 必須以 Worker 每次請求的 server-side 判斷為準。

SDK 中的 capability list 是「目前 client 所理解的可用能力」，不是 security token。

需要凍結：

* Settings 讀取失敗時，是否允許 stale UI。
* stale 狀態如何標示。
* retry 有上限。
* ready 是否進入 degraded 或 reject。
* server-side grant 被撤銷後，任何 client cache 都不能繼續授權操作。

### 相容性影響

若 v1 把 cached Settings 當授權依據，日後無法安全修補，只能全面改寫 API authorization。

---

## AR-17 — 「常青 SDK」必須搭配不可變 Release

**嚴重度：架構級**
**對應問題：2、5、11**

「失敗不得破壞宿主頁面」只能保護宿主 HTML 不被 SDK error 拖垮，不能解決一次錯誤部署讓 15 個 app 的 integration 同時失效。

### 明確判定

需要額外的：

* immutable SDK releases
* stable pointer
* rollback
* dedicated canary/smoke app
* global kill-switch
* per-project disable

但不需要企業級百分比灰度發布。

### 改善方案

對外網址仍維持：

`https://jonaminz.com/sdk/jonaminz-entry.js`

但它應盡可能是一個很小、低變動的 bootstrap loader。

真正 SDK payload 使用不可變網址，例如概念上的：

`/sdk/releases/<release>/...`

發布流程：

1. 產生新的 immutable release。
2. 由專用 smoke app 或 dev app 載入 canary release。
3. 驗證 Contract、Settings、Shell、API 與 rollback。
4. 將 stable pointer 原子切換到新 release。
5. 保留至少前幾個 release。
6. 出問題時，stable pointer 直接切回前一版。

Loader 或 release manifest 取得失敗時，可以使用 last-known-good release；實際快取方式屬於實作細節。

Global kill-switch 可使 SDK 在成功啟動後停止 Shell 與 Service 整合，但它無法拯救 loader 本身的 syntax error。因此 kill-switch 不能取代 immutable release 與 rollback。

### 安全回滾的語意

必須拆開定義：

* **SDK Deployment Rollback**：stable pointer 回到上一個 SDK release。
* **Contract Content Rollback**：project 重新發布先前的 Contract 內容。
* **Contract Schema Rollback**：通常不應發生，也不應和內容回滾混為一談。
* **Platform Protocol Rollback**：Worker 與 SDK 通訊協定的相容處理。

RFC 中「可以安全回滾」應主要指 SDK Deployment Rollback。

### 相容性影響

外部 script URL 不需要改，因此完全可以保持相容。若目前直接讓常青 URL 永遠覆蓋同一份大型 SDK，未來會難以保證快取與回滾結果。

---

## AR-18 — 需要一個專用 Integration Smoke App

**嚴重度：建議級**
**對應問題：5、11**

一人維護且沒有 build pipeline，不需要複雜 CI，但應有一個永遠不承載真實業務的測試 app。

### 原因

拿 SKHPSv2 或其他正式 app 測試新 SDK，很容易因該 app 自身程式而誤判 SDK 問題。

### 建議內容

Smoke app 固定覆蓋：

* 無 Contract。
* 正常 Contract。
* 無效 Contract。
* project disabled。
* Settings timeout。
* optional capability 不存在。
* Shell none。
* Shell tokens。
* SDK 重複載入。
* SDK rollback。
* Worker 回傳未知欄位。
* 舊 Contract schema 配新 SDK。

不需要測試框架也可以，重點是固定測試情境，不要每次手動臨時想測什麼。

### 相容性影響

不影響外部介面，但能大幅降低常青 SDK 的發布風險。

---

## AR-19 — Push Contract 的 Origin 驗證不是 Authentication

**嚴重度：架構級**
**對應問題：12**

### 明確判定

> `Origin` 等於 Settings 登記網域，只能作為瀏覽器來源檢查，不能證明請求真的由該 project 發出。

curl 或其他 server-side client 可以自行填寫 Origin。

### 「偽造者只會塞入一份不被採信的 Contract，所以無害」的漏洞

即使 Contract 不授權，仍可能造成：

1. **覆寫污染**
   假資料覆蓋平台目前認知的最新 Contract。

2. **資源消耗**
   大量推送造成 Worker、Supabase、log 或 notification 負擔。

3. **Stored XSS**
   Contract 的 label、description 若被管理介面直接 render。

4. **SSRF**
   若平台之後依 Contract 提供的 URL 去 server-side fetch。

5. **Review 污染**
   管理者看到偽造 Contract，以為 first-party app 發生變更。

6. **Replay / Downgrade**
   重送舊 Contract，讓平台誤以為專案退回舊宣告。

7. **Information Disclosure**
   若後端僅憑 Origin 回傳 Integration Settings、內部設定或 actor 資訊，攻擊者可以直接用 curl 取得。

8. **Environment Confusion**
   偽造 dev 或 prod Origin，將 Contract 寫入錯誤 environment。

因此它不是完全無害，只是沒有直接取得 capability grant。

### 改善方案

對目前尺度，最合理的做法不是在靜態 app 裡放 secret。任何前端 secret 都無法保密。

建議：

> SDK 的 push 只作為「發現更新的 trigger」或 unverified candidate。
> 平台後端再從 Integration Settings 登記的 Contract URL 主動 fetch，該 fetch 結果才成為 canonical Contract。

流程概念：

1. SDK 通知平台 projectId、document URL、content hash。
2. Worker 驗證 Origin 是否屬於該 project/environment。
3. Worker 不直接將 request body 設為 accepted Contract。
4. Worker 從 Settings 登記的 same-origin Contract URL 重新取得內容。
5. 驗證 schema、大小、content type 與 hash。
6. 成功後才建立 verified snapshot。

同時：

* Push endpoint rate limit。
* 限制 payload size、depth 與 array count。
* 使用 content hash 去重。
* unverified candidate 與 verified snapshot 分開保存。
* 不從 Contract 接受任意 server-side fetch URL。
* 管理介面 escape 所有文字。
* 不允許未驗證 push 覆蓋最後一份 verified Contract。
* Integration Settings endpoint 不可只依靠 Origin 保護敏感資料。
* Platform API 仍需 actor authentication 與 server-side authorization。

### 是否需要 Contract Signature

目前不需要。

若未來真的要證明 Contract 是由特定 first-party deployment 發布，可使用 offline private key 簽章、平台保存 public key。

但以目前兩人、10–15 個自行維護 app 的尺度，server-side fetch registered URL 已足夠，簽章會增加不必要的 key management。

### 相容性影響

如果 push endpoint 還沒正式發布，現在將其定義為 trigger/candidate 沒有成本。

若先把 pushed body 當 canonical Contract，之後改成 verified pull，可能影響 Contract update timing 與管理介面狀態。

---

## AR-20 — Contract Discovery 與 Contract Ingestion 不應混為同一件事

**嚴重度：架構級**
**對應問題：5、6、12**

### 為什麼會變成問題

Discovery 回答：

> 瀏覽器中的 SDK 去哪裡找到 Contract？

Ingestion 回答：

> Platform 如何建立可信、可追蹤的 Contract snapshot？

兩者目前容易被「SDK 讀到後推送」綁在一起。

### 改善方案

分開定義：

### Browser Discovery

* data-contract override
* 否則根目錄
* same-origin
* 找不到即回報

### Platform Ingestion

* 收到更新 trigger
* server-side canonical fetch
* validation
* snapshot
* revision/hash
* accepted / rejected / unchanged 狀態

如此未來即使完全停用 browser push，改成排程 pull 或管理者手動 refresh，也不影響 Contract 格式和 SDK discovery。

### 相容性影響

現在拆開純屬規格整理；若綁成一個動作後再拆，會影響 Lifecycle 與後端 API。

---

## AR-21 — 需要最小但固定的 Diagnostics Surface

**嚴重度：建議級**
**對應問題：5、11；新增**

一人維護十年，最需要的不是大型監控平台，而是能快速回答「目前這個頁面為什麼沒整合」。

### 建議至少可讀取

* SDK release version
* Platform protocol version
* lifecycle state
* detected projectId
* matched origin/environment
* Contract schema version 與 content hash
* Settings revision
* granted/effective capabilities
* Shell mode
* last error code
* requestId
* 是否正在使用 stale settings
* 是否為 rollback release

這些資訊應可透過 browser console 或簡單 diagnostics panel 查看。

不需要先接 Analytics、Sentry 或完整 telemetry。

### 相容性影響

屬於加法功能，但越早有，越容易驗證後續 SDK。

---

# 對 1–12 題的直接回答

## 1. 還缺少哪些 Frozen Layer？

缺少：

* Immutable identity model。
* Environment binding。
* Actor context。
* Version dimensions。
* Capability 合併公式。
* Lifecycle state machine。
* DOM/CSS ownership。
* Protocol envelope。
* Effective Settings 格式。
* Contract validation failure rules。
* SDK release與 rollback semantics。
* Client cache 與 server authorization 邊界。

其中 identity、protocol、lifecycle、permission calculation 與 rollback 是阻擋 Specification v1.0 的項目。

---

## 2. 哪些現在合理、十年後可能成為技術債？

主要是：

* 所有 app 直接載入同一份可變大型 SDK。
* 提前凍結 Search、Health、Shared Cache 等 Service 名稱。
* 把 `none / tokens / components / full / self` 當成單一維度。
* 讓 SDK 直接解析 Git Settings 結構。
* 將 browser Settings 視為 authorization。
* 把 pushed Contract body 當作可信 canonical state。
* 以 hostname 或 URL 當 project identity。
* 讓 `Runtime` 成為所有共通功能的集合。

---

## 3. Core / Shell / Services 是否合理？

概念合理，但建議在 Core 與外部功能間加入明確的 Kernel / Adapter 分界。

最重要的不是資料夾名稱，而是 dependency direction：

* Kernel 不依賴 Shell。
* Kernel 不依賴具體 Service。
* Shell 不應成為 Service API 的先決條件。
* Contract / Settings / Worker transport 應被視為 Adapter。
* Services 透過 capability broker 暴露，不直接污染 root namespace。

---

## 4. Contract 是否仍混入其他責任？

主要風險是：

* `requires` 的失敗範圍不明。
* Entry/Object 缺少穩定 ID 規則。
* 可能混入 environment-specific URL。
* 可能讓 object declaration 被誤認為資料存取 API。
* 可能把 capability request 誤認為 grant。

Contract 應只描述 project 靜態能力與可暴露資源，不描述 effective runtime state。

---

## 5. SDK Lifecycle 是否有遺漏？

遺漏：

* Actor authentication。
* Project/environment matching。
* Version negotiation。
* Capability intersection。
* Partial validation。
* Disabled state。
* Degraded state。
* Duplicate SDK loading。
* Bounded retry。
* Settings stale behavior。
* Diagnostics。
* Optional Service lazy initialization。
* Canonical Contract verification。
* Release identification。

---

## 6. Contract Discovery 應怎麼做？

保留：

* 預設 `/jonaminz.contract.json`
* script `data-contract` 作唯一 override

目前不加入：

* HTTP Header
* 多路徑掃描
* 自動猜測
* 多套 discovery precedence

HTML meta 不是不能做，但在目前尺度下沒有 script attribute 清楚。

---

## 7. Platform API 名稱先凍結、方法晚凍結是否安全？

只對一半。

應先凍結：

* Root namespace。
* Capability identifier grammar。
* Capability acquisition。
* Versioning。
* Promise model。
* Error model。

不應把所有目前想像中的 Service name 都當成正式 API。

Service 名稱也應等第一個真實 caller 出現時才正式發布。現有名稱可以列為 roadmap，不列為 Frozen API。

---

## 8. Integration Settings Git → DB 的抽象是否足夠？

只有在 SDK 讀取的是 Worker 產生的 flattened Effective Settings 時才足夠。

如果 SDK 直接依賴 Git 文件結構，就不夠。

Git 作為 v1 source of truth 合理，不需要現在換 DB。

---

## 9. 錯誤模型投票

明確選：

> **B. reject 並攜帶固定錯誤碼。**

成功但結果為空或否定仍 resolve。

未完成操作、未授權、網路失敗、Service failure、invalid request 則 reject `JonaminzError`。

---

## 10. SDK Ready 介面投票

明確選：

> **`window.Jonaminz.ready` Promise。**

DOM event 只能作補充。

不使用 general command queue。

---

## 11. 常青 SDK 是否需要額外保護？

需要。

最低合理保護為：

* immutable releases
* stable pointer
* dedicated canary/smoke app
* manual promotion
* immediate rollback
* global kill-switch
* per-project disable
* last-known-good Settings

不需要百分比灰度流量或企業級發布平台。

「安全回滾」應明確指 SDK deployment rollback；Contract content rollback 另行定義。

---

## 12. Origin 驗證是否足夠？

不足。

Origin 不是 authentication，非瀏覽器請求可以偽造。

目前最適合的模型是：

* Browser push = unverified update trigger。
* Worker 從 registered Contract URL 重新 fetch。
* Server fetch + validation 後才建立 canonical snapshot。
* Push endpoint 做 rate limit、size limit、dedupe 與污染隔離。
* Settings 與 Platform API 不可只憑 Origin 授權。
* 真正權限由 app grant、actor permission 與 server-side authorization 共同決定。

---

# 建議凍結前必須完成的六項決策

在 Specification v1.0 Frozen 前，至少先完成：

1. **Identity and Environment Model**
2. **Version and Compatibility Model**
3. **Lifecycle and Ready Semantics**
4. **Effective Capability Calculation**
5. **Evergreen Release and Rollback Model**
6. **Contract Ingestion Trust Model**

CSS/DOM ownership 也應至少凍結 v1 的最低規則。

完成這些後即可開始 Schema 與 SDK，不需要繼續預先設計 Search、AI、Calendar 等方法。

---

# 最終評價

這個架構不需要推翻。

真正需要調整的是：

* 不要把「介面穩定」誤解成「現在就替未來所有 Service 命名」。
* 不要把「SDK 不直接破壞宿主頁面」誤解成「常青部署已經安全」。
* 不要把「Contract 沒有授權能力」誤解成「任何人都能推 Contract 而完全無害」。
* 不要把「Settings 決定 permissions」誤解成「瀏覽器中的 Settings 可以負責安全授權」。

修正上述 Frozen Layer 後，這套設計符合目前尺度，也具備長期演化空間。
