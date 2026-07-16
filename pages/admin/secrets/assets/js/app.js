/*
檔案位置：jonaminz/pages/admin/secrets/assets/js/app.js
用途：後台「Agent 密鑰保管箱」頁的業務入口（水庫下游層）。只能回報自己的
loading task，不可以自己決定 css/shell ready。

2026-07-16：從 pages/admin/toolkit/ 搬過來獨立成頁（見 index.html 檔頭
說明）。UI 也順便重畫過（使用者原話「這個table實在太醜了」）：
- 每筆密鑰是一張卡片，名稱用等寬字體＋鑰匙符號區隔，右側兩個動作各自
  有清楚的視覺角色：「覆蓋」中性色、「刪除」危險色（跟其他頁面刪除按鈕
  一致）。
- 「覆蓋」按鈕點了直接把名稱帶進新增表單、展開表單、游標跳到值欄位——
  使用者原話「就不用重打名稱」，不用手動複製貼上舊名稱。
- 新增表單改成有 label 的直式表單（不是只有 placeholder 佔位字），
  加「取消」按鈕收合表單，不用重新整理頁面才能關掉。
*/
(function () {
  "use strict";

  var READY_TASK = "app-ready";

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  }

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
      '<div class="jonaminz-secret-card" data-secret-row="' + escapeHtml(secret.name) + '">' +
        '<div class="jonaminz-secret-card-info">' +
          '<span class="jonaminz-secret-card-name">🔑 ' + escapeHtml(secret.name) + '</span>' +
          '<span class="jonaminz-secret-card-meta">上次更新：' + escapeHtml(formatLocalDateTime(secret.updated_at)) + '</span>' +
        '</div>' +
        '<div class="jonaminz-secret-card-actions">' +
          '<button type="button" class="jonaminz-secret-btn" data-overwrite-secret="' + escapeHtml(secret.name) + '">覆蓋</button>' +
          '<button type="button" class="jonaminz-secret-btn jonaminz-secret-btn--danger" data-delete-secret="' + escapeHtml(secret.name) + '">刪除</button>' +
        '</div>' +
      '</div>'
    );
  }

  function render() {
    var root = document.querySelector("[data-app-root]");
    if (!root) return;
    root.innerHTML = '<div data-agent-secrets>讀取中...</div>';
  }

  function renderAgentSecretsSection() {
    var el = document.querySelector("[data-agent-secrets]");
    if (!el) return;
    var token = (window.JonaminzIdentity && window.JonaminzIdentity.readToken)
      ? window.JonaminzIdentity.readToken() : null;

    function openForm(prefillName) {
      var form = el.querySelector("[data-add-secret-form]");
      var toggleBtn = el.querySelector("[data-add-secret-toggle]");
      form.hidden = false;
      if (toggleBtn) toggleBtn.hidden = true;
      var nameInput = el.querySelector("[data-secret-name-input]");
      var valueInput = el.querySelector("[data-secret-value-input]");
      nameInput.value = prefillName || "";
      valueInput.value = "";
      (prefillName ? valueInput : nameInput).focus();
    }

    function closeForm() {
      var form = el.querySelector("[data-add-secret-form]");
      var toggleBtn = el.querySelector("[data-add-secret-toggle]");
      form.hidden = true;
      form.reset();
      if (toggleBtn) toggleBtn.hidden = false;
    }

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
            '<div class="jonaminz-secret-list" data-secret-list>' +
              (secrets.length
                ? secrets.map(agentSecretRowHtml).join("")
                : '<p class="jonaminz-secret-empty">目前沒有存任何密鑰，按下面「+ 新增密鑰」加第一筆。</p>') +
            '</div>' +
            '<button type="button" class="jonaminz-secret-btn jonaminz-secret-btn--primary" data-add-secret-toggle>+ 新增密鑰</button>' +
            '<form class="jonaminz-secret-form" data-add-secret-form hidden>' +
              '<label class="jonaminz-secret-form-field">' +
                '<span>名稱</span>' +
                '<input type="text" placeholder="例如 apk_upload_token" data-secret-name-input>' +
              '</label>' +
              '<label class="jonaminz-secret-form-field">' +
                '<span>值</span>' +
                '<input type="text" placeholder="要存的內容" data-secret-value-input>' +
              '</label>' +
              '<div class="jonaminz-secret-form-actions">' +
                '<button type="submit" class="jonaminz-secret-btn jonaminz-secret-btn--primary">儲存</button>' +
                '<button type="button" class="jonaminz-secret-btn" data-cancel-secret-form>取消</button>' +
              '</div>' +
            '</form>' +
            '<div data-secret-result></div>';

          el.querySelector("[data-add-secret-toggle]").addEventListener("click", function () {
            openForm(null);
          });

          el.querySelector("[data-cancel-secret-form]").addEventListener("click", function () {
            closeForm();
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
            var overwriteBtn = event.target.closest("[data-overwrite-secret]");
            if (overwriteBtn) {
              openForm(overwriteBtn.dataset.overwriteSecret);
              return;
            }
            var deleteBtn = event.target.closest("[data-delete-secret]");
            if (deleteBtn) {
              var name = deleteBtn.dataset.deleteSecret;
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
            }
          });
        })
        .catch(function (error) {
          el.textContent = "讀取失敗：" + (error && error.message ? error.message : String(error));
        });
    }
    refresh();
  }

  function init() {
    window.JonaminzIdentity.requireLogin().then(function () {
      try {
        render();
        window.JonaminzLoading.done(READY_TASK);
        renderAgentSecretsSection();
      } catch (error) {
        console.error("[jonaminz] admin/secrets app.js init failed", error);
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
