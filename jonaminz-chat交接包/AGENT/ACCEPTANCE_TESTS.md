# ACCEPTANCE_TESTS

## AT-01 身分

- Jonathan token 送出的 sender 必須是 Jonathan。
- payload 假裝 Minz 不得生效。
- 無 token 不能讀 room。
- 非 room member 不能讀 room。

## AT-02 訊息持久化

- 發送後 DB 有一列。
- reload 後仍存在。
- `client_message_id` 重送不重複。
- created_at 由 server 決定。

## AT-03 即時

- 另一端不刷新收到。
- 斷線 UI 明確顯示。
- reconnect 後補漏。
- 不產生重複訊息。

## AT-04 未讀

- 對方訊息增加未讀。
- 自己訊息不增加自己的未讀。
- unread divider 位置正確。

## AT-05 已讀

- room 真正開啟後才 mark read。
- member 的 `last_read_message_id` committed。
- sender 端收到 read event。
- read receipt avatar 位置正確。

## AT-06 typing

- 打字時另一端顯示。
- 停止約 1–2 秒自動清除。
- send／blur／disconnect 清除。
- typing 不寫進 message DB。

## AT-07 reaction

- 每人每則最多一個 reaction。
- 更換不新增第二列。
- 取消可刪除。
- 另一端即時更新。

## AT-08 isolation

- `couple-chat` 不可讀取未來 `skhps-chat`。
- instance／room membership 在 server 驗證。

## AT-09 安全

- 前端沒有 Supabase secret。
- 前端不能繞 Worker 直接寫表。
- socket auth 不接受 client identity。
- log 不輸出完整 session token。

## AT-10 回退

- migration 前有 checkpoint。
- Worker deploy 前可回到上一版。
- Chat feature 可 kill-switch。
- Chat 壞掉不影響登入、Theme、Contract、後台。
