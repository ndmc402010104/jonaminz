/*
檔案位置：jonaminz/assets/js/footer.js
用途：jonaminz 共用 footer（水庫 shell 層），顯示 window.JONAMINZ_APP_ENV.appVersion。
頁面本身不應該自己 render footer 或自己決定版本字串。
*/
(function () {
  "use strict";

  function render() {
    var el = document.querySelector("[data-jonaminz-footer]");
    if (!el) return;

    var appEnv = window.JONAMINZ_APP_ENV || {};
    var version = appEnv.appVersion || "v.unknown";
    el.textContent = "Jonaminz " + version;
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", render, { once: true });
  } else {
    render();
  }
})();
