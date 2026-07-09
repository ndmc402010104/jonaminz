/*
檔案位置：jonaminz/pages/admin/assets/js/app.js
用途：後台頁自己的業務入口（水庫下游層）。目前只是路線佔位：先確認登入按鈕 ->
後台這條路走得通，區塊內容之後再擴充，先給一個連到 skhps.jonaminz.com 的連結。
只能回報自己的 loading task，不可以自己決定 css/shell ready。
*/
(function () {
  "use strict";

  var READY_TASK = "app-ready";

  function render() {
    var root = document.querySelector("[data-app-root]");
    if (!root) return;

    root.innerHTML =
      '<p class="jonaminz-eyebrow">Jonaminz Admin</p>' +
      '<h1 class="jonaminz-admin-title">後台</h1>' +
      '<p class="jonaminz-admin-subtitle">目前只是路線佔位，之後會擴充實際管理功能。</p>' +
      '<div class="jonaminz-admin-links">' +
        '<a class="jonaminz-admin-link-card" href="https://skhps.jonaminz.com" target="_blank" rel="noopener">' +
          '<span class="jonaminz-admin-link-title">SKHPS</span>' +
          '<span class="jonaminz-admin-link-desc">skhps.jonaminz.com</span>' +
        '</a>' +
        '<a class="jonaminz-admin-link-card" href="/pages/admin/theme/">' +
          '<span class="jonaminz-admin-link-title">Theme</span>' +
          '<span class="jonaminz-admin-link-desc">CSS 疊加架構展示櫃 / 未來的 playground</span>' +
        '</a>' +
      '</div>';
  }

  function init() {
    try {
      render();
      window.JonaminzLoading.done(READY_TASK);
    } catch (error) {
      console.error("[jonaminz] admin app.js init failed", error);
      window.JonaminzLoading.fail(READY_TASK, error);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
