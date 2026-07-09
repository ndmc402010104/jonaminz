-- 檔案位置：jonaminz/backend/supabase/schema.sql
-- 用途：外部專案回報機制（registerExternalApp）的資料表。
-- 在 Supabase SQL Editor 貼上執行即可。

create table if not exists external_app_registrations (
  id bigint generated always as identity primary key,
  project_id text not null unique,
  title text,
  href text,
  version text,
  env text,
  origin text,
  user_agent text,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index if not exists external_app_registrations_last_seen_idx
  on external_app_registrations (last_seen_at desc);

-- 開 RLS 但不加任何 public policy：只有拿 service role key 的 Cloudflare Worker
-- 能讀寫這張表，瀏覽器端的 anon key 完全碰不到。
alter table external_app_registrations enable row level security;
