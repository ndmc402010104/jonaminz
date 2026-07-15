-- 檔案位置：jonaminz/backend/supabase/onedrive_schema.sql
-- 用途：OneDrive 線 Phase A（授權底座）要用的資料表。見
-- AI_CONTEXT/ONEDRIVE_LINE_SPEC.md——圖片分享跟自架 APK 發佈共用同一組
-- OneDrive 授權（Jonathan 個人帳號、App Folder 權限）。
--
-- 不改既有 schema 檔；這份是新增檔案，全部用 if not exists / add column
-- if not exists 這種冪等寫法，可以放心重複執行。在 Supabase SQL Editor
-- 貼上執行即可，跟這個專案其他 *_schema.sql 同一套流程。

-- 單列表：這個 App 只連一個 OneDrive 帳號（Jonathan 的），id 固定是 1，
-- 不是每個使用者一列。refresh_token 是長效憑證（個人帳號會滾動更新，
-- Worker 每次拿它換 access token 時，回應帶新的就要覆蓋這一列）。
create table if not exists onedrive_account (
  id integer primary key check (id = 1),
  refresh_token text not null,
  connected_by text not null check (connected_by in ('jonathan', 'minz')),
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table onedrive_account enable row level security;

revoke all on onedrive_account from anon, authenticated;

grant select, insert, update, delete on onedrive_account to service_role;
