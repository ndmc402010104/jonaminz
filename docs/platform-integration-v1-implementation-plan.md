# Platform Integration v1 — Implementation Plan（非規格）

日期：2026-07-10
地位：**工作清單與實作順序，不是規格**。規格是
`platform-integration-spec-v1.md`（唯一權威）；本文可以隨進度改寫，
規格不行。

---

## 實作順序（建議）

1. **Contract JSON Schema ＋ 範本**（依 Spec S7–S12）
2. **Worker 端合約收取**：immutable snapshot 三態（pending/approved/
   rejected）＋ `activeApprovedSnapshotId` ＋ audit table（S13–S14）＋
   S15 全部防線（登記 projectId 過濾、全 URL 欄位同源、rate/size limit、
   canonical JSON content hash、escape）
3. **核准後台**：pending 清單、diff 檢視、核准/否決（S14）
4. **flattened Effective Settings 端點**（S38，外觀 vs 授權分兩類）
5. **SDK loader ＋ 版本指標**（S37：immutable `sdk-<hash>.js`、stable
   指標、kill-switch、per-project channel）＋ **S39 回滾相容 checklist**
6. **SDK Kernel**：官方 snippet 對接（S21–S23）、lifecycle 狀態機、
   錯誤模型（S27–S29）、診斷面（S26）、contract discovery（S18–S20）
7. **tokens CSS**：收編現有 `theme-runtime.js` 邏輯進 SDK；變數名正式化
   為 `--jz-*`，舊無前綴名（`--color-primary` 等）以別名過渡（S36）
8. **smoke app**（見下方情境清單）
9. **Google OAuth 主站登入**（相鄰工程：v1 只做主站身分識別，S6）

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
