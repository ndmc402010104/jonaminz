(function () {
  "use strict";

  function WorkerTechnicalAdapter(options) {
    this.identity = options.identity;
    this.instanceId = options.instanceId;
    this.roomKey = options.roomKey;
    this.workerBaseUrl = options.workerBaseUrl.replace(/\/+$/, "");
    this.token = options.token;
    this.listeners = new Set();
    this.socket = null;
  }

  WorkerTechnicalAdapter.prototype.onEvent = function (listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  WorkerTechnicalAdapter.prototype.emit = function (event) {
    this.listeners.forEach(function (listener) { listener(event); });
  };

  WorkerTechnicalAdapter.prototype.call = async function (action, payload) {
    var response = await fetch(this.workerBaseUrl + "/api/action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: action,
        payload: Object.assign({
          token: this.token,
          instanceId: this.instanceId,
          roomKey: this.roomKey
        }, payload || {})
      })
    });

    var data = await response.json();
    if (!response.ok || data.ok === false) {
      throw new Error(data.error || "Worker action failed");
    }
    return data;
  };

  WorkerTechnicalAdapter.prototype.bootstrap = function () {
    return this.call("chatBootstrap");
  };

  WorkerTechnicalAdapter.prototype.connect = async function () {
    var protocol = this.workerBaseUrl.startsWith("https:") ? "wss:" : "ws:";
    var url = new URL(this.workerBaseUrl);
    var socketUrl = protocol + "//" + url.host + "/chat/socket" +
      "?token=" + encodeURIComponent(this.token) +
      "&instanceId=" + encodeURIComponent(this.instanceId) +
      "&roomKey=" + encodeURIComponent(this.roomKey);

    var self = this;
    this.socket = new WebSocket(socketUrl);
    this.socket.onopen = function () {
      self.emit({ type: "connection", payload: { status: "ready" } });
    };
    this.socket.onmessage = function (event) {
      try { self.emit(JSON.parse(event.data)); } catch (_) {}
    };
    this.socket.onclose = function () {
      self.emit({ type: "connection", payload: { status: "disconnected" } });
    };
  };

  WorkerTechnicalAdapter.prototype.disconnect = async function () {
    if (this.socket) this.socket.close();
  };

  WorkerTechnicalAdapter.prototype.sendText = function (body, options) {
    return this.call("chatSendMessage", {
      body: body,
      clientMessageId: options.clientMessageId,
      replyToMessageId: options.replyToMessageId || null
    });
  };

  WorkerTechnicalAdapter.prototype.markRead = function (messageId) {
    return this.call("chatMarkRead", { messageId: messageId });
  };

  WorkerTechnicalAdapter.prototype.setReaction = function (messageId, emoji) {
    return this.call("chatSetReaction", { messageId: messageId, emoji: emoji });
  };

  WorkerTechnicalAdapter.prototype.setTyping = function (active) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({
        type: "typing",
        payload: { active: Boolean(active) }
      }));
    }
  };

  window.WorkerTechnicalAdapter = WorkerTechnicalAdapter;
})();
