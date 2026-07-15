-- 檔案位置：jonaminz/backend/supabase/project_tasks_source_map_schema.sql
-- 用途：project_tasks 補 source_map_id 欄位（選填），記住一筆任務是
-- 從「決策圖」（pages/admin/journal/ 的 DECISION_MAP 候選清單）哪個
-- 候選項目「加進去」畢業出來的。前端用它判斷：候選卡片只要還有任務
-- 指著它就不重複顯示；那筆任務被 ✕ 個別刪除（不是清除全部批次清完成）
-- 時，對應候選卡片要重新出現。見 worker.js 頂部文件註解、
-- AI_CONTEXT/CHANGELOG.md 對應日期條目。
--
-- 冪等寫法，可安全重複執行。

alter table project_tasks
  add column if not exists source_map_id text;
