/*
檔案位置：jonaminz/pages/minz/assets/js/app.js
用途：Minz 個人門戶頁自己的業務入口（水庫下游層）。目前是骨架佔位頁，
內容直接寫在 index.html 裡，這裡只回報 loading task，等 Minz 本人提供
簡介文字/照片後再擴充成跟 pages/jonathan/ 一樣的真實內容。
*/
(function () {
  "use strict";

  var READY_TASK = "app-ready";

  function init() {
    try {
      window.JonaminzLoading.done(READY_TASK);
    } catch (error) {
      console.error("[jonaminz] minz app.js init failed", error);
      window.JonaminzLoading.fail(READY_TASK, error);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
