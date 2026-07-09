/*
檔案位置：jonaminz/assets/js/entry-core.js
用途：jonaminz 自己的水庫本體。

因為 jonaminz 沒有外部水庫（skhpsv2）可以依附，這個檔案同時扮演 SKHPS 架構裡
app-entry.js + entry-core.js 的角色，統一管理：
- 讀 version.js / config.json
- loading gate（css / shell / main 三段，語意與 SKHPS 一致：一個 gate 過了就過了）
- 載入 header.js / footer.js（shell）與 site.css
- 依目前 pageId 從 config.json 找出 entry.afterScripts，載入頁面自己的 app.js

頁面（例如 assets/js/app.js）只能透過 window.JonaminzLoading.done/fail 回報自己的
task，不可以自己 release all-ready，不可以自己決定 css/shell ready。
*/
(function () {
  "use strict";

  var docEl = document.documentElement;
  var pageId = docEl.getAttribute("data-jonaminz-page-id") || "home";
  var configUrl = window.JONAMINZ_SITE_CONFIG_URL || "config.json";
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
    loadScript("version.js")
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

        return loadStyle("assets/css/site.css");
      })
      .then(function () {
        markCssReady();
        return Promise.all([
          loadScript("assets/js/header.js"),
          loadScript("assets/js/footer.js")
        ]);
      })
      .then(function () {
        markShellReady();

        var pageConfig = window.JONAMINZ_PAGE_CONFIG || {};
        var afterScripts = (pageConfig.entry && pageConfig.entry.afterScripts) || ["assets/js/app.js"];

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
