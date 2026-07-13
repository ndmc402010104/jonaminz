# CHAT_CAPABILITIES

此文件描述未來 Platform capability，不修改 Frozen S 條文。

## additive capability 草案

```text
chat.mount@1
chat.currentContext@1
chat.sendText@1
chat.sendContentRef@1
chat.open@1
```

## 原則

- capability 出現在外部專案 Contract 的 `supports / requests / requires`。
- 是否授權仍由 Jonaminz Integration Settings 決定。
- capability hint 不是資料授權證明。
- 每次 Worker action 仍重新驗證 session、instance 與 room membership。
- SKHPSv2 即使取得 `chat.mount@1`，也只能存取被授權的 instance / room。

## MVP 暫不發布

Technical MVP 0.1 先作為主站內部能力，不立刻發布到正式 SDK stable channel。
