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

## 階段①：效能重建＋布幕（先做，動水庫本體）✅ 完成並已上線（2026-07-12）

實際落地：`assets/js/entry-core.js`（快取修復＋並行載入＋讀條引擎）、
`assets/css/jonaminz-loading.css`（布幕重寫）、`assets/img/home-hero.jpg`
（壓縮）、五頁 bootstrap script（首頁／admin／admin-theme／
admin-contracts／login）。驗收方式與截圖驗證紀錄見
`AI_CONTEXT/CHANGELOG.md` 2026-07-12「前端品質重建計畫階段①」條目。
下面的「作法」與「驗收」清單維持原樣（規劃時的設計依據），實際實作與
規劃有兩處差異：讀條動畫後來（同日）另外用 `docs/roadmap-202607.md`
順序②的「Runway Chase」演算法整個取代了這裡設想的「簡化版」寫法，
細節見 CHANGELOG 對應條目，不是本計畫文件本身要追記的範圍。

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

## 階段②：Jonathan 個人門戶頁（＋Minz 佔位頁）✅ 完成（2026-07-12，已驗證）

見 `AI_CONTEXT/CHANGELOG.md` 同日「待辦總表順序⑥」條目。

### 目標（達成，一個地方跟原計畫不同，見下方）
首頁 piece 02「Jonathan」點下去是真實頁面：個人門戶＝簡介區塊＋自己的
專案入口卡片。Minz（piece 01）同步建對稱的骨架佔位頁，內容留白等本人填，
連結不再是死錨點。

**跟原計畫的差異**：原本這裡寫「SKHPS 連結從後台搬到這裡，jonaminz-movies
也放入」——實作時使用者當場糾正，jonaminz-movies 是 Jonathan／Minz
兩人共用的後台功能，不是 Jonathan 個人專案，不該跟 SKHPS 並列在個人
專案卡片裡，已從卡片移除。目前 Jonathan 頁只有 SKHPS 一張卡片。

### 落地檔案
- 新增 `pages/jonathan/`（`index.html`／`assets/js/app.js`／
  `assets/css/page-jonathan.css`）、`pages/minz/`（同結構，佔位內容）
- `config.json` 新增 `jonathan`／`minz` 兩個 page entry
- `index.html`：`#jonathan`/`#minz` 死錨點改成 `/pages/jonathan/`、
  `/pages/minz/`
- `pages/admin/assets/js/app.js`：移除 SKHPS 連結卡片
- `assets/img/jonathan-portrait.jpg`（新增，Jonathan 形象照，見下方壓縮
  說明）
- `pages/jonathan/assets/js/app.js`：SKHPS 連結環境感知邏輯（見下方）

### 驗收（全部通過）
- [x] 首頁兩個 name-link 都能進入對應頁面，布幕行為與其他頁一致
- [x] Jonathan 頁有簡介區塊＋SKHPS 專案卡片，卡片外開新分頁
- [x] 後台首頁不再有 SKHPS 卡片
- [x] 手機寬度版面正常（截圖確認，375px 寬度圖片/文字正確堆疊）

### SKHPS 連結環境感知（實作時追加，原計畫沒有這段）
使用者測試時指出 SKHPS 連結應該要能在本機 dev 測試時連到本機的 SKHPS
（`/skhpsv2/`），不是永遠連正式站。跟 OAuth `origin` 白名單同一個判斷
精神：loopback（`localhost`／`127.0.0.1`）不管哪個 port 都算本機，不寫死
單一 port 的假設（`pages/jonathan/assets/js/app.js` 的
`LOOPBACK_HOSTNAME_PATTERN`）。SKHPS 是唯一需要 JS 動態接手的連結，
其餘內容都是靜態 HTML，不需要動態渲染。

### 使用者提供的素材
- Jonathan 簡介文字：石益昇，整形外科醫師（實際文字見
  `pages/jonathan/index.html`）
- Jonathan 形象照：使用者提供的原始 PNG（3840×5760，24MB）用
  `sharp-cli` 壓成 `assets/img/jonathan-portrait.jpg`（JPEG，1000×1500，
  quality 78，80KB）
- 首頁 hero 圖同批也換成使用者提供的高解析度原始檔重壓版本（2200×1467，
  quality 70，408KB，取代原本較低畫質來源壓出的 267KB 版本）

### Minz 頁仍待補
Minz 簡介文字與照片尚未提供，`pages/minz/` 目前是骨架佔位頁。

---

## 階段③：後台首頁 Dashboard 化 ✅ 完成（2026-07-13，已驗證）

見 `AI_CONTEXT/CHANGELOG.md` 同日「待辦總表順序⑦」條目。

### 目標（達成）
`pages/admin/` 從佔位卡片升級成儀表板：登入身分徽章（沿用登入頁
`.jonaminz-identity-badge` 視覺）、pending Contract 數量、已登記外部
專案與最後回報時間（既有 `listExternalAppRegistrations`）、
Theme/Contracts 快速入口。

**跟原計畫的差異**：pending 數量原計畫寫「徽章（點擊進 Contracts
頁）」——實作時改成 Contract 核准卡片本身的描述文字（例如「2 筆待審
核」／「無待審」），不是疊在卡片標題上的小數字徽章。理由：這樣才能
自然滿足「0 筆時顯示『無待審』」與「Worker 打不通時顯示錯誤文字」這
兩條驗收，一個純數字徽章沒有空間放這些文字狀態；整張卡片本來就可以
點擊進 Contracts 頁，不需要額外的可點擊徽章。

### 落地檔案
- `pages/admin/assets/js/app.js`：`render(identity)` 加上身分徽章、
  移除舊的路線佔位說明文字；新增 `renderPendingStatus()`（跟
  `pages/admin/contracts/` 同一套 `rows.filter(status==="pending")`
  篩選邏輯，兩邊數字保證一致）
- `pages/admin/assets/css/page-admin.css`：新增
  `.jonaminz-admin-identity`／`.jonaminz-identity-badge`（跟
  `pages/admin/contracts/`、`pages/login/` 同款視覺，各頁各自維護一份，
  水庫法則慣例）；移除不再使用的 `.jonaminz-admin-subtitle`
- `pages/admin/index.html` 沒有改（`render()` 注入的內容結構本來就是
  透過 `[data-app-root]`，HTML 骨架不用動）
- **沒有動 worker.js**：如原計畫所述，純前端聚合既有 action

### 驗收（全部通過）
- [x] pending 數量與 Contracts 頁清單一致；0 筆時顯示「無待審」而非空白
- [x] Worker 打不通時各卡片顯示錯誤文字，不擋頁面揭幕（Playwright 模擬
  Worker 斷線，gate 仍在 ~400ms 內正常放行）
- [x] 登入保護（requireLogin）行為不變

---

## 給實作者的既有規則提醒

- RULES.md 全部適用：改程式碼要 bump `version.js`（**先跑 `date` 查真實
  時間再填**）；Worker 這三階段都不用動、不涉及 `wrangler deploy`；
  完工更新 PROJECT_STATE＋CHANGELOG；回覆用繁體中文。
- 布幕視覺屬「治本重構」等級的改動：完成後必須 Playwright 截圖逐頁
  實際看畫面，不能只驗 DOM 數值。
- 部署授權類問題用 AskUserQuestion 選項式詢問。
