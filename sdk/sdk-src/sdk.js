/*
檔案位置：jonaminz/sdk/sdk-src/sdk.js
用途：implementation plan 第 6 項——SDK Kernel。取代第 5 項的 placeholder，
真的去讀合約、推送給平台、查 Effective Settings，正確 settle S21 官方
snippet 的 `ready` Promise。對應規格 S18-S23（contract discovery、snippet
協定）、S26（lifecycle 狀態機）、S27-S29（錯誤模型）。

implementation plan 第 7 項新增：`effectiveCss === "tokens"` 時呼叫
`applyTokens()`，收編 `assets/js/theme-runtime.js` 現有的「讀
`theme_css_rules`、組 CSS、注入 `<style>`」邏輯，但走 gated 路徑
（原本 theme-runtime.js 是任何人貼一行 script 就拿得到，不經過
Contract／Settings 審核，v0 舊機制，這次不動它）。只收編 `:root` 那些
列（S35：跨專案共用介面），不收編其他 selector（jonaminz 自己共用元件
的微調，對外部專案沒有意義）。命名機械式轉換成 `--jz-*`（S36：
`--color-primary` → `--jz-primary`），舊名保留當別名一起輸出，不是
只換不留。CSS 套用不 await、不擋 `ready` settle——S23 沒有把它列進
`ready` 的必要條件，套用失敗只是不顯示外觀，不影響核心 lifecycle
（跟 theme-runtime.js 一樣的容錯哲學）。

implementation plan 第 9 項階段 B 新增：第一個正式發布的 service——
`window.Jonaminz.identity.currentUser()`（`identity.currentUser@1`，
S30-33）。S32 規定一經發布，這個 function 永遠掛在 API 物件上，不論
呼叫端的專案有沒有被授權都不能變成 undefined；未授權時呼叫要 reject
`CAPABILITY_NOT_GRANTED`，不能同步 throw。實際取得身分的方式是動態建立
一個隱藏 iframe 指到 `pages/identity-relay/`（同源於 jonaminz.com，能
讀到 jonaminz 自己的登入 session；這裡跟 jonaminz.com 不同源，讀不到），
用 postMessage 收結果——**SDK 端的 capabilities 陣列只是提示，S33 規定
真正的授權判斷要由 Worker 逐請求重算**，所以 relay 頁面背後打的是新
action `getGrantedIdentity`，不是隨便信任這裡快取的值。identity 授權
與否是獨立的能力，不影響 tokens／`ready`／`degraded` 這條既有 lifecycle。

改這個檔案後要重跑 sdk/generate-sdk-release.mjs 產生新的
sdk/sdk-<hash>.js，並且要人工決定要不要把某個 channel 的指標指過去
（不自動發生）。
*/
(function () {
  "use strict";

  var WORKER_URL = "https://jonaminz-backend.ndmc402010104.workers.dev/api/action";
  var DEFAULT_CONTRACT_PATH = "/jonaminz.contract.json";
  var FETCH_TIMEOUT_MS = 8000;

  var IDENTITY_CAPABILITY = "identity.currentUser@1";
  var IDENTITY_RELAY_URL = "https://www.jonaminz.com/pages/identity-relay/";
  var IDENTITY_RELAY_ORIGIN = "https://www.jonaminz.com";
  var IDENTITY_TIMEOUT_MS = 5000;
  var IDENTITY_LABEL = { jonathan: "Jonathan", minz: "Minz" };

  // S31 的 effective capabilities（getEffectiveSettings 回應算出來的
  // 交集），在 settings 這輪流程跑完之前一律是空陣列——currentUser() 會
  // 先等 whenSettingsSettled() 才讀這個變數，不會讀到中途的暫時值。
  var effectiveCapabilities = [];
  var settingsSettled = false;
  var settingsWaiters = [];

  function whenSettingsSettled() {
    if (settingsSettled) return Promise.resolve();
    return new Promise(function (resolve) { settingsWaiters.push(resolve); });
  }

  // report() 是既有 lifecycle 唯一寫入 status 的地方，這裡搭便車在每次
  // report() 呼叫時一併 settle，涵蓋所有既有的 ready/degraded 路徑，不用
  // 另外在每個 .then()/.catch() 分支各自加一次 settle 呼叫。
  function settleSettings() {
    if (settingsSettled) return;
    settingsSettled = true;
    var waiters = settingsWaiters;
    settingsWaiters = [];
    waiters.forEach(function (resolve) { resolve(); });
  }

  function timeoutFetch(url, options) {
    var controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    var timer = controller ? setTimeout(function () { controller.abort(); }, FETCH_TIMEOUT_MS) : null;

    return fetch(url, {
      method: (options && options.method) || "GET",
      headers: options && options.headers,
      body: options && options.body,
      signal: controller ? controller.signal : undefined
    })
      .then(function (response) {
        if (timer) clearTimeout(timer);
        return response;
      })
      .catch(function (error) {
        if (timer) clearTimeout(timer);
        throw error;
      });
  }

  function callWorker(action, payload) {
    return timeoutFetch(WORKER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: action, payload: payload || {} })
    }).then(function (response) {
      return response.json();
    });
  }

  // S19：Contract URL 限跟目前頁面同源。data-contract 若指到別的 origin
  // （或根本不是合法 URL），視為 discovery 失敗，不接受跨源合約——絕對
  // URL 覆寫同源限制是規格明確否決的行為（S20）。
  function resolveContractUrl(overridePath) {
    try {
      var resolved = new URL(overridePath || DEFAULT_CONTRACT_PATH, window.location.origin);
      if (resolved.origin !== window.location.origin) return null;
      return resolved.href;
    } catch (error) {
      return null;
    }
  }

  // F5/S8 最小必填集合的客戶端粗篩——不是 Worker 那份完整 JSON Schema
  // 驗證（那份在 submitContract 裡跑），這裡只擋明顯壞掉的合約，
  // 不用重工整份驗證邏輯。
  function hasMinimalFields(contract) {
    return !!(
      contract &&
      typeof contract === "object" &&
      typeof contract.contractVersion === "number" &&
      contract.app &&
      typeof contract.app.projectId === "string" &&
      contract.app.projectId &&
      typeof contract.app.title === "string" &&
      contract.app.title
    );
  }

  // S22：有 __snippetVersion 標記才是官方 snippet 建立的物件，在上面
  // 初始化；沒有標記（window.Jonaminz 不存在，或被其他程式佔用）一律
  // 不覆寫、不建立，靜默退場——這是規格明文規定的行為，不是防禦性巧合。
  function findSnippetTarget() {
    var jz = window.Jonaminz;
    if (!jz || !jz.__snippetVersion) return null;
    return jz;
  }

  // S21：__bootstrap 存在就呼叫它的 settle()（該函式自己保證只生效一次）；
  // __bootstrap 已經被刪除（15 秒逾時已經 settle 成 degraded，Kernel 才
  // 姍姍來遲）就不重播 Promise，直接就地更新同一個物件的 status/reason/
  // diagnostics——宿主下次讀 jz.status 就會看到恢復。
  function report(jz, status, reason, diagnostics) {
    jz.diagnostics = diagnostics;
    if (jz.__bootstrap) {
      jz.__bootstrap.settle(status, reason);
    } else {
      jz.status = status;
      jz.reason = reason || null;
    }
    settleSettings();
  }

  // S36：機械式轉換，不引入新的命名意見——拿掉舊前綴（目前只有
  // "--color-" 這一種）、換成 "--jz-"，其餘語意名稱不變。
  function jzTokenName(property) {
    if (property.indexOf("--color-") === 0) return "--jz-" + property.slice(8);
    if (property.indexOf("--") === 0) return "--jz-" + property.slice(2);
    return property;
  }

  // 收編 theme-runtime.js 的「讀 theme_css_rules、組 CSS、注入
  // <style>」邏輯，但只挑 :root 那些列（S35：這才是跨專案共用介面，
  // 其他 selector 是 jonaminz 自己共用元件的微調，對外部專案沒有意義）。
  // 舊名／--jz-* 新名都輸出（S36 別名過渡），值一樣。失敗就放棄，不影響
  // ready/degraded（跟 theme-runtime.js 一樣的容錯哲學，S24）。
  function applyTokens() {
    callWorker("getThemeCssRules", {})
      .then(function (response) {
        var rows = (response && response.rows) || [];
        var rootRows = rows.filter(function (row) { return row.selector === ":root"; });
        if (!rootRows.length) return;

        var lines = [":root {"];
        rootRows.forEach(function (row) {
          lines.push("  " + row.property + ": " + row.value + ";");
          lines.push("  " + jzTokenName(row.property) + ": " + row.value + ";");
        });
        lines.push("}");

        var style = document.getElementById("jonaminz-sdk-tokens");
        if (!style) {
          style = document.createElement("style");
          style.id = "jonaminz-sdk-tokens";
          document.head.appendChild(style);
        }
        style.textContent = lines.join("\n");
      })
      .catch(function (error) {
        console.warn("[jonaminz] tokens 套用失敗，維持宿主頁面原本樣式：", error);
      });
  }

  function makeCapabilityError(code, message, retryable) {
    return {
      code: code,
      message: message,
      service: "identity",
      capability: IDENTITY_CAPABILITY,
      retryable: !!retryable
    };
  }

  function mapIdentity(identity) {
    if (!identity) return null;
    return { id: identity, displayName: IDENTITY_LABEL[identity] || identity };
  }

  // 動態建立隱藏 iframe 指到 pages/identity-relay/（帶上 projectId query
  // string），監聽 postMessage 拿回「granted＋identity」。event.origin
  // 驗證在這裡做——relay 頁面本身刻意不驗證來源（見該檔案註解，往外送的
  // 內容不含 token），真正該驗證的是接收端，也就是這裡。5 秒逾時視為
  // relay 沒回應（多半是網路問題，reject 標 retryable:true，跟
  // CAPABILITY_NOT_GRANTED 那種「問到答案是不准」明確分開）。
  function fetchIdentityViaRelay(projectId) {
    return new Promise(function (resolve, reject) {
      var settled = false;
      var iframe = document.createElement("iframe");
      iframe.style.display = "none";
      iframe.src = IDENTITY_RELAY_URL + "?projectId=" + encodeURIComponent(projectId);

      function cleanup() {
        window.removeEventListener("message", onMessage);
        clearTimeout(timer);
        if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
      }

      function finish(fn, value) {
        if (settled) return;
        settled = true;
        cleanup();
        fn(value);
      }

      function onMessage(event) {
        if (event.origin !== IDENTITY_RELAY_ORIGIN) return;
        var data = event.data;
        if (!data || data.source !== "jonaminz-identity-relay") return;
        if (!data.granted) {
          finish(reject, makeCapabilityError(
            "CAPABILITY_NOT_GRANTED",
            "identity.currentUser@1 is not granted to this project",
            false
          ));
          return;
        }
        finish(resolve, { currentUser: mapIdentity(data.identity) });
      }

      var timer = setTimeout(function () {
        finish(reject, makeCapabilityError(
          "IDENTITY_TIMEOUT",
          "identity relay did not respond in time",
          true
        ));
      }, IDENTITY_TIMEOUT_MS);

      window.addEventListener("message", onMessage);
      document.body.appendChild(iframe);
    });
  }

  function init() {
    var jz = findSnippetTarget();
    if (!jz) {
      console.warn("[jonaminz] window.Jonaminz 沒有 __snippetVersion 標記，SDK Kernel 不初始化。");
      return;
    }

    // document.currentScript 只在同步階段可靠，這裡是唯一讀取點——
    // 之後全部走非同步 fetch，不能再依賴它（跟 jonaminz-entry.js 同樣
    // 的教訓）。
    var script = document.currentScript;
    var contractOverride = (script && script.dataset && script.dataset.contract) || "";
    var release = (script && script.dataset && script.dataset.release) || "";
    var staleCache = !!(script && script.dataset && script.dataset.stale === "1");

    var diagnostics = {
      release: release,
      settingsRevision: null,
      rejectedCapabilities: [],
      lastErrorCode: null,
      staleCache: staleCache,
      // v1 沒有任何機制知道「這是不是一次回滾」（需要額外追蹤上一個
      // 已知穩定版本，現在沒有 caller 需要這個資訊），刻意留 false。
      rollback: false
    };

    var projectId = null;

    // S32：一經發布，這個 function 永遠掛在 window.Jonaminz.identity 上，
    // 不論這個專案的合約有沒有宣告、有沒有被 Settings 授權都不能變成
    // undefined——所以在這裡（contract discovery 完成前）就先掛上去，
    // 不是等 getEffectiveSettings 回來才決定要不要建立這個 namespace。
    // 呼叫時才去看 effectiveCapabilities（等 whenSettingsSettled() 之後
    // 的最終值），沒授權就 reject，不同步 throw。
    function currentUser() {
      return whenSettingsSettled().then(function () {
        if (effectiveCapabilities.indexOf(IDENTITY_CAPABILITY) === -1) {
          return Promise.reject(makeCapabilityError(
            "CAPABILITY_NOT_GRANTED",
            "identity.currentUser@1 is not granted to this project",
            false
          ));
        }
        return fetchIdentityViaRelay(projectId);
      });
    }
    jz.identity = { currentUser: currentUser };

    var contractUrl = resolveContractUrl(contractOverride);
    if (!contractUrl) {
      diagnostics.lastErrorCode = "CONTRACT_NOT_FOUND";
      report(jz, "degraded", "CONTRACT_NOT_FOUND", diagnostics);
      return;
    }

    timeoutFetch(contractUrl, { headers: { Accept: "application/json" } })
      .then(function (response) {
        if (!response.ok) {
          var err = new Error("contract fetch failed");
          err.code = "CONTRACT_NOT_FOUND";
          throw err;
        }
        return response.json().catch(function () {
          var err = new Error("contract is not valid JSON");
          err.code = "CONTRACT_INVALID";
          throw err;
        });
      })
      .then(function (contract) {
        if (!hasMinimalFields(contract)) {
          var err = new Error("contract missing minimal required fields");
          err.code = "CONTRACT_INVALID";
          throw err;
        }

        projectId = contract.app.projectId;

        // S13/S16：推送 ≠ 採信，推送本身失敗不是致命錯誤——只要這個
        // projectId 之前有 approved 過的版本，平台整合仍應正常運作。
        // 用 catch 吞掉推送失敗，只記錄 reason，繼續往下查 Effective
        // Settings（那才是真正決定 ready/degraded 的依據）。
        return callWorker("submitContract", { projectId: projectId, contract: contract }).catch(function () {
          diagnostics.lastErrorCode = "SUBMIT_FAILED";
          return null;
        });
      })
      .then(function () {
        return callWorker("getEffectiveSettings", { projectId: projectId });
      })
      .then(function (settings) {
        if (!settings || settings.ok !== true) {
          // Worker 有給明確的 code（例如 PROJECT_NOT_REGISTERED）就用那個，
          // 比泛用的 SETTINGS_UNAVAILABLE 有意義得多——真正的「Worker 打不
          // 通」才會走到後面 .catch() 裡的 NETWORK_ERROR。
          var code = (settings && settings.code) || "SETTINGS_UNAVAILABLE";
          diagnostics.lastErrorCode = code;
          report(jz, "degraded", code, diagnostics);
          return;
        }

        diagnostics.settingsRevision = settings.revision;
        // S31 effective capabilities：不論 approved 與否都先存下來
        // （未 approved 時 Worker 本來就回 []），currentUser() 靠
        // whenSettingsSettled() 保證讀到的是這裡設定完的最終值。
        effectiveCapabilities = (settings.capabilities || []).filter(function (c) {
          return typeof c === "string";
        });

        // S23/S31：沒有 active approved snapshot → resolve degraded
        // （reason 標明 unapproved），不是 reject——這不是操作失敗，
        // 是操作完成但沒有授權，S27-29 規定 reject 只留給沒完成的操作。
        if (settings.approved) {
          // 不 await：tokens 是 best-effort 視覺套用，不擋 ready settle。
          if (settings.css === "tokens") applyTokens();
          report(jz, "ready", null, diagnostics);
        } else {
          diagnostics.lastErrorCode = "NOT_APPROVED";
          report(jz, "degraded", "NOT_APPROVED", diagnostics);
        }
      })
      .catch(function (error) {
        var code = (error && error.code) || "NETWORK_ERROR";
        diagnostics.lastErrorCode = code;
        report(jz, "degraded", code, diagnostics);
      });
  }

  try {
    init();
  } catch (error) {
    // S23 唯一的 reject 情況：SDK 自身不可恢復錯誤（不是查無合約、未核准
    // 這類正常降級路徑，那些都在 init() 內部的 .catch() 被吞成 degraded）。
    settleSettings();
    try {
      var jz = window.Jonaminz;
      if (jz && jz.__bootstrap) {
        jz.__bootstrap.settle("reject", {
          code: "SDK_INIT_FAILED",
          message: String((error && error.message) || error),
          service: null,
          capability: null,
          retryable: false
        });
      }
    } catch (innerError) {
      // 不燒房子：連這個都失敗就真的放棄，不再往外拋。
    }
  }
})();
