<!-- AUTO-GENERATED. DO NOT EDIT DIRECTLY. -->
<!-- generatedAt: 2026-07-16T01:20:54.785Z -->

# PROJECT CONTEXT

## Project

jonaminz

## Active Task

_（目前沒有 active session，先執行 `memory.mjs start` 再開始工作）_

## Critical Rules

1. **禁止任意重構。**〔使用者〕未被任務單明確授權的重構（改架構、搬檔案、
   改命名、合併檔案）一律不做。就算你覺得程式碼可以更漂亮，也只能在回報中「建議」，
   不能動手。
2. **禁止修改任務範圍外的檔案。**〔使用者〕任務單會列出可修改檔案清單；
   清單外的檔案連「順手修一下」都不行。
3. **禁止猜測架構。**〔使用者〕看不懂的機制先讀 `AI_CONTEXT/ARCHITECTURE.md`、
   根目錄 `README.md`、各層 README；還是不懂就問，不要照自己的想像寫。
4. **禁止回頭修改 CSS 疊加第 1-6 層本體來解決單頁問題。**〔repo〕
   `assets/css/reservoir/01~06` 是全站共用層；頁面專屬樣式放第 7 層
   （該頁自己的 page-xxx.css），外觀數值（顏色/間距/圓角/陰影）歸第 8 層 Theme
   （Supabase），不寫死在 1-7 層。
5. **禁止讓頁面自行 release loading gate。**〔repo〕頁面只能透過
   `window.JonaminzLoading.done/fail` 回報自己的 task；all-ready 的判定屬於
   entry-core.js。
6. **禁止用頁面相對路徑載共用資源。**〔repo〕一律網站根目錄絕對路徑（開頭 `/`），
   因為頁面巢狀深度不一。
7. **禁止把 secret 寫進 repo / 前端 / 對話。**〔repo〕Supabase secret key 只存在
   Cloudflare Worker secret。根目錄 `suprabase db pw.txt` 是敏感檔案：不讀取、
   不搬移、不 commit（.gitignore 已擋）；需要直連 DB 屬敏感操作，**先問過使用者**。〔使用者〕
8. **禁止新增第二個 config.json 或每頁一個 manifest。**〔repo〕全站共用根目錄
   一份 `config.json`。
9. **禁止破壞「合約不含定位」原則。**〔repo：docs/platform-integration-consensus.md〕
   外部專案的自我宣告（manifest/contract）永不含 enabled / visibility / placement /
   permissions / granted capabilities；這些永遠屬於 jonaminz 這端。
10. **禁止刪除既有檔案**，除非任務單明確要求。〔使用者〕
11. **禁止把 JONAMINZ_ENTRY_VERSION（cache-buster）與 JONAMINZ_APP_VERSION
    （業務版本）混用。**〔repo〕
12. **禁止修改 `docs/platform-integration-spec-v1.md` 的凍結條文（S1–S39）。**
    〔使用者，2026-07-10 Frozen〕該文件是 Platform Integration 的十年憲法；
    新需求只能走其演進層（additive）或保留層發布，任何「改 S 條文」的要求
    都要先回報使用者確認是否真的要違約。實作與規格衝突時以規格為準。

## Confirmed Facts

本檔只收錄「已經用程式碼／schema／設定檔實際核對過」的事實，不收錄規劃、
裁決方向或未驗證的說法（那些分別放 `DECISIONS.md`／`EXPERIMENTS.md`／
`KNOWN_ISSUES.md`）。每項事實標三個獨立狀態，互不蘊含：

- **repo 已實作**：程式碼／schema／設定檔裡確實存在這個邏輯（本次盤點親自讀過原始碼）。
- **已部署**：有 `wrangler deploy`／`git push` 的紀錄（Version ID、`wrangler secret
  list`、GitHub Pages 建置）證明正式環境在跑這份程式碼。本次盤點**沒有**重新執行
  `wrangler deploy` 或對正式環境發出新的驗證請求，「已部署」的判定來自
  `AI_CONTEXT/CHANGELOG.md` 裡記載的部署紀錄（Version ID、`wrangler secret list`
  輸出等），不是本次盤點自己重新打過的證據。
- **已人工驗證**：CHANGELOG 裡有紀錄顯示真人（使用者）在正式環境實際操作過，或有
  curl／Playwright 對正式環境的驗證紀錄。同上，本次盤點沒有重新執行這些驗證，是
  引用 CHANGELOG 既有紀錄。

驗證日期（本次盤點讀取程式碼的日期，已用 `date` 指令查證系統時間）：**2026-07-12**。

---

## 一、登入與 Session

| # | 事實 | 驗證檔案 | repo 已實作 | 已部署 | 已人工驗證 |
|---|---|---|---|---|---|
| 1 | 已實作 Google OAuth（authorization code flow） | `backend/cloudflare-worker/worker.js` `handleGoogleStart`/`handleGoogleCallback`（第979-1095行） | 是 | 是（CHANGELOG 2026-07-12「後台整站加登入保護」條目記錄 Version ID `22eaa5a1-...`） | 是（CHANGELOG 記載使用者親自在 `https://www.jonaminz.com/pages/login/` 走完 Google 同意畫面並成功登入） |
| 2 | 仍保留內部密語登入（`loginWithInternalToken`），與 Google OAuth 並存，不是互斥的兩代機制 | `worker.js` 第883-902行；`pages/login/assets/js/app.js` 第98-143行同時渲染兩個入口 | 是 | 是（同上） | 是（CHANGELOG 記載使用者親自測過內部密語登入成功） |
| 3 | Session 存放在 Supabase `sessions` table（不是自簽 JWT） | `backend/supabase/auth_schema.sql` 第9-15行 `create table sessions(token text primary key, identity text, provider text, created_at, expires_at)`；`worker.js` `createSession()`/`requireSession()` | 是 | 是（CHANGELOG 記載已直連套用到 `jonaminz-db`，套用前後查過 `information_schema` 確認） | 是（CHANGELOG 記載使用者登入後直連查過 `sessions` 表確認產生新 row） |
| 4 | Session 是 server-side database session，不是自簽 JWT——查驗靠 DB row 是否存在＋`expires_at`，登出靠刪除 DB row，不需要 blocklist | `worker.js` `requireSession()`（第908-932行）：查 `sessions?token=eq...`，比對 `expires_at`；`logout()`（第965-977行）：`DELETE .../sessions?token=eq...` | 是 | 是 | 是 |
| 5 | 瀏覽器端 Session 憑證存在 `localStorage`，key 固定是 `jonaminz.sessionToken` | `assets/js/header.js` 第37行 `var TOKEN_KEY = "jonaminz.sessionToken"`；`pages/login/assets/js/app.js` 第25行同一個字串；`pages/identity-relay/index.html` 第38行同一個字串 | 是（三處字串完全一致，非各自為政） | 是 | 是 |
| 6 | **沒有使用 Cookie**——Worker 端沒有 `Set-Cookie`，前端沒有讀寫 `document.cookie` | 全 repo grep `Set-Cookie`／`document.cookie` 無結果；`worker.js` 註解明講「不是 cookie（`jonaminz.com` 的 DNS 掛在 Squarespace，Worker 沒辦法對 `.jonaminz.com` 設 cookie）」（第56-57行） | 是（確認沒有） | 是 | 是 |
| 7 | 使用 `localStorage`（非 sessionStorage、非 IndexedDB）存 session token | `header.js` `readToken()`/`writeToken()` 用 `window.localStorage.getItem/setItem`（第40-63行） | 是 | 是 | 是 |
| 8 | Google OAuth callback 把 token 放在 URL fragment：`#jonaminzSessionToken=...` | `worker.js` 第1093行：`redirectUrl = returnOrigin + "/#jonaminzSessionToken=" + encodeURIComponent(session.token)` | 是 | 是 | 是（CHANGELOG 記載使用者實測過 OAuth 完整流程） |

…（已截斷，`AI_CONTEXT/FACTS.md` 原始內容共 12990 字元，完整內容請直接讀取該檔案）

## Active Decisions

_（`AI_CONTEXT/DECISIONS.md` 目前沒有 `## DEC-NNN` 結構化決策條目（自由文字記述格式），以下改用確定性文字截取，不是結構化清單）_

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

…（已截斷，`AI_CONTEXT/DECISIONS.md` 原始內容共 17448 字元，完整內容請直接讀取該檔案）

## Current State

最後盤點：2026-07-12（文件真實性盤點，見 `SESSION_LOG.md` 同日條目）。
本檔是「現在系統長什麼樣子」的濃縮版；逐條證據見 `FACTS.md`，裁決方向
（含尚未實作的部分）見 `DECISIONS.md`，已知風險見 `KNOWN_ISSUES.md`，
未決的技術選型見 `EXPERIMENTS.md`。**與 `AI_CONTEXT/PROJECT_STATE.md`
的關係**：`PROJECT_STATE.md` 是逐任務的完整工程流水帳（含每個里程碑的
實作細節與驗證過程），本檔是給第一次接手、只想快速建立正確心智模型的
人看的濃縮結論，兩者不衝突，細節有出入時以 `PROJECT_STATE.md`／程式碼
為準。

---

## 一、Auth／Session 做到哪裡

**已完成並上線**：
- 兩條登入路徑並存：Google OAuth（authorization code flow）＋內部密語
  （`loginWithInternalToken`），兩者建立的 session 格式完全相同。
- Session 是 Supabase `sessions` 表的真實 database row（`token` 為
  primary key），**不是自簽 JWT**。TTL 30 天。查驗與登出都是直接對這張
  表做 SELECT／DELETE，沒有 JWT 簽章驗證或 blocklist。
- 瀏覽器端憑證存放方式：**`localStorage`，key 固定 `jonaminz.sessionToken`**。
  **完全沒有使用 Cookie**——Worker 沒有 `Set-Cookie`，前端沒有讀寫
  `document.cookie`。原因是 `jonaminz.com` 的 DNS 掛在 Squarespace（不是
  Cloudflare），Worker 無法對 `.jonaminz.com` 設跨子網域 cookie。
- Google OAuth callback 用 URL fragment 傳遞 token
  （`#jonaminzSessionToken=...`，fragment 不送到伺服器），前端
  `header.js` 的 `captureTokenFromHash()` 讀出來寫進 localStorage 後
  立刻用 `history.replaceState` 清掉網址列。
- 整個後台（`/pages/admin/`、`/pages/admin/theme/`、
  `/pages/admin/contracts/`）都要求登入（`requireLogin()`，失敗必定
  導頁到 `/pages/login/?next=...`）。三個寫入 action
  （`saveThemeCssRules`／`approveContract`／`rejectContract`）在 Worker
  端也各自要求有效 session（`requireSession()`），操作人直接用登入身分
  決定，不是前端自報。
- 舊的 `JONAMINZ_ADMIN_TOKEN` 固定密語機制**已完全淘汰**：Cloudflare
  secret 已刪除，`worker.js` 沒有任何讀取它的邏輯，前端沒有殘留的
  token 輸入框。
- `identity.current-user@1` capability（S30-33 規格意義下的正式
  service）機制已上線：`window.Jonaminz.identity.currentUser()` 一定存在
  （不論呼叫端有沒有被授權），未授權時 reject `CAPABILITY_NOT_GRANTED`；
  真正的授權判斷由 `pages/identity-relay/` 背後的 `getGrantedIdentity`
  action 逐請求重算，不信任 SDK 端快取的 capabilities 陣列。
- **但目前沒有任何專案被授權使用這個 capability**——唯一登記的外部專案
  `jonaminz-movies` 的 `capabilities` 欄位是空陣列。機制就位、沒開通給
  任何人，是刻意的（跟當初 `css` 授予的保守策略一致）。

**尚未完成／已知缺口**：
- ~~Google OAuth 登入這條路沒有把 `?next=` 帶回~~ **已於 2026-07-12
  修復**：`oauth_states` 新增 `next` 欄位、`handleGoogleStart`/
  `handleGoogleCallback` 驗證後帶著走，跟內部密語登入行為一致。機制
  已部署驗證，但還沒有人親自走完一次完整 Google 登入流程確認最終導頁
  正確（見 `KNOWN_ISSUES.md` 第 2 條）。
- 沒有跨子網域的 App SSO——`pages/identity-relay/` 只做「單向查詢身分」
  （用於 SDK 的 `identity.currentUser()`），不是完整的單一登入態同步。
- 沒有跨 App 的 `returnTo`（從外部 App 導去 jonaminz 登入、登入完再導回
  外部 App 那個確切頁面）——現有 `?next=` 只處理 jonaminz 站內導頁。
- 沒有 Cookie／自訂 Auth domain（`auth.jonaminz.com` 之類）——這是
  DNS 掛在 Squarespace 的直接後果，不是還沒做，是目前架構下做不到（除非
  改 DNS，見 `EXPERIMENTS.md`）。
- 過期的 `sessions`／`oauth_states` row 不會自動清理（`requireSession()`
  只是判定過期 row 視同未登入，不會主動 DELETE），沒有排程清理機制。
- 登出這條路（清 localStorage＋刪除 Supabase session row）目前只在本機
  Playwright（mock 環境）驗證過，沒有 CHANGELOG 記錄使用者在正式環境
  親自點過登出並確認 DB row 真的消失。

## 二、Contract／外部 App 平台做到哪裡

**已完成並上線**（Platform Integration implementation plan 第 1-7 項、
第 9 項階段 A/B，見 `docs/platform-integration-v1-implementation-plan.md`）：
- Contract JSON Schema（`docs/contract-schema/`）定案 RC3.1，Worker 用
  build-time 預編譯的 ajv standalone validator 驗證。
- `submitContract`：收到合約一律先進 `pending`，永不自動 approve；核對
  登記的 origin、cross-field 檢查、canonical hash 去重。
- 核准後台 `/pages/admin/contracts/`：pending 清單、跟 active 版本的
  diff、核准／否決（可互相改判，不是終態），走 Postgres function 原子
  更新三張表（`contract_snapshots`／`contract_active_snapshots`／
  `contract_audit_log`）。
- `getEffectiveSettings`：S31 公式，`css = min(Contract 聲明, Settings
  授予)`，`capabilities` 是真實交集（不再是佔位空陣列）。
- SDK 常青 loader（`sdk/jonaminz-entry.js`）＋ SDK Kernel
  （`sdk/sdk-src/sdk.js`）：contract discovery、推送、查 Effective
  Settings、settle `ready`/`degraded`、`tokens` CSS 收編、
  `identity.current-user@1` 首個正式 service。
- **唯一真實登記並跑過完整流程（submit→approve→撤回→再核准）的外部
  專案是 `jonaminz-movies`**（獨立 repo、GitHub Pages 部署）。
- `/pages/admin/design/`（implementation plan 外、2026-07-13 新增）：
  通用機制把「這個專案現在生效中的 Contract 有哪些 entries」轉成真的
  可點擊入口（`<a href>`），不是只給 `jonaminz-movies` 寫的特例——任何
  專案只要 Contract 有 `entries` 且平台 `integration-settings.json`
  有登記 origin，都會自動長出連結；沒有的維持 disabled，不影響卡片
  本身顯示。`listPendingContracts` 因此多回傳一個 `origin` 欄位（見
  `FACTS.md` #34），這是本次唯一的 Worker 改動，向後相容。

**尚未完成**：
- `window.Jonaminz.*` 除了 `identity.current-user@1` 以外，**沒有任何
  其他已發布的 service**（`search`／`notification` 等在 F11/S30 名單
  上的名字都還沒有實作，只是保留名稱）。
- SKHPSv2 尚未透過 Contract 機制正式登記（另一個 repo，使用者已明確
  裁決「不急」，目前是另一個 AI 工具在處理該 repo）。
- v0 機制（`registry.json` 拉模式＋`jonaminz-app.json`）與 Platform
  Integration（Contract 推模式）**兩套並存**，v0 尚未作廢（作廢需三
  條件，見 `DECISIONS.md` #15），`registry.json` 目前是空的。

## 三、Chat／AI participant／跨 App 導航

- **Chat 是 Core 的裁決方向，repo 內完全沒有任何實作**（沒有 UI、沒有
  訊息表、沒有 Worker action）。
- **AI participant framework／Gemini as provider 同樣是純方向裁決**，
  沒有對應程式碼。
- **App Launcher／跨 App 導航（Navigation Gateway）只有雛形**：登入頁
  `?next=` 站內導回、`identity-relay` 單向身分查詢，沒有統一的
  App Launcher UI，沒有完整的跨 App `returnTo`。

## 四、正式架構 vs 未來方向（一句話對照表）

| 主題 | 目前正式架構 | 未來方向（尚未拍板細節，見 EXPERIMENTS.md） |
|---|---|---|
| Session 憑證 | localStorage bearer token | 是否改 HttpOnly Cookie（需先解決 DNS 掛 Squarespace 的限制） |
| Session 儲存 | Supabase `sessions` 表，database session | 未變更方向 |

…（已截斷，`AI_CONTEXT/CURRENT_STATE.md` 原始內容共 7471 字元，完整內容請直接讀取該檔案）

## Known Issues

只記錄真實存在、可從程式碼或文件驗證的問題，不虛構漏洞、不臆測未讀過的
程式碼可能有什麼洞。每項標「風險等級」是本次盤點的主觀判斷（給下一棒排
優先序參考，不是正式的安全分級）。

---

## 1. Session token 存在 localStorage，有 XSS 情境下被讀取的風險

**現況**：`jonaminz.sessionToken` 存在 `localStorage`，任何能在
`www.jonaminz.com` 執行 JavaScript 的攻擊（XSS）都能讀到這個 token 並冒用
30 天內的登入身分。這是 `localStorage` bearer token 相對於 `HttpOnly`
Cookie 的固有取捨（Cookie 可以設 `HttpOnly` 讓 JS 讀不到，`localStorage`
不行）。

**現況緩解**：整站沒有 build pipeline、沒有第三方前端套件依賴（純原生
JS），第三方腳本注入面相對小；`identity-relay` 傳遞的 postMessage 內容
本身不含 token。

**風險等級**：中——兩人自用網站、攻擊誘因低，但如果未來真的開放給更多
使用者或引入第三方腳本／套件，這個取捨需要重新評估（見
`EXPERIMENTS.md` 的 Cookie 選項）。

**驗證**：`assets/js/header.js`、`pages/login/assets/js/app.js`、
`pages/identity-relay/index.html` 三處都直接 `window.localStorage`
讀寫，沒有額外的加密或混淆。

---

## 2. ~~Google OAuth 的 `next`／`returnTo` 沒有完整保留~~ 已修復（2026-07-12）

**原現況**：內部密語登入完整支援 `?next=`（登入成功導回原頁面，且做了
開放式重導向防護）。Google OAuth 這條路沒有把 `next` 一起帶過去——
`worker.js` 的 `handleGoogleCallback` 固定導回 `resolveOauthReturnOrigin()`
算出來的 origin 根目錄，不是使用者原本想去的頁面。

**修復**：`oauth_states` 表新增 `next` 欄位（已套用到 `jonaminz-db`），
`handleGoogleStart` 驗證後存進去、`handleGoogleCallback` 重新驗證一次
再拼進最終 redirect 網址，`googleStartUrl()` 帶上 `&next=`——跟內部密語
登入現在行為一致。細節見 `AI_CONTEXT/CHANGELOG.md` 同日「Google OAuth
`next` 缺口修復」條目、`AI_CONTEXT/FACTS.md` 對應事實列。

**尚未確認**：機制本身（DB 存值、Worker 重新驗證、curl 驗證轉址）已
驗證正確，但 Google 同意畫面那段需要真人瀏覽器互動，**還沒有人親自
點過一次完整登入流程確認最終真的導回原頁面**。

---

## 3. 跨子網域 App 的登入導向（SSO）尚未完成

**現況**：`pages/identity-relay/` 只做「單向查詢身分」（外部 App 的 SDK
透過隱藏 iframe 問「這個人現在是誰」），不是完整的單一登入態同步
（Single Sign-On）。外部 App 沒有辦法讓使用者「在 jonaminz 登入一次，
自動在所有子網域都變成已登入」，只能各自呼叫 `identity.currentUser()`
去問。

**風險等級**：不算安全風險，是功能缺口——目前也沒有任何專案在用這個
capability（`FACTS.md` #17），所以缺口尚未造成實際影響。

---

## 4. Cookie／自訂 Auth domain 尚未處理

**現況**：`jonaminz.com` 的 DNS 掛在 Squarespace，不是 Cloudflare，
Worker 無法對 `.jonaminz.com` 設跨子網域生效的 Cookie，這是選擇
localStorage bearer token 而非 Cookie 的直接原因，不是還沒做，是目前
DNS 架構下做不到。要改變這個現況需要先搬 DNS（見 `EXPERIMENTS.md`）。

**風險等級**：架構限制，不是 bug。

---

## 5. 過期 Session／OAuth State row 不會自動清理

**現況**：`requireSession()` 只是把過期的 `sessions` row 視同「未登入」
（比對 `expires_at`），**不會主動 DELETE**；`oauth_states` 除了在
callback 核對後立刻刪除（一次性防重放）以外，過期但從未被 callback
消費的 state row（例如使用者中途放棄登入）同樣不會被清理。

**影響**：兩張表會隨時間緩慢增長垃圾列，兩人自用網站量體極小，短期內
無感，長期（數年）累積量仍然有限（每次登入頂多一列）。

**風險等級**：低，工程債而非安全問題。`worker.js` 註解裡明確記錄了這是
刻意的取捨（「過期資料留著不影響任何行為，不值得為了清理另外排
cron」），不是遺漏。

---

## 6. URL fragment token 傳遞屬敏感流程，雖已清除仍要注意

**現況**：Google OAuth 完成後，session token 短暫出現在瀏覽器網址列
（`#jonaminzSessionToken=...`），前端立刻讀出並用 `history.replaceState`
清除。Fragment 不會送到伺服器（不會出現在伺服器 log），但清除之前的
極短視窗內：
- 瀏覽器紀錄（history）在 `replaceState` 執行前的那個瞬間，理論上作業
  系統層級的螢幕錄影/瀏覽器擴充套件仍可能捕捉到這段網址。
- 如果使用者在 `replaceState` 執行前手動複製網址列分享出去，token 會
  外洩。

**風險等級**：低（時間窗極短，且是 OAuth authorization code flow 導回
時的常見做法），但清單裡明確列出以提醒任何未來重構這段邏輯的人：
`captureTokenFromHash()` 必須保持在 `header.js` IIFE 的最外層立即執行，
不能因為重構而延後到使用者互動之後才清除。

---

## 7. README 與部分文件的同步問題

**現況（本次盤點發現並已處理，見 `SESSION_LOG.md`）**：
- `pages/README.md` 原本仍寫「approve/reject 是目前唯一有身分驗證保護

…（已截斷，`AI_CONTEXT/KNOWN_ISSUES.md` 原始內容共 9325 字元，完整內容請直接讀取該檔案）

## Recent Checkpoints

用途：記錄「文件盤點/大範圍文件修改」這類任務的 checkpoint，方便使用者
事後決定要不要 commit，以及需要時怎麼回退。跟工程任務的部署 checkpoint
（`wrangler deploy` 的 Version ID 之類）分開，那些記在 `CHANGELOG.md`。

---

## Checkpoint: `docs-audit-202607`（2026-07-12 文件真實性盤點）

**Commit 前狀態**：`git status` 為 clean，`main` 分支與 `origin/main`
同步，最新 commit 為 `eac0efb`（「文件小修正：順序④已 push，更新
PROJECT_STATE 開頭狀態描述」）。本次盤點開始前沒有任何未提交的變更。

**修改範圍（僅 Markdown，未執行 git add/commit/push）**：

- 新增 8 個檔案（`AI_CONTEXT/` 底下，全部是本次盤點建立，先前不存在）：
  - `AI_CONTEXT/FACTS.md`
  - `AI_CONTEXT/DECISIONS.md`
  - `AI_CONTEXT/CURRENT_STATE.md`
  - `AI_CONTEXT/KNOWN_ISSUES.md`
  - `AI_CONTEXT/EXPERIMENTS.md`
  - `AI_CONTEXT/SESSION_LOG.md`
  - `AI_CONTEXT/CHECKPOINTS.md`（本檔）
  - `AI_CONTEXT/DOCUMENT_STATUS.md`
- 修改 13 個既有 Markdown 檔案：
  - `README.md`（補充檔案結構圖、加現況指引）
  - `pages/README.md`（修正過期的 JONAMINZ_ADMIN_TOKEN 描述，補
    login/identity-relay 頁面說明）
  - `docs/frontend-quality-plan-202607.md`（階段①加註完成狀態）
  - `docs/platform-integration-consensus.md`（加 Historical 標記）
  - `docs/platform-integration-spec-review.md`（加 Historical 標記）
  - `docs/platform-integration-review-request.md`（加 Historical 標記）
  - `docs/platform-integration-review-consolidation.md`（加 Historical 標記）
  - `docs/platform-integration-reviews/review-chatgpt.md`（加 Historical 標記）
  - `docs/platform-integration-reviews/review-claude-fable.md`（加 Historical 標記）
  - `docs/platform-integration-reviews/review-codex.md`（加 Historical 標記）
  - `docs/platform-integration-reviews/review-gemini.md`（加 Historical 標記）
  - `docs/platform-integration-reviews/review-perplexity.md`（加 Historical 標記）
  - `docs/platform-integration-reviews/acceptance-review-spec-v1-rc.md`（加 Historical 標記）

**未修改的檔案類型**：`.js`／`.html`／`.css`／`.json`／`.sql`／`.toml`
一律未動。逐一核對方式：`git diff --name-only` 的輸出只包含 `.md`
副檔名的路徑（見最終報告第 8-10 項的實際指令輸出）。

**驗收方式**：

1. `git status --porcelain` 確認變動檔案清單與上面列的 21 個檔案
   （8 新增 + 13 修改）完全一致，沒有意外檔案混入。
2. `git diff --name-only` 逐行檢查副檔名，確認全部是 `.md`。
3. 六份供未來 agent 快速理解現況的檔案（`FACTS.md`／`DECISIONS.md`／

…（已截斷，`AI_CONTEXT/CHECKPOINTS.md` 原始內容共 7728 字元，完整內容請直接讀取該檔案）

## Recent Sessions

## session_20260716011926_0432da29 — 2026-07-16T01:20:54.781Z — claude-code

- **Task**：文檔一致性掃描：確保APK agent token機制在所有相關文件正確反映
- **Done**：無
- **Changed files**：無
- **Validation**：無
- **Next**：無
- **New issues**：無

## session_20260715235954_1255b298 — 2026-07-16T00:22:23.182Z — claude-code

- **Task**：接續 for_claude 待辦：驗證後台摘要列/回答設計問題、OneDrive檔案自動過期設定、評估貼圖面板時機
- **Done**：無
- **Changed files**：無
- **Validation**：無
- **Next**：無
- **New issues**：無

## session_20260715142203_50cfb2a4 — 2026-07-15T14:25:41.738Z — claude-code

- **Task**：修 ensureImageUrls 在 getImageUrls 整批失敗時永遠卡在準備中的 bug
- **Done**：
  - 修好ensureImageUrls整批失敗未標記itemId的bug，補上失敗/catch分支統一標記null
- **Changed files**：
  - assets/js/chat-thread.js,version.js,AI_CONTEXT/CHANGELOG.md
- **Validation**：
  - node --check通過；純前端修改不需wrangler deploy
- **Next**：
  - 等使用者與Minz重新連接OneDrive拿到User.Read scope後，實測檔案下載是否真的能成功（目前只確定UI不會再卡死）
- **New issues**：無

## session_20260714102617_ffd17af1 — 2026-07-14T11:24:03.192Z — claude-code

- **Task**：chat 功能大補強：typing/三態已讀/推播/reactions/reply/圖片分享/通話/shared瀏覽/通知面板bug
- **Done**：無
- **Changed files**：無
- **Validation**：無
- **Next**：無
- **New issues**：無

## session_20260713104827_74d2f3cd — 2026-07-13T10:50:05.921Z — claude

- **Task**：Minz Page v0.1 Phase 1 純展示骨架實作（HTML/JS/CSS）
- **Done**：無
- **Changed files**：無
- **Validation**：無
- **Next**：無
- **New issues**：無

## Pending Candidates

- **PEND-002** [fact] — ensureImageUrls整批失敗未標記itemId，導致下載連結永遠卡在「還在準備中」
- **PEND-001** [decision] (memory) — 正式文件與自動紀錄分離

## Agent Instructions

- 不得重新打開已裁決且仍為 active 的決策，除非使用者明確要求。
- 不得把 Pending 或 Experiment 當成正式規則。
- 不得宣稱尚未驗證的功能已完成。
- 修改前先確認 CURRENT_STATE、KNOWN_ISSUES 與 CHECKPOINTS。
- 發現文件與程式碼不一致時，先記錄衝突，不得自行選擇方便的版本。
- 新事實與新決策先進入 Pending。
- 結束工作前必須更新 Session Log 並執行 memory:check。
