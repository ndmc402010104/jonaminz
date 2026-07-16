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

  // 2026-07-16（同日改版）：第一版是 Worker 自動產生單一把 APK 專用
  // 鑰匙，使用者回饋不是他要的——他要的是「像 Cloudflare secret 那種
  // 保管箱」：自己選名稱/值存進來，agent 需要時直接讀，不限定只能給
  // APK 上傳用。這裡只列名稱＋更新時間（不顯示 value，跟 Cloudflare
  // 一樣「能覆蓋、不能讀回」），「+」展開新增表單（名稱／值兩個欄位）。
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

  function agentSecretRowHtml(secret) {
    return (
      '<div class="jonaminz-toolkit-secret-row" data-secret-row="' + escapeHtml(secret.name) + '">' +
        '<div class="jonaminz-toolkit-secret-info">' +
          '<span class="jonaminz-toolkit-secret-name">' + escapeHtml(secret.name) + '</span>' +
          '<span class="jonaminz-toolkit-card-note">上次更新：' + escapeHtml(formatLocalDateTime(secret.updated_at)) + '</span>' +
        '</div>' +
        '<button type="button" class="jonaminz-toolkit-copy-btn" data-delete-secret="' + escapeHtml(secret.name) + '">刪除</button>' +
      '</div>'
    );
  }

  function renderAgentSecretsSection() {
    var el = document.querySelector("[data-agent-secrets]");
    if (!el) return;
    var token = (window.JonaminzIdentity && window.JonaminzIdentity.readToken)
      ? window.JonaminzIdentity.readToken() : null;

    function refresh() {
      el.textContent = "讀取中...";
      window.JonaminzBackend.listAgentSecrets({ token: token })
        .then(function (response) {
          if (!response || !response.ok) {
            el.textContent = "讀取失敗：" + ((response && response.error) || "未知錯誤");
            return;
          }
          var secrets = response.secrets || [];
          el.innerHTML =
            '<div data-secret-list>' +
              (secrets.length
                ? secrets.map(agentSecretRowHtml).join("")
                : '<p class="jonaminz-toolkit-card-note">目前沒有存任何密鑰。</p>') +
            '</div>' +
            '<button type="button" class="jonaminz-toolkit-open-btn" data-add-secret-toggle>+ 新增密鑰</button>' +
            '<form data-add-secret-form hidden>' +
              '<input type="text" placeholder="名稱（例如 apk_upload_token）" data-secret-name-input class="jonaminz-admin-retention-input" style="width:auto;min-width:220px;">' +
              '<input type="text" placeholder="值" data-secret-value-input class="jonaminz-admin-retention-input" style="width:auto;min-width:280px;">' +
              '<button type="submit" class="jonaminz-toolkit-open-btn">儲存</button>' +
            '</form>' +
            '<div data-secret-result></div>';

          el.querySelector("[data-add-secret-toggle]").addEventListener("click", function () {
            el.querySelector("[data-add-secret-form]").hidden = false;
            this.hidden = true;
            el.querySelector("[data-secret-name-input]").focus();
          });

          el.querySelector("[data-add-secret-form]").addEventListener("submit", function (event) {
            event.preventDefault();
            var name = el.querySelector("[data-secret-name-input]").value.trim();
            var value = el.querySelector("[data-secret-value-input]").value;
            if (!name || !value) {
              el.querySelector("[data-secret-result]").textContent = "名稱跟值都要填";
              return;
            }
            window.JonaminzBackend.setAgentSecret({ token: token, name: name, value: value })
              .then(function (saveResponse) {
                if (!saveResponse || !saveResponse.ok) {
                  el.querySelector("[data-secret-result]").textContent =
                    "失敗：" + ((saveResponse && saveResponse.error) || "未知錯誤");
                  return;
                }
                refresh();
              })
              .catch(function (error) {
                el.querySelector("[data-secret-result]").textContent =
                  "失敗：" + (error && error.message ? error.message : String(error));
              });
          });

          el.querySelector("[data-secret-list]").addEventListener("click", function (event) {
            var btn = event.target.closest("[data-delete-secret]");
            if (!btn) return;
            var name = btn.dataset.deleteSecret;
            if (!window.confirm("確定要刪除「" + name + "」這個密鑰嗎？如果 agent 還在用它，之後就會失效。")) return;
            window.JonaminzBackend.deleteAgentSecret({ token: token, name: name })
              .then(function (deleteResponse) {
                if (!deleteResponse || !deleteResponse.ok) {
                  el.querySelector("[data-secret-result]").textContent =
                    "失敗：" + ((deleteResponse && deleteResponse.error) || "未知錯誤");
                  return;
                }
                refresh();
              })
              .catch(function (error) {
                el.querySelector("[data-secret-result]").textContent =
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
        '<p class="jonaminz-admin-section-title">Agent 存取（給自動化 build/上傳用的密鑰保管箱）</p>' +
        '<div data-agent-secrets>讀取中...</div>' +
      '</section>';
    bindCopyButtons(root);
  }

  function init() {
    window.JonaminzIdentity.requireLogin().then(function () {
      try {
        render();
        window.JonaminzLoading.done(READY_TASK);
        renderAgentSecretsSection();
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
