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
