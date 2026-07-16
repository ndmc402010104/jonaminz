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
   - **時間戳一定要查真的系統時間，不能用猜的**〔使用者，2026-07-12 定案，
     見 CHANGELOG 同日「修正 version.js 的錯誤時間戳」條目〕：agent 拿得到
     的系統資訊只有日期，沒有現在幾點，寫 `buildTime`／`updatedAt` 這類
     精確到分鐘的欄位前，必須先實際執行查時間指令（Bash `date` 或
     PowerShell `Get-Date`）取得真實時間再填入，不能憑印象猜一個「看起來
     合理」的時間——過去已發生多次猜出來的時間跟實際 commit 時間差好幾
     小時的錯誤。
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
   **這份文件是累積性知識庫，要讓它一直長大，不是寫完這輪就算了**
   〔使用者，2026-07-15 定案〕：除了記錄「做了什麼」，**只要有需要使用者
   自己動手的步驟（手動 Portal 操作、重新授權、實機測試等），都要明確寫進
   CHANGELOG 的「遺留」欄位，不能只在對話裡口頭提一句就算數**——下一輪
   （甚至換一個 agent）要能單靠讀這份文件就知道「現在卡在使用者身上的
   是什麼」，不能依賴聊天記錄。
   **同一份精神也適用於「決策與待辦」頁**〔使用者，2026-07-15 定案，
   這條被使用者連續多次當面糾正過措辭，以下是最終版，不要再簡化〕：
   **每一次回覆（不是每個大任務、不是每個階段性段落——是每一次對話
   來回）都要查一次 `project_tasks` 現況（尤其 `for_claude` 泳道，
   使用者隨時可能透過「›」轉送或直接新增留下新的回報/請求），跟看一眼
   `DECISION_TIMELINE`／`DECISION_MAP` 這兩個陣列**。查 `for_claude`
   是為了不漏接使用者剛留下的東西（這條規則第一次寫的時候用「任務
   開始前跟結束後」這種措辭太模糊，被使用者指出「表示你沒有照我說的
   寫指令」，這裡直接寫死「每一次回覆」，不要再改鬆）；看
   `DECISION_TIMELINE`／`DECISION_MAP` 是為了：這次回覆如果做了「有
   取捨、值得記住為什麼這樣決定」的重大決策，就手動加一筆（格式比照
   既有條目：情境／考慮的選項／決定與理由／現況），兩個陣列各自的
   `_UPDATED_AT` 常數也要跟著更新。這條被使用者當面抓到超過一次——
   連續做完好幾輪明顯夠格的決策只寫了 CHANGELOG 沒碰這兩個陣列；後來
   即使已經在看 `for_claude`，也曾經看過一次之後就被後續的其他訊息
   帶走注意力，沒有真的回頭處理裡面回報的問題，直到使用者第二次、
   第三次追問才處理——**看過一次不代表這輪就不用再看，只要使用者還在
   追問同一件事，就要先處理完那件事，不要被中途插進來的新訊息帶偏**
   。不是每個小修都要加時間軸/決策圖條目，只有真正的決策；但查看
   `for_claude` 現況本身沒有「值不值得」的門檻，每次都要查。
8. **Grep 工具對中文路徑可能靜默失敗**〔使用者〕：在本專案（路徑含「文件/程式碼」）
   搜尋無結果時，先懷疑工具吃不到中文路徑，改用 Bash 的 rg/grep 驗證，
   不要直接斷定「不存在」。
   **同一台機器上還有一個相關陷阱**〔2026-07-15 實測抓到〕：Bash 裡
   用 `curl -d '{"text":"中文..."}'` 這種把中文字直接當 command-line
   argument 傳給 `curl.exe`（原生 Windows binary）的寫法，中文字元會
   在 argv 編碼轉換時被壞掉（byte 數變少，存進 DB 是亂碼，不是單純
   顯示問題——已用 `--trace-ascii` 的 byte 數比對證實）。**POST body
   裡帶中文字時，一律先用 Write 工具或 heredoc 寫進暫存 JSON 檔，
   再用 `curl -d @檔案路徑`**，不要把中文字直接寫在 inline 的
   `-d '...'` 裡；純 ASCII 內容（token、id 之類）不受影響可以繼續
   inline。
9. **新增頁面照 `pages/README.md` 的五步流程**〔repo〕，bootstrap script 從根目錄
   index.html 原樣複製，只改 `data-jonaminz-page-id` 和內容。
10. **待辦板「你想叫我做的」項目修完，不能自己標記完成**〔使用者，
    2026-07-15 定案，當面糾正過一次〕：agent 修好 `for_claude` 泳道
    裡使用者交辦的一筆之後，正確做法是呼叫 `moveProjectTaskLane`
    把它移回 `for_user`（`done` 維持 `false`，text 可以改寫成
    「請驗證：...」），由使用者自己實測後親手打勾——**不能**呼叫
    `toggleProjectTask` 自己標記完成。已經做完不代表已經驗證過，
    「真的測過沒問題」這件事只有使用者自己能確認。細節見
    `pages/admin/journal/assets/js/app.js` 待辦看板區塊的程式碼註解。
    **同一動作還要記得把 `origin` 一起改成 `'claude'`**〔使用者，
    2026-07-15 同日再次當面糾正〕：這筆項目原本可能是使用者自己輸入
    的（`origin='user'`，例如從決策圖點「加入」的候選項目），但一旦
    agent 把它改寫成「請驗證：...」搬回 `for_user`，**這段文字的作者
    現在是 agent**（agent 在報告「我做完了，請驗證」），origin 判斷的
    是「這段內容現在該由誰負責、能不能刪除」，不是「這一列最初是誰
    建立的」——沒有一起改會讓這種項目錯誤顯示 ✕ 刪除按鈕（使用者當場
    抓到過一次：兩筆從決策圖加入、agent 做完搬回來驗證的項目都還留著
    `origin='user'`，畫面上出現了不該有的 ✕）。
11. **新 build 好的 APK 一律走 OneDrive `/appDownload`，禁止用聊天介面
    直接傳檔案給使用者。**〔使用者，2026-07-16 定案，當面糾正過一次〕
    使用者手機上**沒有辦法**點擊 Claude Code 聊天介面裡「送檔案」
    （`SendUserFile` 類工具）跳出的下載按鈕完成安裝，這不是次要選項、
    是硬規定。正確流程永遠是 `node tools/upload-apk.mjs <APK路徑>
    <token>`，讓 `/appDownload` 這個固定網址（工具包頁面
    `pages/admin/toolkit/` 上的連結）指向新版——使用者永遠從同一個
    地方下載，不用每次跟 agent 要新連結/新檔案。
    **`<token>` 拿法（2026-07-16 同日再改進，見下一條 §2-12）**：
    優先用 `pages/admin/secrets/`「Agent 密鑰保管箱」小節裡使用者自己存進去
    的專用密鑰（`agent_secrets` 表，`name='apk_upload_token'` 那筆）
    ——agent 不能直接查 Supabase `sessions` 表撈現成使用者登入 token 來用
    （Auto Mode 的安全分類器會擋下、判定為未授權讓真實登入憑證出現在
    對話紀錄裡，這個擋是對的，不要嘗試繞過），也不能自己 INSERT 一筆
    新 session 冒充登入（等同繞過同一個限制的精神）。**只有在專用鑰匙
    還沒設定或已經失效、使用者也不想現在去產生的情況下**，才退回舊
    方式：等使用者在自己電腦上親自執行這支腳本，或請使用者提供個人
    session token（手機上沒有 devtools，可以請使用者把這段存成瀏覽器
    書籤點開取值：
    `javascript:prompt('token',localStorage.getItem('jonaminz.sessionToken'))`）。
12. **`agent_secrets` 表是給「所有」agent 用的通用密鑰保管箱，不是
    只給 APK 上傳用，存在一般資料表、不是 Worker secret，這是刻意的
    取捨，不要「改成更安全」搬去 `wrangler secret put`。**〔使用者，
    2026-07-16 定案，同日內改版兩次〕第一版是 Worker 自動產生單一把
    APK 專用鑰匙、只能看一次不能讀回，使用者當面回饋不是他要的——
    他要的是「像 Cloudflare secret api 儲存那種模式」，而且**範圍
    比 APK 上傳大很多**：使用者原話「我不是有很多 supabase cloudflare
    需要的 api 嗎？是不是弄一個地方存進去讓你可以取用，但是又不會
    卡到其他 agent 不能用、每次要設定」——這張表是給**任何**需要
    重複用到的憑證（Supabase Management API token、Cloudflare API
    token 等）存放的地方，`apk_upload_token` 只是第一個放進去的項目，
    不是這張表唯一的用途。任何 agent（Claude／Codex／其他 CLI
    工具）只要讀過這份文件、有 Supabase 存取權，就能用同一個地方，
    不會綁死在單一 agent 或需要每個新 session 重新設定一次。使用者
    自己在後台（`pages/admin/secrets/`「Agent 密鑰保管箱」小節）輸入
    「名稱／值」新增，需要換的時候自己上去改，不是 Worker 自動產生。
    `listAgentSecrets`／`setAgentSecret`／`deleteAgentSecret` 三支只給
    已登入的人管理清單本身（新增/刪除/看名稱與更新時間），**都不把
    value 吐回前端**——真正讀 value 只有兩條路：Worker 內部程式碼
    直接查表（例如 `createApkUploadSession` 透過
    `requireSessionOrAgentToken()` 比對 `name='apk_upload_token'`
    那筆——這是目前唯一真的接進 Worker 邏輯的名稱，其他憑證存進去
    暫時只能供 agent 在對話中查表使用，還沒有對應的 Worker 端消費
    邏輯），或 agent 在對話中用 Supabase 工具直接查表。不要加一個
    「回傳 value 給前端」的 action，那樣就失去「像 Cloudflare 一樣
    能覆蓋、不能讀回」這個使用者要的體感。外流最壞情況是這張表裡的
    憑證被讀到（哪些憑證存進去、外流影響多大，是使用者自己決定要放
    什麼進來的責任），不是帳號被接管——威脅模型上可以接受存在一般
    資料表裡，跟其他一律「登入＝完全信任」的既有設計一致。

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
