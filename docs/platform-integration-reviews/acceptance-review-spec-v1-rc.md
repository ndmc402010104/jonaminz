<!--
來源：使用者轉交（驗收階段 review，產生者未標明）
收件日：2026-07-10
對象：docs/platform-integration-spec-v1.md（RC 第一版）
判定：RC 合格，Frozen 暫緩——七項架構級修正＋數項文字級修正。
處置：全數採納，已修入 spec-v1 RC2（同日）。逐項對照見文末處置表。
-->

# Spec v1.0 RC 驗收 Review（原文照錄）

## Frozen 前必須修正

### 1. S21 的 Promise 無法實現 S23 的 reject

嚴重度：架構級，最大問題

S21 目前只保存了 resolveReady：

```
ready: new Promise(function (resolve) { resolveReady = resolve; })
```

但 S23 又規定：SDK 自身不可恢復錯誤時，reject SDK_INIT_FAILED。
現在根本沒有保存 reject，所以實作無法遵守 S23。

更大的問題是：假如 jonaminz-entry.js 被網路、CSP、DNS 或 404 擋住，
SDK 根本沒有開始執行，ready 就會永久 pending，直接違反 S23 的
「永不永久 pending」與 S24 的失敗降級規則。

必須調整：官方 bootstrap 至少要具備——保存 resolveReady、保存
rejectReady、loader 的 error handling、有界限的初始化 timeout、
loader 本身無法載入時 settle 成 degraded 而不是永遠 pending、
settle 後清除內部 resolve/reject reference。

另外，__resolveReady 直接掛在公開 namespace 上也略粗糙；至少應放進
明確的內部 bootstrap 區（例如 Jonaminz.__bootstrap），完成後刪除。

這一條修好前，S21 不能標「原文凍結」。

### 2. S13 說兩態，S14 卻實際出現三態以上

S13 定義 observed / approved，但 S14 又寫「新版進 pending」，未來還
一定會有 rejected 或 superseded。資料模型不清楚：observed 是狀態？
pending 是 observed 的子狀態？舊 approved 被取代後叫什麼？

建議固定成：Contract snapshot 有 pending / approved / rejected 三態，
另有 activeApprovedSnapshotId。observed 是「平台曾觀察到這份內容」的
事實，不是 workflow status。每次推送都是 immutable snapshot，核准只改
狀態及 active pointer，不覆寫歷史。Audit trail 至少保留：projectId、
previous hash、new hash、action、actor、timestamp、optional note。
一張 Supabase table 就夠。

### 3. S31 必須明寫使用「approved Contract」

公式沒說 Contract 是哪一份。假設 Settings 裡還留著某能力的 grant，
偽造者推送一份聲稱支援該能力的 Contract；如果 Worker 用 observed/
current Contract 計算，就可能把 stale grant 重新啟用。

必須改成 `Effective = Approved Contract supports ∩ Settings grant ∩
Runtime availability ∩ Actor permission`。沒有 approved Contract 時：
不啟用任何能力、不掛 Shell、可以完成 observed push、SDK resolve 為
degraded 或 unapproved、宿主頁面照常運作。而且不只 Shell 與 Search
讀 approved；所有平台整合行為都必須以 approved snapshot 為準。

### 4. S38 的 stale Settings 與 S31/S33 有衝突

cached Settings 不能不加區分地恢復 capability grants / permissions /
enabled operations。建議拆開：可離線使用的 stale 設定 = CSS tokens、
Theme、placement、navigation 呈現、非敏感 UI 設定；Worker 不可用時
一律失效 = effective capability grants、actor permission、write
permission、個人化資料能力、任何 API authorization。
Worker 不可用時可以保留外觀，但 Platform API 的 runtime availability
應視為 false。

### 5. S32 與「Service 名稱尚未發布」互相矛盾

S32 寫 service namespace 永遠掛在 API 物件上，但保留層又說名字只是
roadmap。改成：已正式發布的 service namespace 一旦發布便永久存在、
不論是否 grant 都不能變成 undefined；尚未正式發布的 reserved roadmap
名稱不保證存在。

### 6. S5 把 URL template 凍得太早，但沒有定義語法

placeholder 寫法、encode、特殊字元、path/query、absolute/same-origin、
缺 objectId、template version 全都沒定義。S4 的複合 key 很穩可以現在凍；
URL template 還沒有真實 caller，現在凍違反「等真實需求再定義」哲學。
建議保留 S2–S4 Frozen，把 S5 的 resolver 移到保留層。

### 7. Contract 新版本與 SDK 回滾的關係還沒定義

舊 SDK 不一定讀得懂新版 Contract：某 app 核准並使用 Contract v2 後，
SDK 回滾到只支援 v1 的 release，就可能無法載入。建議加規則：stable
SDK 的 rollback target 必須支援所有目前 active approved Contract
versions；新 schema 兩階段發布。只需要發布 checklist，但規則必須先寫清楚。

## 建議級修正

- retriable → **retryable**（生態慣例）。
- content hash 要說清楚：根據解析後、正規化的 JSON 內容計算，
  而非原始檔案 bytes（換行/縮排/key 順序不觸發重新核准）。
- S15 應涵蓋**所有** URL 欄位（icon、resolver、health、callback…），
  不要只檢查 entry URL。
- S7 與 S18 用語統一：預設為目前 origin 根目錄；subpath 專案必須用
  data-contract；不要再用模糊的「部署根路徑」。
- 明定 `ready` resolve 的物件恆等於 `window.Jonaminz`（單一狀態來源）。
- 實作範圍混入不屬於規格的工作（Google OAuth、saveThemeCssRules bug）：
  拆成 spec / implementation-plan / acceptance-tests 三份文件，
  避免權威規格變成工作清單。

## 可以直接保留（不建議再動）

S1、S3–S4、S9、S10、S11–S12、S17、S18–S20、S27–S29、S30、S33、
S34–S36、S37、S38（拆類後）——已構成扎實的十年地基。

## 最終判定

RC 合格，Frozen 暫緩。不是架構方向錯，而是規格內有幾個「寫了卻無法
同時實現」的地方。修正後即可正式 Frozen，接著進 JSON Schema、Settings
Schema、Protocol envelope、SDK Kernel 和 smoke app；不需要再開第六輪
大型 Architecture Review。

---

## 處置表（修入 RC2 的對照）

| 修正項 | RC2 落點 |
|---|---|
| 1 bootstrap | S21 snippet 全面重寫（resolve+reject、onerror、15s timeout、settle 即刪 `__bootstrap`、jz === window.Jonaminz、遲到 SDK 更新同一物件）；S23 同步改寫 |
| 2 snapshot 三態 | S13 改為 immutable snapshot ＋ pending/approved/rejected ＋ activeApprovedSnapshotId；audit 欄位入 S14 |
| 3 approved 計算 | S31 明寫 Approved Contract、無 approved 的行為；S13 擴大為「所有平台整合行為」 |
| 4 stale 拆類 | S38 分「可 stale 的外觀」與「Worker 不可用即失效的授權」 |
| 5 已發布限定 | S32 加「只適用已正式發布的 service；reserved 不保證存在」 |
| 6 URL template | S5 resolver 移入保留層，信封留 S2–S4 |
| 7 回滾相容 | 新增 S39（rollback target 必須支援所有 active approved schema 版本＋兩階段發布） |
| retryable | S27 改字 |
| canonical hash | S14 明寫 |
| 全 URL 欄位 | S15 擴寫 |
| S7/S18 用語 | S7 改寫 |
| ready 物件恆等 | S21 凍結語意明列 |
| 文件拆分 | 第五部分改為規範性範圍；工作清單移至 `platform-integration-v1-implementation-plan.md` |
