/*
檔案位置：jonaminz/pages/admin/design/assets/js/app.js
用途：後台「專案視覺方向」展示頁自己的業務入口（水庫下游層）。

2026-07-13 從 demo 資料改成正式架構：讀既有的 listPendingContracts
action（公開唯讀，回傳最近 50 筆 snapshot，每筆帶 previousApproved——
那個欄位才是「這個 project+environment 現在真的生效中」的合約內容，
來自 contract_active_snapshots 表，不是用某一筆 row 自己的 status
去猜；status 只代表那一筆 snapshot 自己有沒有被核准，不代表它是不是
目前生效的那份，同一個專案的 pending/rejected 列都可能混在最近 50 筆
裡）。每個 project_id 只取第一次遇到（rows 本身已經是 submitted_at
desc 排序，第一筆＝最新），從 previousApproved.rawContract.app 讀
title/description/visualIdentity——沒有 visualIdentity 的專案顯示
中性樣式＋提示文字，不是隱藏或報錯。

jonaminz 自己不是 Contract 的登記者（它是平台本身，不用對自己送合約），
JONAMINZ_CORE_ENTRY 是唯一寫死在這裡的一筆，形狀跟真實資料一致方便
共用同一套渲染邏輯。

外部專案清單是背景資訊，不影響 loading gate：讀取失敗只顯示錯誤文字，
不會擋住頁面本身的 all-ready（跟 pages/admin/ 的既有慣例一致）。
*/
(function () {
  "use strict";

  var READY_TASK = "app-ready";

  var JONAMINZ_CORE_ENTRY = {
    projectId: "jonaminz",
    isCore: true,
    app: {
      title: "Jonaminz",
      description: "平台本身選定的方向：燕麥色亞麻底＋沉墨藍，slab serif 標題帶手感，日常使用最舒服的一種。",
      visualIdentity: {
        name: "亞麻米 · Flax & Ink",
        tagline: "日常、耐看、有手感",
        palette: {
          background: "#efeae0",
          surface: "#fbfaf5",
          accent: "#1f3a5f",
          accent2: "#7c7468",
          ink: "#262220"
        },
        typography: { display: "Rockwell, \"Sitka Text\", Georgia, \"Noto Serif TC\", serif" }
      }
    }
  };

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  }

  // rows 已經是 submitted_at desc；同一個 projectId 只取第一次遇到的那筆，
  // 從它的 previousApproved 讀「現在真的生效中」的合約內容（不是這筆
  // snapshot 本身的 rawContract，那個可能是還沒核准或已否決的新提案）。
  function extractActiveProjects(rows) {
    var seen = {};
    var projects = [];

    rows.forEach(function (row) {
      if (seen[row.projectId]) return;
      seen[row.projectId] = true;

      var active = row.previousApproved;
      if (!active || !active.rawContract || !active.rawContract.app) return;

      projects.push({ projectId: row.projectId, isCore: false, app: active.rawContract.app });
    });

    return projects;
  }

  // 色塊背景是專案自己宣告的任意顏色，深淺不可預期，CSS 沒辦法寫死文字
  // 顏色──算相對亮度（WCAG 簡化版）決定用白字還是深字，深色塊配白字、
  // 淺色塊配深字，不然深色主色配深色預設文字會整塊看不清楚。
  function contrastTextColor(hex) {
    var match = /^#([0-9a-fA-F]{6})$/.exec(hex || "");
    if (!match) return "#14171a";
    var value = match[1];
    var r = parseInt(value.slice(0, 2), 16) / 255;
    var g = parseInt(value.slice(2, 4), 16) / 255;
    var b = parseInt(value.slice(4, 6), 16) / 255;
    var luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    return luminance > 0.55 ? "#14171a" : "#f7f0e5";
  }

  function swatchHtml(label, hex) {
    if (!hex) return "";
    var textColor = contrastTextColor(hex);
    return (
      '<span class="jonaminz-design-swatch" style="background:' + escapeHtml(hex) + ';color:' + textColor + '">' +
        '<span class="jonaminz-design-swatch-label">' + escapeHtml(label) + '</span>' +
        '<span class="jonaminz-design-swatch-hex">' + escapeHtml(hex) + '</span>' +
      '</span>'
    );
  }

  // 沒宣告 visualIdentity 的專案用 jonaminz 自己的預設 tokens 當中性樣式——
  // 不是空白、不是報錯，就是「還沒特別宣告」的老實呈現。
  var NEUTRAL_PALETTE = { background: "var(--color-bg)", surface: "var(--color-bg)", accent: "var(--color-primary)", ink: "var(--color-text)" };
  var NEUTRAL_FONT = "var(--font-sans)";

  function projectCardHtml(project) {
    var app = project.app;
    var vi = app.visualIdentity || {};
    var palette = vi.palette || NEUTRAL_PALETTE;
    var displayFont = (vi.typography && vi.typography.display) || NEUTRAL_FONT;
    var hasIdentity = !!vi.name;

    var cardStyle =
      "--vi-bg:" + (palette.background || NEUTRAL_PALETTE.background) + ";" +
      "--vi-surface:" + (palette.surface || palette.background || NEUTRAL_PALETTE.surface) + ";" +
      "--vi-accent:" + (palette.accent || NEUTRAL_PALETTE.accent) + ";" +
      "--vi-ink:" + (palette.ink || "inherit") + ";" +
      "--vi-font:" + displayFont;

    return (
      '<article class="jonaminz-design-card' + (hasIdentity ? "" : " jonaminz-design-card--neutral") + '" style="' + escapeHtml(cardStyle) + '">' +
        '<div class="jonaminz-design-card-head">' +
          '<span class="jonaminz-design-project-id">' + escapeHtml(project.projectId) + (project.isCore ? " · Core" : "") + '</span>' +
          '<h2 class="jonaminz-design-name">' + escapeHtml(vi.name || app.title || project.projectId) + '</h2>' +
          (vi.tagline ? '<p class="jonaminz-design-tagline">' + escapeHtml(vi.tagline) + '</p>' : "") +
        '</div>' +

        '<div class="jonaminz-design-preview">' +
          '<h3 class="jonaminz-design-headline">' + escapeHtml(app.title || project.projectId) + '</h3>' +
          (app.description ? '<p class="jonaminz-design-body">' + escapeHtml(app.description) + '</p>' : "") +
          '<button class="jonaminz-design-btn" type="button" disabled>進入</button>' +
        '</div>' +

        (hasIdentity
          ? '<div class="jonaminz-design-swatches">' +
              swatchHtml("底色", palette.background) +
              swatchHtml("卡片", palette.surface) +
              swatchHtml("主色", palette.accent) +
              swatchHtml("點綴", palette.accent2) +
              swatchHtml("文字", palette.ink) +
            '</div>'
          : '<p class="jonaminz-design-none">這個專案還沒在 Contract 裡宣告 visualIdentity，套用中性樣式。</p>') +
      '</article>'
    );
  }

  function render(projects) {
    var root = document.querySelector("[data-app-root]");
    if (!root) return;

    root.innerHTML =
      '<p class="jonaminz-eyebrow">Jonaminz Admin</p>' +
      '<h1 class="jonaminz-design-title">專案視覺方向</h1>' +
      '<p class="jonaminz-design-intro">每個專案自己在 Contract 裡宣告一套視覺調性，不用跟平台或彼此統一——這裡讀的是實際已核准生效中的合約資料。</p>' +
      '<div class="jonaminz-design-grid">' +
        projects.map(projectCardHtml).join("") +
      '</div>';
  }

  function loadAndRender() {
    var root = document.querySelector("[data-app-root]");

    if (!window.JonaminzBackend || typeof window.JonaminzBackend.listPendingContracts !== "function") {
      render([JONAMINZ_CORE_ENTRY]);
      if (root) {
        var note = document.createElement("p");
        note.className = "jonaminz-design-error";
        note.textContent = "外部專案清單讀取失敗：後端尚未載入。";
        root.appendChild(note);
      }
      return;
    }

    window.JonaminzBackend.listPendingContracts()
      .then(function (response) {
        var rows = (response && response.rows) || [];
        var externalProjects = extractActiveProjects(rows);
        render([JONAMINZ_CORE_ENTRY].concat(externalProjects));
      })
      .catch(function (error) {
        render([JONAMINZ_CORE_ENTRY]);
        var note = document.createElement("p");
        note.className = "jonaminz-design-error";
        note.textContent = "外部專案清單讀取失敗：" + (error && error.message ? error.message : String(error));
        if (root) root.appendChild(note);
      });
  }

  function init() {
    window.JonaminzIdentity.requireLogin().then(function () {
      try {
        // 先用 core-only 畫面立刻放行 gate，外部專案清單是背景資訊，
        // 不用等它才 all-ready（跟 pages/admin/ 的既有慣例一致）。
        render([JONAMINZ_CORE_ENTRY]);
        window.JonaminzLoading.done(READY_TASK);
        loadAndRender();
      } catch (error) {
        console.error("[jonaminz] admin/design app.js init failed", error);
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
