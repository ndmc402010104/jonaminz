# CHAT_STATE_MACHINE

## Client connection

```text
idle
→ authenticating
→ bootstrapping
→ connecting_socket
→ ready
```

錯誤：

```text
auth_failed
bootstrap_failed
socket_disconnected
reconnecting
```

斷線後：

1. 指數退避重連 WebSocket。
2. WebSocket 恢復後重新 `chatBootstrap`。
3. 用 `afterMessageId` 或最新 cursor 補漏。
4. 依 `client_message_id` 去重。

## Message send

```text
draft
→ optimistic
→ submitting
→ committed
```

錯誤：

```text
failed_retryable
failed_final
```

MVP 可以先不做 optimistic UI，先保證 committed correctness。

## Typing

```text
input empty
→ input non-empty: typing_start
→ 1.5 秒沒有再輸入: typing_stop
→ send / blur / disconnect: typing_stop
```

Receiver 超過 4 秒沒收到新的 typing event，也應自行清除，避免殘留。

## Read

```text
unread
→ room visible
→ latest message visible / 900ms
→ chatMarkRead(latestMessageId)
→ committed
→ read event broadcast
```

`已讀` 只以 server committed 的 member row 為準。

## Presence

```text
socket connected = online
socket closed = offline
```

同一 identity 可多裝置連線：

```text
online = active socket count > 0
```
