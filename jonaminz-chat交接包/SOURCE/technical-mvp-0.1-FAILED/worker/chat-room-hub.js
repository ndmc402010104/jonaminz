/*
ChatRoomHub
- 一個 room 對應一個 Durable Object instance。
- 只處理短暫事件與已提交事件的 fan-out。
- 不信 client 自報 identity；identity 由前置 Worker 驗證後放進 header。
*/

export class ChatRoomHub {
  constructor(state) {
    this.state = state;
  }

  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === "/connect") {
      return this.connect(request);
    }

    if (url.pathname === "/broadcast" && request.method === "POST") {
      const event = await request.json();
      this.broadcast(event);
      return Response.json({ ok: true });
    }

    if (url.pathname === "/presence") {
      return Response.json({ ok: true, identities: this.onlineIdentities() });
    }

    return new Response("Not found", { status: 404 });
  }

  connect(request) {
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected websocket", { status: 426 });
    }

    const identity = request.headers.get("X-Chat-Identity");
    const roomId = request.headers.get("X-Chat-Room-Id");
    const connectionId = crypto.randomUUID();

    if (!identity || !roomId) {
      return new Response("Missing verified chat context", { status: 400 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    this.state.acceptWebSocket(server);
    server.serializeAttachment({
      identity,
      roomId,
      connectionId,
      joinedAt: Date.now()
    });

    server.send(JSON.stringify({
      type: "socket_ready",
      payload: { connectionId, identities: this.onlineIdentities(identity) }
    }));

    this.broadcast({
      type: "presence",
      payload: { identity, online: true }
    }, server);

    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(socket, raw) {
    if (typeof raw !== "string") return;

    let event;
    try {
      event = JSON.parse(raw);
    } catch {
      return;
    }

    const attachment = socket.deserializeAttachment();
    if (!attachment) return;

    if (event.type === "typing") {
      this.broadcast({
        type: "typing",
        payload: {
          identity: attachment.identity,
          active: Boolean(event.payload && event.payload.active)
        }
      }, socket);
      return;
    }

    if (event.type === "ping") {
      socket.send(JSON.stringify({ type: "pong", payload: { at: Date.now() } }));
    }
  }

  async webSocketClose(socket) {
    const attachment = socket.deserializeAttachment();
    if (attachment) {
      this.broadcast({
        type: "presence",
        payload: { identity: attachment.identity, online: false }
      }, socket);
    }
  }

  onlineIdentities(extraIdentity) {
    const result = new Set(extraIdentity ? [extraIdentity] : []);
    for (const socket of this.state.getWebSockets()) {
      const attachment = socket.deserializeAttachment();
      if (attachment && attachment.identity) result.add(attachment.identity);
    }
    return [...result];
  }

  broadcast(event, exceptSocket = null) {
    const serialized = JSON.stringify(event);
    for (const socket of this.state.getWebSockets()) {
      if (socket === exceptSocket) continue;
      try {
        socket.send(serialized);
      } catch {
        // 壞 socket 交給 runtime close event 清理。
      }
    }
  }
}
