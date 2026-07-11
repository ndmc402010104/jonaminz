# Platform Integration v1 — Acceptance Tests（第 8 項）

日期：2026-07-12
地位：**驗收紀錄，不是規格**。把
`docs/platform-integration-v1-implementation-plan.md` 第 8 項（smoke app）
列出的固定情境清單（來源：ChatGPT Review AR-18）逐條展開、記錄測試方式與
結果。規格是 `platform-integration-spec-v1.md`（唯一權威）。

## 為什麼沒有另外做一個「smoke app」

原始構想是養一個專用的假外部專案來跑這些情境。但第 6、7 項的驗證已經
證明更好的做法：拿 **jonaminz-movies**（真實、已在 Integration Settings
登記、已核准）當宿主頁面，讓真的會成功的呼叫（`submitContract`／
`getEffectiveSettings`／`getThemeCssRules`）照樣打正式環境的 Worker，
只在需要製造邊界情況時用 Playwright 的 `page.route()` 攔截、竄改回應——
不用另外維護一個假專案，也不會影響 jonaminz-movies 的正式資料。

## 情境清單與結果

| # | 情境 | 狀態 | 測試方式／結果 |
|---|---|---|---|
| 1 | 無 Contract | ✅ 已驗證（第 6 項） | `data-contract` 指到不存在的路徑 → `degraded`／`CONTRACT_NOT_FOUND`，零 JS 錯誤 |
| 2 | 正常 Contract | ✅ 已驗證（第 6、7 項） | 對 jonaminz-movies 真實合約完整跑一輪 → `ready`，`diagnostics` 正確 |
| 3 | 無效 Contract | ✅ 已驗證（第 6 項） | 合約缺 `app.title` 等必填欄位 → `degraded`／`CONTRACT_INVALID` |
| 4 | project disabled | ✅ 已驗證（第 6 項，等同 NOT_APPROVED） | v1 沒有獨立的「disabled」旗標——Integration Settings 里一個專案「被停用」在目前實作下就是「沒有 active approved snapshot」，跟情境 #2 的反面是同一條路徑：`getEffectiveSettings` 回 `approved:false` → `degraded`／`NOT_APPROVED`，已在第 6 項測過（含 `PROJECT_NOT_REGISTERED` 這個更早的擋法） |
| 5 | Settings timeout | ✅ 本輪新測 | mock `getEffectiveSettings` 直接斷線（`route.abort()`）→ `degraded`／`NETWORK_ERROR`，零 JS 錯誤 |
| 6 | optional capability 不存在 | ⏸ 不適用（v1 無此系統） | v1 沒有任何已正式發布的 service／capability（S30-32 範圍，見第 6 項規劃的範圍收窄），沒有「optional capability」這個東西可以測。等第一個真實 service 出現才有意義 |
| 7 | Shell none | ⏸ 不適用（v1 無 Shell 系統） | Kernel 目前完全不建任何 UI／Shell（不論 Contract 宣不宣告 `shell:false`，行為都一樣：不掛任何東西），`shell` 欄位目前對 Kernel 沒有可觀察的行為差異，等 Shell 系統實作才有意義區分 |
| 8 | Shell tokens | ✅ 已驗證（第 7 項） | `css:"tokens"` 完整測過正向路徑、gated 不套用、容錯三種情況 |
| 9 | SDK 重複載入（冪等） | ✅ 本輪新測（誠實記錄，非完全冪等） | 同頁面手動再插入一次 loader `<script>`：不會拋錯、不會弄壞已經是 `ready` 的狀態，但**不是嚴格意義的 no-op**——第二次仍會重打一輪 `submitContract`／`getEffectiveSettings`（S22 規定的冪等目前只保證「不覆寫既有 `__snippetVersion` 物件、不炸房子」，沒有做「偵測到已初始化就整個跳過」的優化）。這是可以接受的行為（正常使用下 snippet 只會被貼一次，重複載入是異常情況的容錯，不是效能關鍵路徑），但如果之後真的需要嚴格 no-op，需要另外加一個 init 旗標判斷 |
| 10 | SDK rollback | ✅ 本輪新測 | mock `getSdkVersion` 指回第 6 項的舊 Kernel（hash `0c9953079f7a`，沒有 tokens 邏輯）、其餘打真實 Worker → 一樣正確 resolve `ready`，證明舊 release 對現在的資料形狀仍相容（S39 的核心關切：回滾目標要能處理目前的資料） |
| 11 | Worker 回傳未知欄位 | ✅ 本輪新測 | mock `getEffectiveSettings` 回應夾帶額外未知欄位（`futureField`、`anotherNewThing`）→ Kernel 正常忽略、`ready` 正確 resolve，零 JS 錯誤（must-ignore 前向相容） |
| 12 | 舊 Contract schema 配新 SDK | ⏸ 不適用（目前只有一個 schema 版本） | `contractVersion` 目前只發布過 `1`，沒有第二個版本可以測「新 SDK 認不認得舊 schema」。等 Contract schema 真的出新版本時，要照 `docs/sdk-release-checklist.md` 的兩階段流程走，屆時要補這項驗證 |
| 13 | snippet 逾時降級 | ✅ 本輪新測（等效路徑） | mock loader 腳本本身載入失敗（`route.abort()`）→ 官方 snippet 自己的 `onerror` 處理常式觸發 `settle("degraded","SDK_LOAD_FAILED")`，零 JS 錯誤，宿主頁面不受影響。這是 S21 兩條降級路徑（onerror／15 秒逾時）共用同一個 `settle()` 機制，onerror 這條測到即代表整個機制是通的，不需要真的等滿 15 秒去測純逾時那條 |

## 結論

13 項情境：**8 項已驗證通過**，**2 項確認等同於已驗證的情境**（#4 等同
#2 的反面路徑），**3 項目前 v1 範圍內不適用**（#6/#7/#12，背後系統
本來就還沒做，不是測試遺漏）。過程中沒有發現需要修的 bug——`sdk-src/sdk.js`
這次沒有變更，`sdk-versions.json` 維持上一輪（第 7 項）的 hash
`c0d679686951`，不需要重新部署。

**唯一一個誠實記錄下來、值得未來注意的行為**：SDK 重複載入不是嚴格
no-op（見上表 #9），目前判定這是可接受的（不會出錯、不會弄壞狀態，只是
會重打一次不必要的網路請求），如果之後有真實案例受這個影響，再回頭加
init 旗標判斷。
