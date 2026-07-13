/*
檔案位置：jonaminz/pages/chat/assets/js/app.js
用途：Jonaminz Chat polling MVP（見 page-chat.css 檔頭與 worker.js 的
listChatMessages/sendChatMessage/markChatRead 說明）。

整頁在 init() 就先過 window.JonaminzIdentity.requireLogin()，沒登入會被
導去 /pages/login/?next=...，不會執行到下面的邏輯——跟 pages/admin/
contracts/ 同一套權限關卡。

刻意用 setInterval 每 3 秒呼叫一次 listChatMessages 取代 WebSocket／
Durable Object（見 worker.js 檔頭同一段說明），只是先證明「兩個真實身分
互傳訊息＋已讀」端到端能動，不是最終架構。只能回報自己的 loading task，
不可以自己決定 css/shell ready。
*/
(function () {
  "use strict";

  var READY_TASK = "app-ready";
  var POLL_INTERVAL_MS = 3000;
  var IDENTITY_LABEL = { jonathan: "Jonathan", minz: "Minz" };

  var identity = null;
  var token = null;
  var lastMessageId = null;
  var pollTimer = null;
  var sending = false;

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  }

  function formatTime(value) {
    if (!value) return "";
    try {
      return new Date(value).toLocaleTimeString("zh-TW", { hour12: false, hour: "2-digit", minute: "2-digit" });
    } catch (error) {
      return "";
    }
  }

  function otherIdentity() {
    return identity === "jonathan" ? "minz" : "jonathan";
  }

  function render(root, data) {
    var messages = data.messages || [];
    var readState = data.readState || {};
    var otherRead = readState[otherIdentity()] || {};

    if (!messages.length) {
      root.querySelector("[data-thread]").innerHTML =
        '<p class="jonaminz-chat-empty">還沒有訊息，說句話開始吧。</p>';
      return;
    }

    var html = messages.map(function (m) {
      var mine = m.sender_identity === identity;
      var readByOther = mine && otherRead.lastReadMessageId === m.id;
      var metaParts = [formatTime(m.created_at)];
      if (mine && otherRead.lastReadMessageId) {
        // 只在「這則剛好是對方目前已讀到的那則」標示已讀，避免每則都印
        // 一次「已讀」造成閱讀雜訊——跟大多數聊天 App 的慣例一致。
        if (readByOther) metaParts.push("對方已讀");
      }
      return (
        '<div class="jonaminz-chat-bubble-row" data-mine="' + mine + '">' +
        '<div class="jonaminz-chat-bubble">' + escapeHtml(m.body) + "</div>" +
        '<div class="jonaminz-chat-meta">' + escapeHtml(metaParts.filter(Boolean).join(" · ")) + "</div>" +
        "</div>"
      );
    }).join("");

    var thread = root.querySelector("[data-thread]");
    var wasNearBottom = thread.scrollHeight - thread.scrollTop - thread.clientHeight < 80;
    thread.innerHTML = html;
    if (wasNearBottom) thread.scrollTop = thread.scrollHeight;

    var newestId = messages[messages.length - 1].id;
    if (newestId !== lastMessageId) {
      lastMessageId = newestId;
      // 有新訊息就標記已讀（頁面開著就代表看到了，這是 MVP 的簡化版
      // 已讀語意，不做「真的捲到那一則才算已讀」的精準判定）。
      window.JonaminzBackend.markChatRead({ token: token, messageId: newestId }).catch(function () {});
    }
  }

  function poll(root, statusEl) {
    return window.JonaminzBackend.listChatMessages({ token: token })
      .then(function (data) {
        render(root, data);
        statusEl.textContent = "";
      })
      .catch(function (error) {
        statusEl.textContent = "更新失敗：" + (error.message || String(error));
      });
  }

  function buildUI(root) {
    root.innerHTML =
      '<div class="jonaminz-chat-thread" data-thread><p class="jonaminz-chat-empty">載入中...</p></div>' +
      '<div class="jonaminz-chat-composer">' +
      '<textarea data-input placeholder="輸入訊息..." rows="1"></textarea>' +
      '<button type="button" data-send>送出</button>' +
      "</div>" +
      '<p class="jonaminz-chat-status" data-status></p>';

    var input = root.querySelector("[data-input]");
    var sendBtn = root.querySelector("[data-send]");
    var statusEl = root.querySelector("[data-status]");

    function doSend() {
      var body = input.value.trim();
      if (!body || sending) return;
      sending = true;
      sendBtn.disabled = true;
      var clientMessageId = identity + "-" + Date.now() + "-" + Math.random().toString(36).slice(2);
      window.JonaminzBackend.sendChatMessage({ token: token, body: body, clientMessageId: clientMessageId })
        .then(function () {
          input.value = "";
          return poll(root, statusEl);
        })
        .catch(function (error) {
          statusEl.textContent = "送出失敗：" + (error.message || String(error));
        })
        .then(function () {
          sending = false;
          sendBtn.disabled = false;
          input.focus();
        });
    }

    sendBtn.addEventListener("click", doSend);
    input.addEventListener("keydown", function (event) {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        doSend();
      }
    });

    return statusEl;
  }

  function init() {
    window.JonaminzIdentity.requireLogin().then(function (currentIdentity) {
      try {
        identity = currentIdentity;
        token = window.JonaminzIdentity.readToken();

        var root = document.querySelector("[data-app-root]");
        root.setAttribute("aria-label", "與 " + (IDENTITY_LABEL[otherIdentity()] || otherIdentity()) + " 的對話");
        var statusEl = buildUI(root);

        poll(root, statusEl).then(function () {
          pollTimer = setInterval(function () { poll(root, statusEl); }, POLL_INTERVAL_MS);
        });

        window.addEventListener("beforeunload", function () {
          if (pollTimer) clearInterval(pollTimer);
        });

        window.JonaminzLoading.done(READY_TASK);
      } catch (error) {
        window.JonaminzLoading.fail(READY_TASK, error);
      }
    });
  }

  init();
})();
