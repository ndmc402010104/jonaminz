/*
檔案位置：jonaminz/pages/admin/toolkit/assets/js/app.js
用途：後台「工具包」頁的業務入口（水庫下游層）。只能回報自己的
loading task，不可以自己決定 css/shell ready。

2026-07-15：從「決策圖」候選項目挑選實作。目前只有兩個快速連結，之後
如果有更多常用工具/網址，往 TOOLS 這個陣列加就好，不用改版面結構。

2026-07-16：曾經短暫加過一節「Agent 密鑰保管箱」（自動產生 APK 上傳
鑰匙、後來又改成 Cloudflare-secret 式），使用者指出這頁的定位是「給人
拿來用的」快速連結（開啟網址／複製網址），密鑰保管箱是「人存進去給
agent 用」的東西，性質不一樣，搬去獨立的 `pages/admin/secrets/`——
這頁恢復成純靜態、不呼叫任何 Worker action，不載入 backend-client.js。
*/
(function () {
  "use strict";

  var READY_TASK = "app-ready";

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  }

  // 這台機器目前已知的區網 IP＋dev-server.js 預設 port（見根目錄
  // dev-server.js 的說明，預設 5500）。**這個 IP 換網路/換電腦就會
  // 失效**，沒有辦法從靜態頁面自動偵測「使用者現在在哪台機器、哪個
  // 網路」——IP 變了要記得回來改這裡（一行常數，改完不用動版面邏輯）。
  var LOCAL_DEV_IP = "192.168.68.90";
  var LOCAL_DEV_PORT = 5500;
  var LOCAL_DEV_URL = "http://" + LOCAL_DEV_IP + ":" + LOCAL_DEV_PORT + "/";

  var TOOLS = [
    {
      title: "Local Dev（區網測試）",
      desc: "手機/平板連同一個 Wi-Fi，開這個網址就能連到這台電腦正在跑的 dev-server.js。",
      href: LOCAL_DEV_URL,
      note: "IP 是目前已知值，換網路/換電腦要回來改 app.js 的 LOCAL_DEV_IP。"
    },
    {
      title: "下載最新 APK",
      desc: "手機瀏覽器開這個網址直接下載安裝，永遠指向目前最新版本（OneDrive 線 Phase C 自架發佈）。",
      href: "https://jonaminz-backend.ndmc402010104.workers.dev/appDownload",
      note: "",
      // App 內（Capacitor WebView）要靠原生 DownloadListener 接手下載，
      // target="_blank" 會讓 WebView 試著開新視窗而不是導覽，反而不會
      // 觸發下載——這顆按鈕改成同分頁導覽（見 sameTab）。
      sameTab: true
    }
  ];

  function toolCardHtml(tool) {
    return (
      '<div class="jonaminz-toolkit-card">' +
        '<h3 class="jonaminz-toolkit-card-title">' + escapeHtml(tool.title) + '</h3>' +
        '<p class="jonaminz-toolkit-card-desc">' + escapeHtml(tool.desc) + '</p>' +
        '<div class="jonaminz-toolkit-card-url">' + escapeHtml(tool.href) + '</div>' +
        (tool.note ? '<p class="jonaminz-toolkit-card-note">' + escapeHtml(tool.note) + '</p>' : "") +
        '<div class="jonaminz-toolkit-card-actions">' +
          '<a class="jonaminz-toolkit-open-btn" href="' + escapeHtml(tool.href) + '"' +
            (tool.sameTab ? ' data-download-btn' : ' target="_blank" rel="noopener"') + '>開啟</a>' +
          '<button type="button" class="jonaminz-toolkit-copy-btn" data-copy-url="' + escapeHtml(tool.href) + '">複製網址</button>' +
        '</div>' +
      '</div>'
    );
  }

  function bindCopyButtons(root) {
    root.addEventListener("click", function (event) {
      // 2026-07-16（使用者回報下載按鈕按下去約5秒才有反應）：下載鍵
      // 導覽到 /appDownload，Worker 解析最新檔要幾秒，原生下載 Toast
      // 才會跳。點下去這一刻先把文字換成「準備下載中…」給即時回饋。
      var dl = event.target.closest("[data-download-btn]");
      if (dl) {
        dl.textContent = "準備下載中…";
        setTimeout(function () { dl.textContent = "開啟"; }, 8000);
        return;
      }
      var btn = event.target.closest("[data-copy-url]");
      if (!btn) return;
      var url = btn.dataset.copyUrl;
      var done = function () {
        var original = btn.textContent;
        btn.textContent = "已複製 ✓";
        setTimeout(function () { btn.textContent = original; }, 1500);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(done).catch(function () {
          window.prompt("複製失敗，手動複製這個網址：", url);
        });
      } else {
        window.prompt("複製這個網址：", url);
      }
    });
  }

  function render() {
    var root = document.querySelector("[data-app-root]");
    if (!root) return;
    root.innerHTML = '<div class="jonaminz-toolkit-list" data-toolkit-list>' +
      TOOLS.map(toolCardHtml).join("") +
      "</div>";
    bindCopyButtons(root.querySelector("[data-toolkit-list]"));
  }

  function init() {
    window.JonaminzIdentity.requireLogin().then(function () {
      try {
        render();
        window.JonaminzLoading.done(READY_TASK);
      } catch (error) {
        console.error("[jonaminz] admin/toolkit app.js init failed", error);
        window.JonaminzLoading.fail(READY_TASK, error);
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
