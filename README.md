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
      site.css               正式畫面樣式
    js/
      entry-core.js          水庫本體：讀 config/version、套 loading gate、載 header/footer/registry-loader、載入頁面 app.js
      header.js              共用 header（水庫 shell 層）
      footer.js              共用 footer（水庫 shell 層），顯示版本
      registry-loader.js     共用 shell 層：讀 registry.json，抓外部專案 manifest 顯示卡片
      app.js                 首頁自己的業務入口
  pages/                     未來頁面放這裡，見 pages/README.md
    admin/                   後台頁範例（首頁「登入」按鈕導向這裡）
  docs/
    external-project-manifest.md   外部專案怎麼接進 jonaminz 水庫
```

所有頁面（包含 `pages/` 底下巢狀的頁面）一律用網站根目錄絕對路徑（開頭 `/`）載入
`entry-core.js` 等共用資源，不用頁面相對路徑——因為頁面深度不一定相同。

## 版本規則

- `window.JONAMINZ_APP_VERSION`（來自 `version.js`）：業務版本，顯示在 footer。
- `window.JONAMINZ_ENTRY_VERSION`（inline 產生）：只是資源 cache-buster，不是業務版本，
  兩者不可混用。

## Loading Gate

`jonaminz-loading` / `jonaminz-css-loading` / `jonaminz-shell-loading` / `jonaminz-main-loading`
四個 class 語意與 SKHPS 一致：一個 gate 過了就過了，頁面只能回報自己的 task，不能自己
release all-ready。
