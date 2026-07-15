/*
檔案位置：jonaminz/pages/admin/journal/assets/js/app.js
用途：決策與待辦頁的業務入口（水庫下游層）。只能回報自己的 loading
task，不可以自己決定 css/shell ready。

2026-07-15：整頁分兩段——
1. DECISION_TIMELINE：手動維護的重大決策清單（不是自動生成，日後每次
   出現值得記錄的重大決策，就手動在這個陣列加一筆，跟 CHANGELOG.md
   的維護方式同一個精神：這是「精選重點」，不是取代 AI_CONTEXT/
   DECISIONS.md／CHANGELOG.md 的詳細記錄，兩者互補——這裡給「一眼看懂
   全貌」，那兩份給「完整細節」）。
2. 待辦看板：真正有後端持久化的兩泳道清單（project_tasks 表），任何
   已登入身分都能操作任一泳道任一筆（跟 OneDrive 連接同一個信任模型，
   見 worker.js 的 listProjectTasks 等 action 註解）。
*/
(function () {
  "use strict";

  var READY_TASK = "app-ready";

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  }

  // ---------- 決策時間軸（精選，不是全部） ----------
  // tag 決定色卡：architecture／chat／bubble／onedrive／process 五種。
  // status：done（已上線）／designed（設計完成待實作）／wip（執行中/暫時）。
  var DECISION_TIMELINE = [
    {
      date: "2026-07-09",
      tag: "architecture",
      tagLabel: "平台",
      title: "身分/登入/Contract 治理屬於 Core",
      why: "Jonathan／Minz 身分登入、Contract／Registry 治理全部收在 Worker+Supabase，外部專案不能自己授權自己。",
      status: "done"
    },
    {
      date: "2026-07-11",
      tag: "architecture",
      tagLabel: "平台",
      title: "圖書館模型：外部專案是「同一人的多本書」",
      why: "Contract 只宣告「自己是什麼」，Registry 決定「誰看得到」——不是陌生第三方的治理模型。",
      status: "done"
    },
    {
      date: "2026-07-13",
      tag: "architecture",
      tagLabel: "平台",
      title: "大廳／房間／後台三層視覺各自獨立",
      why: "首頁「米紙」、Jonathan「深夜訊號」黑、Minz「手帳」風、後台「亞麻米」暖色，四套配色互不統一。",
      status: "done"
    },
    {
      date: "2026-07-14",
      tag: "chat",
      tagLabel: "Chat",
      title: "Chat 用 Worker polling，不做 WebSocket／Durable Object",
      why: "先證明端到端能動的極簡 MVP，之後真的需要即時性再評估換方案。",
      status: "done"
    },
    {
      date: "2026-07-14",
      tag: "onedrive",
      tagLabel: "OneDrive",
      title: "圖片分享不准存 Supabase",
      why: "使用者明訂：Supabase 只存訊息列＋中繼資料，圖片本體另外走 OneDrive。",
      status: "done"
    },
    {
      date: "2026-07-14",
      tag: "chat",
      tagLabel: "Chat",
      title: "視覺合約用平台元件，不是文字規格",
      why: "chat.launcher@1 是真實 iframe 元件而非自訂規格，「用了＝合規」，平台改版全站自動跟上。",
      status: "done"
    },
    {
      date: "2026-07-15",
      tag: "bubble",
      tagLabel: "泡泡",
      title: "系統泡泡是日常主力，自繪覆蓋層是備援",
      why: "對照 Messenger 等成熟 App 的手感落差後定案：不追求把覆蓋層做到跟系統一樣完美，把力氣留給更值得投入的地方。",
      status: "done"
    },
    {
      date: "2026-07-15",
      tag: "bubble",
      tagLabel: "App 發佈",
      title: "APK 暫時走公開 GitHub Release",
      why: "手機下載不方便的權宜之計，等 OneDrive 自架發佈線通了就收回公開通道。",
      status: "wip"
    },
    {
      date: "2026-07-15",
      tag: "onedrive",
      tagLabel: "OneDrive",
      title: "雙帳號模式：Jonathan／Minz 各自連自己的 OneDrive",
      why: "兩人都想從自己帳號查得到聊天圖庫，不是共用 Jonathan 一個人的容量。",
      status: "done"
    },
    {
      date: "2026-07-15",
      tag: "onedrive",
      tagLabel: "OneDrive",
      title: "Phase B 用單一副本＋Graph 原生分享，不做雙寫鏡射",
      why: "省空間、只上傳一次；接受「傳送者斷線＝對方看不到」的代價——兩人本來就共用資源池，這個代價可以接受。",
      status: "designed"
    },
    {
      date: "2026-07-15",
      tag: "onedrive",
      tagLabel: "OneDrive",
      title: "取消「只能操作自己身分」的連接限制",
      why: "Jonathan／Minz 本來就共用帳密，這層限制沒有實際安全意義，改成任一登入者可連接／測試任一帳號。",
      status: "done"
    },
    {
      date: "2026-07-15",
      tag: "process",
      tagLabel: "流程",
      title: "驗收流程改用 GitHub Issue checkbox",
      why: "使用者勾選、Claude 之後查狀態更新，取代逐項截圖來回。",
      status: "done"
    }
  ];

  var STATUS_LABEL = { done: "已上線", designed: "設計完成", wip: "執行中" };

  function timelineCardHtml(item) {
    return (
      '<div class="jonaminz-journal-card">' +
        '<div class="jonaminz-journal-card-head">' +
          '<span class="jonaminz-journal-date">' + escapeHtml(item.date) + '</span>' +
          '<span class="jonaminz-journal-tag jonaminz-journal-tag--' + escapeHtml(item.tag) + '">' + escapeHtml(item.tagLabel) + '</span>' +
          '<span class="jonaminz-journal-status jonaminz-journal-status--' + escapeHtml(item.status) + '">' + escapeHtml(STATUS_LABEL[item.status] || item.status) + '</span>' +
        '</div>' +
        '<h3 class="jonaminz-journal-card-title">' + escapeHtml(item.title) + '</h3>' +
        '<p class="jonaminz-journal-card-why">' + escapeHtml(item.why) + '</p>' +
      '</div>'
    );
  }

  function renderTimeline() {
    var root = document.querySelector("[data-timeline-root]");
    if (!root) return;
    root.innerHTML = DECISION_TIMELINE.map(timelineCardHtml).join(
      '<div class="jonaminz-journal-connector">↓</div>'
    );
  }

  // ---------- 待辦看板 ----------

  var currentToken = null;

  function taskItemHtml(task) {
    return (
      '<li class="jonaminz-journal-task' + (task.done ? " is-done" : "") + '" data-task-id="' + escapeHtml(task.id) + '">' +
        '<label>' +
          '<input type="checkbox" data-task-toggle' + (task.done ? " checked" : "") + '>' +
          '<span>' + escapeHtml(task.text) + '</span>' +
        '</label>' +
        '<button type="button" class="jonaminz-journal-task-delete" data-task-delete aria-label="刪除">✕</button>' +
      '</li>'
    );
  }

  function renderLane(lane, rows) {
    var listRoot = document.querySelector('[data-lane-active="' + lane + '"]');
    var doneRoot = document.querySelector('[data-lane-done="' + lane + '"]');
    var doneCount = document.querySelector('[data-lane-done-count="' + lane + '"]');
    if (!listRoot || !doneRoot) return;

    var active = rows.filter(function (row) { return !row.done; });
    var done = rows.filter(function (row) { return row.done; });

    listRoot.innerHTML = active.length
      ? active.map(taskItemHtml).join("")
      : '<li class="jonaminz-journal-empty">目前沒有項目。</li>';
    doneRoot.innerHTML = done.map(taskItemHtml).join("");
    if (doneCount) doneCount.textContent = "已完成（" + done.length + "）";
  }

  function loadTasks() {
    window.JonaminzBackend.listProjectTasks({ token: currentToken })
      .then(function (response) {
        if (!response || !response.ok) {
          ["for_user", "for_claude"].forEach(function (lane) {
            var listRoot = document.querySelector('[data-lane-active="' + lane + '"]');
            if (listRoot) listRoot.textContent = "讀取失敗：" + ((response && response.error) || "未知錯誤");
          });
          return;
        }
        var rows = response.rows || [];
        renderLane("for_user", rows.filter(function (r) { return r.lane === "for_user"; }));
        renderLane("for_claude", rows.filter(function (r) { return r.lane === "for_claude"; }));
      })
      .catch(function (error) {
        ["for_user", "for_claude"].forEach(function (lane) {
          var listRoot = document.querySelector('[data-lane-active="' + lane + '"]');
          if (listRoot) listRoot.textContent = "讀取失敗：" + (error && error.message ? error.message : String(error));
        });
      });
  }

  function laneHtml(lane, title, placeholder) {
    return (
      '<div class="jonaminz-journal-lane">' +
        '<h3>' + escapeHtml(title) + '</h3>' +
        '<form class="jonaminz-journal-add" data-lane-form="' + lane + '">' +
          '<input type="text" placeholder="' + escapeHtml(placeholder) + '" data-lane-input="' + lane + '" required>' +
          '<button type="submit">新增</button>' +
        '</form>' +
        '<ul class="jonaminz-journal-task-list" data-lane-active="' + lane + '">讀取中...</ul>' +
        '<details class="jonaminz-journal-done">' +
          '<summary data-lane-done-count="' + lane + '">已完成</summary>' +
          '<ul class="jonaminz-journal-task-list" data-lane-done="' + lane + '"></ul>' +
        '</details>' +
      '</div>'
    );
  }

  function bindLaneEvents(lane) {
    var form = document.querySelector('[data-lane-form="' + lane + '"]');
    var input = document.querySelector('[data-lane-input="' + lane + '"]');
    if (form) {
      form.addEventListener("submit", function (event) {
        event.preventDefault();
        var text = input.value.trim();
        if (!text) return;
        input.disabled = true;
        window.JonaminzBackend.addProjectTask({ token: currentToken, lane: lane, text: text })
          .then(function () {
            input.value = "";
            input.disabled = false;
            loadTasks();
          })
          .catch(function (error) {
            input.disabled = false;
            window.alert("新增失敗：" + (error && error.message ? error.message : String(error)));
          });
      });
    }

    // checkbox 勾選／✕ 刪除都用事件代理掛在整個看板容器上（列表每次
    // loadTasks() 都會整個重繪，個別綁定會失效，代理在外層容器上就
    // 不用每次重繪後重新綁定）。
    var board = document.querySelector("[data-journal-board]");
    if (!board || board.dataset.bound) return;
    board.dataset.bound = "true";
    board.addEventListener("change", function (event) {
      if (!event.target.matches("[data-task-toggle]")) return;
      var li = event.target.closest("[data-task-id]");
      if (!li) return;
      var checked = event.target.checked;
      window.JonaminzBackend.toggleProjectTask({ token: currentToken, id: li.dataset.taskId, done: checked })
        .then(loadTasks)
        .catch(function (error) {
          window.alert("更新失敗：" + (error && error.message ? error.message : String(error)));
        });
    });
    board.addEventListener("click", function (event) {
      if (!event.target.matches("[data-task-delete]")) return;
      var li = event.target.closest("[data-task-id]");
      if (!li) return;
      window.JonaminzBackend.deleteProjectTask({ token: currentToken, id: li.dataset.taskId })
        .then(loadTasks)
        .catch(function (error) {
          window.alert("刪除失敗：" + (error && error.message ? error.message : String(error)));
        });
    });
  }

  function render() {
    var root = document.querySelector("[data-app-root]");
    if (!root) return;

    root.innerHTML =
      '<section class="jonaminz-journal-timeline" data-timeline-root></section>' +
      '<section class="jonaminz-journal-board" data-journal-board>' +
        '<p class="jonaminz-admin-section-title">待辦看板</p>' +
        '<div class="jonaminz-journal-lanes">' +
          laneHtml("for_user", "你要做的", "新增一件交辦事項...") +
          laneHtml("for_claude", "你想叫我做的", "新增一件之後要做的事...") +
        '</div>' +
      '</section>';

    renderTimeline();
    bindLaneEvents("for_user");
    bindLaneEvents("for_claude");
    loadTasks();
  }

  function init() {
    window.JonaminzIdentity.requireLogin().then(function () {
      try {
        currentToken = (window.JonaminzIdentity && window.JonaminzIdentity.readToken)
          ? window.JonaminzIdentity.readToken() : null;
        render();
        window.JonaminzLoading.done(READY_TASK);
      } catch (error) {
        console.error("[jonaminz] admin/journal app.js init failed", error);
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
