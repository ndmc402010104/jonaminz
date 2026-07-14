-- 檔案位置：jonaminz/backend/supabase/chat_features_v2_schema.sql
-- 用途：2026-07-14 對照成熟聊天 App 慣例第二輪補強——輸入中狀態、送達
-- 狀態（三態已讀的「送達」那一態）、真推播訂閱、聯絡電話設定（語音通話
-- 改撥打真實電話取代）。跟 chat_shared_schema.sql 同一套慣例：獨立新
-- 檔案、全部用 if not exists／add column if not exists 冪等寫法，只給
-- service_role，RLS 開著但不加 public policy。

create table if not exists chat_typing_state (
  room_id uuid not null references chat_rooms(id) on delete cascade,
  identity text not null check (identity in ('jonathan', 'minz')),
  updated_at timestamptz not null default now(),
  primary key (room_id, identity)
);

-- 送達狀態：跟 chat_room_members 既有的 last_read_message_id／
-- last_read_at 同一種形狀，多一組「送達」版本——已讀是使用者真的看到
-- （明確可見範圍內才標記），送達是「對方的裝置已經 poll 到這則訊息」，
-- 語意上永遠 >= 已讀，兩者分開存才做得出真正的三態（送出/已送達/已讀）。
alter table chat_room_members add column if not exists last_delivered_message_id uuid;
alter table chat_room_members add column if not exists last_delivered_at timestamptz;

-- 在線心跳（2026-07-15 第二十七輪）：面板「真的可見」時每 30 秒心跳
-- 一次，在線＝2 分鐘內有心跳。舊判定（最後訊息/已讀在 5 分鐘內）只要
-- 有在聊就永遠在線、從沒出現過離線，作廢。
alter table chat_room_members add column if not exists last_seen_at timestamptz;

alter table chat_room_members
  drop constraint if exists chat_room_members_last_delivered_message_fk;
alter table chat_room_members
  add constraint chat_room_members_last_delivered_message_fk
  foreign key (last_delivered_message_id)
  references chat_messages(id)
  on delete set null;

-- 真推播訂閱。同一個 identity 可能有多個裝置/瀏覽器分頁，各自一個
-- endpoint，primary key 用兩者組合。2026-07-14（第十八輪）起支援兩種：
-- kind='webpush'（瀏覽器 Web Push，endpoint 是推播服務網址，p256dh/auth
-- 是 RFC8291 加密參數）跟 kind='fcm'（Capacitor App 的 Firebase 原生
-- 推播，endpoint 放 FCM device token，沒有 p256dh/auth 所以那兩欄可空）。
create table if not exists chat_push_subscriptions (
  identity text not null check (identity in ('jonathan', 'minz')),
  endpoint text not null,
  kind text not null default 'webpush' check (kind in ('webpush', 'fcm')),
  p256dh text,
  auth text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (identity, endpoint)
);

-- 既有部署的升級路徑（表已存在時上面的 create 不會動它）：
alter table chat_push_subscriptions
  add column if not exists kind text not null default 'webpush';
alter table chat_push_subscriptions
  drop constraint if exists chat_push_subscriptions_kind_check;
alter table chat_push_subscriptions
  add constraint chat_push_subscriptions_kind_check
  check (kind in ('webpush', 'fcm'));
alter table chat_push_subscriptions alter column p256dh drop not null;
alter table chat_push_subscriptions alter column auth drop not null;

-- 聯絡電話設定：語音/視訊通話「偷吃步」改成直接撥打真實手機號碼
-- （tel: 連結），使用者不想把號碼寫死在程式碼裡，改存這張表、後台可編輯
-- （見 worker.js 的 getContactInfo/setMyPhoneNumber）。
create table if not exists chat_contact_info (
  identity text primary key check (identity in ('jonathan', 'minz')),
  phone_number text,
  updated_at timestamptz not null default now()
);

alter table chat_typing_state enable row level security;
alter table chat_push_subscriptions enable row level security;
alter table chat_contact_info enable row level security;

revoke all on chat_typing_state from anon, authenticated;
revoke all on chat_push_subscriptions from anon, authenticated;
revoke all on chat_contact_info from anon, authenticated;

grant select, insert, update, delete on chat_typing_state to service_role;
grant select, insert, update, delete on chat_push_subscriptions to service_role;
grant select, insert, update, delete on chat_contact_info to service_role;
