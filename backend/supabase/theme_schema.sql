-- 檔案位置：jonaminz/backend/supabase/theme_schema.sql
-- 用途：Theme（CSS 疊加第 8 層 - 動態外觀）的資料表。在 Supabase SQL Editor 貼上執行。
--
-- 一列 = 一條 CSS 宣告：selector + property + value。
-- selector 可以是 ":root"（存 --xxx token，任何專案都能引用，是水庫層跨專案共用的
-- 主要介面）、也可以是 ".card" 這種一般 class（給 jonaminz 自己頁面的元件微調用）。

create table if not exists theme_css_rules (
  id bigint generated always as identity primary key,
  selector text not null,
  property text not null,
  value text not null,
  group_name text,
  description text,
  order_index integer not null default 0,
  updated_at timestamptz not null default now(),
  unique (selector, property)
);

create index if not exists theme_css_rules_selector_idx
  on theme_css_rules (selector);

alter table theme_css_rules enable row level security;
