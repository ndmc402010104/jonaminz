(function () {
  "use strict";

  var config = window.CHAT_TECHNICAL_CONFIG || {};
  var params = new URLSearchParams(location.search);
  var identity = params.get("identity") === "minz" ? "minz" : "jonathan";
  var peer = identity === "jonathan" ? "minz" : "jonathan";
  var state = {
    messages: [],
    reactions: {},
    members: {},
    peerOnline: false,
    peerTyping: false
  };

  var adapter = config.mode === "worker"
    ? new WorkerTechnicalAdapter({
        identity: identity,
        instanceId: config.instanceId,
        roomKey: config.roomKey,
        workerBaseUrl: config.workerBaseUrl,
        token: localStorage.getItem(config.sessionTokenKey)
      })
    : new LocalTechnicalAdapter({ identity: identity });

  function label(id) {
    return id === "jonathan" ? "Jonathan" : "Minz";
  }

  function log(event) {
    var node = document.getElementById("events");
    node.textContent = JSON.stringify(event) + "\n" + node.textContent;
  }

  function messageIndex(id) {
    return state.messages.findIndex(function (m) { return m.id === id; });
  }

  function unreadCount() {
    var readId = state.members[identity] && state.members[identity].last_read_message_id;
    var readIndex = messageIndex(readId);
    return state.messages.filter(function (message, index) {
      return index > readIndex && message.sender_identity !== identity;
    }).length;
  }

  function render() {
    document.getElementById("title").textContent = label(identity) + " → " + label(peer);
    document.getElementById("onlineState").textContent = state.peerOnline ? "在線" : "離線";
    document.getElementById("unreadCount").textContent = unreadCount();

    var peerReadId = state.members[peer] && state.members[peer].last_read_message_id;
    var peerReadMessage = state.messages.find(function (m) { return m.id === peerReadId; });
    document.getElementById("lastRead").textContent = peerReadMessage
      ? new Date(peerReadMessage.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      : "—";

    document.getElementById("typing").hidden = !state.peerTyping;

    var myReadId = state.members[identity] && state.members[identity].last_read_message_id;
    var myReadIndex = messageIndex(myReadId);
    var firstUnreadIndex = state.messages.findIndex(function (message, index) {
      return index > myReadIndex && message.sender_identity !== identity;
    });

    var html = [];
    state.messages.forEach(function (message, index) {
      if (index === firstUnreadIndex) {
        html.push('<div class="unread-divider">未讀訊息</div>');
      }

      var reactionMap = state.reactions[message.id] || {};
      var reactionButtons = ["👍", "❤️", "😂"].map(function (emoji) {
        var count = Object.values(reactionMap).filter(function (value) { return value === emoji; }).length;
        return '<button data-react="' + emoji + '" data-message="' + message.id + '">' +
          emoji + (count ? " " + count : "") + "</button>";
      }).join("");

      html.push(
        '<article class="message ' + (message.sender_identity === identity ? "mine" : "") + '">' +
          '<div>' + escapeHtml(message.body) + '</div>' +
          '<small>' + label(message.sender_identity) + " · " +
            new Date(message.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) +
          '</small>' +
          '<div class="reactions">' + reactionButtons + '</div>' +
        '</article>'
      );
    });

    var box = document.getElementById("messages");
    box.innerHTML = html.join("");
    box.scrollTop = box.scrollHeight;
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, function (char) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char];
    });
  }

  function applyBootstrap(data) {
    state.messages = data.messages || [];
    state.reactions = {};
    (data.reactions || []).forEach(function (row) {
      state.reactions[row.message_id] = state.reactions[row.message_id] || {};
      state.reactions[row.message_id][row.identity] = row.emoji;
    });
    state.members = {};
    (data.members || []).forEach(function (row) {
      state.members[row.identity] = row;
    });
    render();
  }

  function upsertMessage(message) {
    if (!state.messages.some(function (row) { return row.id === message.id; })) {
      state.messages.push(message);
      state.messages.sort(function (a, b) {
        return new Date(a.created_at) - new Date(b.created_at) || a.id.localeCompare(b.id);
      });
    }
  }

  adapter.onEvent(function (event) {
    log(event);

    if (event.type === "connection") {
      document.getElementById("connection").textContent = event.payload.status;
    }
    if (event.type === "message_committed") {
      upsertMessage(event.payload.message);
      render();
    }
    if (event.type === "read_committed") {
      state.members[event.payload.member.identity] = event.payload.member;
      render();
    }
    if (event.type === "reactions_committed") {
      state.reactions[event.payload.messageId] = {};
      event.payload.reactions.forEach(function (row) {
        state.reactions[event.payload.messageId][row.identity] = row.emoji;
      });
      render();
    }
    if (event.type === "typing" && event.payload.identity === peer) {
      state.peerTyping = event.payload.active;
      render();
    }
    if (event.type === "presence" && event.payload.identity === peer) {
      state.peerOnline = event.payload.online;
      render();
    }
    if (event.type === "socket_ready") {
      state.peerOnline = event.payload.identities.includes(peer);
      render();
    }
  });

  document.getElementById("composer").addEventListener("submit", async function (event) {
    event.preventDefault();
    var input = document.getElementById("input");
    var text = input.value.trim();
    if (!text) return;

    input.value = "";
    adapter.setTyping(false);

    await adapter.sendText(text, {
      clientMessageId: crypto.randomUUID(),
      replyToMessageId: null
    });
  });

  var typingTimer = null;
  document.getElementById("input").addEventListener("input", function (event) {
    adapter.setTyping(Boolean(event.target.value.trim()));
    clearTimeout(typingTimer);
    typingTimer = setTimeout(function () { adapter.setTyping(false); }, 1400);
  });

  document.getElementById("messages").addEventListener("click", async function (event) {
    var button = event.target.closest("[data-react]");
    if (!button) return;
    await adapter.setReaction(button.dataset.message, button.dataset.react);
  });

  document.getElementById("messages").addEventListener("scroll", function () {
    clearTimeout(window.__readTimer);
    window.__readTimer = setTimeout(async function () {
      var last = state.messages.at(-1);
      if (last) await adapter.markRead(last.id);
    }, 900);
  });

  document.getElementById("openPeer").addEventListener("click", function () {
    window.open("./?identity=" + peer, "_blank");
  });

  document.getElementById("reset").addEventListener("click", function () {
    if (window.LocalTechnicalAdapter) LocalTechnicalAdapter.reset();
    location.reload();
  });

  window.addEventListener("beforeunload", function () {
    adapter.disconnect();
  });

  (async function start() {
    document.getElementById("connection").textContent = "bootstrapping";
    await adapter.connect();
    var data = await adapter.bootstrap();
    applyBootstrap(data);
    document.getElementById("connection").textContent = "ready";
  })().catch(function (error) {
    document.getElementById("connection").textContent = "error: " + error.message;
    log({ type: "fatal", payload: { error: error.message } });
  });
})();
