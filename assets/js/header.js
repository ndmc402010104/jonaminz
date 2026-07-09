/*
檔案位置：jonaminz/assets/js/header.js
用途：jonaminz 共用 header（水庫 shell 層）。未來多頁導覽列在此擴充，
頁面本身不應該自己 render header。
*/
(function () {
  "use strict";

  function render() {
    var el = document.querySelector("[data-jonaminz-header]");
    if (!el) return;

    var siteConfig = window.JONAMINZ_SITE_CONFIG || {};
    el.textContent = siteConfig.title || "Jonaminz";
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", render, { once: true });
  } else {
    render();
  }
})();
