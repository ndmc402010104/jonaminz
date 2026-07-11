# ARCHITECTURE — jonaminz 系統架構（工程交接版）

最後更新：2026-07-11（補 Platform Integration Contract 收取已上線）
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
           external_app_registrations,                    │
           contract_snapshots / contract_active_snapshots /│
           contract_audit_log，皆 RLS 鎖死）───────────────┘
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

### Contract 收取（Platform Integration，推模式，取代上面的 v0 拉模式）

```
外部專案 SDK ──submitContract──▶ Worker：
  1. request Content-Length 超過上限直接拒絕（pre-parse 粗防）
  2. 查 integration-settings.json：projectId／該 Worker 所屬 environment 是否登記
  3. 核對請求 Origin header 是否等於登記的 origin
  4. ajv standalone validator 驗 Contract JSON Schema（build-time 預編譯，
     見下方「部署流」的重要陷阱）
  5. cross-field 驗證（entryId/objectType 重複、requests/requires ⊆ supports、
     requires.entryId 參照）＋ URL 用 WHATWG URL() 重新解析、比對 origin
  6. canonical content hash 去重
  7. insert Supabase contract_snapshots（status 永遠 'pending'）＋ contract_audit_log
```

推送 ≠ 採信：收下的合約一律 `pending`，沒有任何自動 approve/grant（S13, S16）。
approve/reject 已實作並上線（`/pages/admin/contracts/` 後台，Worker secret
`JONAMINZ_ADMIN_TOKEN` 保護）：`listPendingContracts`（公開唯讀）／
`approveContract`／`rejectContract` 三個 action 呼叫 Supabase RPC
（`approve_contract_snapshot`／`reject_contract_snapshot`，見
`backend/supabase/contract_schema.sql`），一次 function call 在 DB 端原子
完成「改狀態＋切換 `contract_active_snapshots` 指標＋寫
`contract_audit_log`」。核准/否決都不是終態，可互相改判（S13：只改狀態與
active 指標，永不覆寫歷史——歷史指 audit log 不可竄改，不是 status 不能
再變）；否決時如果那筆正好是目前生效版本，會撤回 active 指標（沒有版本
歷史堆疊可自動退回上一版，安全預設是「暫時沒有生效版本」）。
完整規格見 `docs/platform-integration-spec-v1.md`（Frozen, S1-S39）；schema 細節見
`docs/contract-schema/README.md`；Worker 端細節見 `backend/README.md`。

## 5. 設定流

```
config.json   站台層設定：pages 登錄表（每頁 styles/afterScripts/loadingTasks）、
              backend.worker.baseUrl。新增頁面＝改這份 + 建資料夾，不改 entry-core。
registry.json 外部專案登錄表（v0 拉模式用，目前空）。
integration-settings.json  Platform Integration 用的 Integration Settings
              （S38：git 檔案＋Worker 供應）：projectId → environment →
              registered origin。跟 registry.json 是兩個獨立機制，不要混用
              （v0 尚未作廢，見 §7 與 RULES.md §4）。目前為空，尚無真實外部專案。
version.js    業務版本，push 前 bump。
wrangler.toml Worker 設定；secrets（SUPABASE_URL/SUPABASE_SECRET_KEY）在
              Cloudflare 上，不在 repo；`[vars] JONAMINZ_ENVIRONMENT` 決定這個
              部署自己是哪個 environment（不是 payload 能宣告的，見上面
              「Contract 收取」）。
```

## 6. 部署流

```
前端：git push origin main ──▶ GitHub Pages 自動建置 ──▶ www.jonaminz.com
Worker：cd backend/cloudflare-worker && npm install && npx wrangler deploy
       （獨立動作！push 不會部署它）
DB schema：手動貼 backend/supabase/*.sql 到 Supabase SQL Editor（無 migration 工具）
本機預覽：node dev-server.js → http://localhost:5500/
```

陷阱：
- 專案在 OneDrive 同步資料夾內，本機編輯可能被回滾，改完要總盤點。
- 只有 main 一個分支、origin 一個 remote（沒有 SKHPS 那種 prod/dev 雙 remote）。
- **改了 `docs/contract-schema/jonaminz.contract.schema.json` 之後，部署 Worker
  前必須先重跑 `node generate-contract-validator.mjs`**（在
  `backend/cloudflare-worker/` 下），重新產生
  `contract-schema-validator.generated.js`，否則 Worker 用的還是舊 schema——
  這個依賴關係在 git diff 上看不出來，容易忘記。
- **Cloudflare Workers 的 V8 isolate 禁止 `new Function`/`eval`**：任何在
  runtime 才把字串編譯成函式的套件（例如 `ajv.compile()`）部署到 Workers 會
  直接失敗，而且 `wrangler deploy --dry-run` 測不出來（dry-run 只測 bundle
  過不過，不會真的執行）。這正是為什麼 Contract Schema 驗證要用 build-time
  預編譯（上一條），不是在 Worker 裡呼叫 `ajv.compile()`。要驗證這類套件在
  Workers 上真的能跑，用 `npx esbuild <file> --bundle --platform=node
  --format=cjs` 打包後 grep 產物確認沒有 `new Function`/`eval(`，比只信賴
  dry-run 可靠。

## 7. 規劃中、尚未實作——Platform Integration 剩餘部分

規格 `docs/platform-integration-spec-v1.md` 已 **Frozen（S1-S39）**。
Contract JSON Schema（`docs/contract-schema/`）、Worker 端合約收取
（`submitContract`，見上面 §4「Contract 收取」）與核准後台（approve/reject，
同見 §4）**已實作並部署上線**，不在本節範圍——本節只列真正還沒做的部分，依
`docs/platform-integration-v1-implementation-plan.md` 的順序：

- **Flattened Effective Settings 端點**（S38，外觀 vs 授權分兩類）。
- **SDK**：常青網址 `/sdk/jonaminz-entry.js`、官方 snippet 對接（S21-S23）、
  lifecycle 狀態機、錯誤模型（S27-S29）、`window.Jonaminz.*`（未授權時
  「婉拒」：rejected Promise 固定錯誤碼）、contract discovery（S18-S20）。
- **tokens CSS 收編**：現有 `theme-runtime.js` 邏輯併入 SDK，變數名正式化為
  `--jz-*`（S36）。
- **smoke app** 完整生命週期測試。
- **Google OAuth**：v1 只做主站身分識別（Jonathan/Minz，S6）。

**下一個 agent 注意**：實作以上項目時不是蓋平行系統，是把 v0 的三個分散機制
（registry-loader 拉模式、theme-runtime 獨立 script、registerExternalApp fetch）
收編進一支 SDK。v0 機制在那之前仍是現行系統，不要提前拆（作廢條件見
RULES.md §4）。
