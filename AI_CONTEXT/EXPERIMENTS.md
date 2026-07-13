# EXPERIMENTS — 尚未裁決的方向

這份文件放「有人提過、值得考慮，但使用者還沒拍板」的技術選型。
**不要把這裡的內容當成 `DECISIONS.md`**——這些都是選項，不是已定案的
方向；也不要當成 `FACTS.md`——這些都還沒有對應的程式碼。

---

## 1. Session 憑證是否改用 HttpOnly Cookie

**現況**：`localStorage` bearer token（見 `CURRENT_STATE.md`／`KNOWN_ISSUES.md` #1）。

**如果要改**：前提是先解決 `jonaminz.com` DNS 掛在 Squarespace、Worker
無法對 `.jonaminz.com` 設跨子網域 Cookie 的限制（見下一條）。即使 DNS
問題解決，也要考慮：
- 第三方 Cookie 在現代瀏覽器（Safari/Chrome 的分區政策）已經接近死亡，
  跨 origin 的 `fetch(worker, {credentials:"include"})` 行為在不同瀏覽器
  下可能不一致——這個顧慮在 `docs/platform-integration-reviews/review-claude-fable.md`
  第38行已有人提出。
- 改 Cookie 需要同時處理 CSRF 防護（目前 bearer token 模式天然不受
  CSRF 影響，因為 token 不會被瀏覽器自動附加）。

**未拍板**。

---

## 2. 是否使用 `auth.jonaminz.com` 或 `api.jonaminz.com` 獨立網域

**現況**：Worker 目前用 Cloudflare 預設的 `jonaminz-backend.ndmc402010104.workers.dev`
網域，前端網站用 `www.jonaminz.com`（GitHub Pages，CNAME）。兩者不同源。

**如果要改**：需要把 `jonaminz.com` 的 DNS（目前在 Squarespace）搬到
Cloudflare，才能讓 Worker 掛自訂網域、以及讓 Cookie 的 `Domain=.jonaminz.com`
生效。這是一個會牽動 DNS、可能影響現有 GitHub Pages CNAME 設定的較大
變更，本次盤點沒有看到任何時程規劃。

**未拍板**。`PROJECT_STATE.md` §7 UNKNOWN 清單有一條提到「apex 301
轉址至 www」被視為平台基礎設施合約的一部分，動 DNS 前要意識到 SDK
常青網址（`https://jonaminz.com/sdk/...`）依賴這條轉址，屬於同一類
需要謹慎處理的變更。

---

## 3. 跨 App SSO 的最終作法

**現況**：`pages/identity-relay/` 的 iframe + postMessage 單向查詢模式
（見 `CURRENT_STATE.md`）。

**可能方向**（本次盤點沒有找到任何文件對這幾個選項做過比較或拍板）：
- 維持現有 iframe + postMessage 模式，擴充成雙向（外部 App 也能觸發
  jonaminz 端登出）。
- 等 DNS 搬到 Cloudflare 後，改用 Cookie-based SSO（`Domain=.jonaminz.com`）。
- 每個外部 App 各自維護自己的登入態，只在需要顯示身分時才問 jonaminz
  （目前的做法），不追求真正的「單一登入態」。

**未拍板**。

---

## 4. `returnTo` token／state 的最終格式

**現況**：站內 `?next=` 只接受同源相對路徑字串（見 `FACTS.md` #30）。
跨 App 的 `returnTo`（例如從 skhpsv2 導來 jonaminz 登入，登入完要準確
導回 skhpsv2 的某個頁面）完全沒有實作，也沒看到文件討論過要用什麼格式
（純 URL？簽章過的 state token？跟 OAuth 的 `state` 參數共用機制？）。

**未拍板**。

---

## 5. Session rotation、裝置管理、全部裝置登出

**現況**：`sessions` 表目前是扁平的 token→identity 對應，沒有任何裝置
指紋、User-Agent 記錄、或「列出我目前登入的裝置」功能。登出目前只能
刪除呼叫端自己帶著的那一顆 token（單一裝置登出），沒有「登出所有裝置」
的 action。

**未拍板**，也沒有看到任何文件提出這個需求——本次盤點是依照任務指示
的必查清單主動列出這個選項，不是從現有文件挖出來的既有討論。

---

## 6. Objects 內容 schema（跨 App 資料關聯）

**現況**：Contract schema 的 `objects[]` 陣列信封已定（每項必有
`objectType` + `objectId`），但具體內容 schema（Photo/Trip 等）留白，
`docs/platform-integration-consensus.md` 第五節明文列為「保留層：本次
不定案」。

**未拍板**，等第一個真實案例出現才會設計。

---

## 7. 各 Platform Service 的 API 簽名（search、pin、relationship、
   notification、analytics、ai、calendar、file、profile、sharedCache、health）

**現況**：這 11 個名字已在規格 F11/S30 凍結為永久 ID（只能新增不能改名），
但除了 `identity`（`identity.currentUser@1`，已實作）以外，**其餘全部
沒有任何實作，也沒有 API 簽名設計**。`docs/platform-integration-consensus.md`
明文「參數與回傳格式等第一個真實 caller 出現才定」。

**未拍板**，不要在没有真實 caller 前預先設計簽名。

---

## 9. 視覺方向（配色/字體）改用 Theme 系統存放，而不是寫死進 reservoir tokens

**現況（2026-07-13）**：使用者從四個提案方向（見
`pages/admin/design/` 的展示頁 app.js，A 墨黑金屬／B 瓷白墨藍／C 深綠石／
D 亞麻米）選定 D「亞麻米 Flax & Ink」，當天直接改寫進
`assets/css/reservoir/02-tokens.css`（靜態、git 版本控制、需要
`push`＋等 GitHub Pages 重建才能換）。

**使用者提出的想法**：jonaminz 已經有一套動態 Theme 系統
（`theme_css_rules` 存在 Supabase，`/pages/admin/theme/` 後台編輯，
`theme-runtime.js` 全站即時套用，疊在 reservoir tokens 之上，見
`FACTS.md`／`CURRENT_STATE.md` 對應條目）——四個方向應該存成 Theme
系統裡的具名預設集，透過後台「選擇＋套用」即可切換，不用改程式碼、
不用重新部署。

**還沒討論到的細節（未拍板）**：
- Theme 系統目前的資料模型是「一組 CSS 規則」還是需要擴充成「多組具名
  預設集，選一組套用」？現有 `/pages/admin/theme/` UI 有沒有支援
  多預設集切換，還是只有單一份正在生效的規則？
- 靜態 reservoir tokens 這份「預設值」要不要保留當 fallback（Theme
  系統／Worker 斷線時的降級基準），還是四個方向全部搬進 Theme 系統、
  reservoir tokens 只留最中性的骨架？
- `--font-display` 這類字體宣告，Theme 系統過去只處理過顏色類 CSS
  custom properties，字體字串（含逗號、引號、fallback 清單）能不能
  乾淨地存進同一套機制，沒有驗證過。

**未拍板**，使用者原話「未來可以啦」——不是立即要做的事，下一次要動
視覺方向時記得先讀這條，不要直接又改 reservoir tokens 硬寫一次。

**2026-07-13 補充，跟圖書館模型裁決的關係**：`DECISIONS.md` §四（新增）
裁決了「公開前台／登入後管理員室／每本書」三個空間該長什麼樣子，亞麻米
被重新界定成**管理員室專屬**、不是全站唯一外觀。這是兩個不同層次的
問題，都還沒實作：本條（#9）問的是「Theme 值存在哪裡」（reservoir 靜態
檔案 vs 動態 Theme 系統），圖書館模型問的是「不同空間該不該吃到同一組
值」。兩者最終很可能匯合成同一個實作（Theme 系統存「多組具名預設集」，
不同空間各自訂閱自己該用的那組），但這次任務按使用者指示只做盤點與
方案提出，不動手；盤點內容見 `AI_CONTEXT/CHANGELOG.md` 2026-07-13
「Movie 主題卡片真連結＋圖書館模型盤點」條目。

---

## 8. Chat／AI participant framework 的技術選型

**現況**：完全沒有實作，也沒有找到任何文件討論過要用什麼技術（前端
框架？訊息儲存在哪張表？即時通訊用什麼機制？AI provider 怎麼切換？）。

**未拍板**。這是 `DECISIONS.md` 裡「Chat 屬於 Core」這條方向性裁決底下
最大的一塊空白，下一個要動這塊的人需要重新開規劃討論，不能假設本次
盤點找到任何既有設計。

---

## 10. Theme 架構盤點：公開圖書館／管理員室分流的最小可行方案

**任務背景**：`DECISIONS.md` §四（2026-07-13）裁決了三層視覺空間，本條
是本次任務指示要求的盤點結果——**只分析、不實作**，下一步要不要動手
由使用者裁決。

**1. 現在暖亞麻在哪些層被當成全站預設？**
`assets/css/reservoir/02-tokens.css`（CSS 疊加第 2 層，全站唯一
tokens 來源）整份改寫成亞麻米配色（見該檔案 2026-07-13 檔頭說明），
`:root` 層級，沒有任何 scope 限制，所有八個已登錄頁面（`home` /
`admin` / `admin-theme` / `admin-contracts` / `admin-design` /
`login` / `jonathan` / `minz`，見 `config.json` `pages` 清單）載入
reservoir 六層時都會拿到同一份 `:root` 變數。`03-base.css` 另外把
`h1`/`h2`/`h3` 全域套用 `--font-display`（亞麻米選定的 serif），
同樣沒有 scope。

**2. 哪些 selector／tokens 同時影響公開圖書館與登入後管理員室？**
`--color-bg`／`--color-text`／`--color-primary`／`--color-primary-2`／
`--color-border`／`--color-surface`／`--shadow-sm/md/lg`／
`--font-display` 這八個 token，加上 `03-base.css` 的
`h1,h2,h3{font-family:var(--font-display)}`，是目前唯一的「全站
共用」視覺層。用 `config.json` 的 `requireLogin()` 保護範圍（`FACTS.md`
#13）對照「公開圖書館 vs 管理員室」的空間定義：
  - **公開圖書館**（無登入要求）：`home`／`login`／`jonathan`／`minz`
    四頁。其中 `home` 的 `.hero h1` 已手動蓋回 `--font-sans`
    （`page-home.css` 註解明講是為了不被全站 serif 規則波及），但
    `jonathan`／`minz`／`login` 三頁沒有類似覆寫，目前直接吃亞麻米的
    背景色／主色／serif 標題字——**這三頁是本次盤點發現的實際落差**：
    它們照 `DECISIONS.md` §四第 18 條的定義屬於公開圖書館（尤其
    `jonathan`／`minz` 明文是「Jonathan 與 Minz 的公開展示」），但視覺
    上目前跟管理員室無法區分。
  - **管理員室**（`requireLogin()` 保護）：`admin`／`admin-theme`／
    `admin-contracts`／`admin-design` 四頁，全部直接吃亞麻米，符合
    §四第 19 條「管理員室沿用亞麻米」的裁決，這四頁不需要改。

**3. `theme_css_rules` 的單一 `unique(selector, property)` 是否會阻礙
空間分流？**
會，而且是硬性阻礙，不是效能或體驗問題。`backend/supabase/
theme_schema.sql` 第 17 行 `unique (selector, property)` 代表資料庫
物理上不允許同一個 `(selector, property)` 組合存在兩筆——沒有辦法讓
`:root { --color-bg }` 對公開圖書館是一個值、對管理員室是另一個值，
`saveThemeCssRules`（`worker.js` 第 348 行）的 `on_conflict=selector,
property` upsert 邏輯也是照這個約束寫的，改一筆會覆蓋另一筆，不會
並存。

**4. `theme-runtime.js` 的單一 cache key 是否會讓不同空間互相污染？**
會。`CACHE_KEY = "jonaminz.themeCssCache.v1"`（`assets/js/
theme-runtime.js` 第 26 行）是寫死的全站唯一字串，`getThemeCssRules`
（`worker.js` 第 299 行）也不接受任何 scope／space 參數，回傳的永遠是
`theme_css_rules` 全表。如果先開一個管理員室頁面（快取寫入管理員室的
CSS），再開一個公開圖書館頁面，會先用同一份快取閃一下管理員室的樣式
（`load()` 函式：有快取就先同步套用，背景才重抓，見第 190-200 行），
背景重抓完成後才會修正成正確版本——這是真實會發生的閃爍，不是理論
風險。

**5. 最小可行的分流方式是什麼？**
建議往「`theme_css_rules` 新增一個 `space` 欄位（例如
`'public'|'admin'|null`，`null` 代表兩邊都套用的共用規則）」的方向走，
不是複製三套水庫：
- **DB**：`theme_css_rules` 加 `space text` 欄位（可為 null），
  unique 約束改成 `unique (space, selector, property)`——null 需要
  用 partial unique index 處理（Postgres 的 `unique` 對 null 值預設
  視為互不相等，即使不改約束語法，多筆 `space IS NULL` 也不會互相
  擋，這點要留意測試，不能假設行為跟一般 unique 一樣）。
- **Worker**：`getThemeCssRules` 新增選填 `payload.space` 參數，回傳
  `space IS NULL OR space = payload.space` 的規則（公用規則 + 該空間
  專屬規則），省略 `space` 維持現有行為（全部回傳，向後相容，外部
  專案／舊呼叫端不用改）。`saveThemeCssRules` 的 `upsert` 允許帶
  `space`，`on_conflict` 改成 `space,selector,property`。
- **前端**：`theme-runtime.js` 的 `CACHE_KEY` 改成內插 space（例如
  `"jonaminz.themeCssCache.v1." + (space || "global")`），`load()`
  簽名加一個選填參數 `space`；`entry-core.js` 呼叫時依照
  `<html data-jonaminz-page-id>` 是否在 admin 系列頁面決定傳
  `"admin"` 還是 `"public"`。外部專案（Movie 等）不傳 space，維持
  拿全站共用規則，不受影響。

**6. 哪些結構 CSS 應繼續共用？**
Reservoir 1-7 層裡「結構規則」的部分（flex/grid 排版、hover/focus
狀態、z-index、loading gate 相關 class、按鈕/卡片的圓角與陰影*用法*
而非陰影*數值*）應該三個空間都共用，不因空間而異——這是 `RULES.md`
§一第 4 條本來就定下的「1-7 層放結構、第 8 層放視覺數值」原則，圖書館
模型沒有推翻這條，只是要求第 8 層的視覺數值本身需要依空間切換，不是
新增一條規則。Session／登入保護／Contract 治理邏輯（Worker 端）完全
不受影響，三個空間本來就共用同一套後端治理。

**7. 哪些視覺 tokens 才需要依空間切換？**
現有的八個色彩/字體/陰影 token（見第 1 點）加上 `03-base.css` 的
`h1/h2/h3` 字體規則，是需要依空間切換的最小集合。`--space-*`／
`--radius-*`／`--text-*`（間距、圓角、字級尺度）目前是中性數值，
沒有跡象顯示圖書館模型要求它們也要分流——保持全站共用，避免過度
設計。

**8. 如何確保外部專案仍然完全擁有自己的視覺世界？**
現有機制已經做到，不需要因為這次分流而改動：`theme-runtime.js`
是外部專案主動引用的獨立腳本（不是被強制注入），且套用的規則只有
`selector===":root"` 那些（`getThemeCssRules` 現在回傳全表，未來加
`space` 篩選後，外部專案不傳 `space` 依然拿公用規則，行為不變）；
`app.visualIdentity` Contract 欄位＋`getEffectiveSettings` 的
`effectiveCss` 判定（S31/S34）才是外部專案真正的視覺主張入口，
`theme_css_rules` 從頭到尾就不是外部專案視覺的來源，是 jonaminz
自己頁面（含未來的公開圖書館／管理員室）的機制。這條邊界在分流方案
裡原封不動，第 5 點的最小方案也刻意設計成「不傳 space 就是舊行為」
以確保這點。

**建議遷移順序**（僅供使用者裁決參考，本次不執行）：
1. DB migration 加 `space` 欄位＋修約束（向後相容，不影響現有規則的
   `space IS NULL` 語意）。
2. Worker 兩個 action 加選填 `space` 參數（向後相容）。
3. `theme-runtime.js` cache key／`load()` 簽名加 space（向後相容，
   舊呼叫端不傳 space 行為不變）。
4. `entry-core.js` 依頁面 id 判斷傳什麼 space（唯一需要碰共用檔案的
   一步，範圍很小）。
5. `/pages/admin/theme/` 後台 UI 加 space 篩選/切換，讓使用者能分別
   編輯公開圖書館與管理員室的規則。
6. 設計公開圖書館的實際配色/字體方向（這是新的美術決策，不是本次
   盤點範圍，需要使用者另外選定，可能要走跟亞麻米當初四方向選一個
   類似的流程）。
7. `jonathan`／`minz`／`login` 三頁的 CSS 覆寫（同 `page-home.css`
   當初蓋回 `--font-sans` 的做法）改成訂閱公開圖書館 space 的規則。
