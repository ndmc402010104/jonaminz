# ARCHITECTURE — jonaminz 系統架構（工程交接版）

最後更新：2026-07-10（建檔）
讀者：接手本專案的下一個工程 agent。
狀態標記：本文描述「目前實際在跑的系統」；規劃中未實作的部分集中在 §7，
不要混淆。

---

## 1. 一句話架構

靜態站（GitHub Pages）＋ 一支 Cloudflare Worker（唯一後端）＋ Supabase（兩張表）。
前端沒有 build step、沒有框架、沒有 npm 依賴——全部是原生 JS，由
`assets/js/entry-core.js`（水庫本體）在 runtime 動態載入與組裝。

## 2. 分層

```
┌─ 頁面層（各頁自己的 app.js + page-xxx.css）────────────┐
│   只放業務邏輯；透過 JonaminzLoading.done/fail 回報     │
├─ Shell 層（header.js / footer.js / registry-loader.js）─┤
│   全站共用 UI；footer 顯示業務版本                       │
├─ 水庫本體（entry-core.js）───────────────────────────┤
│   loading gate、CSS 疊加順序、shell 與頁面 script 載入   │
├─ 動態外觀層（theme-runtime.js，CSS 第 8 層）──────────┤
│   獨立可攜，外部專案也能單獨引用                          │
├─ 後端（cloudflare-worker/worker.js）─────────────────┤
│   POST /api/action 唯一端點；持有 Supabase secret        │
└─ 資料庫（Supabase：theme_css_rules,                      │
           external_app_registrations，皆 RLS 鎖死）───────┘
```

## 3. 頁面載入流程（每一頁都一樣）

```
index.html（任何頁面）
  └─ inline script：設 JONAMINZ_ENTRY_VERSION（cache-buster）
     └─ document.write 載入 ①jonaminz-loading.css ②entry-core.js
        └─ entry-core.js：
           1. 讀 version.js（業務版本）＋ config.json（頁面登錄表）
           2. 依 <html data-jonaminz-page-id> 找到本頁 entry
           3. 依序載 CSS 第 1-6 層（assets/css/reservoir/01~06）
           4. 載本頁 entry.styles（第 7 層 Page Layer）
           5. 載 theme-runtime.js（第 8 層 Theme，動態）
           6. 載 shell：header.js / footer.js / registry-loader.js
           7. 載本頁 entry.afterScripts（頁面自己的 app.js）
           8. loading gate：css / shell / main 三段，全過才移除遮罩
```

關鍵不變式：
- 頁面 HTML 只直接載 loading.css + entry-core.js 兩個檔案，其餘全由 entry-core 疊加。
- 所有共用資源用根目錄絕對路徑（`/assets/...`），因為頁面可能巢狀在 `pages/xxx/`。
- CSS 後層可蓋前層，但不回頭改前層檔案本體。
- 1-7 層放結構規則（flex/grid/hover/z-index），第 8 層放視覺數值（顏色/間距/圓角/陰影）。

## 4. 資料流

### Theme（目前唯一的動態資料流）

```
後台 /pages/admin/theme/ ──saveThemeCssRules──▶ Worker ──▶ Supabase theme_css_rules
任何頁面（含外部專案）  ◀──getThemeCssRules── Worker ◀──┘
  theme-runtime.js 收到 rows（selector/property/value）
  → 組 CSS 文字 → 注入 <style id="jonaminz-theme-runtime">
  快取策略：localStorage 先套用（免閃爍）→ 背景更新 → 8 秒逾時降級（保留原樣式）
  selector=":root" 的規則輸出 CSS 變數 = 跨專案共用介面
```

注意：`saveThemeCssRules` **目前沒有身分驗證**（已知缺口，等 Google OAuth）。

### 外部專案（v0，現行機制，將被 Platform 規格取代）

```
拉：jonaminz 首頁 registry-loader.js 讀 registry.json（白名單）
    → fetch 各專案的 jonaminz-app.json → 顯示卡片
    （單一專案抓取失敗只影響那張卡片，不擋首頁 loading gate）
推（選用）：外部專案自己 fetch Worker 的 registerExternalApp 回報上線
    → Supabase external_app_registrations（只記 last_seen_at，不影響上架）
```

擁有權劃分（全專案最重要的原則）：外部專案只擁有「自己是什麼」
（title/description/href/version）；enabled/position/group/order 永遠在
jonaminz 的 `registry.json`。

## 5. 設定流

```
config.json   站台層設定：pages 登錄表（每頁 styles/afterScripts/loadingTasks）、
              backend.worker.baseUrl。新增頁面＝改這份 + 建資料夾，不改 entry-core。
registry.json 外部專案登錄表（目前空）。
version.js    業務版本，push 前 bump。
wrangler.toml Worker 設定；secrets（SUPABASE_URL/SUPABASE_SECRET_KEY）在
              Cloudflare 上，不在 repo。
```

## 6. 部署流

```
前端：git push origin main ──▶ GitHub Pages 自動建置 ──▶ www.jonaminz.com
Worker：cd backend/cloudflare-worker && npx wrangler deploy（獨立動作！push 不會部署它）
DB schema：手動貼 backend/supabase/*.sql 到 Supabase SQL Editor（無 migration 工具）
本機預覽：node dev-server.js → http://localhost:5500/
```

陷阱：
- 專案在 OneDrive 同步資料夾內，本機編輯可能被回滾，改完要總盤點。
- 只有 main 一個分支、origin 一個 remote（沒有 SKHPS 那種 prod/dev 雙 remote）。

## 7. 規劃中（有規格、零實作）——Platform Integration

詳見 `docs/platform-integration-consensus.md`（共識版，含凍結層 F1-F12）與
`docs/platform-integration-spec-review.md`（審查）。摘要：

- 圖書館模型：外部專案 head 加一個 script（常青網址 `/sdk/jonaminz-entry.js`）
  → SDK（專員）讀同站 `jonaminz.contract.json` → 推送給平台（取代 v0 拉模式）
  → 平台認 Origin 門牌、Integration Settings 決定上架與授權
  → `window.Jonaminz.*` 工具（未授權時「婉拒」：rejected Promise 固定錯誤碼）
  → Theme/CSS 收編進 SDK（合約宣告 `css: "tokens"`）。
- Auth：Google OAuth，v1 只做身分識別（Jonathan/Minz）。
- 尚待：其他 agent 交叉確認共識文件 → 定稿規格 → JSON Schema / 範本 / SDK。

**下一個 agent 注意**：實作 Platform 時不是蓋平行系統，是把 v0 的三個分散機制
（registry-loader 拉模式、theme-runtime 獨立 script、registerExternalApp fetch）
收編進一支 SDK。v0 機制在那之前仍是現行系統，不要提前拆。
