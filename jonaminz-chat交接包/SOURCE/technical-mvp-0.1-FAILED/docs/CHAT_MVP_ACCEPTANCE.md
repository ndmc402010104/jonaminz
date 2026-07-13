# CHAT_MVP_ACCEPTANCE

Technical MVP 0.1 必須全部通過：

## Identity

- Jonathan session 不能以 Minz 身分送訊息。
- Minz session 不能以 Jonathan 身分送訊息。
- 無 session 不能 bootstrap、send、read、react、connect socket。

## Persistence

- 訊息 reload 後仍存在。
- 同一 `client_message_id` 重送不產生第二列。
- server created_at 是排序權威。

## Realtime

- 兩個裝置同 room 時，訊息在不手動刷新下出現。
- typing 不寫 DB。
- socket 斷線後 UI 顯示 reconnecting。
- 重連後不漏訊息、不重複訊息。

## Unread / read

- 對方新訊息增加未讀。
- 自己發的訊息不增加自己的未讀。
- 打開 room 並 mark read 後，未讀歸零。
- sender 能看到 receiver 的已讀位置。

## Reaction

- 每人對每則訊息最多一個 reaction。
- 更換 reaction 不建立第二列。
- 移除 reaction 後另一端即時更新。

## Isolation

- `couple-chat` 與其他 instance 資料不可互讀。
- 非 room member 不能加入 socket。
