# EXPERIMENTS — 尚未裁決的方向

這份文件放「有人提過、值得考慮，但使用者還沒拍板」的技術選型。
**不要把這裡的內容當成 `DECISIONS.md`**——這些都是選項，不是已定案的
方向；也不要當成 `FACTS.md`——這些都還沒有對應的程式碼。

---

## 1. Session 憑證是否改用 HttpOnly Cookie

**現況**：`localStorage` bearer token（見 `CURRENT_STATE.md`／`KNOWN_ISSUES.md` #1）。

**如果要改**：前提是先解決 `jonaminz.com` DNS 掛在 Squarespace、Worker
無法對 `.jonaminz.com` 設跨子網域 Cookie 的限制（見下一條）。即使 DNS
問題解決，也要考慮：
- 第三方 Cookie 在現代瀏覽器（Safari/Chrome 的分區政策）已經接近死亡，
  跨 origin 的 `fetch(worker, {credentials:"include"})` 行為在不同瀏覽器
  下可能不一致——這個顧慮在 `docs/platform-integration-reviews/review-claude-fable.md`
  第38行已有人提出。
- 改 Cookie 需要同時處理 CSRF 防護（目前 bearer token 模式天然不受
  CSRF 影響，因為 token 不會被瀏覽器自動附加）。

**未拍板**。

---

## 2. 是否使用 `auth.jonaminz.com` 或 `api.jonaminz.com` 獨立網域

**現況**：Worker 目前用 Cloudflare 預設的 `jonaminz-backend.ndmc402010104.workers.dev`
網域，前端網站用 `www.jonaminz.com`（GitHub Pages，CNAME）。兩者不同源。

**如果要改**：需要把 `jonaminz.com` 的 DNS（目前在 Squarespace）搬到
Cloudflare，才能讓 Worker 掛自訂網域、以及讓 Cookie 的 `Domain=.jonaminz.com`
生效。這是一個會牽動 DNS、可能影響現有 GitHub Pages CNAME 設定的較大
變更，本次盤點沒有看到任何時程規劃。

**未拍板**。`PROJECT_STATE.md` §7 UNKNOWN 清單有一條提到「apex 301
轉址至 www」被視為平台基礎設施合約的一部分，動 DNS 前要意識到 SDK
常青網址（`https://jonaminz.com/sdk/...`）依賴這條轉址，屬於同一類
需要謹慎處理的變更。

---

## 3. 跨 App SSO 的最終作法

**現況**：`pages/identity-relay/` 的 iframe + postMessage 單向查詢模式
（見 `CURRENT_STATE.md`）。

**可能方向**（本次盤點沒有找到任何文件對這幾個選項做過比較或拍板）：
- 維持現有 iframe + postMessage 模式，擴充成雙向（外部 App 也能觸發
  jonaminz 端登出）。
- 等 DNS 搬到 Cloudflare 後，改用 Cookie-based SSO（`Domain=.jonaminz.com`）。
- 每個外部 App 各自維護自己的登入態，只在需要顯示身分時才問 jonaminz
  （目前的做法），不追求真正的「單一登入態」。

**未拍板**。

---

## 4. `returnTo` token／state 的最終格式

**現況**：站內 `?next=` 只接受同源相對路徑字串（見 `FACTS.md` #30）。
跨 App 的 `returnTo`（例如從 skhpsv2 導來 jonaminz 登入，登入完要準確
導回 skhpsv2 的某個頁面）完全沒有實作，也沒看到文件討論過要用什麼格式
（純 URL？簽章過的 state token？跟 OAuth 的 `state` 參數共用機制？）。

**未拍板**。

---

## 5. Session rotation、裝置管理、全部裝置登出

**現況**：`sessions` 表目前是扁平的 token→identity 對應，沒有任何裝置
指紋、User-Agent 記錄、或「列出我目前登入的裝置」功能。登出目前只能
刪除呼叫端自己帶著的那一顆 token（單一裝置登出），沒有「登出所有裝置」
的 action。

**未拍板**，也沒有看到任何文件提出這個需求——本次盤點是依照任務指示
的必查清單主動列出這個選項，不是從現有文件挖出來的既有討論。

---

## 6. Objects 內容 schema（跨 App 資料關聯）

**現況**：Contract schema 的 `objects[]` 陣列信封已定（每項必有
`objectType` + `objectId`），但具體內容 schema（Photo/Trip 等）留白，
`docs/platform-integration-consensus.md` 第五節明文列為「保留層：本次
不定案」。

**未拍板**，等第一個真實案例出現才會設計。

---

## 7. 各 Platform Service 的 API 簽名（search、pin、relationship、
   notification、analytics、ai、calendar、file、profile、sharedCache、health）

**現況**：這 11 個名字已在規格 F11/S30 凍結為永久 ID（只能新增不能改名），
但除了 `identity`（`identity.currentUser@1`，已實作）以外，**其餘全部
沒有任何實作，也沒有 API 簽名設計**。`docs/platform-integration-consensus.md`
明文「參數與回傳格式等第一個真實 caller 出現才定」。

**未拍板**，不要在没有真實 caller 前預先設計簽名。

---

## 8. Chat／AI participant framework 的技術選型

**現況**：完全沒有實作，也沒有找到任何文件討論過要用什麼技術（前端
框架？訊息儲存在哪張表？即時通訊用什麼機制？AI provider 怎麼切換？）。

**未拍板**。這是 `DECISIONS.md` 裡「Chat 屬於 Core」這條方向性裁決底下
最大的一塊空白，下一個要動這塊的人需要重新開規劃討論，不能假設本次
盤點找到任何既有設計。
