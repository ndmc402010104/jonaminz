/*
檔案位置：jonaminz/pages/jonathan/assets/js/app.js
用途：Jonathan 個人門戶頁自己的業務入口（水庫下游層）。內容是靜態簡介＋
專案卡片，直接寫在 index.html 裡，這裡只回報 loading task，不需要像
後台頁那樣做 requireLogin() 或抓動態資料——這是公開頁面，任何人都能看。

SKHPS 連結是唯一的例外，需要 JS 動態接手：本機測試時要連本機的 SKHPS，
不是正式站 skhps.jonaminz.com。跟 worker.js 的
OAUTH_LOOPBACK_RETURN_ORIGIN_PATTERN 同一個判斷精神——loopback（
localhost／127.0.0.1）不管哪個 port 都算本機。這裡比 worker.js 那份更
單純：不用另外驗證 protocol，因為判斷依據是「這個頁面自己現在被誰
載入」（window.location），不是外部輸入，沒有偽造的疑慮。

2026-07-12 修正：第一版猜測 skhpsv2 跟 jonaminz 掛在同一台本機伺服器底下
的 /skhpsv2/ 路徑（同 origin），實測發現不成立——jonaminz 的
dev-server.js 只服務 jonaminz 自己資料夾底下的檔案，skhpsv2 本來沒有
固定的本機伺服器（只能靠 VS Code Live Server 之類的工具，root/port
每次可能不一樣），沒有一個可靠的「同 origin 相對路徑」可以猜。解法：
幫 skhpsv2 也開一支跟 jonaminz 自己這支同款的 dev-server.js（固定
port 5501，見 skhpsv2 repo 該檔案），這裡直接連固定 port，不用猜路徑。
*/
(function () {
  "use strict";

  var READY_TASK = "app-ready";
  var LOOPBACK_HOSTNAME_PATTERN = /^(localhost|127\.0\.0\.1)$/;
  var SKHPS_DEV_SERVER_PORT = 5501;

  function resolveSkhpsUrl() {
    if (LOOPBACK_HOSTNAME_PATTERN.test(window.location.hostname)) {
      return window.location.protocol + "//" + window.location.hostname + ":" + SKHPS_DEV_SERVER_PORT + "/";
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
