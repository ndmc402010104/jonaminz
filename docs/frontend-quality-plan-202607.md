# 前端品質重建計畫（2026-07-12 規劃，Fable 5 診斷產出）

使用者裁決的三個方向：**①效能重建＋全站布幕式 loading gate**、**②Jonathan
個人門戶頁**、**③後台首頁 Dashboard 化**。建議依此順序做（①是地基，改的是
每一頁共用的載入鏈；②③蓋在新地基上）。每一階段可以直接當一張
`AI_CONTEXT/TASK_TEMPLATE.md` 任務單使用。

---

## 診斷結論（已讀程式碼實錘，實作前不用重新驗證）

首頁慢不是檔案大（全站 CSS 約 12KB、JS 約 30KB），是**往返次數×快取全滅**：

1. **快取被自己殺掉（最大元凶）**：`index.html` 的
   `JONAMINZ_ENTRY_VERSION = String(Date.now())`——每次載入產生新時間戳貼在
   所有資源網址上，瀏覽器快取命中率 0%，回訪跟首訪一樣慢。5 個頁面的
   bootstrap snippet 都是這樣。
2. **約 13 段串行瀑布**：entry-core → version.js → config.json →
   6 層 reservoir CSS **逐一載入**（`entry-core.js` 的 `.reduce` chain）→
   page CSS → theme-runtime.js → theme Worker fetch → header/footer/registry
   （這段才並行）→ app.js → gate 釋放。
3. **theme-runtime 首訪會擋 gate 最多 8 秒**（等 Worker+Supabase 回應，
   而目前 `theme_css_rules` 只有一條 `--color-primary` 規則）。回訪有
   localStorage 快取所以不擋。
4. **loading gate 只是 `visibility:hidden`**（`jonaminz-loading.css` 全部
   內容就 12 行）——使用者整段等待看到的是死白畫面。`data-loading-title`
   屬性早就掛在 `<html>` 上，但從沒做布幕。
5. **`assets/img/home-hero.jpg` 581KB**，且要等 CSS 套用後才被發現開始下載。

**使用者對 gate 的裁決**：不拆，全站都要，但要升級成 **skhpsv2 那種布幕**
（參考 `SKHPS/skhpsv2/assets/css/skhps-loading.css`：載入標題文字＋進度條
（`--skhps-loading-progress` CSS 變數由 JS 驅動、clip-path 圓角 fill）＋
與正式頁面同色系背景＋ready 後 header/footer/main 淡入揭幕）。jonaminz 版
要用自己的視覺語彙（首頁是深色照片簽名版型，布幕底色要跟它同系，避免
亮→暗閃爍；不要照抄 SKHPS 的靛藍紙感配色）。

---

## 階段①：效能重建＋布幕（先做，動水庫本體）

### 目標
回訪幾乎秒開（資源全走快取）；首訪布幕第一幀即出現、約 1 秒內揭幕；
全站 5 頁（home/admin/admin-theme/admin-contracts/login）都換上新布幕。

### 可修改檔案
- `assets/js/entry-core.js`（水庫本體，本任務明確授權）
- `assets/css/jonaminz-loading.css`（布幕重寫）
- `index.html`、`pages/admin/index.html`、`pages/admin/theme/index.html`、
  `pages/admin/contracts/index.html`、`pages/login/index.html`、
  `pages/identity-relay/index.html`（僅 bootstrap snippet 部分；identity-relay
  不走 bootstrap，確認不受影響即可）
- `assets/js/theme-runtime.js`（僅「首訪是否擋 gate」的行為）
- `assets/img/home-hero.jpg`（壓縮）
- `version.js`、`AI_CONTEXT/PROJECT_STATE.md`、`AI_CONTEXT/CHANGELOG.md`（固定允許）

### 作法
1. **快取修復**：`jonaminz-loading.css` 與 `entry-core.js` 改用**靜態
   `<link>`/`<script>` 標籤、不帶 cache buster**（吃 GitHub Pages 原生
   ETag/`max-age=600`，最壞 10 分鐘舊版，可接受；順便消掉 `document.write`）。
   entry-core 之後載入的所有資源改用 **`version.js` 的版本字串**當 buster
   （push 前本來就會 bump 版本，等於部署即失效，回訪全走快取）。
   version.js 本身也不帶 buster（同 ETag 邏輯）。
2. **並行化**：6 層 reservoir CSS＋page CSS 一次全部插入 `<link>`（cascade
   順序＝DOM 順序，與載入完成順序無關，並行安全），`Promise.all` 等完成；
   version.js 與 config.json 並行抓；header/footer/registry-loader 與 CSS
   同時開載（scripts 不依賴 CSS）。單一 CSS 載入失敗照現有 catch 邏輯
   釋放 gate，不可掛死。
3. **theme 不長擋**：回訪（有 localStorage 快取）行為不變；首訪改成
   「theme fetch 與 800ms cap 賽跑」——先到先贏，逾時先揭幕、theme 到了
   再套（接受首訪可能一次輕微變色，目前只有一條規則、風險極低）。
4. **布幕**：重寫 `jonaminz-loading.css` 成 jonaminz 版布幕——
   `html.jonaminz-loading::before` 顯示 `attr(data-loading-title)`＋
   進度條（`--jonaminz-loading-progress` 變數、clip-path fill，參考
   skhpsv2 的最終版 Round Fill Patch v5 做法，歷史 patch 不用搬）；
   entry-core 在每個載入步驟完成時更新變數（簡化版即可，不用移植
   skhpsv2 整套 runway-chase 演算法）；釋放時 main/header/footer 淡入
   （transition 參考 skhpsv2 §3）。首頁布幕底色用深色系配合照片版型。
5. **hero 圖**：壓縮至 ≤250KB（工具自選，如 `npx sharp-cli`；沒有可用
   工具就先跳過壓縮），並在首頁早期注入 `<link rel="preload" as="image">`。

### 驗收
- [ ] DevTools Network：回訪時 reservoir CSS／JS 全部 from cache（或 304）
- [ ] bump version.js 後重新整理，資源網址帶新版號（快取失效機制有效）
- [ ] 首訪（清快取＋清 localStorage）布幕含標題＋進度條立即出現，無死白
- [ ] 全站 5 頁逐頁：布幕→揭幕正常、零 console error、視覺截圖確認
  （治本重構必須實際看畫面，不能只看數值——使用者既有的回饋規則）
- [ ] theme 首訪逾時降級路徑：mock Worker 斷線，頁面仍在 cap 後正常揭幕
- [ ] OneDrive 陷阱：改完隔幾分鐘 grep 總盤點確認檔案沒被回滾

---

## 階段②：Jonathan 個人門戶頁（＋Minz 佔位頁）

### 目標
首頁 piece 02「Jonathan」點下去是真實頁面：個人門戶＝簡介區塊＋自己的
專案入口卡片（**SKHPS 連結從後台搬到這裡**，jonaminz-movies 也放入）。
Minz（piece 01）同步建對稱的骨架佔位頁，內容留白等本人填，連結不再是
死錨點。風格延續首頁簽名式設計。

### 可修改檔案
- 新增 `pages/jonathan/`、`pages/minz/`（照 `pages/README.md` 標準流程：
  index.html 複製 bootstrap、`assets/js/app.js`、`assets/css/page-*.css`）
- `config.json`（登記兩個新頁面）
- `index.html`（nav 與 signature 的 `#jonathan`/`#minz` 錨點改成
  `/pages/jonathan/`、`/pages/minz/`）
- `pages/admin/assets/js/app.js`（移除 SKHPS 連結卡片——搬去 Jonathan 頁）
- `version.js`、AI_CONTEXT 兩份（固定允許）

### 驗收
- [ ] 首頁兩個 name-link 都能進入對應頁面，布幕行為與其他頁一致
- [ ] Jonathan 頁有簡介區塊＋專案卡片（SKHPS、jonaminz-movies），
  卡片外開新分頁
- [ ] 後台首頁不再有 SKHPS 卡片
- [ ] 手機寬度版面正常（截圖確認）

### 待使用者提供（實作時再問，不擋開工）
- Jonathan 簡介文字與照片（先用佔位文＋既有 hero 圖裁切亦可）

---

## 階段③：後台首頁 Dashboard 化

### 目標
`pages/admin/` 從佔位卡片升級成儀表板：登入身分徽章（沿用登入頁
`.jonaminz-identity-badge` 視覺）、pending Contract 數量徽章（點擊進
Contracts 頁）、已登記外部專案與最後回報時間（既有
`listExternalAppRegistrations`）、Theme/Contracts 快速入口。

### 可修改檔案
- `pages/admin/index.html`、`pages/admin/assets/js/app.js`、
  `pages/admin/assets/css/page-admin.css`
- `version.js`、AI_CONTEXT 兩份（固定允許）
- **不動 worker.js**：所需資料 `listPendingContracts`（公開唯讀，回應含
  pending 清單）與 `listExternalAppRegistrations` 都已存在，前端聚合即可

### 驗收
- [ ] pending 數量與 Contracts 頁清單一致；0 筆時顯示「無待審」而非空白
- [ ] Worker 打不通時各卡片顯示錯誤文字，不擋頁面揭幕（背景資訊不進 gate）
- [ ] 登入保護（requireLogin）行為不變

---

## 給實作者的既有規則提醒

- RULES.md 全部適用：改程式碼要 bump `version.js`（**先跑 `date` 查真實
  時間再填**）；Worker 這三階段都不用動、不涉及 `wrangler deploy`；
  完工更新 PROJECT_STATE＋CHANGELOG；回覆用繁體中文。
- 布幕視覺屬「治本重構」等級的改動：完成後必須 Playwright 截圖逐頁
  實際看畫面，不能只驗 DOM 數值。
- 部署授權類問題用 AskUserQuestion 選項式詢問。
