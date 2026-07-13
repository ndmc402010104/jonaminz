# EXPERIMENTS

以下都不是正式決策。

## EXP-001 Durable Object ChatRoomHub

目的：

- socket fan-out
- typing
- presence
- committed event push

優點：

- 保留既有 Worker session model
- 不需 browser Supabase secret
- 不需立刻導入第二套 Auth
- room-based coordinator 自然

風險：

- 增加 Durable Object 維運概念
- Wrangler migration
- WebSocket reconnect
- hibernation API 細節
- session token socket 認證方式
- 多裝置 presence semantics

結論：可評估，不可視為已驗證。

## EXP-002 Local Adapter

使用：

- BroadcastChannel
- localStorage

目的：

- 在不碰正式 DB 前驗證 event model。

結果：

- 使用者回報整包失敗。
- 未知是否 Local Adapter 本身失敗。
- 未進入有效實驗結果。

## EXP-003 Supabase Realtime

可用於：

- Broadcast：typing
- Presence：online
- Postgres changes：committed data

但現有 Jonaminz 沒有 browser Supabase Auth JWT。

接手 Agent 必須先回答：

```text
如何在不建立第二套未受控 identity 的前提下授權 Realtime？
```

## EXP-004 Chat Library instances

概念：

- `couple-chat`
- `skhps-chat`

目前只需在 schema 與接口保留 instance isolation，不需要真的實作 SKHPSv2 Chat。
