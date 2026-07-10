# Contract JSON Schema — RC3（兩輪外部 review 修正，schema 定案，準備進 Worker）

地位：實作計畫（`platform-integration-v1-implementation-plan.md`）第 1 項的產出。
**不是規格本身**——權威規格是 `platform-integration-spec-v1.md`（Frozen, S1-S39），
本資料夾與規格衝突時以規格為準，發現衝突要回報並修正這裡，不能改規格。

本資料夾目前是**草稿**，還沒有任何真實外部專案在用；欄位形狀在使用者確認前都可以改。
一旦第一個真實合約進了 Worker（implementation plan 第 2 項）並被 approve，S11「已發布
欄位永不改語意與型別」就開始對這份 schema 生效。

## 檔案

- `jonaminz.contract.schema.json` — JSON Schema（draft 2020-12）。
- `jonaminz.contract.example.json` — 範本，欄位命名沿用既有 `docs/external-project-manifest.md`
  的 v0 `jonaminz-app.json` 習慣（title/description/href→url），方便未來遷移時比對。

驗證方式：`npx ajv-cli validate --spec=draft2020 -s jonaminz.contract.schema.json -d <file>`。
目前跑過的案例（皆符合預期）：

| 案例 | 預期結果 |
|---|---|
| `jonaminz.contract.example.json` | valid |
| 缺 `contractVersion`/`app` | invalid |
| `projectId` 大寫或含非法字元 | invalid |
| 頂層或 `app`/`entries[]`/`objects[]`/`capabilities`/`requires[]` 出現 `enabled` 等 S9 禁用欄位 | invalid |
| `capabilities.requires[]` 缺 `entryId` | invalid |
| capability 字串用 camelCase（如 `sharedCache.get@1`） | invalid |
| capability 字串用 kebab-case（如 `shared-cache.get@1`） | valid |
| icon/url 是 protocol-relative（`//evil.example.com/a`） | invalid |
| icon/url 是不帶開頭斜線的相對路徑（`assets/icon.png`） | invalid（刻意的，見下方 URL 條目） |
| icon/url 含反斜線（`/\evil.example/a`、`/foo\bar`、`https:/\evil.example/a`、`https://evil.example\path`） | invalid |
| `capabilities.requires[]` 出現完全相同的 `{capability, entryId}` 兩次 | invalid |
| `css` 是尚未發布的保留值（如 `"components"`） | **valid**（結構合法，語意上是否認得由 Worker 判斷，不讓整份合約失敗） |

## 這份 schema 做什麼、不做什麼

**只做結構驗證**（型別、必填、regex）。以下規格條文**不是**這份檔案能表達的，
留給 implementation plan 第 2 項的 Worker ingestion validator：

- S12 fail-soft：單一 entry/object 壞掉時剔除該項、其餘照收——JSON Schema 對整份
  文件只能給 valid/invalid 兩種結果，做不到「部分接受」。
- S15 同源限制：URL 是否與該 projectId 登記的網域同源，需要跑時查 Integration
  Settings 才知道，schema 只能驗證「是 https: 或 path-absolute 相對路徑」這個語法層。
- S15 的 rate limit / payload size 上限（本檔用 `maxItems`/`maxLength` 做了保守的
  結構層上限，但正式的量測與擋線在 Worker）。
- `capabilities.requires[].entryId` 是否真的對應到某個 `entries[].entryId`——
  跨欄位一致性檢查，schema 單獨驗證每個欄位時看不到「另一個陣列裡有沒有這個 ID」。
- **`requests`/`requires[].capability` 出現的能力是否也在 `supports` 裡宣告**——
  語意上這是合理的不變式（自己沒宣告支援的能力，邏輯上不該去 request/require 它），
  範例已照此不變式修正，但「陣列 A 的每個元素都要出現在陣列 B 裡」不是 portable
  JSON Schema 能表達的關係（需要 ajv 的 `$data` 擴充，非標準、換驗證器就失效），
  所以留給 Worker 端檢查，schema 只在 description 裡記下這條期望。

## 逐欄位對應規格

| 欄位 | 規格條文 | 備註 |
|---|---|---|
| `contractVersion` | S8, S12 | `const: 1`；S12 明定 contractVersion 錯誤＝整份無效，所以這是唯一合理用「整份判失敗」的欄位 |
| `app.projectId` | S1 | `^[a-z][a-z0-9-]{1,62}$` |
| `app.title` | S8 | 必填，可自由改 |
| `app.description` / `app.icon` | S9 | 自我描述類允許 |
| `entries[].entryId` | S3 | 與 projectId 同文法，命名空間內永久穩定 |
| `entries[].url`, `app.icon`, `entries[].icon` | S15 | 見下方「URL 驗證」 |
| `objects[].objectType` | S3, S5 | 宣告存在≠可讀取，實際讀寫由未來 capability 定義 |
| `capabilities.supports/requests/requires` | S10 | 三分語意；requires 永不阻止宿主頁面運作、永不自動 grant |
| capability 字串文法 | S30 | `<service>.<capability>@<major>`，kebab-case（見下） |
| `deprecated` 標記 | S11 | 停用用標記，永不刪除整個定義 |
| `shell` | 敘事骨架 | `false`＝只建 API 不做 UI |
| `css` | S34, 第五部分, S11 | 見下方「css 欄位」 |
| 頂層與各已知巢狀物件的 `not` 清單 | S9, S16 | enabled/visibility/placement/order/weight/position/permissions/grantedCapabilities/secret/apiKey/token；套用範圍見下 |

### URL 驗證（`$defs/contractUrl`）

只接受兩種形式：`https://...` 或單一 `/` 開頭（path-absolute）。**明確排除**：

- **protocol-relative**（`//host/path`）——瀏覽器會把這解析成 `https://host/path`，
  等於偷渡任意網域，字面上「像」相對路徑但其實不是。第一版 regex 有這個洞
  （`^(https://|/)\S*$` 對 `//` 開頭的字串一樣會比對成功），已修正為排除。
- **反斜線（第二輪修正）**——WHATWG URL parser 對 http/https 等 special scheme
  會把 `\` 正規化成 `/`：`new URL("/\\evil.example/a", "https://trusted.example")`
  實際解析結果是 `https://evil.example/a`（已用 Node 的 `URL()` 實測驗證，見下方
  regex），等於 protocol-relative 繞過的變形，第一輪修正（只擋 `//`）沒堵住這個洞。
  現在的 regex `^(https://[^\s\\]+|/(?![/\\])[^\s\\]*)$` 對整個字串一律禁止出現
  反斜線，不管出現在哪個位置（`https:/\evil.com/a`、`https://evil.com\path` 這些
  變體都一併擋下）。
- **不帶開頭斜線的相對路徑**（如 `assets/icon.png`）——RFC 3986 定義上這也算合法的
  相對 URL，S15 字面上沒禁止，但刻意選擇比 S15 更保守：bare 相對路徑與
  `scheme:opaque` 形式的 URL（`javascript:...`、`data:...`）在字串層難以可靠區分，
  是已知的 URL 驗證陷阱。既然 S15 沒有明文要求開放到這個程度，選擇不開放。

同源檢查（S15 的核心防線）需要跑時查 Integration Settings 才知道，不在這份 schema
的能力範圍內，是 Worker 的職責。**這裡的教訓是：regex 對 URL 只能做語法層粗篩，
真正的安全邊界一定要用標準 URL parser 在 Worker 端重算一次**——已把完整檢查清單
記進 `platform-integration-v1-implementation-plan.md` 第 2 項，開工前照著做。

### `css` 欄位

**不是 enum**。第一版用 `"enum": ["none", "tokens"]`，但這違反 S11「未知 enum 值視為
不支援，不得整份判失敗」——用 enum 會讓未來出現 `components` 時整份合約直接
`invalid`，而不是「這個值不認得，當作不支援」。已改成語法層的寬鬆 pattern
（`^[a-z][a-z-]{0,49}$`），v1 Worker 只認得 `none`/`tokens`，其餘值一律視為
未宣告/不支援，不影響合約其餘部分生效。

### capability 字串文法（`$defs/capabilityId`）

`<service>.<capability>@<major>`，**限 kebab-case**（`shared-cache.get@1`），不允許
camelCase。第一版允許 camelCase 是因為 S30 附錄的保留服務名單裡有 `sharedCache`
這種寫法，但該清單本身明文是「reserved roadmap，非 frozen API，發布前可改名」，
所以統一成 kebab-case 不違反規格，而且是這份 schema 定案前最後一次免費改名機會——
一旦有真實合約用了某個 capability 字串並被 approve，S11 就鎖住了。

### 禁用欄位 `not` 守衛（`$defs/forbiddenFieldsGuard`）

第一版只套在頂層和 `entry` 上，`app`／`objects[]` 項目／`capabilities`／
`capabilities.requires[]` 項目沒有守衛，因為這幾個物件都是 `additionalProperties: true`
且沒有自己的 `not`，所以像 `app.permissions` 或 `objects[].enabled` 這種寫法會靜默
通過 schema 驗證（S16 保證它們沒有授權效力，但 schema 沒有幫忙擋下明顯寫錯的情況）。
已抽成共用的 `$defs/forbiddenFieldsGuard`，套到所有目前已定義的物件結構上。
**注意範圍**：這只涵蓋 v1 schema 目前定義的物件；規格第三部分（演進層）之後若新增
新的巢狀物件結構（例如 `health`、`compatibility`），加入 schema 時要記得一併掛上
這個 guard，schema 本身不會自動遞迴到未定義的結構裡去查。

## 我做的、規格沒明文釘死的設計決策

規格 S1-S39 定的是**規則**（文法、語意、生命週期），不是 JSON 的具體長相。
以下是把規則落成 JSON 形狀時做的選擇；標「已確認」的是使用者 2026-07-10
明確裁決過的。第 1、2 點在草稿階段裁決，第 3、4 點在兩輪 review 後裁決；
第 5 點（`$id`）留一個待辦（正式發布時機），其餘視為定案。

1. **已確認（2026-07-10）：`capabilities.requires` 是扁平陣列，`entryId` 必填**
   （不可省略、不掛在每個 entry 底下）。理由：省略 entryId 會產生「代表整個
   App、還是忘記填」的模糊狀態；v1 不需要合約層級（不屬於任何 entry）的
   requires，真的需要時再新增明確的 scope 欄位，不預先做。
2. **已確認（2026-07-10）：`not` 反面表列維持「整份/整個物件判 invalid」**（而不是
   改成「偵測到就靜默忽略該欄位」）。即使 S16 已保證這些欄位出現也沒有授權效力，
   仍選擇在 schema 層直接拒絕，及早讓合約作者發現寫錯，而非讓錯誤悄悄過關。
   （這一輪修正把套用範圍從頂層＋entry 擴大到所有已知巢狀物件，是同一個裁決的
   延伸落實，不是新決策。）
3. **已確認（2026-07-10）：`entries`/`objects` 是陣列，每項是物件**（不是用
   entryId/objectType 當 key 的 map）。理由：陣列比較容易讓 S12 的「剔除該項、
   其餘照收」在 Worker 端逐項處理；也保留原始提交順序供 audit；避免 JSON map
   在不同 parser 下對重複 key 可能 first-wins/last-wins 不一致的問題，比重複
   `entryId` 更難稽核。Worker ingestion 要落實：`entryId`/`objectType` 重複
   → 該區段無效（依 S12），不能只靠 schema 的 `uniqueItems`（只查得出完全相同
   的物件，查不出「entryId 相同但其他欄位不同」）。
4. **已確認（2026-07-10）：`css` 是單一字串欄位，且永久語意是「CSS integration
   profile identifier」，不是設定容器、不是 grant**。依據是 ARCHITECTURE.md 現有
   用語「合約宣告 `css: "tokens"`」。未來即使需要更多設定，也不把 `css` 從
   string 改成 object（那會踩 S11「已發布欄位永不改型別」），而是新增平行欄位，
   例如 `css: "components"` 搭配獨立的 `cssOptions: { density: "compact" }`。
5. **`$id` 用了 `https://jonaminz.com/schema/jonaminz.contract.schema.v1.json`**——
   目前這個網址還沒真的架設任何東西，純粹是 JSON Schema 慣例的自我識別字串
   （placeholder，不是承諾現在能 fetch 到）。裁決：可以保留這個 `$id`，但**在
   第一份真實合約 approve 前，必須把這一版 schema 原樣發布到這個網址**（immutable，
   之後不能偷換成 v1.1/v2 內容），已列進下方「進 Worker 前的 release checklist」。
   未來版本一律換新 `$id`。

## 進 Worker 前的 release checklist

這幾項不是 implementation plan 第 2 項（Worker 端合約收取）本身要做的事，是在
「第一份真實合約被 approve」之前要完成的收尾，記在這裡避免漏掉：

- [ ] 把 `jonaminz.contract.schema.json` 原樣發布到其 `$id` 網址
      （`https://jonaminz.com/schema/jonaminz.contract.schema.v1.json`），
      發布後視為 immutable，之後改版一律換新 `$id`。

## 下一步

- 上面第 3、4 點已定案；第 5 點的 `$id` 待正式發布時處理（見 checklist）。
- 進 implementation plan 第 2 項（Worker 端合約收取：immutable snapshot 三態、
  audit table、S15 全部防線——完整檢查清單已寫進
  `platform-integration-v1-implementation-plan.md` 第 2 項——、`requests`/`requires`
  ⊆ `supports` 的 cross-field 檢查、`entryId` 參照一致性檢查）。
