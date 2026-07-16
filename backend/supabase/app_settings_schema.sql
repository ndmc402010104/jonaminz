-- 檔案位置：jonaminz/backend/supabase/app_settings_schema.sql
-- 用途：通用 key/value 設定表，第一個使用者是 Chat OneDrive 檔案保留天數
-- （使用者原話：「這種東西的設定值之後應該有一個設定面板可以調整，不是
-- 寫死在程式碼裡」）。故意做成通用表而不是 chat_settings 專用表，之後
-- 出現同類「可調整但不常變」的設定值可以直接多一個 key，不用每次都跑
-- 一次新 migration。
--
-- 冪等寫法，可安全重複執行。

create table if not exists app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by text
);

-- Chat OneDrive 檔案保留天數，預設 180 天（約 6 個月，使用者原話）。
insert into app_settings (key, value)
values ('chat_file_retention_days', '180'::jsonb)
on conflict (key) do nothing;
