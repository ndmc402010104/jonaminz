/*
檔案位置：jonaminz/pages/admin/contracts/assets/js/app.js
用途：Contract 核准後台（implementation plan 第 3 項）。對應規格 S13/S14：
推送 ≠ 採信，pending 清單要能看 diff 才能核准／否決。

整頁在 init() 就先過 window.JonaminzIdentity.requireLogin()（見
assets/js/header.js），沒登入會被導去 /pages/login/?next=...，不會
執行到下面的 render()/loadRows()。approve/reject 這兩個 action 在
Worker 端也要求 session（見 worker.js 的 requireSession），操作人
（p_actor）是 Worker 端直接用登入身分決定，不是前端自報——原本這裡是
一組 JONAMINZ_ADMIN_TOKEN 密語＋前端手動切換操作人按鈕，已經淘汰。

只能回報自己的 loading task，不可以自己決定 css/shell ready。
*/
(function () {
  "use strict";

  var READY_TASK = "app-ready";
  var IDENTITY_LABEL = { jonathan: "Jonathan", minz: "Minz" };

  var identity = null;
  var rows = [];
  var expandedIds = {};
  var expandedHistoryGroups = {};

  /* ---------- helpers ---------- */

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  }

  function shortHash(hash) {
    return hash ? String(hash).slice(0, 12) + "…" : "-";
  }

  function formatTime(value) {
    if (!value) return "-";
    try {
      return new Date(value).toLocaleString("zh-TW", { hour12: false });
    } catch (error) {
      return String(value);
    }
  }

  function statusLabel(status) {
    return { pending: "待審核", approved: "已核准", rejected: "已否決" }[status] || status;
  }

  // 遞迴攤平成 { "a.b.c": value } 的形式，方便逐 key 比較兩個 Contract 版本
  // 差在哪裡。不用外部 diff 套件，這是個 2 人用的小工具，純 JS 比對就夠。
  function flatten(value, prefix, out) {
    out = out || {};
    if (value !== null && typeof value === "object") {
      var keys = Array.isArray(value) ? value.map(function (_, i) { return i; }) : Object.keys(value);
      if (keys.length === 0) {
        out[prefix || "(root)"] = Array.isArray(value) ? "[]" : "{}";
      }
      keys.forEach(function (key) {
        flatten(value[key], prefix ? prefix + "." + key : String(key), out);
      });
    } else {
      out[prefix || "(root)"] = JSON.stringify(value);
    }
    return out;
  }

  function diffContracts(oldContract, newContract) {
    var oldFlat = oldContract ? flatten(oldContract, "") : {};
    var newFlat = flatten(newContract, "");
    var keys = Object.keys(Object.assign({}, oldFlat, newFlat)).sort();

    return keys
      .map(function (key) {
        var before = Object.prototype.hasOwnProperty.call(oldFlat, key) ? oldFlat[key] : undefined;
        var after = Object.prototype.hasOwnProperty.call(newFlat, key) ? newFlat[key] : undefined;
        if (before === after) return null;
        return { key: key, before: before, after: after };
      })
      .filter(Boolean);
  }

  function diffRowsHtml(diffs) {
    if (!diffs.length) return '<p class="jonaminz-page-subtitle">跟目前 active 版本相比沒有差異。</p>';

    return (
      '<div class="jonaminz-contracts-diff">' +
        diffs.map(function (d) {
          return (
            '<div class="jonaminz-contracts-diff-row">' +
              '<code>' + escapeHtml(d.key) + '</code>' +
              '<span class="jonaminz-contracts-diff-before">' + (d.before === undefined ? "（無）" : escapeHtml(d.before)) + '</span>' +
              '<span class="jonaminz-contracts-diff-arrow">→</span>' +
              '<span class="jonaminz-contracts-diff-after">' + (d.after === undefined ? "（移除）" : escapeHtml(d.after)) + '</span>' +
            '</div>'
          );
        }).join("") +
      '</div>'
    );
  }

  /* ---------- render ---------- */

  function rowDetailHtml(row) {
    if (!expandedIds[row.id]) return "";

    var diffs = diffContracts(row.previousApproved ? row.previousApproved.rawContract : null, row.rawContract);
    var diffTitle = row.previousApproved
      ? "跟目前 active 版本（snapshot #" + row.previousApproved.snapshotId + "）的差異"
      : "沒有前一版可比對，這是這個 (projectId, environment) 的第一次推送";

    return (
      '<div class="jonaminz-contracts-detail">' +
        '<p class="jonaminz-contracts-tech-meta">snapshot #' + row.id +
          '　hash ' + escapeHtml(shortHash(row.canonicalHash)) + '</p>' +
        '<h4>' + escapeHtml(diffTitle) + '</h4>' +
        diffRowsHtml(diffs) +
        '<details class="jonaminz-contracts-raw">' +
          '<summary>完整 JSON</summary>' +
          '<pre>' + escapeHtml(JSON.stringify(row.rawContract, null, 2)) + '</pre>' +
        '</details>' +
      '</div>'
    );
  }

  // 核准/否決都不是終態（S13：只改狀態與 active 指標，永不覆寫歷史，
  // 「歷史」指 audit log 不可竄改，不是說 status 定了就不能再變）——
  // 已核准的可以撤回改否決，已否決的可以改判核准，pending 兩個都能按。
  function rowActionsHtml(row) {
    var approveBtn = '<button class="btn btn-primary" type="button" data-approve="' + row.id + '">' +
      (row.status === "rejected" ? "改為核准" : "核准") + '</button>';
    var rejectBtn = '<button class="btn btn-ghost" type="button" data-reject="' + row.id + '">' +
      (row.status === "approved" ? "撤回核准" : "否決") + '</button>';

    if (row.status === "approved") return '<div class="jonaminz-contracts-actions">' + rejectBtn + '</div>';
    if (row.status === "rejected") return '<div class="jonaminz-contracts-actions">' + approveBtn + '</div>';
    return '<div class="jonaminz-contracts-actions">' + approveBtn + rejectBtn + '</div>';
  }

  function rowHtml(row) {
    var validClass = row.validationResult && row.validationResult.valid ? "is-valid" : "is-invalid";
    var validLabel = row.validationResult && row.validationResult.valid ? "驗證通過" : "驗證有警示";

    return (
      '<article class="jonaminz-contracts-row jonaminz-contracts-row--' + row.status + '">' +
        '<div class="jonaminz-contracts-row-head" data-toggle="' + row.id + '">' +
          '<div>' +
            '<strong>' + escapeHtml(row.projectId) + '</strong>' +
            '<span class="jonaminz-contracts-env">' + escapeHtml(row.environment) + '</span>' +
            '<span class="jonaminz-contracts-status jonaminz-contracts-status--' + row.status + '">' + statusLabel(row.status) + '</span>' +
            '<span class="jonaminz-contracts-valid ' + validClass + '">' + validLabel + '</span>' +
          '</div>' +
          '<div class="jonaminz-contracts-meta">' +
            (row.decidedAt
              ? '<span>裁決於 ' + escapeHtml(formatTime(row.decidedAt)) + (row.decidedBy ? "（" + escapeHtml(IDENTITY_LABEL[row.decidedBy] || row.decidedBy) + "）" : "") + '</span>'
              : '<span>送出於 ' + escapeHtml(formatTime(row.submittedAt)) + '</span>') +
            (row.note ? '<span>備註：' + escapeHtml(row.note) + '</span>' : "") +
          '</div>' +
        '</div>' +
        rowDetailHtml(row) +
        rowActionsHtml(row) +
      '</article>'
    );
  }

  function sectionHtml(title, list, emptyText) {
    return (
      '<section class="jonaminz-theme-section">' +
        '<div class="jonaminz-section-head"><h2 class="jonaminz-section-title">' + escapeHtml(title) + '</h2></div>' +
        (list.length ? list.map(rowHtml).join("") : '<p class="jonaminz-page-subtitle">' + escapeHtml(emptyText) + '</p>') +
      '</section>'
    );
  }

  // 2026-07-13：已裁決清單改成按 (projectId, environment) 分組，每組只把
  // 「現在真的生效中」的那筆（靠 previousApproved.snapshotId 判斷，不是
  // 猜最新一筆）攤在外面，其餘歷史摺進原生 <details>，預設收合——使用者
  // 原話：「保留歷史但一直累積感覺不好，應該做成歷史、現在是最後一個」。
  // previousApproved 是 Worker 在每一列都附的同一份資料（來自
  // contract_active_snapshots，不是猜出來的），同一組內每筆的
  // previousApproved 內容必然相同，取第一筆的就好。
  function groupDecidedByProject(decided) {
    var groups = {};
    var order = [];

    decided.forEach(function (row) {
      var key = row.projectId + "::" + row.environment;
      if (!groups[key]) {
        groups[key] = { projectId: row.projectId, environment: row.environment, previousApproved: row.previousApproved, rows: [] };
        order.push(key);
      }
      groups[key].rows.push(row);
    });

    return order.map(function (key) { return groups[key]; });
  }

  function projectGroupHtml(group) {
    var groupKey = group.projectId + "::" + group.environment;
    var activeSnapshotId = group.previousApproved ? group.previousApproved.snapshotId : null;
    var activeRow = null;
    var historyRows = [];

    group.rows.forEach(function (row) {
      if (activeSnapshotId !== null && row.id === activeSnapshotId && !activeRow) {
        activeRow = row;
      } else {
        historyRows.push(row);
      }
    });

    // active 指標存在，但那筆 snapshot 不在最近 50 筆窗口內──退而求其次
    // 顯示這組裡最新的一筆當代表，並註記這不是嚴格確認的 active（罕見
    // edge case，2 人用量下最近 50 筆幾乎不會遇到，防禦性處理而已）。
    var activeUnconfirmed = false;
    if (!activeRow && group.rows.length) {
      activeRow = group.rows[0];
      historyRows = group.rows.slice(1);
      activeUnconfirmed = true;
    }

    return (
      '<div class="jonaminz-contracts-project-group">' +
        '<div class="jonaminz-contracts-project-head">' +
          '<h3>' + escapeHtml(group.projectId) + '<span class="jonaminz-contracts-env">' + escapeHtml(group.environment) + '</span></h3>' +
          (activeUnconfirmed ? '<span class="jonaminz-contracts-unconfirmed">目前生效版本不在最近 50 筆內，顯示最新一筆代表</span>' : '') +
        '</div>' +
        (activeRow ? rowHtml(activeRow) : '<p class="jonaminz-page-subtitle">目前沒有生效中的版本。</p>') +
        (historyRows.length
          ? '<details class="jonaminz-contracts-history" data-history-group="' + escapeHtml(groupKey) + '"' +
              (expandedHistoryGroups[groupKey] ? ' open' : '') + '>' +
              '<summary>歷史（' + historyRows.length + ' 筆，可改判）</summary>' +
              historyRows.map(rowHtml).join('') +
            '</details>'
          : '') +
      '</div>'
    );
  }

  function decidedSectionHtml(decided) {
    var groups = groupDecidedByProject(decided);

    return (
      '<section class="jonaminz-theme-section">' +
        '<div class="jonaminz-section-head"><h2 class="jonaminz-section-title">已裁決（按專案分組，可改判）</h2></div>' +
        (groups.length
          ? groups.map(projectGroupHtml).join('')
          : '<p class="jonaminz-page-subtitle">還沒有任何 Contract 被核准或否決過。</p>') +
      '</section>'
    );
  }

  function toolbarHtml() {
    var label = IDENTITY_LABEL[identity] || identity || "?";
    return (
      '<div class="jonaminz-theme-toolbar jonaminz-contracts-toolbar">' +
        '<span class="jonaminz-contracts-identity">' +
          '<span class="jonaminz-identity-badge jonaminz-identity-badge--' + escapeHtml(identity || "") + '">' +
            escapeHtml(label.charAt(0).toUpperCase()) + '</span>' +
          escapeHtml(label) +
        '</span>' +
        '<button class="btn btn-ghost" type="button" data-refresh>重新整理</button>' +
        '<p class="jonaminz-page-subtitle" data-status></p>' +
      '</div>'
    );
  }

  function render() {
    var root = document.querySelector("[data-app-root]");
    if (!root) return;

    var pending = rows.filter(function (r) { return r.status === "pending"; });
    var decided = rows.filter(function (r) { return r.status !== "pending"; });

    root.innerHTML = (
      toolbarHtml() +
      sectionHtml("待審核（" + pending.length + "）", pending, "目前沒有待審核的 Contract。") +
      decidedSectionHtml(decided)
    );
  }

  function setStatus(text) {
    var el = document.querySelector("[data-status]");
    if (el) el.textContent = text || "";
  }

  /* ---------- backend ---------- */

  function loadRows() {
    if (!window.JonaminzBackend || typeof window.JonaminzBackend.listPendingContracts !== "function") {
      setStatus("後端尚未載入。");
      return;
    }

    setStatus("讀取中...");

    window.JonaminzBackend.listPendingContracts()
      .then(function (response) {
        rows = (response && response.rows) || [];
        render();
        setStatus("已讀取 " + rows.length + " 筆。");
      })
      .catch(function (error) {
        setStatus("讀取失敗：" + (error && error.message ? error.message : String(error)));
      });
  }

  function decide(action, snapshotId, note) {
    var token = window.JonaminzIdentity.readToken();
    if (!token) {
      setStatus("尚未登入或登入已逾期，請重新整理頁面。");
      return;
    }

    setStatus((action === "approveContract" ? "核准中..." : "否決中...") + " #" + snapshotId);

    window.JonaminzBackend[action === "approveContract" ? "approveContract" : "rejectContract"]({
      snapshotId: snapshotId,
      token: token,
      note: note || null
    })
      .then(function () {
        setStatus("#" + snapshotId + " 已處理完成。");
        loadRows();
      })
      .catch(function (error) {
        setStatus("操作失敗：" + (error && error.message ? error.message : String(error)));
      });
  }

  /* ---------- events ---------- */

  function bindEvents() {
    var root = document.querySelector("[data-app-root]");
    if (!root || root.getAttribute("data-contracts-bound") === "true") return;
    root.setAttribute("data-contracts-bound", "true");

    // <details> 的原生 toggle 事件不會冒泡（跟 scroll/load 同類），但
    // capture 階段不受 bubbles 影響一樣會經過祖先節點，掛在 capture
    // 才能用同一個 listener 代理到所有歷史摺疊區塊，不用逐一綁定。
    // 沒有這層追蹤的話，每次 render()（例如展開某筆 diff）都會把
    // <details> 重新生成回預設收合狀態，使用者剛展開的歷史又會合起來。
    root.addEventListener("toggle", function (event) {
      var details = event.target.closest && event.target.closest("[data-history-group]");
      if (!details) return;
      var key = details.getAttribute("data-history-group");
      expandedHistoryGroups[key] = details.open;
    }, true);

    root.addEventListener("click", function (event) {
      var refreshBtn = event.target.closest("[data-refresh]");
      if (refreshBtn) {
        loadRows();
        return;
      }

      var toggle = event.target.closest("[data-toggle]");
      if (toggle) {
        var id = toggle.getAttribute("data-toggle");
        expandedIds[id] = !expandedIds[id];
        render();
        return;
      }

      var approveBtn = event.target.closest("[data-approve]");
      if (approveBtn) {
        decide("approveContract", Number(approveBtn.getAttribute("data-approve")));
        return;
      }

      var rejectBtn = event.target.closest("[data-reject]");
      if (rejectBtn) {
        var note = window.prompt("否決原因（選填）：") || "";
        decide("rejectContract", Number(rejectBtn.getAttribute("data-reject")), note);
        return;
      }
    });
  }

  function init() {
    window.JonaminzIdentity.requireLogin().then(function (currentIdentity) {
      try {
        identity = currentIdentity;
        render();
        bindEvents();
        window.JonaminzLoading.done(READY_TASK);
        loadRows();
      } catch (error) {
        console.error("[jonaminz] admin-contracts app.js init failed", error);
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
