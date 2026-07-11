-- 檔案位置：jonaminz/backend/supabase/auth_schema.sql
-- 用途：implementation plan 第 9 項——jonaminz 主站登入（S6：v1 只做
-- 主站身分識別，Jonathan/Minz 兩個固定身分，不是開放註冊系統）。
-- 在 Supabase SQL Editor 貼上執行即可。

-- 一列 = 一次登入建立的 session（不管走哪個 provider 都存這張表）。
-- 用真的 session 表、不是自簽 JWT，是為了能真的登出/撤銷——JWT 要做到
-- 撤銷得另外維護 blocklist，兩人用量下 session 表更直接。
create table if not exists sessions (
  token text primary key,
  identity text not null check (identity in ('jonathan', 'minz')),
  provider text not null check (provider in ('google', 'internal')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index if not exists sessions_expires_at_idx on sessions (expires_at);

-- Google OAuth authorization code flow 的 CSRF 防護用，一次性、短 TTL：
-- /auth/google/start 產生一筆、/auth/google/callback 核對後立刻刪除。
create table if not exists oauth_states (
  state text primary key,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

-- 開 RLS 但不加任何 public policy：只有拿 service role key 的 Cloudflare
-- Worker 能讀寫這兩張表，瀏覽器端完全碰不到（跟既有表同一個原則）。
alter table sessions enable row level security;
alter table oauth_states enable row level security;

-- 透過 Supabase Management API 的 database/query 端點（而不是儀表板
-- SQL Editor）建立的表，service_role 不會自動拿到表格層級 DML 權限——
-- 這是本專案已經踩過兩次的坑（contract_schema.sql／theme_schema.sql
-- 都補過），這裡直接先補上，不等出事才修。
grant select, insert, update, delete on sessions to service_role;
grant select, insert, update, delete on oauth_states to service_role;
