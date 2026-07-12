<!--
來源：Claude Fable 5（另一個對話，Anthropic）
收件日：2026-07-10
對應 RFC：docs/platform-integration-review-request.md（凍結版，12 問）
狀態：完整版原文照錄（僅還原貼上時損失的表格/程式碼區塊格式）。
      彙整前不據此修改任何規格文件。

Status: Historical / Superseded
此文件是規格定稿前的一份審查意見，不代表目前實作，內容已由
docs/platform-integration-review-consolidation.md 彙整、
docs/platform-integration-spec-v1.md（S1-S39，唯一權威）吸收定案。
目前狀態請參考：AI_CONTEXT/CURRENT_STATE.md 與 docs/platform-integration-spec-v1.md。
-->

# Architecture Review — Jonaminz Platform Integration v1

審查者：Claude（Anthropic）
日期：2026-07-10
對象：Jonaminz Platform Integration v1 RFC（frozen 2026-07-10）

---

## 總評

整體哲學是對的：Contract 只做自我聲明、一切授權歸 Integration Settings、方法簽名等真實 caller 出現才凍結——這三條在十年尺度下都站得住。三層切分也大致合理。

但有兩個結構性問題，我認為必須在 Spec v1.0 凍結前修正：

1. **合約收取應該用拉（pull），不是推（push）。** Q12 的威脅模型假設有洞（見 F2）。
2. **跨源的使用者身份與授權模型完全沒出現在 RFC 裡，而它才是這個平台最深、最危險的凍結層**（見 F1）。Health / File / Calendar / Profile 是個人資料，SDK 又要跑在 10–15 個不同 origin 的頁面上——這個問題不先定案，Platform API 的其他凍結都是空中樓閣。

以下發現依嚴重度排列。

---

## 架構級發現

### F1.（新增）跨源身份與授權模型缺席，是全 RFC 最大的洞

**問題：** RFC 定義了「專案能不能用某能力」（Settings 決定 capability grant），但完全沒定義「瀏覽器裡的這個人是誰、SDK 憑什麼代表他呼叫 Health / File / Calendar」。你的 Services 清單裡有健康資料與個人檔案，而 SDK 跑在多個不同 origin（GitHub Pages 專案可能分屬不同 repo 甚至不同網域）。

**為什麼會變成問題：**

- 第三方 cookie 在現代瀏覽器已死。如果打算用 cookie session，跨 origin 的 `fetch(worker, {credentials})` 在 Safari/Chrome 的分區政策下會直接失效或行為不一致。
- 如果改用 token，token 放哪裡、怎麼跨 15 個 origin 發放、生命週期多長，全部是介面層決策——一旦外部專案開始寫 `Jonaminz.health.xxx()`，這套模型就被凍結了。
- 安全爆炸半徑：任何一個 hobby app 出現 XSS，攻擊者就拿到該 origin 上 SDK 的全部已授權能力。capability 按專案細分（例如只有主站拿得到 health）是唯一有效的隔離手段，這必須是 Settings 的一級概念，且 Worker 端必須逐請求驗證「此 origin + 此使用者 + 此能力」三元組，而不是只驗專案。

**什麼情況下發生：** 第一個真的碰個人資料的 API 上線那天。

**改善方案：** 在 Spec v1.0 裡新增一節「Identity & Session」。就算 v1 的答案是「只有 jonaminz.com 主站有登入態，外部專案一律匿名、只能拿到非個人化能力」，也要白紙黑字凍結這條規則。這是合法且符合兩人尺度的答案，但必須是明示的決定，不是空白。

**相容性影響：** 現在定，零成本；之後定，等於重寫 Platform API 的呼叫語意。

---

### F2.（Q12）推模式的威脅模型假設有洞；建議整個改回拉模式

**問題：** 「偽造者最多塞進一份不被採信的合約副本，上架與授權只看 Settings，所以無害」——這個假設不成立，因為 **Contract 的內容在實務上是被信任的**。Settings 只說「entry X enabled、放在導覽列」，但 X 的標題、URL、icon 來自 Contract。如果偽造者能覆寫平台端儲存的某個合法 projectId 的合約副本，他就控制了 Jonaminz Shell 導覽列上那個連結的顯示文字和目的地。授權來自 Settings，**內容卻來自攻擊者**。這是釣魚向量，也會污染 Search 索引。

Origin header 對 curl 是自由填寫的欄位，你自己也點出來了；在推模式下沒有任何廉價方法能補這個洞（first-party 靜態站塞 shared secret 也是公開的）。

**改善方案：** 回到你前身系統的模式——**由 Worker 主動向 Settings 登記的網域拉取** `contract.json`（排程 + on-demand）。Worker 自己發起的 outbound fetch 不存在 Origin 偽造問題，整類威脅直接消失。如果想要即時性，SDK 的「回報」降級為**刷新提示**（"請重拉我"，不夾帶任何合約內容），Worker 收到提示後仍然只從登記網域拉。

**相容性影響：** 你自己說前身就是 manifest 拉取、目前無正式專案接入——現在改，成本接近零；v1 凍結成推模式後再改，就是 breaking change。順帶解掉 Q12 全部問題與 F6 的一半。

---

### F3.（Q1）最深的凍結層是「物件定址方案」，不是任何 API

**問題：** Pin、Relationship、Search 都會把「對某專案某物件的引用」**寫進 Supabase 持久化**。這個引用的形狀——大概是 `(projectId, objectType, objectId)` 或一條 URL——一旦有第一筆 pin 資料落地，就永遠改不動了。API 改了可以出 `@2`；**資料裡的外鍵改了要跑 migration**。RFC 目前完全沒定義它。

**必須現在凍結的規則：**

- `projectId` 永久不可變、不可重用；顯示名稱另立欄位。命名規則（字元集、大小寫敏感性、長度上限）現在定。
- `objectId` 由專案自己給、對平台是不透明字串、專案必須保證其穩定（不是資料庫自增序號那種會因重建而變的東西）。
- `objectType` 名稱一經使用不得改語義；要改就出新 type。
- objectRef → URL 的解析責任歸屬（我建議：Contract 聲明每個 type 的 URL template，平台端解析）。

**什麼情況下發生：** 第一次改某個專案的資料模型或搬遷 repo 時。

**相容性影響：** 現在定是一頁規則；三年後定是全表 migration。

---

### F4.（Q1）Contract 與 Settings 的 schema 演化規則本身就是凍結層

**問題：** 「SDK 向下相容所有歷史 Contract」只有在演化規則先定好時才可能。缺了三條就做不到：

1. Contract 頂層必須有 `contractVersion`（或等價欄位），v1 就要有，不能之後補。
2. **未知欄位必須忽略**（must-ignore），雙向適用：舊 SDK 讀新 Contract、新 SDK 讀舊 Contract。
3. 已發布欄位**永不改語義、永不改型別**；要變就加新欄位。

同一套規則原封不動適用於 Settings 文件（對應 Q8）。

**相容性影響：** 這是零行程式碼、純規則的凍結，不做的代價是十年後每次 schema 變更都要人腦排查 15 個專案。

---

### F5.（Q1）CSS token 名稱是會被 15 個專案硬編碼的公開 API

**問題：** `tokens` 等級意味外部專案的 CSS 裡直接寫死 `var(--jz-xxx)`。token 名稱從第一個專案採用那天起就是凍結介面，但 RFC 只凍結了「等級清單」，沒凍結命名。

**改善方案：** v1 凍結三件事：前綴（如 `--jz-`）、命名文法（語義命名而非外觀命名：`--jz-surface` 而非 `--jz-gray-100`）、以及「token 只增不刪、可貶值不可移除」政策。token 的**值**隨主題自由變，**名**永不變。

**相容性影響：** 不做的話，第一次改版主題就會同時弄壞所有 `tokens` 等級的專案。

---

### F6.（Q6）根目錄探索在 GitHub Pages 上直接失效

**問題：** GitHub Pages 的 project pages 部署在 `username.github.io/repo-name/` 子路徑。多個專案共用同一個 origin 時，`/jonaminz.contract.json` 只有一個，根目錄約定當場破產。這不是十年後的問題，是你現在的部署形態就會踩到的問題。

**改善方案（配合 F2 的拉模式）：** Contract 的**權威 URL 登記在 Settings**——反正 Settings 已經是每個專案的註冊處，多一個欄位而已，Worker 拉取時直接用。SDK 端如需自知合約位置，用 script tag 屬性 `<script src="…" data-contract="/repo-name/jonaminz.contract.json">`，預設值退回 origin 根目錄。

**明確否決：** HTML meta（引入 DOM 解析時序依賴）與 HTTP header（GitHub Pages 根本設不了自訂 header）。十年尺度下，探索機制要的是**一種**可靠做法，不是可擴充清單。

---

### F7.（Q9）投 B：reject + 固定錯誤碼

**理由（不對稱性是關鍵）：**

- 選 A 時，呼叫端**忘記檢查** `.ok` → 靜默地拿著 undefined 繼續跑，錯誤在下游以莫名其妙的形式出現。選 B 時，忘記處理 → `unhandledrejection` 在 console 大聲報錯，附完整 stack。一人維護十年，**吵的失敗永遠好過安靜的失敗**。
- B 是 Promise 生態的慣例，與 `try/catch`、`Promise.all`、未來若引入的 TypeScript/linter 全部自然組合。A 是 `fetch()` 式設計，而 fetch 的「404 不 reject」被公認是十年遺憾。
- B 順帶強制一條好紀律：**空結果不是錯誤**（搜尋無結果 → resolve 空陣列），reject 只留給真正的失敗。A 模式容易讓兩者混在 `ok:false` 裡。

**要一起凍結的形狀：** `JonaminzError { code, message, service, retriable }`；錯誤碼註冊表規則——碼永不重用、呼叫端必須容忍未知碼（fallback 到通用處理）。碼的清單可以長大，形狀不能變。

---

### F8.（Q10）凍結 array-push command queue 作為保證路徑；Promise 作為糖

**推理鏈：**

- SDK script 必須 `async/defer` 載入——同步阻塞式 `<script>` 意味 jonaminz.com 一掛，15 個站全部白屏等 timeout，直接違反「失敗不得破壞宿主頁面」。
- 一旦 async，`window.Jonaminz` 在宿主程式碼執行時**可能還不存在**，所以裸 Promise（`Jonaminz.ready`）有 race；裸 DOM event 更糟（監聽晚於事件就永遠等不到，還得補 flag 檢查）。
- 唯一同時解決「async 載入」「呼叫時機任意」「無 build pipeline」的模式，是 Google 用了二十年的 array-push queue：

```html
<script>window.jonaminzQ = window.jonaminzQ || [];</script>
<script async src="https://jonaminz.com/sdk/jonaminz-entry.js"></script>
<script>jonaminzQ.push(api => { /* 這裡保證拿到就緒的 api */ });</script>
```

SDK 載入後把 `jonaminzQ` 換成「push 即執行」的物件並重放積壓項目。凍結的只有兩行約定（陣列名 + callback 收 `api`），十年不動。SDK 就緒後再掛 `window.Jonaminz.ready`（resolved Promise）作為現代寫法的糖——糖可以加，保證路徑只有 queue 一條。

**相容性影響：** 這是外部專案每天寫的那一行，v1 凍結後不可再換；三個候選裡只有 queue 在所有載入時序下都正確。

---

### F9.（Q11）把「常青 URL」和「常青程式碼」拆開：loader + 版本指標

**問題：** 常青單一 URL 的定義就是「一次壞部署同時打中所有站」。「失敗不得破壞宿主頁面」只保護宿主不白屏，不保護平台功能本身全滅、也不給你回滾手段。另外常青 URL 有 cache 兩難：TTL 長→部署生效慢且無法緊急回滾，TTL 短→每頁載入都回源。

**改善方案（一人尺度下值得的最小保護）：**

- `jonaminz-entry.js` 降級為**幾十行、幾乎永不改動的 loader**，它向 Worker 要一個版本指標（短 TTL），再載入 `sdk-<hash>.js`（immutable、長 cache）。
- 回滾 = 改一個指標值，15 個站下一次載頁即恢復。**這同時就是 kill-switch**（指標指向 no-op 版本）和**金絲雀**（Settings 裡讓自己最常用的一個專案吃 `next` channel，其餘吃 `stable`——一個欄位的事）。
- **回滾語意釐清（RFC 該寫明）**：「可以安全回滾」指的是 *SDK 版本指標回滾*。Contract 回滾是各 app 自己 repo 的 Git 事務；Settings 回滾是 Settings repo 的 Git revert——三者是三個獨立機制，混在一句話裡十年後會吵架。

**相容性影響：** loader 間接層必須 day one 就在，因為 entry URL 一旦被 15 個站引用就換不掉了。

---

### F10.（Q5）「後端不可達時的降級語意」必須現在定案

**問題：** Lifecycle 六步裡有兩步依賴 Worker（回報、取 Settings）。Worker 掛掉時 SDK 行為是什麼？這決定了「平台故障日，15 個站是全部裸奔（無 header/theme），還是照常運作」——這是產品層級的凍結決策，不是實作細節。

**建議：** 定為「**最後已知 Settings 版本的快取（localStorage）優先，無快取則降級為 none 整合**」，並定義快取 TTL 與失效機制（Settings 改了，各站多久生效？建議 ETag + 短 TTL）。順帶回答了 Q8 的快取語意。

---

## 建議級發現

### F11.（Q3）補一條邊界規則：Services 無 DOM，UI 一律歸 Shell

三層切分本身成立，但 Notification（badge）、Pin（按鈕）、Search（框）都是天然帶 UI 的服務——不立規則，十年後 Services 各自長出 DOM，Shell/Services 的耦合會從縫裡長回來。規則一句話：**Services 是 headless capability API，任何像素都由 Shell（或宿主專案自己）渲染。** 另外，物件定址那層（F3）值得在三層之外明名為第四個東西（"Data Contracts"），因為它比三層中任何一層都凍得更死。

### F12.（Q4）兩個潛在滲漏點，明文封掉

（a）Contract 的 CSS 等級聲明是「我能消化到哪級」，實際生效等級 = `min(contract 聲明, settings 授予)`——這條公式寫進 spec，否則聲明會慢慢被當成授權用。（b）Entries 不得含 `order` / `weight` / `position` 這類欄位——它們是 placement 穿著自我聲明的外衣。icon、title 可以（自我描述）；排序不行（版面決策）。

### F13.（Q5）Lifecycle 其餘缺口

冪等守衛（script 被載兩次 / SPA 重入時 no-op）；SPA 路由切換時 SDK 的行為要有一句話定義（哪怕是「v1 只支援整頁載入語意」）；一個可讀的 `Jonaminz.status` 診斷面（init 到哪一步、失敗原因），一人維運時這是你唯一的遠端可觀測性。

### F14.（Q7）連 11 個名字都別提前凍結

「名稱先凍、方法晚凍」方向正確，但一口氣凍 11 個 Service 名字是在名稱層重犯「無 caller 先設計」——Search vs Query、Notification vs Inbox 這種領域切法，沒有真實使用案例前你並不知道。建議只凍**機制**：namespace 文法、`name@version` 規則、「名稱一經發布永不重用於不同語義」。名字隨第一個方法一起發布。已凍結的 Promise 模型、錯誤模型、capability version 機制留著，那些才是真正跨服務的不變量。

### F15.（Q8）抽象足夠，補三件小事

（a）Settings 一律經 Worker 端點供應，SDK 永不看到 raw.githubusercontent 之類的 Git 衍生 URL——那才是抽象真正會漏的地方；（b）Settings 文件本身要有 schema version + must-ignore（同 F4）；（c）記一筆：Git → DB 時你會失去免費的變更歷史與 revert，遷移日請帶上 audit log 的替代方案。

### F16.（新增）Supabase 裡是個人資料，資料可攜性是十年承諾的一部分

健康、行事曆、檔案中繼資料會活得比任何託管商的定價方案久。規則：schema 保持平庸可攜（無廠商特有型別）、定期匯出、Worker 是唯一資料出入口（RLS 之外不讓任何 client 直連）。這不影響介面，但影響「十年」二字的可信度。

### F17.（Q2）CSS 的 `components` / `full` 建議改標「可能永遠不做」

在無 build pipeline、跨獨立部署的前提下，元件級 CSS 整合是債務磁鐵。留在路線圖上會產生「總有一天要做」的心理負債；改標為「除非出現具體且反覆的需求，否則不做」，比較誠實。`self` 保留（它其實是 `none` 的別名語義，成本為零）。

---

## 問題編號對照

| 問題 | 對應發現 | 一句話結論 |
|---|---|---|
| 1 | F3, F4, F5 | 真正的凍結層：物件定址、schema 演化規則、CSS token 名 |
| 2 | F9, F17 | 常青單體 SDK 與 components/full 路線圖 |
| 3 | F11 | 切分成立；補「Services 無 DOM」規則與 Data Contracts 第四層 |
| 4 | F12 | CSS 等級取 min；entries 禁排序欄位 |
| 5 | F10, F13 | 最大缺口是降級語意；其次冪等/SPA/診斷 |
| 6 | F6 | 根目錄約定在 GH Pages 破產；Settings 登記 URL + script 屬性 |
| 7 | F14 | 策略對，但名字也晚凍 |
| 8 | F15 | 抽象夠；一律過 Worker、schema versioning |
| 9 | F7 | **B（reject）**，附凍結錯誤形狀 |
| 10 | F8 | **array-push queue** 為保證路徑，Promise 為糖 |
| 11 | F9 | loader + 版本指標 = 回滾/kill-switch/金絲雀三合一 |
| 12 | F2 | 假設有洞（內容被信任）；改拉模式，整類威脅消失 |
| 新增 | F1, F16 | 跨源身份模型缺席（最大洞）；資料可攜 |

---

## 補充（同日後續討論，修正 F2 立場）

可以啊，推模式不是不能救——我在 F2 反對的其實不是「推」這個動作，而是「推來的內容直接被採信」。你說的「主頁選擇要不要開通」如果只是專案層級的開關，那擋不住我講的那個洞：攻擊者不需要上架新專案，他只要對一個已開通的 projectId 推一份假合約，你導覽列上那個 entry 的標題和連結就被換掉了。開通狀態沒變，內容變了。

但把你的「開通」往下推一層，推模式就成立了：

**開通作用在「合約版本」上，不只是專案上。** 流程變成：SDK 推合約 → Worker 收下，算 hash，放進 pending → 你在主頁看到「某專案有新版合約（diff 顯示改了哪些 entry/object）」→ 點一下核准 → Shell 從此只渲染已核准的那份快照。偽造者推一萬份，全部堆在 pending 等你冷笑，永遠碰不到線上內容。你的「開通」從管理功能升級成安全機制本身，而且免費送你一份合約變更的 audit trail。

代價是每次改合約要點一下。以你的尺度——10-15 個自己寫的 app、合約改動頻率大概是「幾個月一次」——這個摩擦小到可以忽略，而且推的人和核准的人都是你自己。

另外兩個不管選什麼都建議加的廉價防線：

1. **Worker 端規則：entry URL 必須與該專案登記網域同源。** 一行驗證，就算哪天核准流程被繞過，連結也指不出去，釣魚向量直接砍掉大半。
2. 只收 Settings 裡已存在的 projectId、限大小、限頻率（你大概本來就會做）。

還有一個備選路線，如果哪天覺得點核准很煩：**改成部署時推，不是瀏覽器推。** GitHub Pages 反正是 git push 部署，加一個十行的 GitHub Action，用 repo secret 帶 token 打 Worker——secret 不在靜態 JS 裡，推送就是可驗證的，帶有效 token 的推可以自動核准。這不算 build pipeline，就是一個 workflow 檔複製貼上。可以跟 pending 機制並存：有 token 自動過，沒 token 進 pending。

**所以結論修正一下：推模式 + 版本級開通 + 同源 URL 規則，我認為在十年尺度下站得住，可以撤回「必須改拉」的建議。** 要凍結的新東西是：合約在平台端有 pending / approved 兩態，以及「Shell 與 Search 永遠只讀 approved 快照」這條規則——這條寫進 spec，別留在腦子裡。
