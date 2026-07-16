/*
檔案位置：jonaminz/pages/admin/toolkit/assets/js/app.js
用途：後台「工具包」頁的業務入口（水庫下游層）。只能回報自己的
loading task，不可以自己決定 css/shell ready。

2026-07-15：從「決策圖」候選項目挑選實作。目前只有兩個快速連結，之後
如果有更多常用工具/網址，往 TOOLS 這個陣列加就好，不用改版面結構。
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
      note: ""
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
          '<a class="jonaminz-toolkit-open-btn" href="' + escapeHtml(tool.href) + '" target="_blank" rel="noopener">開啟</a>' +
          '<button type="button" class="jonaminz-toolkit-copy-btn" data-copy-url="' + escapeHtml(tool.href) + '">複製網址</button>' +
        '</div>' +
      '</div>'
    );
  }

  function bindCopyButtons(root) {
    root.addEventListener("click", function (event) {
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

  // 2026-07-16：APK 上傳專用固定密鑰（跟個人登入 session 分開、不會
  // 過期，只給 createApkUploadSession 認）——使用者要求要能在後台自己
  // 管理，不要每次都跟 agent 要 session token 或跑 wrangler secret put。
  // 只回報「有沒有設定」跟上次輪替時間，鑰匙本身只有按「產生新鑰匙」
  // 當下的回應裡看得到一次，之後永遠讀不回來（見 worker.js
  // rotateApkAgentToken 的設計理由）。
  function formatLocalDateTime(value) {
    if (!value) return "";
    try {
      return new Date(value).toLocaleString("zh-TW", {
        year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit", hour12: false
      });
    } catch (error) {
      return String(value);
    }
  }

  function renderAgentTokenSection() {
    var el = document.querySelector("[data-agent-token-status]");
    if (!el) return;
    var token = (window.JonaminzIdentity && window.JonaminzIdentity.readToken)
      ? window.JonaminzIdentity.readToken() : null;

    function refresh() {
      el.textContent = "讀取中...";
      window.JonaminzBackend.getApkAgentTokenStatus({ token: token })
        .then(function (response) {
          if (!response || !response.ok) {
            el.textContent = "讀取失敗：" + ((response && response.error) || "未知錯誤");
            return;
          }
          el.innerHTML =
            '<p>' + (response.configured
              ? ("目前已設定（上次輪替：" + escapeHtml(formatLocalDateTime(response.rotatedAt)) + "）")
              : "目前尚未設定") + '</p>' +
            '<button type="button" class="jonaminz-toolkit-open-btn" data-rotate-agent-token>產生新鑰匙</button>' +
            '<div data-rotate-result></div>';
          el.querySelector("[data-rotate-agent-token]").addEventListener("click", function () {
            if (response.configured && !window.confirm("產生新鑰匙後，舊鑰匙會立刻失效——如果 agent 手上還留著舊的，要記得重新給它新的。確定要產生嗎？")) {
              return;
            }
            window.JonaminzBackend.rotateApkAgentToken({ token: token })
              .then(function (rotateResponse) {
                if (!rotateResponse || !rotateResponse.ok) {
                  el.querySelector("[data-rotate-result]").textContent =
                    "失敗：" + ((rotateResponse && rotateResponse.error) || "未知錯誤");
                  return;
                }
                el.querySelector("[data-rotate-result]").innerHTML =
                  '<p class="jonaminz-toolkit-card-note">新鑰匙（只會顯示這一次，現在就複製給需要的 agent）：</p>' +
                  '<div class="jonaminz-toolkit-card-url" data-copy-url="' + escapeHtml(rotateResponse.token) + '">' +
                  escapeHtml(rotateResponse.token) + '</div>' +
                  '<button type="button" class="jonaminz-toolkit-copy-btn" data-copy-url="' + escapeHtml(rotateResponse.token) + '">複製鑰匙</button>';
                refresh();
              })
              .catch(function (error) {
                el.querySelector("[data-rotate-result]").textContent =
                  "失敗：" + (error && error.message ? error.message : String(error));
              });
          });
        })
        .catch(function (error) {
          el.textContent = "讀取失敗：" + (error && error.message ? error.message : String(error));
        });
    }
    refresh();
  }

  function render() {
    var root = document.querySelector("[data-app-root]");
    if (!root) return;
    root.innerHTML = '<div class="jonaminz-toolkit-list" data-toolkit-list>' +
      TOOLS.map(toolCardHtml).join("") +
      "</div>" +
      '<section class="jonaminz-connections-section">' +
        '<p class="jonaminz-admin-section-title">Agent 存取（給自動化 build/上傳用）</p>' +
        '<div data-agent-token-status>讀取中...</div>' +
      '</section>';
    bindCopyButtons(root);
  }

  function init() {
    window.JonaminzIdentity.requireLogin().then(function () {
      try {
        render();
        window.JonaminzLoading.done(READY_TASK);
        renderAgentTokenSection();
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
