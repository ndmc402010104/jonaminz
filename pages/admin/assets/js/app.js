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
      '</div>' +
      '<section class="jonaminz-admin-registrations">' +
        '<p class="jonaminz-admin-section-title">外部專案回報</p>' +
        '<div data-admin-registrations>讀取中...</div>' +
      '</section>' +
      '<section class="jonaminz-admin-registrations">' +
        '<p class="jonaminz-admin-section-title">OneDrive（圖片分享／App 發佈用）</p>' +
        '<div class="jonaminz-admin-onedrive-grid">' +
          '<div data-onedrive-status="jonathan">讀取中...</div>' +
          '<div data-onedrive-status="minz">讀取中...</div>' +
        '</div>' +
      '</section>';
  }

  // 2026-07-15（OneDrive 線 Phase A，雙帳號模式）：Jonathan／Minz 各自
  // 連自己的 OneDrive（兩人都想從自己帳號查得到聊天圖庫，見
  // AI_CONTEXT/ONEDRIVE_LINE_SPEC.md 的決策記錄）。這裡同時畫兩張卡片
  // ——兩張卡片都可以按「連接」／「測試連線」,不限定只能操作登入者
  // 自己那張(2026-07-15 使用者明確要求：兩人共用帳密，這層限制沒有
  // 實際安全意義；worker.js 的 /auth/onedrive/start、
  // testOnedriveConnection 都已經放行指定任一身分，見那邊的註解)。
  function renderOnedriveSection() {
    if (!window.JonaminzBackend || typeof window.JonaminzBackend.getOnedriveStatus !== "function") {
      ["jonathan", "minz"].forEach(function (id) {
        var el = document.querySelector('[data-onedrive-status="' + id + '"]');
        if (el) el.textContent = "後端尚未載入。";
      });
      return;
    }

    var token = (window.JonaminzIdentity && window.JonaminzIdentity.readToken)
      ? window.JonaminzIdentity.readToken() : null;

    window.JonaminzBackend.getOnedriveStatus({ token: token })
      .then(function (response) {
        if (!response || !response.ok) {
          var errorMessage = "狀態讀取失敗：" + ((response && response.error) || "未知錯誤");
          ["jonathan", "minz"].forEach(function (id) {
            var el = document.querySelector('[data-onedrive-status="' + id + '"]');
            if (el) el.textContent = errorMessage;
          });
          return;
        }

        ["jonathan", "minz"].forEach(function (id) {
          renderOnedriveCard(id, response.accounts[id], token);
        });
      })
      .catch(function (error) {
        var errorMessage = "狀態讀取失敗：" + (error && error.message ? error.message : String(error));
        ["jonathan", "minz"].forEach(function (id) {
          var el = document.querySelector('[data-onedrive-status="' + id + '"]');
          if (el) el.textContent = errorMessage;
        });
      });
  }

  function renderOnedriveCard(cardIdentity, account, token) {
    var el = document.querySelector('[data-onedrive-status="' + cardIdentity + '"]');
    if (!el) return;
    var label = IDENTITY_LABEL[cardIdentity] || cardIdentity;

    if (account && account.connected) {
      el.innerHTML =
        '<p><strong>' + escapeHtml(label) + '</strong>：已連接（' + escapeHtml(account.connectedAt || "") + '）</p>' +
        '<button type="button" class="jonaminz-admin-onedrive-test" data-onedrive-test>測試連線</button>' +
        '<a class="jonaminz-admin-onedrive-connect" data-onedrive-reconnect>重新連接</a>' +
        '<span data-onedrive-test-result></span>';
      var testBtn = el.querySelector("[data-onedrive-test]");
      testBtn.addEventListener("click", function () {
        testBtn.disabled = true;
        var resultEl = el.querySelector("[data-onedrive-test-result]");
        resultEl.textContent = " 測試中...";
        window.JonaminzBackend.testOnedriveConnection({ token: token, identity: cardIdentity })
          .then(function (result) {
            testBtn.disabled = false;
            resultEl.textContent = (result && result.ok)
              ? " 成功：App Folder「" + (result.folderName || "") + "」可讀寫"
              : " 失敗：" + ((result && result.error) || "未知錯誤");
          })
          .catch(function (error) {
            testBtn.disabled = false;
            resultEl.textContent = " 失敗：" + (error && error.message ? error.message : String(error));
          });
      });
      // 「重新連接」用途：Azure 那邊新增 Graph 權限後，舊的 refresh
      // token 不會自動長出新 scope，要重新走一次 /auth/onedrive/start
      // 才能拿到含新權限的授權（見 CHANGELOG「OneDrive 線 Phase B」）。
      var reconnectLink = el.querySelector("[data-onedrive-reconnect]");
      window.JonaminzBackend.getWorkerBaseUrlForRedirect().then(function (baseUrl) {
        reconnectLink.href = baseUrl + "/auth/onedrive/start?token=" + encodeURIComponent(token || "") +
          "&identity=" + encodeURIComponent(cardIdentity);
      });
      return;
    }

    el.innerHTML =
      '<p><strong>' + escapeHtml(label) + '</strong>：尚未連接。</p>' +
      '<a class="jonaminz-admin-onedrive-connect" data-onedrive-connect>連接 OneDrive</a>';
    var connectLink = el.querySelector("[data-onedrive-connect]");
    window.JonaminzBackend.getWorkerBaseUrlForRedirect().then(function (baseUrl) {
      connectLink.href = baseUrl + "/auth/onedrive/start?token=" + encodeURIComponent(token || "") +
        "&identity=" + encodeURIComponent(cardIdentity);
    });
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
        renderOnedriveSection();
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
