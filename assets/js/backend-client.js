/*
檔案位置：jonaminz/assets/js/backend-client.js
用途：jonaminz 水庫唯一後端呼叫入口，走 config.json 的 backend.worker.baseUrl
（見 backend/cloudflare-worker/）。baseUrl 沒設定時 call() 直接 reject，不回退假資料。
只有需要後端的頁面（目前是後台）才會載入這份檔案，不是每頁都載。
*/
(function () {
  "use strict";

  var DEFAULT_TIMEOUT_MS = 8000;
  var configPromise = null;

  function loadConfig() {
    if (window.JONAMINZ_SITE_CONFIG) {
      return Promise.resolve(window.JONAMINZ_SITE_CONFIG);
    }

    if (!configPromise) {
      var configUrl = window.JONAMINZ_SITE_CONFIG_URL || "/config.json";
      configPromise = fetch(configUrl, { cache: "no-store" }).then(function (res) {
        if (!res.ok) throw new Error("config.json HTTP " + res.status);
        return res.json();
      });
    }

    return configPromise;
  }

  function getWorkerBaseUrl(config) {
    var worker = config && config.backend && config.backend.worker;
    return worker && worker.baseUrl ? String(worker.baseUrl).replace(/\/+$/, "") : "";
  }

  function call(action, payload, options) {
    options = options || {};

    return loadConfig().then(function (config) {
      var baseUrl = getWorkerBaseUrl(config);

      if (!baseUrl) {
        throw new Error("找不到 config.json 的 backend.worker.baseUrl");
      }

      var controller = typeof AbortController !== "undefined" ? new AbortController() : null;
      var timer = controller
        ? setTimeout(function () { controller.abort(); }, options.timeoutMs || DEFAULT_TIMEOUT_MS)
        : null;

      return fetch(baseUrl + "/api/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: action, payload: payload || {} }),
        signal: controller ? controller.signal : undefined
      }).then(function (response) {
        if (timer) clearTimeout(timer);

        return response.text().then(function (text) {
          var data;

          try {
            data = text ? JSON.parse(text) : {};
          } catch (error) {
            throw new Error("Worker 回傳不是合法 JSON: " + text);
          }

          if (!response.ok || data.ok === false) {
            throw new Error((data && data.error) || "Worker action failed: HTTP " + response.status);
          }

          return data;
        });
      }).catch(function (error) {
        if (timer) clearTimeout(timer);
        throw error;
      });
    });
  }

  function registerExternalApp(payload, options) {
    return call("registerExternalApp", payload, options);
  }

  function listExternalAppRegistrations(options) {
    return call("listExternalAppRegistrations", {}, options);
  }

  function listPendingContracts(options) {
    return call("listPendingContracts", {}, options);
  }

  function approveContract(payload, options) {
    return call("approveContract", payload, options);
  }

  function rejectContract(payload, options) {
    return call("rejectContract", payload, options);
  }

  function getEffectiveSettings(payload, options) {
    return call("getEffectiveSettings", payload, options);
  }

  function getSdkVersion(payload, options) {
    return call("getSdkVersion", payload, options);
  }

  function loginWithInternalToken(payload, options) {
    return call("loginWithInternalToken", payload, options);
  }

  function getCurrentIdentity(payload, options) {
    return call("getCurrentIdentity", payload, options);
  }

  function logout(payload, options) {
    return call("logout", payload, options);
  }

  function listChatMessages(payload, options) {
    return call("listChatMessages", payload, options);
  }

  function sendChatMessage(payload, options) {
    return call("sendChatMessage", payload, options);
  }

  function markChatRead(payload, options) {
    return call("markChatRead", payload, options);
  }

  function shareCurrentContent(payload, options) {
    return call("shareCurrentContent", payload, options);
  }

  function markSharedItemSeen(payload, options) {
    return call("markSharedItemSeen", payload, options);
  }

  function editChatMessage(payload, options) {
    return call("editChatMessage", payload, options);
  }

  function deleteChatMessage(payload, options) {
    return call("deleteChatMessage", payload, options);
  }

  function loadOlderChatMessages(payload, options) {
    return call("loadOlderChatMessages", payload, options);
  }

  function searchChatMessages(payload, options) {
    return call("searchChatMessages", payload, options);
  }

  window.JonaminzBackend = {
    call: call,
    registerExternalApp: registerExternalApp,
    listExternalAppRegistrations: listExternalAppRegistrations,
    listPendingContracts: listPendingContracts,
    approveContract: approveContract,
    rejectContract: rejectContract,
    getSdkVersion: getSdkVersion,
    getEffectiveSettings: getEffectiveSettings,
    loginWithInternalToken: loginWithInternalToken,
    getCurrentIdentity: getCurrentIdentity,
    logout: logout,
    listChatMessages: listChatMessages,
    sendChatMessage: sendChatMessage,
    markChatRead: markChatRead,
    shareCurrentContent: shareCurrentContent,
    markSharedItemSeen: markSharedItemSeen,
    editChatMessage: editChatMessage,
    deleteChatMessage: deleteChatMessage,
    loadOlderChatMessages: loadOlderChatMessages,
    searchChatMessages: searchChatMessages
  };
})();
