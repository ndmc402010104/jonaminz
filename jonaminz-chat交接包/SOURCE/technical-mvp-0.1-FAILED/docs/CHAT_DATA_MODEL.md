# CHAT_DATA_MODEL

## chat_instances

一套 Chat Library 的使用實例。

| 欄位 | 說明 |
|---|---|
| id | `couple-chat` / `skhps-chat` |
| app_id | 所屬 App |
| title | 顯示名稱 |
| enabled | 平台端啟用狀態 |
| feature_flags | instance 級功能開關 |

## chat_rooms

一個實際聊天室。

| 欄位 | 說明 |
|---|---|
| id | UUID |
| instance_id | 所屬 Chat instance |
| room_key | instance 內穩定 key |
| title | 房間名稱 |
| created_at | 建立時間 |

唯一鍵：

```text
(instance_id, room_key)
```

## chat_room_members

使用者在 room 中的狀態。

| 欄位 | 說明 |
|---|---|
| room_id | 房間 |
| identity | Jonathan / Minz |
| role | owner / member |
| last_read_message_id | 已讀到哪一則 |
| last_read_at | 已讀時間 |
| joined_at | 加入時間 |

## chat_messages

| 欄位 | 說明 |
|---|---|
| id | UUID |
| room_id | 房間 |
| sender_identity | Worker session 決定 |
| client_message_id | client 產生，防重送 |
| kind | text / system |
| body | 訊息文字 |
| reply_to_message_id | 回覆對象 |
| created_at | 伺服器時間 |
| edited_at | MVP 暫不使用 |
| deleted_at | MVP 暫不使用 |

## chat_message_reactions

每位使用者對每則訊息最多一個 reaction：

```text
PRIMARY KEY (message_id, identity)
```

傳空字串代表刪除 reaction。

## 不存 DB 的狀態

- typing
- online socket count
- current connection id
- temporary reconnect state

這些由 ChatRoomHub 管理。
