# Jonaminz Platform Integration — Specification v1.0

狀態：**RC（Release Candidate，待使用者驗收後標 Frozen）**
日期：2026-07-10
前身文件：`platform-integration-review-request.md`（RFC）、
`platform-integration-reviews/`（五份 Architecture Review）、
`platform-integration-review-consolidation.md`（彙整＋裁決）。
本文吸收上述全部定案，是唯一的權威規格；與前身文件矛盾時以本文為準。

本文分四部分：**敘事骨架**（怎麼理解這個系統）、**凍結層**（永不改的條文，
編號 S1–S38）、**演進層**（只能 additive）、**保留層**（形狀已定、內容留白）。
每一節標記所屬層級。之後的 JSON Schema、Contract 範本、SDK 皆以本文為準。

---

## 第一部分：敘事骨架 — 圖書館模型

Jonaminz 是圖書館。外部專案是一棟一棟自己的房子。

- 房子只做一件事：在 head 貼一段**官方 snippet**（含載入專員的 script）。
- **專員（SDK）**到府後，讀取房子放在門口的**合約**（`jonaminz.contract.json`）。
  合約只寫「我是誰、我有哪些入口、我支援/需要哪些能力」——只寫自己是什麼，
  **不寫定位**。定位（上不上架、放哪、給什麼權限）永遠由圖書館的
  **Integration Settings** 決定。
- 專員把合約**交回圖書館**存查（推模式）；但圖書館**收下不等於採信**——
  合約副本先進 pending，館長（你）看過 diff、點核准，才成為 approved 快照。
  圖書館的門面（Shell、Search）永遠只讀 approved 快照。
- **工具帶在專員身上**（`window.Jonaminz.*`）。圖書館同意的工具能用；
  沒同意的工具存在但**婉拒**（reject 固定錯誤碼），永不消失、永不炸房子。
- 專員也順便**掛窗簾**（Theme/CSS tokens）——如果合約有宣告、且圖書館同意。
- **專員換人（SDK 升級）由圖書館單方面進行**，房子不用改任何東西；
  新專員永遠看得懂所有歷史合約。有升級版合約但不強制換。
- 專員**永遠不燒房子**：任何失敗都靜默降級，宿主頁面照常運作。

### 尺度前提（本規格的校準基準）

兩位使用者（Jonathan/Minz）；10–15 個自行開發的 first-party app；無陌生第三方；
GitHub Pages 靜態託管、原生 JS、無 build pipeline；單一 Cloudflare Worker +
Supabase；一人維護。十年穩定的目標是**介面與規則不變**，不是預先蓋好
大平台設施。

### 架構分層（內部邊界；不要求對應資料夾）

```
Kernel      身份、lifecycle、capability registry、錯誤模型、狀態
Adapters    contract discovery/validation、settings/worker transport、cache
Shell       header/footer/theme/CSS tokens、UI mounting
Services    capability providers（headless，無 DOM）
─────────────────────────────────────────────
Policy      授權裁決（grant、placement、kill-switch）——住在 Worker，不在 SDK
Data        物件定址（Data Contracts）——凍得比以上任何一層都死
```

依賴方向凍結：Shell / Services / Adapters → Kernel；Kernel 不反向依賴。
Services 是 headless capability API，**任何像素由 Shell 或宿主渲染**。
合約可宣告 `shell: false`，此時只建 Platform API、不做任何 UI。

---

## 第二部分：凍結層（永不改）

### A. 身份與定址（Data Contracts）

- **S1** `projectId`：永久不可變、不可重用、與網域/repo/URL 無關。
  文法：`^[a-z][a-z0-9-]{1,62}$`（小寫英數與連字號、字母開頭、2–63 字元、
  大小寫敏感性＝一律小寫）。顯示名稱另立欄位，可自由改。
- **S2** `objectId`：由專案自給、對平台是不透明字串（≤256 字元）、專案保證
  永久穩定（禁止資料庫自增序號等會因重建而變的值）。
- **S3** `objectType` 與 `entryId`：在 projectId 命名空間內永久穩定；
  語意永不改，要改就出新 ID。文法同 S1。
- **S4** 跨專案聚合一律用複合鍵：entries 用 `(projectId, entryId)`，
  objects 用 `(projectId, objectType, objectId)`。此形狀是 Pin/Relationship/
  Search 持久化資料的外鍵，**凍得比任何 API 都死**。
- **S5** objectRef → URL 的解析：Contract 以每 type 的 URL template 聲明，
  平台端解析。宣告 Object Type ≠ 資料可被平台自動讀取；實際讀寫由未來
  capability 定義。
- **S6 跨源身份（裁決 D2）**：**v1 外部專案一律匿名**。登入態（Google OAuth）
  只存在 jonaminz.com 主站；外部專案只能取得非個人化能力；個人資料類 API
  只在主站提供。Actor Context 的欄位形狀保留在協定中（見保留層），未來
  引入跨源身份時不改 API 表面。授權判斷由 Worker 逐請求計算
  「此 projectId ＋ 此 actor ＋ 此能力」，瀏覽器中的任何狀態都不是授權證明。

### B. Contract（合約）

- **S7** 檔名 `jonaminz.contract.json`；預設位置為專案部署根路徑。
- **S8** 最小必填：`contractVersion`（整數，v1 = 1）＋ `app.projectId` ＋
  `app.title`。必填集合十年內只能縮小不能擴大。
- **S9** 合約永不含：enabled、visibility、placement、`order`/`weight`/
  `position` 等排序欄位、permissions、granted capabilities、secret、
  api key、token、平台後端 endpoint、user-specific 或 runtime 狀態。
  icon/title 可以（自我描述），排序不行（版面決策）。
- **S10** 能力宣告三分：`supports`（能整合）／`requests`（希望啟用，缺了
  可降級）／`requires`（綁定某 entry 或整合單元，缺它該單元不啟用）。
  **requires 永不阻止宿主頁面運作、永不造成自動 grant。**
- **S11** Schema 演化：未知欄位一律忽略（must-ignore，雙向）；未知
  capability/enum 值視為不支援、**不得 fallback 成權限更大的模式**；
  已發布欄位永不改語意與型別，要變就加新欄位；停用靠 `deprecated` 標記，
  永不刪除。
- **S12** Validation fail-soft：頂層結構、`contractVersion` 或 projectId
  錯誤 → 整份無效；單一 entry / object 錯誤 → 剔除該項，其餘繼續；
  重複 ID → 該區段無效（不採「後者覆蓋」）；大小/陣列數/巢狀深度有上限；
  輸出結構化 validation result（不是 true/false）。

### C. 信任模型（合約收取）

- **S13** **推送 ≠ 採信**。平台端合約副本分兩態：`observed`（收到的）／
  `approved`（採信的）。**Shell 與 Search 永遠只讀 approved 快照。**
- **S14 核准（裁決 D4）**：新版合約（以 content hash 判定變更）進 pending；
  由使用者在後台檢視 diff 後**手動核准**成為 approved。核准紀錄即 audit
  trail。（未來可加 GitHub Action token 通道：帶有效 token 的推送自動核准、
  無 token 進 pending——屬演進層，加入時不改本條語意。）
- **S15** 廉價防線（Worker 端全部強制）：只收 Integration Settings 已登記的
  projectId；**entry URL 必須與該專案登記網域同源**；rate limit；payload
  size/深度上限；content hash 去重；管理介面 escape 所有來自合約的顯示文字。
- **S16** Contract **永無授權效力**：收到合約不啟用任何東西；一切 enabled/
  placement/grant 只看 Integration Settings。
- **S17** Discovery（瀏覽器端怎麼找合約）與 Ingestion（平台端怎麼建立可信
  快照）是兩個獨立定義的機制，可各自演化。

### D. Contract Discovery

- **S18** 順序凍結：(1) SDK script tag 的 `data-contract` 屬性（唯一
  override）→ (2) `/jonaminz.contract.json` → (3) 找不到即回報並進入
  degraded，**不掃描其他路徑**。
- **S19** Contract URL 限與頁面 same-origin。
- **S20** 明確否決：HTML meta、HTTP header、多路徑猜測。十年尺度下探索
  機制要的是一種可靠做法，不是可擴充清單。

### E. SDK 整合介面（宿主每天寫的那幾行）

- **S21 官方 snippet（裁決 D1，原文凍結）**：

```html
<script>
(function () {
  if (window.Jonaminz) return;               /* 冪等：只建一次 */
  var resolveReady;
  window.Jonaminz = {
    ready: new Promise(function (resolve) { resolveReady = resolve; })
  };
  window.Jonaminz.__resolveReady = resolveReady;
})();
</script>
<script async src="https://jonaminz.com/sdk/jonaminz-entry.js"
        data-contract="/jonaminz.contract.json"></script>
```

  保證路徑是 `const jz = await window.Jonaminz.ready`——snippet 先於任何
  宿主程式碼建立 ready Promise，任何載入時序下都存在、無 race。
  不提供 command queue。`data-contract` 可省略（用預設路徑）。
- **S22** 全域命名空間：`window.Jonaminz`（大寫 J），保留給 SDK；宿主不得
  寫入。SDK 啟動時若發現命名空間已被非 snippet 產物佔用：不覆寫、
  console 報警、靜默退場。重複載入 SDK 為 no-op（冪等）。
- **S23** `ready` 語意：resolve 時保證 Contract、身份判定、Effective
  Settings、能力協商已完成（optional service 可 lazy init，不擋 ready）。
  **ready 永不永久 pending**：平台不可用 → resolve degraded platform
  （`status: "degraded"`, `reason`）；SDK 自身不可恢復錯誤 → reject
  `SDK_INIT_FAILED`。宿主可依 `jz.status` 隱藏整合限定 UI。
- **S24** 不燒房子：SDK 任何內部錯誤都不得影響宿主頁面；全程自我 catch；
  同步阻塞式載入被禁止（snippet 固定用 async）。
- **S25** 宿主環境隔離：平台只動自己建立或明確指定的 mount node；不注入
  global reset；不改宿主既有 class、body layout、z-index；SDK 的
  localStorage/sessionStorage key 一律 `jonaminz.` 前綴。
- **S26** v1 生命週期語意為「整頁載入」；SPA 路由切換不重初始化。
  唯讀診斷面 `Jonaminz.status`（lifecycle 狀態、SDK release、Settings
  revision、被拒能力、最後錯誤碼、是否 stale cache、是否 rollback 版）。

### F. 錯誤模型

- **S27**（4:1 定案）Platform API 失敗一律 **reject**，錯誤物件形狀凍結：
  `JonaminzError { code, message, service, capability, retriable }`。
  `code` 穩定供程式判斷；`message` 供人讀、不保證穩定、不得被程式解析。
- **S28** 錯誤碼註冊規則：碼永不重用；呼叫端必須容忍未知碼（fallback 到
  通用處理）。初始碼表：`CAPABILITY_NOT_GRANTED`、`SDK_INIT_FAILED`、
  `SERVICE_UNAVAILABLE`、`NOT_READY`、`INVALID_REQUEST`、`NETWORK_ERROR`
  （碼表可長大，形狀不變）。
- **S29** **空結果不是錯誤**：查詢成功但無資料 → resolve 空值/空陣列；
  reject 只留給未完成的操作。全部 API 一致，不得部分採 resolve-ok 模式。

### G. Capability 與授權

- **S30** Capability 文法：`<service>.<capability>@<major>`
  （如 `search.query@1`）——**版本細到能力層級**，不是整個 service 一個版本。
  major 變更 = 新識別字；舊版標 deprecated、永不移除。名稱一經發布永不
  重用於不同語意。
- **S31** Effective capability 公式凍結，**計算永遠在 Worker**：
  `Effective = Contract supports ∩ Settings 授權 ∩ Runtime 可用 ∩ Actor 允許`。
  SDK 只照做、不做權限推導。Settings grant 了合約未宣告的能力 → 不生效＋
  診斷警告；合約移除 entry 但 Settings 還有其 placement → 忽略該 placement，
  不自動刪 Settings。
- **S32** 未授權的工具**存在但婉拒**：service namespace 永遠掛在 API 物件上，
  呼叫回傳 reject（`CAPABILITY_NOT_GRANTED`），永不 undefined、永不同步
  throw。授權開通後同一行程式碼自動生效。
- **S33** 瀏覽器中的 Settings/快取永不是授權證明：非安全設定（theme、
  placement）可用 stale cache；授權判斷由 Worker 逐請求重算。

### H. Shell / CSS

- **S34** CSS 生效等級 = `min(Contract 聲明, Settings 授予)`。v1 等級只有
  `none` 與 `tokens`（其餘為 reserved，見保留層）。
- **S35** `tokens` 的最小語意凍結：只注入 CSS custom properties；不改寫
  宿主 DOM；不強制 class 命名；不保證元件樣式。
- **S36** Token 命名凍結：前綴 `--jz-`；語義命名（`--jz-surface`，禁
  `--jz-gray-100` 式外觀命名）；**只增不刪、可標貶值不可移除**；
  值隨主題自由變、名永不變。既有 theme-runtime 的無前綴變數
  （`--color-primary` 等）在 SDK 收編時正式化為 `--jz-*`，舊名以別名過渡。

### I. 發布模型（常青 SDK）

- **S37**（5:0 定案）`https://jonaminz.com/sdk/jonaminz-entry.js` 是常青
  URL，但內容降級為**極小、幾乎永不改動的 loader**：向 Worker 取版本指標
  （短 TTL/ETag）→ 載入 `sdk-<hash>.js`（immutable、長 cache）。
  - 回滾 = 改指標值（**「安全回滾」專指 SDK 部署回滾**；Contract 回滾是
    各 app 自己 repo 的 git 事務；Settings 回滾是 Settings 的 git revert
    ——三者是三個獨立機制）。
  - kill-switch = 指標指向 no-op 版本。
  - 金絲雀 = Settings 的 per-project channel 欄位（`stable`/`next`）。
  - 指標取得失敗 → last-known-good release → 再失敗靜默退場（S24）。
- **S38** Settings 供應：SDK 只從 Worker 端點取得 **flattened Effective
  Settings**（含 settingsVersion/revision/generatedAt），永不接觸 raw git
  URL 或檔案結構。Worker 套用新 Settings 前先驗證，無效沿用
  last-known-good。降級語意：最後已知 Settings 快取（localStorage）優先，
  無快取降級為 none 整合——平台故障日，所有站照常運作。

### 版本維度用語（Spec 全文與實作必須區分）

Contract schema version ≠ Contract content hash/revision ≠ SDK release ≠
Platform protocol version ≠ capability version ≠ Settings schema/revision。

---

## 第三部分：演進層（additive-only）

- Contract 所有 optional 欄位（entries、objects、capabilities、
  requirements、health、compatibility…）。
- 新 capability、新 service、新 CSS 等級、新錯誤碼、新 Settings 欄位。
- GitHub Action token 自動核准通道（加入時不改 S14 語意）。
- 欄位停用：`deprecated` 標記＋SDK warning，不擋不刪。

## 第四部分：保留層（形狀已定、內容留白）

- **Service 名單（裁決 D3）**：search、pin、relationship、notification、
  analytics、ai、calendar、file、profile、sharedCache、health 為
  **reserved roadmap，非 frozen API**——名字隨第一個真實方法一起正式發布；
  發布前可改名。凍結的是 S30 的文法與機制。
- **CSS reserved**：`components`／`full`／`self`。components/full 標
  「除非出現具體且反覆的需求，否則不做」；self 語意上是 none 的別名。
- **各能力的 API 簽名**：等第一個真實 caller 出現才發布 `xxx@1`。
- **Objects 內容 schema**：信封已凍（S2–S5），Photo/Trip 等具體欄位
  等第一個實例。
- **Actor Context**：協定保留欄位位置（requests 附 actor 資訊的形狀），
  v1 恆為 anonymous（S6）。
- **Integration Settings 後端**：v1 為 git 檔案＋Worker 供應（S38）；
  未來換 DB 是平台內部實作細節，遷移日需補 audit log 替代方案。
- **Auth provider**：平台簽發自己的 session；第一個 provider 是 Google
  OAuth；provider 可替換（同 AI Gateway 哲學）。

## 第五部分：v1 實作範圍

**做**：Contract JSON Schema＋範本；官方 snippet（S21）；loader＋版本指標
（S37）；SDK Kernel（lifecycle/ready/錯誤模型/診斷面）；contract discovery
＋validation＋推送；Worker 端 observed/approved 兩態＋手動核准後台＋
S15 防線；flattened Effective Settings 端點；tokens CSS（收編
theme-runtime，S36 改名）；smoke app（固定情境清單）；Google OAuth
主站登入（順帶補上 `saveThemeCssRules` 的驗證缺口）。

**不做**：任何 service 的真實方法；components/full CSS；跨源身份；
Objects 內容 schema；Settings DB 化；GitHub Action 通道。

---

## 附錄：與五份 Review 的對照

彙整、票數與出處見 `platform-integration-review-consolidation.md`；
裁決 D1–D4 見該文件第參部分。本規格條文與其一一對應，此處不重複。
