/*
檔案位置：jonaminz/assets/js/app.js
用途：home 頁自己的業務入口（水庫下游層）。
只能回報自己的 loading task，不可以自己 release all-ready，
不可以自己決定 css-loading / shell-loading ready。
*/
(function () {
  "use strict";

  var READY_TASK = "app-ready";

  function setStatus(text) {
    var el = document.querySelector("[data-app-status]");
    if (el) el.textContent = text;
  }

  function init() {
    try {
      var pageConfig = window.JONAMINZ_PAGE_CONFIG || {};
      var title = pageConfig.title || document.title || "Jonaminz";

      setStatus(title + " 已就緒。");

      window.JonaminzLoading.done(READY_TASK);
    } catch (error) {
      console.error("[jonaminz] app.js init failed", error);
      setStatus("初始化失敗。");
      window.JonaminzLoading.fail(READY_TASK, error);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
