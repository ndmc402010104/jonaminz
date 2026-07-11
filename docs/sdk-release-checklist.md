# SDK Release Checklist（S39：Contract schema／SDK 回滾相容）

日期：implementation plan 第 5 項（2026-07-11）
地位：**流程文件，不是規格**。規格是 `platform-integration-spec-v1.md`
的 S37/S39（唯一權威）；本文是把 S39 的原則落實成一份可勾選的檢查表，
文件即可，S39 原文明講不需要複雜系統。

## 背景：為什麼需要這張表

`stable` channel 的回滾目標（也就是 stable 上一次指的那個 release）必須
**支援所有目前 active approved 的 Contract schema 版本**。如果先核准了
一份用新 schema 寫的 Contract，之後才發現新 SDK release 有問題要回滾到
舊 release，而舊 release 根本不認得新 schema，回滾這個動作本身就會弄壞
已經在運作的整合——這正是 S39 要防的事。

## 發布新 Contract schema 版本時，照這個順序

1. **先發布支援新 schema 的 SDK release**：改 `sdk/sdk-src/sdk.js`，跑
   `node sdk/generate-sdk-release.mjs` 產生新的 `sdk/sdk-<hash>.js`，先把
   `next` channel（`backend/cloudflare-worker/sdk-versions.json`）指過去，
   不要直接動 `stable`。
2. **確認回滾目標也支援新 schema**：`stable` channel 目前指的那個
   release（也就是「如果現在要回滾，會退到哪一版」）要先確認能正確處理
   新 schema 的 Contract——不支援就先幫它補上支援、重新產生一份、更新
   `stable` 指標，**這一步做完才算「回滾目標安全」**。
3. **只有第 2 步做完，才能核准使用新 schema 的合約**——也就是說，
   `/pages/admin/contracts/` 後台按下「核准」那個當下，S39 要求「如果現在
   要回滾，回滾到的版本能不能正常處理這份剛核准的合約」這個問題的答案
   必須是「能」。這是流程紀律，不是程式碼會自動擋的東西（v1 沒有這種
   自動檢查，見下方「不做的事」）。
4. 觀察一段時間穩定後，才把 `stable` 也指到新 release（這時候「上一版
   stable」自然變成新的回滾目標，重複第 2 步的檢查邏輯）。

## 發布流程本身（不牽涉 schema 版本變更時）

1. 改 `sdk/sdk-src/sdk.js`。
2. `node sdk/generate-sdk-release.mjs`，記下印出來的 hash/url。
3. 人工決定要不要把某個 channel（`next` 先測、確認沒問題再換 `stable`）
   的指標指過去——**改 `backend/cloudflare-worker/sdk-versions.json`**，
   `revision` 手動 +1。
4. `git add` 新產生的 `sdk/sdk-<hash>.js` 與改過的 `sdk-versions.json`，
   commit。
5. `cd backend/cloudflare-worker && npx wrangler deploy`——**改
   `sdk-versions.json` 沒有部署不會生效**，這份檔案是 build-time 打包進
   Worker 的 git 檔案，跟 `integration-settings.json` 同樣的模式。
6. 用 `getSdkVersion`（curl 或瀏覽器測試頁）確認回傳的 hash/url/revision
   是新的。

## Kill-switch（緊急停用）

把該 channel 的指標改成 `{ "hash": "empty", "url": "/sdk/sdk-empty.js" }`
（`sdk/sdk-empty.js` 已經存在、內容真的什麼都不做）、`revision` +1、
deploy。之後任何載入這支 loader 的頁面都不會再執行任何 Jonaminz 邏輯，
但頁面本身不受影響（S24）。

## 回滾（安全回滾＝改指標，不是改程式碼）

把 channel 指標改回上一個已知穩定的 hash/url、`revision` +1、deploy。
**不要**去改已經產生的 `sdk/sdk-<hash>.js`——這些檔案是 immutable，內容
不該再變，回滾永遠是「換指標指去另一個已經存在的檔案」，不是「改檔案
內容」。

## 這次（第 5 項）刻意不做的事

- **沒有自動化檢查**「這份 Contract 用的 schema 版本，stable 回滾目標
  的 SDK release 支不支援」——這是規格 S39 允許的簡化（「落實方式是
  發布 checklist（或版本指標附相容資訊），不需要複雜系統」），目前
  只有這張表、靠人工在核准 Contract 前自己過一遍。之後如果 schema
  版本變更變頻繁、人工容易漏掉，可以考慮在 `sdk-versions.json` 每個
  release 附上「支援的 schema 版本清單」，讓核准後台自動比對——但那是
  之後才要做的事，現在還沒有第二個 Contract schema 版本，這張表夠用。
- **金絲雀（`next` channel）目前沒有真實專案在用**：`integration-settings.json`
  要手動把某專案的 `channel` 設成 `"next"` 才會生效，v1 沒有專案這樣設，
  純粹是機制就位（見 `AI_CONTEXT/CHANGELOG.md` 2026-07-11 條目）。
