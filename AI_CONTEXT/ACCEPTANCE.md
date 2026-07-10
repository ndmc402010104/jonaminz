# ACCEPTANCE — 通用驗收標準

最後更新：2026-07-10（建檔）
適用：**每一次**修改後都要跑的檢查清單，與任務單第 5 節的任務專屬驗收互補。
驗收方式優先順序：實際開瀏覽器看 > 呼叫 API 驗證 > 讀程式碼推論。
「程式碼看起來對」不算通過。

---

## 1. 功能

- [ ] 任務目標描述的行為，實際操作一遍確認達成。
- [ ] 該功能的失敗路徑至少測一種（後端斷線/空資料/非法輸入），確認有降級行為
      而不是整頁壞掉。

## 2. 畫面

- [ ] `node dev-server.js` 開 http://localhost:5500/ 實際看被改到的每一頁。
- [ ] Loading gate 正常：遮罩會出現也會消失，沒有卡在 loading 不放。
- [ ] 沒被改到的頁面抽查一頁（首頁最低限度），確認共用層（header/footer/CSS）
      沒被波及。
- [ ] 視覺相關修改：手機寬度（DevTools RWD 模式）也要看，不能只看桌面。

## 3. 資料流

- [ ] 有寫入的功能：寫入後用讀取路徑驗證資料真的進去了
      （例：Theme 存檔後呼叫 `getThemeCssRules` 或重開頁面確認）。
- [ ] 有快取的功能（theme-runtime 的 localStorage）：確認新資料會蓋掉舊快取，
      必要時清 localStorage 重測一次。

## 4. 錯誤處理

- [ ] DevTools Console 零 error（warning 要逐條判斷是否本次引入）。
- [ ] Network 面板沒有非預期的 404 / CORS 失敗。
- [ ] 新增的 fetch 都有 catch / 逾時處理，失敗不擋 loading gate、不炸頁面。

## 5. 重新整理後狀態

- [ ] 改完的頁面按 F5：狀態正確重建，不依賴「剛好還在記憶體裡」的東西。
- [ ] 硬重新整理（Ctrl+F5）也試一次：確認 cache-buster 機制下拿到的是新資源。

## 6. 版本一致性

- [ ] 判斷是否要 bump（規則與 RULES.md §2-1 一致）：程式碼、HTML、CSS、JS、
      設定檔、DB schema 或部署行為有變 → **要 bump**；
      純 `AI_CONTEXT/`、`docs/`、README 類文件修改 → **不 bump**。
- [ ] 要 bump 的情況：`version.js` 已更新（version / buildTime / updatedAt
      三個都要動）。
- [ ] footer 顯示的版本 = version.js 的版本。
- [ ] 若改了 Worker：已 `wrangler deploy`，並打一次線上端點確認新行為生效
      （git push 不會部署 Worker）。

## 7. 檔案與 repo 狀態

- [ ] `git status` 比對：實際改動的檔案 = 任務單白名單，沒有意外檔案混入。
- [ ] 沒有任何 secret / 密碼 / token 出現在暫存區（特別留意根目錄密碼檔）。
- [ ] OneDrive 盤點：大範圍修改後，grep 關鍵字串確認所有編輯都還在
      （OneDrive 可能回滾本機編輯）。

## 8. 交接文件

- [ ] 專案狀態有變 → `AI_CONTEXT/PROJECT_STATE.md` 已更新。
- [ ] `AI_CONTEXT/CHANGELOG.md` 已追加本次紀錄。
- [ ] 若發現 AI_CONTEXT 文件與現況不符 → 已修正並在回報中註明。

---

## 快速版（純文件修改適用）

純 Markdown/文件任務只需：7-1（git status 比對）、7-2（無 secret）、8（交接文件）。
純文件修改**不 bump** `version.js`（見 §6 / RULES.md §2-1）。
