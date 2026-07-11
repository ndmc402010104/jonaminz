# Platform Integration v1 — Implementation Plan（非規格）

日期：2026-07-10
地位：**工作清單與實作順序，不是規格**。規格是
`platform-integration-spec-v1.md`（唯一權威）；本文可以隨進度改寫，
規格不行。

---

## 實作順序（建議）

1. **Contract JSON Schema ＋ 範本**（依 Spec S7–S12）—— ✅ 完成，RC3.1
   定案，見 `docs/contract-schema/README.md`。
2. **Worker 端合約收取** —— ✅ 完成並已部署上線（`submitContract` action，
   `https://jonaminz-backend.ndmc402010104.workers.dev`）。範圍限於
   「收取＋存 pending snapshot」，approve/reject 不在這項裡（見第 3 項）。
   下面原始範圍清單保留供查核，另有兩項 2026-07-11 使用者正式裁決：
   - **Pre-parse request body 大小限制**：已加（`worker.js` 在
     `request.json()` 之前檢查 `Content-Length`，超過門檻直接拒絕），
     跟既有的 post-parse `MAX_CONTRACT_SIZE_CHARS`（針對 `payload.contract`
     字串長度）是兩層獨立防線。
   - **完整 rate limit（依 request 頻率擋濫用）正式裁決為留白**，需要
     Cloudflare KV binding，目前沒有真實外部專案在打這支 API、風險低，
     等真的要接第一個外部專案時再一併做，不是遺漏。

   （以下為原始規劃範圍，供對照）：immutable snapshot 三態（pending/approved/
   rejected）＋ `activeApprovedSnapshotId` ＋ audit table（S13–S14）＋
   S15 全部防線（登記 projectId 過濾、全 URL 欄位同源、rate/size limit、
   canonical JSON content hash、escape）。**開工前所有寫入一律先進
   pending，不得因提交 Contract 自動 approve 或 grant（S13, S16）。**

   **Integration Settings 的 environment-scoped registered origin 資料模型**
   （來自 Contract Schema RC3.1，`docs/contract-schema/README.md` 的
   「Environment Resolution」一節有完整背景）：
   - Contract 不宣告 prod/dev/local；environment context 由接收這次
     ingestion 的 Worker，加上它查到的 Integration Settings 決定。
   - 每個 projectId 在 Integration Settings 裡，每個 environment
    （至少 prod／dev／local）各自登記一個 origin。
   - 解析公式：`目前 Worker 所屬 environment 的 registered origin` ＋
     `Contract 裡的 path-absolute URL` ＝ 完整 URL（例：prod Worker ＋
     prod origin ＋ `/patient-list/` = `https://project.jonaminz.com/patient-list/`；
     dev Worker ＋ dev origin ＋ 同樣的 `/patient-list/` 得到
     `https://dev-project.jonaminz.com/patient-list/`）。
   - Contract 若宣告絕對 `https://` URL，仍要求其 origin 精確等於**目前
     這個 environment** 登記的 origin——**不得**用該 projectId 在其他
     environment（例如 prod）登記的 origin 來滿足這次（例如 dev）的同源
     檢查，那是跨 environment 的來源混淆，等同接受了不該接受的來源。

   **URL 欄位驗證清單**（背景見 `docs/contract-schema/README.md` 的「URL
   驗證」一節：schema 層的 regex 只能做語法粗篩，曾抓到 protocol-relative
   與反斜線正規化兩種繞過，這些都是 regex 的先天局限，真正的邊界要在這裡做）：
   1. 原始字串包含 `\`（反斜線）直接拒絕。
   2. 用 WHATWG `new URL(value, registeredOrigin)` 解析，不要自己重新發明 URL parser；
      `registeredOrigin` 取自上面「目前 environment 登記的 origin」。
   3. 解析後 `protocol` 必須是 `https:`。
   4. 解析後 `origin` 必須精確等於該 projectId 在**目前 environment**登記的 origin。
   5. 禁止 URL 帶 `username`/`password`。
   6. server-side fetch（例如未來去抓 entry 的健康檢查）不可自動跟隨未驗證的
      redirect；每一跳都要重新做上述同源檢查。
   7. 儲存時存正規化後的 URL，audit trail 同時保留原始輸入值。

   也要落實 Contract Schema RC3 README 記下的、schema 本身做不到的 cross-field
   檢查：`entryId` 重複 → `entries` 區段無效（S12）；`objectType` 重複 → `objects`
   區段無效（S12）；`requests`/`requires[].capability` 出現的能力若不在 `supports`
   裡宣告，視為合約自相矛盾（該能力宣告視為無效，不阻擋其餘部分）；
   `capabilities.requires[].entryId` 必須對應到某個 `entries[].entryId`，對不到則
   該筆 requires 無效。
3. **核准後台** —— ✅ 完成並已部署上線（2026-07-11）。pending 清單、
   跟 active 版本的逐 key diff、核准/否決（S14），透過
   `approve_contract_snapshot`／`reject_contract_snapshot` 兩個 Postgres
   function 原子完成狀態切換＋active 指標＋audit log，`/pages/admin/contracts/`
   後台以 Worker secret `JONAMINZ_ADMIN_TOKEN` 保護。核准/否決可互相改判
   （不是終態，S13「永不覆寫歷史」指 audit log 不可竄改，不是 status
   不能再變）；否決時如果那筆正好是目前生效版本，撤回 active 指標。
   細節見 `AI_CONTEXT/CHANGELOG.md` 2026-07-11 條目、`backend/README.md`。
4. **flattened Effective Settings 端點** —— ✅ 完成並已部署上線
   （2026-07-11）。`getEffectiveSettings` action（S38，公開唯讀）算
   S31 公式：沒有 active approved snapshot → `approved:false`、
   `css:"none"`；有的話 → `css = min(Contract 聲明, Settings 授予)`
   （S34，v1 只有 none/tokens 兩級）。範圍刻意收窄：`capabilities`
   固定空陣列佔位（第 6 項才有真實 service 可填），`integration-settings.json`
   新增選填的 `css` 授予欄位＋檔案層級 `revision` 整數（S38 要求回應帶
   版本資訊）。細節見 `AI_CONTEXT/CHANGELOG.md` 2026-07-11 條目、
   `backend/README.md`。
5. **SDK loader ＋ 版本指標** —— ✅ 完成並已部署上線（2026-07-11）。
   範圍刻意跟第 6 項切開：這裡只蓋「運送機制」（loader 找到並載入正確的
   immutable 檔案），不做 S21-23 的 window.Jonaminz.* 骨架／Promise/ready
   語意（那是第 6 項）。`getSdkVersion` action（S37，公開唯讀）回傳某個
   channel（stable/next）目前指向哪個 `sdk/sdk-<hash>.js`；
   `sdk/generate-sdk-release.mjs` 算 sha256 前 12 碼產生 immutable 檔名；
   `sdk/jonaminz-entry.js` 是常青 loader（try/catch 全包、localStorage
   短 TTL 快取＋last-known-good 降級，S24/S37）。放了一個極簡 placeholder
   release（`window.Jonaminz.status="degraded"`）證明「pointer→immutable
   檔案→執行」這條鏈真的通了。**kill-switch 與回滾都已在正式環境實際
   操作過**（改 channel 指標指向 `sdk/sdk-empty.js` 再指回來，headless
   browser 各驗證一次），不是只看程式碼推論。**S39 回滾相容 checklist**：
   `docs/sdk-release-checklist.md`，純文件流程，沒有自動化檢查（S39
   原文允許）。細節見 `AI_CONTEXT/CHANGELOG.md` 2026-07-11 條目、
   `backend/README.md`。
6. **SDK Kernel** —— ✅ 完成並已部署上線（2026-07-12）。取代第 5 項的
   placeholder，`sdk/sdk-src/sdk.js` 真的做 contract discovery
   （S18-20：`data-contract` 覆寫或預設 `/jonaminz.contract.json`，限
   同源）、F5/S8 最小必填客戶端粗篩、推送合約（呼叫 `submitContract`，
   推送失敗不致命——S13/S16）、查 `getEffectiveSettings` 決定
   `ready`/`degraded`（S23/S31）、正確 settle S21 官方 snippet 的
   `ready` Promise（含「Kernel 姍姍來遲、bootstrap 已被 15 秒逾時
   settle 過」的就地更新路徑，S21）。**範圍刻意收窄**：v1 沒有任何
   已正式發布的 service，所以 `window.Jonaminz.*` 這次不掛任何 service
   命名空間（S32 只保障「已發布」service 永久存在，現在一個都沒有）；
   `JonaminzError` 形狀（S27）只在 `SDK_INIT_FAILED` 這唯一的 reject
   情況用到，沒有生一個沒有呼叫端的 constructor；`diagnostics.rollback`
   刻意恆 `false`（沒有 caller 需要這個資訊，見
   `AI_CONTEXT/CHANGELOG.md`）。**銜接第 5 項發現的設計缺口**：S18
   規定 `data-contract` 寫在載入 loader 的 `<script>` 標籤上，但
   Contract Discovery 邏輯屬於 Kernel（loader 動態插入的「另一個」
   `<script>` 標籤，讀不到原始標籤的屬性）——小幅修改
   `sdk/jonaminz-entry.js`（第 5 項已上線的檔案）把 `data-contract`／
   是否來自快取／自己的 release hash 轉貼給 Kernel。**驗證**：對
   jonaminz-movies 真實已上線頁面注入完整 S21 官方 snippet（本機
   loader＋mock `getSdkVersion` 指標指向新 Kernel、真實
   `submitContract`／`getEffectiveSettings`），確認 `ready` 正確
   resolve、diagnostics 正確；另外驗證三條降級路徑（合約 404、
   projectId 未登記、合約缺必填欄位）皆正確 degraded 且零 JS 錯誤。
   細節見 `AI_CONTEXT/CHANGELOG.md` 2026-07-12 條目。
7. **tokens CSS** —— ✅ 完成並已部署上線（2026-07-12）。`sdk/sdk-src/sdk.js`
   新增 `applyTokens()`：`effectiveCss === "tokens"` 時呼叫既有的
   `getThemeCssRules`（不改 Worker、不改 Supabase），只挑 `:root`
   那些列（S35：這才是跨專案共用介面，其他 selector 是 jonaminz 自己
   共用元件的微調，對外部專案沒有意義，不送）；每個變數同時輸出舊名
   （`--color-primary`）與 `--jz-*` 新名（`--jz-primary`，S36 機械式
   轉換：拿掉舊前綴、換 `--jz-`，其餘語意名稱不變，兩者值相同）。
   套用是 fire-and-forget，不 await、不擋 `ready` settle（S23 沒有把
   CSS 套用列進 ready 必要條件，tokens 純視覺、best-effort）；失敗只
   `console.warn`，不影響 `ready`/`degraded` 判定（跟既有
   `theme-runtime.js` 同樣的容錯哲學）。**`theme-runtime.js` 本身這次
   沒動**：它是 jonaminz 自己網站依賴的 v0 機制（任何人貼 script 標籤
   就能拿到外觀，不經 Contract／Settings 審核），RULES.md §4 規定作廢
   需三條件，這次沒有要作廢它——第 7 項是在 Kernel 裡新增一份收編後的
   gated 邏輯，不是重構原檔案。**驗證**：Playwright mock
   `getEffectiveSettings`／`getThemeCssRules`，確認 tokens 正向路徑
   （舊名+新名都輸出、`.card` 這類非 `:root` selector 正確被排除）、
   `css:"none"` 時完全不呼叫 `getThemeCssRules`（gated 真的擋住）、
   `getThemeCssRules` 失敗時 `ready` 仍正確 resolve（不影響核心
   lifecycle）。細節見 `AI_CONTEXT/CHANGELOG.md` 2026-07-12 條目。
8. **smoke app** —— ✅ 完成（2026-07-12，純驗證，無程式碼變更）。沒有
   另外養一個專用假專案——拿 jonaminz-movies（真實、已登記、已核准）
   當宿主頁面，需要製造邊界情況時用 Playwright `page.route()` 竄改
   Worker 回應，其餘打真實 production Worker。下方情境清單（來源：
   ChatGPT Review AR-18）13 項：8 項驗證通過、2 項確認等同於已驗證的
   情境、3 項 v1 範圍內不適用（optional capability／Shell none／舊
   Contract schema 配新 SDK——背後系統還沒做，不是遺漏）。完整逐條紀錄
   見新文件 `docs/platform-integration-v1-acceptance-tests.md`。過程中
   沒發現需要修的 bug，`sdk-src/sdk.js` 沒有變更。
9. **Google OAuth 主站登入**（相鄰工程：v1 只做主站身分識別，S6）—— ✅
   階段 A 完成並經正式環境端到端驗證（2026-07-12）。範圍在討論中擴大
   成三件事（使用者明確要求，細節見 `AI_CONTEXT/CHANGELOG.md` 對應
   日期條目）：內部密語登入＋Google OAuth 兩條路都有、身分要能單向
   傳給 skhpsv2（僅供前端顯示問候語）、整件事做成 jonaminz 可選擇要不
   要開放的 capability（S30-33），不是外部專案硬依賴的東西。分三階段：
   **階段 A**（jonaminz 自己的登入/登出，這次做的）使用者已親自測過
   內部密語登入與 Google OAuth 兩條路都正常運作；**階段 B**（把 identity
   接成正式 `identity.currentUser@1` capability）與**階段 C**（skhpsv2
   正式接入，另一個 repo）尚未開始，排程見下方 SKHPSv2 段落。

**SKHPSv2 正式接入 jonaminz（用 Contract 機制登記成外部專案）是使用者的真實
意圖，但 2026-07-11 明確裁決不急，排在上面第 3–9 項（核心架構）都做完之後**，
當作用真實外部專案驗證整套機制的階段，不要提前排進當前優先序。

## 既有系統技術債（實作期間一併處理）

- `saveThemeCssRules` 目前無任何驗證（`backend/README.md` 自承）——
  OAuth 落地後補「有登入才能寫」。這是既有 bug 修復，與規格無關。
- v0 機制（registry.json 拉模式＋`jonaminz-app.json`＋獨立 theme script）
  作廢條件依 `AI_CONTEXT/RULES.md` §4：SDK 實作完成＋遷移完成＋使用者
  明確宣布 deprecated，三條件全成立才拆。

## Smoke app 固定情境清單（來源：ChatGPT Review AR-18）

- 無 Contract／正常 Contract／無效 Contract
- project disabled／Settings timeout
- optional capability 不存在
- Shell none／Shell tokens
- SDK 重複載入（冪等）／SDK rollback
- Worker 回傳未知欄位／舊 Contract schema 配新 SDK
- （補充）snippet 逾時降級：擋掉 entry.js 後確認 15 秒內 resolve degraded、
  宿主頁面正常（S21/S23/S24）

## 驗收文件

SDK 動工時另立 `platform-integration-v1-acceptance-tests.md`，
把上述情境展開成可勾選的驗收表；本檔屆時只留實作順序。
