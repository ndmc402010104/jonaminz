# 未來頁面

新增頁面時的最小流程（水庫理論精神：頁面只放業務邏輯，共用能力留在根目錄的水庫層）：

1. 在專案根目錄新增資料夾，例如 `pages/about/`，內含該頁自己的 `index.html`（複製根目錄
   `index.html` 的最小樣板，改 `data-jonaminz-page-id`）與 `assets/js/app.js`。
2. 在根目錄 `config.json` 的 `pages` 裡新增一個 entry，宣告 `pageId`、`title`、
   `entry.afterScripts`、`entry.loadingTasks`。
3. 該頁 HTML 依然只直接載入 `assets/css/jonaminz-loading.css` 與 `assets/js/entry-core.js`
   （相對路徑），不要複製 header.js / footer.js / site.css / entry-core.js。
4. 不要新增第二個 config.json 或每頁一個 manifest；所有頁面共用同一份根目錄 `config.json`。
