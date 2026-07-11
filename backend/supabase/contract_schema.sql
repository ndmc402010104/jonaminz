-- 檔案位置：jonaminz/backend/supabase/contract_schema.sql
-- 用途：Platform Integration（圖書館模型）Contract 收取用的三張表。
-- 對應規格 docs/platform-integration-spec-v1.md（Frozen, S13-S16）與
-- docs/platform-integration-v1-implementation-plan.md 第 2 項。
-- 在 Supabase SQL Editor 貼上執行即可。

-- 每一列 = 一次 Contract 推送產生的 immutable snapshot（S13）。
-- 推送 ≠ 採信：status 一律從 'pending' 開始，approve/reject 是
-- implementation plan 第 3 項（核准後台）才會寫入的動作，這裡先把
-- 表建好，本次不會有任何一列被改成 approved/rejected。
create table if not exists contract_snapshots (
  id bigint generated always as identity primary key,
  project_id text not null,
  environment text not null,
  raw_contract jsonb not null,
  canonical_hash text not null,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  validation_result jsonb not null,
  submitted_origin text,
  submitted_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by text,
  note text
);

create index if not exists contract_snapshots_project_env_idx
  on contract_snapshots (project_id, environment, submitted_at desc);

-- S13：另以 activeApprovedSnapshotId 指向目前生效的那一份。本次不會寫入
-- 任何資料（approve 動作是 implementation plan 第 3 項），先建表讓三態
-- 生命週期的資料模型是完整的。
create table if not exists contract_active_snapshots (
  project_id text not null,
  environment text not null,
  active_snapshot_id bigint not null references contract_snapshots(id),
  updated_at timestamptz not null default now(),
  primary key (project_id, environment)
);

-- S14：audit trail 每筆至少含 projectId、previous hash、new hash、action、
-- actor、timestamp、optional note。本次只會寫入 action='submit' 的列，
-- actor 一律 null（人工核准要到有登入系統才有真人 actor）。
create table if not exists contract_audit_log (
  id bigint generated always as identity primary key,
  project_id text not null,
  environment text not null,
  snapshot_id bigint references contract_snapshots(id),
  action text not null check (action in ('submit', 'approve', 'reject')),
  previous_hash text,
  new_hash text,
  actor text,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists contract_audit_log_project_env_idx
  on contract_audit_log (project_id, environment, created_at desc);

-- 開 RLS 但不加任何 public policy：只有拿 service role key 的 Cloudflare
-- Worker 能讀寫這三張表，瀏覽器端完全碰不到（跟既有兩張表同一個原則）。
alter table contract_snapshots enable row level security;
alter table contract_active_snapshots enable row level security;
alter table contract_audit_log enable row level security;

-- 2026-07-11 踩過的坑：這份 SQL 若透過 Supabase Management API 的
-- database/query 端點（而不是 Supabase 儀表板的 SQL Editor）執行，
-- service_role 不會自動拿到表格層級的 DML 權限（RLS 設定是對的，
-- 但 Postgres GRANT 是分開的一層）——第一次呼叫 submitContract 時
-- 直接收到 Supabase 403「permission denied for table contract_snapshots」。
-- 這裡明確補上，跟既有 external_app_registrations/theme_css_rules
-- 兩張表的權限一致，不管用哪個管道建表都不會漏。
grant select, insert, update, delete on contract_snapshots to service_role;
grant select, insert, update, delete on contract_active_snapshots to service_role;
grant select, insert, update, delete on contract_audit_log to service_role;
