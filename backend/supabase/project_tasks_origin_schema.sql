-- 檔案位置：jonaminz/backend/supabase/project_tasks_origin_schema.sql
-- 用途：project_tasks 補 origin 欄位（'user'／'claude'），區分「Claude
-- 交辦的項目」跟「使用者自己輸入的項目」——前者不能刪除，只能勾選
-- 完成或移動泳道；後者可以自由刪除。見 backend/cloudflare-worker/
-- worker.js 頂部文件註解、AI_CONTEXT/CHANGELOG.md 對應日期條目。
--
-- 冪等寫法，可安全重複執行。UPDATE 語句用固定的時間戳當截止線，只
-- 回填這次改動之前就存在的歷史資料（當時全部都是 Claude 交辦/轉送
-- 出來的項目，已人工核對過），不會影響這次改動之後才新增的任何列。

alter table project_tasks
  add column if not exists origin text not null default 'user'
  check (origin in ('user', 'claude'));

update project_tasks
  set origin = 'claude'
  where created_at < '2026-07-15T09:10:00+00:00';
