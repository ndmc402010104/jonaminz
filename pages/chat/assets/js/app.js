/*
檔案位置：jonaminz/pages/chat/assets/js/app.js
用途：Jonaminz Chat 畫面邏輯（見 page-chat.css 檔頭與 worker.js 的
listChatMessages/sendChatMessage/markChatRead 說明）。

整頁在 init() 就先過 window.JonaminzIdentity.requireLogin()，沒登入會被
導去 /pages/login/?next=...，不會執行到下面的邏輯——跟 pages/admin/
contracts/ 同一套權限關卡。

刻意用 setInterval 每 3 秒呼叫一次 listChatMessages 取代 WebSocket／
Durable Object（見 worker.js 檔頭同一段說明），只是先證明「兩個真實身分
互傳訊息＋已讀」端到端能動，不是最終架構。只能回報自己的 loading task，
不可以自己決定 css/shell ready。

未讀分隔線／已讀回條／大頭貼分組／線上狀態小綠點都是從 listChatMessages
回傳的真實 messages/readState 算出來的，不是憑空模擬——presence 綠點是
「對方最後一則訊息或最後已讀時間在 5 分鐘內」的近似值，沒有真的 presence
channel，這點如果之後要做更準的在線狀態需要另外設計。
*/
(function () {
  "use strict";

  var READY_TASK = "app-ready";
  var POLL_INTERVAL_MS = 3000;
  var PRESENCE_WINDOW_MS = 5 * 60 * 1000;
  var IDENTITY_LABEL = { jonathan: "Jonathan", minz: "Minz" };
  var QUICK_REACTION = "👍";
  var EMOJI_SET = [
    "😀", "😂", "😍", "😘",
    "😢", "😭", "😎", "🥰",
    "👍", "👌", "🙏", "👏",
    "❤️", "🔥", "🎉", "😱"
  ];

  var identity = null;
  var token = null;
  var lastMessageId = null;
  var pollTimer = null;
  var sending = false;
  var els = {};

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

  function initialOf(id) {
    var label = IDENTITY_LABEL[id] || id || "?";
    return label.charAt(0).toUpperCase();
  }

  function renderHead(data) {
    var peer = otherIdentity();
    var peerLabel = IDENTITY_LABEL[peer] || peer;
    var messages = data.messages || [];
    var readState = data.readState || {};
    var peerRead = readState[peer] || {};

    els.avatar.textContent = initialOf(peer);
    els.peerName.textContent = peerLabel;

    var lastMessage = messages[messages.length - 1];
    els.peerStatus.textContent = lastMessage ? "最後訊息 " + formatTime(lastMessage.created_at) : "還沒有訊息";

    var peerLastActivity = 0;
    messages.forEach(function (m) {
      if (m.sender_identity === peer) {
        var t = new Date(m.created_at).getTime();
        if (t > peerLastActivity) peerLastActivity = t;
      }
    });
    if (peerRead.lastReadAt) {
      var readAt = new Date(peerRead.lastReadAt).getTime();
      if (readAt > peerLastActivity) peerLastActivity = readAt;
    }
    var isOnline = peerLastActivity > 0 && (Date.now() - peerLastActivity) < PRESENCE_WINDOW_MS;
    els.avatar.classList.toggle("is-online", isOnline);
    els.avatar.classList.toggle("no-presence", !isOnline);
  }

  function render(data) {
    renderHead(data);

    var messages = data.messages || [];
    var readState = data.readState || {};
    var myRead = readState[identity] || {};
    var otherRead = readState[otherIdentity()] || {};

    if (!messages.length) {
      els.thread.innerHTML = '<p class="jonaminz-chat-empty">還沒有訊息，說句話開始吧。</p>';
      return;
    }

    // 找出「我方已讀到哪一則」的 index，之後才知道未讀分隔線要插在哪。
    var myReadIndex = -1;
    if (myRead.lastReadMessageId) {
      for (var i = 0; i < messages.length; i += 1) {
        if (messages[i].id === myRead.lastReadMessageId) { myReadIndex = i; break; }
      }
    }

    // 分隔線要插在「第一則對方傳來的未讀訊息」前面，不能只看 index 差一位——
    // 我方已讀到 myReadIndex 之後，如果緊接著是自己送出的新訊息（poll() 送出
    // 後、markChatRead 生效前那個當下的畫面），這則不該被當成「未讀」，不然
    // 會有一瞬間在自己剛送出的訊息上面冒出「未讀訊息」分隔線。
    var firstUnreadIndex = -1;
    if (myReadIndex >= 0) {
      for (var u = myReadIndex + 1; u < messages.length; u += 1) {
        if (messages[u].sender_identity !== identity) { firstUnreadIndex = u; break; }
      }
    }

    var html = "";
    var lastTimeLabel = "";
    var dividerInserted = firstUnreadIndex < 0; // 沒有已讀紀錄或沒有對方的未讀訊息就不畫分隔線

    messages.forEach(function (m, index) {
      var mine = m.sender_identity === identity;
      var timeLabel = formatTime(m.created_at);
      if (timeLabel && timeLabel !== lastTimeLabel) {
        html += '<div class="jonaminz-chat-time-divider">' + escapeHtml(timeLabel) + "</div>";
        lastTimeLabel = timeLabel;
      }

      if (!dividerInserted && index === firstUnreadIndex) {
        html += '<div class="jonaminz-chat-unread-divider"><span>未讀訊息</span></div>';
        dividerInserted = true;
      }

      // 大頭貼只出現在「對方那一串連續訊息的最後一則」，避免每則都重複貼一次。
      var nextIsSameSender = messages[index + 1] && messages[index + 1].sender_identity === m.sender_identity;
      var showAvatar = !mine && !nextIsSameSender;

      var avatarHtml = !mine
        ? ('<div class="jonaminz-chat-message-avatar' + (showAvatar ? "" : " is-placeholder") + '">' +
            (showAvatar ? escapeHtml(initialOf(m.sender_identity)) : "") + "</div>")
        : "";

      var readByOther = mine && otherRead.lastReadMessageId === m.id;

      html +=
        '<div class="jonaminz-chat-message" data-mine="' + mine + '">' +
        avatarHtml +
        '<div class="jonaminz-chat-bubble">' + escapeHtml(m.body) + "</div>" +
        "</div>";

      if (readByOther) {
        html +=
          '<div class="jonaminz-chat-read-receipt"><div class="jonaminz-chat-message-avatar is-tiny">' +
          escapeHtml(initialOf(otherIdentity())) + "</div></div>";
      }
    });

    var wasNearBottom = els.thread.scrollHeight - els.thread.scrollTop - els.thread.clientHeight < 80;
    els.thread.innerHTML = html;
    if (wasNearBottom || !lastMessageId) els.thread.scrollTop = els.thread.scrollHeight;

    var newestId = messages[messages.length - 1].id;
    if (newestId !== lastMessageId) {
      lastMessageId = newestId;
      // 有新訊息就標記已讀（頁面開著就代表看到了，這是 MVP 的簡化版
      // 已讀語意，不做「真的捲到那一則才算已讀」的精準判定）。
      window.JonaminzBackend.markChatRead({ token: token, messageId: newestId }).catch(function () {});
    }
  }

  function poll() {
    return window.JonaminzBackend.listChatMessages({ token: token })
      .then(function (data) {
        render(data);
        els.status.textContent = "";
      })
      .catch(function (error) {
        els.status.textContent = "更新失敗：" + (error.message || String(error));
      });
  }

  function updateComposerAction() {
    var hasText = Boolean(els.input.value.trim());
    els.action.textContent = hasText ? "➤" : QUICK_REACTION;
    els.action.classList.toggle("is-send-mode", hasText);
    els.action.setAttribute("aria-label", hasText ? "送出訊息" : "快速送出 " + QUICK_REACTION);
  }

  function doSendText(body) {
    if (!body || sending) return;
    sending = true;
    els.action.disabled = true;
    var clientMessageId = identity + "-" + Date.now() + "-" + Math.random().toString(36).slice(2);
    window.JonaminzBackend.sendChatMessage({ token: token, body: body, clientMessageId: clientMessageId })
      .then(function () {
        return poll();
      })
      .catch(function (error) {
        els.status.textContent = "送出失敗：" + (error.message || String(error));
      })
      .then(function () {
        sending = false;
        els.action.disabled = false;
        els.input.focus();
      });
  }

  function closeEmojiPanel() {
    els.emojiPanel.hidden = true;
  }

  function buildUI(root) {
    root.innerHTML =
      '<section class="jonaminz-chat-head">' +
      '<div class="jonaminz-chat-avatar no-presence" data-avatar>?</div>' +
      '<div class="jonaminz-chat-head-meta">' +
      '<h1 data-peer-name>Jonaminz Chat</h1>' +
      '<p class="jonaminz-chat-status" data-status>載入中...</p>' +
      '<span class="jonaminz-chat-instance-badge">Chat Library &middot; couple-chat</span>' +
      "</div>" +
      "</section>" +
      '<div class="jonaminz-chat-thread" data-thread><p class="jonaminz-chat-empty">載入中...</p></div>' +
      '<div class="jonaminz-chat-composer">' +
      '<button type="button" class="jonaminz-chat-plus-btn" data-plus disabled ' +
      'title="附件與更多動作——之後開放" aria-label="更多功能（尚未開放）">+</button>' +
      '<div class="jonaminz-chat-input-shell">' +
      '<textarea data-input placeholder="輸入訊息..." rows="1"></textarea>' +
      '<button type="button" class="jonaminz-chat-emoji-toggle" data-emoji-toggle ' +
      'aria-label="插入表情符號">🙂</button>' +
      '<div class="jonaminz-chat-emoji-panel" data-emoji-panel hidden></div>' +
      "</div>" +
      '<button type="button" class="jonaminz-chat-action-btn" data-action ' +
      'aria-label="快速送出 ' + QUICK_REACTION + '">' + QUICK_REACTION + "</button>" +
      "</div>" +
      '<p class="jonaminz-chat-status-line" data-page-status></p>';

    els.avatar = root.querySelector("[data-avatar]");
    els.peerName = root.querySelector("[data-peer-name]");
    els.peerStatus = root.querySelector("[data-status]");
    els.thread = root.querySelector("[data-thread]");
    els.input = root.querySelector("[data-input]");
    els.action = root.querySelector("[data-action]");
    els.status = root.querySelector("[data-page-status]");
    els.emojiToggle = root.querySelector("[data-emoji-toggle]");
    els.emojiPanel = root.querySelector("[data-emoji-panel]");

    els.emojiPanel.innerHTML = EMOJI_SET.map(function (emoji) {
      return '<button type="button" data-emoji="' + emoji + '">' + emoji + "</button>";
    }).join("");

    els.action.addEventListener("click", function () {
      var body = els.input.value.trim();
      if (body) {
        els.input.value = "";
        updateComposerAction();
        doSendText(body);
      } else {
        doSendText(QUICK_REACTION);
      }
    });

    els.input.addEventListener("input", updateComposerAction);
    els.input.addEventListener("keydown", function (event) {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        els.action.click();
      }
    });

    els.emojiToggle.addEventListener("click", function (event) {
      event.stopPropagation();
      els.emojiPanel.hidden = !els.emojiPanel.hidden;
    });
    els.emojiPanel.addEventListener("click", function (event) {
      var btn = event.target.closest("[data-emoji]");
      if (!btn) return;
      var start = els.input.selectionStart || els.input.value.length;
      var end = els.input.selectionEnd || els.input.value.length;
      var value = els.input.value;
      els.input.value = value.slice(0, start) + btn.dataset.emoji + value.slice(end);
      var caret = start + btn.dataset.emoji.length;
      els.input.focus();
      els.input.setSelectionRange(caret, caret);
      updateComposerAction();
    });
    document.addEventListener("click", function (event) {
      if (!els.emojiPanel.hidden && !event.target.closest(".jonaminz-chat-input-shell")) {
        closeEmojiPanel();
      }
    });
  }

  function init() {
    window.JonaminzIdentity.requireLogin().then(function (currentIdentity) {
      try {
        identity = currentIdentity;
        token = window.JonaminzIdentity.readToken();

        var root = document.querySelector("[data-app-root]");
        buildUI(root);
        root.setAttribute("aria-label", "與 " + (IDENTITY_LABEL[otherIdentity()] || otherIdentity()) + " 的對話");

        poll().then(function () {
          pollTimer = setInterval(poll, POLL_INTERVAL_MS);
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
