# jonaminz

個人網站專案。架構精神沿用 SKHPS 的「水庫理論」（見 `SKHPS/新專案指南/`），但 jonaminz 是
獨立自足的專案：

- jonaminz **不是** `SKHPS/skhpsv2` 底下的下游 app，也不依賴它的任何 runtime 檔案。
- 因為沒有外部水庫可以依附，jonaminz **自己就是自己的水庫本體**：`assets/js/entry-core.js`
  同時扮演 SKHPS 架構裡 `app-entry.js` + `entry-core.js` 的角色，統一管理 loading gate、
  header/footer、CSS、頁面 entry 載入順序。
- 未來新增頁面只在 `config.json` 的 `pages` 裡新增 entry + 建立對應資料夾，不用複製水庫層
  檔案。詳見 `pages/README.md`。
- jonaminz 也是**外部專案的水庫**：其他獨立 repo / 子網域的專案只要在 `registry.json`
  登錄一筆、自己放一份 `jonaminz-app.json`，就會自動出現在首頁的外部專案清單，不用回來改
  jonaminz 的程式碼或內容。詳見 `docs/external-project-manifest.md`。

## 檔案結構

```
jonaminz/
  index.html                首頁，最小入口
  version.js                 JONAMINZ_APP_VERSION（業務版本，非 cache-buster）
  config.json                站台設定 / 頁面登錄表（水庫層擁有，管站內頁面）
  registry.json               外部專案登錄表（水庫層擁有，管外部 repo）
  assets/
    css/
      jonaminz-loading.css   唯一早期 CSS，只做 loading 遮罩
      reservoir/             CSS 疊加第 1-6 層，全站共用，每頁都會載入（見下方「CSS 疊加架構」）
      page-home.css          CSS 疊加第 7 層，只有首頁自己載入
    js/
      entry-core.js          水庫本體：讀 config/version、套 loading gate、依序疊加 reservoir 六層 + 該頁 Page Layer CSS + Theme、載 header/footer/registry-loader、載入頁面 app.js
      header.js              共用 header（水庫 shell 層）
      footer.js              共用 footer（水庫 shell 層），顯示版本
      registry-loader.js     共用 shell 層：讀 registry.json，抓外部專案 manifest 顯示卡片
      backend-client.js      呼叫 Cloudflare Worker 的統一入口（見 backend/）
      theme-runtime.js       CSS 疊加第 8 層：讀 Supabase 的 Theme 規則、組 CSS、注入，獨立可攜給外部專案共用
      app.js                 首頁自己的業務入口
  pages/                     未來頁面放這裡，見 pages/README.md
    admin/                   後台頁範例（首頁「登入」按鈕導向這裡）
      theme/                 Theme 編輯頁：讀寫 Supabase 的 CSS 規則，存檔立即套用
  backend/                   Cloudflare Worker + Supabase schema，見 backend/README.md
  docs/
    external-project-manifest.md   外部專案怎麼接進 jonaminz 水庫、怎麼共用 Theme
```

所有頁面（包含 `pages/` 底下巢狀的頁面）一律用網站根目錄絕對路徑（開頭 `/`）載入
`entry-core.js` 等共用資源，不用頁面相對路徑——因為頁面深度不一定相同。

## CSS 疊加架構

`entry-core.js` 依序載入以下八層，後面的層可以疊加/蓋掉前面的層，但不會回頭改前面
層的檔案本體：

1. **Reset** (`assets/css/reservoir/01-reset.css`) — 瀏覽器預設值歸零。
2. **Tokens** (`02-tokens.css`) — 全站唯一的顏色/間距/圓角/陰影/字級 CSS 變數來源。
3. **Base** (`03-base.css`) — `html`/`body`/標題/連結等原生元素的預設樣式。
4. **Layout/Shell** (`04-layout.css`) — `.jonaminz-container`、header/footer 版面骨架。
5. **Components** (`05-components.css`) — 共用零件本體（`.btn`、`.card`、
   `.jonaminz-project-card` 等），樣式要中性，不塞單一頁面的專屬設計。
6. **Variants** (`06-variants.css`) — 元件的外觀變體（`.btn-primary`、`.card-glass`）。
7. **Page Layer**（每頁自己一份，例如 `assets/css/page-home.css`、
   `pages/admin/assets/css/page-admin.css`）— 由 `config.json` 該頁的
   `entry.styles` 宣告，只有那一頁會載入，放這頁專屬的視覺設計。
8. **Theme**（`assets/js/theme-runtime.js`）— 動態外觀層，資料來源是 Supabase 的
   `theme_css_rules`（見 `backend/`），不是靜態檔案。後台 `/pages/admin/theme/` 是編輯
   介面：改規則存檔後全站（含有載這份 script 的外部專案）立刻換外觀，不用改程式碼或
   重新部署。這份 script 刻意寫成獨立可攜，外部專案只要加一個 `<script>` 標籤就能共用
   同一套外觀，細節見 `docs/external-project-manifest.md`。

CSS 屬於「功能」還是「外觀」的判斷原則：**版面/互動邏輯（flex、grid、hover 狀態、
z-index 這類結構規則）留在 1-7 層，寫在離使用它的元件/頁面最近的地方；顏色/間距/圓角
/陰影這類純視覺變數統一交給 Theme（第 8 層），不要在 1-7 層寫死視覺數值**。

新增頁面需要專屬樣式時：在該頁資料夾新增一份 CSS（例如 `pages/xxx/assets/css/page-xxx.css`），
在 `config.json` 該頁 `entry.styles` 陣列裡登錄路徑（根目錄絕對路徑），`entry-core.js`
會自動排在 reservoir 六層之後載入，不用改 `entry-core.js` 本身。

## 版本規則

- `window.JONAMINZ_APP_VERSION`（來自 `version.js`）：業務版本，顯示在 footer。
- `window.JONAMINZ_ENTRY_VERSION`（inline 產生）：只是資源 cache-buster，不是業務版本，
  兩者不可混用。

## Loading Gate

`jonaminz-loading` / `jonaminz-css-loading` / `jonaminz-shell-loading` / `jonaminz-main-loading`
四個 class 語意與 SKHPS 一致：一個 gate 過了就過了，頁面只能回報自己的 task，不能自己
release all-ready。
