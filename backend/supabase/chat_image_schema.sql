-- 檔案位置：jonaminz/backend/supabase/chat_image_schema.sql
-- 用途：OneDrive 線 Phase B（圖片訊息）要用的欄位。見
-- AI_CONTEXT/ONEDRIVE_LINE_SPEC.md §2.1/§2.2——圖片只上傳一份到傳送者
-- 自己的 OneDrive 帳號，用 Graph 原生「分享給特定人」機制授權對方
-- 帳號讀取（不是雙寫鏡射）。
--
-- 不改既有 schema 檔；這份是新增檔案，全部用 if not exists / add
-- column if not exists 這種冪等寫法，可以放心重複執行。在 Supabase
-- SQL Editor 貼上執行即可，跟這個專案其他 *_schema.sql 同一套流程。

alter table chat_messages
  drop constraint if exists chat_messages_kind_check;

alter table chat_messages
  add constraint chat_messages_kind_check
  check (kind in ('text', 'system', 'shared_item', 'image'));

-- 圖片訊息的中繼資料：{itemId, ownerIdentity, w, h, thumbDataUri,
-- sharedOk}——itemId／ownerIdentity 用來決定讀圖時要用誰的帳號查
-- （見 worker.js 的 getImageUrls），thumbDataUri 是上傳當下就存進來的
-- 模糊縮圖（不用等 Graph 就能先顯示），sharedOk 記錄 /invite 分享
-- 呼叫當下是否成功（失敗不擋訊息發送，只是對方暫時看不到）。
alter table chat_messages
  add column if not exists metadata jsonb;

-- Phase A 的 onedrive_account 表只存 identity/refresh_token，Phase B
-- 的 /invite 分享機制需要對方的 Microsoft 帳號 email 當 recipients
-- 參數，連接 OneDrive 當下（handleOnedriveCallback）順便向 Graph 要
-- 一次存起來。
alter table onedrive_account
  add column if not exists account_email text;
