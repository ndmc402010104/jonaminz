/*
檔案位置：jonaminz/pages/jonathan/assets/js/app.js
用途：Jonathan 公開門戶頁自己的業務入口（水庫下游層）。

2026-07-13 從簡介＋單張連結卡整份改寫成「Jonathan 公開頁 v1」骨架，見
docs/jonathan-page/README.md、AI_CONTEXT/DECISIONS.md §七。

CONTENT_ITEMS 是 registry-driven 的公開內容清單（規格 §16）：每個項目
自己決定要不要出現在導覽（navigation）、要不要在首頁強調
（featured）、有哪些操作（actions，例如「進入系統」launch 動作）。
目前只有一個真實項目（SKHPSv2），projects／collections／professional
這類尚未存在的分類不建立任何佔位資料——沒有資料就不渲染那個分類的
標題或空卡片，不是「敬請期待」。SKHPSv2 目前只有 launch 一個動作，
「了解更多」對應的專案詳細頁（規格範例的
/jonathan/projects/skhpsv2）還沒真的存在，所以本輪不生出第二顆連去
空頁面的按鈕，等那個目的地真的存在再加，不是為了照抄範例湊兩顆按鈕。

SKHPS 連結沿用既有邏輯（本機開發連本機 dev server 固定 port、正式站連
skhps.jonaminz.com），完全沒改動，見下方 resolveSkhpsUrl() 註解。

精密展示艙（.jonathan-pod）本體與動畫完全是 CSS 驅動（見
page-jonathan.css 的 @keyframes），這裡只加一層可選的滑鼠視差
微幅位移增強——JS 失敗或停用時，CSS 版本原樣顯示，不影響核心資訊與
兩個主要按鈕的可用性（規格 §18 效能要求）。
*/
(function () {
  "use strict";

  var READY_TASK = "app-ready";
  var LOOPBACK_HOSTNAME_PATTERN = /^(localhost|127\.0\.0\.1)$/;
  var SKHPS_DEV_SERVER_PORT = 5501;

  // ---------------------------------------------------------------------
  // Registry-driven 公開內容（規格 §16）。之後新增 projects / collections /
  // professional 分類，只需要在這裡加項目，不用碰頁面骨架或 CSS 選擇器。
  // ---------------------------------------------------------------------

  var CONTENT_ITEMS = [
    {
      id: "skhpsv2",
      owner: "jonathan",
      type: "app",
      title: "SKHPSv2",
      summary: "新光整形外科目前使用中的數位工作系統。",
      accessNote: "院內授權使用",
      featured: true,
      actions: [
        { type: "launch", label: "進入系統", resolveUrl: resolveSkhpsUrl }
      ]
    }
  ];

  function resolveSkhpsUrl() {
    if (LOOPBACK_HOSTNAME_PATTERN.test(window.location.hostname)) {
      return window.location.protocol + "//" + window.location.hostname + ":" + SKHPS_DEV_SERVER_PORT + "/";
    }
    return "https://skhps.jonaminz.com";
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  }

  function actionHtml(item, action) {
    var href = typeof action.resolveUrl === "function" ? action.resolveUrl() : (action.url || "#");
    var attrs = action.type === "launch" && /^https?:\/\//.test(href)
      ? ' target="_blank" rel="noopener"'
      : "";
    return '<a class="jonathan-item-btn" href="' + escapeHtml(href) + '"' + attrs + '>' + escapeHtml(action.label) + '</a>';
  }

  function itemCardHtml(item) {
    return (
      '<article class="jonathan-item-card">' +
        '<h2 class="jonathan-item-title">' + escapeHtml(item.title) + '</h2>' +
        '<p class="jonathan-item-summary">' + escapeHtml(item.summary) + '</p>' +
        '<div class="jonathan-item-actions">' +
          item.actions.map(function (action) { return actionHtml(item, action); }).join("") +
        '</div>' +
        (item.accessNote ? '<p class="jonathan-item-access-note">' + escapeHtml(item.accessNote) + '</p>' : "") +
      '</article>'
    );
  }

  // 目前沒有內容的分類（projects/collections/professional）完全不出現在
  // DOM 裡——不渲染任何標題或「即將推出」占位，規格明文禁止空卡片。
  function renderContentItems(root) {
    if (!CONTENT_ITEMS.length) {
      root.setAttribute("hidden", "");
      return;
    }
    root.innerHTML = CONTENT_ITEMS.map(itemCardHtml).join("");
  }

  function mountIdentity() {
    if (!window.JonaminzIdentity || typeof window.JonaminzIdentity.mount !== "function") return;
    var container = document.querySelector("[data-nav-identity]");
    if (!container) return;

    window.JonaminzIdentity.mount(container, {
      wrapperClassName: "nav-identity",
      greetingClassName: "nav-identity-greeting",
      linkClassName: "jonathan-nav-link",
      logoutClassName: "jonathan-nav-link jonathan-nav-link--button",
      adminLinkClassName: "jonathan-nav-link",
      showAdminLink: true
    });
  }

  // 極輕微滑鼠視差（規格 §6：小幅游標視差），只在有滑鼠、且使用者沒有
  // 要求減少動態時才加；觸控裝置沒有 mousemove，自然不會觸發。
  function wirePodParallax() {
    var pod = document.querySelector("[data-jonathan-pod]");
    if (!pod) return;
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    var hero = document.querySelector(".jonathan-hero-right");
    if (!hero) return;

    hero.addEventListener("mousemove", function (event) {
      var rect = hero.getBoundingClientRect();
      var relX = (event.clientX - rect.left) / rect.width - 0.5;
      var relY = (event.clientY - rect.top) / rect.height - 0.5;
      pod.style.transform = "translate(" + (relX * 10).toFixed(1) + "px, " + (relY * 10).toFixed(1) + "px)";
    });

    hero.addEventListener("mouseleave", function () {
      pod.style.transform = "";
    });
  }

  function init() {
    try {
      var contentRoot = document.querySelector("[data-content-root]");
      if (contentRoot) renderContentItems(contentRoot);

      mountIdentity();
      wirePodParallax();

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
