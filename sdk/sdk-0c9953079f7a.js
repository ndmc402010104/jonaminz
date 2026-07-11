/*
 * 自動產生，不要手動編輯。
 * 來源：sdk/sdk-src/sdk.js（內容的 sha256 前 12 碼）
 * 產生方式：node sdk/generate-sdk-release.mjs
 * immutable：這個檔名就是這份內容的身分，內容不會變、也不該被覆寫。
 * sdk-src/sdk.js 改了要重跑這支腳本產生新檔名，並自行決定要不要把
 * backend/cloudflare-worker/sdk-versions.json 的某個 channel 指過來。
 */
/*
檔案位置：jonaminz/sdk/sdk-src/sdk.js
用途：implementation plan 第 6 項——SDK Kernel。取代第 5 項的 placeholder，
真的去讀合約、推送給平台、查 Effective Settings，正確 settle S21 官方
snippet 的 `ready` Promise。對應規格 S18-S23（contract discovery、snippet
協定）、S26（lifecycle 狀態機）、S27-S29（錯誤模型）。

範圍刻意收窄：v1 沒有任何已正式發布的 service（S30-32 的 capability
文法），所以這裡**不掛任何 window.Jonaminz.* service 命名空間**——這是
照 S32「未授權的工具存在但婉拒，但本條只適用於已正式發布的 service」
推論出的正確結果，不是漏做。JonaminzError 的物件形狀（S27：
`{code, message, service, capability, retryable}`）只在 SDK_INIT_FAILED
這唯一的 reject 情況用到，這裡沒有生一個沒人呼叫的 constructor——等
第一個真實 service 出現才有東西需要 reject。CSS tokens 套用（S34-36）
是第 7 項的事，這裡的 Effective Settings 查詢結果只進 diagnostics，
不做任何 DOM 操作。

改這個檔案後要重跑 sdk/generate-sdk-release.mjs 產生新的
sdk/sdk-<hash>.js，並且要人工決定要不要把某個 channel 的指標指過去
（不自動發生）。
*/
(function () {
  "use strict";

  var WORKER_URL = "https://jonaminz-backend.ndmc402010104.workers.dev/api/action";
  var DEFAULT_CONTRACT_PATH = "/jonaminz.contract.json";
  var FETCH_TIMEOUT_MS = 8000;

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

    var contractUrl = resolveContractUrl(contractOverride);
    if (!contractUrl) {
      diagnostics.lastErrorCode = "CONTRACT_NOT_FOUND";
      report(jz, "degraded", "CONTRACT_NOT_FOUND", diagnostics);
      return;
    }

    var projectId = null;

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

        // S23/S31：沒有 active approved snapshot → resolve degraded
        // （reason 標明 unapproved），不是 reject——這不是操作失敗，
        // 是操作完成但沒有授權，S27-29 規定 reject 只留給沒完成的操作。
        if (settings.approved) {
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
