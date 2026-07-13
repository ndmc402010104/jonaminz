# DECISIONS — 使用者已裁決的架構方向

本檔記錄「使用者已經拍板的架構方向」，**不代表已經實作完成**——每一條都會標
明目前的實作狀態（未開始／機制就位但未授權／已上線），實作細節與驗證證據見
`FACTS.md`，不要把這份文件當成「這些都做完了」的清單。

裁決依據：`docs/platform-integration-spec-v1.md`（Frozen, S1-S39，唯一權威規格）、
`docs/platform-integration-consensus.md`（凍結前的共識版理解，F1-F12，已被
spec-v1.md 吸收，衝突時以 spec-v1.md 為準）、`docs/platform-integration-v1-implementation-plan.md`、
`AI_CONTEXT/CHANGELOG.md`、`AI_CONTEXT/RULES.md` 逐條核對。

---

## 一、Core／外部 App 邊界

1. **Jonathan／Minz 身分與登入屬於 Core。**
   已裁決且**已實作、已上線**（Google OAuth + 內部密語登入，見 `FACTS.md` #1-2）。

2. **Session（登入狀態管理）屬於 Core。**
   已裁決且**已實作、已上線**（Supabase `sessions` 表，見 `FACTS.md` #3-4）。

3. **Chat／AI participant framework 屬於 Core。**
   已裁決方向（見 `docs/platform-integration-spec-v1.md` 第一部分敘事骨架的
   Kernel/Shell/Services 分層，以及本次任務指示明確重申的裁決）。
   **repo 內完全沒有任何程式碼**——沒有 chat UI、沒有訊息儲存表、沒有 AI
   participant 相關的 Worker action。這是純方向性裁決，**尚未開始實作**，
   不要因為這裡列出來就以為已經動工。

4. **Gemini（或任何特定供應商）只是 AI provider，不是 Core 本身。**
   已裁決方向：Core 依賴的是「AI participant framework」這個抽象層，不是
   綁死某一家供應商的 SDK。**repo 內目前沒有任何 AI provider 整合程式碼**
   （沒有呼叫 Gemini／OpenAI／Anthropic API 的邏輯），這條裁決目前純粹是
   方向宣示，沒有對應實作可核對。

5. **Contract／Registry／Capability governance 屬於 Core。**
   已裁決且**已實作、已上線**：`submitContract`／`approveContract`／
   `rejectContract`／`getEffectiveSettings`／`resolveEffectiveCapabilities`
   全部是 Worker（Core 後端）持有的邏輯，外部專案永遠不直接寫入或授權自己
   （見 `FACTS.md` #21-26）。

6. **App Launcher／Navigation Gateway 屬於 Core。**
   已裁決方向（見 `docs/platform-integration-spec-v1.md` 敘事骨架、
   本次任務指示重申）。**目前實作程度有限**：現況只有登入頁的 `?next=`
   單頁導回（`FACTS.md` #30）與 `pages/identity-relay/` 的單向身分轉發
   （`FACTS.md` #18），沒有統一的「App Launcher」UI 或「跨 App 導向」機制。
   詳見 `CURRENT_STATE.md` 的缺口清單。

7. **跨 App 關聯、共通搜尋與通知入口屬於 Core。**
   已裁決方向。**repo 內完全沒有實作**——沒有搜尋 API、沒有通知系統、沒有
   跨 App 物件關聯的資料表（`contract_snapshots` 的資料模型雖然預留了
   `objects[]`／`objectType` 的信封，見 `docs/contract-schema/README.md`，
   但那是「保留層」，內容本身尚未定義，見 `EXPERIMENTS.md`）。

8. **Movies、Travel、Places、Photos、Home、Shopping、Learning 等是
   first-party external apps（同一位開發者製作），不是 third-party。**
   已裁決且**用詞已在現行文件中正確反映**：`docs/platform-integration-spec-v1.md`
   第42行明文「10-15 個自行開發的 first-party app；無陌生第三方」；
   `docs/platform-integration-v1-implementation-plan.md`／
   `docs/platform-integration-reviews/*.md` 多處使用 first-party 用詞。
   **目前唯一已真實登記、上線的外部 App 是 jonaminz-movies**（見
   `FACTS.md` #27）；Travel/Places/Photos/Home/Shopping/Learning 等
   **repo 內找不到任何蹤跡**（不在 `registry.json`、不在
   `integration-settings.json`、没有對應獨立 repo 的引用），這些名字
   目前只是任務指示裡列出的「未來可能的 App」，不代表已經存在或已規劃
   時程，本次盤點沒有在任何文件中找到它們的具體條目。

9. **SKHPSv2 是外部接入 App（透過 Contract 機制），部分入口可能公開，
   不是 Core 的一部分。**
   已裁決方向且**現行文件用詞正確**：`pages/admin/assets/js/app.js` 目前
   只是連去 `https://skhps.jonaminz.com` 的外部連結卡片，不是把 SKHPS
   的程式碼混進 jonaminz repo。`docs/platform-integration-v1-implementation-plan.md`
   明文「SKHPSv2 正式接入 jonaminz（用 Contract 機制登記成外部專案）是
   使用者的真實意圖，但……不急，排在核心架構都做完之後」——**尚未透過
   Contract 機制正式登記**（`integration-settings.json` 沒有 skhpsv2 的
   project entry，見 `FACTS.md` #28）。「部分入口可能公開」目前沒有
   具體對應的程式碼可核對（SKHPSv2 是獨立 repo，不在本次盤點範圍內）。

## 二、資料與治理邊界

10. **存取規則以 entry（`entryId`）為單位，不是整個 App 二分 public/private。**
    已裁決且**已實作**（見 `FACTS.md` #32）：目前實際落地的粒度是「頁面」
    （後台三頁各自 `requireLogin()`），Contract schema 的 `entries[]` 陣列
    也是以 entry 為單位的信封（`docs/contract-schema/README.md` S3），但
    v1 Effective Settings 目前只算「整個 App 的 css／capabilities」交集，
    還沒有做到「同一個 App 底下，entry A 公開、entry B 需要登入」這種
    細粒度的 per-entry 授權判斷——這部分是形狀已定、尚未真正逐 entry 實作。

11. **Contract 與 Registry 的責任分工：Contract 只宣告「自己是什麼」
    （entries／capabilities.supports／css 等），Registry／Integration
    Settings 決定「誰看得到、誰能進、放在哪裡」（enabled／origin／授予的
    capabilities／css 上限）。**
    已裁決且**已實作、有 schema 層強制**：`docs/contract-schema/jonaminz.contract.schema.json`
    的 `forbiddenFieldsGuard` 直接讓合約宣告 `enabled`/`visibility`/
    `placement`/`permissions`/`grantedCapabilities` 時整份判 invalid（見
    `FACTS.md` #33）。

12. **Core 不保存各 App 的 domain schema（例如 Movies 的電影資料表結構
    不會出現在 jonaminz-db）。**
    已裁決方向，**現況與此一致**：Supabase `jonaminz-db` 目前七張表
    （`external_app_registrations`／`theme_css_rules`／`contract_snapshots`／
    `contract_active_snapshots`／`contract_audit_log`／`sessions`／
    `oauth_states`）沒有任何一張是特定外部 App 的業務資料表，Contract 的
    `raw_contract`（jsonb）也只存合約本身的宣告內容，不是外部 App 的
    業務資料。這條裁決目前沒有被違反，但也還沒有出現「外部 App 真的需要
    Core 代管資料」的真實案例來驗證這個邊界撐不撐得住。

13. **AI 呼叫 App 能力時仍需經過平台治理**（不能繞過 Contract／Integration
    Settings 直接呼叫外部 App 的私有 API）。
    已裁決方向。**目前沒有 AI 呼叫任何 App 能力的實作**（見上方第 3、4 條），
    這條裁決暫時無法用程式碼驗證，只能記錄方向本身與現有 `identity.currentUser@1`
    這唯一一個真實 capability 的治理模式一致（`getGrantedIdentity` 逐請求
    重算授權，不信任快取值，見 `FACTS.md` #17-18）——如果未來 AI 呼叫能力
    照同一套機制走，方向是通的，但這是推論不是既成事實。

14. **導向（登入導頁）、Auth、Navigation Gateway 屬於 Core。**
    見上方第 1、2、6 條，Auth 部分已上線，Navigation Gateway 部分僅有雛形。

---

## 三、文件位置與規則類裁決（供交接參考，非架構本身）

15. `docs/external-project-manifest.md`（v0 接入機制）不會因為 Platform
    規格定稿就自動作廢，作廢需三條件同時成立：新 SDK 實作完成＋遷移完成
    ＋使用者明確宣布 deprecated（`AI_CONTEXT/RULES.md` §四）。**三條件
    均未成立**（`registry.json` 仍空，v0 與 Platform Integration 兩套
    機制目前並存）。

16. `docs/platform-integration-spec-v1.md` 的 S1-S39 條文已 Frozen
    （2026-07-10），永不修改；新需求只能走演進層（additive）或保留層
    發布。與程式碼衝突時以規格為準。

17. 版本 bump 規則、`wrangler deploy` 需另外授權、回覆一律繁體中文等
    工作習慣類裁決，見 `AI_CONTEXT/RULES.md`，不重複列在此檔。

---

## 四、視覺架構：圖書館模型（2026-07-13 使用者裁決）

jonaminz 的正確比喻是一座圖書館，不是一個單一產品。這條裁決把「哪個
空間該長什麼樣子」拆成三層，取代原本「亞麻米 Flax & Ink 是全站唯一
外觀」的隱含假設（見 `EXPERIMENTS.md` #9 的 2026-07-13 舊記錄——那筆
現在要跟這條合併理解：亞麻米本身沒有被推翻，但它的**適用範圍**被
重新界定了）。

18. **公開前台是圖書館本體。** 負責展示有哪些專案／書籍、專案分類與
    導覽、Jonathan／Minz 的公開展示、提供穩定清楚值得信任的平台入口。
    調性要求：專業、乾淨、有秩序、中性但有自己的平台識別、**不搶走
    每一本書自己的世界觀**。
    **實作狀態：尚未實作。** 現況是亞麻米（`assets/css/reservoir/
    02-tokens.css`）已套用到全站（見 `CURRENT_STATE.md`／
    `FACTS.md` 對應條目），公開前台（首頁 `index.html`）跟登入後
    管理員室目前共用同一套 tokens，沒有視覺分流。這條裁決要求的
    「專業乾淨中性」風格與現行的暖亞麻**不是同一件事**，需要新的
    設計方向，本次盤點（見下方「Theme 架構盤點」）只分析分流機制，
    不重新設計公開前台外觀。

19. **登入後管理員室是 Jonathan／Minz 的共用私人空間。** 可以溫暖、
    私密、有生活感，像兩人共同使用的房間；**沿用目前的「亞麻米 · Flax
    & Ink」方向**。管理員室仍可容納 Theme／Contract／專案管理等功能，
    但**不能因為有管理功能就自動設計成冷冰冰的企業 SaaS Dashboard**——
    暖亞麻不是圖書館外牆，是管理員室裡的木桌、沙發、紙張和燈光。
    **實作狀態：視覺基調已就位（亞麻米本身已存在且已上線），但「只
    套用在管理員室、不套用在公開前台」這個分流尚未實作**——目前是
    全站一套，不是有意的「管理員室專屬」設計。`/pages/admin/`、
    `/pages/admin/theme/`、`/pages/admin/contracts/`、
    `/pages/admin/design/` 這四頁（`requireLogin()` 保護範圍，見
    `FACTS.md` #13）符合「登入後管理員室」的頁面範圍定義，但目前的
    CSS 架構沒有辦法只讓這四頁吃到亞麻米、其餘頁面吃別的方向。

20. **每一本書（外部專案）是各自獨立的視覺世界。** 例如
    `jonaminz-movies` 是酒紅 Editorial 的電影世界；未來的旅行／相簿／
    SKHPS 等專案可以各自是完全不同的調性。每一本書自己擁有完整視覺
    調性，不需要跟 jonaminz 公開前台一致，不需要跟管理員室一致；透過
    Contract 告訴平台自己是什麼、有哪些入口；**只遵守平台的整合規則
    （S9/S33：不宣告 enabled/visibility/placement 等定位欄位），不必
    穿平台的視覺制服**。
    **實作狀態：機制已上線且已有真實案例。** `app.visualIdentity`
    Contract 欄位（見 `docs/contract-schema/jonaminz.contract.schema.json`
    的 `$defs/hexColor`／`visualIdentity` 定義）＋
    `/pages/admin/design/` 展示頁已經是這條裁決的具體落地：
    `jonaminz-movies` 透過 Contract 自報「酒紅 Editorial」調性，
    jonaminz 只負責展示、不干涉其視覺本體。2026-07-13 本次任務再加上
    「進入」真連結（見 `CHANGELOG.md` 同日條目），讓每本書除了「被
    看見自己的調性」以外，也能「被連過去」，兩者合起來才是完整的
    「圖書館展示一本書」體驗。

21. **這三層是同一套整合規則下的三個空間，不是三個互相複製的獨立
    網站。** 概念上：
    ```
    共同平台結構與整合規則（Worker／Contract／Session／登入保護）
    ├─ 公開圖書館：專業、乾淨、有秩序（尚未實作專屬外觀）
    ├─ 登入後管理員室：暖亞麻、私密、生活感（沿用現行亞麻米）
    └─ 每一本書：各自 repo、Contract 與獨立世界觀（機制已上線）
    ```
    結構層（水庫 1-7 層：flex/grid/hover/z-index、loading gate、
    Session／Contract 治理邏輯）三個空間共用，不因空間而異；只有
    **視覺 tokens**（顏色／字體／間距數值，現行架構的第 8 層 Theme）
    需要依空間切換。哪些 selector 現在被誤當成全站共用，詳見
    `EXPERIMENTS.md` #10「Theme 架構盤點」。**分流機制本身在寫下這條
    當下還沒拍板，2026-07-13 稍晚已經拍板**——見下方 §五，`theme_css_rules`
    單一 flat table 的小補丁方案已被 ADPF Pack 模型取代，不要照這裡原本
    暗示的「加一個 space 欄位」方向做。

**2026-07-13 稍晚更新：「圖書館」這個比喻本身被使用者推翻，第 18 條
把首頁／Jonathan／Minz／登入頁全部併成同一層「公開圖書館」的分法
作廢，改成下面這個結構（第 18 條的技術性結論——結構層共用、只有視覺
tokens 分流——仍然成立，只是分空間的方式從「公開圖書館 vs 管理員室」
改成「大廳／房間／後台」三層，房間不再只有一層、每個房間各自獨立）：**

```text
共同平台結構與整合規則（Worker／Contract／Session／登入保護，不變）
├─ 大廳（jonaminz 首頁，僅此一頁）：入口/導覽，範圍比原第 18 條窄
├─ 個別房間（Jonathan、Minz 各自的公開頁）：各自獨立視覺，不互相統一，
│  跟第 20 條「每一本書」是同一種精神（各自的世界觀），但這是 Core
│  自己的兩個人，不是外部 Contract 專案
├─ 後台（`admin` 系四頁）：沿用亞麻米（第 19 條，不變）
└─ 登入頁：功能性過場頁，不是「房間」，維持中性樣式，不特別分配識別
```

**已定案的具體方向**（2026-07-13）：

- **大廳（jonaminz 首頁）＝「米紙 Rice Paper」**：底色 `#f6f3ec`、
  文字 `#221f1c`、主色（暖褐）`#8a7355`，搭配真的圓相字標
  `assets/img/jonaminz-zen-logo.svg`（另一個 session 正在做，套用時是
  2026-07-13 16:15 版，只有圓相＋字標，竹枝／疊石已移除——如果那份檔案
  之後改版加回竹枝／疊石，首頁的 `<img>` 引用同一個檔名會自動吃到新版，
  不用另外通知）。**實作狀態：已實作並通過 Playwright 視覺驗證**
  （2026-07-13）：`02-tokens.css` 新增 `--color-bg-lobby`／
  `--color-text-lobby`／`--color-lobby-accent`（取代原本的 `-dark`
  系列）；`page-home.css`／`index.html` 改用新 token，`<h1>jonaminz</h1>`
  換成 `<img class="hero-logo" src="/assets/img/jonaminz-zen-logo.svg">`；
  `jonaminz-loading.css` 的布幕預設色跟著從深色改回一般淺色 token
  （因為現在多數頁面是淺色，深色只剩 Jonathan 一頁）；
  `pages/admin/theme/assets/js/app.js` 的 Token 編輯器選單同步改名。
  桌機／手機截圖確認、6 頁回歸測試零 console error、Theme 後台確認
  新 token 名稱正確顯示。
- **Jonathan 的房間 ＝「深夜訊號」黑色系**：暖近黑底 `#17130f`、
  暖米白文字 `#f2e9d8`；主色（琥珀／松石／石墨藍／陶土四選一）**尚未
  選定**，等實際做 Jonathan 頁面時再定。選這個方向的理由：Jonathan
  是整形外科醫師，頁面會放病人作品集，需要專業／信任感，跟大廳的輕盈
  紙感刻意拉開。**實作狀態：僅方向裁決，尚未動手，主色未定。**
- **Minz 的房間**：完全未討論，方向未定。
- 以上探索過程留下三個比較用的展示頁（非正式產物）：
  `docs/pack-framework/` 以外的暫存 artifact，內容不在 repo 裡，只在
  對話紀錄中，需要時可以重新生成。

---

## 五、Theme／視覺套件機制：採用 ADPF 模式（2026-07-13 使用者裁決）

使用者與 ChatGPT 共同驗證了一套「AI 輔助宣告式套件框架」（ADPF：
AI-Assisted Declarative Pack Framework）提案，完整內容見
`docs/pack-framework/README.md`（含原始附件 checklist 與 envelope
schema，同資料夾）。裁決：**採用**，第一個落地場景是 jonaminz 自己的
Theme 系統，之後可推廣給其他 first-party app 共用同一套機制。

22. **視覺／內容套件一律走「Prompt Builder → AI 只回傳受限 JSON → 驗證
    → 預覽 → 版本化匯入 → 套用」流程，不是讓 AI（或任何呼叫端）直接
    寫 CSS/JS/HTML/SQL。** 這條原則本身已裁決採用，理由：現行
    `saveThemeCssRules` 只要登入就能寫任意 `selector/property/value`
    三元組，沒有 schema 約束；改用固定 payload schema（具名 design
    token，不是自由 selector）從根本收斂這個面，同時解決
    `EXPERIMENTS.md` #9 留了很久的老問題（Theme 系統該不該是「多組
    具名預設集」）。
    **實作狀態：完全尚未實作。** 只是方向裁決，`docs/pack-framework/
    README.md` §9 列了 jonaminz Theme 場景的具體落地步驟（6 步）。

23. **第一步只做 Theme 這一個 Pack Type（`platform.theme-preset@1`），
    不是原提案列的 Travel／Movies／Photos／Learning／Dashboard 等全部
    場景。** 那些是給未來還不存在的 App 用的同一套機制，等對應 App
    真的出現才評估要不要套用同一套 Pack Kit——**不是這次裁決的一部分**，
    避免下一個 agent 誤以為要一次把整份報告書全部實作。
    **實作狀態：未實作，範圍刻意收斂。**

24. **AI 動態生成新 Pack 內容（Prompt Builder + 呼叫 AI API）不是 Theme
    落地的必要條件，可以晚一點做。** 先把「已知的四＋一個既有視覺方向」
    用 Pack Registry／Binding 資料模型跑通（本質是資料模型遷移，不是
    AI 功能），之後才加「讓使用者填需求、AI 生成新方向」這一層。
    **實作狀態：未實作。**

25. **「把這套機制做成開放給 jonaminz 生態圈以外呼叫的圖書館工具」是
    使用者提出的方向性提問，不是裁決。** 原話「有沒有機會」——記錄在
    `EXPERIMENTS.md` 對應條目，未拍板，不要當成既定方向動手設計。
