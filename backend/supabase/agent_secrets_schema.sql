-- 檔案位置：jonaminz/backend/supabase/agent_secrets_schema.sql
-- 用途：給 agent 用的密鑰保管箱，使用者原話「很像 cloudflare secret api
-- 儲存那種模式」——使用者自己在後台輸入 名稱/值 兩個欄位存進來，agent
-- 需要時直接讀（不是每次跟使用者要）。跟 app_settings 分開一張表：
-- app_settings 放的是保留天數這類不敏感的設定值，這張表放的是憑證，
-- 分開存放不要混在一起，UI 上也不會把兩種東西畫在同一個列表裡。
--
-- 冪等寫法，可安全重複執行。

create table if not exists agent_secrets (
  name text primary key,
  value text not null,
  updated_at timestamptz not null default now(),
  updated_by text
);

revoke all on agent_secrets from anon, authenticated;
grant select, insert, update, delete on agent_secrets to service_role;
