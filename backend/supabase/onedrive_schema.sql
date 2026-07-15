-- 檔案位置：jonaminz/backend/supabase/onedrive_schema.sql
-- 用途：OneDrive 線 Phase A（授權底座）要用的資料表。見
-- AI_CONTEXT/ONEDRIVE_LINE_SPEC.md——雙帳號鏡射模式：Jonathan／Minz
-- 各自連自己的 OneDrive，Phase B 傳圖片時同一張圖分別上傳進兩人各自
-- 的 App Folder，兩人都能從自己的帳號查到完整聊天圖庫（2026-07-15
-- 使用者決策：「兩邊都想要有自己的資料可以查詢」）。
--
-- 2026-07-15 二次修訂：上一版是單列表（id=1，只存 Jonathan 一個帳號），
-- 部署當下沒有任何資料（0 rows），這裡直接改成 identity 當 primary
-- key 的兩列表，不是 add column 的漸進式修改。
--
-- 全部用 if not exists / add column if not exists 這種冪等寫法，可以
-- 放心重複執行。在 Supabase SQL Editor 貼上執行即可，跟這個專案其他
-- *_schema.sql 同一套流程。

drop table if exists onedrive_account;

create table if not exists onedrive_account (
  identity text primary key check (identity in ('jonathan', 'minz')),
  refresh_token text not null,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table onedrive_account enable row level security;

revoke all on onedrive_account from anon, authenticated;

grant select, insert, update, delete on onedrive_account to service_role;
