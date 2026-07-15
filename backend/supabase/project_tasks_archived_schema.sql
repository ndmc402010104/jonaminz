-- 檔案位置：jonaminz/backend/supabase/project_tasks_archived_schema.sql
-- 用途：project_tasks 加「封存」欄位（2026-07-16）。
--
-- 使用者回報：origin==='claude' 的已完成項目規則上永久保留、不能被
-- 「清除全部」清掉，累積久了「已完成」清單越來越長，不知道要看哪裡。
-- 「封存」不是刪除——只是把項目從預設看到的「已完成」列表移到另一個
-- 更不醒目的「已封存」區塊，隨時可以取消封存移回來，資料本身完全沒變。
--
-- 已透過 Supabase MCP apply_migration 套用到 jonaminz-db，這份檔案是
-- 留底文件（跟 project_tasks_origin_schema.sql／
-- project_tasks_source_map_schema.sql 同一個資料夾慣例），冪等寫法，
-- 可以安全重複執行。

alter table project_tasks add column if not exists archived boolean not null default false;
