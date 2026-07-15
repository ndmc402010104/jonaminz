-- 檔案位置：jonaminz/backend/supabase/project_tasks_schema.sql
-- 用途：後台「決策與待辦」頁（pages/admin/journal/）的待辦看板資料表。
-- 兩條泳道：'for_user'（Claude 交辦給使用者做的事，例如驗收項目）、
-- 'for_claude'（使用者隨時想到就記下來、之後給 Claude 挑來做的待辦）。
-- 單一全域清單，不分房間/專案（這個站目前只有 Jonathan／Minz 兩人）。
--
-- 全部用 if not exists / add column if not exists 這種冪等寫法，可以
-- 放心重複執行。在 Supabase SQL Editor 貼上執行即可，跟這個專案其他
-- *_schema.sql 同一套流程。

create table if not exists project_tasks (
  id uuid primary key default gen_random_uuid(),
  lane text not null check (lane in ('for_user', 'for_claude')),
  text text not null,
  done boolean not null default false,
  created_by text not null check (created_by in ('jonathan', 'minz')),
  created_at timestamptz not null default now(),
  done_at timestamptz
);

create index if not exists project_tasks_lane_idx
  on project_tasks (lane, done, created_at desc);

alter table project_tasks enable row level security;

revoke all on project_tasks from anon, authenticated;

grant select, insert, update, delete on project_tasks to service_role;
