(function () {
  "use strict";

  var STORAGE_KEY = "jz.chat.technical.local.v1";
  var CHANNEL_NAME = "jz-chat-technical-local";

  function nowIso() {
    return new Date().toISOString();
  }

  function defaultState() {
    return {
      messages: [],
      reactions: {},
      members: {
        jonathan: { lastReadMessageId: null, lastReadAt: null },
        minz: { lastReadMessageId: null, lastReadAt: null }
      }
    };
  }

  function readState() {
    try {
      return Object.assign(defaultState(), JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"));
    } catch (_) {
      return defaultState();
    }
  }

  function writeState(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function LocalTechnicalAdapter(options) {
    this.identity = options.identity;
    this.peer = this.identity === "jonathan" ? "minz" : "jonathan";
    this.channel = new BroadcastChannel(CHANNEL_NAME);
    this.listeners = new Set();
    this.connected = false;
  }

  LocalTechnicalAdapter.prototype.emit = function (event) {
    this.listeners.forEach(function (listener) { listener(event); });
  };

  LocalTechnicalAdapter.prototype.onEvent = function (listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  LocalTechnicalAdapter.prototype.connect = async function () {
    var self = this;
    this.channel.onmessage = function (event) {
      self.emit(event.data);
    };
    this.connected = true;
    this.channel.postMessage({
      type: "presence",
      payload: { identity: this.identity, online: true }
    });
    this.emit({ type: "connection", payload: { status: "ready" } });
  };

  LocalTechnicalAdapter.prototype.disconnect = async function () {
    if (!this.connected) return;
    this.channel.postMessage({
      type: "presence",
      payload: { identity: this.identity, online: false }
    });
    this.channel.close();
    this.connected = false;
  };

  LocalTechnicalAdapter.prototype.bootstrap = async function () {
    var state = readState();
    return {
      ok: true,
      identity: this.identity,
      room: { id: "local-room", instance_id: "couple-chat", room_key: "jonathan-minz" },
      messages: state.messages,
      reactions: Object.entries(state.reactions).flatMap(function (entry) {
        var messageId = entry[0];
        return Object.entries(entry[1]).map(function (r) {
          return { message_id: messageId, identity: r[0], emoji: r[1] };
        });
      }),
      members: Object.entries(state.members).map(function (entry) {
        return {
          identity: entry[0],
          last_read_message_id: entry[1].lastReadMessageId,
          last_read_at: entry[1].lastReadAt
        };
      })
    };
  };

  LocalTechnicalAdapter.prototype.sendText = async function (text, options) {
    var state = readState();
    var message = {
      id: crypto.randomUUID(),
      room_id: "local-room",
      sender_identity: this.identity,
      client_message_id: options.clientMessageId,
      kind: "text",
      body: text,
      reply_to_message_id: options.replyToMessageId || null,
      created_at: nowIso()
    };

    var duplicate = state.messages.find(function (row) {
      return row.sender_identity === message.sender_identity &&
        row.client_message_id === message.client_message_id;
    });

    if (!duplicate) {
      state.messages.push(message);
      writeState(state);
    } else {
      message = duplicate;
    }

    this.channel.postMessage({ type: "message_committed", payload: { message: message } });
    this.emit({ type: "message_committed", payload: { message: message } });
    return { ok: true, message: message };
  };

  LocalTechnicalAdapter.prototype.markRead = async function (messageId) {
    var state = readState();
    state.members[this.identity] = {
      lastReadMessageId: messageId,
      lastReadAt: nowIso()
    };
    writeState(state);

    var member = {
      identity: this.identity,
      last_read_message_id: messageId,
      last_read_at: state.members[this.identity].lastReadAt
    };
    this.channel.postMessage({ type: "read_committed", payload: { member: member } });
    this.emit({ type: "read_committed", payload: { member: member } });
    return { ok: true, member: member };
  };

  LocalTechnicalAdapter.prototype.setReaction = async function (messageId, emoji) {
    var state = readState();
    state.reactions[messageId] = state.reactions[messageId] || {};
    if (emoji) state.reactions[messageId][this.identity] = emoji;
    else delete state.reactions[messageId][this.identity];
    writeState(state);

    var rows = Object.entries(state.reactions[messageId]).map(function (entry) {
      return { message_id: messageId, identity: entry[0], emoji: entry[1] };
    });

    var event = {
      type: "reactions_committed",
      payload: { messageId: messageId, reactions: rows }
    };
    this.channel.postMessage(event);
    this.emit(event);
    return { ok: true, reactions: rows };
  };

  LocalTechnicalAdapter.prototype.setTyping = function (active) {
    this.channel.postMessage({
      type: "typing",
      payload: { identity: this.identity, active: Boolean(active) }
    });
  };

  LocalTechnicalAdapter.reset = function () {
    localStorage.removeItem(STORAGE_KEY);
  };

  window.LocalTechnicalAdapter = LocalTechnicalAdapter;
})();
