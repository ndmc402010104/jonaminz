/*
檔案位置：jonaminz/pages/minz/assets/js/app.js
用途：Minz 個人門戶頁自己的業務入口（水庫下游層）。

2026-07-13 從骨架佔位頁改成 Minz Page v0.1 Phase 1（純展示骨架）：
見 docs/minz-page/README.md、AI_CONTEXT/DECISIONS.md §六。這次只做
「公開頁」與「展示資料層」的骨架，不做後台策展流程（Phase 2）、不接
技術方案（Phase 3，那個專案本身都還沒開始）、不做訪客授權（Phase 4）。

registry-driven：分類與展示項目都是下面 CATEGORIES／LATEST 這組資料
驅動渲染，不是寫死在 HTML 裡的一張一張卡片——之後要新增/改名/合併/
調整順序分類，只需要改這份資料，不用碰頁面骨架或 CSS 選擇器。

MOCK DATA 警語：CATEGORIES／LATEST 裡的內容全部是佔位假資料（沒有
真實旅程可以引用，因為「技術方案」本身還沒開始，見
docs/minz-page/README.md §6.5／§13），naming 刻意標成「（示例）」，
不要被下一個 agent 誤當成真實內容。之後技術方案有真的遊記可以提交時，
這裡的假資料要整批換成從真實來源引用的展示項目（sourceProject／
sourceId／sourceChapterId 等，見規格 §13.2），不是繼續加假資料。

首頁沒有用共用的 [data-jonaminz-header] 元素（跟首頁 index.html 同一個
做法，見 assets/js/app.js 的說明），身分登入狀態透過
window.JonaminzIdentity.mount() 插進本頁自己的 [data-nav-identity]。
*/
(function () {
  "use strict";

  var READY_TASK = "app-ready";

  // ---------------------------------------------------------------------
  // Mock data（Phase 1 展示骨架用，見檔頭警語）
  // ---------------------------------------------------------------------

  var CATEGORIES = [
    {
      id: "castle-adventures",
      title: "城堡冒險",
      icon: "castle",
      tagline: "天守、石垣與山城的印章收集",
      accentVar: "--color-minz-accent",
      items: [
        { title: "犬山城（示例）", place: "愛知・犬山" },
        { title: "松本城（示例）", place: "長野・松本" },
        { title: "彥根城（示例）", place: "滋賀・彥根" }
      ]
    },
    {
      id: "transit-thrills",
      title: "交通震撼",
      icon: "train",
      tagline: "火車、地圖與行李箱的旅程紀錄",
      accentVar: "--color-minz-accent-2",
      items: [
        { title: "夜行巴士初體驗（示例）", place: "大阪→東京" },
        { title: "在來線迷路記（示例）", place: "名古屋" },
        { title: "月台便當地圖（示例）", place: "新幹線沿線" }
      ]
    },
    {
      id: "good-finds",
      title: "好物研究",
      icon: "bowl",
      tagline: "麵包、甜點與餐具的小小考察",
      accentVar: "--color-minz-accent",
      items: [
        { title: "鳥貴族總本家（示例）", place: "大阪" },
        { title: "早餐吐司排行榜（示例）", place: "名古屋" },
        { title: "居酒屋小皿收藏（示例）", place: "京都" }
      ]
    },
    {
      id: "cute-collection",
      title: "可愛收藏",
      icon: "ribbon",
      tagline: "貼紙、御守與紀念章的收藏角落",
      accentVar: "--color-minz-highlight",
      items: [
        { title: "PIYORIN 御守（示例）", place: "名古屋" },
        { title: "犬山城御朱印帳（示例）", place: "愛知" },
        { title: "車站限定貼紙（示例）", place: "JR 東海" }
      ]
    }
  ];

  var LATEST = [
    { title: "犬山城（示例）", categoryId: "castle-adventures" },
    { title: "鳥貴族總本家（示例）", categoryId: "good-finds" },
    { title: "PIYORIN 御守（示例）", categoryId: "cute-collection" },
    { title: "夜行巴士初體驗（示例）", categoryId: "transit-thrills" }
  ];

  var ICON_PATHS = {
    // 極簡線條圖示，只是分類的視覺標記，不是真的照片——見檔頭 mock data 說明。
    castle: "M4 20h16M6 20v-7l2-2v-3h2V6l2-2 2 2v2h2v3l2 2v7M9 20v-4h6v4",
    train: "M6 4h12a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z M4 17l-2 4M20 17l2 4M8 10h8M9 14h.01M15 14h.01",
    bowl: "M4 11h16a8 6 0 0 1-16 0Z M8 11c0-3 2-6 4-6s4 3 4 6",
    ribbon: "M12 3l2.5 4.8L20 9l-4 4 1 5.5L12 16l-5 2.5 1-5.5-4-4 5.5-1.2Z"
  };

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  }

  function iconSvg(name) {
    var d = ICON_PATHS[name] || ICON_PATHS.ribbon;
    return (
      '<svg class="minz-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
      'stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="' + d + '"/></svg>'
    );
  }

  // ---------------------------------------------------------------------
  // 渲染（全部從上面的 registry 資料生成，不寫死逐項 HTML）
  // ---------------------------------------------------------------------

  function renderTabIndex(root) {
    var links = CATEGORIES.map(function (cat) {
      return '<a href="#' + cat.id + '" class="minz-tab" style="--tab-accent:var(' + cat.accentVar + ')">' +
        iconSvg(cat.icon) + '<span>' + escapeHtml(cat.title) + '</span></a>';
    });
    links.unshift('<a href="#latest" class="minz-tab minz-tab--latest">最新</a>');
    links.push('<a href="#about" class="minz-tab minz-tab--about">About</a>');
    root.innerHTML = links.join("");
  }

  function renderBottomNav(root) {
    var links = CATEGORIES.map(function (cat) {
      return '<a href="#' + cat.id + '">' + iconSvg(cat.icon) + '<span>' + escapeHtml(cat.title) + '</span></a>';
    });
    links.unshift('<a href="#latest"><span class="minz-bottom-nav-dot" aria-hidden="true"></span><span>最新</span></a>');
    root.innerHTML = links.join("");
  }

  function renderLatest(root) {
    if (!LATEST.length) {
      root.parentElement.setAttribute("hidden", "");
      return;
    }
    root.innerHTML = LATEST.map(function (item) {
      var cat = CATEGORIES.filter(function (c) { return c.id === item.categoryId; })[0];
      var accentVar = cat ? cat.accentVar : "--color-minz-accent";
      return (
        '<a class="minz-sticker" href="#' + escapeHtml(item.categoryId) + '" style="--sticker-accent:var(' + accentVar + ')">' +
          '<span class="minz-sticker-cover"></span>' +
          '<span class="minz-sticker-title">' + escapeHtml(item.title) + '</span>' +
        '</a>'
      );
    }).join("");
  }

  function categorySectionHtml(cat) {
    // 空分類自動隱藏（規格 §16 第 12 條）：items 是空陣列就整段不渲染，
    // 不是渲染出「敬請期待」佔位卡片。
    if (!cat.items || !cat.items.length) return "";

    var itemsHtml = cat.items.map(function (item) {
      return (
        '<article class="minz-item">' +
          '<span class="minz-item-cover"></span>' +
          '<h3 class="minz-item-title">' + escapeHtml(item.title) + '</h3>' +
          '<p class="minz-item-place">' + escapeHtml(item.place || "") + '</p>' +
        '</article>'
      );
    }).join("");

    return (
      '<section class="minz-category" id="' + escapeHtml(cat.id) + '" style="--category-accent:var(' + cat.accentVar + ')">' +
        '<div class="minz-category-head">' +
          iconSvg(cat.icon) +
          '<div>' +
            '<h2 class="minz-category-title">' + escapeHtml(cat.title) + '</h2>' +
            '<p class="minz-category-tagline">' + escapeHtml(cat.tagline) + '</p>' +
          '</div>' +
        '</div>' +
        '<div class="minz-item-grid">' + itemsHtml + '</div>' +
      '</section>'
    );
  }

  function renderCategories(root) {
    root.innerHTML = CATEGORIES.map(categorySectionHtml).join("");
  }

  function mountIdentity() {
    if (!window.JonaminzIdentity || typeof window.JonaminzIdentity.mount !== "function") return;
    var container = document.querySelector("[data-nav-identity]");
    if (!container) return;

    // 跟首頁 assets/js/app.js 同一個做法：本頁沒有共用
    // [data-jonaminz-header]，用 header.js 暴露的 mount() 插進自己的
    // nav-identity 容器，不重寫一份 token 判斷邏輯。
    window.JonaminzIdentity.mount(container, {
      wrapperClassName: "nav-identity",
      greetingClassName: "nav-identity-greeting",
      linkClassName: "",
      logoutClassName: "",
      adminLinkClassName: "",
      showAdminLink: true
    });
  }

  function init() {
    try {
      var tabIndexRoot = document.querySelector("[data-tab-index]");
      var bottomNavRoot = document.querySelector("[data-bottom-nav]");
      var latestRoot = document.querySelector("[data-latest-strip]");
      var categoriesRoot = document.querySelector("[data-categories]");

      if (tabIndexRoot) renderTabIndex(tabIndexRoot);
      if (bottomNavRoot) renderBottomNav(bottomNavRoot);
      if (latestRoot) renderLatest(latestRoot);
      if (categoriesRoot) renderCategories(categoriesRoot);

      mountIdentity();
      window.JonaminzLoading.done(READY_TASK);
    } catch (error) {
      console.error("[jonaminz] minz app.js init failed", error);
      window.JonaminzLoading.fail(READY_TASK, error);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
