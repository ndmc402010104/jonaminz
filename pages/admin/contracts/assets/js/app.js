/*
檔案位置：jonaminz/pages/admin/contracts/assets/js/app.js
用途：Contract 核准後台（implementation plan 第 3 項）。對應規格 S13/S14：
推送 ≠ 採信，pending 清單要能看 diff 才能核准／否決。

approve/reject 是目前整站唯一有保護的寫入動作（見 backend/cloudflare-worker/
worker.js 的 checkAdminToken）——整站還沒有登入系統，這裡先用一組只有
Jonathan/Minz 知道的 token 當臨時關卡，存在 sessionStorage（分頁關掉就清掉，
不長期留存），不是正式驗證，等 Google OAuth（implementation plan 第 9 項）
落地後要換掉。

只能回報自己的 loading task，不可以自己決定 css/shell ready。
*/
(function () {
  "use strict";

  var READY_TASK = "app-ready";
  var TOKEN_KEY = "jonaminz.adminToken";
  var ACTOR_KEY = "jonaminz.actorName";

  var rows = [];
  var expandedIds = {};

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
              ? '<span>裁決於 ' + escapeHtml(formatTime(row.decidedAt)) + (row.decidedBy ? "（" + escapeHtml(row.decidedBy) + "）" : "") + '</span>'
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

  // 只有 Jonathan/Minz 兩個人用，改判斷判定人不用打字，按鈕切換直接存
  // sessionStorage（見 bindEvents 的 data-actor-option 處理）。
  var ACTOR_OPTIONS = ["Jonathan", "Minz"];

  function toolbarHtml() {
    var savedToken = sessionStorage.getItem(TOKEN_KEY) || "";
    var savedActor = sessionStorage.getItem(ACTOR_KEY) || ACTOR_OPTIONS[0];

    return (
      '<div class="jonaminz-theme-toolbar jonaminz-contracts-toolbar">' +
        '<div class="jonaminz-contracts-actor-group">操作人 ' +
          ACTOR_OPTIONS.map(function (name) {
            return '<button type="button" class="btn btn-ghost jonaminz-contracts-actor-btn' +
              (name === savedActor ? ' is-active' : '') + '" data-actor-option="' + escapeHtml(name) + '">' +
              escapeHtml(name) + '</button>';
          }).join("") +
        '</div>' +
        '<label>Admin token <input type="password" data-admin-token value="' + escapeHtml(savedToken) + '" placeholder="核准/否決前要先填"></label>' +
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
      sectionHtml("已裁決（可改判）", decided, "還沒有任何 Contract 被核准或否決過。")
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

  function currentToken() {
    var input = document.querySelector("[data-admin-token]");
    var value = input ? input.value.trim() : "";
    if (value) sessionStorage.setItem(TOKEN_KEY, value);
    return value;
  }

  function currentActor() {
    var value = sessionStorage.getItem(ACTOR_KEY) || ACTOR_OPTIONS[0];
    return value || null;
  }

  function decide(action, snapshotId, note) {
    var token = currentToken();
    if (!token) {
      setStatus("請先填 admin token。");
      return;
    }

    setStatus((action === "approveContract" ? "核准中..." : "否決中...") + " #" + snapshotId);

    window.JonaminzBackend[action === "approveContract" ? "approveContract" : "rejectContract"]({
      snapshotId: snapshotId,
      adminToken: token,
      actor: currentActor(),
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

    // token 輸入框每打一個字就存 sessionStorage，不要等到按核准/否決才存——
    // 不然中途按「重新整理」之類會觸發 render() 用舊值重畫整個工具列，
    // 把剛打的字蓋掉，逼人重打一次（2026-07-11 使用者實際踩到回報）。
    root.addEventListener("input", function (event) {
      var tokenInput = event.target.closest("[data-admin-token]");
      if (tokenInput) {
        sessionStorage.setItem(TOKEN_KEY, tokenInput.value.trim());
      }
    });

    root.addEventListener("click", function (event) {
      var refreshBtn = event.target.closest("[data-refresh]");
      if (refreshBtn) {
        loadRows();
        return;
      }

      var actorBtn = event.target.closest("[data-actor-option]");
      if (actorBtn) {
        sessionStorage.setItem(ACTOR_KEY, actorBtn.getAttribute("data-actor-option"));
        render();
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
    try {
      render();
      bindEvents();
      window.JonaminzLoading.done(READY_TASK);
      loadRows();
    } catch (error) {
      console.error("[jonaminz] admin-contracts app.js init failed", error);
      window.JonaminzLoading.fail(READY_TASK, error);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
