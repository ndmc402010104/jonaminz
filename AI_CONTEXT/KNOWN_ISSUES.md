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

## 2. Google OAuth 的 `next`／`returnTo` 沒有完整保留

**現況**：內部密語登入完整支援 `?next=`（登入成功導回原頁面，且做了
開放式重導向防護）。**Google OAuth 這條路沒有把 `next` 一起帶過去**——
`worker.js` 的 `handleGoogleCallback` 固定導回 `resolveOauthReturnOrigin()`
算出來的 origin 根目錄，不是使用者原本想去的頁面。

**影響**：使用者從後台某個深層頁面被踢去登入、選擇用 Google 登入時，
登入完成後會被丟回首頁，不是原本的頁面，需要自己再導航一次。

**風險等級**：低（使用體驗瑕疵，不是安全問題）。

**現況判定**：CHANGELOG 與 implementation plan 皆明確承認這是「已知、
刻意先不修的小缺口」，不是遺漏。

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
- 沒有找到任何自動化測試套件（`package.json` 裡沒有測試腳本），所有
  「已驗證」的證據來源都是 CHANGELOG 描述的一次性 Playwright／curl／
  直連 DB 操作紀錄，不是持續執行的 CI。
