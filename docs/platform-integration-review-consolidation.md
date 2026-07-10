# Platform Integration RFC — 五份 Review 彙整報告

日期：2026-07-10
輸入：`docs/platform-integration-reviews/` 五份完整 Review
（Codex、ChatGPT、Gemini、Claude Fable 5［含 F2 立場修正］、Perplexity）
輸出：本報告 = Specification v1.0 的直接前身。
第壹部分是共識定案（寫進 Spec，不再議）；第貳部分是需要使用者裁決的決策清單。

共識強度標記：★★★＝三份以上獨立收斂、★★＝兩份收斂無反對、★＝單份獨見但無反對且成本低。

---

## 壹、共識定案（直接寫進 Spec v1.0）

### 1. 錯誤模型：B — reject 帶固定錯誤碼 ★★★（4:1）

- 投 B：Codex F7、ChatGPT AR-12、Fable F7、Perplexity Q9。投 A：Gemini。
- 多數方共同理由：失敗的不對稱性——忘記 catch 會在 console 大聲報錯（unhandledrejection＋stack），忘記檢查 `.ok` 是靜默錯誤；一人維護十年選吵的那種。
- 凍結形狀：`JonaminzError { code, message, service, capability, retriable }`。
  code 穩定供程式判斷、message 供人讀不保證穩定、碼永不重用、caller 必須容忍未知碼。
- 配套紀律（三份共同強調）：**空結果不是錯誤**——搜尋無結果 resolve 空陣列；
  reject 只留給未完成的操作（未授權、service 不可用、格式錯誤、網路失敗）。
- 少數方（Gemini）的顧慮——unhandled rejection 干擾宿主——以「SDK 內部全程自我
  catch，錯誤只在 caller 主動 await 平台 API 時出現」承接，不燒房子原則不受影響。

### 2. 常青 SDK 發布模型：極小 loader ＋ 不可變 release ＋ 版本指標 ★★★（5:0）

五份全票、方案細節高度重合，直接定案：

- `jonaminz-entry.js` 降級為**幾十行、幾乎永不改動的 loader**。
- 真正 SDK 是 `sdk-<hash>.js`（immutable、長 cache）；loader 向 Worker 取
  版本指標（短 TTL / ETag）再載入。
- **回滾** ＝ 改一個指標值，所有站下次載頁即恢復（SDK 部署回滾）。
- **kill-switch** ＝ 指標指向 no-op 版本。
- **金絲雀** ＝ Settings 加 per-project channel 欄位（`stable` / `next`），
  讓自己常用的一個專案先吃新版。
- **回滾語意三分**（寫進 Spec）：SDK 部署回滾（指標）≠ Contract 內容回滾
  （各 app 自己 repo 的 git 事務）≠ Settings 回滾（Settings 的 git revert）。
- 指標取得失敗 → 用 last-known-good release（快取），再失敗 → SDK 靜默退場。
- 建議級採納：專用 smoke app（ChatGPT AR-18），固定測試情境清單，不上真業務。

### 3. Contract 推送信任模型：推送 ≠ 採信 ★★★

五份全部同意的底線，凍結為原則：

- **Contract 永無授權效力**；enabled / placement / grant 只看 Integration Settings。
- 平台端儲存分兩態：**observed（收到的）／approved（採信的）**
  （Codex 的 observed/effective、Fable 的 pending/approved 為同構方案）。
- **Shell 與 Search 永遠只讀 approved 快照**（Fable 補充，封掉「偽造合約
  污染導覽列標題與連結」的釣魚向量）。
- 廉價防線全採納：只收 Settings 已登記的 projectId、**entry URL 必須與該專案
  登記網域同源**（一行驗證砍掉大半釣魚面）、rate limit、payload size/深度上限、
  content hash 去重、管理介面 escape 所有顯示文字（防 stored XSS）。
- Discovery 與 Ingestion 分離定義（ChatGPT AR-20）：瀏覽器端怎麼找合約、
  平台端怎麼建立可信快照，是兩件事，未來可獨立演化。
- 核准流程的深度（手動點核准 vs 條件自動核准）→ 裁決項 D4。

### 4. Contract Discovery：預設根目錄 ＋ script 屬性唯一 override ★★★

- `/jonaminz.contract.json` 為預設；唯一 override 是
  `<script src="…" data-contract="/path/contract.json">`（ChatGPT AR-14、Fable F6 一致）。
- 明確否決 HTML meta（DOM 時序依賴、模板殘留）與 HTTP header
  （GitHub Pages 設不了）。不做多路徑掃描——heuristic 越多十年後越難除錯。
- Contract URL 限 same-origin。找不到 → 回報平台後進入 degraded，不猜路徑。
- 這同時解掉 GitHub Pages 子路徑部署（`username.github.io/repo/`）的現實問題。

### 5. Schema 演化規則（Contract 與 Settings 通用）★★★

- 頂層必有 `contractVersion`，v1 就有，不能後補。
- **must-ignore**：未知欄位一律忽略（雙向：舊 SDK 讀新約、新 SDK 讀舊約）；
  未知 capability / enum 值視為不支援，**不得 fallback 成權限更大的模式**。
- 已發布欄位永不改語意、永不改型別；要變就加新欄位；deprecation 只標記不刪除。
- 版本維度分離（ChatGPT AR-02）：Contract schema version ≠ Contract content
  hash/revision ≠ SDK release ≠ Platform protocol version ≠ capability version
  ≠ Settings schema/revision。Spec 用詞必須區分這六者。
- Validation fail-soft 規則凍結（ChatGPT AR-08）：頂層/身份錯 → 整份無效；
  單一 entry/object 錯 → 剔除該項其餘繼續；重複 ID → 該區段無效（不採
  「後者覆蓋」）；輸出結構化 validation result 而非 true/false。

### 6. 物件定址方案 = 第四個凍結層（"Data Contracts"）★★★

Pin/Relationship/Search 會把物件引用**持久化進 Supabase**——API 錯了能出 @2，
資料外鍵錯了要 migration，所以這層凍得比三層架構中任何一層都死：

- 引用形狀：`(projectId, objectType, objectId)`。
- `projectId` 永久不可變、不可重用、與網域/repo/URL 無關；命名規則
  （字元集、大小寫敏感性、長度上限）v1 定死。顯示名稱另立欄位。
- `objectId` 由專案自給、對平台是不透明字串、專案保證穩定（禁止資料庫自增序號）。
- `objectType` 語意永不改；要改就出新 type。`entryId` 同規則。
- objectRef → URL 解析：Contract 聲明每 type 的 URL template，平台端解析。
- 宣告 Object Type ≠ 資料可被平台自動讀取；讀寫行為由未來 capability 定義。
- 資料可攜性（Fable F16，建議級採納）：schema 平庸可攜、定期匯出、
  Worker 是唯一資料出入口。

### 7. Effective Capability 交集公式在 Worker 計算 ★★★

- 公式凍結：`Effective = Contract 宣告支援 ∩ Settings 授權 ∩ Runtime 可用 ∩ Actor 允許`
  （ChatGPT AR-03）。
- **交集計算永遠在 Worker，SDK 只照做**（Gemini Q4）；瀏覽器中的 Settings/快取
  永不是授權證明（ChatGPT AR-16）——非安全設定（theme/placement）可用 stale
  cache，授權判斷 Worker 逐請求重算。
- Settings grant 了 Contract 未宣告的能力 → 不生效＋診斷警告；Contract 移除
  entry 但 Settings 還有 placement → 忽略之，不自動刪 Settings。
- capability 需求三分（Codex F2 ＋ ChatGPT AR-07）：`supports`（能整合）／
  `requests`（希望啟用、缺了可降級）／`requires`（綁定 scope 的整合單元缺它
  不啟用）——**requires 永不阻止宿主頁面運作、永不造成自動 grant**。

### 8. Capability 文法與 Service 名稱處置 ★★★

- 凍結的是**機制**：root namespace、`name@version` 文法（版本細到能力層級：
  `search.query@1` 而非只有 `search@1`——Codex F6/ChatGPT 收斂）、capability
  取得方式、「名稱一經發布永不重用於不同語意」。
- 11 個 Service 名稱**降級為 reserved roadmap，不是 frozen API**
  （Codex F5、ChatGPT AR-13、Fable F14 三票收斂，無反對）：Health 有歧義、
  Shared Cache 是實作不是能力、Profile 與 Auth 重疊。名字隨第一個真實方法
  一起正式發布。→ 涉及 RFC 原始哲學變更，列裁決項 D3 請使用者確認。

### 9. 宿主環境隔離（DOM / CSS / Storage）★★

- 平台只動自己建立或明確指定的 mount node；不注入 global reset；
  不改宿主既有 class、body layout、z-index 體系（ChatGPT AR-06、Gemini 1）。
- CSS token 凍結三件事（Fable F5）：前綴（`--jz-`）、語義命名（`--jz-surface`
  而非 `--jz-gray-100`）、只增不刪／可貶值不可移除。**值隨主題自由變，名永不變。**
  ※ 註：現有 theme-runtime 輸出的變數名（`--color-primary` 等無前綴）在 SDK
  收編時要正式化為 `--jz-*`，舊名以別名過渡——這是現在改便宜、之後改貴的典型。
- SDK 的 localStorage / sessionStorage key 一律 `jonaminz.` 前綴。
- CSS 實際生效等級 = `min(Contract 聲明, Settings 授予)`（Fable F12a）。
- Entries 禁含 `order` / `weight` / `position` 欄位（placement 穿自我聲明的
  外衣；icon/title 可以，排序不行）（Fable F12b）。

### 10. SDK Lifecycle 與降級語意 ★★★

- 內部狀態機（ChatGPT AR-10）：bootstrapping → contract-loaded → identified →
  settings-loaded → negotiated → **ready** ／ degraded ／ disabled ／ failed。
- `ready` 語意：Contract＋身份＋Effective Settings＋能力協商完成即 ready；
  optional service 可 lazy init，不擋 ready。ready 永不永久 pending。
- **後端不可達的降級語意（產品級決策，全體同方向）**：最後已知 Settings 快取
  （localStorage）優先 → 無快取降級為 none 整合；ETag＋短 TTL 失效。
  平台故障日，15 個站照常運作，只是暫時裸奔或吃舊外觀。
- Degraded 時宿主可觀測（Codex F12）：`status` / `reason` 可讀，
  讓 app 能藏起整合限定的 UI，而不是各自寫偵測邏輯。
- 冪等載入（script 載兩次 no-op）；v1 明寫「只支援整頁載入語意」（SPA 路由
  切換不重初始化）；唯讀 `Jonaminz.status` / diagnostics 面
  （SDK 版本、lifecycle 狀態、Settings revision、被拒能力、最後錯誤碼）——
  一人維運唯一的遠端可觀測性（三份收斂）。

### 11. 內部分層修正：三層 → Kernel/Adapters/Shell/Services ＋ 依賴方向 ★★

- Codex F3（Policy 層）與 ChatGPT AR-05（Kernel/Adapter）指向同一問題：
  「Core 會變垃圾桶」。採 ChatGPT 版本命名，Policy 歸 Worker 端：
  **Kernel**（identity/lifecycle/capability registry/error model/state）、
  **Adapters**（contract discovery/validation/transports/cache）、
  **Shell**（UI mounting/theme）、**Services**（capability providers）。
- 依賴方向凍結：Shell / Services / Adapters → Kernel；Kernel 不反向依賴。
- **Services 無 DOM**：Services 是 headless capability API，任何像素由 Shell
  或宿主渲染（Fable F11）。Shell 可宣告 `shell: false` 完全不參與（Gemini 3）。
- 不要求四個資料夾/repo，要求 Spec 寫明邊界。

### 12. 其他採納

- Settings 一律經 Worker 端點供應 **flattened Effective Settings**（帶
  settingsVersion/revision/generatedAt），SDK 永不見 raw git URL 或檔案結構
  （Codex F1、F15＋ChatGPT AR-15）。Worker 套用新 Settings 前先驗證，
  無效則沿用 last-known-good。
- Git → DB 遷移日要補 audit log 替代方案（Fable F15c）。
- `window.Jonaminz` 維持大寫（Perplexity 建議小寫，獨見不採；理由：與品牌
  及既有文件一致）。配套規則採納：SDK 啟動偵測命名空間已被佔用時不覆寫、
  報警並退場；此命名空間保留給 SDK，宿主不得寫入。

---

## 貳、裁決清單（僅使用者能決定）

### D1. Ready 介面的「保證路徑」（Q10，真分歧 3:2）

Promise 派（Codex/ChatGPT/Perplexity）vs queue 派（Gemini/Fable）。
Fable 的技術論證是硬的：SDK 必須 async 載入（同步 script = jonaminz.com 掛掉
全站白屏），async 之下宿主同步碼執行時 `window.Jonaminz` 可能還不存在，
裸 Promise 有 race。但 ChatGPT 對 general command queue 的反對也是硬的
（指令重放的副作用語意是十年債）。

**兩案其實可以合成**，差別只在凍結的那一行長什麼樣：

- **方案 甲（彙整推薦）：inline Promise stub。** 官方整合 snippet 凍結為：
  幾行 inline script 先建立 `window.Jonaminz` 與 `ready` Promise（resolver
  暫存），再 async 載入 SDK，SDK 就緒後 resolve。保證路徑就是
  `await window.Jonaminz.ready`，任何時序下都存在、無 race；不引入 queue 的
  重放語意。宿主每天寫的一行 = `const jz = await Jonaminz.ready`。
- **方案 乙（Fable 版）：callback queue 為保證路徑。**
  `jonaminzQ.push(api => {...})` 兩行約定凍結；ready Promise 掛在後面當糖。
  註：Fable 的 queue 只收 callback（等同延遲的 ready listener），不是 ChatGPT
  反對的指令重放 queue，副作用由 callback 自控——反對意見部分不適用。
- 兩案的 stub 都要求宿主貼官方 snippet；乙的 stub 較短（兩行），
  甲的介面較單一（全程只有 Promise 一種寫法）。

### D2. 跨源身份模型的 v1 答案（三份點名的「最大的洞」，RFC 未問）

ChatGPT AR-01/04、Fable F1、Perplexity 1.4 獨立收斂：這一節不能留白。
第三方 cookie 已死、SDK 跑在 10-15 個 origin、Services 含個人資料
（Health/File/Calendar/Profile），任一 hobby app 的 XSS 是爆炸半徑。

- **方案 甲（彙整推薦，Fable 明示提出）：v1 外部專案一律匿名。**
  只有 jonaminz.com 主站有登入態（Google OAuth）；外部專案只能拿非個人化
  能力（theme tokens、公開 search 等）；個人資料 API 只在主站。Spec 保留
  Actor Context 的欄位形狀（ChatGPT AR-04），未來加跨源身份不改 API 表面。
  白紙黑字凍結這條規則——它是明示的決定，不是空白。
- **方案 乙：現在就設計跨源 token 發放。** 工程量大、瀏覽器分區政策地雷多，
  五份中無任何一份推薦在 v1 做。

### D3. Service 名單與 CSS enum 縮減（推翻 RFC 原始「名稱先凍結」哲學）

三份收斂（見壹-8），但這改變了你原本的決定，需要你點頭：

- **方案 甲（彙整推薦）**：11 個 Service 名 → reserved roadmap（非 frozen API，
  名字隨第一個方法一起發布）；CSS enum v1 只含 `none`/`tokens`，
  `components`/`full`/`self` 同樣降為 reserved（Fable F17 更建議 components/full
  標「除非出現具體且反覆的需求，否則不做」）。
- **方案 乙**：維持 RFC 原案——名稱與 enum 全部現在凍結。

### D4. 合約核准流程的深度（Q12 光譜：Perplexity「現在夠」→ Fable「版本級核准」）

observed/approved 兩態資料模型是共識（零成本、day one 就分），分歧在
「approved 怎麼產生」：

- **方案 甲（彙整推薦，Fable 修正版）：手動核准。** 新版合約進 pending，
  你在主頁看 diff、點核准，Shell 才更新。以「合約改動頻率＝幾個月一次」
  的尺度，摩擦可忽略；核准機制本身就是安全機制＋免費 audit trail。
  未來嫌煩再加 GitHub Action token 通道（有 token 自動過，無 token 進 pending）。
- **方案 乙（Perplexity 版）：條件自動核准。** Origin 符合＋schema 通過＋
  同源 URL 規則即自動 approved。省一個管理 UI，但「核准」不再是安全屏障，
  防線只剩 Origin 檢查（五份中三份認為 Origin 可偽造不足以單獨承擔）。

---

## 參、裁決後的下一步

裁決 D1–D4 → 撰寫 **Specification v1.0（Frozen）**（結構：凍結層條文／
演進層／保留層，以圖書館模型為敘事骨架，吸收壹的全部定案與 D1-D4 裁決結果）
→ 使用者驗收凍結 → JSON Schema ＋ Contract 範本 ＋ SDK 骨架。
