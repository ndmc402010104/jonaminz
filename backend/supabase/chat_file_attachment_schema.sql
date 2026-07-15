-- 檔案位置：jonaminz/backend/supabase/chat_file_attachment_schema.sql
-- 用途：Chat 檔案附件（決策圖候選項目畢業出來的功能，2026-07-15）。
-- chat_messages.kind 加 'file'，跟圖片訊息共用同一套 metadata jsonb
-- 欄位（Phase B 已經加過），這裡不用再新增欄位。見 worker.js 頂部
-- 文件註解、AI_CONTEXT/CHANGELOG.md 對應日期條目。
--
-- 冪等寫法，可安全重複執行。

alter table chat_messages
  drop constraint if exists chat_messages_kind_check;

alter table chat_messages
  add constraint chat_messages_kind_check
  check (kind in ('text', 'system', 'shared_item', 'image', 'file'));
