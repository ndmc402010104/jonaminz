-- 檔案位置：jonaminz/backend/supabase/chat_shared_schema.sql
-- 用途：Chat 的 Shared（分享內容）模組 Phase 1 唯一垂直流程要用的資料表
-- （見任務書：分享目前內容 → 正規化 URL → 相同 URL 合併 → 內容卡 →
-- 明確點進去才算已看到 → 討論綁定 composer）。
--
-- 不改既有 chat_schema.sql（已經在 Supabase 執行過，維持穩定）；這份是
-- 新增檔案，全部用 if not exists / add column if not exists 這種冪等
-- 寫法，可以放心重複執行。在 Supabase SQL Editor 貼上執行即可，跟這個
-- 專案其他 *_schema.sql 同一套流程。

create table if not exists chat_shared_items (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references chat_rooms(id) on delete cascade,
  url text not null,
  title text not null,
  source text not null,
  note text,
  share_count integer not null default 1,
  first_shared_by text not null check (first_shared_by in ('jonathan', 'minz')),
  last_shared_by text not null check (last_shared_by in ('jonathan', 'minz')),
  created_at timestamptz not null default now(),
  last_shared_at timestamptz not null default now(),
  unique (room_id, url)
);

create table if not exists chat_shared_item_seen (
  item_id uuid not null references chat_shared_items(id) on delete cascade,
  identity text not null check (identity in ('jonathan', 'minz')),
  seen_at timestamptz not null default now(),
  primary key (item_id, identity)
);

alter table chat_messages
  drop constraint if exists chat_messages_kind_check;

alter table chat_messages
  add constraint chat_messages_kind_check
  check (kind in ('text', 'system', 'shared_item'));

alter table chat_messages
  add column if not exists shared_item_id uuid references chat_shared_items(id) on delete set null;

create index if not exists chat_shared_items_room_idx
  on chat_shared_items (room_id, last_shared_at desc);

create index if not exists chat_messages_shared_item_idx
  on chat_messages (shared_item_id);

alter table chat_shared_items enable row level security;
alter table chat_shared_item_seen enable row level security;

revoke all on chat_shared_items from anon, authenticated;
revoke all on chat_shared_item_seen from anon, authenticated;

grant select, insert, update, delete on chat_shared_items to service_role;
grant select, insert, update, delete on chat_shared_item_seen to service_role;
