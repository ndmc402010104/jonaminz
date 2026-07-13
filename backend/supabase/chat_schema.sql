-- 檔案位置：jonaminz/backend/supabase/chat_schema.sql
-- 用途：Jonaminz Chat 第一個真實里程碑用的資料表（見
-- jonaminz-chat交接包/00_START_HERE.md）：Jonathan/Minz 兩個真實登入身分
-- 互傳訊息、未讀、已讀、reaction。在 Supabase SQL Editor 貼上執行即可
-- （跟 schema.sql／contract_schema.sql／theme_schema.sql 同一套流程）。
--
-- 沿用交接包 SOURCE/technical-mvp-0.1-FAILED/supabase/chat_schema.sql 的
-- 草案（審過一次，設計合理：RLS 鎖死只給 service_role、identity 就是
-- 現有的 'jonathan'/'minz' 兩個固定身分，跟正式 sessions 表一致），只是
-- 從交接包移進正式 repo 執行，內容沒有大改。

create extension if not exists pgcrypto;

create table if not exists chat_instances (
  id text primary key,
  app_id text not null,
  title text not null,
  enabled boolean not null default true,
  feature_flags jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists chat_rooms (
  id uuid primary key default gen_random_uuid(),
  instance_id text not null references chat_instances(id) on delete cascade,
  room_key text not null,
  title text not null,
  created_at timestamptz not null default now(),
  unique (instance_id, room_key)
);

create table if not exists chat_room_members (
  room_id uuid not null references chat_rooms(id) on delete cascade,
  identity text not null check (identity in ('jonathan', 'minz')),
  role text not null default 'member' check (role in ('owner', 'member')),
  last_read_message_id uuid,
  last_read_at timestamptz,
  joined_at timestamptz not null default now(),
  primary key (room_id, identity)
);

create table if not exists chat_messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references chat_rooms(id) on delete cascade,
  sender_identity text not null check (sender_identity in ('jonathan', 'minz')),
  client_message_id text not null,
  kind text not null default 'text' check (kind in ('text', 'system')),
  body text not null,
  reply_to_message_id uuid references chat_messages(id) on delete set null,
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  deleted_at timestamptz,
  unique (room_id, sender_identity, client_message_id),
  check (char_length(body) between 1 and 4000)
);

alter table chat_room_members
  drop constraint if exists chat_room_members_last_read_message_fk;

alter table chat_room_members
  add constraint chat_room_members_last_read_message_fk
  foreign key (last_read_message_id)
  references chat_messages(id)
  on delete set null;

create table if not exists chat_message_reactions (
  message_id uuid not null references chat_messages(id) on delete cascade,
  identity text not null check (identity in ('jonathan', 'minz')),
  emoji text not null check (char_length(emoji) between 1 and 32),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (message_id, identity)
);

create index if not exists chat_messages_room_created_idx
  on chat_messages (room_id, created_at, id);

create index if not exists chat_reactions_message_idx
  on chat_message_reactions (message_id);

-- 開 RLS 但不加任何 public policy：只有拿 service role key 的 Cloudflare
-- Worker 能讀寫，瀏覽器端 anon key 完全碰不到，跟這個專案其他表一致。
alter table chat_instances enable row level security;
alter table chat_rooms enable row level security;
alter table chat_room_members enable row level security;
alter table chat_messages enable row level security;
alter table chat_message_reactions enable row level security;

revoke all on chat_instances from anon, authenticated;
revoke all on chat_rooms from anon, authenticated;
revoke all on chat_room_members from anon, authenticated;
revoke all on chat_messages from anon, authenticated;
revoke all on chat_message_reactions from anon, authenticated;

grant select, insert, update, delete on chat_instances to service_role;
grant select, insert, update, delete on chat_rooms to service_role;
grant select, insert, update, delete on chat_room_members to service_role;
grant select, insert, update, delete on chat_messages to service_role;
grant select, insert, update, delete on chat_message_reactions to service_role;

-- 種子資料：Jonathan/Minz 唯一的聊天室。第一個里程碑只需要這一間。
insert into chat_instances (id, app_id, title, feature_flags)
values (
  'couple-chat',
  'jonaminz',
  'Jonathan & Minz',
  '{"text":true,"reply":true,"reaction":true,"readReceipt":true,"typing":true,"presence":true}'::jsonb
)
on conflict (id) do update
set title = excluded.title,
    feature_flags = excluded.feature_flags,
    updated_at = now();

insert into chat_rooms (instance_id, room_key, title)
values ('couple-chat', 'jonathan-minz', 'Jonathan & Minz')
on conflict (instance_id, room_key) do nothing;

insert into chat_room_members (room_id, identity, role)
select id, 'jonathan', 'owner'
from chat_rooms
where instance_id = 'couple-chat' and room_key = 'jonathan-minz'
on conflict (room_id, identity) do nothing;

insert into chat_room_members (room_id, identity, role)
select id, 'minz', 'owner'
from chat_rooms
where instance_id = 'couple-chat' and room_key = 'jonathan-minz'
on conflict (room_id, identity) do nothing;
