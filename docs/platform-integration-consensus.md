> Status: Historical / Superseded
> 此文件描述早期設計（凍結前的共識版理解，F1-F12 編號），不代表目前實作。
> 正式規格已於 2026-07-10 凍結為 `docs/platform-integration-spec-v1.md`
> （S1-S39，唯一權威，與本文矛盾時以該文為準）。
> 目前狀態請參考：`AI_CONTEXT/CURRENT_STATE.md` 與 `docs/platform-integration-spec-v1.md`。

# Jonaminz Platform Integration — 共識版理解（給其他 Agent 交叉確認用）

日期：2026-07-10
狀態：討論已收斂，等交叉確認後據此寫定稿規格
前置文件：`docs/platform-integration-spec-review.md`（架構審查）、
`docs/external-project-manifest.md`（現有 v0 系統）

這份文件是目前使用者與 Agent 討論後的**完整共識**，自成一體，不需要對話上下文
就能讀懂。請確認：(1) 模型有沒有理解錯、(2) 凍結層條文有沒有漏、(3) 有沒有
十年尺度下會後悔的決定。

---

## 一、圖書館模型（整個架構的敘事骨架）

這是使用者提出的心智模型，定稿規格將直接以它為敘事骨架：

> 我們蓋了一個圖書館平台。外部寫一個專案，只要在 head 加一個 script 呼叫
> 圖書館平台，就會有**專員**來收 **contract**。contract 是外部寫好的，但只寫
> 「自己是什麼」，不寫「定位」——定位是圖書館賦予的。圖書館也有一些**工具**帶在
> 專員身上，當圖書館**同意**的時候，外部專案可以使用專員身上的工具。如果有一天
> **專員換人了**，原本的合約照樣可以用，雖然其實有升級版的合約，但外部專案
> 不一定要修改。

| 比喻 | 架構元件 |
|---|---|
| 圖書館 | Jonaminz 平台（Cloudflare Worker 後端 + Integration Settings） |
| head 加一個 script | `<script src="https://jonaminz.com/sdk/jonaminz-entry.js">`（外部專案唯一要做的事） |
| 專員 | SDK 本體，在外部專案的頁面裡執行 |
| 專員來收 contract | SDK 讀取同站根目錄的 `jonaminz.contract.json`，回報給平台後端（推模式，見凍結層 F6） |
| contract 只寫自己是什麼 | Contract 永不含 enabled / visibility / placement / permissions / granted capabilities |
| 定位是圖書館賦予的 | Integration Settings，平台單方擁有，外部專案無法自己決定 |
| 工具帶在專員身上 | Platform API（`window.Jonaminz.*`），外部專案永不直連平台後端 |
| 圖書館同意才能用工具 | granted capabilities 由 Integration Settings 決定，不在合約裡 |
| 專員順便掛上圖書館的窗簾 | Shell / Theme / CSS：合約宣告 `css: "tokens"`，平台同意後 SDK 套用（現有 `theme-runtime.js` 的邏輯收編進 SDK，不再是獨立 script） |
| 專員換人，舊合約照用 | SDK 是常青網址、平台單方升級；新 SDK 永遠看得懂所有歷史版本合約 |
| 有升級版合約但不強制改 | 新 contractVersion 是 opt-in；舊版 deprecated 只標記、永不失效 |

**與現有 v0 的關係**：現有系統（`registry.json` 拉模式 + `jonaminz-app.json` +
獨立的 `theme-runtime.js` + `registerExternalApp` fetch）在哲學上已經和這個模型
一致（合約只自我宣告、定位在平台）。新架構是把 v0 分散的三個機制**收編成一個專員
（SDK）**，並把拉模式改為推模式。`registry.json` 的 `externalProjects` 目前是
空陣列，沒有正式外部專案，因此可以乾淨切換、不留過渡期。

---

## 二、十年穩定策略：三層結構

十年不改架構的達成方式是「**規格現在定完整，實作分期**」。長壽系統穩定的是
介面形狀、命名、錯誤語意、版本規則——不是功能完整度。定稿規格的每一節都必須
標記屬於哪一層：

| 層 | 規則 |
|---|---|
| **凍結層** | 永不改。改了就不是同一個平台。 |
| **演進層** | 只能 additive；停用靠 deprecated 標記，永不刪除。 |
| **保留層** | 形狀已定、內容留白；未來填入內容不構成架構變更。 |

---

## 三、凍結層條文（定稿時逐條寫死）

- **F1 檔名與位置**：`jonaminz.contract.json`，放在外部專案網域根目錄。
- **F2 SDK 常青網址**：`https://jonaminz.com/sdk/jonaminz-entry.js`，URL 不帶
  版本號，所有外部專案永遠載入最新版 SDK（＝專員由圖書館單方面換人）。
- **F3 不燒房子原則**：SDK 任何內部錯誤（載入失敗、合約缺失、後端逾時、授權
  被拒）都不准影響宿主頁面——try/catch 到底，失敗就靜默降級。這是 F2 成立的
  前提：平台能瞬間幫所有人升級，就必須保證一次壞部署不會同時打掛所有外部專案。
  （現有 v0 的 registry-loader 與 theme-runtime 已遵守此原則，原樣入憲。）
- **F4 合約永不含**：enabled、visibility、placement、permissions、granted
  capabilities、secret、api key、token。
- **F5 最小必填集合**：`contractVersion` + `app.projectId` + `app.title` +
  至少一個 environment。此集合十年內只能縮小不能擴大（新增必填欄位＝breaking）。
- **F6 推模式＋認門牌**：SDK 在頁面載入時把合約「交給」平台（POST 至 Worker），
  平台存副本；jonaminz 首頁渲染讀平台自己的副本，不再去 fetch 外部網址
  （消除 SSRF 面、消除「外部網站掛了首頁卡片跟著壞」的依賴）。
  收合約是開放的（誰都能投），但**採信**要認門牌：後端比對請求 Origin 是否等於
  該 projectId 在 Integration Settings 登記的網域，不符則只記錄、不採信。
  上架與否永遠只看 Integration Settings。
- **F7 工具婉拒語意**：未授權的工具**存在但婉拒**——`window.Jonaminz.*` 的每個
  service 名稱永遠掛在物件上，未授權時呼叫回傳 rejected Promise、錯誤碼固定
  （如 `CAPABILITY_NOT_GRANTED`），永不 undefined、永不同步 throw。外部程式碼
  不需探測工具存在與否，授權開通後同一行程式碼自動生效。
- **F8 API 信封**：所有 Platform API 一律回 Promise；統一回傳信封
  （成功 `{ ok: true, data }`、失敗 `{ ok: false, code, message }` 或
  reject 帶固定錯誤碼——定稿時二選一寫死）。
- **F9 版本語意**：contractVersion 整數遞增；capability 帶版本
  （`"search@1"`）；deprecation 只標記不刪除；SDK 永遠支援所有歷史
  contractVersion（F2 的必然結果）。
- **F10 命名空間規則**：跨專案聚合一律用複合鍵——entries 用
  `projectId + entryId`，objects 用 `projectId + objectType + objectId`。
- **F11 Platform Service 名單即永久 ID**：search、pin、relationship、
  notification、analytics、ai、calendar、file、profile、sharedCache、health。
  名字現在凍結（即使實作是空的），未來只增不改名。
- **F12 environment 判定**：SDK 用 `location.hostname` 比對
  `environments[].baseUrl` 決定當前環境。

---

## 四、演進層（additive-only）

- Contract 的所有 optional 欄位（entries、capabilities、requirements、
  objects、events、data、health、compatibility、implementation）。
- 新增 capability、新增 Platform Service、新增 CSS 整合模式。
- 欄位停用：schema 標 `"deprecated": true`，SDK 驗證時印 warning 不擋。

---

## 五、保留層（形狀已定、內容留白）

- **Objects 內容 schema**：信封現在定（objects 為陣列，每項必有
  `objectType` + `objectId`，跨 App 讀取預設 deny），但 Photo/Trip 等具體
  內容 schema 留到第一個實例出現。已定案：本次不定案。
- **各 service 的 API 簽名**：名字凍結（F11）、信封凍結（F8），但參數與回傳
  格式（search 的 query 長怎樣、hit 長怎樣）等第一個真實 caller 出現才定
  `search@1`——憑空設計的簽名猜錯率高，而 capability 版本號（F9）讓「簽名
  定晚一點」是安全的。
- **Integration Settings 儲存後端**：SDK 只從一個固定平台端點取得 Integration
  Settings（settings 文件 schema 現在定死）；端點後面讀 git 裡的
  `registry.json` 還是 Supabase DB，是平台內部實作細節，SDK 與外部專案
  永遠看不到。v1 用 git-commit 守門，未來搬 DB 不構成架構變更。
- **Auth provider**：形狀是「平台簽發自己的 session/token，identity provider
  是可替換插件」（與 AI Gateway 同哲學：沒有程式碼直接依賴 Google）。已定案
  第一個 provider 是 Google OAuth；v1 範圍只做身分識別（分辨 Jonathan/Minz），
  Integration Settings 的授權判斷（誰能改平台設定）等 OAuth 落地後再設計。

---

## 六、已定案清單（使用者拍板）

| # | 決定 | 日期 |
|---|---|---|
| 1 | 合約檔名改為 `jonaminz.contract.json`，不留過渡期（無正式外部專案在用舊檔名） | 2026-07-10 |
| 2 | Auth 走 Google OAuth；v1 只做身分識別 | 2026-07-10 |
| 3 | Objects 內容 schema 本次留白（信封照第五節定形狀） | 2026-07-10 |
| 4 | Theme/CSS 收編進 SDK：合約宣告 `css: "tokens"`，平台同意後專員掛窗簾；`theme-runtime.js` 邏輯併入 `jonaminz-entry.js`，v1 只實作 `none`/`tokens` 兩種模式（`components`/`full`/`self` 名字保留、實作延後） | 2026-07-10 |
| 5 | 圖書館模型（含推模式、常青 SDK、工具婉拒）為定稿規格的敘事骨架 | 2026-07-10 |

---

## 七、v1 實作範圍（規格定完整、實作只做這些）

SDK（`jonaminz-entry.js`）v1：

1. 讀取同站 `jonaminz.contract.json`
2. 驗證最小必填集合（F5）
3. 推送合約給平台（F6，沿用/擴充現有 `registerExternalApp` action）
4. 取得 Integration Settings（保留層的固定端點）
5. `css: "tokens"` 且獲同意 → 套用 Theme（原 theme-runtime 邏輯）
6. 建立 `window.Jonaminz.*` 骨架：全部 service 名稱掛上、v1 一律婉拒（F7）
7. 全程遵守 F3

後端 v1：合約副本儲存表 + 認門牌驗證 + Google OAuth 身分端點 +
`saveThemeCssRules` 補上登入檢查（目前無驗證，是已知安全缺口）。

**不在 v1**：各 service 的真實實作、Objects 內容 schema、components/full CSS、
Integration Settings DB 化與後台編輯、跨 App 資料存取。

---

## 八、請交叉確認的重點

1. 凍結層 F1–F12 有沒有漏掉「十年後改不動會後悔」的條文？
   （例如：SDK 初始化完成的通知機制——外部專案怎麼知道專員到了？事件？
   Promise？這個介面也該凍結，目前條文未列。）
2. F2 常青 SDK 與 F3 是否足以覆蓋「壞部署同時打掛所有專案」的風險，
   還是需要額外的 SDK 端 kill-switch / 金絲雀機制？
3. F6 認門牌只靠 Origin header，對「非瀏覽器偽造請求」是否足夠？
   （威脅模型：偽造者最多能塞一份不被採信的合約副本，似乎無害——確認。）
4. F8 的信封二選一（resolve 帶 `ok:false` vs reject 帶錯誤碼）哪個十年下來
   比較不後悔？
5. 圖書館模型有沒有哪個角落與 Reservoir 願景（Slot Engine、Home Portal、
   App Registry）衝突？（此規格對應 Roadmap Phase 4 的對外整合面，
   不應搶在 Phase 1 核心前實作，但規格先定稿是同意的。）
