<!--
來源：Codex
收件日：2026-07-10
對應 RFC：docs/platform-integration-review-request.md（凍結版，12 問）
狀態：原文照錄，未經編輯。彙整前不據此修改任何規格文件。

Status: Historical / Superseded
此文件是規格定稿前的一份審查意見，不代表目前實作，內容已由
docs/platform-integration-review-consolidation.md 彙整、
docs/platform-integration-spec-v1.md（S1-S39，唯一權威）吸收定案。
目前狀態請參考：AI_CONTEXT/CURRENT_STATE.md 與 docs/platform-integration-spec-v1.md。
-->

以下是我會給這份 RFC 的 Architecture Review。先講結論：你的方向大致正確，而且有刻意避開「兩人平台卻蓋成 SaaS」的過度設計。但真正需要凍結的，不只 Contract schema 和 SDK URL，而是 **失敗語意、初始化語意、能力協商語意、設定快照語意、以及安全信任邊界**。這些一旦模糊，十年後會變成每個 app 都用自己的方式補洞。

---

## 發現 1：缺少「Integration Snapshot」這個凍結層

**嚴重度：架構級**
**對應問題：1、5、8**

### 問題

目前描述是：

1. SDK 讀 Contract
2. 回報平台
3. 取得 Integration Settings
4. 啟用能力

但沒有定義 SDK 最終拿到的是什麼形狀的「有效整合結果」。

如果 SDK 每次都即時理解 Contract + Settings + runtime 狀態，未來 Git Settings 換 DB、加入 cache、加入 rollback、加入能力版本時，外部 app 會很容易被內部變動牽動。

### 什麼情況會發生

例如未來你把 Settings 從 Git JSON 換成 Supabase，或加入 per-project override。若 SDK 直接依賴多個設定來源的合併邏輯，後面會很難保證「同一份 Contract 在某時間點到底被平台授權成什麼」。

### 改善方案

凍結一個 SDK 可見的 `Integration Snapshot`：

```js
{
  projectId,
  contractVersion,
  sdkVersion,
  settingsVersion,
  effectiveCapabilities,
  disabledCapabilities,
  shell,
  services,
  warnings,
  fetchedAt
}
```

SDK 對宿主 app 只暴露這個「平台裁決後的結果」，不要暴露 Git/DB/registry/manifest 的內部來源。

### 相容性影響

建議現在就加入，不會破壞相容性。這是長期最值得凍結的層之一。

---

## 發現 2：Contract 應避免放入「執行意圖」

**嚴重度：架構級**
**對應問題：4**

### 問題

你說 Contract 是自我聲明，這是對的。但「needs capabilities」這一類欄位容易滑向執行意圖。

例如：

```json
{
  "requires": ["search@1", "profile@1"]
}
```

這看似聲明，實際上可能被 SDK 解讀成「沒有這些就不能啟動 app」。那它就不只是自我介紹，而是開始影響執行策略。

### 什麼情況會發生

十年後某個 app 寫了 `requiredCapabilities`，SDK 為了方便直接擋掉整頁初始化。這會讓 Contract 間接決定 enabled / availability，違反你現在的邊界。

### 改善方案

把 Contract 內能力拆成兩種語意：

```json
{
  "supports": ["search@1"],
  "declaresNeeds": ["profile@1"]
}
```

並明確凍結規則：

> Contract 可以表達偏好與能力需求，但不能決定是否阻止宿主頁面運作。是否降級、警告、禁用、替代，永遠由 Integration Settings / SDK policy 決定。

### 相容性影響

低。只要現在命名清楚，之後不需要重命名。

---

## 發現 3：Core / Shell / Services 還少一層「Policy」

**嚴重度：架構級**
**對應問題：3、4、8、11**

### 問題

目前三層是：

- Core
- Shell
- Services

但你其實還有一種東西不屬於任一層：平台裁決規則。

例如：

- 哪些 capability 被授權
- 哪些 shell integration 被允許
- 哪些 project 可以回報 contract
- SDK 壞掉時停用哪些功能
- 某 project 是否使用 tokens CSS

這些不是 Core 的技術能力，也不是 Shell UI，也不是 Service API。它是 **Policy / Settings / Governance**。

### 什麼情況會發生

如果沒有獨立 Policy 層，Settings Loader 會慢慢變成混雜地帶：一半是資料讀取，一半是授權，一半是 fallback，一半是 kill-switch。十年後最難拆。

### 改善方案

建議概念上改成四層：

1. **Platform Runtime/Core**：SDK、loader、bridge、ready、diagnostics
2. **Platform Policy**：settings、capability grants、placement、visibility、kill-switch、effective integration
3. **Platform Shell**：header、footer、theme、navigation、CSS
4. **Platform Services**：search、pin、AI、notification 等

不一定要多一個資料夾，但 Spec 裡應該有這個邊界。

### 相容性影響

現在調整是純架構語意，成本低。晚點才補會變成重構。

---

## 發現 4：Discovery 應保留擴充點，但 v1 只支援兩種

**嚴重度：架構級**
**對應問題：6**

### 問題

只支援 `/jonaminz.contract.json` 很乾淨，但 GitHub Pages 常見情況是 project site 掛在子路徑：

```txt
https://jonaminz.com/my-app/
```

這時根目錄可能不是 app 根目錄。若你凍死 root discovery，未來搬遷、monorepo、demo path、preview path 會卡住。

### 建議

v1 支援：

1. 預設同 origin / 同 app base path 下的 `jonaminz.contract.json`
2. HTML meta override

例如：

```html
<meta name="jonaminz-contract" content="/my-app/jonaminz.contract.json">
```

暫時不要用 HTTP Header。原因是 GitHub Pages 靜態託管下 header 控制能力弱，十年維護成本高，不符合你的尺度。

### 規則

Discovery 順序可以凍結為：

1. `meta[name="jonaminz-contract"]`
2. SDK script 所在頁面的 base path + `/jonaminz.contract.json`
3. 失敗則進入 degraded mode

### 相容性影響

現在加 meta override 幾乎零成本。未來如果才補，會遇到舊 app 已經假設固定 root 的問題。

---

## 發現 5：Platform API「名稱先凍結，方法晚凍結」是合理的，但 Service 名稱也不要太早全凍

**嚴重度：建議級**
**對應問題：7**

### 問題

凍結 namespace 比凍結方法安全，但你列出的 Services 有些可能只是概念，不一定會成為穩定 API。

例如：

- Shared Cache
- Relationship
- AI
- Health
- Profile

這些名字一旦進入 Contract capability，十年後就算沒實作也會形成語意債。

### 改善方案

分成兩類：

```txt
reserved service names
published capability names
```

Spec v1 可以保留服務名，但只有正式 capability 才算相容性承諾：

```txt
search      reserved
search@1    published
```

也就是：**名稱可以保留，但不要讓 reserved name 等同可呼叫 API。**

### 相容性影響

低。這會讓你保有語意空間，不會被早期命名綁死。

---

## 發現 6：Capability Version 應版本化「能力合約」，不是版本化整個 Service

**嚴重度：架構級**
**對應問題：7**

### 問題

`search@1` 看起來簡單，但 Search 可能包含多個能力：

- query
- indexing
- result rendering
- suggestions
- object hydration

如果整個 service 只有一個版本，未來小變更會導致 `search@2` 太大、太模糊。

### 改善方案

能力版本應更細：

```txt
search.query@1
search.result@1
search.indexable-object@1
notification.send@1
notification.subscribe@1
```

Service namespace 可以晚凍，capability method-level contract 才是真正凍結單位。

### 相容性影響

現在改 naming 最划算。等第一個 API 出來後再拆會比較痛。

---

## 發現 7：問題 9 投票：選 B，reject 固定錯誤碼

**嚴重度：架構級**
**對應問題：9**

我選 **B. reject 帶固定錯誤碼**。

### 理由

Platform API 是 Promise API，呼叫者會自然預期：

```js
try {
  const result = await Jonaminz.api.search.query(...)
} catch (error) {
  ...
}
```

如果業務失敗、權限失敗、網路失敗都 resolve `{ ok: false }`，十年後會有三個問題：

1. 呼叫者忘記判斷 `ok`，錯誤會被當成功資料傳下去。
2. `Promise.all` / `await` / async flow 的語意被削弱。
3. 真正 exception 和平台錯誤會被迫分成兩套處理。

### 但要補一條規則

不是所有「沒有資料」都 reject。

建議：

- reject：平台無法完成請求、未授權、SDK 未 ready、服務不可用、合約不相容
- resolve 空結果：查詢成功但沒有資料

錯誤形狀固定：

```js
{
  name: "JonaminzPlatformError",
  code: "CAPABILITY_NOT_GRANTED",
  message: "...",
  service: "search",
  capability: "search.query@1",
  recoverable: true,
  details: {}
}
```

### 相容性影響

這是每天會碰到的凍結層，請現在決定。選 B 比 A 更符合 JS 生態與長期維護。

---

## 發現 8：Ready 介面建議凍結為 Promise + DOM event，避免 command queue 成為十年負債

**嚴重度：架構級**
**對應問題：10**

### 建議

主介面：

```js
await window.Jonaminz.ready
```

輔助介面：

```js
window.addEventListener("jonaminz:ready", ...)
window.addEventListener("jonaminz:error", ...)
```

不建議 v1 做 command queue stub。

### 為什麼

`window.Jonaminz.ready` 是最穩的日常 API，對原生 JS、無 build pipeline、少量 first-party apps 最合適。

DOM event 則適合不想 await 的 legacy script 或跨模組監聽。

command queue 看起來方便，但它會帶來很多十年債：

- 呼叫順序重放語意要凍結
- 失敗時 queue 怎麼處理要凍結
- 哪些 API 可以 queue、哪些不行要凍結
- queue 裡 callback exception 怎麼報要凍結
- 容易鼓勵 app 在 SDK ready 前亂呼叫平台

### 建議凍結寫法

```js
const platform = await window.Jonaminz.ready;
await platform.api.search.query(...);
```

若初始化失敗，`ready` 不應永遠 pending。它應該 resolve degraded platform，或 reject？我的建議是：

- SDK 載入成功但平台不可用：resolve degraded platform
- SDK 自身初始化發生不可恢復錯誤：reject `SDK_INIT_FAILED`

這樣宿主頁面不會壞，但 app 可以知道平台不可用。

### 相容性影響

高。這一行會到處出現，應該現在凍結。

---

## 發現 9：常青 SDK 需要最小可維護的 kill-switch，不需要大平台金絲雀

**嚴重度：架構級**
**對應問題：11**

### 問題

「失敗不得破壞宿主頁面」不等於「壞部署不會同時影響所有 app」。

常青 SDK 最大風險是集中式壞更動。即使宿主頁面不壞，所有平台能力可能同時失效。

### 建議保護層級

在你的一人維護、無 build pipeline 前提下，我建議做這三個，不建議做完整灰度平台：

1. **SDK stable URL + dated fallback artifact**
   - `/sdk/jonaminz-entry.js`
   - `/sdk/releases/2026-07-10/jonaminz-entry.js`

2. **Settings kill-switch**
   - 全域停用某 capability
   - 停用某 project integration
   - 停用 Shell injection
   - SDK 進入 degraded mode

3. **Manual rollback script / checklist**
   - 不需要 CI/CD 很漂亮
   - 但要能在 5 分鐘內把 stable URL 指回上一版

### 「安全回滾」語意要拆開

請明確定義三種 rollback：

- **SDK rollback**：常青入口回到上一個 SDK artifact
- **Settings rollback**：Integration Settings 回到上一個 commit / snapshot
- **Contract rollback**：外部 app 自己把 contract 改回上一版

SDK 不應假設 Contract rollback 可由平台控制。

### 相容性影響

這是常青 SDK 的核心安全網。現在不需要金絲雀，但需要 kill-switch 和 artifact rollback。

---

## 發現 10：Push Contract 的威脅模型基本成立，但要防止垃圾資料與誤採信

**嚴重度：架構級**
**對應問題：12**

### 評估

你的假設「偽造者最多塞進一份不被採信的合約副本」大致成立，前提是後端永遠只把 Integration Settings 當授權來源。

但仍有洞，不是權限洞，而是資料污染與營運誤判洞。

### 風險

1. 攻擊者偽造大量 Contract push，塞爆資料表或 log。
2. 攻擊者偽造某 projectId 的 contract，讓後台顯示出錯誤的「最新回報」。
3. 你未來做自動 health / diff / alert 時，可能誤把偽造資料當真。
4. Origin header 對非瀏覽器請求不是可信身份證明。

### 改善方案

最低限度應該有：

- Contract push 永遠標記為 `observed`, 不等於 `trusted`
- Settings 裡的 projectId + allowed origins 才是 trusted source
- 後端儲存時分開：
  - `observed_contract_reports`
  - `effective_integrations`
- 加 rate limit
- 加 payload size limit
- 加 schema validation
- 後台 UI 明確顯示 source trust level

如果要再加一點保護，可加 project-level shared token，但以你的尺度不一定必要。因為這些是 first-party 靜態 app，token 放前端也不是秘密。

### 相容性影響

資料模型會受影響，建議現在就把 observed / effective 分開。

---

## 發現 11：CSS integration levels 太多，v1 應凍結語意但不要承諾完整能力

**嚴重度：建議級**
**對應問題：2、3**

### 問題

`none / tokens / components / full / self` 很有方向感，但 `full` 和 `self` 很容易變成模糊地帶。

例如 `self` 是完全不受平台影響？還是仍要留 footer？`full` 是平台接管所有 layout？還是只注入 shell class？

### 改善方案

Spec v1 可以保留 enum，但清楚標註：

```txt
v1 implemented: none, tokens
reserved: components, full, self
```

並凍結 `tokens` 的最小語意：

- 只注入 CSS variables
- 不改寫宿主 DOM
- 不強制 class naming
- 不保證 component 樣式

### 相容性影響

低。這會避免未來 app 以為 `full` 已經是承諾。

---

## 發現 12：缺少「Degraded Mode Contract」

**嚴重度：架構級**
**對應問題：5、10、11**

### 問題

你說 SDK 失敗不得破壞宿主頁面，但沒有定義失敗時宿主能看到什麼。

如果每次失敗都是 console error，app 作者會開始自己寫偵測邏輯。

### 改善方案

凍結 degraded platform 物件：

```js
{
  status: "degraded",
  reason: "SETTINGS_UNAVAILABLE",
  api: {},
  capabilities: {},
  diagnostics: {...}
}
```

這樣 app 永遠可以：

```js
const platform = await Jonaminz.ready;
if (platform.status !== "ready") {
  // hide integration-only controls
}
```

### 相容性影響

高，但現在加入成本低。這比「失敗不要壞頁面」更可操作。

---

## 發現 13：Diagnostics / Observability 應是 Core 的一等公民

**嚴重度：建議級**
**對應問題：5、11、新增**

### 問題

兩人平台不需要 SLA 監控，但需要能回答：

- SDK 版本是什麼？
- Contract 從哪裡讀到？
- Settings 版本是什麼？
- 哪些 capability 被拒絕？
- 為什麼 Shell 沒啟用？
- 現在是 ready 還是 degraded？

### 改善方案

凍結一個簡單介面：

```js
window.Jonaminz.diagnostics()
```

或在 ready result 裡提供：

```js
platform.diagnostics
```

不要等到壞掉才補。這是小平台最划算的維護工具。

### 相容性影響

低。

---

## 發現 14：Entries / Objects 應避免直接綁 URL 與資料 schema

**嚴重度：建議級**
**對應問題：2、4、7**

### 問題

Entries 是入口，Objects 是可理解資料型別，這個切分是好的。但如果 Objects 太早放入詳細資料欄位，會變成資料庫 schema 的影子。

### 改善方案

Objects v1 只定義：

```json
{
  "type": "note",
  "capabilities": ["search.indexable-object@1"],
  "displayName": "Note"
}
```

不要在 Contract v1 定義完整 object fields。等第一個 service 需要，例如 search indexing，再由 capability contract 定義該能力需要的 object projection。

### 相容性影響

低。這能保持 Contract 輕。

---

## 發現 15：Integration Settings 用 Git 管理足夠，但要凍結「設定版本」與「生效時間」

**嚴重度：架構級**
**對應問題：8、11**

### 問題

SDK 不知道 Git 或 DB，這個抽象是對的。但如果 Settings 沒有 version / revision，debug 會很痛。

### 改善方案

不管背後是 Git 還是 DB，SDK 拿到的 Settings Snapshot 應包含：

```json
{
  "settingsVersion": "git:abc123",
  "generatedAt": "...",
  "effectiveFrom": "...",
  "source": "git"
}
```

`source` 可以給 diagnostics，不要讓 app 依賴。

### 相容性影響

低。這是未來換 DB 的橋。

---

# 總結建議

我會在 Specification v1.0 前凍結這幾件事：

1. `window.Jonaminz.ready` 是主要 Ready 介面，DOM event 是輔助，不做 command queue。
2. Platform API 錯誤採 **reject 固定錯誤碼**。
3. SDK 對外暴露的是 `Integration Snapshot`，不是 Settings 原始資料。
4. 加入 `Policy` 這個架構層，避免 Settings Loader 變成混雜核心。
5. Contract discovery 支援預設路徑 + HTML meta override，不建議 v1 用 HTTP Header。
6. Capability version 要細到能力合約，不要只用粗粒度 `service@1`。
7. 常青 SDK 要有 kill-switch、release artifact、手動 rollback，不需要完整金絲雀。
8. Contract push 要分清 `observed` 和 `effective/trusted`，Origin 只能當輔助訊號。

你目前最大風險不是功能設計錯，而是幾個「看起來只是實作細節」的東西其實會變成十年介面：ready、error、snapshot、discovery、rollback、degraded mode。這幾個先釘穩，後面的 Search / AI / Notification 反而可以慢慢長。
