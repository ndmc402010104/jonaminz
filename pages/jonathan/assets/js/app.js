/*
檔案位置：jonaminz/pages/jonathan/assets/js/app.js
用途：Jonathan 個人門戶頁自己的業務入口（水庫下游層）。內容是靜態簡介＋
專案卡片，直接寫在 index.html 裡，這裡只回報 loading task，不需要像
後台頁那樣做 requireLogin() 或抓動態資料——這是公開頁面，任何人都能看。

SKHPS 連結是唯一的例外，需要 JS 動態接手：本機測試（skhpsv2 跟 jonaminz
一樣掛在同一台本機伺服器底下的 /skhpsv2/ 路徑，同 origin）時要連本機的
SKHPS，不是正式站 skhps.jonaminz.com。跟 worker.js 的
OAUTH_LOOPBACK_RETURN_ORIGIN_PATTERN 同一個判斷精神——loopback（
localhost／127.0.0.1）不管哪個 port 都算本機，不要寫死單一 port（本機
工具換 port 就會漏接，這個教訓已經在 OAuth 那條路踩過一次）。這裡比
worker.js 那份更單純：不用另外驗證 protocol，因為判斷依據是「這個頁面
自己現在被誰載入」（window.location），不是外部輸入，沒有偽造的疑慮。
*/
(function () {
  "use strict";

  var READY_TASK = "app-ready";
  var LOOPBACK_HOSTNAME_PATTERN = /^(localhost|127\.0\.0\.1)$/;

  function resolveSkhpsUrl() {
    if (LOOPBACK_HOSTNAME_PATTERN.test(window.location.hostname)) {
      return window.location.origin + "/skhpsv2/";
    }
    return "https://skhps.jonaminz.com";
  }

  function wireSkhpsLink() {
    var link = document.querySelector("[data-skhps-link]");
    if (!link) return;
    link.href = resolveSkhpsUrl();
  }

  function init() {
    try {
      wireSkhpsLink();
      window.JonaminzLoading.done(READY_TASK);
    } catch (error) {
      console.error("[jonaminz] jonathan app.js init failed", error);
      window.JonaminzLoading.fail(READY_TASK, error);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
