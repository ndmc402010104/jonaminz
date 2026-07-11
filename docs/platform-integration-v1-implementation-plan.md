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
5. **SDK loader ＋ 版本指標**（S37：immutable `sdk-<hash>.js`、stable
   指標、kill-switch、per-project channel）＋ **S39 回滾相容 checklist**
6. **SDK Kernel**：官方 snippet 對接（S21–S23）、lifecycle 狀態機、
   錯誤模型（S27–S29）、診斷面（S26）、contract discovery（S18–S20）
7. **tokens CSS**：收編現有 `theme-runtime.js` 邏輯進 SDK；變數名正式化
   為 `--jz-*`，舊無前綴名（`--color-primary` 等）以別名過渡（S36）
8. **smoke app**（見下方情境清單）
9. **Google OAuth 主站登入**（相鄰工程：v1 只做主站身分識別，S6）

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
