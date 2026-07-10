# RULES — 所有 AI agent 必須遵守的專案規則

最後更新：2026-07-10（建檔）
來源標記：〔repo〕＝從程式碼/文件可直接驗證；〔使用者〕＝使用者明確給過的指示；
`NEEDS_CONFIRMATION`＝建檔 agent 推論、尚未經使用者確認。

---

## 一、絕對禁止事項

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

## 二、必須遵守的工作習慣

1. **版本 bump 規則。**〔使用者，2026-07-10 定案〕
   - **要 bump**：任何程式碼、HTML、CSS、JS、設定檔、DB schema 的修改，
     或任何會改變部署行為的變更——push 前更新 `version.js` 的
     version / buildTime / updatedAt 三項，讓使用者能在 footer 肉眼確認上線與否。
   - **不 bump**：純 `AI_CONTEXT/`、`docs/`、README 類文件的修改。
2. **git push 預設不用先問**〔使用者〕，但使用者單次臨時喊停要照辦。
   **`wrangler deploy`（Worker 部署）不適用此預設**〔使用者，2026-07-10 定案〕：
   必須由任務單明確授權，否則部署前先問。git push 與 wrangler deploy
   是兩件獨立的事，push 不會部署 Worker。
3. **OneDrive 陷阱**〔使用者〕：本專案在 OneDrive 同步資料夾內，OneDrive 可能
   回滾本機編輯。大範圍修改完成後，用 grep 總盤點確認所有編輯真的還在。
4. **對話回覆一律用繁體中文。**〔使用者〕
5. **視覺相關修改要實際看畫面驗證**〔使用者〕：數值/邏輯正確不代表沒有視覺副作用，
   改版面/CSS 後要開瀏覽器（`node dev-server.js`）確認。
6. **修改後更新交接文件**：會改變專案狀態的任務，完成後更新
   `AI_CONTEXT/PROJECT_STATE.md` 並在 `AI_CONTEXT/CHANGELOG.md` 追加一筆。
7. **Grep 工具對中文路徑可能靜默失敗**〔使用者〕：在本專案（路徑含「文件/程式碼」）
   搜尋無結果時，先懷疑工具吃不到中文路徑，改用 Bash 的 rg/grep 驗證，
   不要直接斷定「不存在」。
8. **新增頁面照 `pages/README.md` 的五步流程**〔repo〕，bootstrap script 從根目錄
   index.html 原樣複製，只改 `data-jonaminz-page-id` 和內容。

## 三、允許事項

- 在任務單授權的檔案範圍內自由修改。
- 新增檔案：**僅限任務單白名單明確允許新增的路徑或範圍**，且須符合既有結構慣例。
  新增檔案不得成為繞過白名單的手段——白名單沒涵蓋的位置要新增檔案，
  一律先申請（同 TASK_TEMPLATE 第 7 節的衝突處理）。
- 讀取任何非敏感檔案來理解架構。
- 呼叫 Worker 的公開唯讀 action（`getThemeCssRules`、`listExternalAppRegistrations`）
  來查證系統實際狀態。
- 在回報中提出架構建議、指出風險（但不動手）。
- git push（見二之2）。

## 四、已定案事項（原 NEEDS_CONFIRMATION，使用者 2026-07-10 裁決）

- **`wrangler deploy`**：必須由任務單明確授權，否則部署前先問。（已併入 §2-2。）
- **`saveThemeCssRules`**：Auth 落地前，僅限任務單明確要求時才能呼叫寫入；
  其餘情況一律視為禁止。
- **`docs/external-project-manifest.md`（v0 接入機制）**：Platform 規格定稿
  **不會**使其自動作廢。作廢條件是三項全部成立：新 SDK 實作完成、遷移完成、
  且使用者明確宣布 deprecated。在此之前它仍是現行有效機制，不得提前拆除或
  標記作廢。

（目前無待確認項。新的不確定事項出現時在本節新增並標 `NEEDS_CONFIRMATION`，
裁決後改寫為定案條文。）
