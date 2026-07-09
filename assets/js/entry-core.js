/*
檔案位置：jonaminz/assets/js/entry-core.js
用途：jonaminz 自己的水庫本體。

因為 jonaminz 沒有外部水庫（skhpsv2）可以依附，這個檔案同時扮演 SKHPS 架構裡
app-entry.js + entry-core.js 的角色，統一管理：
- 讀 version.js / config.json
- loading gate（css / shell / main 三段，語意與 SKHPS 一致：一個 gate 過了就過了）
- CSS 疊加：依序載入 assets/css/reservoir/ 六層（reset -> tokens -> base -> layout
  -> components -> variants），再載入目前頁面 config.json 裡 entry.styles 宣告的
  Page Layer CSS。疊加順序 = 載入順序，後面的檔案可以蓋掉前面的，但不能回頭改
  reservoir 六層本體，只能新增 class 疊加。
- 載入 header.js / footer.js / registry-loader.js（shell）
- 依目前 pageId 從 config.json 找出 entry.afterScripts，載入頁面自己的 app.js

頁面（例如 assets/js/app.js）只能透過 window.JonaminzLoading.done/fail 回報自己的
task，不可以自己 release all-ready，不可以自己決定 css/shell ready。

水庫共用資源一律用「網站根目錄絕對路徑」（開頭 `/`），不用頁面相對路徑：
因為頁面可能放在 `pages/xxx/` 這種巢狀資料夾，若用相對路徑會依頁面所在深度跑掉。
新頁面只要複製根目錄 index.html 的 bootstrap script 原樣貼上即可，不用改路徑。
*/
(function () {
  "use strict";

  var docEl = document.documentElement;
  var pageId = docEl.getAttribute("data-jonaminz-page-id") || "home";
  var configUrl = window.JONAMINZ_SITE_CONFIG_URL || "/config.json";
  var entryVersion = window.JONAMINZ_ENTRY_VERSION || String(Date.now());

  var pendingTasks = {};
  var allReady = false;

  function withVersion(url) {
    var sep = url.indexOf("?") === -1 ? "?" : "&";
    return url + sep + "v=" + encodeURIComponent(entryVersion);
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

  function init() {
    loadScript("/version.js")
      .then(function () {
        return fetch(withVersion(configUrl)).then(function (res) { return res.json(); });
      })
      .then(function (siteConfig) {
        window.JONAMINZ_SITE_CONFIG = siteConfig;

        var pageConfig = (siteConfig.pages && siteConfig.pages[pageId]) || {};
        window.JONAMINZ_PAGE_CONFIG = pageConfig;
        window.JONAMINZ_APP_ENV = {
          appVersion: (window.JONAMINZ_APP_VERSION && window.JONAMINZ_APP_VERSION.version) || "v.unknown"
        };

        var loadingTasks = (pageConfig.entry && pageConfig.entry.loadingTasks) || ["app-ready"];
        registerTasks(loadingTasks);

        var reservoirStyles = [
          "/assets/css/reservoir/01-reset.css",
          "/assets/css/reservoir/02-tokens.css",
          "/assets/css/reservoir/03-base.css",
          "/assets/css/reservoir/04-layout.css",
          "/assets/css/reservoir/05-components.css",
          "/assets/css/reservoir/06-variants.css"
        ];
        var pageStyles = (pageConfig.entry && pageConfig.entry.styles) || [];
        var allStyles = reservoirStyles.concat(pageStyles);

        return allStyles.reduce(function (chain, href) {
          return chain.then(function () { return loadStyle(href); });
        }, Promise.resolve());
      })
      .then(function () {
        markCssReady();
        return Promise.all([
          loadScript("/assets/js/header.js"),
          loadScript("/assets/js/footer.js"),
          loadScript("/assets/js/registry-loader.js")
        ]);
      })
      .then(function () {
        markShellReady();

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
