# Contract JSON Schema — 草稿（RC，2 點設計決策已由使用者確認）

地位：實作計畫（`platform-integration-v1-implementation-plan.md`）第 1 項的產出。
**不是規格本身**——權威規格是 `platform-integration-spec-v1.md`（Frozen, S1-S39），
本資料夾與規格衝突時以規格為準，發現衝突要回報並修正這裡，不能改規格。

本資料夾目前是**草稿**，還沒有任何真實外部專案在用；欄位形狀在使用者確認前都可以改。
一旦第一個真實合約進了 Worker（implementation plan 第 2 項）並被 approve，S11「已發布
欄位永不改語意與型別」就開始對這份 schema 生效。

## 檔案

- `jonaminz.contract.schema.json` — JSON Schema（draft 2020-12），已用 `ajv-cli`
  （`npx ajv-cli validate --spec=draft2020`）跑過正反例：範例檔通過；缺 `enabled`
  等禁用欄位、非法 `projectId`、非法 capability 文法的反例會被擋下。
- `jonaminz.contract.example.json` — 範本，欄位命名沿用既有 `docs/external-project-manifest.md`
  的 v0 `jonaminz-app.json` 習慣（title/description/href→url），方便未來遷移時比對。

## 這份 schema 做什麼、不做什麼

**只做結構驗證**（型別、必填、regex、enum）。以下規格條文**不是**這份檔案能表達的，
留給 implementation plan 第 2 項的 Worker ingestion validator：

- S12 fail-soft：單一 entry/object 壞掉時剔除該項、其餘照收——JSON Schema 對整份
  文件只能給 valid/invalid 兩種結果，做不到「部分接受」。
- S15 同源限制：URL 是否與該 projectId 登記的網域同源，需要跑時查 Integration
  Settings 才知道，schema 只能驗證「是 https: 或相對路徑」這個語法層。
- S15 的 rate limit / payload size 上限（本檔用 `maxItems`/`maxLength` 做了保守的
  結構層上限，但正式的量測與擋線在 Worker）。
- `capabilities.requires[].entryId` 是否真的對應到某個 `entries[].entryId`——
  跨欄位一致性檢查，schema 單獨驗證每個欄位時看不到「另一個陣列裡有沒有這個 ID」。

## 逐欄位對應規格

| 欄位 | 規格條文 | 備註 |
|---|---|---|
| `contractVersion` | S8 | `const: 1`，v1 固定 |
| `app.projectId` | S1 | `^[a-z][a-z0-9-]{1,62}$` |
| `app.title` | S8 | 必填，可自由改 |
| `app.description` / `app.icon` | S9 | 自我描述類允許 |
| `entries[].entryId` | S3 | 與 projectId 同文法，命名空間內永久穩定 |
| `entries[].url`, `app.icon`, `entries[].icon` | S15 | https: 或相對路徑 |
| `objects[].objectType` | S3, S5 | 宣告存在≠可讀取，實際讀寫由未來 capability 定義 |
| `capabilities.supports/requests/requires` | S10 | 三分語意；requires 永不阻止宿主頁面運作、永不自動 grant |
| capability 字串文法 | S30 | `<service>.<capability>@<major>` |
| `deprecated` 標記 | S11 | 停用用標記，永不刪除整個定義 |
| `shell` | 敘事骨架 | `false`＝只建 API 不做 UI |
| `css` | S34, 第五部分 | v1 只開放 `none`/`tokens`；`components`/`full`/`self` 是保留層，v1 合約不得宣告 |
| 頂層與 entry 層的 `not` 清單 | S9, S16 | enabled/visibility/placement/order/weight/position/permissions/grantedCapabilities/secret/apiKey/token |

## 我做的、規格沒明文釘死的設計決策

規格 S1-S39 定的是**規則**（文法、語意、生命週期），不是 JSON 的具體長相。
以下是把規則落成 JSON 形狀時做的選擇；標「已確認」的兩點是使用者 2026-07-10
明確裁決過的，其餘是還沒被挑戰、但風險較低的預設判斷。

1. **已確認（2026-07-10）：`capabilities.requires` 是扁平陣列，`entryId` 必填**
   （不可省略、不掛在每個 entry 底下）。理由：省略 entryId 會產生「代表整個
   App、還是忘記填」的模糊狀態；v1 不需要合約層級（不屬於任何 entry）的
   requires，真的需要時再新增明確的 scope 欄位，不預先做。能力宣告集中放在
   `capabilities` 底下，不分散進每個 entry。
2. **已確認（2026-07-10）：頂層與 entry 層的 `not` 反面表列維持現狀**（出現
   `enabled`/`permissions`/`token` 等 S9 禁用欄位＝整份合約 invalid，不是
   只忽略該欄位）。即使 S16 已保證這些欄位出現也沒有授權效力，仍選擇在
   schema 層直接拒絕整份合約，及早讓合約作者發現寫錯，而非讓錯誤悄悄過關。
3. **`entries`/`objects` 是陣列，每項是物件**（而不是用 entryId/objectType 當 key
   的 map）。理由：陣列比較容易讓 S12 的「剔除該項、其餘照收」在 Worker 端逐項處理；
   缺點是重複 ID 檢查（S12「重複 ID → 該區段無效」）要額外邏輯，schema 本身的
   `uniqueItems` 只能查完全相同的物件，查不出「entryId 重複但其他欄位不同」，這點
   沒有在 schema 層擋，留給 Worker ingestion。
4. **`css` 是單一字串欄位**（不是物件包一層）。依據是 ARCHITECTURE.md 現有用語
   「合約宣告 `css: "tokens"`」，沿用既有措辭。
5. **`$id` 用了 `https://jonaminz.com/schema/jonaminz.contract.schema.v1.json`**——
   目前這個網址還沒真的架設任何東西，純粹是 JSON Schema 慣例的自我識別字串
   （placeholder，不是承諾現在能 fetch 到）。等真的要公開發布 schema 時再決定
   實際掛在哪個路徑。
6. **capability 正則允許 camelCase**（`^[a-z][a-zA-Z0-9]*\.[a-z][a-zA-Z0-9]*@[1-9][0-9]*$`），
   因為保留服務名單裡有 `sharedCache` 這種 camelCase 名字（S30 附錄的保留層清單）。

## 下一步

- 第 3-6 點若要挑戰，改這兩個 JSON 檔＋本 README，重跑 `npx ajv-cli validate` 確認範例仍過。
- 進 implementation plan 第 2 項（Worker 端合約收取：immutable snapshot 三態、
  audit table、S15 全部防線）。
