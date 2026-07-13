# KNOWN_ISSUES — 已知問題與風險

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
  的寫入動作（Worker secret `JONAMINZ_ADMIN_TOKEN` 臨時關卡）」——這是
  2026-07-11 當時的狀態，2026-07-12 整站登入保護上線、`JONAMINZ_ADMIN_TOKEN`
  淘汰後已經過期，本次盤點已修正。
- 根目錄 `README.md` 的檔案結構圖只列到 `pages/admin/theme/`，沒有提到
  `pages/admin/contracts/`、`pages/login/`、`pages/identity-relay/`、
  `sdk/` 資料夾——這是 README 建立時（Platform Integration／Auth 工作
  之前）的版本沒有跟上後續擴充，本次盤點已補充。
- `docs/platform-integration-consensus.md` 等五份 Platform Integration
  規劃期文件（`spec-review.md`／`review-request.md`／
  `review-consolidation.md`／`reviews/*.md`）内容已被 Frozen 的
  `platform-integration-spec-v1.md` 吸收取代，原本沒有標示「已被取代」，
  本次盤點已加註 Historical/Superseded 狀態標記。

**風險等級**：純文件風險（會誤導未讀程式碼就直接引用文件的下一個
agent），本次盤點已處理，見 `SESSION_LOG.md` 與 `DOCUMENT_STATUS.md`。

---

## 8. 這次盤點沒有覆蓋、需要持續留意的地方

- 本次盤點沒有重新對正式環境發出網路請求驗證（沒有重跑 curl／
  `wrangler deploy`），「已部署」「已人工驗證」的判定全部來自
  `AI_CONTEXT/CHANGELOG.md` 既有紀錄的交叉核對，不是本次盤點自己產生
  的新證據。如果 CHANGELOG 記錯了，這次盤點會原樣繼承那個錯誤——下一
  個真正動手改程式碼的 agent 仍應該在改動前用 `wrangler secret list`／
  curl 等唯讀方式重新確認關鍵狀態，不要純信文件。
- 主站（`assets/`／`pages/`／`backend/`）本身沒有自動化測試套件（根目錄
  沒有 `package.json`），所有「已驗證」的證據來源都是 CHANGELOG 描述的
  一次性 Playwright／curl／直連 DB 操作紀錄，不是持續執行的 CI。**例外
  （2026-07-13 新增）**：`tools/project-memory/`（跨 session 記憶
  工具，見 `CURRENT_STATE.md` §五）有獨立的 `node --test` 套件（14 項，
  `tools/project-memory/test/memory.test.mjs`），但那是這個工具自己的
  測試，不是主站功能的測試，不要混為一談。

---

## 9. Project Memory 工具的已知限制（2026-07-13，工具本身刻意的範圍限制）

**現況**：`tools/project-memory/` 的 v0.1 版本有兩個刻意不處理的限制，
見 `tools/project-memory/README.md`「已知限制」一節：

1. 這個 repo 既有的 `DECISIONS.md`／`FACTS.md` 是自由文字記述格式，
   不是工具偏好的 `## DEC-NNN` + `- Status: active` 結構化格式。
   `CONTEXT_PACK.md` 的 Active Decisions 區塊目前掃不到任何結構化
   條目，會明確標註「改用文字截取」並退回確定性截斷顯示——內容仍然
   完整可讀，只是不是精準過濾出的清單，需要人自己看內文判斷哪些還
   active。
2. 沒有多 agent 併發鎖定：兩個 agent 同時對同一個 repo 跑
   `memory.mjs` 可能互相覆蓋 `.project-memory/current-session.json`。

**風險等級**：低——這兩點都是 v0.1 任務指示明文排除的範圍（「小型、
確定性、可人工審核」的工具，不做多 agent 即時鎖定），不是遺漏，工具
本身的 `check` 指令也不會誤報這兩點為錯誤。

---

## 10. `.jonaminz-admin-hero`／`.jonaminz-admin-title` 這組 class 名稱在
    admin 子頁之間看起來共用，實際上沒有共用樣式（2026-07-13 盤點發現）

**現況**：`pages/admin/contracts/index.html`／`pages/admin/theme/index.html`
的 hero 標題區塊沿用了 `pages/admin/index.html`（後台首頁）當初定義的
`.jonaminz-admin-hero`／`.jonaminz-admin-title` class 名稱，但這兩份
CSS 屬性只存在 `pages/admin/assets/css/page-admin.css`——依 `config.json`
的 `entry.styles` 設定，這份檔案**只有 pageId `admin` 會載到**，
contracts／theme 頁面完全沒有對應的 CSS 規則。跟
`pages/admin/contracts/assets/css/page-admin-contracts.css` 檔頭註解
描述的「`.jonaminz-theme-toolbar`／`.jonaminz-theme-section` 必須在
每個會用到的頁面各自重複定義一份」是同一種陷阱，但那次有被抓到並修
（複製一份定義過去），這次的 `.jonaminz-admin-hero`／`.jonaminz-admin-title`
沒有——contracts／theme 頁面上的這個標題區塊實際上只吃到全站
`03-base.css` 給 h1 的預設字體規則，沒有卡片背景／漸層文字效果。

**影響**：視覺上不算破版（純文字標題本身還算好讀），但跟原始設計意圖
（漸層文字大標）不一致，且 2026-07-13 後台首頁改版時
`pages/admin/assets/css/page-admin.css` 已整份重寫、拿掉了
`.jonaminz-admin-hero`／`.jonaminz-admin-title` 的定義（改用新版
`.jonaminz-admin-welcome`／`.jonaminz-admin-greeting`），這兩個 class
名稱現在對 contracts／theme／design 頁面來說更是徹底找不到任何來源
定義了（本來就沒真的共用到，拿掉舊定義沒有讓情況變得更差）。

**風險等級**：低，純樣式一致性問題，不影響功能。下一個要動 contracts／
theme／design 頁面標題視覺的人，如果想要漸層大標效果，需要在對應的
`page-admin-contracts.css`／`page-admin-theme.css`／
`page-admin-design.css` 各自補一份定義，不能假設 class 名稱一樣就會
自動套用。
