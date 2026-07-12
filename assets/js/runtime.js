/*
檔案位置：jonaminz/assets/js/runtime.js
用途：全站共用 runtime 診斷核心（水庫 shell 層）。待辦總表順序④
（docs/roadmap-202607.md）：搬自 SKHPSV2 的 runtime.js，但**不是照抄**
——SKHPS 版本把五個子系統名稱（config/backend/css/externalApps/
loadingGate）寫死在 API 裡（setConfig()/setBackend()/setCssRuntime()
這幾個獨立方法），這樣沒辦法讓不同專案登記自己的模組，這次重新設計成
可插拔：任何呼叫端（jonaminz 自己的 entry-core.js，或未來 skhpsv2 遷移
過來時）都用同一組 registerModule()/setModuleStatus() 登記「自己」的
模組名稱，runtime 核心本身不認得任何特定專案的子系統名字。

- 本檔只收集資料（log 記錄、模組狀態）、發事件，**不含任何畫面**——
  SKHPS 版本另外還有一整套 footer 五盞燈號＋可展開診斷面板的 UI
  （在 footer.js 裡，將近 2000 行），這次刻意不搬那塊：jonaminz 的
  footer 現在只顯示版本號，這裡先把資料層蓋好，UI 要不要做、做成
  什麼樣子是之後的事，不要在沒有真的需要之前先猜一個介面出來。
- status 語意化字串（'ok'|'warn'|'error'|'pending'|'unknown'），不是
  顏色或圖示——畫面怎麼呈現由未來真的要做 UI 的呼叫端決定。
- log 只保留最近 N 筆（環狀緩衝），避免長時間停留的分頁無限累積記憶體。
*/
(function () {
  "use strict";

  var MAX_LOG_ENTRIES = 200;
  var VALID_STATUSES = { ok: true, warn: true, error: true, pending: true, unknown: true };
  var UPDATE_EVENT = "jonaminz-runtime-updated";

  var logs = [];
  var modules = {};
  var subscribers = [];
  var openedAt = Date.now();

  function clone(value) {
    try {
      return JSON.parse(JSON.stringify(value));
    } catch (error) {
      return value;
    }
  }

  function normalizeLevel(level) {
    level = String(level || "info").toLowerCase();
    return (level === "warn" || level === "error" || level === "info" || level === "debug") ? level : "info";
  }

  function normalizeStatus(status) {
    status = String(status || "unknown").toLowerCase();
    return VALID_STATUSES[status] ? status : "unknown";
  }

  function notify() {
    var snapshot = getState();

    try {
      document.dispatchEvent(new CustomEvent(UPDATE_EVENT, { detail: snapshot }));
    } catch (error) {}

    subscribers.forEach(function (handler) {
      try { handler(snapshot); } catch (error) {}
    });
  }

  // 記一筆 log。entry 至少要有 module／message，level 預設 info。
  // 回傳整理過的 entry 本身，方便呼叫端需要的話直接拿去用（例如順手
  // console.log 出來）。
  function log(entry) {
    entry = entry || {};

    var record = {
      level: normalizeLevel(entry.level),
      module: String(entry.module || "unknown"),
      message: String(entry.message || ""),
      data: entry.data !== undefined ? clone(entry.data) : null,
      atMs: Date.now() - openedAt,
      atIso: new Date().toISOString()
    };

    logs.push(record);
    if (logs.length > MAX_LOG_ENTRIES) {
      logs.splice(0, logs.length - MAX_LOG_ENTRIES);
    }

    notify();
    return record;
  }

  // 登記一個模組（例如 "loading-gate"、"theme"）。label 是人看得懂的
  // 顯示名稱，純資訊用途，不影響邏輯。重複登記同一個名字會被忽略，
  // 不會覆蓋已經有的狀態。
  function registerModule(name, meta) {
    name = String(name || "").trim();
    if (!name) return;

    if (!modules[name]) {
      modules[name] = {
        label: (meta && meta.label) || name,
        status: "pending",
        detail: "",
        updatedAtIso: new Date().toISOString()
      };
      notify();
    }
  }

  // 更新一個模組的狀態。沒登記過的模組會自動用模組名稱當 label 補登記，
  // 呼叫端不用一定要先呼叫 registerModule() 才能回報狀態。
  function setModuleStatus(name, status, detail) {
    name = String(name || "").trim();
    if (!name) return;

    if (!modules[name]) {
      registerModule(name);
    }

    modules[name].status = normalizeStatus(status);
    modules[name].detail = detail == null ? "" : String(detail);
    modules[name].updatedAtIso = new Date().toISOString();

    notify();
  }

  function getModuleState(name) {
    var mod = modules[String(name || "").trim()];
    return mod ? clone(mod) : null;
  }

  function getState() {
    return {
      modules: clone(modules),
      logs: clone(logs),
      openedAtIso: new Date(openedAt).toISOString(),
      durationMs: Date.now() - openedAt
    };
  }

  function subscribe(handler) {
    if (typeof handler !== "function") return function () {};

    subscribers.push(handler);
    try { handler(getState()); } catch (error) {}

    return function () {
      subscribers = subscribers.filter(function (item) { return item !== handler; });
    };
  }

  window.JonaminzRuntime = {
    version: "v1.0.0-20260712",
    eventName: UPDATE_EVENT,
    log: log,
    registerModule: registerModule,
    setModuleStatus: setModuleStatus,
    getModuleState: getModuleState,
    getState: getState,
    subscribe: subscribe
  };
})();
