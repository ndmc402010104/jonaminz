/*
檔案位置：jonaminz/pages/admin/assets/js/app.js
用途：後台首頁自己的業務入口（水庫下游層）。只能回報自己的 loading
task，不可以自己決定 css/shell ready。

2026-07-13：從「置中小卡片＋兩個連結」改版成「安靜的家」（見
index.html／page-admin.css 檔頭說明）。三個入口（Theme／Contract 核准／
專案視覺方向）不是統一尺寸——Contract 核准依待審數量動態決定要不要放大
成「需要注意」的樣子，其餘時候跟其他入口同一層級。「專案視覺方向」
（/pages/admin/design/）過去完全沒有任何頁面連過去，這次補上，不然
那頁形同孤兒頁面。

整站後台加登入保護：init() 先過 window.JonaminzIdentity.requireLogin()
這關（見 assets/js/header.js），沒登入會被導去 /pages/login/?next=...，
不會執行到下面的 render()。requireLogin() resolve 出登入身分字串
（"jonathan"/"minz"），拿來畫身分徽章。

不動 worker.js：pending 數量／外部專案回報都是既有 action
（listPendingContracts／listExternalAppRegistrations）前端聚合，兩者都是
背景資訊，不影響 loading gate——讀取失敗只在各自的區塊顯示文字說明，
不會擋住頁面本身的 all-ready（跟既有的 registrations 區塊同一個原則）。

2026-07-15：OneDrive 連接狀態區塊搬到獨立頁面 pages/admin/connections/
（使用者提出這頁不該只服務 OneDrive，之後接其他外部服務的健康檢查也要
放在同一個地方，不要每次都回頭改後台首頁）——這裡只留一張連到那頁的
入口卡片，跟 Theme／Contract 核准等其他頁面同一個模式。
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

  // 2026-07-15：使用者回報「已連接」時間顯示錯誤——原本直接印
  // Supabase 回傳的原始 ISO 字串（UTC，「+00:00」結尾），沒有轉成
  // 使用者看得懂的當地時間，`T04:50` 這種 UTC 時刻被誤讀成「凌晨
  // 4 點」，其實是台灣時間中午 12:50。這裡統一轉成 zh-TW 當地時間
  // 顯示，不要再直接印 ISO 原始字串——這個檔案裡任何顯示時間戳的地方
  // 都要用這支，不要再直接 escapeHtml(某個 _at 欄位)。
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

  function entryHtml(options) {
    var attention = options.attention ? " jonaminz-admin-entry--attention" : "";
    return (
      '<a class="jonaminz-admin-entry' + attention + '" href="' + escapeHtml(options.href) + '">' +
        '<div class="jonaminz-admin-entry-top">' +
          '<h2 class="jonaminz-admin-entry-title">' + escapeHtml(options.title) + '</h2>' +
          (options.badgeHtml || "") +
        '</div>' +
        '<p class="jonaminz-admin-entry-desc" ' + (options.descAttr || "") + '>' + escapeHtml(options.desc) + '</p>' +
      '</a>'
    );
  }

  function render(identity) {
    var root = document.querySelector("[data-app-root]");
    if (!root) return;

    root.innerHTML =
      '<section class="jonaminz-admin-welcome">' +
        identityBadgeHtml(identity) +
        '<h1 class="jonaminz-admin-greeting">後台</h1>' +
      '</section>' +
      '<div class="jonaminz-admin-entries" data-admin-entries>' +
        entryHtml({
          href: "/pages/chat/",
          title: "Chat",
          desc: "跟另一半聊天（第一版，文字＋已讀）"
        }) +
        entryHtml({
          href: "https://ndmc402010104.github.io/jonaminz-movies/",
          title: "Movies",
          desc: "電影收藏（外部專案，第一個真實登記的 first-party app）"
        }) +
        entryHtml({
          href: "https://ndmc402010104.github.io/jonaminz-travel/",
          title: "Travel",
          desc: "旅行規劃（外部專案，跟 jonaminz-movies 同一個模式）"
        }) +
        entryHtml({
          href: "/pages/admin/contracts/",
          title: "Contract 核准",
          desc: "讀取待審數量中...",
          descAttr: 'data-pending-status'
        }) +
        entryHtml({
          href: "/pages/admin/theme/",
          title: "Theme",
          desc: "CSS 疊加架構展示櫃 / 未來的 playground"
        }) +
        entryHtml({
          href: "/pages/admin/design/",
          title: "專案視覺方向",
          desc: "內部與外部專案目前各自宣告的視覺調性"
        }) +
        entryHtml({
          href: "/pages/admin/journal/",
          title: "決策與待辦",
          desc: "重大決策時間軸 + 兩人交辦事項看板"
        }) +
        entryHtml({
          href: "/pages/admin/toolkit/",
          title: "工具包",
          desc: "常用連結：local dev 區網測試、APK 下載"
        }) +
        entryHtml({
          href: "/pages/admin/connections/",
          title: "連線狀態",
          desc: "OneDrive 等外部連線健康檢查"
        }) +
      '</div>' +
      '<section class="jonaminz-admin-registrations">' +
        '<p class="jonaminz-admin-section-title">外部專案回報</p>' +
        '<div data-admin-registrations>讀取中...</div>' +
      '</section>';
  }

  // pending 數量跟 pages/admin/contracts/ 用同一支 action、同一個
  // status === "pending" 篩選邏輯，兩邊數字保證一致（不是各自算一套）。
  // 有待審時把 Contract 核准那張入口卡標成「需要注意」（放大＋強調色），
  // 沒有待審就維持跟其他入口一樣的視覺層級，不是永遠放大。
  function renderPendingStatus() {
    var el = document.querySelector("[data-pending-status]");
    var entriesRoot = document.querySelector("[data-admin-entries]");
    if (!el) return;

    if (!window.JonaminzBackend || typeof window.JonaminzBackend.listPendingContracts !== "function") {
      el.textContent = "待審數量讀取失敗：後端尚未載入";
      return;
    }

    window.JonaminzBackend.listPendingContracts()
      .then(function (response) {
        var rows = (response && response.rows) || [];
        var pendingCount = rows.filter(function (row) { return row.status === "pending"; }).length;

        if (pendingCount > 0) {
          el.textContent = "有新的專案想加入這個家";
          var card = el.closest(".jonaminz-admin-entry");
          if (card) {
            card.classList.add("jonaminz-admin-entry--attention");
            var top = card.querySelector(".jonaminz-admin-entry-top");
            if (top && !top.querySelector(".jonaminz-admin-entry-badge")) {
              var badge = document.createElement("span");
              badge.className = "jonaminz-admin-entry-badge";
              badge.textContent = pendingCount + " 筆待審";
              top.appendChild(badge);
            }
          }
        } else {
          el.textContent = "無待審，一切都在掌握中";
        }
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
        '<span>最後回報：' + escapeHtml(row.last_seen_at ? formatLocalDateTime(row.last_seen_at) : "-") + '</span>' +
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
          container.innerHTML = '<p class="jonaminz-admin-registrations-empty">目前沒有外部專案回報過。</p>';
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
