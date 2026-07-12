> Status: Historical / Superseded
> 此文件描述早期設計（Platform Integration 規格定稿前的架構審查），不代表目前實作。
> 正式規格已於 2026-07-10 凍結為 `docs/platform-integration-spec-v1.md`
> （S1-S39，唯一權威，與本文矛盾時以該文為準）。
> 目前狀態請參考：`AI_CONTEXT/CURRENT_STATE.md` 與 `docs/platform-integration-spec-v1.md`。

# Jonaminz Platform Integration Spec v1 — 架構審查

審查對象：使用者提供的《Jonaminz Platform Integration Specification v1》（Contract /
Integration Settings / SDK / Platform API 架構）。

審查方法：不是憑空評論，而是拿這份新規格對照 **現有已經上線的 v0 實作**
（`registry.json` + `jonaminz-app.json` + `theme-runtime.js` + Cloudflare Worker，
見 [`README.md`](../README.md)、[`docs/external-project-manifest.md`](external-project-manifest.md)、
[`backend/README.md`](../backend/README.md)），因為 jonaminz 不是從零開始，這份新規格
事實上是要**取代或擴充**一個已經在跑的系統。

---

## 一、結論先講

哲學面（Contract 只自我宣告、Integration Settings 由平台擁有、enablement 永遠不在
Contract 裡決定）**完全正確，而且現有 v0 系統已經在遵守這個哲學**——`jonaminz-app.json`
只提供 title/description/href/version，`enabled/position/group/order` 全部在
`registry.json`。這不是新想法，是既有做法的正式化，方向對。

但這份規格書當「平台」在設計——好像未來會有很多第三方開發者各自串接 Jonaminz。
實際情況是：Jonaminz 是 Jonathan 與 Minz 兩人的數位家（依專案願景記憶，規劃中模組
約 10-15 個，全部自己開發），不是對外開放註冊的 marketplace。
規格書裡的 Capability 版本協商、Platform API 的 11 個服務、完整 Auth 策略，
是為「陌生第三方開發者」設計的治理機制。目前**沒有陌生第三方**，只有自己人。

**建議：保留這份規格的骨架與哲學作為長期藍圖，但第一版落地要大幅右sizing（right-size），
和現有 v0 融合成同一個系統的 v2，而不是蓋一個平行的新系統。** 細節見下方各節與
第五節「建議定案方向」。

---

## 二、與現有 v0 系統的直接衝突點

這些是**必須先解決**，否則兩套系統會並存造成混亂：

1. **檔名衝突（已定案：改名，不留過渡期）**：規格書要求 `jonaminz.contract.json`，
   現有系統是 `jonaminz-app.json`。兩者語意完全重疊（都是「外部專案自我宣告」）。
   一般情況下改名代表要處理雙檔名並存的過渡期，但目前 `registry.json` 的
   `externalProjects` 是空陣列（見 [`registry.json`](../registry.json)）——**沒有任何
   外部專案正式在用 `jonaminz-app.json`**，所以可以直接乾淨改名成
   `jonaminz.contract.json`，不需要過渡期、不需要雙檔名相容邏輯。`schemaVersion`
   從新檔名的第一版開始算即可。

2. **Integration Settings 的擁有權模型**：規格書說 Integration Settings 是「Owned by
   Jonaminz」「database model」，暗示要動態、可透過後台改。但現有 `registry.json`
   是**存在 git repo 裡、靠 commit 變更**的靜態檔案——這其實是一種很務實的治理機制：
   每次「誰能上架」都要經過使用者本人 commit，天然就是唯一有權限的人。改成 DB-backed
   動態設定，代表要有一個「誰能改 Integration Settings」的權限系統，而現在**完全沒有
   Auth**（見下方 Auth 小節）。在 Auth 落地前，把 Integration Settings 搬進 DB
   只是把「git commit 守門」換成「沒有守門」，是倒退不是進步。

3. **`window.Jonaminz.*` Platform API 目前完全不存在**：現有系統裡外部專案能拿到的
   平台能力只有兩個：`theme-runtime.js`（CSS 變數）和一支背景 fetch
   （`registerExternalApp`，見 [`external-project-manifest.md`](external-project-manifest.md)
   第57-78行）。規格書列的 `search()` / `profile.getCurrentUser()` /
   `notification.send()` 全部是未來式，Worker 端（`worker.js`）目前只有四個 action，
   沒有 search、沒有 profile、沒有 notification。這些屬於規格書自己說的「Future
   services should be additive」，不該卡在 v1 定案範圍內。

---

## 三、逐節審查

### Contract 結構

- 分層（app/identity/environments/entries/capabilities/requirements/objects/events/
  data/health/compatibility/implementation）本身合理，但**沒有任何一個是「必填」**，
  規格書也沒定義最小合法 Contract 長怎樣。沒有最小合法集合，SDK 的「validate Contract」
  這一步就無法寫——validate 什麼？建議明確定義：`contractVersion` + `app.projectId` +
  `app.title` + 至少一個 `environments` 是唯一必填集合，其餘全部可省略。這也剛好對齊
  現有 `jonaminz-app.json` 的最小欄位。

- `environments` 這個新概念（entries 的 URL 由 `environment.baseUrl + entry.path`
  組成）現有系統沒有——現有是 `jonaminz-app.json.href` 直接給完整 URL。多環境
  （prod/staging/dev）在**一人開發、直接部署到 GitHub Pages** 的實際工作模式下
  （見 [skhpsv2 CNAME/env 切換陷阱記憶]）用不太到，但如果真的要支援多環境，要小心
  跟你在 SKHPS 那邊已經踩過的 CNAME/env 切換陷阱是同一類問題——`environments` 欄位
  一旦允許同一份 Contract 描述多個 baseUrl，就要規定 SDK 怎麼判斷「現在是哪個
  environment」（用 `location.hostname` 比對？用查詢參數？）規格書完全沒提，這是
  一個會複製 SKHPS 那個坑的隱藏耦合。

### Entries

- 定義清楚（optional、非資料庫、entryId 穩定但 path 可變），這點寫得好，也符合現有
  `config.json` 的 `pages` 精神（pageId 穩定，path 可搬）。
- 缺一條規則：**entryId 命名空間**。目前沒說 entryId 是專案內唯一還是全平台唯一。
  如果 Global Search／Slot Engine 未來要跨專案聚合 entries（例如首頁要列出所有專案的
  「dashboard」entry），entryId 只在專案內唯一是不夠的，聚合時要用
  `projectId + entryId` 複合鍵——建議現在就把這條規則寫進規格，晚加會是 breaking change。

### Objects

- 這節是全份規格裡**最空的一節**：只說「optional」「not database tables」「only
  intentionally exposed objects」，沒有 schema、沒有範例、沒有用途說明。以現有系統
  類比，這大概對應「Global Search 要索引的資料」（見
  `project_jonaminz_vision.md` 的 Global Search 段落：Photos/Trips/Bookmarks/…）。
  建議 Objects 至少要定義：`objectType`、`objectId` 從哪來、能不能被 Search 索引、
  能不能被其他 App 讀（跨 App 資料存取的權限模型完全沒提，但這其實是所有平台裡
  最容易出資安問題的地方——「App A 可以讀 App B 的 objects 嗎？」）。**這節在正式定案前
  必須至少寫出一個 concrete 範例，否則 SDK 端沒辦法實作。**

### Capabilities（supports / requires）

- 概念正確，但少了兩件事：
  1. **版本**：`supports: ["search"]` 沒有版本號，如果 Search API 未來要 breaking
     change（例如回傳格式改變），舊 App 全部會壞。至少要 `supports: ["search@1"]`
     或物件形式 `{ "capability": "search", "version": 1 }`。
  2. **requires 的失敗行為未定義**：一個 App `requires: ["notification"]`，但
     Integration Settings 沒授權 notification，SDK 該怎麼辦？擋掉整個 App 載入？
     還是讓 `window.Jonaminz.notification` 變成一個丟錯的 stub？兩種行為對外部專案
     的影響差非常多，規格書完全沒講，這是 SDK Lifecycle 第 6-8 步會卡住的地方。

### Requirements / Core / Shell / Auth

- Core/Shell 的 request-vs-grant 模型（專案要求什麼，平台決定給不給）是對的，直接
  對應現有的「Reservoir 擁有 UI，App 只擁有資料」哲學（見
  `project_jonaminz_vision.md`）。

- **CSS 五段模式（none/tokens/components/full/self）是這份規格裡最好、最可落地的部分**，
  因為現有 `theme-runtime.js` 其實已經是 `tokens` 模式的具體實作（`:root` 規則輸出成
  CSS 變數，見 `external-project-manifest.md` 第98-104行）。建議定案時明確寫：
  **v1 只實作 `none` 和 `tokens` 兩種模式**（tokens = 現有 theme-runtime.js 原封不動搬過來），
  `components`/`full`/`self` 留到有第二、第三個真正需要共用元件樣式的專案出現時再做——
  現在只有一個 App（jonaminz 自己），沒有實例可以驗證 `components` 模式該長怎樣。

- **Auth 是整份規格最大的坑**。規格只說 Contract 宣告 `none/jonaminz/self/external`
  四選一，「Contract never grants authentication」，但**完全沒有 Auth 策略本身**——
  誰簽發 token？SDK 怎麼驗證使用者是 Jonathan 還是 Minz？`profile.getCurrentUser()`
  這種 Platform API 沒有 Auth 是無法實作的空話。而且現況更嚴重：現有 Worker 的
  `saveThemeCssRules` **目前沒有任何身分驗證**（`backend/README.md` 第55-56行、
  `worker.js` 開頭註解都自己承認這是已知暫時限制），CORS 也是 `Access-Control-Allow-Origin: *`
  （`worker.js` 第17行）。在 Auth 策略沒定案前，規格書所有「granted capabilities」
  「permissions」「governance」都是空中樓閣——**Auth 應該是 v1 定案裡優先權最高、
  必須先想清楚的一節**，而不是規格書裡輕描淡寫的一小段。

### 安全性清單

- 「Contract 不該含 secret/token」這條對，但漏了一個更現實的風險：**SDK 從外部 URL
  抓 Contract 是 SSRF 攻擊面**。規格沒說 SDK 抓 Contract 時要不要限制網域
  （例如只能是 registry 裡登記過的 `manifestUrl`）。現有系統其實已經有一個天然防線：
  `registry.json` 是白名單（只有 git commit 進去的 `manifestUrl` 才會被 fetch），
  新 SDK 設計時**不能失去這個白名單機制**，否則變成任意網址都能自稱 Jonaminz 專案。

### Compatibility / 版本策略

- 「prefer additive evolution」「avoid removing existing fields」都對，但沒有
  **deprecation 流程**：一個欄位要停用時，除了「不要移除」還要能標記「這欄位已棄用，
  新專案不要用」，否則規格會只增不減、越滾越大。建議加一個 `deprecatedFields` 或
  在 schema 裡用 `"deprecated": true` 標記，SDK 驗證時對 deprecated 欄位印 warning
  但不擋。

---

## 四、Review Requirement 逐項回答

規格書自己要求檢查以下幾類問題，逐項回答：

| 項目 | 發現 |
|---|---|
| Hidden coupling | SDK 的白名單/CORS 依賴 `registry.json` 這個既有機制，規格沒明講但事實上耦合著；Auth 沒定案，Integration Settings 動態化＝耦合到一個還不存在的權限系統 |
| Future scalability risks | Capability 沒有版本號，未來 breaking change 會波及所有已接入的 App；Objects 沒有跨 App 存取權限模型，是最大的隱藏擴充風險 |
| Governance problems | Integration Settings 從「git commit 守門」變成「DB 可改」時，沒有配套的權限系統，等於治理倒退 |
| Versioning issues | 有 contractVersion 但沒有 deprecation 機制、沒有 capability 版本 |
| Schema weaknesses | Objects 節完全沒有 schema；entries 缺跨專案 entryId 命名空間規則 |
| SDK lifecycle problems | 第 6/7/8 步（determine granted Core/Shell/Services）在 requires 未授權時的失敗行為未定義；沒有「Contract 抓取失敗／逾時」的降級行為（現有 v0 已經有這個機制，見下方） |
| API design issues | `window.Jonaminz.search()` 這類全域 API 沒講命名空間衝突處理（如果外部專案自己也有全域變數 `Jonaminz`？）、沒講非同步/錯誤介面統一格式 |
| Security concerns | SSRF（任意網址讀 Contract）、Objects 跨 App 讀取權限、Auth 缺失導致的所有 downstream 問題 |
| Missing concepts | **降級/離線行為**：現有系統已經證明「單一外部專案 manifest 抓取失敗只影響那張卡片，不擋首頁」（`external-project-manifest.md` 第53-54行）這個韌性原則，新規格完全沒提，必須明確寫進 SDK Lifecycle，否則新 SDK 可能做出「一個 App 掛掉拖垮全站」的退步設計 |

---

## 五、建議定案方向（right-size 後的 v1）

**原則：延續現有系統，不蓋平行系統。** Contract 改名為 `jonaminz.contract.json`
（見上方「已定案：改名」），`schemaVersion` 從 1 開始，欄位在現有
`jonaminz-app.json` 基礎上新增以下皆為 optional 的欄位：

```
schemaVersion: 1   （新檔名的第一版）
app / identity / environments      — 新增，optional
entries                             — 新增，optional
capabilities.supports               — 新增，optional，帶版本號 "capability@n"
capabilities.requires               — 新增，optional，帶版本號
requirements.core                   — 新增，optional
requirements.shell.css              — 新增，optional，v1 只認 "none" | "tokens"
requirements.shell.auth             — 新增，optional，v1 只認 "none" | "jonaminz"
objects                             — 本次不定案，留待有第一個具體案例再設計
```

Integration Settings（`registry.json`）**v1 維持 git-commit 治理，不搬進 DB**。
理由：DB 化需要「誰能改 Integration Settings」的授權判斷，而 Google OAuth
（見下方 Auth）解決的是「這個使用者是誰」，不等於「這個使用者能不能改平台設定」——
授權判斷（role/allowlist）是另一塊要另外設計的邏輯，不在本次審查範圍內，等
Google OAuth 真的落地、且有實際「後台要給誰用」的場景時再一起做，避免現在就蓋一個
沒有實際使用者在用的權限系統。

**Auth（已定案方向：Google OAuth）**：v1 只做「登入 = 知道是 Jonathan 還是 Minz」，
用來支援未來的 `profile.getCurrentUser()` 這類需要身分的 Platform API，以及讓
`saveThemeCssRules`（目前完全無驗證，見 `backend/README.md`）之後能檢查
「有登入才能存檔」。落地順序建議：
1. Cloudflare Worker 加一個 Google OAuth 的 callback/token 驗證端點
2. 後台頁（`pages/admin/`）先套上「未登入導去 Google 登入」
3. 驗證跑順了，再讓 `saveThemeCssRules` 要求帶有效 session 才能寫
4. Integration Settings 動態化（DB model + 後台可編輯）是這之後的事，不在 v1

SDK（`jonaminz-entry.js`，取代現在分散在各專案自己加的 `theme-runtime.js` +
`registerExternalApp` fetch）v1 只做：

1. 讀取 `jonaminz.contract.json`
2. 驗證最小必填欄位（`contractVersion` + `app.projectId` + `app.title` + 至少一個
   `environments`）
3. 背景回報 `registerExternalApp`（沿用現有 Worker action，不變）
4. 若 `requirements.shell.css === "tokens"`，內嵌現有 `theme-runtime.js` 邏輯
5. 任何一步失敗都不擋頁面（沿用現有降級原則）

`window.Jonaminz.*` Platform API、Objects、components/full CSS 模式、完整
Capability 協商、DB 化 Integration Settings——**全部留到 Auth 真正落地、且有
第二個真正的外部專案要接入時**，對齊 Jonaminz 願景記憶裡的 Roadmap（Phase 1 是
Reservoir/Slot Engine/App Registry/Search/Navigation，Platform API 這種進階整合
本來就該是 Phase 4 才做的東西）。

---

## 六、定案結果

| 問題 | 決定 |
|---|---|
| Contract 檔名 | 改名為 `jonaminz.contract.json`，不留過渡期（目前沒有正式外部專案在用舊檔名） |
| Auth 方向 | 串 Google OAuth，v1 只做身分識別，不含 Integration Settings 授權判斷 |
| Objects 節 | 本次不定案，留白，等第一個具體案例再設計 schema |

下一步（下次任務）：寫 JSON Schema、`jonaminz.contract.json` 範本、SDK 骨架
（僅 v1 範圍：Contract loader + 白名單抓取 + tokens CSS + 背景回報），
以及 Google OAuth 的 Worker 端驗證流程設計。Objects、Platform API、Capability
協商、Integration Settings DB 化本次不動工。
