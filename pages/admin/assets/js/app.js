/*
檔案位置：jonaminz/pages/admin/assets/js/app.js
用途：後台頁自己的業務入口（水庫下游層）。目前只是路線佔位：先確認登入按鈕 ->
後台這條路走得通，區塊內容之後再擴充，先給一個連到 skhps.jonaminz.com 的連結。
只能回報自己的 loading task，不可以自己決定 css/shell ready。

整站後台加登入保護：init() 先過 window.JonaminzIdentity.requireLogin()
這關（見 assets/js/header.js），沒登入會被導去 /pages/login/?next=...，
不會執行到下面的 render()。

外部專案回報清單（registerExternalApp）是背景資訊，不影響 loading gate：
讀取失敗只顯示錯誤文字，不會擋住頁面本身的 all-ready。
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
        '<a class="jonaminz-admin-link-card" href="/pages/admin/contracts/">' +
          '<span class="jonaminz-admin-link-title">Contract 核准</span>' +
          '<span class="jonaminz-admin-link-desc">Platform Integration 外部專案的 pending Contract 審核</span>' +
        '</a>' +
      '</div>';
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
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
    window.JonaminzIdentity.requireLogin().then(function () {
      try {
        render();
        window.JonaminzLoading.done(READY_TASK);
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
