/*
此檔案是合併草案，不可直接假設可獨立執行。

依賴既有 worker.js：
- requireSession(env, token)
- supabase(env, path, options)
- json(...)
*/

const CHAT_MAX_MESSAGE_CHARS = 4000;
const CHAT_PAGE_SIZE = 100;

export async function resolveChatContext(env, payload) {
  const session = await requireSession(env, payload && payload.token);
  if (!session) {
    return { ok: false, code: "UNAUTHORIZED", error: "Unauthorized" };
  }

  const instanceId = String(payload.instanceId || "");
  const roomKey = String(payload.roomKey || "");

  if (!instanceId || !roomKey) {
    return { ok: false, code: "INVALID_ROOM", error: "instanceId and roomKey are required" };
  }

  const rooms = await supabase(
    env,
    `/rest/v1/chat_rooms?instance_id=eq.${encodeURIComponent(instanceId)}&room_key=eq.${encodeURIComponent(roomKey)}&select=id,instance_id,room_key,title`,
    { method: "GET" }
  );

  const room = rooms && rooms[0];
  if (!room) {
    return { ok: false, code: "ROOM_NOT_FOUND", error: "Room not found" };
  }

  const members = await supabase(
    env,
    `/rest/v1/chat_room_members?room_id=eq.${room.id}&identity=eq.${session.identity}&select=room_id,identity,role,last_read_message_id,last_read_at`,
    { method: "GET" }
  );

  const member = members && members[0];
  if (!member) {
    return { ok: false, code: "FORBIDDEN", error: "Not a room member" };
  }

  return { ok: true, session, room, member };
}

export async function chatBootstrap(env, payload) {
  const context = await resolveChatContext(env, payload);
  if (!context.ok) return context;

  const messages = await supabase(
    env,
    `/rest/v1/chat_messages?room_id=eq.${context.room.id}&deleted_at=is.null&select=id,room_id,sender_identity,client_message_id,kind,body,reply_to_message_id,created_at&order=created_at.asc,id.asc&limit=${CHAT_PAGE_SIZE}`,
    { method: "GET" }
  );

  const messageIds = messages.map((row) => row.id);
  const reactions = messageIds.length
    ? await supabase(
        env,
        `/rest/v1/chat_message_reactions?message_id=in.(${messageIds.join(",")})&select=message_id,identity,emoji,updated_at`,
        { method: "GET" }
      )
    : [];

  const members = await supabase(
    env,
    `/rest/v1/chat_room_members?room_id=eq.${context.room.id}&select=identity,role,last_read_message_id,last_read_at`,
    { method: "GET" }
  );

  return {
    ok: true,
    identity: context.session.identity,
    room: context.room,
    messages,
    reactions,
    members
  };
}

export async function chatSendMessage(env, payload) {
  const context = await resolveChatContext(env, payload);
  if (!context.ok) return context;

  const body = String(payload.body || "").trim();
  const clientMessageId = String(payload.clientMessageId || "");
  const replyToMessageId = payload.replyToMessageId || null;

  if (!clientMessageId || !body || body.length > CHAT_MAX_MESSAGE_CHARS) {
    return { ok: false, code: "INVALID_MESSAGE", error: "Invalid message" };
  }

  const inserted = await supabase(env, "/rest/v1/chat_messages?on_conflict=room_id,sender_identity,client_message_id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: [{
      room_id: context.room.id,
      sender_identity: context.session.identity,
      client_message_id: clientMessageId,
      kind: "text",
      body,
      reply_to_message_id: replyToMessageId
    }]
  });

  const message = inserted && inserted[0];
  if (!message) {
    return { ok: false, code: "WRITE_FAILED", error: "Message insert failed" };
  }

  await broadcastRoomEvent(env, context.room, {
    type: "message_committed",
    payload: { message }
  });

  return { ok: true, message };
}

export async function chatMarkRead(env, payload) {
  const context = await resolveChatContext(env, payload);
  if (!context.ok) return context;

  const messageId = String(payload.messageId || "");
  if (!messageId) {
    return { ok: false, code: "INVALID_MESSAGE", error: "messageId is required" };
  }

  const messageRows = await supabase(
    env,
    `/rest/v1/chat_messages?id=eq.${messageId}&room_id=eq.${context.room.id}&select=id`,
    { method: "GET" }
  );

  if (!messageRows[0]) {
    return { ok: false, code: "MESSAGE_NOT_FOUND", error: "Message not found" };
  }

  const updated = await supabase(
    env,
    `/rest/v1/chat_room_members?room_id=eq.${context.room.id}&identity=eq.${context.session.identity}`,
    {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: {
        last_read_message_id: messageId,
        last_read_at: new Date().toISOString()
      }
    }
  );

  const member = updated && updated[0];

  await broadcastRoomEvent(env, context.room, {
    type: "read_committed",
    payload: { member }
  });

  return { ok: true, member };
}

export async function chatSetReaction(env, payload) {
  const context = await resolveChatContext(env, payload);
  if (!context.ok) return context;

  const messageId = String(payload.messageId || "");
  const emoji = String(payload.emoji || "");

  const messageRows = await supabase(
    env,
    `/rest/v1/chat_messages?id=eq.${messageId}&room_id=eq.${context.room.id}&select=id`,
    { method: "GET" }
  );

  if (!messageRows[0]) {
    return { ok: false, code: "MESSAGE_NOT_FOUND", error: "Message not found" };
  }

  if (!emoji) {
    await supabase(
      env,
      `/rest/v1/chat_message_reactions?message_id=eq.${messageId}&identity=eq.${context.session.identity}`,
      { method: "DELETE" }
    );
  } else {
    await supabase(env, "/rest/v1/chat_message_reactions?on_conflict=message_id,identity", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: [{
        message_id: messageId,
        identity: context.session.identity,
        emoji,
        updated_at: new Date().toISOString()
      }]
    });
  }

  const rows = await supabase(
    env,
    `/rest/v1/chat_message_reactions?message_id=eq.${messageId}&select=message_id,identity,emoji,updated_at`,
    { method: "GET" }
  );

  await broadcastRoomEvent(env, context.room, {
    type: "reactions_committed",
    payload: { messageId, reactions: rows }
  });

  return { ok: true, messageId, reactions: rows };
}

export async function connectChatSocket(request, env, url) {
  const token = url.searchParams.get("token");
  const instanceId = url.searchParams.get("instanceId");
  const roomKey = url.searchParams.get("roomKey");

  const context = await resolveChatContext(env, { token, instanceId, roomKey });
  if (!context.ok) {
    return Response.json(context, { status: 403 });
  }

  const id = env.CHAT_ROOMS.idFromName(`${instanceId}:${context.room.id}`);
  const stub = env.CHAT_ROOMS.get(id);

  const headers = new Headers(request.headers);
  headers.set("X-Chat-Identity", context.session.identity);
  headers.set("X-Chat-Room-Id", context.room.id);

  return stub.fetch(new Request("https://chat-room/connect", {
    method: "GET",
    headers
  }));
}

async function broadcastRoomEvent(env, room, event) {
  const id = env.CHAT_ROOMS.idFromName(`${room.instance_id}:${room.id}`);
  const stub = env.CHAT_ROOMS.get(id);

  await stub.fetch("https://chat-room/broadcast", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(event)
  });
}
