/*
檔案位置：jonaminz/pages/travel/assets/js/app.js
用途：Jonaminz Travel 第一條垂直流程（見 index.html 檔頭與交接文件
REBUILD_PLAN.md Phase 1+2）：

  建立 Trip → 建立 Place → 建立 Day → Assign Place → Move Stop
  → Unassign → Reload

刻意分成三塊：State（讀寫 localStorage，versioned）／Render（純函式，
state -> innerHTML）／Handlers（DOM 事件 -> 呼叫 State 再重新 render），
不是把資料、渲染、事件全部混在一起的單一大函式——這是交接文件
READ_ME_FIRST.md 點名舊原型「維護到極限」的主因之一，這次重寫刻意避開。

資料模型（Trip/Place/Day/Stop 欄位）沿用交接文件 AI_CONTEXT/DATA_MODEL.md，
只留 Phase 1+2 用得到的欄位，Book Page／Book Style／Memory 都還沒做。

整頁在 init() 就先過 window.JonaminzIdentity.requireLogin()，跟其他需要
登入的頁面同一套關卡；資料本身目前只存這台裝置的 localStorage，还没有
跨裝置同步（Phase 6 才接 Supabase/Worker，照 REBUILD_PLAN 自己的順序）。
只能回報自己的 loading task，不可以自己決定 css/shell ready。
*/
(function () {
  "use strict";

  var READY_TASK = "app-ready";
  var STORAGE_KEY = "jonaminz.travel.v1";
  var CATEGORY_LABEL = { must: "必去", want: "想去", food: "美食", shopping: "購物", backup: "備選" };

  var state = null;

  /* ---------- State ---------- */

  function uid() {
    return "id-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
  }

  function loadState() {
    var raw = null;
    try {
      raw = window.localStorage.getItem(STORAGE_KEY);
    } catch (error) {
      raw = null;
    }
    if (!raw) {
      return { version: 1, trips: [], places: [], days: [], stops: [], activeTripId: null };
    }
    try {
      var parsed = JSON.parse(raw);
      // 目前只有 version 1，之後 schema 改了在這裡加 migration，不是
      // 直接假設舊資料格式一定符合新程式碼的預期。
      if (parsed && parsed.version === 1) return parsed;
      return { version: 1, trips: [], places: [], days: [], stops: [], activeTripId: null };
    } catch (error) {
      return { version: 1, trips: [], places: [], days: [], stops: [], activeTripId: null };
    }
  }

  function saveState() {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      // localStorage 不可用就放棄持久化，頁面本身仍可操作到下次 reload。
    }
  }

  function tripDays(tripId) {
    return state.days.filter(function (d) { return d.tripId === tripId; }).sort(function (a, b) { return a.index - b.index; });
  }

  function tripPlaces(tripId) {
    return state.places.filter(function (p) { return p.tripId === tripId; });
  }

  function dayStops(dayId) {
    return state.stops.filter(function (s) { return s.dayId === dayId; }).sort(function (a, b) { return a.position - b.position; });
  }

  function assignedPlaceIds(tripId) {
    var dayIds = {};
    tripDays(tripId).forEach(function (d) { dayIds[d.id] = true; });
    var set = {};
    state.stops.forEach(function (s) {
      if (dayIds[s.dayId] && s.sourcePlaceId) set[s.sourcePlaceId] = true;
    });
    return set;
  }

  /* ---------- Actions ---------- */

  function createTrip(title) {
    var trip = { id: uid(), title: title, startDate: null, endDate: null, status: "planning" };
    state.trips.push(trip);
    state.activeTripId = trip.id;
    saveState();
  }

  function selectTrip(id) {
    state.activeTripId = id;
    saveState();
  }

  function createPlace(tripId, title, category) {
    state.places.push({ id: uid(), tripId: tripId, title: title, category: category || "want", note: "" });
    saveState();
  }

  function createDay(tripId, date, title) {
    var nextIndex = tripDays(tripId).length + 1;
    state.days.push({ id: uid(), tripId: tripId, index: nextIndex, date: date || "", title: title || ("Day " + nextIndex) });
    saveState();
  }

  function assignPlaceToDay(placeId, dayId) {
    var place = state.places.filter(function (p) { return p.id === placeId; })[0];
    if (!place) return;
    var existing = dayStops(dayId);
    var nextPosition = existing.length ? existing[existing.length - 1].position + 1 : 1;
    state.stops.push({
      id: uid(),
      dayId: dayId,
      sourcePlaceId: placeId,
      title: place.title,
      category: place.category,
      time: "",
      position: nextPosition
    });
    saveState();
  }

  function moveStop(stopId, direction) {
    var stop = state.stops.filter(function (s) { return s.id === stopId; })[0];
    if (!stop) return;
    var siblings = dayStops(stop.dayId);
    var index = siblings.findIndex(function (s) { return s.id === stopId; });
    var swapIndex = index + (direction === "up" ? -1 : 1);
    if (swapIndex < 0 || swapIndex >= siblings.length) return;
    var other = siblings[swapIndex];
    var tmp = stop.position;
    stop.position = other.position;
    other.position = tmp;
    saveState();
  }

  function unassignStop(stopId) {
    state.stops = state.stops.filter(function (s) { return s.id !== stopId; });
    saveState();
  }

  /* ---------- Render ---------- */

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  }

  function renderTripBar(root) {
    var html = state.trips.map(function (t) {
      return (
        '<button type="button" class="jonaminz-travel-trip-chip" data-select-trip="' + t.id + '" data-active="' +
        (t.id === state.activeTripId) + '">' + escapeHtml(t.title) + "</button>"
      );
    }).join("");

    html += (
      '<form class="jonaminz-travel-new-trip" data-new-trip-form>' +
      '<input type="text" name="title" placeholder="新旅行名稱" required>' +
      '<button type="submit" class="jonaminz-travel-btn">＋ 建立旅行</button>' +
      "</form>"
    );

    root.querySelector("[data-trip-bar]").innerHTML = html;
  }

  function renderBoard(root) {
    var boardEl = root.querySelector("[data-board]");
    if (!state.activeTripId) {
      boardEl.innerHTML = '<p class="jonaminz-travel-empty">先建立一趟旅行，或從上面選一個既有的。</p>';
      return;
    }

    var tripId = state.activeTripId;
    var assigned = assignedPlaceIds(tripId);
    var unassignedPlaces = tripPlaces(tripId).filter(function (p) { return !assigned[p.id]; });
    var days = tripDays(tripId);

    var placesHtml = unassignedPlaces.length
      ? unassignedPlaces.map(function (p) {
          var dayOptions = days.map(function (d) {
            return '<option value="' + d.id + '">' + escapeHtml(d.title) + "</option>";
          }).join("");
          return (
            '<div class="jonaminz-travel-place-card">' +
            '<span class="jonaminz-travel-place-title">' + escapeHtml(p.title) + "</span>" +
            '<span class="jonaminz-travel-tag">' + escapeHtml(CATEGORY_LABEL[p.category] || p.category) + "</span>" +
            (days.length
              ? '<select class="jonaminz-travel-assign-select" data-assign-select data-place-id="' + p.id + '">' +
                '<option value="">排到...</option>' + dayOptions + "</select>"
              : "") +
            "</div>"
          );
        }).join("")
      : '<p class="jonaminz-travel-empty">還沒有素材，用下面的表單加一個。</p>';

    var daysHtml = days.length
      ? days.map(function (d) {
          var stops = dayStops(d.id);
          var stopsHtml = stops.length
            ? stops.map(function (s, i) {
                return (
                  '<div class="jonaminz-travel-stop-card">' +
                  '<span class="jonaminz-travel-place-title">' + escapeHtml(s.title) + "</span>" +
                  '<button type="button" class="jonaminz-travel-icon-btn" data-move="up" data-stop-id="' + s.id + '"' +
                  (i === 0 ? " disabled" : "") + ">↑</button>" +
                  '<button type="button" class="jonaminz-travel-icon-btn" data-move="down" data-stop-id="' + s.id + '"' +
                  (i === stops.length - 1 ? " disabled" : "") + ">↓</button>" +
                  '<button type="button" class="jonaminz-travel-icon-btn" data-unassign="' + s.id + '">移除</button>' +
                  "</div>"
                );
              }).join("")
            : '<p class="jonaminz-travel-empty">這天還沒有排任何行程。</p>';
          return (
            '<div class="jonaminz-travel-day">' +
            '<div class="jonaminz-travel-day-header">' +
            '<span class="jonaminz-travel-day-title">' + escapeHtml(d.title) + "</span>" +
            '<span class="jonaminz-travel-day-date">' + escapeHtml(d.date || "") + "</span>" +
            "</div>" +
            stopsHtml +
            "</div>"
          );
        }).join("")
      : '<p class="jonaminz-travel-empty">還沒有天數，用下面的表單加一天。</p>';

    boardEl.innerHTML =
      '<div class="jonaminz-travel-panel">' +
      "<h2>素材（未排入行程）</h2>" +
      '<form class="jonaminz-travel-new-place-form" data-new-place-form>' +
      '<input type="text" name="title" placeholder="景點/餐廳名稱" required>' +
      '<select name="category">' +
      Object.keys(CATEGORY_LABEL).map(function (k) {
        return '<option value="' + k + '">' + CATEGORY_LABEL[k] + "</option>";
      }).join("") +
      "</select>" +
      '<button type="submit" class="jonaminz-travel-btn" data-variant="ghost">＋ 加素材</button>' +
      "</form>" +
      placesHtml +
      "</div>" +
      '<div class="jonaminz-travel-panel">' +
      "<h2>行程</h2>" +
      '<form class="jonaminz-travel-new-day-form" data-new-day-form>' +
      '<input type="date" name="date">' +
      '<input type="text" name="title" placeholder="這天的標題（選填）">' +
      '<button type="submit" class="jonaminz-travel-btn" data-variant="ghost">＋ 加一天</button>' +
      "</form>" +
      daysHtml +
      "</div>";
  }

  function render(root) {
    renderTripBar(root);
    renderBoard(root);
  }

  /* ---------- Handlers ---------- */

  function bindEvents(root) {
    root.addEventListener("click", function (event) {
      var selectTripBtn = event.target.closest("[data-select-trip]");
      if (selectTripBtn) {
        selectTrip(selectTripBtn.getAttribute("data-select-trip"));
        render(root);
        return;
      }

      var moveBtn = event.target.closest("[data-move]");
      if (moveBtn) {
        moveStop(moveBtn.getAttribute("data-stop-id"), moveBtn.getAttribute("data-move"));
        render(root);
        return;
      }

      var unassignBtn = event.target.closest("[data-unassign]");
      if (unassignBtn) {
        unassignStop(unassignBtn.getAttribute("data-unassign"));
        render(root);
        return;
      }
    });

    root.addEventListener("change", function (event) {
      var select = event.target.closest("[data-assign-select]");
      if (select && select.value) {
        assignPlaceToDay(select.getAttribute("data-place-id"), select.value);
        render(root);
      }
    });

    root.addEventListener("submit", function (event) {
      var newTripForm = event.target.closest("[data-new-trip-form]");
      if (newTripForm) {
        event.preventDefault();
        var title = newTripForm.title.value.trim();
        if (title) createTrip(title);
        render(root);
        return;
      }

      var newPlaceForm = event.target.closest("[data-new-place-form]");
      if (newPlaceForm) {
        event.preventDefault();
        var placeTitle = newPlaceForm.title.value.trim();
        if (placeTitle && state.activeTripId) createPlace(state.activeTripId, placeTitle, newPlaceForm.category.value);
        newPlaceForm.reset();
        render(root);
        return;
      }

      var newDayForm = event.target.closest("[data-new-day-form]");
      if (newDayForm) {
        event.preventDefault();
        if (state.activeTripId) createDay(state.activeTripId, newDayForm.date.value, newDayForm.title.value.trim());
        newDayForm.reset();
        render(root);
        return;
      }
    });
  }

  /* ---------- Init ---------- */

  function init() {
    window.JonaminzIdentity.requireLogin().then(function () {
      try {
        state = loadState();

        var root = document.querySelector("[data-app-root]");
        root.innerHTML =
          '<div class="jonaminz-travel-trip-bar" data-trip-bar></div>' +
          '<div class="jonaminz-travel-board" data-board></div>';

        bindEvents(root);
        render(root);

        window.JonaminzLoading.done(READY_TASK);
      } catch (error) {
        window.JonaminzLoading.fail(READY_TASK, error);
      }
    });
  }

  init();
})();
