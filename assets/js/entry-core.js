/*
檔案位置：jonaminz/assets/js/entry-core.js
用途：jonaminz 自己的水庫本體。

因為 jonaminz 沒有外部水庫（skhpsv2）可以依附，這個檔案同時扮演 SKHPS 架構裡
app-entry.js + entry-core.js 的角色，統一管理：
- 讀 version.js / config.json
- loading gate（css / shell / main 三段，語意與 SKHPS 一致：一個 gate 過了就過了）
- CSS 疊加：reservoir 六層（reset -> tokens -> base -> layout -> components ->
  variants）+ 目前頁面 config.json 裡 entry.styles 宣告的 Page Layer CSS，
  最後套用 theme-runtime.js（第 8 層 - Theme，動態外觀，來源是 Supabase，
  見 backend/）。疊加順序（DOM 順序）＝哪個先 append，跟哪個先下載完成
  無關——並行載入不會打亂 cascade，見下方「並行策略」。
- 載入 header.js / footer.js / registry-loader.js（shell）
- 依目前 pageId 從 config.json 找出 entry.afterScripts，載入頁面自己的 app.js

頁面（例如 assets/js/app.js）只能透過 window.JonaminzLoading.done/fail 回報自己的
task，不可以自己 release all-ready，不可以自己決定 css/shell ready。

水庫共用資源一律用「網站根目錄絕對路徑」（開頭 `/`），不用頁面相對路徑：
因為頁面可能放在 `pages/xxx/` 這種巢狀資料夾，若用相對路徑會依頁面所在深度跑掉。
新頁面只要複製根目錄 index.html 的 bootstrap script 原樣貼上即可，不用改路徑。

2026-07-12 效能重建（docs/frontend-quality-plan-202607.md 階段①）：
- **快取修復（最大元凶）**：舊版每次載入都用 `Date.now()` 當所有資源網址的
  cache buster，等於瀏覽器快取永遠 0% 命中率。改成：這個檔案本身＋
  jonaminz-loading.css 這兩個「bootstrap 前置檔」完全不帶 buster（吃
  GitHub Pages 原生 ETag/Cache-Control，最壞下一次部署後 10 分鐘內看到
  舊版，可接受）；version.js 本身也不帶 buster（同理）；version.js 讀到
  之後，其餘所有資源（config.json、reservoir/page CSS、theme-runtime.js、
  header/footer/registry-loader、頁面 app.js）改用 version.js 的版本字串
  當 buster——這樣同一版本内重複造訪全部命中快取，只有 push 前 bump 版本
  （RULES.md 既有規則）才會讓資源網址改變、強制拿新的。`window.JONAMINZ_
  ENTRY_VERSION` 仍然保留、指派成同一個版本字串（不是 Date.now()），維持
  registry-loader.js 既有讀法不用改那個檔案。
- **並行化**：原本 6 層 reservoir CSS 用 `.reduce()` 逐一序列載入，現在
  `Promise.all` 一次全部送出（`<link>` 的 append 順序仍是同步、依序發生，
  cascade 順序不受影響，只有下載本身平行）；config.json 抓取跟 reservoir
  CSS、theme-runtime.js 的 script 標籤載入三者同時開始（互不依賴）；
  config 解析完後，page CSS 與 header/footer/registry-loader 三支 shell
  script 同時開始（header.js 的 render() 依賴 window.JONAMINZ_SITE_CONFIG
  已經設定，所以這批要等 config 解析完才能開始，不能更早）。
- **Theme 不再無上限擋 gate**：首次造訪（無 localStorage 快取）原本要等
  Worker/Supabase 回應（最長 8 秒）才放行 gate。現在用 loadThemeWithCap()
  跟 800ms 賽跑，逾時就先放行、theme 資料到了背景照套（theme-runtime.js
  本身完全沒改，只是 entry-core 不再無條件等它）。回訪（有快取）theme.load()
  本來就同步套用完立刻 resolve，不受影響。
- **布幕進度**：setProgress() 在每個里程碑寫入 CSS 變數
  --jonaminz-loading-progress，給 jonaminz-loading.css 的進度條讀。
*/
(function () {
  "use strict";

  var docEl = document.documentElement;
  var pageId = docEl.getAttribute("data-jonaminz-page-id") || "home";
  var configUrl = window.JONAMINZ_SITE_CONFIG_URL || "/config.json";

  var pendingTasks = {};
  var allReady = false;
  var resourceVersion = null;

  function setProgress(percent) {
    docEl.style.setProperty("--jonaminz-loading-progress", String(percent));
  }

  function withVersion(url) {
    if (!resourceVersion) return url;
    var sep = url.indexOf("?") === -1 ? "?" : "&";
    return url + sep + "v=" + encodeURIComponent(resourceVersion);
  }

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var script = document.createElement("script");
      script.src = withVersion(src);
      script.onload = function () { resolve(); };
      script.onerror = function () { reject(new Error("load failed: " + src)); };
      document.head.appendChild(script);
    });
  }

  function loadStyle(href) {
    return new Promise(function (resolve, reject) {
      var link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = withVersion(href);
      link.onload = function () { resolve(); };
      link.onerror = function () { reject(new Error("load failed: " + href)); };
      document.head.appendChild(link);
    });
  }

  function markCssReady() {
    docEl.classList.remove("jonaminz-css-loading");
  }

  function markShellReady() {
    docEl.classList.remove("jonaminz-shell-loading");
    docEl.setAttribute("data-jonaminz-shell-ready", "true");
  }

  function releaseAllReady() {
    if (allReady) return;
    allReady = true;
    setProgress(100);
    docEl.classList.remove("jonaminz-loading");
    docEl.classList.remove("jonaminz-main-loading");
    docEl.setAttribute("data-jonaminz-page-ready", "true");
  }

  function checkAllReady() {
    var tasks = Object.keys(pendingTasks);
    var done = tasks.length > 0 && tasks.every(function (task) { return pendingTasks[task] === true; });
    if (done) releaseAllReady();
  }

  function registerTasks(taskNames) {
    taskNames.forEach(function (task) { pendingTasks[task] = false; });
  }

  window.JonaminzLoading = {
    done: function (task) {
      pendingTasks[task] = true;
      docEl.setAttribute("data-jonaminz-" + task + "-ready", "true");
      checkAllReady();
    },
    fail: function (task, error) {
      pendingTasks[task] = true;
      docEl.setAttribute("data-jonaminz-" + task + "-ready", "false");
      console.error("[jonaminz] loading task failed:", task, error);
      checkAllReady();
    }
  };

  // 首訪（無快取）theme fetch 最長等 800ms，逾時就不擋 gate，theme-runtime
  // 自己的 promise 繼續在背景跑，資料到了會自己呼叫 applyCss() 補套上去
  // （theme-runtime.js 本身沒有修改，純粹是這裡不再無條件 await 它）。
  // 回訪（有 localStorage 快取）theme.load() 本來就同步套用完立刻
  // resolve，不會被 800ms 卡住，這個 race 對它幾乎是 no-op。
  function loadThemeWithCap(capMs) {
    return new Promise(function (resolve) {
      var settled = false;
      function finish() {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve();
      }
      var timer = setTimeout(finish, capMs);
      window.JonaminzThemeRuntime.load().then(finish).catch(finish);
    });
  }

  function init() {
    setProgress(5);

    loadScript("/version.js")
      .then(function () {
        resourceVersion = (window.JONAMINZ_APP_VERSION && window.JONAMINZ_APP_VERSION.version) || null;
        // 保留給 registry-loader.js 讀（它自己的 cache buster 邏輯沒有改），
        // 從「每次都是新的 Date.now()」變成「跟著版本號走，同版本會命中快取」。
        window.JONAMINZ_ENTRY_VERSION = resourceVersion || String(Date.now());
        setProgress(15);

        var reservoirStyles = [
          "/assets/css/reservoir/01-reset.css",
          "/assets/css/reservoir/02-tokens.css",
          "/assets/css/reservoir/03-base.css",
          "/assets/css/reservoir/04-layout.css",
          "/assets/css/reservoir/05-components.css",
          "/assets/css/reservoir/06-variants.css"
        ];

        // 三件事互不依賴，同時開始：抓 config、載 reservoir CSS、
        // 預載 theme-runtime.js 的 script 本體（還不呼叫 .load()）。
        var configPromise = fetch(withVersion(configUrl)).then(function (res) { return res.json(); });
        var reservoirPromise = Promise.all(reservoirStyles.map(loadStyle));
        var themeScriptPromise = loadScript("/assets/js/theme-runtime.js");

        return configPromise.then(function (siteConfig) {
          setProgress(30);

          window.JONAMINZ_SITE_CONFIG = siteConfig;

          var pageConfig = (siteConfig.pages && siteConfig.pages[pageId]) || {};
          window.JONAMINZ_PAGE_CONFIG = pageConfig;
          window.JONAMINZ_APP_ENV = {
            appVersion: (window.JONAMINZ_APP_VERSION && window.JONAMINZ_APP_VERSION.version) || "v.unknown"
          };

          var loadingTasks = (pageConfig.entry && pageConfig.entry.loadingTasks) || ["app-ready"];
          registerTasks(loadingTasks);

          var pageStyles = (pageConfig.entry && pageConfig.entry.styles) || [];
          var pageStylePromise = Promise.all(pageStyles.map(loadStyle));

          // header.js 的 render() 讀 window.JONAMINZ_SITE_CONFIG，必須等
          // config 解析完才能開始載——跟 CSS 那條互相獨立，兩邊平行跑。
          var shellPromise = Promise.all([
            loadScript("/assets/js/header.js"),
            loadScript("/assets/js/footer.js"),
            loadScript("/assets/js/registry-loader.js")
          ]).then(function () {
            markShellReady();
            setProgress(85);
          });

          var cssPromise = Promise.all([reservoirPromise, pageStylePromise, themeScriptPromise])
            .then(function () {
              setProgress(55);
              return loadThemeWithCap(800);
            })
            .then(function () {
              markCssReady();
              setProgress(65);
            });

          return Promise.all([cssPromise, shellPromise]);
        });
      })
      .then(function () {
        var pageConfig = window.JONAMINZ_PAGE_CONFIG || {};
        var afterScripts = (pageConfig.entry && pageConfig.entry.afterScripts) || ["/assets/js/app.js"];

        return afterScripts.reduce(function (chain, src) {
          return chain.then(function () { return loadScript(src); });
        }, Promise.resolve());
      })
      .catch(function (error) {
        console.error("[jonaminz] entry-core init failed", error);
        markCssReady();
        markShellReady();
        releaseAllReady();
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
