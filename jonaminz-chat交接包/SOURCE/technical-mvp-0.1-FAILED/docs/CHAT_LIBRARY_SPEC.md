# CHAT_LIBRARY_SPEC

## 1. 定位

Chat Library 是 Jonaminz 可重複使用的 Communication Capability。

```text
Chat Library
├─ persistent data
├─ realtime transport
├─ room membership
├─ read receipts
├─ reactions
├─ typing
├─ presence
└─ UI adapter
```

第一個 instance：

```json
{
  "instanceId": "couple-chat",
  "appId": "jonaminz",
  "roomKey": "jonathan-minz",
  "participants": ["jonathan", "minz"]
}
```

未來 SKHPSv2：

```json
{
  "instanceId": "skhps-chat",
  "appId": "skhpsv2",
  "roomKey": "plastic-surgery-work",
  "participants": ["authorized-staff"]
}
```

不同 instance 共用引擎，但不得共用：

- room membership
- message rows
- read position
- reaction
- presence topic
- Theme preset
- feature grants

## 2. Transport

### 永久事件

走既有 Worker `/api/action`：

- `chatBootstrap`
- `chatSendMessage`
- `chatMarkRead`
- `chatSetReaction`

永久資料成功寫入 Supabase後，Worker 通知該 room 的 Durable Object，再推送給在線 client。

### 短暫事件

走 WebSocket：

- `typing`
- `presence`
- `ping`

短暫事件不寫入 Postgres。

## 3. 安全邊界

- 每個 action 必須先 `requireSession()`。
- 每次加入 WebSocket 前也必須驗證 session。
- room membership 必須由 Worker 查 DB，不相信 client 自報。
- client payload 不接受 `senderIdentity` 作為權威。
- ChatRoomHub 使用 Worker 已驗證後附加的 identity。
- Supabase secret key 只在 Worker。
- chat tables 開 RLS，但不建立 browser policy。
- `client_message_id` 唯一，避免斷線重送產生重複訊息。

## 4. API surface

```js
Jonaminz.chat.mount({
  instanceId,
  roomKey,
  adapter,
  features
});

chat.connect();
chat.bootstrap();
chat.sendText(text, { replyToMessageId });
chat.markRead(messageId);
chat.setReaction(messageId, emoji);
chat.setTyping(true | false);
chat.disconnect();
```

## 5. MVP feature gates

```json
{
  "text": true,
  "reply": true,
  "reaction": true,
  "readReceipt": true,
  "typing": true,
  "presence": true,
  "attachments": false,
  "sharedContent": false,
  "call": false
}
```
