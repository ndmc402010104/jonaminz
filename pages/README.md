# 未來頁面

新增頁面時的最小流程（水庫理論精神：頁面只放業務邏輯，共用能力留在根目錄的水庫層）：

1. 在專案根目錄新增資料夾，例如 `pages/about/`，內含該頁自己的 `index.html`（複製根目錄
   `index.html` 的 bootstrap script **原樣貼上**，只改 `data-jonaminz-page-id` 和標題/內容）
   與 `pages/about/assets/js/app.js`。
2. 如果這頁需要專屬視覺設計，新增 `pages/about/assets/css/page-about.css`（CSS 疊加第 7
   層，見根目錄 `README.md` 的「CSS 疊加架構」），只放這頁專屬的樣式，不要去改
   `assets/css/reservoir/` 底下 1-6 層的檔案本體。
3. 在根目錄 `config.json` 的 `pages` 裡新增一個 entry，宣告 `pageId`、`title`、
   `entry.styles`（例如 `["/pages/about/assets/css/page-about.css"]`，沒有專屬樣式可省略）、
   `entry.afterScripts`（例如 `["/pages/about/assets/js/app.js"]`）、`entry.loadingTasks`。
4. 該頁 HTML 依然只直接載入 `/assets/css/jonaminz-loading.css` 與 `/assets/js/entry-core.js`
   ——**一律用網站根目錄絕對路徑（開頭 `/`）**，不要用頁面相對路徑，因為頁面可能巢狀在
   `pages/xxx/` 底下，相對路徑會依資料夾深度跑掉。不要複製 header.js / footer.js /
   reservoir CSS / entry-core.js。
5. 不要新增第二個 config.json 或每頁一個 manifest；所有頁面共用同一份根目錄 `config.json`。

## 目前的頁面

- `pages/admin/` — 後台首頁，先做路線佔位（連到 skhps.jonaminz.com）+ Theme 頁連結
  + Contract 核准連結。
- `pages/admin/theme/` — Theme 頁：CSS 疊加架構的展示櫃（token + 共用元件的活文件），
  未來會擴充成可以拖拉調整顏色/間距的 CSS playground。
- `pages/admin/contracts/` — Contract 核准後台（implementation plan 第 3 項）：
  外部專案推送的 Contract pending 清單、diff 檢視、核准／否決。
- `pages/login/` — 登入頁（implementation plan 第 9 項）：內部密語表單＋Google
  OAuth 連結，支援 `?next=` 登入後導回原頁面。
- `pages/identity-relay/` — 跨子網域身分轉發頁（implementation plan 第 9 項
  階段 B）：不走水庫 bootstrap，供其他 `*.jonaminz.com` 專案的 SDK 透過隱藏
  iframe 查詢「目前登入的是誰」。
- `pages/jonathan/` — Jonathan（石益昇）公開門戶頁，2026-07-13 起改版成
  「Dark Precision 深色精密工作室」（見 `docs/jonathan-page/README.md`）：
  Hero 左右分欄＋純 CSS 合成的抽象「精密展示艙」＋SKHPSv2 registry-driven
  詳細卡。公開頁面，不需要登入。
- `pages/jonathan/about/` — Jonathan About 子頁（2026-07-13 新增）：完整
  自我介紹（醫師身分／數位工具／3D 列印／興趣），跟 `pages/jonathan/`
  共用 `page-jonathan.css` 的導覽/按鈕/配色，只加自己的照片＋文字版型。
- `pages/minz/` — Minz 個人門戶頁，目前是骨架佔位頁（內容留白等本人提供
  簡介文字/照片），版型跟 `pages/jonathan/` 對稱。公開頁面，不需要登入。
- `pages/admin/toolkit/` — 工具包頁（2026-07-15，從「決策圖」候選項目
  挑選實作）：常用開發/發佈連結卡片（local dev 區網測試網址、APK 下載
  連結），純靜態頁面，不呼叫任何 Worker action，所以沒有載入
  `backend-client.js`。

**2026-07-12 起：整個後台（`pages/admin/`、`pages/admin/theme/`、
`pages/admin/contracts/`）都要求登入才能進入**（`window.JonaminzIdentity.requireLogin()`，
見 `assets/js/header.js`），`saveThemeCssRules`／`approveContract`／`rejectContract`
三個寫入動作在 Worker 端也各自要求有效登入 session（`requireSession()`）。
原本的 Worker secret `JONAMINZ_ADMIN_TOKEN` 臨時關卡已經淘汰、完全移除，
不再是保護機制的一部分——這句話取代舊版「approve/reject 是目前唯一有保護
的寫入動作」的說法，那是 2026-07-11 當時（整站登入保護上線前）的舊狀態。
細節見 `backend/README.md`、`AI_CONTEXT/CURRENT_STATE.md`。
