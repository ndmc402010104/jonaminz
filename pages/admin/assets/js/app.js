/*
檔案位置：jonaminz/pages/admin/assets/js/app.js
用途：後台頁自己的業務入口（水庫下游層）。前端品質重建計畫階段③
（2026-07-12）：從路線佔位卡片升級成 dashboard——登入身分徽章、
pending Contract 數量、外部專案回報清單、Theme/Contracts 快速入口。
只能回報自己的 loading task，不可以自己決定 css/shell ready。

整站後台加登入保護：init() 先過 window.JonaminzIdentity.requireLogin()
這關（見 assets/js/header.js），沒登入會被導去 /pages/login/?next=...，
不會執行到下面的 render()。requireLogin() resolve 出登入身分字串
（"jonathan"/"minz"），拿來畫身分徽章。

不動 worker.js：pending 數量／外部專案回報都是既有 action
（listPendingContracts／listExternalAppRegistrations）前端聚合，兩者都是
背景資訊，不影響 loading gate——讀取失敗只在各自的區塊顯示文字說明，
不會擋住頁面本身的 all-ready（跟既有的 registrations 區塊同一個原則）。
*/
(function () {
  "use strict";

  var READY_TASK = "app-ready";
  var IDENTITY_LABEL = { jonathan: "Jonathan", minz: "Minz" };

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  }

  function identityBadgeHtml(identity) {
    var label = IDENTITY_LABEL[identity] || identity || "?";
    return (
      '<span class="jonaminz-admin-identity">' +
        '<span class="jonaminz-identity-badge jonaminz-identity-badge--' + escapeHtml(identity || "") + '">' +
          escapeHtml(label.charAt(0).toUpperCase()) +
        '</span>' +
        escapeHtml(label) + ' 你好' +
      '</span>'
    );
  }

  function render(identity) {
    var root = document.querySelector("[data-app-root]");
    if (!root) return;

    root.innerHTML =
      identityBadgeHtml(identity) +
      '<p class="jonaminz-eyebrow">Jonaminz Admin</p>' +
      '<h1 class="jonaminz-admin-title">後台</h1>' +
      '<div class="jonaminz-admin-links">' +
        '<a class="jonaminz-admin-link-card" href="/pages/admin/theme/">' +
          '<span class="jonaminz-admin-link-title">Theme</span>' +
          '<span class="jonaminz-admin-link-desc">CSS 疊加架構展示櫃 / 未來的 playground</span>' +
        '</a>' +
        '<a class="jonaminz-admin-link-card" href="/pages/admin/contracts/">' +
          '<span class="jonaminz-admin-link-title">Contract 核准</span>' +
          '<span class="jonaminz-admin-link-desc" data-pending-status>讀取待審數量中...</span>' +
        '</a>' +
      '</div>';
  }

  // pending 數量跟 pages/admin/contracts/ 用同一支 action、同一個
  // status === "pending" 篩選邏輯，兩邊數字保證一致（不是各自算一套）。
  function renderPendingStatus() {
    var el = document.querySelector("[data-pending-status]");
    if (!el) return;

    if (!window.JonaminzBackend || typeof window.JonaminzBackend.listPendingContracts !== "function") {
      el.textContent = "待審數量讀取失敗：後端尚未載入";
      return;
    }

    window.JonaminzBackend.listPendingContracts()
      .then(function (response) {
        var rows = (response && response.rows) || [];
        var pendingCount = rows.filter(function (row) { return row.status === "pending"; }).length;
        el.textContent = pendingCount > 0 ? (pendingCount + " 筆待審核") : "無待審";
      })
      .catch(function (error) {
        el.textContent = "待審數量讀取失敗：" + (error && error.message ? error.message : String(error));
      });
  }

  function registrationRowHtml(row) {
    return (
      '<div class="jonaminz-admin-registration-row">' +
        '<strong>' + escapeHtml(row.title || row.project_id) + '</strong>' +
        '<span>' + escapeHtml(row.project_id) + '</span>' +
        '<span>' + escapeHtml(row.version || "") + '</span>' +
        '<span>最後回報：' + escapeHtml(row.last_seen_at || "-") + '</span>' +
      '</div>'
    );
  }

  function renderRegistrations() {
    var container = document.querySelector("[data-admin-registrations]");
    if (!container) return;

    if (!window.JonaminzBackend || typeof window.JonaminzBackend.listExternalAppRegistrations !== "function") {
      container.textContent = "後端尚未載入。";
      return;
    }

    container.textContent = "讀取中...";

    window.JonaminzBackend.listExternalAppRegistrations()
      .then(function (response) {
        var rows = (response && response.rows) || [];

        if (!rows.length) {
          container.textContent = "目前沒有外部專案回報過。";
          return;
        }

        container.innerHTML = rows.map(registrationRowHtml).join("");
      })
      .catch(function (error) {
        container.textContent = "讀取失敗：" + (error && error.message ? error.message : String(error));
      });
  }

  function init() {
    window.JonaminzIdentity.requireLogin().then(function (identity) {
      try {
        render(identity);
        window.JonaminzLoading.done(READY_TASK);
        renderPendingStatus();
        renderRegistrations();
      } catch (error) {
        console.error("[jonaminz] admin app.js init failed", error);
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
