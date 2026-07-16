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

2026-07-16：原本新增過一條獨立的「有什麼新的」摘要列（未讀訊息數／
待驗證任務數／OneDrive 連接狀態），使用者當場回饋「為什麼做在最上面
不是在每個標籤上」——跟 Contract 核准既有的「角落徽章＋放大強調」
機制重複了兩套「這裡需要注意」的視覺語言。改成收斂進同一套：Chat／
決策與待辦／連線狀態三張入口卡加上 entryKey，只有真的需要注意時
（有未讀／有待驗證／沒連滿）才長出 `jonaminz-admin-entry-badge` 角標＋
`--attention` 放大，跟 Contract 核准同一份 CSS、同一個 setEntryAttention()
輔助函式，不再各自一套。三個資料來源仍是既有 action
（listChatMessages／listProjectTasks／getOnedriveStatus）前端聚合，
不動 worker.js；未讀數算法沿用跟浮動大頭貼角標（assets/js/chat-launcher.js
的 pollPresenceAndUnread()）同一套定義，不要兩邊各自一套算法。跟
pending 數量／registrations 同一個原則：讀取失敗只在各自卡片顯示文字，
不擋頁面本身的 all-ready。
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
    var keyAttr = options.entryKey ? ' data-entry-key="' + escapeHtml(options.entryKey) + '"' : "";
    return (
      '<a class="jonaminz-admin-entry' + attention + '"' + keyAttr + ' href="' + escapeHtml(options.href) + '">' +
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
          desc: "跟另一半聊天（第一版，文字＋已讀）",
          entryKey: "chat"
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
          desc: "重大決策時間軸 + 兩人交辦事項看板",
          entryKey: "journal"
        }) +
        entryHtml({
          href: "/pages/admin/toolkit/",
          title: "工具包",
          desc: "常用連結：local dev 區網測試、APK 下載"
        }) +
        entryHtml({
          href: "/pages/admin/connections/",
          title: "連線狀態",
          desc: "OneDrive 等外部連線健康檢查",
          entryKey: "connections"
        }) +
        entryHtml({
          href: "/pages/admin/secrets/",
          title: "Agent 密鑰保管箱",
          desc: "存給 agent 用的憑證（Supabase／Cloudflare API token 等），不是給人點的連結"
        }) +
      '</div>' +
      '<section class="jonaminz-admin-registrations">' +
        '<p class="jonaminz-admin-section-title">外部專案回報</p>' +
        '<div data-admin-registrations>讀取中...</div>' +
      '</section>';
  }

  // pending 數量跟 pages/admin/contracts/ 用同一支 action、同一個
  // status === "pending" 篩選邏輯，兩邊數字保證一致（不是各自算一套）。
  // 有待審時把入口卡標成「需要注意」（放大＋強調色＋角標），沒有就
  // 維持跟其他入口一樣的視覺層級，不是永遠放大。這支是 Chat／決策與
  // 待辦／連線狀態三張卡也共用的輔助函式（2026-07-16 收斂前，Contract
  // 核准跟另外三個入口各自維護一套「需要注意」的畫法，使用者回饋這樣
  // 兩套視覺語言重複，改成統一只有這一份）。
  function setEntryAttention(cardEl, badgeText) {
    if (!cardEl) return;
    cardEl.classList.add("jonaminz-admin-entry--attention");
    var top = cardEl.querySelector(".jonaminz-admin-entry-top");
    if (top && !top.querySelector(".jonaminz-admin-entry-badge")) {
      var badge = document.createElement("span");
      badge.className = "jonaminz-admin-entry-badge";
      badge.textContent = badgeText;
      top.appendChild(badge);
    }
  }

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

        if (pendingCount > 0) {
          el.textContent = "有新的專案想加入這個家";
          setEntryAttention(el.closest(".jonaminz-admin-entry"), pendingCount + " 筆待審");
        } else {
          el.textContent = "無待審，一切都在掌握中";
        }
      })
      .catch(function (error) {
        el.textContent = "待審數量讀取失敗：" + (error && error.message ? error.message : String(error));
      });
  }

  // 未讀數算法沿用跟浮動大頭貼角標（assets/js/chat-launcher.js 的
  // pollPresenceAndUnread()）同一套定義（比對 identity 自己
  // lastReadMessageId 之後、對方傳的訊息）——刻意重複一份，理由跟這個
  // 專案裡其他 shell script 各自維護一份小工具一樣：這幾個入口彼此
  // 獨立，不互相依賴。只有真的有未讀時才在 Chat 卡加角標，沒有未讀維持
  // 原本的描述文字，不覆蓋掉「跟另一半聊天」這句介紹。
  function renderChatAttention() {
    var card = document.querySelector('[data-entry-key="chat"]');
    if (!card || !window.JonaminzBackend || typeof window.JonaminzBackend.listChatMessages !== "function") return;
    var token = (window.JonaminzIdentity && window.JonaminzIdentity.readToken)
      ? window.JonaminzIdentity.readToken() : null;
    window.JonaminzBackend.listChatMessages({ token: token })
      .then(function (data) {
        if (!data || !data.ok) return;
        var identity = data.identity;
        var peer = identity === "jonathan" ? "minz" : "jonathan";
        var messages = data.messages || [];
        var readState = data.readState || {};
        var myRead = readState[identity] || {};
        var myReadIndex = -1;
        if (myRead.lastReadMessageId) {
          for (var i = 0; i < messages.length; i += 1) {
            if (messages[i].id === myRead.lastReadMessageId) { myReadIndex = i; break; }
          }
        }
        var unreadCount = 0;
        for (var j = myReadIndex + 1; j < messages.length; j += 1) {
          if (messages[j].sender_identity === peer) unreadCount += 1;
        }
        if (unreadCount > 0) setEntryAttention(card, unreadCount + " 則未讀");
      })
      .catch(function (error) {
        console.error("[jonaminz] renderChatAttention failed", error);
      });
  }

  // 「待你驗證」＝for_user 泳道裡 origin==='claude' 且還沒打勾的項目
  // ——跟決策與待辦頁的「請驗證：」慣例是同一批東西，不是泛指所有未完成
  // 待辦（使用者自己打的待辦不算「待驗證」，那些只是待處理）。只有真的
  // 有東西要驗證時才加角標，維持原本的卡片描述文字。
  function renderVerifyAttention() {
    var card = document.querySelector('[data-entry-key="journal"]');
    if (!card || !window.JonaminzBackend || typeof window.JonaminzBackend.listProjectTasks !== "function") return;
    var token = (window.JonaminzIdentity && window.JonaminzIdentity.readToken)
      ? window.JonaminzIdentity.readToken() : null;
    window.JonaminzBackend.listProjectTasks({ token: token })
      .then(function (response) {
        var rows = (response && response.rows) || [];
        var pendingCount = rows.filter(function (row) {
          return row.lane === "for_user" && row.origin === "claude" && !row.done;
        }).length;
        if (pendingCount > 0) setEntryAttention(card, pendingCount + " 筆待驗證");
      })
      .catch(function (error) {
        console.error("[jonaminz] renderVerifyAttention failed", error);
      });
  }

  // 只有「還沒兩人都連上」才算需要注意；兩人都連了視為正常狀態，不加
  // 角標，維持原本的卡片描述文字。
  function renderConnectionsAttention() {
    var card = document.querySelector('[data-entry-key="connections"]');
    if (!card || !window.JonaminzBackend || typeof window.JonaminzBackend.getOnedriveStatus !== "function") return;
    var token = (window.JonaminzIdentity && window.JonaminzIdentity.readToken)
      ? window.JonaminzIdentity.readToken() : null;
    window.JonaminzBackend.getOnedriveStatus({ token: token })
      .then(function (response) {
        if (!response || !response.ok) return;
        var accounts = response.accounts || {};
        var connectedLabels = ["jonathan", "minz"]
          .filter(function (id) { return accounts[id] && accounts[id].connected; })
          .map(function (id) { return IDENTITY_LABEL[id] || id; });
        if (connectedLabels.length === 2) return;
        var badgeText = connectedLabels.length === 1
          ? ("只有 " + connectedLabels[0] + " 已連接")
          : "都還沒連接";
        setEntryAttention(card, badgeText);
      })
      .catch(function (error) {
        console.error("[jonaminz] renderConnectionsAttention failed", error);
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
        renderChatAttention();
        renderVerifyAttention();
        renderConnectionsAttention();
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
