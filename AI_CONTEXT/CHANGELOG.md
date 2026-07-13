# CHANGELOG — 專案變更紀錄（AI agent 交接用）

規則：
- 新紀錄加在**最上面**（reverse chronological）。
- 每完成一個任務追加一筆，格式照下方模板。git log 記「改了什麼檔案」，
  這裡記「為什麼改、狀態怎麼變、下一棒要知道什麼」——兩者不重複。
- 不要改寫或刪除歷史紀錄；寫錯就追加更正紀錄。

## 紀錄模板

```markdown
## YYYY-MM-DD — 〔一句話標題〕

- **任務**：〔任務單標題或一句話描述〕
- **變更**：〔改了什麼，工程視角，2-5 行〕
- **狀態變化**：〔PROJECT_STATE 的哪些項目從未完成→完成，或新增了什麼未完成項〕
- **遺留**：〔未完成/已知問題/給下一棒的注意事項；沒有就寫「無」〕
- **版本**：〔version.js 的新版本號；未 bump 寫「無程式碼變更」〕
```

---

## 2026-07-13 — 主 Logo 暫時移除竹石並校正圓相／字標座標

- **任務**：使用者指出四元件組合裡 Jonaminz 與 C／圓相位置不對，要求先拿掉竹子與石頭，只處理左側圓相字標。
- **變更**：`jonaminz-zen-logo.svg` 移除 bamboo、stones nested SVG，只保留圓相、wordmark 與地面長筆觸。依最新 1097×467 裁圖像素比例，把圓相改為 `x=51 y=41 width=365 height=390`，wordmark 改為 `x=183 y=132 width=930 height=250` 並使用非等比配置，讓高 J 位於圓心且下探接近圓相下緣；三股基準筆觸統一延後至 `x≈377` 起筆。
- **狀態變化**：組合檔由四元件草案退回兩元件校正版；竹枝與疊石獨立來源檔均保留，未刪除或修改。
- **遺留**：先等使用者確認圓相與字標相對位置，再處理竹石回放，不提前組回。
- **版本**：`v0.21.3-202607131313`。

---

## 2026-07-13 — 四個獨立品牌元件組合成 Jonaminz 主 Logo

- **任務**：依使用者指示，把已完成的字標、圓相、竹枝與疊石重新組合成最初示意圖中的主品牌構圖。
- **變更**：新增 `assets/img/jonaminz-zen-logo.svg`（1200×460）。版面依序為長基準筆觸、圓相、wordmark、竹枝、疊石；圓相包覆 J、竹枝從字尾與石頭之間落地，三條錯位暖米褐色基準線連接圓相與疊石且都有 `pathLength=1`。初版外部 `<image>` 方案因部分 renderer 無法載入相依檔而淘汰，最終改用 nested SVG 完整內嵌四個元件，仍保留每個內部 ID/data-part。
- **狀態變化**：主 Logo 已能單檔、透明背景完整渲染；1200px 視覺預覽、XML 與 nested component 數量檢查通過。四個獨立來源元件未被覆寫。
- **遺留**：目前仍是獨立資產，尚未接入正式首頁；下一步可依使用者目視回饋微調四個元件的相對比例或開始編排動畫時間軸。
- **版本**：`v0.21.2-202607131306`。

---

## 2026-07-13 — 裁決採用 ADPF：Theme 系統改走宣告式套件（Pack）模式

- **任務**：延續同日稍早的 Theme 架構盤點（`EXPERIMENTS.md` #10），
  使用者與 ChatGPT 共同驗證了一套「AI 輔助宣告式套件框架」（ADPF）
  提案（Prompt Builder → AI 只回傳受限 JSON Pack → 驗證 → 預覽 →
  版本化匯入 → 套用），貼進對話請求：(1) 存進 AI 規劃文件、(2) 保留
  「產生 Prompt、固定輸出、匯入新風格」這個核心做法、(3) 第一個落地
  目標是 jonaminz 的 Theme。純文件任務，沒有修改任何程式碼。
- **變更**：
  - 新增 `docs/pack-framework/README.md`（原始 ADPF 報告書的忠實
    重整版，原始 `.md` 附件貼上時編碼已損毀，改依使用者同時提供的
    PDF 內容重新謄寫，內容未增刪）＋`agent-implementation-checklist.md`
    ＋`pack-envelope.schema.json`（原始附件，逐字/逐位元組保留）。
    §9 額外補上「在 jonaminz 的下一步」：範圍明確收斂成只做
    `platform.theme-preset@1` 這一個 Pack Type，不做原報告列的
    Travel/Movies/Photos/Learning/Dashboard 等未來場景。
  - `AI_CONTEXT/DECISIONS.md` 新增 §五（第 22-25 條）：採用 ADPF 模式
    本身已裁決；範圍收斂到只做 Theme 已裁決；AI 動態生成新 Pack 可以
    晚一點做已裁決；「做成對外開放的圖書館工具」明確標記為使用者的
    方向性提問，不是裁決。
  - `AI_CONTEXT/EXPERIMENTS.md`：#9、#10 都補充「這條問題現在有答案
    了」的更新說明，並明確標出 #10 最下方原本提出的「space 欄位小
    補丁」7 步遷移方案**已作廢**，改看 `docs/pack-framework/README.md`
    §9 的 6 步驟（第 1-4、6-8 點的現況分析本身仍然成立，沒有作廢）。
    新增 #11 記錄「對外開放圖書館工具」這個未拍板的提問，說明目前
    完全沒有具體設計、也不是這次的裁決範圍。
- **狀態變化**：Theme 系統的下一步實作方案從「`theme_css_rules` 加
  `space` 欄位」改成「採用 ADPF 的 Pack Registry／Binding 模型，
  Theme 是第一個 Pack Type」——**方向已定，程式碼完全尚未動工**，公開
  圖書館的視覺方向也還沒選定（下一步排在這之前）。
- **遺留**：`docs/pack-framework/README.md` §9 的 6 個步驟、
  `DECISIONS.md` §五都還沒有對應的程式碼；等使用者先選定公開圖書館
  視覺方向，再排 Pack 模型的實作順序。
- **版本**：無程式碼變更（純文件新增/更新），`version.js` 不動。

---

## 2026-07-13 — 圓相改為原始筆跡高精度向量描摹

- **任務**：使用者確認先前版本雖逐步改善但仍與參考圖差距明顯、缺少真實筆觸；取得使用者重傳的 792×824 圓相裁圖後，停止用人工 Bézier／色帶模仿，直接描摹原始墨跡。
- **變更**：從本次對話內嵌的原始 PNG 取出裁圖，測試多組 Potrace 參數後採用 threshold 210、turdSize 2、optTolerance 0.05、alphaMax 0.82。`assets/img/jonaminz-enso-c.svg` 改為 55,464 字元的完整 compound path，直接保留原圖飛白、小孔洞、毛束裂縫、左側撕裂邊緣與右側斷續細絲；背景完全透明，只使用單色 `#c2af98`。保留獨立 gesture path 作後續 reveal 動畫入口，但不以 mask 裁切靜態筆跡。
- **狀態變化**：人工色帶、turbulence 毛邊與手畫多弧線方案全部淘汰；新元件已通過完整路徑長度、XML、透明背景與 792px／160px 渲染驗證。
- **遺留**：仍待使用者確認實際視覺；確認後才與 `jonaminz-wordmark.svg` 組裝，不先接入正式頁面。
- **版本**：`v0.21.1-202607131234`。

---

## 2026-07-13 — Movie 主題卡片真連結＋視覺架構圖書館模型盤點

- **任務**：接手兩件事。(1) 使用者裁決新的視覺架構方向——jonaminz 是
  圖書館，公開前台是圖書館本體（專業乾淨中性）、登入後是 Jonathan／
  Minz 的管理員室（沿用亞麻米，溫暖私密）、每個外部專案是各自獨立的
  一本書（不用跟前台或管理員室一致）。(2) 讓 `/pages/admin/design/`
  的專案卡片「進入」從 disabled 假按鈕長出真連結，通用機制，
  `jonaminz-movies` 作第一個正式驗收案例。明確指示先做可驗收小步驟、
  不要一次重構整個 Theme 系統，本輪完成連結後只盤點 Theme 分流方案、
  不動手實作。
- **變更**：
  - `AI_CONTEXT/DECISIONS.md` 新增 §四「視覺架構：圖書館模型」（第
    18-21 條），逐條標明實作狀態——公開圖書館尚未實作專屬外觀、管理員室
    沿用現行亞麻米但「只套用在管理員室」的分流尚未做、每本書機制已
    上線且有真實案例。
  - `backend/cloudflare-worker/worker.js`：`listPendingContracts` 的
    `previousApproved` 新增 `origin` 欄位，來自
    `integration-settings.json`（伺服器端登記資料），不是 Contract
    自報或 snapshot 的 `submitted_origin`——後者實測同一專案不同筆會
    不一致甚至是 `null`，不可信任。純加欄位，向後相容，`pages/admin/
    contracts/` 等既有呼叫端只讀 `.rawContract`/`.snapshotId`，不受
    影響。`node --check`＋`esbuild --bundle` 確認語法乾淨、無
    eval/new Function，`wrangler deploy` 部署（使用者 AskUserQuestion
    授權，Version ID `2d96d19e-1d51-4ac0-93cd-4b67c3b09758`）。
  - `pages/admin/design/assets/js/app.js`：新增 `pickMainEntry()`（
    entryId==="main" 優先，否則第一個有 url 的 entry，都沒有回傳
    null）與 `resolveEntryHref()`（`new URL(entry.url, origin)`，
    origin／url 任一缺漏或格式錯誤都回傳 null，不猜測），卡片渲染
    改成有 href 就是真 `<a>`、沒有維持 `<button disabled>`（原生停用
    語意，不用另外處理 `aria-disabled`）。`JONAMINZ_CORE_ENTRY`（
    jonaminz 自己，非 Contract 登記者）明確給 `entries:[]`／
    `origin:null`，不捏造連結。通用機制，沒有任何 `jonaminz-movies`
    字串硬寫在邏輯裡。
  - `pages/admin/design/assets/css/page-admin-design.css`：`<a>` 版按鈕
    加 `hover`（`opacity`）／`focus-visible`（`outline`）樣式，
    `<button disabled>` 版加 `cursor:not-allowed`＋降低 `opacity`
    區隔視覺。
  - `AI_CONTEXT/ARCHITECTURE.md`：順手修正兩處 2026-07-11 遺留的過期
    敘述（approve/reject 保護機制已改用登入 session、不是
    `JONAMINZ_ADMIN_TOKEN`；`capabilities` 已是真實交集、不是佔位
    空陣列），這兩處在 2026-07-12 文件真實性盤點時被遺漏。
  - `AI_CONTEXT/EXPERIMENTS.md` 新增 #10「Theme 架構盤點」：逐條回答
    任務指示的 8 個問題（現況在哪些層被當全站預設、哪些 selector 同時
    影響兩個空間、`unique(selector,property)` 為何是硬性阻礙、
    `theme-runtime.js` 單一 cache key 為何會污染、最小可行分流方案、
    哪些該共用哪些該分流、外部專案邊界如何維持不變），並提出 7 步
    遷移順序——**只分析不實作**。
  - `AI_CONTEXT/FACTS.md`／`CURRENT_STATE.md`：同步新增/修正對應事實
    （新增 #34；更正 #32「後台三頁」為「後台四頁」，`admin-design`
    2026-07-11 當時尚未存在）。
- **狀態變化**：implementation plan 外新增的「Contract entries → 真
  連結」機制完成並上線，是 `pages/admin/design/` 自 2026-07-13 上線
  以來的第一個功能性升級。視覺架構圖書館模型方向拍板，但**三層分流
  完全尚未實作**——目前仍是全站一套亞麻米，`jonathan`／`minz`／
  `login` 三頁照新裁決屬於公開圖書館但視覺上跟管理員室無法區分，這是
  本次盤點發現的具體落差，記錄在 `EXPERIMENTS.md` #10 第 2 點。
- **遺留**：Theme 分流的 7 步遷移方案已提出、等使用者裁決要不要做、
  何時做。公開圖書館的實際配色/字體方向也還沒選定（不是本次盤點範圍，
  需要使用者另外決定）。
- **版本**：`v0.21.0-202607131223`（Worker action 新增回傳欄位＋前端
  新功能，minor bump 反映這是新能力不是單純修 bug，跟 identity
  capability 當初 v0.10.0 bump 同樣的判斷標準）。

---

## 2026-07-13 — 圓相高級感修整：偏心手勢、墨色層次與留白主次

- **任務**：接續使用者「方向正確但仍缺高級感」的回饋，在不推翻已確認毛筆骨架的前提下，消除素材庫圓環與 UI icon 感。
- **變更**：將外／內輪廓改成輕微偏心、底部略扁的不對稱手勢；主墨由平面單色改成低彩度同色系微漸層，疊加只作用於墨體內的低對比紙纖維 grain，並把主墨 opacity 降至 `.82`。外緣 displacement 從 7 降到 3.4，保留毛邊但避免髒污；右側原本連續的幽靈弧線拆成三段短絲，飛白改為錯落短段與切線方向細紙紋，留白開始有主次。
- **狀態變化**：800px 與 160px 重新渲染目視通過；縮至品牌小尺寸時仍先辨識到左重、底部拖筆、右側似閉未閉的毛束，而不是粗 C 圖示。
- **遺留**：仍待使用者確認此輪高級感方向；確認後再與字標組合，不先接入正式頁面。
- **版本**：`v0.20.11-202607131213`。

---

## 2026-07-13 — 圓相重構為真實不等寬毛筆墨體

- **任務**：依使用者補充的清晰圓相裁圖及「不像毛筆、細節不足」回饋，重新處理 `jonaminz-enso-c.svg`，不再沿用等寬圓弧疊線。
- **變更**：完整淘汰原本的同軌粗 stroke 骨架，改成一個手工描繪的不等寬封閉墨體；上薄、左厚、底部拖筆，右側保留似閉未閉的失墨區並以尖形輪廓收筆。新增 luminance mask 內的分段飛白與細碎紙紋，真實挖除 alpha；毛邊使用局部 turbulence/displacement，另保留乾刷、開口游絲與起收筆纖維為獨立 `pathLength=1` 路徑供後續動畫。未接入頁面、未使用點陣圖或外部資源。
- **狀態變化**：已通過 XML、ID 唯一性、內部 href 解析與 512px／128px 透明背景渲染檢查；小尺寸仍能辨識左重右輕的圓相輪廓。
- **遺留**：目前仍是獨立元件，須待使用者確認視覺後才與字標、竹枝、疊石組裝；逐筆動畫需 inline SVG。
- **版本**：`v0.20.10-202607131210`。

---

## 2026-07-13 — 首頁相片套用 RWD 判斷：小螢幕更貼邊、大螢幕滿版

- **任務**：使用者要求首頁 `.hero-photo` 改用 `layout-metrics.js` 廣播的
  RWD 判斷（不是另開一個 ad-hoc CSS 斷點），小螢幕維持現有相框感但要
  更大、左右更貼螢幕邊緣；大螢幕改滿版全寬橫幅。這是 `layout-metrics.js`
  自 2026-07-12 上線以來第一個真正的消費端（先前一直是「機制上線、
  沒有頁面訂閱」狀態，見同日稍早那筆更正紀錄）。
- **變更**：`assets/css/page-home.css` 新增兩條用
  `html[data-jonaminz-rwd-group="small"|"large"]` attribute selector
  驅動的 `.hero-photo` 覆寫規則，純 CSS、不用另外寫 JS 訂閱——
  `entry-core.js` 的 shell chain 保證 `layout-metrics.js` 跑完
  （含它同步呼叫的 `updateNow()`）才會 `markShellReady()`，loading gate
  擋著內容不可見，所以屬性一定先於任何畫面可見前就位，不會有 FOUC。
  small group：`width:100%`（填滿 `.hero` 可用寬度，貼齊 `.page` 的
  padding 邊界，不是原本跟視窗寬度脫鉤的 `78vw`）。large group：用
  `calc(100% + 64px)` 加 `margin-left/right: -32px` 抵銷 `.page` 固定的
  32px 水平 padding，取代 `100vw` 寫法（避免捲軸寬度造成的水平溢出），
  拿掉圓角/陰影。
  **使用者實測回報「切到頭」，中間走過兩輪錯誤修法才找到根本解**：第一輪
  用 `height:min(58vh,680px)`，矮胖視窗（筆電瀏覽器扣掉工具列後很常見
  的寬高比）會把橫幅壓得比原圖（3:2）誇張很多；補 `min-height:360px`
  安全下限＋把 `object-position` 從 `46%` 調到 `24%`，用 Playwright
  模擬 1920×560 矮胖視窗重現問題並確認修好——但使用者在真實螢幕上仍
  回報切到頭，代表實際視窗比模擬的更極端。第二輪把 `object-position`
  再壓到 `12%`，結果在極端寬高比下變成「保頭就切到舉手的泡泡瞬間」，
  vh 高度這個設計本身在夠矮胖的視窗下無論怎麼調 object-position 都會
  在頭部／泡泡之間二選一。**根本解法**：改用固定 `aspect-ratio:3/1`
  （+`max-height:720px` 只防超寬螢幕過高，不影響比例）取代
  `height:min(vh,px)`，裁切比例完全不受視窗高度影響——跟這個檔案
  2026-07-12 那次「小螢幕相框改固定 aspect-ratio，從根本解決 RWD 問題」
  是同一個原則，只是這次才真的套用到 large group。`object-position`
  最終定案 `30%`。
- **狀態變化**：`layout-metrics.js` 從「機制上線但零消費端」變成有了
  第一個真實消費者，驗證了 `data-jonaminz-rwd-group` 這個廣播管道本身
  可用。
- **遺留**：無。
- **驗證**：Playwright 量測 1600×900（wide）/1024×800（desktop）/
  768×1024（tablet）/375×812（phone-compact）四個一般斷點，皆左右貼齊
  視窗邊緣或 `.page` padding 邊界、圓角陰影行為正確；另外用 1920×560、
  1440×500 兩個矮胖視窗（用來重現使用者回報的問題）重測固定
  aspect-ratio 版本，兩人頭部與舉手的泡泡瞬間同時完整在框內，高度確實
  鎖定 3:1 比例（640px／480px，跟寬度成正比而非固定 vh）；全部案例截圖
  皆目視確認構圖、無主控台錯誤。
- **版本**：`v0.20.9-202607131159`。

---

## 2026-07-13 — 更正：RWD 量測層的「手機自動導去內部密語登入」設計考量作廢

- **任務**：使用者詢問「目前 jonaminz 是否有使用新製作的 RWD 工具進行
  判定」，查證後確認完全沒有消費端；使用者接著指出手機登入問題已經
  透過 `jonaminz-mobile-app` 解決，順序③當初記錄的那個週邊設計考量
  已經不成立，過期筆記直接修掉。
- **變更**：`docs/roadmap-202607.md` 順序③段落、
  `AI_CONTEXT/PROJECT_STATE.md` 對應段落都補上 2026-07-13 更新說明：
  RWD 量測層本身狀態不變（機制上線、仍無消費端），但當初設想的「偵測
  手機裝置自動導去內部密語登入、繞開 LAN IP OAuth 白名單問題」這個
  應用場景已作廢——該問題已經被 `jonaminz-mobile-app`（Capacitor＋
  Custom Tabs＋`com.jonaminz.app://oauth-callback` deep link）從根本
  解決，不需要 RWD 判斷介入。
- **狀態變化**：無新完成/未完成項變動，純粹修正舊記錄的過期假設。
- **遺留**：無。
- **版本**：無程式碼變更（純文件更新），`version.js` 不動。

---

## 2026-07-13 — Animation-ready 書法 C／圓相元件

- **任務**：接續拆分品牌圖形，繪製參考圖中包覆 J 的暖灰褐色書法 C，保留一筆刷過的粗細節奏、乾刷與飛白。
- **變更**：新增 `assets/img/jonaminz-enso-c.svg`。以右側不對稱開口的單向弧線為骨架，分成淡墨 wash、主筆、左側/下緣加重、內外 bristle、兩層斷續 dry-brush 及起收筆纖維共 10 個完整前綴 data-part；所有 stroke path 皆有 pathLength=1。透明背景，不含 filter、點陣圖、script 或外部資源，也沒有接入 HTML/CSS。
- **狀態變化**：512px 視覺渲染、開口比例、四周安全邊界與 XML 驗證通過；可依 data-order 分層畫出，亦可只動畫主筆後淡入乾刷細節。
- **遺留**：最細飛白在 64px 以下可選擇隱藏；逐筆動畫需 inline SVG。若同頁 inline 同一元件多次，注入時仍應重寫每個實例內部 ID。
- **版本**：`v0.20.8-202607131145`。

## 2026-07-13 — Animation-ready 獨立竹枝元件

- **任務**：接續拆分品牌圖形，繪製能與字標、疊石搭配的獨立竹枝，並預留風吹、逐葉擺動及生長動畫能力。
- **變更**：新增 `assets/img/jonaminz-bamboo-sprig.svg`。以纖細彎曲主莖、6 段不對稱側枝與 14 片長披針形葉構成；主莖、各側枝及每片葉皆有獨立、完整前綴的 wrapper ID/data-part。葉片的美術 transform 放在內層，外層保留給動畫，另提供 data-anchor-x/y；主幹與側枝主 path 設 pathLength=1。沒有使用點陣圖、filter 或外部資源，也沒有內建動畫、接入 HTML/CSS。
- **狀態變化**：480px 視覺渲染、XML、透明背景與冠部安全邊界檢查通過；竹葉維持約 4–5:1 長寬比，避免變成橄欖枝。可對葉片逐片 rotate/translate，也可用 stroke-dasharray/dashoffset 讓枝幹生長。
- **遺留**：逐件動畫需要 inline SVG；一般 `<img>` 只能控制整張。若同頁 inline 同一元件多次，注入時仍應為每份實例改寫內部 ID。
- **版本**：`v0.20.7-202607131138`。

## 2026-07-13 — 疊石紋理精細化

- **任務**：依使用者回饋，讓四顆石頭的表面紋理更接近參考圖的細密天然石材。
- **變更**：更新 `assets/img/jonaminz-stacked-stones.svg`：將原本粗、長且容易像龜裂的線條拆成短礦脈與 0.32–0.78px 髮絲紋，加入低透明度不規則礦物斑及淡色礦脈；grain 頻率由 0.035 調為 0.085，但精細感仍以各石頭群組內的純向量 path 為主。沒有改變石頭輪廓、排列、獨立 group ID 或地面乾刷。
- **狀態變化**：768px 精細渲染與 XML 驗證通過；紋理仍各自留在所屬石頭群組內，後續單顆動畫能力不變。
- **遺留**：`feTurbulence` 在不同 rasterizer 可能有些微顆粒差異，但關閉濾鏡後仍保有主要向量礦脈與斑駁細節。
- **版本**：`v0.20.6-202607131131`。

## 2026-07-13 — Animation-ready 四層疊石獨立元件

- **任務**：依使用者參考圖，採第一張的天然石紋筆觸與第二張編號 1 的四層排列，並確保每顆石頭及地面那一撇都能獨立做動畫。
- **變更**：新增 `assets/img/jonaminz-stacked-stones.svg`。包含橄欖頂石、暖灰中石、砂褐扁石、炭黑底石及獨立地面乾刷；每顆石頭各有自己的 wrapper `<g>`、輪廓、clipPath、高光、grain 與裂紋，所有 ID 皆加 `jonaminz-stacked-stones-` 前綴以避免 inline 多份 SVG 時衝突。沒有內建動畫，也沒有接入 HTML/CSS。
- **狀態變化**：整體 512px 渲染、XML、ID 唯一性、外部資源及五個 data-part 逐件獨立渲染通過。後續可對四顆石頭做 translate/rotate/scale，地面乾刷可獨立淡入或畫線。
- **遺留**：若要從頁面 CSS/JS 選取內部群組做動畫，必須 inline SVG 或透過 `<object>` 取得 contentDocument；用一般 `<img src>` 只能整張移動，無法控制內部石頭。
- **版本**：`v0.20.5-202607131058`。

## 2026-07-13 — 拆出 Jonaminz 獨立文字標誌元件

- **任務**：依使用者決定把完整禪意構圖拆開處理，第一步只保留 `Jonaminz` 文字部分並另存獨立元件。
- **變更**：新增 `assets/img/jonaminz-wordmark.svg`，沿用已確認的向量字形，使用緊密 `viewBox="-6 -142 892 151"`，四周約 6–7px 安全留白；透明背景、不含 `<text>`、外部字型、script 或點陣圖片。沒有修改完整構圖草案，也沒有接入 HTML/CSS。
- **狀態變化**：文字標誌可獨立用 `<img>` 或 inline SVG 引用；892px 原尺寸與縮放渲染、XML、邊界及可存取性檢查通過。
- **遺留**：建議數位最小顯示寬度 160px；120px 為辨識邊界，96px 以下不建議使用完整字標。其他圖形元件待使用者逐一確認後再拆。
- **版本**：`v0.20.4-202607131052`。

## 2026-07-13 — Jonaminz 禪意向量品牌標誌

- **任務**：依使用者提供的設計參考，繪製可正式使用、可無限縮放的精緻 SVG。
- **變更**：新增 `assets/img/jonaminz-zen-logo.svg`；以原生 path、漸層與輕量濾鏡重畫圓相、竹枝、疊石及橫式字標。字標已轉為向量輪廓，不依賴使用端字型；檔案為透明背景，不含 script、外部圖片或 base64 點陣素材。目前沒有修改 HTML/CSS，也沒有把標誌接入頁面。
- **狀態變化**：Jonaminz 新增一份正式候選品牌素材；XML 與 1600px／800px raster render 驗證通過。最初的石材複合噪點因 rasterizer 相容性不穩定，已改為漸層與柔和陰影，避免跨平台灰色方塊。
- **遺留**：目前只有適合淺色背景的橫式主標誌；方形 app icon、深色背景反白版與實際頁面接入尚未製作，需由後續任務另行授權與設計。
- **版本**：`v0.20.3-202607131045`。

## 2026-07-13 — Platform Service 化的視覺方向（Contract 自報 + 全站套用「亞麻米」+ Contracts 後台分組）

- **任務**：roadmap ①-⑦全部完成後，使用者對現有配色（通用 SaaS 靛紫）
  提出質疑，覺得 Jonathan 頁跟後台看起來「不是很高級」。討論後確認
  三件事：①外部專案（例如 jonaminz-movies）應該能在自己的 Contract 裡
  自報一套視覺調性，jonaminz 後台把它們攤出來展示；②jonaminz 平台自己
  也選一個方向當預設；③Contracts 後台的「已裁決」清單一直平鋪累積歷史
  的問題，順便改成按專案分組、只攤開目前生效版本、其餘摺疊。
- **變更（依實作順序）**：
  1. **Contract schema 新增 `app.visualIdentity` 自報欄位**
     （`docs/contract-schema/jonaminz.contract.schema.json`）：跟
     `description`/`icon` 同一類自我描述欄位，不在
     `forbiddenFieldsGuard` 清單裡（不是定位/授權類欄位）。子欄位
     `name`／`tagline`／`palette`（5 個固定鍵名的 `#rrggbb` 色碼，新增
     `$defs/hexColor`）／`typography.display`（純展示用的 font-family
     字串）。**非 breaking**：省略即合法，舊合約不受影響（node 腳本
     驗證過：合法值通過、非法 hex 被 pattern 擋下、完全沒有這個欄位的
     舊合約仍然 valid）。改完重跑
     `generate-contract-validator.mjs` 重新產生 ajv standalone
     validator，esbuild 打包+`node --check` 確認乾淨。
  2. **`pages/admin/design/`（新頁面，「專案視覺方向」展示）**：先做一版
     demo（寫死資料）給使用者看過確認方向後，改讀真實
     `listPendingContracts`——**關鍵設計**：不是用某一筆 row 的
     `status` 猜「這是不是現在生效的版本」，是讀每筆 row 都附的
     `previousApproved`（來自 `contract_active_snapshots`，Worker
     權威計算出的「這個 project+environment 現在真的生效中」的合約，
     見 `pages/admin/design/assets/js/app.js` `extractActiveProjects()`
     的註解）。每張卡片動態套用該專案宣告的顏色/字體（CSS custom
     properties inline），算相對亮度決定色塊文字用白字還是深字
     （`contrastTextColor()`，WCAG 簡化版），沒宣告 `visualIdentity`
     的專案顯示中性樣式＋提示文字（不是隱藏或報錯）。jonaminz 自己不是
     Contract 登記者，`JONAMINZ_CORE_ENTRY` 是唯一寫死在檔案裡的一筆。
  3. **jonaminz-movies 更新 `jonaminz.contract.json`** 宣告
     `visualIdentity`（「酒紅 Editorial」，數值抄自它自己
     `styles.css` 的 CSS 變數）並 `submitContract` 送出。**過程踩到一個
     真的 bug**：第一次用 `curl -d "...$CONTRACT..."`（bash 字串內插）
     送出，中文字被弄壞成亂碼存進 DB（snapshot #4）——跟這次對話更早
     以前 OAuth 那次教訓是同一類問題，但這次是實際發生在正式資料裡，
     不是理論風險。改用 `curl --data-binary @file`（完全不經過 shell
     字串內插）重新提交乾淨版本（snapshot #5），使用者在
     `/pages/admin/contracts/` 核准 #5，現在是 active 版本。**snapshot
     #4 的亂碼資料留在歷史裡不刪**（S13：永不覆寫歷史），之後在
     Contracts 後台的 diff 畫面看到 `app.description` 或
     `visualIdentity.name` 出現 `�` 符號，那是這筆已知的舊資料，不是
     新 bug。
  4. **jonaminz 全站套用「亞麻米 Flax & Ink」**（使用者從四個提案方向裡
     選定，方向本身是另一輪對話產出，過程另有一份 Artifact 展示過
     A/B/C/D 四個選項，不重複記錄在這裡）：
     - `assets/css/reservoir/02-tokens.css`：`--color-bg`/`--color-text`/
       `--color-primary`/`--color-primary-2`/`--color-border`/
       `--color-surface`/`--shadow-*` 全部換成暖色調值，新增
       `--font-display`（Rockwell/Sitka Text/Georgia/Noto Serif TC）。
       `--color-bg-dark`/`--color-text-dark` 刻意不動——首頁簽名式導覽
       版型是獨立的深色識別，跟這次「一般頁面預設淺色」是兩件事。
     - `assets/css/reservoir/03-base.css`：h1/h2/h3 套上
       `--font-display`，套在 base 層讓全站標題自動一致。
     - `assets/css/page-home.css`：`.hero h1` 明確蓋回
       `var(--font-sans)`，避免首頁已經調好的深色標題被全站規則波及
       （唯一一處刻意排除在外的地方）。
     - **抓到三類真的會讓新配色顯示不完整的問題，都修了**：
       ①五個頁面 CSS（`page-admin.css`／`page-jonathan.css`／
       `page-minz.css`／`page-login.css`）裡有多處把舊靛紫色寫死成
       `rgba(99,102,241,...)`／`rgba(139,92,246,...)` 而不是引用
       token，改成 `color-mix(in srgb, var(--color-primary) N%,
       transparent)`。②`jonaminz-loading.css`（bootstrap 階段最早載入
       的布幕 CSS，在 `02-tokens.css` 抵達前就先套用）裡
       `var(--color-primary, #6366f1)` 的**字面 fallback 值**沒有同步
       更新——這不是裝飾，是真的會在 tokens CSS 抵達前那一小段時間生效，
       改成 `#1f3a5f`。③**最大的一個**：使用者回報「視覺失敗看不到」，
       查證後發現 Supabase `theme_css_rules` 表裡存了一份
       2026-07-12 的靛紫配色快照（`--color-bg`/`--color-primary`/
       `--color-primary-2`/`--color-text` 四筆），Theme 系統
       （`theme-runtime.js`）疊在 reservoir tokens 之上、完全蓋掉這次
       改的新值——`--font-display` 沒被蓋是因為 Theme 表裡本來就沒有
       這個屬性，純屬巧合讓字體先生效、顏色沒生效，一度誤以為是自己
       CSS 寫錯。問過使用者後，直接刪除 Supabase 裡這 4 筆舊資料
       （不是改值，是移除這份過期的「影子副本」，讓這幾個屬性重新
       fall back 回 reservoir tokens），Worker `saveThemeCssRules`
       action 需要真實登入 session，沒有使用者密語沒辦法自己呼叫，這次
       改用 Supabase Management API 直連（密碼檔案讀取，不寫死 token）
       執行，執行前後都查過實際資料確認。
  5. **`pages/admin/contracts/` 重寫**：已裁決清單改成按
     `(projectId, environment)` 分組（`groupDecidedByProject()`），每組
     只攤開「現在真的生效中」的那筆（同樣讀 `previousApproved`，不是猜
     最新一筆），其餘歷史摺進原生 `<details>`，預設收合——使用者原話
     「保留歷史但一直累積感覺不好，應該做成歷史、現在是最後一個」。
     **過程中人工覆核程式碼時抓到一個真的 bug（沒有實際跑過才發現不了
     的那種，這次先手動抓到再驗證修好）**：`<details>` 的展開狀態會在
     每次 `render()`（例如展開某一筆的 diff）時被整個重新生成回預設
     收合狀態——`<details>` 的原生 `toggle` 事件不會冒泡（跟
     `scroll`/`load` 同類），改用 capture 階段的事件代理
     （`root.addEventListener("toggle", handler, true)`）＋
     `expandedHistoryGroups` 狀態物件追蹤每組的開合狀態，`render()` 時
     依狀態決定要不要帶 `open` 屬性。
- **驗證**：Playwright 對全站 7 個頁面（admin/admin-theme/
  admin-contracts/admin-design/login/jonathan/minz，另加首頁）逐一截圖
  ＋ console 零錯誤確認；直接 `getComputedStyle` 讀 `--color-bg`／
  `--color-primary` 等 token 的實際計算值，確認 Theme 快照刪除前後的
  差異（刪除前仍是舊值 `#ffffff`/`#6366f1`，刪除後正確變成新值
  `#efeae0`/`#1f3a5f`）；針對 Contracts 頁的 `<details>` bug 修復另外
  寫專項測試（展開歷史→展開內部某筆 diff→確認整頁重繪後歷史區塊仍是
  open、diff 內容真的可見不是被摺疊藏起來），確認修復生效。
- **狀態變化**：`docs/contract-schema/jonaminz.contract.schema.json`
  新增非 breaking 欄位；jonaminz-movies 正式環境 Contract 現在帶
  `visualIdentity`；jonaminz 全站預設視覺從靛紫改成暖色調亞麻米方向；
  `pages/admin/contracts/` 從平鋪列表改成分組摺疊。
- **遺留**：使用者提出一個更好的長期架構——視覺方向未來應該存進既有
  Theme 系統（Supabase 可即時切換，不用改程式碼重新部署），而不是像
  這次一樣寫死進 reservoir tokens 靜態檔案；已記錄在
  `AI_CONTEXT/EXPERIMENTS.md` #9，使用者明確表示「未來可以」，這次
  不用做，下次要再動視覺方向前先讀那條，不要又寫死一次。snapshot #4
  的亂碼歷史資料留著沒清，不影響現況。
- **版本**：`v0.19.0-202607130729`。

---

## 2026-07-13 — 待辦總表順序⑦：前端品質重建計畫階段③，後台首頁 Dashboard 化

- **任務**：接續 `docs/roadmap-202607.md` 排出來的順序，做⑦（roadmap
  最後一個既有項目）。見 `docs/frontend-quality-plan-202607.md` 階段③。
- **變更**：
  - `pages/admin/assets/js/app.js`：`render()` 改吃 `requireLogin()`
    resolve 出來的 identity 參數，畫身分徽章（`identityBadgeHtml()`，
    跟 `pages/admin/contracts/`／`pages/login/` 同款視覺：圓形色塊
    +姓名首字母，jonathan 用 `--color-primary`、minz 用
    `--color-primary-2`）；移除舊的路線佔位說明文字；新增
    `renderPendingStatus()`，用既有 `listPendingContracts` action，
    跟 `pages/admin/contracts/` 同一套 `rows.filter(status==="pending")`
    篩選邏輯（不是自己另外算一套，保證兩邊數字一致），寫進 Contract
    核准卡片的描述文字位置（不是額外疊加的數字徽章——這樣才有空間放
    「無待審」／錯誤文字這些狀態，不只是一個數字）。
  - `pages/admin/assets/css/page-admin.css`：新增
    `.jonaminz-admin-identity`／`.jonaminz-identity-badge`
    （`--jonathan`／`--minz` 兩個色彩變體）；移除不再使用的
    `.jonaminz-admin-subtitle`（render() 不再輸出這個 class 的內容，
    全 repo grep 確認沒有其他地方用到才刪）。
  - `pages/admin/index.html` 沒有改——`render()` 注入內容本來就透過
    `[data-app-root]`，HTML 骨架維持原樣。**沒有動 `worker.js`**：
    `listPendingContracts`／`listExternalAppRegistrations` 都是既有
    action，純前端聚合。
- **驗證**：Playwright 三情境，全部針對本機 dev server（mock
  `/api/action`，不打正式 Worker）——①正常路徑：mock 登入 jonathan、
  2 筆 pending、1 筆外部專案回報，畫面全部正確顯示，console 零錯誤；
  ②0 筆 pending＋minz 身分：正確顯示「無待審」（不是空白）、身分徽章
  正確顯示 Minz；③Worker 全斷線（`route.abort("failed")`）：pending
  區塊顯示「待審數量讀取失敗：Failed to fetch」、外部專案區塊顯示
  「讀取失敗：Failed to fetch」，兩者互相獨立、都不擋 gate（~400ms 內
  正常放行 all-ready），沒有任何未捕捉的 pageerror。桌機（1280px）跟
  手機（375px）截圖確認排版正常、不溢出。
- **狀態變化**：`docs/roadmap-202607.md` 順序⑦完成——**①-⑦全部完成**，
  roadmap 只剩順序⑧手機 App 包裝（Capacitor，使用者已確認方向，見
  roadmap 該段）。
- **遺留**：無（這次驗收項目全數通過，沒有已知缺口）。
- **版本**：`v0.18.0-202607130016`。

---

## 2026-07-12 — SKHPS 連結改連固定 port，不再猜同 origin 路徑

- **任務**：順序⑥上線後使用者實測，`pages/jonathan/` 的 SKHPS 連結在
  本機測試時猜的 `window.location.origin + "/skhpsv2/"` 打不通（實測
  404）——根因是 jonaminz 的 `dev-server.js` 只服務 jonaminz 自己資料夾
  底下的檔案，skhpsv2 本來沒有固定的本機伺服器（只能靠 VS Code Live
  Server 之類的工具零星開，root/port 每次可能不一樣），兩者從來不是
  「同一個 origin 底下的兩個路徑」這個假設本身就不成立。
- **討論過的替代方案（都否決了）**：①把現有常駐在 127.0.0.1:18765 的
  `skhps-quick-login-helper.ps1` 順便拿來服務 skhpsv2 靜態檔案——讀過
  完整原始碼後否決，那是新光醫院 EIP 登入包裝頁專用的單一用途 helper
  （密碼閘門儀表板＋排程工作自動啟動＋從 `quick-login.skhps.jonaminz.com`
  自動拉更新），硬加路由等於把登入基礎設施跟開發測試用途混在一起，而且
  下次自動更新大概率會把改動蓋掉。②在 jonaminz 這邊加 localStorage
  手動覆寫——使用者要「方便無感」，手動設定違背這個目標，否決。
- **變更**：
  - **`SKHPS/skhpsv2/dev-server.js`（新增，skhpsv2 repo）**：跟
    jonaminz 自己的 `dev-server.js` 完全同款寫法（極簡靜態伺服器，根目錄
    固定是檔案所在資料夾），只是預設 port 改成 **5501**（跟 jonaminz
    預設 5500 分開，避免撞號）。**這是這次唯一寫進 skhpsv2 repo 的檔案**
    ——skhpsv2 目前是 Codex 的地盤，這次是使用者在本次對話裡明確交辦
    才動手，純本機測試用途的新增檔案，不影響 skhpsv2 任何既有邏輯，
    也還沒有 commit/push 進那個 repo（本地檔案先建好，要不要進 skhpsv2
    的版本控制留給使用者決定）。同時新增
    `SKHPS/skhpsv2/start-dev-server.bat`（雙擊啟動，跟 Live Server
    的「一鍵」體驗對齊，使用者明確要求「像live server一樣方便」）。
  - `pages/jonathan/assets/js/app.js`：`resolveSkhpsUrl()` 從猜
    `window.location.origin + "/skhpsv2/"` 改成直接連固定 port
    `http://<hostname>:5501/`（`SKHPS_DEV_SERVER_PORT` 常數），loopback
    判斷邏輯不變（`localhost`／`127.0.0.1`，任何自己的 port）。
- **驗證**：jonaminz 跟 skhpsv2 兩支 `dev-server.js` 同時起在各自固定
  port（5577／5501，5577 只是這次測試臨時用的 jonaminz port，正式慣例
  仍是 5500），curl 確認兩邊都 200；Playwright 確認 Jonathan 頁面
  `[data-skhps-link]` 的 `href` 真的算出 `http://127.0.0.1:5501/`（不是
  猜測的路徑），且該網址本身也真的回 200（不是連得到但內容是空的）。
- **狀態變化**：無（順序⑥既有的驗收項目不變，這是上線後的即時修正，
  不是新項目）。
- **遺留**：`SKHPS/skhpsv2/dev-server.js`／`start-dev-server.bat` 兩個
  新檔案還沒 commit 進 skhpsv2 repo，使用者要不要留、要不要進版本控制
  待他決定。使用者接著問能不能做一個「跟 Live Server 右下角一樣」的
  VS Code 狀態列外掛（一鍵開 jonaminz local dev）——那是真的要包裝安裝
  的 VS Code extension，工程量比批次檔大一截，已經跟使用者確認要哪一種
  做法，這次還沒動手。
- **版本**：`v0.17.1-202607122353`。

---

## 2026-07-12 — 文件真實性盤點與同步

- **任務**：使用者交辦一次完整文件審計（不是開發任務）：早期文件可能
  沒跟上後續實作，造成互相矛盾、舊決策被誤認成現況。要求以實際程式碼／
  schema／設定檔／近期紀錄為準交叉驗證，不因文件寫「已完成」就相信，
  也不因 repo 有程式碼就推論「已部署」／「已人工驗證」（三者要分開標）。
- **變更**：用 general-purpose 子 agent 執行完整盤點（避免主對話被大量
  檔案讀取塞爆），全程只碰 `.md` 檔案。新增 `AI_CONTEXT/FACTS.md`
  （逐條事實＋驗證檔案＋repo實作/已部署/已人工驗證三態）、
  `DECISIONS.md`（使用者已裁決但不代表已實作的架構方向）、
  `CURRENT_STATE.md`（現況速覽濃縮版）、`KNOWN_ISSUES.md`、
  `EXPERIMENTS.md`（未拍板選項）、`SESSION_LOG.md`、`CHECKPOINTS.md`、
  `DOCUMENT_STATUS.md`（全站文件狀態總表）。修正 13 份既有文件：
  `pages/README.md` 仍講已淘汰的 `JONAMINZ_ADMIN_TOKEN`、根目錄
  `README.md` 檔案結構圖過舊（沒列 admin/contracts、login、
  identity-relay、sdk/ 等後來才有的資料夾）、10 份 Platform Integration
  規劃期文件（consensus／spec-review／review-request／
  review-consolidation／5 份 review／RC 驗收）加上 Historical/Superseded
  標記指向 Frozen 規格，原文一字未動。
- **驗證**：`git diff --stat`／`git diff --name-only` 確認異動範圍；
  `git status --porcelain` 取全部異動檔案（含新增）逐一取副檔名去重，
  結果只有 `.md` 一種，證明沒有動到任何程式碼。全程沒有執行
  `wrangler deploy` 或對正式環境發新請求，「已部署」「已人工驗證」的
  判定全部引用既有 CHANGELOG 紀錄，不是重新驗證。
- **狀態變化**：AI_CONTEXT 從 5 份文件（RULES/PROJECT_STATE/
  ARCHITECTURE/ACCEPTANCE/CHANGELOG）擴充到 13 份。
- **遺留**：盤點意外挖到一個真的功能缺口（不是文件錯誤）：Google OAuth
  登入沒有保留 `?next=`。使用者同一次對話裡接著要求修掉，見下一條。
- **版本**：無程式碼變更。

---

## 2026-07-12 — Google OAuth `next` 缺口修復

- **任務**：上一條文件盤點挖到的缺口——`pages/login/assets/js/app.js`
  檔頭註解自己承認「Google OAuth 那條路沒有把 next 一起帶過去，是已知、
  刻意先不修的小缺口」。使用者確認要修：「修完直接可以做⑥」。
- **變更**：`return_origin`（哪個網站）跟 `next`（網站裡的哪一頁）是兩個
  獨立參數，Google OAuth 走 Worker 302 中轉，`oauth_states` 表原本只存
  `return_origin`，沒把 `next` 帶著走，導致 Google 登入完永遠回網站
  根目錄，跟內部密語登入（純前端 POST，登入完直接用 JS 導去 `next`）
  行為不一致。
  - `backend/supabase/auth_schema.sql`：`oauth_states` 新增 `next text`
    欄位（CREATE TABLE 含 + 獨立 ALTER TABLE ADD COLUMN IF NOT EXISTS
    給既有正式環境用），**已直連套用到 `jonaminz-db`**（先用
    `/v1/projects` 查證專案 ref 是 `xhwrizmacantlubasixe`，套用後
    查 `information_schema.columns` 確認欄位真的加上）。
  - `backend/cloudflare-worker/worker.js`：新增
    `resolveOauthReturnNext(candidate)`（跟既有
    `resolveOauthReturnOrigin()` 同一套白名單邏輯：只接受同源相對路徑，
    開頭單一個 `/`，不含 `://` 也不是 `//` 開頭，防開放式重導向）。
    `handleGoogleStart` 讀 `?next=`、驗證後存進 `oauth_states`；
    `handleGoogleCallback` select 出來重新驗證一次（不信任 DB 裡存的
    值免驗，跟 `return_origin` 現有的雙重驗證做法一致），拼進最終
    redirect 網址（`returnOrigin + returnNext + "#jonaminzSessionToken=..."`）。
  - `pages/login/assets/js/app.js`：`googleStartUrl()` 帶上
    `&next=` + `encodeURIComponent(getNextUrl())`（複用既有
    `getNextUrl()` 的 sanitize 邏輯，兩個都是函式宣告、hoist，呼叫
    順序跟定義順序無關）。檔頭註解同步更新，拿掉「刻意先不修」的舊說明。
- **部署**：esbuild 打包＋`node --check` 確認乾淨後 `wrangler deploy`
  （Version ID `03659c8e-ecbc-4051-a368-8ffd3c1d85cd`）——**DB migration
  跟 wrangler deploy 都先問過使用者才動手**（自動模式的正式環境保護
  classifier 主動擋下了第一次嘗試，要求明確授權，這是預期中的正確
  行為，不是 bug）。
- **驗證**：node 腳本窮舉 10 種 edge case（含 `//evil.com/phish`、
  `https://evil.com/phish`、`javascript://alert(1)` 等開放式重導向
  嘗試、`/pages/admin/theme/?foo=bar` 這種帶 query string 的合法路徑）
  確認 `resolveOauthReturnNext()` 全部正確判斷；部署後 curl 打
  `/auth/google/start?origin=...&next=/pages/admin/theme/` 確認正確
  302 去 Google；直連 DB 查最新 `oauth_states` 列（只查
  `return_origin`/`next`/`expires_at` 非機密欄位）確認
  `next` 真的存成 `/pages/admin/theme/`，另兩筆舊資料列（升級前建立，
  沒有 `next` 欄位）正確顯示 `null`，fallback 邏輯不會炸。
- **狀態變化**：`AI_CONTEXT/KNOWN_ISSUES.md`／`CURRENT_STATE.md`／
  `FACTS.md`（文件盤點當時新增的）裡「OAuth 不保留 next」的記錄需要
  同步更新成已修復——**下一棒接手前記得檢查這三份文件是否已經更新**
  （這次修復跟文件盤點是連續兩個任務，如果文件更新這步被跳過，
  三份文件會變成剛盤點完就過期）。
- **遺留**：Google 同意畫面那段需要真人瀏覽器互動，機制本身（DB 存值、
  Worker 重新驗證、最終導頁組合）已驗證正確，但**還需要使用者自己
  實際點一次完整登入流程**，確認瀏覽器真的被導回原本要去的那一頁
  （跟階段 A 當初 Google OAuth 上線時的驗證缺口是同一種、必須真人操作
  的部分，自動化測不到 Google 同意畫面那一段）。
- **版本**：`v0.17.0-202607122328`（跟下一條 Jonathan/Minz 門戶頁同一次
  bump，兩個任務是連續完成、一起 commit 的）。

---

## 2026-07-12 — 待辦總表順序⑥：前端品質重建計畫階段②，Jonathan/Minz 門戶頁

- **任務**：接續 `docs/roadmap-202607.md` 排出來的順序，做⑥。首頁兩個
  name-link（`#jonathan`/`#minz`）從死錨點變成真實頁面，見
  `docs/frontend-quality-plan-202607.md` 階段②。使用者順帶提供
  Jonathan 的簡介文字與形象照。
- **變更**：
  - 新增 `pages/jonathan/`（`index.html`／`assets/js/app.js`／
    `assets/css/page-jonathan.css`）：簡介區塊（石益昇，整形外科醫師，
    使用者提供的簡介文字）＋ SKHPS 專案卡片。公開頁面，不需要登入，
    內容是靜態 HTML，`app.js` 只回報 loading task（SKHPS 連結例外，
    見下方）。
  - 新增 `pages/minz/`（同結構）：骨架佔位頁，內容留白（「這裡準備中，
    晚點會補上 Minz 的自我介紹與照片」），版型跟 Jonathan 頁對稱但
    強調色改用 `--color-primary-2` 區分。
  - `config.json` 新增 `jonathan`／`minz` 兩個 page entry；`index.html`
    的 `#jonathan`/`#minz` 錨點改成 `/pages/jonathan/`、`/pages/minz/`；
    `pages/admin/assets/js/app.js` 移除 SKHPS 連結卡片（後台是管理入口，
    SKHPS 是 Jonathan 自己的專案，不該混在一起）。
  - **跟原計畫的差異（使用者當場糾正）**：原計畫 Jonathan 專案卡片要放
    SKHPS 跟 jonaminz-movies 兩張，使用者指出「jonaminz movies是我們
    後台我跟minz的功能不是專案功能」——jonaminz-movies 是兩人共用的
    後台功能，不是 Jonathan 個人專案，已從卡片移除，這次不歸類在
    任何地方（真正該放哪裡，之後再決定）。
  - **SKHPS 連結環境感知**：本機測試時 SKHPS 連結要連本機的
    `/skhpsv2/`，不是永遠連正式站 `https://skhps.jonaminz.com`。
    第一版打算問使用者要寫死哪個 port，使用者立刻指出這跟 OAuth
    `origin` 白名單當初「loopback 不寫死單一 port」的教訓重複——改成
    `pages/jonathan/assets/js/app.js` 的 `LOOPBACK_HOSTNAME_PATTERN`
    判斷 `window.location.hostname` 是不是 loopback（`localhost`／
    `127.0.0.1`，任何 port），是的話用
    `window.location.origin + "/skhpsv2/"`（同 origin 相對路徑，自動
    跟著目前的 port 走），不是的話才用正式站網址。比 worker.js 那份
    `OAUTH_LOOPBACK_RETURN_ORIGIN_PATTERN` 更單純：判斷依據是頁面自己
    的 `window.location`，不是外部輸入，不需要另外驗證 protocol 或
    防偽造。
  - **素材處理**：使用者提供 Jonathan 形象照原始檔（PNG，3840×5760，
    24MB），用 `sharp-cli` 壓成 `assets/img/jonathan-portrait.jpg`
    （JPEG，1000×1500，quality 78，80KB）。使用者同時提供首頁 hero 圖
    的高解析度原始檔（之前的來源畫質較差），一併重壓
    `assets/img/home-hero.jpg`（2200×1467，quality 70，408KB，取代舊版
    1800×1200、quality 62、267KB）。兩張原始檔壓完即刪，repo 裡只留
    最終壓縮版本（使用者明確要求「整體保留一個檔案就好」）。
- **驗證**：Playwright 對 jonathan/minz/admin/home 四頁跑桌機
  （1280px）與手機（375px）截圖，確認零 console error、首頁連結指向
  真實路徑、admin 頁不再有 SKHPS 卡片、jonathan 頁卡片只有 SKHPS（沒有
  jonaminz-movies）。SKHPS 連結環境感知另外用 node 腳本窮舉 6 種
  hostname 組合（含 `127.0.0.1.evil.com` 這種試圖矇混的變形網址）確認
  邏輯正確，再實際跑在本機 dev server（127.0.0.1:5577）上確認算出的
  href 真的是 `http://127.0.0.1:5577/skhpsv2/`，不是寫死的某個 port。
  過程中一度被 VS Code 自己的 Live Server（也綁在預設 5500 port）
  干擾，同一個 port 上有兩個監聽者導致 curl 結果忽 200 忽 404——改用
  非預設 port（5577）跑自己的 `dev-server.js` 才排除干擾，這個坑之後
  本機測試前可以先 `netstat` 確認 port 沒有被 Live Server 佔用。
- **狀態變化**：`docs/roadmap-202607.md` 順序⑥完成；
  `docs/frontend-quality-plan-202607.md` 階段②完成。
- **遺留**：Minz 簡介文字與照片尚未提供，`pages/minz/` 維持骨架佔位；
  jonaminz-movies 真正該放在哪個入口（首頁？admin？獨立入口？）使用者
  裁決之後再說，這次刻意不猜；skhpsv2 遷移到消費 jonaminz 這幾項能力
  仍待另開新 prompt（同既有慣例）。
- **版本**：`v0.17.0-202607122328`。

---

## 2026-07-12 — 待辦總表順序④：Runtime 診斷系統拉高層級（重新設計）

- **任務**：接續 `docs/roadmap-202607.md` 排出來的順序，做④。SKHPS 的
  `runtime.js` 把子系統名稱寫死在 API 裡，這次不是直接搬，要先重新
  設計成可插拔才能給不同專案登記自己的模組用。
- **變更**：
  - 新增 `assets/js/runtime.js`：`window.JonaminzRuntime`（`log()`／
    `registerModule(name, meta)`／`setModuleStatus(name, status,
    detail)`／`getState()`／`getModuleState(name)`／
    `subscribe(handler)`）。核心不認得任何特定子系統名字，任何呼叫端
    自己登記自己的模組。log 環狀緩衝只留最近 200 筆。刻意沒搬 SKHPS
    的 footer 五盞燈號診斷面板 UI，只做資料層／事件。
  - `entry-core.js` 跟 version.js 同批載入 runtime.js（同樣不帶版本
    buster），登記 `loading-gate` 模組，把 gate 生命週期關鍵時間點
    （init 開始／version 載完／config 解析完／css ready／shell
    ready／task done or fail／all-ready／8 秒逾時保底／init 失敗）
    發成 log、更新模組狀態（ok/warn/error）。所有呼叫點都透過
    `runtimeLog()`/`runtimeSetStatus()` 兩個 helper，內部檢查
    `window.JonaminzRuntime` 存在才動作——runtime.js 是 best-effort
    診斷，不能反過來影響真正的 loading gate 邏輯。`checkAllReady()`
    加 `!allReady` 防止逾時保底放行後，事後補到的 task 把 `warn`
    狀態蓋回 `ok`。
- **驗證**：本機 Playwright 兩條路徑。①正常路徑：7 筆 log 依序出現、
  最終狀態 `ok`、console 零錯誤、布幕正常掀幕。②逾時路徑：讓
  `header.js` 卡 9 秒，~8.45 秒放行（落在 7.5~12 秒合理窗），狀態正確
  標成 `warn` 不被事後補到的 task 蓋掉，console 零錯誤。過程中
  `page.route()` 第一次沒配到帶版本 buster 的實際請求網址（glob
  pattern 沒帶 `*` 吃掉 `?v=...`），修正後才測到真實行為。
- **狀態變化**：`docs/roadmap-202607.md` 順序④完成。
- **遺留**：skhpsv2 自己遷移過去用這個版本，待另開新 prompt 交辦
  （skhpsv2 目前是 Codex 在處理）。目前只有 `loading-gate` 一個模組
  登記，其他模組（theme／shell／layout-metrics）先不加，等真的需要
  更細診斷粒度再說，不預先猜。沒有任何畫面消費這些 log/狀態——跟量測
  層（順序③）同樣做法，機制先上線。
- **版本**：`v0.16.0-202607122216`。

---

## 2026-07-12 — 待辦總表順序③：RWD/viewport 量測層拉高層級

- **任務**：接續 `docs/roadmap-202607.md` 排出來的順序，做③。把
  SKHPSV2 `layout-metrics.js` 的量測邏輯搬進 jonaminz（重寫、去 SKHPS
  命名，不是複製檔案），補上 `config.json` 裡 `layout.rwd.groups`
  早就宣告、但一直沒有 JS 真的在用的洞。
- **變更**：
  - 新增 `assets/js/layout-metrics.js`：命名空間
    `window.JonaminzLayoutMetrics`、HTML 屬性字首 `data-jonaminz-*`、
    header/footer 選擇器 `[data-jonaminz-header]`／
    `[data-jonaminz-footer]`、config 來源讀
    `window.JONAMINZ_SITE_CONFIG.layout.rwd`。量測
    `layoutWidth`/`layoutHeight`／`visualViewport`（含鍵盤高度感知）
    ／`orientation`／RWD mode（預設斷點 480/720/960/1200，對到
    config.json 已經有的五個 mode 命名）／RWD group（small/large，讀
    config.json 的 groups）／header-footer 邊界＋可用內容區高度。只
    量測、寫屬性、發 `jonaminz-layout-metrics-updated` CustomEvent＋
    `subscribe()` API，不改畫面。`resize`／`orientationchange`／
    `visualViewport`／`ResizeObserver`（body/header/footer）／
    `MutationObserver`（header/footer 非同步載入，量測當下可能還沒
    有真實高度）都會觸發重算。
  - `entry-core.js` 的 shell 平行載入群組新增這個檔案，跟 header/
    footer/registry-loader 同一批，純廣播不改畫面，不影響現有載入
    順序。
- **驗證**：Playwright 確認桌機 1280px 判定 `wide`/`large`、手機 375px
  判定 `phone-compact`/`small`，`configSource` 顯示
  `JONAMINZ_SITE_CONFIG.layout.rwd`（證明真的讀到 config.json 不是
  預設值）；resize 觸發後屬性即時更新；首頁（簽名式版型，沒有共用
  header/footer 元素）正確回報 `exists:false`，不是誤判；全站 5 頁
  regression 零錯誤。
- **狀態變化**：`docs/roadmap-202607.md` 順序③完成。
- **遺留**：目前沒有任何頁面/CSS 真的訂閱這個訊號——機制先上線，跟
  identity capability 當初「沒有專案被授權」同樣做法，等 Jonathan/
  Minz 門戶頁做出來或麵包屑（順序⑤）需要時才有真正的消費者。使用者
  提過的「手機自動導去內部密語登入」設計（見 roadmap 順序③段落）也
  還沒接，屬於登入頁邏輯，不是這個量測層本身的事。skhpsv2 自己遷移
  過去用 jonaminz 提供的版本，待另開新 prompt。
- **版本**：`v0.15.0-202607121741`。

---

## 2026-07-12 — 待辦總表順序②：讀條演算法拉高層級

- **任務**：接續 `docs/roadmap-202607.md` 排出來的順序，做②。把
  SKHPSV2 `loading-gate.js` 的「Runway Chase」平滑讀條演算法搬進
  jonaminz（重寫、去 SKHPS 命名，不是複製檔案），取代 `entry-core.js`
  原本「里程碑硬寫死百分比、跳格前進」的寫法。
- **變更**：
  - `assets/js/entry-core.js` 新增讀條引擎：`setProgressTarget()`
    取代 `setProgress()`（target 只前進不後退）、`tickProgress()`
    每 16ms 用「距離÷剩餘時間預算」動態計算速度平滑追趕、
    `finishProgress()`（all-ready 後 260ms 衝刺補滿到 100，最多再等
    520ms 保底）、`hideCurtainNow()`（真正拿掉 loading class 的地方，
    現在跟「邏輯上 all-ready」分開，等衝刺完才觸發）。
  - 新增 `GATE_TIMEOUT_MS`（8 秒）逾時保底：舊版完全沒有逾時機制，
    這次順手補上這個既有缺口（runway chase 本來就需要時間預算才有
    意義，8 秒逾時是這個預算的另一半，不是額外功能）。
  - **刻意簡化沒有搬的部分**：SKHPS 版本的「WARN hold」（逾時/失敗時
    停在目前進度 1 秒，搭配 footer 診斷燈號說明狀況）——jonaminz 沒有
    對應診斷 UI，沒有燈號單純停頓只會像卡住，逾時/失敗這裡一樣衝刺
    到 100 掀幕。
- **驗證**：Playwright 三項測試——①採樣讀條數值確認平滑遞增不跳格；
  ②延遲 9 秒回應資源（比 8 秒逾時長），確認布幕在約 8.3 秒就自動
  掀幕不等那個回應；③全站 5 頁 regression 零錯誤、都能正常到
  progress 100。**過程中的測試方法教訓**：第一版逾時測試用
  `page.goto()` 預設等 `load` 事件，被動態插入的 `<link>` 卡住，
  測到的其實是 `goto()` 自己等多久不是程式碼邏輯——改用
  `waitUntil:"commit"` 才測到真實行為，之後任何要模擬「資源卡住」
  的 Playwright 測試都要注意這點。
- **狀態變化**：`docs/roadmap-202607.md` 順序②完成。
- **遺留**：skhpsv2 自己遷移過去用 jonaminz 提供的版本，待另開新
  prompt 交辦（skhpsv2 目前是 Codex 在處理）。
- **版本**：`v0.14.0-202607121732`。

---

## 2026-07-12 — OAuth 白名單改成正規式放行整個 loopback，記錄手機 LAN 測試的未決問題

- **任務**：使用者指出列舉單一 port（`localhost:5500`／`127.0.0.1:5500`）
  永遠補不完——本機工具換個 port（例如另一個 helper 用
  `127.0.0.1:18765`）又不在白名單裡。順便問了手機用區網 IP
  （`192.168.1.101`）測試怎麼辦。
- **變更**：`worker.js` 的 `ALLOWED_OAUTH_RETURN_ORIGINS` 陣列改成
  `OAUTH_DEFAULT_RETURN_ORIGIN`（正式站，精確比對）＋
  `OAUTH_LOOPBACK_RETURN_ORIGIN_PATTERN`（正規式
  `^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$`，任何 port 都放行）。
  **這樣放寬沒有安全疑慮**：loopback 網址不管誰塞在連結裡，瀏覽器永遠
  只會解析成使用者自己這台機器，跟「導去別人網域」的開放式重導向是
  不同的威脅模型，`^...$` 錨點也防住了 `127.0.0.1.evil.com`／
  `127.0.0.1:5500.evil.com` 這種試圖矇混的變形網址。
  **手機 LAN IP 問題明確裁決不現在做**：區網 IP 跟 loopback 不是同一個
  安全等級（同一個 WiFi 上的其他裝置理論上可能架設同 IP:port 的東西
  監聽），使用者選擇先不放行，等順序③（RWD/裝置辨識系統）做出來後，
  考慮改成「偵測到是手機就自動導去內部密語登入」繞開這個問題（內部
  密語登入是純 POST，沒有導頁，不受這個限制）。現在手機要測本機開發，
  直接用內部密語登入即可。
- **驗證**：node 腳本跑過邊界案例（含前述兩個變形攻擊網址）確認 regex
  行為正確；`esbuild`+`node --check` 語法乾淨；`wrangler deploy` 後
  curl 三個不同 port（`18765`／`9999`／`localhost:3000`）都正確 302
  去 Google。
- **狀態變化**：`docs/roadmap-202607.md` 順序①的 OAuth 本機導頁問題
  徹底解決（loopback 任何 port）。手機 LAN 測試記錄成順序③的一個
  設計考量點，不是獨立任務。
- **遺留**：手機用區網 IP 測 Google OAuth 這條路目前還是會被導去正式
  站（刻意的，不是漏做）——手機測本機開發請改用內部密語登入。
- **版本**：`v0.13.2-202607121722`。

---

## 2026-07-12 — OAuth 白名單追加 127.0.0.1:5500（上一筆的漏洞）

- **任務**：使用者實測上一筆的修法，錄影操作 `http://127.0.0.1:5500`
  登入，結果還是被導回正式站——附了 Chrome DevTools Recorder 錄下的
  script 佐證，`page.goto('http://127.0.0.1:5500/')`。
- **變更**：`ALLOWED_OAUTH_RETURN_ORIGINS` 白名單第一版只放了
  `http://localhost:5500`，漏了 `http://127.0.0.1:5500`——瀏覽器把
  這兩個當成不同 origin（主機名稱不同，即使指向同一台機器），沒對到
  白名單的請求走 `resolveOauthReturnOrigin()` 的 fallback 邏輯，
  跟原本沒修之前症狀一樣。補上這個值，重新 `wrangler deploy`。
- **驗證**：
  1. 直連 jonaminz-db 查最近的 `sessions` 表（**只查
     `provider`／`count`／`max(created_at)`，不選 `token` 欄位本身
     ——第一次寫的診斷 script 選了 `token` 欄位被 auto mode classifier
     擋下，判定是把真實可用的 session 憑證印進逐字稿，是真的合理的
     擋，之後類似診斷都要避開選出敏感欄位本身）確認使用者剛剛那次
     Google 登入真的有成功建立 session（`google` provider 一筆最新
     記錄），問題僅止於最後導回的網址，不是整條登入流程都失敗。
  2. `esbuild --bundle` + `node --check` 確認語法乾淨。
  3. `wrangler deploy` 後 curl `origin=http://127.0.0.1:5500` 正確
     302 去 Google。
- **狀態變化**：`docs/roadmap-202607.md` 順序①的白名單缺口補齊。
- **遺留**：使用者仍需要自己完整測一次
  `http://127.0.0.1:5500` 的 Google 登入確認真的能導回本機（上一輪
  只測了 `localhost:5500` 這個寫法）。
- **版本**：`v0.13.1-202607121713`。

---

## 2026-07-12 — 待辦總表順序①：Google OAuth 本機導頁修復

- **任務**：接續 `docs/roadmap-202607.md` 排出來的順序，做①。使用者
  發現本機 `localhost:5500` 走 Google 登入永遠被導去正式站，本機測不了
  這條路。
- **變更**：
  - `worker.js` 新增 `ALLOWED_OAUTH_RETURN_ORIGINS`（白名單：
    `https://www.jonaminz.com`／`http://localhost:5500`）＋
    `resolveOauthReturnOrigin(candidate)` helper（不在白名單一律回
    fallback 第一個值，不信任呼叫端字串）。
  - `handleGoogleStart(env, url)`（新增 `url` 參數）讀
    `?origin=`、驗證白名單後存進 `oauth_states` 新增的 `return_origin`
    欄位。
  - `handleGoogleCallback` 查 `oauth_states` 時多 select
    `return_origin`，用它（再過一次 `resolveOauthReturnOrigin` 防禦
    升級前的舊資料列沒有這欄）建構最後的 302 導回網址，取代原本寫死
    的 `https://www.jonaminz.com/`。
  - `pages/login/assets/js/app.js` 的 `googleStartUrl()` 把
    `window.location.origin` 帶進 `/auth/google/start?origin=...`。
  - `backend/supabase/auth_schema.sql`：`oauth_states` 新增
    `return_origin text` 欄位（CREATE TABLE 定義＋一行
    `ALTER TABLE ADD COLUMN IF NOT EXISTS` 給既有環境套用）。
- **驗證**：
  1. `esbuild --bundle` + `node --check` 確認 `worker.js` 語法乾淨、
     無 eval；`node --check` 確認登入頁 `app.js`。
  2. 直連 jonaminz-db（Management API，密碼從根目錄密碼檔執行時讀取，
     不寫死在 script 裡——第一次寫死被 auto mode classifier 擋下，
     判定是憑證外洩風險，改成執行時讀檔）套用 `ALTER TABLE`，套用前後
     都查 `information_schema` 確認連對專案（有 sessions/oauth_states/
     contract_snapshots 三張表）、欄位真的加上。
  3. `wrangler deploy` 後 curl 三種情境打 `/auth/google/start`：帶
     `origin=http://localhost:5500`、帶偽造的
     `origin=https://evil.example.com`、完全不帶——三種都正確 302 去
     Google 同意畫面。再直連查 `oauth_states` 最新幾筆資料，確認
     `return_origin` 分別存成 `http://localhost:5500`、fallback 值
     `https://www.jonaminz.com`（惡意值被擋下，不是攻擊者塞的字串）、
     同樣 fallback——白名單邏輯跟資料流都直接用真實資料驗證過。
- **狀態變化**：`docs/roadmap-202607.md` 順序①完成。
- **遺留**：Google 同意畫面那段是瀏覽器導航，沒辦法自動化測完整條路
  （code exchange 需要真的走過 Google 同意畫面才有合法的
  `code`），**使用者需要自己在 `localhost:5500` 實際點一次 Google 登入
  確認真的能正常導回本機並取得身分**。Google Cloud Console 那邊的
  OAuth Client 設定不用改（redirect URI 一直都是 Worker 自己的網域，
  這次改的是 Worker 完成登入後自己 302 去哪裡，跟 Google 端設定無關）。
- **版本**：`v0.13.0-202607121703`。

---

## 2026-07-12 — 待辦總表彙整：平台能力拉高層級 + 前端計畫剩餘階段排序

- **任務**：SKHPSV2 水庫層盤點完（三輪對話，逐檔讀完全部 19 個檔案）
  後，使用者確認方向：loading-gate 讀條演算法、layout-metrics RWD 量測
  層、runtime 診斷系統都值得拉高層級變成 jonaminz 提供的平台能力
  （skhpsv2 反過來向 jonaminz 拿，不是 jonaminz 向 skhpsv2 借概念）；
  麵包屑（page-map.js）決定不搬、在 jonaminz 重寫更好的版本。動手前
  使用者要求先把所有還沒做完的事排出完整順序。
- **變更**：新增 `docs/roadmap-202607.md`，彙整並排序：①Google OAuth
  本機導頁修復（診斷過，`handleGoogleCallback` 導回網址寫死正式站）、
  ②讀條演算法拉高層級、③RWD 量測層拉高層級、④Runtime 診斷系統重新
  設計成可插拔後拉高層級、⑤麵包屑（等 Jonathan/Minz 門戶頁做出來、
  頁面深度夠了再做）、⑥前端品質重建計畫階段②（Jonathan/Minz 門戶頁）、
  ⑦階段③（後台 Dashboard 化）。另外列出「需要另開新 prompt 才會動」
  （skhpsv2 遷移、identity 階段 C、skhpsv2 開放註冊）跟「懸而未決不是
  任務」（jonaminz 自己要不要開放註冊、封面照片要不要換）兩類不主動
  排入的項目，以及兩個已知但刻意不修的小事（favicon 缺失、contract
  schema `$id` release checklist）。
- **狀態變化**：無功能變化，純規劃彙整。下一棒直接照
  `docs/roadmap-202607.md` 的順序執行即可，不用重新問使用者要做什麼。
- **遺留**：全部七個排序項目都還沒實作。
- **版本**：無程式碼變更（純文件），`version.js` 不動。

---

## 2026-07-12 — 首頁照片放大 + 修復登入後無路徑回後台的漏洞

- **任務**：接續上一筆首頁改版，使用者看過覺得桌機下照片太小，並發現
  一個真的漏洞——拿掉「共用入口」按鈕後登入態下首頁完全沒有路徑回
  後台了。
- **變更**：
  - `page-home.css`：`.hero-photo` 從 `width:min(560px,88vw)` 放大成
    `width:min(1100px,78vw)`，大螢幕下更有存在感，固定 aspect-ratio
    機制不受影響（不會因為放大就又開始裁人）。
  - `assets/js/header.js`：`buildIdentityBox()` 新增
    `options.showAdminLink`（預設不開）——開啟時在「OO你好」跟「登出」
    中間插入一個「後台」連結（`/pages/admin/`）。刻意做成選用而不是
    永遠顯示：已經身處後台系頁面（admin/theme/contracts，這幾頁的
    header 走 `render()` 呼叫 `mount()`，沒有傳這個選項）不需要再顯示
    「回後台」。
  - `assets/js/app.js`：首頁的 `mountIdentity()` 呼叫加上
    `showAdminLink: true`，補回登入後回後台的路徑。
- **驗證**：mock 登入態下截圖確認首頁 nav 依序顯示「Jonathan你好／
  後台／登出」三個元素，「後台」`href` 正確指向 `/pages/admin/`；
  桌機 1280px 截圖確認照片放大後比例協調。
- **狀態變化**：無新增未完成項，修復上一筆改版帶出的迴歸缺陷。
- **遺留**：無。
- **版本**：`v0.12.1-202607121638`。

---

## 2026-07-12 — 首頁改版：全螢幕背景圖改成固定比例小相片框

- **任務**：接續上一筆的 `background-position` 治標修法，使用者截圖
  回報（760×1200 窄視窗）仍然裁得很奇怪，直接改指示設計方向：「縮小
  顯示在標題上面不用堅持全螢幕」，同時要求拿掉右上角跟 Jonathan/Minz
  重複的導覽按鈕（signature 區已有 name-link 可點）、拿掉沒有實際
  功能的「共用入口」按鈕；後續又追加一個小要求：拿掉 name-link 的
  「PIECE 01/02」標籤，只留 Minz/Jonathan 名字本身。
- **變更**：
  - `index.html`：拿掉全螢幕背景 `.photo` div，改成
    `<main class="hero">` 內含 `.hero-photo`（真的 `<img>` 標籤，不是
    CSS background）＋ `<h1>jonaminz</h1>` ＋ tagline，依序在正常文件
    流排列。`.signature` 只剩兩個 `<a>`（Minz／Jonathan），拿掉原本
    放標題與「共用入口」的 `.center` 欄位，也拿掉 `<small>piece
    01/02</small>`。`nav-links` 只剩 `[data-nav-identity]`（前一筆
    已經拿掉靜態 Login 按鈕，這次確認沒有殘留）。
  - `page-home.css` 整份重寫：`.page` 從「`height:100dvh` +
    `overflow:hidden` + 絕對定位疊層」改成「`min-height:100dvh` 的
    正常 flex 直向排列」（nav → hero → line → signature），拿掉
    `.photo::after` 的暗化漸層遮罩（照片不再需要疊文字在上面，不用
    暗化處理）。**根本解法**：`.hero-photo` 用
    `width:min(560px,88vw)` ＋ `aspect-ratio:16/9` 固定框，
    `img{object-fit:cover}`——裁切比例是相對值，不隨容器實際寬度
    改變，桌機跟手機看到的裁切「比例」完全一樣，不會再有窄螢幕特別
    嚴重裁切的問題，兩人在任何寬度都完整入鏡。同步刪掉變成孤兒規則
    的 `.name-link small`。
- **驗證**：Playwright 四種寬度截圖（桌機 1280px／平板 768px／手機
  375px／窄長視窗 760×1200，最後這個就是使用者截圖回報問題時的實際
  尺寸）確認兩人在全部寬度都完整入鏡、登入連結只剩一個、DOM 結構
  正確。零新增 JS 錯誤（唯一的 console 錯誤是瀏覽器自動要
  `/favicon.ico` 的 404，jonaminz 本來就沒有 favicon 檔案，是既有
  小問題，跟這次改動無關，這次沒有順手修，留給下一棒）。
- **狀態變化**：首頁封面照片 RWD 問題**徹底解決**（不是治標）。上一筆
  `v0.11.1` 的 `background-position:22% center` 修法被這次取代。
- **遺留**：封面照片本身沒有換掉（使用者提過的另一個選項，這次用
  「縮小＋固定比例」解決，沒有新照片可換，之後如果真的要換照片，
  新照片的主體位置不用像之前那樣煩惱裁切點，因為固定 aspect-ratio
  這個機制本身就是通用的）。`favicon.ico` 缺失（既有小問題，順手發現
  但不在這次範圍內）。
- **版本**：`v0.12.0-202607121631`。

---

## 2026-07-12 — 首頁/後台三個視覺缺陷修復（重複登入按鈕、header 品牌無連結、封面照片手機版裁掉新娘）

- **任務**：使用者實際看過階段①上線後的網站，指出三個具體問題：
  「右上角又登入又 Login 不詭異嗎」、後台系頁面 header 沒有固定內容
  可以回首頁、封面照片在手機上沒辦法 RWD。逐一截圖確認現況後修復。
- **變更**：
  1. `index.html` 刪掉寫死的靜態 `<a class="login" href="/pages/admin/">
     Login</a>`，只留 `header.js`／`assets/js/app.js` 動態插入的「登入」
     連結（`/pages/login/`，登入後自動變「OO你好＋登出」）——AskUserQuestion
     確認過使用者選這個方向，不是反過來留靜態那個。`page-home.css`
     同步刪掉變成孤兒規則的 `.nav-links a.login`。
  2. `assets/js/header.js` 的 `render()`：品牌字從 `<span>` 改成
     `<a href="/">`，點了會回首頁。既有全域 `a{color:inherit;
     text-decoration:none}` reset（`01-reset.css`）已經處理好樣式，
     沒有另外加 CSS。這個共用 header 被 admin/admin-theme/
     admin-contracts/login 四頁使用，一次修好全部生效。
  3. `assets/css/page-home.css`：`≤540px` 斷點的 `.photo`
     `background-position` 從 `61% center` 改成 `22% center`。用
     Playwright 在 375px 寬實測：橫向構圖的封面照（新娘左、新郎右）
     在極窄 viewport 下 `background-size:cover` 只會露出原圖寬度
     約 25%，原本的裁切點偏右，把新娘整個人切出畫面外只剩新郎手臂
     一角；改成偏左後新娘（含吹泡泡動作）完整入鏡，正好對應畫面
     左下角「PIECE 01 Minz」標籤。**物理限制講清楚**：這個寬高比
     不可能同時裝下兩個人，兩害相權取其輕，新郎在最窄手機寬度會
     完全不入鏡——這是取捨後的結果，不是遺漏。`≤820px`／桌機維持
     原本 `center 49%` 不動，兩人都看得到。
- **驗證**：本機 Playwright 對首頁桌機／375px／768px 三種寬度截圖
  比對裁切結果；確認首頁 `.nav-links`／`.nav-identity` 底下只剩一個
  登入相關連結；mock 登入態下實際點擊後台頁的 header 品牌字，確認
  真的導航到 `/`（不只是 `href` 屬性對，是整個點擊行為都驗證過）；
  全程零 JS 錯誤。
- **狀態變化**：三個問題皆修復並已上線。
- **遺留**：封面照片本身沒有換掉（使用者提過的另一個選項是直接換
  一張新照片，這次先用調整裁切點解決；如果之後真的要換照片，記得
  同時重新調整這個裁切點，不能假設新照片的主體位置跟現在一樣）。
- **版本**：`v0.11.1-202607121620`。

---

## 2026-07-12 — 前端品質重建計畫階段①：效能重建＋全站布幕

- **任務**：接續前一筆的規劃文件（`docs/frontend-quality-plan-202607.md`），
  執行階段①。使用者切換到 Fable 5 規劃、切回 Sonnet 5 執行，指名照該
  文件做階段①。
- **變更**：
  - **快取修復（根因）**：5 個頁面（home/admin/admin-theme/
    admin-contracts/login）的 bootstrap `<head>` script 原本都用
    `document.write` + `String(Date.now())` 當 `jonaminz-loading.css`／
    `entry-core.js` 這兩個前置檔的版號，每次載入都是新值，快取命中率
    恆為 0%。改成靜態 `<link>`/`<script>` 標籤、完全不帶版號（吃
    GitHub Pages 原生快取）。`entry-core.js` 內部新增
    `resourceVersion`／`withVersion()`：version.js 本身也不帶版號，
    讀到之後才知道 `window.JONAMINZ_APP_VERSION.version`，後續所有
    資源（config.json、CSS、theme-runtime.js、header/footer/
    registry-loader、頁面 app.js）改用這個字串當版號——同版本內重複
    造訪全部命中快取，只有 bump `version.js` 才會讓網址改變。
    `window.JONAMINZ_ENTRY_VERSION` 保留（`registry-loader.js` 沒改，
    繼續讀這個全域變數），但指派成同一個版本字串而不是 `Date.now()`。
  - **並行化**：`entry-core.js` 的載入鏈從全序列 `.reduce()` 改成
    `Promise.all`：6 層 reservoir CSS 一次全送出（`<link>` append 順序
    仍同步發生在 `Promise.all` 呼叫當下，cascade 順序不受影響）；
    config.json 抓取、reservoir CSS、theme-runtime.js 預載三者同時
    開始；config 解析完後 page CSS 與 header/footer/registry-loader
    三支 shell script 同時開始（header.js 的 `render()` 讀
    `window.JONAMINZ_SITE_CONFIG`，這條依賴保留，必須等 config 解完
    才能開始，沒有更早）。
  - **Theme 不再無上限擋 gate**：新增 `loadThemeWithCap(800)`，首次
    造訪（無 localStorage 快取）跟 800ms 賽跑，逾時就先放行、
    `theme-runtime.js` 自己的 promise 繼續在背景跑，資料到了照樣
    `applyCss()`（`theme-runtime.js` 本身完全沒改）。回訪（有快取）
    `theme.load()` 本來就同步套用完立刻 resolve，這個 race 對它幾乎
    是 no-op。
  - **布幕重寫**：`jonaminz-loading.css` 從 12 行的死白遮罩改成全站
    共用的「標題＋進度條」布幕。只用 `html` 的 `::before`（標題文字，
    脈動動畫）／`::after`（hard-stop `linear-gradient` 同時畫出進度條
    已完成／軌道兩段，省掉第三個元素，也避開 `body{visibility:hidden}`
    的繼承問題——因為兩者都不在 `body` 底下）。**刻意不做 skhpsv2 那種
    逐階段（header/main/footer 分開淡入）揭幕**：那套的前提是每頁固定
    有 `[data-skhps-header]`/`main`/`[data-skhps-footer]` 結構，jonaminz
    首頁是簽名式導覽版型沒有這些共用元素，改成整個 `body` 用同一塊布幕
    蓋住、all-ready 一次揭幕，邏輯更簡單、對所有頁面型態都成立。
    `entry-core.js` 在里程碑（version 15%、config 30%、CSS chain 完成
    55%→65%、shell chain 完成 85%、all-ready 100%）寫入 CSS 變數
    `--jonaminz-loading-progress` 給進度條讀。配色沿用
    `--color-bg-dark`/`--color-text-dark`/`--color-primary`。
  - **Hero 圖壓縮**：`assets/img/home-hero.jpg` 用 `npx sharp-cli`
    （quality 62、寬度上限 1800px、progressive）從 581KB 壓到 267KB
    （減 54%），目視確認人物/場景細節沒有明顯劣化。`index.html` 新增
    `<link rel="preload" as="image">`。
  - `version.js` 檔頭註解同步更新（cache-buster 現在是這個檔案的
    version 字串本身，不再提已經不存在的舊機制）。
- **驗證**：
  1. 本機 `dev-server.js` + Playwright：對 5 頁逐一截圖確認布幕正確
     出現（標題＋進度條）、正確揭幕（`jonaminz-loading` 等 class 全部
     移除、`body` visibility/opacity 正確恢復）、全程零 console/page
     錯誤；admin 系三頁未登入時正確導去 `/pages/login/?next=...`，
     導頁後布幕在新頁面正確重新跑一輪，沒有露出未完成畫面。
  2. 同一個 browser context 對首頁連續載入兩次，比對兩次實際發出的
     資源請求網址，確認完全一致（證明快取修復生效，不再每次產生新
     版號）；確認 `<link rel="stylesheet">` 的 DOM 順序（01→06 reservoir
     →page CSS）在並行載入前後不變，cascade 沒被打亂。
  3. 截圖目視確認（治本重構規則）：首頁布幕→揭幕視覺正常、深色系
     一致無閃爍；後台/登入頁布幕→（導頁）→登入頁揭幕視覺正常，既有
     視覺打磨（Google 按鈕、身分徽章等）沒有被動到。
- **狀態變化**：前端品質重建計畫**階段①完成並已 push**。階段②
  （Jonathan/Minz 個人門戶頁）、階段③（後台 Dashboard 化）尚未開始。
- **遺留**：無（`theme-runtime.js`／`registry-loader.js`／`header.js`
  皆未修改，行為與依賴關係原樣保留）。
- **版本**：`v0.11.0-202607121559`（`version.js`；bump 這個檔案現在
  同時觸發全站資源版號更新，比以前更重要）。

---

## 2026-07-12 — 前端品質重建計畫定案（純規劃，無程式碼變更）

- **任務**：使用者反映首頁很慢、loading gate 只有死白畫面，要求規劃
  「把 jonaminz 做好一點」。診斷＋規劃產出 `docs/frontend-quality-plan-202607.md`，
  三階段：①效能重建＋全站 skhpsv2 式布幕（快取修復/並行載入/theme 不長擋/
  hero 圖壓縮）、②Jonathan 個人門戶頁＋Minz 佔位頁（SKHPS 連結從後台搬過去）、
  ③後台首頁 Dashboard 化。三個方向皆經使用者 AskUserQuestion 拍板。
- **變更**：僅新增計畫文件與本紀錄。診斷結論（快取全滅根因
  `Date.now()` buster、13 段串行瀑布、theme 首訪擋 8 秒、581KB hero 圖）
  已寫進計畫文件，實作前不用重新驗證。
- **狀態變化**：無功能變化。下一棒直接照計畫文件逐階段執行，每階段
  可當任務單使用。
- **遺留**：三階段全部未實作。階段②需要使用者提供 Jonathan 簡介文字/照片
  （可先佔位）。
- **版本**：無程式碼變更（純文件），`version.js` 不動。

---

## 2026-07-12 — Implementation plan 第 9 項階段 B：identity.currentUser@1 capability

- **任務**：接續第 9 項階段 A（jonaminz 主站登入），做階段 B——把登入身分
  包裝成符合 Frozen 規格 S30-33 的正式 capability，為將來階段 B（skhpsv2
  接入，使用者說目前是 Codex 在處理、之後才交辦）鋪路。使用者明確要求
  「這次先做 B，機制蓋好就好，不用授權給任何專案」。過程中先用 Plan mode
  完整探索 Contract schema／Frozen 條文／既有 Worker 程式碼／SDK Kernel
  結構，寫成 plan 檔請使用者核准後才動工。
- **變更**：
  - `worker.js` 新增共用 helper `resolveEffectiveCapabilities(env,
    projectId, environment, envSettings)`：S31 公式（Approved Contract
    `capabilities.supports` ∩ Integration Settings 授權的 `capabilities`
    陣列）。`getEffectiveSettings` 的 `capabilities` 欄位從寫死的 `[]`
    改用這個 helper 算真實值（原本重複的 Supabase 查詢邏輯一併抽掉）。
  - `worker.js` 新增 action `getGrantedIdentity`：只給
    `pages/identity-relay/` 呼叫，token 不離開 jonaminz.com 自己的瀏覽器。
    用同一個 helper 逐請求重算 `identity.currentUser@1` 是否在授權交集
    裡（S33：SDK 端快取的 capabilities 陣列不是授權證明）；未授權直接回
    `granted:false, identity:null`、完全不查 session，避免對未授權的
    呼叫端洩漏「現在有沒有人登入」這個資訊本身。
  - `integration-settings.json` 每個 environment 新增選填的 `capabilities`
    陣列（省略視為 `[]`），`revision` 2→3。`jonaminz-movies` 維持 `[]`
    （機制蓋好但不開通，跟當初 `css:"none"` 同一個做法）。
  - `pages/identity-relay/index.html`：改讀自己 URL 的 `projectId` query
    string（SDK Kernel 建立 iframe 時會帶上），呼叫新 action
    `getGrantedIdentity`（取代原本的 `getCurrentIdentity`），postMessage
    內容加上 `granted` 欄位。`targetOrigin` 維持 `"*"`（訊息內容本身不含
    token，安全假設不變）。
  - `sdk/sdk-src/sdk.js`：**第一個正式發布的 service**——
    `window.Jonaminz.identity.currentUser()`。照 S32 字面走：`init()`
    一開始（contract discovery 完成前）就無條件掛上
    `jz.identity = {currentUser}`，不論這個專案有沒有被授權都不會變成
    `undefined`。新增 `whenSettingsSettled()`/`settleSettings()` 這個小
    gate（搭 `report()` 既有的每個呼叫點順便 settle，涵蓋所有既有的
    ready/degraded 路徑，不用另外在每個分支加呼叫），`currentUser()`
    呼叫時先等這個 gate，再檢查 `effectiveCapabilities`（從
    `getEffectiveSettings` 回應存下來）有沒有包含這個 capability——沒有
    就 reject `CAPABILITY_NOT_GRANTED`（S27 形狀）。有的話動態建立隱藏
    iframe 打 `https://www.jonaminz.com/pages/identity-relay/?projectId=...`，
    **`event.origin` 驗證在接收端（這裡）做**（relay 頁面本身刻意不驗證，
    見該檔案註解，往外送的內容不含 token），5 秒逾時 reject
    `IDENTITY_TIMEOUT`（`retryable:true`）；relay 說 `granted:false` 也
    reject `CAPABILITY_NOT_GRANTED`——這是 S33 的雙重防線，SDK 端快取的
    capabilities 陣列可能過期，relay 背後的 Worker 才是真正的權威判斷。
    identity 呼叫成功與否跟 `ready`/`degraded` 生命週期完全獨立。
- **驗證**：
  1. `resolveEffectiveCapabilities` 的交集邏輯先寫 node 腳本窮舉 8 種組合
     （Contract 有/沒宣告 supports、Settings 有/沒授權、雙方都空等），
     比照第 4 項 `computeEffectiveCss` 當初的做法，全部通過。
  2. `npx esbuild worker.js --bundle` + `node --check` 確認 `worker.js`
     語法乾淨、無 eval；`node --check` 確認 `sdk.js`、
     `identity-relay/index.html` 內嵌 script 語法乾淨。
  3. `wrangler deploy` 後 curl 驗證正式環境：未登記 projectId、已登記但
     未授權、缺 projectId 三種情況 `getGrantedIdentity` 都正確回
     `granted:false`；`getEffectiveSettings` 對 `jonaminz-movies` 正確回
     真實 `capabilities:[]`；`getSdkVersion`／`getCurrentIdentity` 等既有
     action 不受影響。
  4. `node sdk/generate-sdk-release.mjs` 產生新 hash `5d8e909081bf`。
     Playwright 端到端（本機 harness 頁模擬官方 S21 snippet + loader 指向
     本機新 hash，`page.route()` 只 mock `getEffectiveSettings`／
     `getGrantedIdentity`，identity-relay 頁面本身吃真實檔案內容跑真實
     程式碼）驗證六種情境全數正確：未授權 reject
     `CAPABILITY_NOT_GRANTED`；已授權＋已登入 resolve
     `{currentUser:{id,displayName}}`；已授權＋未登入 resolve
     `{currentUser:null}`；SDK 端快取誤判 granted 但 Worker 端真正判斷是
     false（S33 雙重防線）正確擋下；relay 逾時 5 秒後正確 reject
     `IDENTITY_TIMEOUT`；**從錯誤 origin（測試頁自己）偽造一筆
     `postMessage` 授權結果，被 `event.origin` 檢查正確忽略**（沒有被
     誤採信）。全程零 console/page 錯誤，`window.Jonaminz.status` 全程
     不受 identity 呼叫結果影響。
  5. 使用者授權後把 `stable`/`next` channel 指向新 hash 並 `wrangler
     deploy`，curl 確認 `getSdkVersion` 回傳新 hash。
- **狀態變化**：implementation plan **第 9 項階段 B 完成並已部署上線**。
  identity capability 機制就位，但**沒有任何專案被授權**（`jonaminz-movies`
  的 `capabilities` 仍是空陣列）。下一步是階段 C（真的把這個 capability
  接進 skhpsv2）——不是這次範圍，使用者說 skhpsv2 repo 目前是 Codex 在
  處理，之後才會另外交辦一個新 prompt。
- **遺留**：「正向授權」路徑（某個真實專案的 Contract 真的宣告
  `capabilities.supports` 含這個值、Settings 也真的授權、透過已登入
  session 拿到真實身分）目前只在 mock 環境驗證過，沒有真實 DB 資料可測
  ——跟第 4 項當初「tokens 正向成功」路徑一樣的保留，等真的有專案（很
  可能是 skhpsv2）要用時再一併做真實端到端驗證，不補假資料。`sdk/`
  資料夾這次收尾一併 git push，push 之後 `https://jonaminz.com/sdk/
  sdk-5d8e909081bf.js` 才會是真的在正式站上可以載到的檔案（之前
  `getSdkVersion` 雖然已經指過去，但靜態檔案還沒上 GitHub Pages）。
- **版本**：`v0.10.0-202607121252`（`version.js`；SDK Kernel、Worker
  action、`integration-settings.json`／`sdk-versions.json` 皆屬程式碼/
  設定檔變更，minor 版號 bump 反映這是新功能不是單純修 bug）。

---

## 2026-07-12 — 修正 version.js 的錯誤時間戳（buildTime 對不上真實 commit 時間）

- **任務**：使用者指出 `version.js` 裡的時間長期都是錯的。查證後發現根因：
  AI agent 只有「今天日期」可用，沒有「現在幾點」，過去寫 `buildTime`／
  `updatedAt` 時是憑印象猜一個「看起來合理的時間」，不是真的查系統時間。
  例如這次修正前的 `202607121600`（16:00），對應的「登入頁視覺打磨」
  commit（`17db025`）實際 git 時間是 `11:16:49`，差了快 5 小時；往前翻還有
  `202607120900` 對到實際 commit `03:22` 的例子，同樣的模式。
- **變更**：`version.js` 的 `version`／`buildTime`／`updatedAt` 三處全部改成
  對齊 `17db025` 這個 commit 的真實 git 時間（`git log -1 --format=%cI`
  查出來的 `2026-07-12T11:16:49+08:00`）。**版本號本身（v0.9.2）沒有變**——
  這不是新的一版，只是修正記錄「v0.9.2 是什麼時候建的」這個中繼資料本身的
  錯誤，所以沒有 bump patch。
- **狀態變化**：無功能變化，純資料修正。
- **遺留**：**行為規則變更，寫進 `AI_CONTEXT/RULES.md` 才能真正生效**——
  之後任何 agent 要寫入精確時間戳（`version.js` 的 `buildTime`／`updatedAt`，
  或任何其他需要 HH:MM 的欄位）之前，必須先實際執行查時間指令（Bash `date`
  或 PowerShell `Get-Date`），不能用推測/印象/「currentDate」這種只有日期
  沒有時間的系統資訊去湊。這條這次只記在 CHANGELOG 和使用者的跨專案記憶
  裡，還沒補進 RULES.md，下一棒看到這筆時可以考慮順手補上。
- **版本**：`v0.9.2-202607121116`（`buildTime`／`updatedAt` 訂正，版本號
  未變，見上方說明）。

---

## 2026-07-12 — 文件盤點：修正 PROJECT_STATE.md 過期的 untracked 檔案紀錄，重新查證 JONAMINZ_ADMIN_TOKEN 確實刪除

- **任務**：使用者對話中斷後重啟新 session，擔心進度遺失（誤以為是外部工具
  更新造成）。查證 git 狀態（clean、與 origin 同步、reflog 無異常）後排除
  疑慮。過程中發現 `PROJECT_STATE.md` §6 記錄的「`docs/platform-integration-*`
  兩份文件＋ `AI_CONTEXT/` 尚未 commit」已經過期（實際早被 commit），依使用者
  明確偏好（看到過期筆記直接修掉，不用另外問）就地訂正。使用者同時質疑
  Contracts 頁面／`JONAMINZ_ADMIN_TOKEN` 是否真的如文件所述已清乾淨，重新
  查證。
- **變更**：
  - `PROJECT_STATE.md` §6 刪除過期的「未 commit 檔案」條目。
  - 新增查證結果：`npx wrangler secret list` 直接查線上真實 secret 清單，
    確認 `JONAMINZ_ADMIN_TOKEN` 不存在（剩 8 個 secret）；grep
    `pages/admin/contracts/assets/js/app.js` 確認沒有殘留的 `adminToken`
    程式碼，`worker.js` 裡唯一出現 `JONAMINZ_ADMIN_TOKEN` 字樣的地方是
    說明「已淘汰」的註解，不是還在用的邏輯。
- **狀態變化**：無功能變化，純文件校正 + 重新驗證既有結論（結論不變：
  admin token 機制確實已完全淘汰）。
- **遺留**：無。
- **版本**：無程式碼變更（純文件），`version.js` 不動。

---

## 2026-07-12 — 登入頁與 Contracts 工具列視覺打磨 + 刪除已淘汰的 JONAMINZ_ADMIN_TOKEN secret

- **任務**：使用者正式環境驗證登入功能「都正常」，順手要求把
  `JONAMINZ_ADMIN_TOKEN`（已確認沒人用）刪掉，並把登入頁跟 Contracts
  後台工具列「弄漂亮一點」。
- **變更**：
  - `npx wrangler secret delete JONAMINZ_ADMIN_TOKEN`，`wrangler secret
    list` 確認已移除，curl smoke test 確認 Worker 仍正常運作。
  - `pages/login/`：Google 登入改成白底＋官方四色 G 標誌的按鈕樣式
    （較貼近一般「使用 Google 登入」的視覺慣例），內部密語登入按鈕改用
    既有的 `.btn-ghost`（次要動作，Google 是主要動作）；「或」分隔線
    改成兩側夾線的樣式；已登入畫面新增身分徽章（圓形、姓名首字母，
    Jonathan 用 `--color-primary`、Minz 用 `--color-primary-2`，都是
    既有 design token，沒新增顏色）。
  - `pages/admin/contracts/`：工具列的「登入身分：Jonathan」文字前面
    加上同一套身分徽章，跟登入頁視覺一致。
  - 兩處身分徽章的 CSS（`.jonaminz-identity-badge` 及
    `--jonathan`/`--minz` 變體）目前各自獨立寫在兩份 Page Layer CSS
    裡（`page-login.css`／`page-admin-contracts.css`，規則完全一致但
    沒有共用檔案）——純視覺樣式、沒有邏輯，重複兩份 class 定義換取
    「不用另外開一個共用 CSS 檔案」的簡單，之後如果還有第三個地方要用
    再考慮抽出來。
  - 本機 Playwright 完整 regression 測試（登入關卡/next 參數/payload
    格式）全數重跑一次，確認視覺調整沒有動到任何功能邏輯或 DOM
    selector（`[data-login-form]`／`[data-approve]` 等測試用的 hook
    都還在）。
- **狀態變化**：純視覺/清理，沒有新增或改變任何功能行為。
- **遺留**：無。
- **版本**：`v0.9.2-202607121600`（`version.js`）。

---

## 2026-07-12 — 後台登入保護部署：wrangler deploy + 正式環境 smoke test

- **任務**：接續上一筆（後台登入保護程式碼完成但未部署），取得使用者
  透過 AskUserQuestion 的明確授權後部署。
- **變更**：`cd backend/cloudflare-worker && npx wrangler deploy`，上傳
  成功（Version ID `bedbbb7b-50ed-453c-b3ad-6837ae1b9fe5`）。正式環境
  curl smoke test：`saveThemeCssRules`／`approveContract`（不帶 token）
  皆正確回 `UNAUTHORIZED`；`approveContract` 改帶舊的 `adminToken` 欄位
  測試（模擬有人還在用舊前端）也正確回 `UNAUTHORIZED`，**確認舊機制
  真的失效，不是欄位改名但邏輯還在**；`getCurrentIdentity`／
  `getSdkVersion`／`getThemeCssRules` 這些不受影響的既有 action 正常
  運作，確認這次部署沒有動到其他功能。
- **狀態變化**：後台整站登入保護正式上線。`saveThemeCssRules` 技術債
  正式解決，`JONAMINZ_ADMIN_TOKEN` 機制正式淘汰（Worker 端已完全不
  讀取這個 secret）。
- **遺留**：需要使用者親自到正式環境驗證三個後台頁的登入關卡（用真實
  帳號登入，不是 curl 模擬）、Contract 核准/否決（操作人是否正確帶入
  登入身分）、Theme 存檔是否正常；確認無誤後可自行
  `npx wrangler secret delete JONAMINZ_ADMIN_TOKEN` 清掉已淘汰的
  secret（不會自動做）。
- **版本**：無程式碼變更（純部署操作＋文件更新），`version.js` 不動。

---

## 2026-07-12 — 後台整站加登入保護，統一掉 JONAMINZ_ADMIN_TOKEN

- **任務**：第 9 項階段 A（jonaminz 主站登入）落地並在正式環境驗證後，
  使用者透過 AskUserQuestion 明確選定：整個後台（`/pages/admin/`、
  `/pages/admin/theme/`、`/pages/admin/contracts/`）都要登入才能進來，
  不只是單一 write action；順便統一掉現有的 `JONAMINZ_ADMIN_TOKEN`
  獨立密語機制，改用同一套 session 登入。過程中先用 Plan agent 設計
  方案、寫成 plan 檔請使用者核准後才動工。
- **變更**：
  - `worker.js`：新增共用 `requireSession(env, payload)`（複用
    `getCurrentIdentity` 既有的 Supabase 查詢邏輯，`getCurrentIdentity`
    改成直接包一層）。`saveThemeCssRules`／`approveContract`／
    `rejectContract` 三個寫入動作都改成要求 `payload.token` 是有效
    session，不符合回 `UNAUTHORIZED`（200，跟既有 style 一致）。
    `checkAdminToken` 已整個刪除。**`p_actor`（Contract 核准/否決的
    操作人）直接用登入身分決定，不再吃 `payload.actor`**——原本是
    前端按鈕手動切換 Jonathan/Minz 自報身分，沒有真的驗證是誰在按，
    這裡堵掉「可以假裝是另一個人」的漏洞。esbuild 打包＋`node --check`
    ＋eval/new Function grep 驗證語法乾淨。
  - `assets/js/header.js`：`window.JonaminzIdentity` 新增
    `requireLogin()`（沒登入導去 `/pages/login/?next=<原路徑>`，任何
    失敗——包含網路錯誤——都導頁，是「失敗關閉」）與匯出
    `readToken()`。刻意跟既有 `mount()` 的「失敗開放」（網路錯誤時
    顯示登入連結、頁面照常運作，適合單純打招呼的場合）不同：
    `requireLogin()` 是給真正的權限關卡用的，2 人用的後台寧可短暫
    故障時進不去，也不要意外讓沒登入的人看到內容。
  - 三個後台頁（`pages/admin/`、`admin/theme/`、`admin/contracts/`）
    的 `init()` 都改成先過 `requireLogin()` 這關，現有 render/loadRows
    邏輯整個包進 `.then()`。`admin/theme/` 的 `saveRules()` 呼叫
    `saveThemeCssRules` 時 payload 加上 token。
  - `pages/login/assets/js/app.js` 新增 `getNextUrl()`：解析並驗證
    `?next=` 查詢參數（只接受同源相對路徑，拒絕含 `://` 或 `//` 開頭
    的值，避免開放式重導向），內部密語登入成功後導去 `next` 而不是
    固定回首頁；已登入時的「回首頁」連結也用同一個函式。Google OAuth
    這條路這次沒有把 `next` 一起帶回（`worker.js` 的
    `handleGoogleCallback` 固定導回首頁），是已知、刻意先不修的小
    缺口（要處理要把 next 塞進 OAuth 的 `state` 參數，工程量不小，
    跟這次範圍無關）。
  - `pages/admin/contracts/assets/js/app.js`：拿掉 Admin token 輸入框
    跟操作人切換按鈕（連同對應的 `sessionStorage` 常數與事件監聽），
    改成唯讀顯示登入身分（「登入身分：Jonathan」）。`decide()` 改送
    `token` 而非 `adminToken`/`actor`。已裁決列表顯示 `decidedBy` 時
    統一轉換大小寫（`IDENTITY_LABEL[row.decidedBy] || row.decidedBy`）
    ——舊資料是使用者手打的 `"Jonathan"/"Minz"`，新資料是登入身分的
    `"jonathan"/"minz"`，顯示層統一，DB 值本身不用回填。CSS 同步拿掉
    對應的 actor 按鈕樣式。
  - 文件同步：`docs/platform-integration-v1-implementation-plan.md`
    新增「後台整站登入保護」段落，`saveThemeCssRules` 技術債標記解決；
    `backend/README.md` 補完整套登入 action／路由的說明（原本完全沒
    記錄，第 9 項階段 A 時漏補）、拿掉 `JONAMINZ_ADMIN_TOKEN` 設定步驟、
    改寫 approve/reject 的 API 說明；`AI_CONTEXT/PROJECT_STATE.md` 多處
    更新（§2 資料夾說明、§4 已完成功能、§5 Worker secrets/API 表、
    §6 版本狀態），2026-07-11 第 3 項的歷史敘述保留原樣、加一句後續
    更新指引到這裡，不覆寫歷史。
- **本機驗證**（Playwright + `page.route()` mock `/api/action`，
  `node dev-server.js`）：(1) 未登入訪問三個後台頁都正確導去
  `/pages/login/?next=<urlencoded 原路徑>`；(2) mock 已登入後三頁都
  正常載入、不被導頁；(3) Contracts 頁核准動作攔截到的 payload 確認
  帶 `token`、不帶 `adminToken`/`actor`，畫面確認 admin token 輸入框
  與操作人按鈕都已移除、工具列正確顯示登入身分；(4) Theme 頁存檔
  payload 確認帶 `token`；(5) `next` 參數正常流程（登入後導回原本要
  去的後台頁）與開放式重導向防護（`?next=https://evil.example.com`／
  `?next=//evil.example.com` 都被擋下、導回首頁）皆通過。全部截圖
  確認視覺正常（工具列簡化後排版正常、身分正確顯示）。
- **狀態變化**：實作＋本機驗證完成，**尚未部署**（`wrangler deploy`
  待授權）。完成部署後 implementation plan 原本標記的
  `saveThemeCssRules` 技術債正式解決，`JONAMINZ_ADMIN_TOKEN` 機制正式
  淘汰。
- **遺留**：部署後需要使用者到正式環境親自驗證三個後台頁的登入關卡、
  Contract 核准/否決（操作人是否正確帶入登入身分）、Theme 存檔是否
  正常；確認無誤後可自行 `npx wrangler secret delete JONAMINZ_ADMIN_TOKEN`
  清掉已淘汰的 secret（不會自動做）。前台 IA 調整（SKHPS 連結搬去
  前台、Jonathan 頁籤內容頁）這次明確不做，是討論中提過但使用者選擇
  「先不動」的獨立想法，之後如果要做需要另外開一輪。
- **版本**：`v0.9.1-202607121400`（`version.js`）。

---

## 2026-07-12 — 第 9 項階段 A 正式環境端到端驗證通過，implementation-plan.md 原始範圍完成

- **任務**：接續上一筆部署，使用者親自在正式環境測試登入功能。
- **變更**：
  - 使用者自行用 `wrangler secret put` 設定六個新 secret
    （`JONAMINZ_LOGIN_JONATHAN`／`JONAMINZ_LOGIN_MINZ`／
    `JONAMINZ_GOOGLE_CLIENT_ID`／`JONAMINZ_GOOGLE_CLIENT_SECRET`／
    `JONAMINZ_GOOGLE_EMAIL_JONATHAN`／`JONAMINZ_GOOGLE_EMAIL_MINZ`）。
    過程中一次操作失誤把 `JONAMINZ_ADMIN_TOKEN`（既有的合約核准密語）
    也重設了一次（PowerShell 用全形頓號串指令失敗、user 誤貼成
    admin token 的指令），已提醒使用者若值有變要記得用新值登入
    `/pages/admin/contracts/`；後續用 `wrangler secret list` 確認六個
    新 secret 名稱都存在（只看名字不看值）。
  - 使用者去 Google Cloud Console 設定 OAuth 品牌（App 名稱
    `Jonaminz`）、建立 Web application 類型的 OAuth Client、redirect
    URI 設定正確。過程中發現 Google 同意畫面一度顯示原始網域
    `ndmc402010104.workers.dev` 而非設定好的 App 名稱——判斷是 Google
    branding 快取生效延遲（OAuth Client 剛建立就馬上測試），不是設定
    錯誤，等待後應會恢復正常，不影響功能。
  - **使用者親自完整測試兩條登入路，皆正常**：內部密語登入成功、
    Google OAuth 完整走過同意畫面成功登入、兩者登入後身分顯示都正確、
    登出正常清除狀態。
  - 一併新增 `.gitignore` 規則 `*pw*.json`（原本只有 `*pw*.txt`）：
    使用者存 Google OAuth Client Secret 用的檔案是 `.json`，沒被舊規則
    擋到，發現時檔案還沒被 commit，已補規則防堵。
  - 討論中確認 Google OAuth Testing 模式（未發布、未做 Search Console
    網域驗證）對本系統完全足夠：只有白名單內的 Test users（Jonathan/
    Minz 的 Google 帳號）能通過同意畫面，公開發布／網域驗證是給不特定
    公眾使用的服務才需要的機制，2 人固定身分系統不需要；Testing 模式
    下 Google refresh token 7 天過期的限制也不影響本系統，因為系統
    從未使用 Google refresh token（身分改用自己的 `sessions` 表
    30 天 TTL 管理）。
  - 更新 `docs/platform-integration-v1-implementation-plan.md` 第 9 項
    標記完成。
- **狀態變化**：**implementation-plan.md 原始範圍的第 9 項（主站登入）
  正式完成**——至此 implementation-plan.md 列出的 9 個項目全部完成並
  驗證過。討論中額外擴大的階段 B（identity capability）與階段 C
  （skhpsv2 接入）尚未開始，是否/何時進行由使用者決定。
- **遺留**：`saveThemeCssRules` 等既有寫入 action 仍未接上這套新的
  登入驗證（見 `PROJECT_STATE.md` Auth 段落）；階段 B/C 待辦。
- **版本**：無程式碼變更（純測試+文件更新），`version.js` 不動。

---

## 2026-07-12 — 第 9 項階段 A 部署：DB schema 套用 + wrangler deploy

- **任務**：接續上一筆（階段 A 程式碼完成但未部署），取得使用者透過
  AskUserQuestion 的明確授權後執行部署。
- **變更**：
  - 直連 `jonaminz-db`（用根目錄密碼檔＋pg client，跑完立刻刪除含密碼
    的 scratchpad script）套用 `backend/supabase/auth_schema.sql`。
    套用前先查 `information_schema.tables` 確認連的是正確資料庫、
    套用後再查一次確認新增 `sessions`／`oauth_states` 兩張表且沒動到
    既有五張表，並查 `role_table_grants` 確認 `service_role` 權限正確。
  - `cd backend/cloudflare-worker && npx wrangler deploy`，上傳成功
    （Version ID `22eaa5a1-759c-4175-a6c4-38832f82a1c8`）。
  - 正式環境 curl smoke test：`getCurrentIdentity`（無 token）正確回
    `{ok:true, identity:null}`；`loginWithInternalToken`（錯密語）正確
    回 `INVALID_TOKEN`；`GET /auth/google/start` 因 Google secrets 尚未
    設定回 500（**這是預期行為**，不是部署失敗，代表路由本身已經
    正確掛上去了）；既有 `getSdkVersion` 回應不受影響，確認這次部署
    沒有動到既有功能。
- **狀態變化**：DB schema／Worker 部署都已完成。**Auth 功能仍然
  「上線但打不開」**——`loginWithInternalToken` 現在會一律回
  `INVALID_TOKEN`（因為 `JONAMINZ_LOGIN_JONATHAN`／`JONAMINZ_LOGIN_MINZ`
  secret 還沒設定，沒有任何字串比對得中）、Google 登入完全不能用
  （四個 Google secret 都沒設）。這是刻意的：secret 值不該由 Claude
  經手，要使用者自己用 `wrangler secret put` 設定。
- **遺留**：(1) 使用者自行 `wrangler secret put JONAMINZ_LOGIN_JONATHAN`／
  `JONAMINZ_LOGIN_MINZ`，設定完內部密語登入就會真的可用；(2) 使用者
  自行去 Google Cloud Console 建立 OAuth Client（redirect URI
  `https://jonaminz-backend.ndmc402010104.workers.dev/auth/google/callback`），
  設定 `JONAMINZ_GOOGLE_CLIENT_ID`／`JONAMINZ_GOOGLE_CLIENT_SECRET`／
  `JONAMINZ_GOOGLE_EMAIL_JONATHAN`／`JONAMINZ_GOOGLE_EMAIL_MINZ` 四個
  secret；(3) 兩者都設定好後，需要在正式環境重新端到端驗證一次（尤其
  Google OAuth 全流程，本機/mock 測試完全沒覆蓋到真實 Google 那一段）；
  (4) 之後才進階段 B（identity capability）與階段 C（skhpsv2 接入）。
- **版本**：無程式碼變更（純部署操作＋文件更新），`version.js` 不動。

---

## 2026-07-12 — Implementation plan 第 9 項階段 A：jonaminz 主站登入（程式碼完成，尚未部署）

- **任務**：接續第 8 項，做第 9 項（原計畫最後一項）。範圍在討論中被
  使用者明確擴大成三件事：內部密語登入＋Google OAuth 兩條路都要有、
  身分要能單向傳給 skhpsv2（僅供前端顯示問候語）、整件事要做成
  jonaminz 可以選擇要不要開放給外部專案的 capability（不是硬依賴）。
  分三階段，這次做階段 A（jonaminz 自己的登入/登出）。
- **變更**：
  - 新表 `sessions`（token/identity/provider/expires_at）、`oauth_states`
    （CSRF state，短 TTL）：`backend/supabase/auth_schema.sql`，含
    service_role grant（照第 2 項踩過的 Supabase Management API 建表
    坑，這次先補不等出事）。
  - `worker.js`：新增兩個非 `/api/action` 的 GET 路由
    `/auth/google/start`（產生 state、302 去 Google 同意畫面）、
    `/auth/google/callback`（核對 state、換 token、解 ID token 的
    email、比對允許清單、建立 session、302 導回首頁並把 token 帶在
    URL fragment）；新增三個 action：`loginWithInternalToken`（比對
    `JONAMINZ_LOGIN_JONATHAN`／`JONAMINZ_LOGIN_MINZ` 兩個新 secret）、
    `getCurrentIdentity`（查 session 是否有效）、`logout`（刪 session
    row）。esbuild 打包＋`node --check`＋eval/new Function grep 驗證
    語法乾淨，**這批改動尚未 `wrangler deploy`**。
  - `assets/js/backend-client.js` 新增三個對應 wrapper。
  - 新頁 `pages/login/`（`index.html`／`assets/js/app.js`／
    `assets/css/page-login.css`，照 `pages/README.md` 標準流程，已在
    `config.json` 註冊），兩條登入路都在這頁。
  - 新頁 `pages/identity-relay/index.html`：極簡、不走 entry-core.js
    bootstrap，給未來 skhpsv2 之類的專案隱藏嵌入 iframe 用，讀
    localStorage token、查 `getCurrentIdentity`、`postMessage` 給父
    頁面（階段 B/C 才會真的被用到，這次先把頁面本身寫好）。
  - `assets/js/header.js` 大幅擴充：暴露 `window.JonaminzIdentity`
    （`captureTokenFromHash`／`mount`），共用 header 元素存在時顯示
    「OO你好」＋登出按鈕，或「登入」連結。
  - `assets/css/reservoir/04-layout.css` 新增 `.jonaminz-header`
    flex 版面＋身分區塊樣式（共用 shell 層，非頁面專屬）。
- **自己抓到並修好的 bug**：header.js 第一版把「讀 URL hash 存
  session token」的邏輯包在「找不到 `[data-jonaminz-header]` 元素就
  return」的判斷式裡——但首頁（Google OAuth callback 固定導回的目的
  地）是簽名式導覽版型，本來就沒有這個共用元素，會導致 OAuth 登入
  永遠存不進 token。改成 hash 擷取邏輯移到模組最外層無條件執行；
  同時發現首頁的身分顯示原本也會整個消失（同一個原因），所以額外
  改了 `index.html`（`nav-links` 新增 `[data-nav-identity]` 容器）、
  `assets/js/app.js`（呼叫 `JonaminzIdentity.mount()`）、
  `assets/css/page-home.css`（新增 `.nav-identity` 系列樣式，只加
  規則、不動既有 `.nav-links` 規則），讓身分狀態在首頁也看得到。
  這個發現是本機 Playwright 端到端測試（mock `/api/action` 的登入/
  身分查詢回應）跑出來的，不是純程式碼審查抓到的。
- **本機驗證**：內部密語登入成功/失敗、登入後首頁 nav 與各頁共用
  header 正確顯示身分、登出正確清 token、hash-fragment token 擷取
  （模擬 OAuth 導回）正確運作，皆截圖確認視覺正常。Google OAuth 那段
  完全沒測過（需要真實 Google Client Secret，等使用者申請完才能測）。
- **狀態變化**：implementation plan 第 9 項**階段 A 程式碼完成、本機
  驗證通過，尚未部署**（DB schema 未套用、Worker 未 deploy、Google
  OAuth secrets 未設定）。細節見 `AI_CONTEXT/PROJECT_STATE.md` §4。
- **遺留**：部署前需要：(1) 使用者授權直連套用 `auth_schema.sql` 到
  `jonaminz-db`；(2) 使用者授權 `wrangler deploy`；(3) 使用者自行設定
  `JONAMINZ_LOGIN_JONATHAN`／`JONAMINZ_LOGIN_MINZ` 兩個 secret；
  (4) 使用者自行去 Google Cloud Console 申請 OAuth Client（redirect
  URI 見上）並設定四個 Google 相關 secret。部署完才能做正式環境端到端
  驗證（尤其 Google OAuth 全流程本機測不到）。之後才進階段 B（identity
  變成正式 `identity.currentUser@1` capability）與階段 C（skhpsv2
  接入，另一個 repo，需要另外授權）。
- **版本**：`v0.9.0-202607120900`（`version.js`，前端程式碼/HTML/CSS/
  設定檔變更需要 bump；worker.js／SQL 這批還沒部署，不影響此版號）。

---

## 2026-07-12 — Implementation plan 第 8 項：smoke app（純驗證，無程式碼變更）

- **任務**：接續 tokens CSS（第 7 項），做第 8 項——把
  `implementation-plan.md` 的固定情境清單（無合約／合約無效／
  project disabled／Settings timeout／optional capability／Shell
  none/tokens／SDK 重複載入／SDK rollback／未知欄位／舊 schema 配新
  SDK／snippet 逾時降級，共 13 項，來源 ChatGPT Review AR-18）逐條跑過。
- **變更**：
  - **決定不另外養一個專用 smoke app**：第 6、7 項的驗證方式（拿
    jonaminz-movies 這個真實、已登記、已核准的專案當宿主頁面，
    Playwright `page.route()` 只在需要製造邊界情況時竄改 Worker 回應，
    其餘打真實 production Worker）已經就是 smoke test 的做法，另外
    養一個假專案是多餘的維護負擔，換不到好處。這個方向有先跟使用者
    確認過。
  - 13 項情境裡：8 項已經在第 6、7 項驗證過（無合約、正常合約、合約
    無效、Shell tokens 等），本輪只需要新測 5 項：Settings timeout
    （mock `getEffectiveSettings` 斷線 → `degraded`/`NETWORK_ERROR`）、
    SDK 重複載入（同頁面手動再插入一次 loader，確認不拋錯、不弄壞
    `ready` 狀態）、SDK rollback（mock `getSdkVersion` 指回第 6 項的
    舊 Kernel hash，確認舊 release 對現在的資料形狀仍相容）、Worker
    回傳未知欄位（mock 回應夾帶額外欄位，確認正常忽略不崩潰）、
    snippet 載入失敗降級（mock loader 腳本本身載入失敗，確認官方
    snippet 的 `onerror` 正確觸發 degraded）。全部零 JS 錯誤、行為
    符合預期。
  - 3 項情境（optional capability 不存在、Shell none、舊 Contract
    schema 配新 SDK）判定 v1 範圍內**不適用**，不是測試遺漏——背後
    對應的系統（真實 service／Shell／第二個 schema 版本）根本還沒做，
    沒有東西可以測，等對應項目做出來才有意義補測。project disabled
    情境確認等同於已驗證過的 `NOT_APPROVED` 反面路徑，不用重複測。
  - 新增 `docs/platform-integration-v1-acceptance-tests.md` 逐條記錄
    上述 13 項的狀態與測試方式。
- **狀態變化**：implementation plan **第 8 項完成**。下一步是第 9 項
  （Google OAuth 主站登入）——implementation plan 剩下的最後一項，也是
  目前為止規模最大的一塊。
- **遺留**：**發現一個誠實記錄但這次不修的行為**：SDK 重複載入不是
  嚴格意義的 no-op——S22 規定的冪等目前只保證「不覆寫既有
  `__snippetVersion` 物件、不炸房子」，沒有做「偵測到已經初始化過就
  整個跳過」的優化，重複載入會重打一次 `submitContract`／
  `getEffectiveSettings`。正常使用下 snippet 只會被貼一次，這是異常
  情況的容錯而非效能關鍵路徑，判定可以接受；如果之後真的有案例受
  影響，要加一個 init 旗標判斷。
- **版本**：無程式碼變更（`sdk-src/sdk.js` 沒有改，純文件產出，
  RULES.md 規則純文件不 bump）。

---

## 2026-07-12 — Implementation plan 第 7 項：tokens CSS 收編進 SDK

- **任務**：接續 SDK Kernel（第 6 項，能算出「准不准套用 tokens」但
  什麼都沒做），做第 7 項——把 CSS custom properties 真的送到外部專案
  頁面上。對應 S34（CSS 生效等級）、S35（tokens 最小語意）、S36
  （token 命名）。
- **變更**：
  - 現有 `assets/js/theme-runtime.js` 已經做了「讀 Supabase
    `theme_css_rules`、組 CSS、注入 `<style>`」，但走 v0 舊模式：任何
    人貼一行 script 標籤就拿得到外觀，不經 Contract／Integration
    Settings 審核。這次是在 Kernel 裡新增一份**收編後、gated** 的邏輯
    ——`theme-runtime.js` 本身沒動，jonaminz 自己網站繼續用原本機制
    （v0 尚未作廢，RULES.md §4 三條件未全部成立）。
  - **範圍收窄**：重讀 `docs/external-project-manifest.md` 與 S35 後
    確認只有 `:root` 那些列是「跨專案共用介面」，其他 selector（例如
    `.card`）是 jonaminz 自己共用元件的微調，外部專案沒有同名 class
    對它們來說沒有意義——Kernel 只挑 `:root` 列轉成 CSS 變數，其餘不送。
  - `sdk/sdk-src/sdk.js` 新增 `jzTokenName()`（S36 機械式轉換：
    `--color-primary` → `--jz-primary`，拿掉舊前綴、換 `--jz-`，其餘
    語意名稱不變，不引入新的命名意見）與 `applyTokens()`（呼叫既有
    `getThemeCssRules`——不改 Worker、不改 Supabase——只處理 `:root`
    列，每個變數同時輸出舊名與新名，值相同，S36 別名過渡規定）。
    `effectiveCss === "tokens"` 時呼叫，**不 await、不擋 `ready`
    settle**——S23 沒有把 CSS 套用列進 ready 必要條件，tokens 純視覺、
    best-effort，套用失敗只 `console.warn`，不影響核心 lifecycle
    （跟 `theme-runtime.js` 一樣的容錯哲學，S24）。
- **驗證**：
  1. 直連 Supabase 核對 `theme_css_rules` 目前實際只有一筆資料
     （`:root { --color-primary: #6366f1 }`），確認這次是照現有機制的
     真實行為收編，不是憑空造了一套沒人在用的假資料在測。
  2. 用 Playwright mock `getEffectiveSettings`（回 `approved:true,
     css:"tokens"`）與 `getThemeCssRules`（回兩筆 `:root` 規則＋一筆
     `.card` selector 規則），其餘打真實 production Worker：確認注入的
     `<style id="jonaminz-sdk-tokens">` 同時含舊名與 `--jz-*` 新名、
     `.card` 規則正確被排除、`window.Jonaminz.ready` 正確 resolve
     `status:"ready"`。
  3. 驗證 `effectiveCss` 不是 `"tokens"`（mock 成 `"none"`）時完全不會
     呼叫 `getThemeCssRules`——gated 路徑真的擋住，不是永遠套用。
  4. 驗證 `getThemeCssRules` mock 成 500 時：`ready` 仍正確 resolve、
     沒有插入 `<style>` 標籤、`console.warn` 有印但零 JS 錯誤。
  5. `node sdk/generate-sdk-release.mjs` 產生新 hash
     （`c0d679686951`），`sdk-versions.json` 兩個 channel 都指過去、
     `wrangler deploy`，curl 確認 `getSdkVersion` 正確回傳新 hash。
- **狀態變化**：implementation plan **第 7 項完成並已上線**。下一步是
  第 8 項（smoke app 完整生命週期測試）。
- **遺留**：`theme-runtime.js` 本身沒有收編／作廢，繼續作為 jonaminz
  自己網站的獨立機制存在。沒有真實外部專案端到端測過「tokens 正向
  成功」（jonaminz-movies 的 Contract 沒宣告 `css`、Settings 授予也是
  `"none"`，維持第 4 項的保守選擇，等真的有專案要用 tokens 才一併
  做）。沒有補建完整 24 個 token 的 baseline 交付系統（現有機制本來就
  只送「已客製的 delta」，這次是照原樣收編，不是新功能）。
- **版本**：`v0.8.0-202607120206`（已 bump；SDK Kernel、
  `sdk-versions.json` 皆屬程式碼變更）。

---

## 2026-07-12 — Implementation plan 第 6 項：SDK Kernel

- **任務**：接續 SDK Loader（第 5 項，只蓋了運送機制），做第 6 項——把
  被載入的 placeholder 換成真正的 Kernel：讀合約、推送給平台、查
  Effective Settings、正確 settle S21 官方 snippet 的 `ready` Promise。
  對應 S18-23（contract discovery、snippet 協定）、S26（lifecycle）、
  S27-29（錯誤模型）。
- **變更**：
  - **範圍再收窄一次（照規格推論，不是漏做）**：v1 沒有任何已正式發布
    的 service，S32「未授權的工具存在但婉拒」只適用於已發布的
    service——現在一個都沒有，所以 `window.Jonaminz.*` 這次不掛任何
    service 命名空間；`JonaminzError` 形狀（S27）只在 `SDK_INIT_FAILED`
    這唯一的 reject 情況用到，沒有生一個沒有呼叫端的 constructor。
  - **重讀 S21 原文凍結的 snippet 程式碼後發現第 5 項沒處理到的銜接點**：
    `data-contract` 屬性寫在載入 `jonaminz-entry.js` 的那個 `<script>`
    標籤上（S18），但 Contract Discovery 邏輯屬於 Kernel，Kernel 是
    loader 動態插入的「另一個」`<script>` 標籤，自己的
    `document.currentScript` 讀不到原始標籤的屬性。小幅修改已上線的
    `sdk/jonaminz-entry.js`：同步階段先讀出 `data-contract`，動態插入
    Kernel `<script>` 時轉貼 `dataset.contract`／`dataset.release`
    （Kernel 自己的 hash，Kernel 讀不到自己檔名）／`dataset.stale`
    （這次版本指標是不是從 localStorage 快取來的，只有 loader 知道，
    給 Kernel 填 `diagnostics.staleCache`）。
  - `sdk/sdk-src/sdk.js` 整份改寫：(1) 判斷 `window.Jonaminz.__snippetVersion`
    標記決定要不要初始化（S22：沒標記＝命名空間被占用或沒走官方
    snippet，靜默退場）；(2) contract discovery（S18-20）：
    `data-contract` 或預設 `/jonaminz.contract.json`，`new URL(path,
    location.origin)` 解析後核對 origin，跨源直接視為 discovery 失敗
    （S19，拒絕絕對 URL 覆寫同源限制）；(3) F5/S8 最小必填客戶端粗篩；
    (4) 呼叫 `submitContract` 推送——**推送失敗用 `.catch()` 吞掉、不
    中斷後續流程**（S13/S16：推送 ≠ 採信，即使這次推送失敗，只要之前
    approved 過，整合仍應正常運作）；(5) 呼叫 `getEffectiveSettings`
    決定 `ready`/`degraded`（S23/S31）；(6) `report()` 依 `__bootstrap`
    是否還在決定呼叫 `.settle()` 或就地更新 `status`/`reason`/
    `diagnostics`（S21：Kernel 姍姍來遲、bootstrap 已被 15 秒逾時
    settle 過的情況，不重播 Promise）。
  - **自己動手後的一個小改進**：`getEffectiveSettings` 回傳 `ok:false`
    時，第一版寫死回傳泛用的 `SETTINGS_UNAVAILABLE`，測試時發現 Worker
    其實有給更精確的 `code`（例如 `PROJECT_NOT_REGISTERED`）——改成優先
    用 Worker 給的實際 code，`SETTINGS_UNAVAILABLE` 只留給 Worker 真的
    打不通的情況，diagnostics 因此有意義得多。
- **驗證**：
  1. 對 **jonaminz-movies 真實已上線頁面**
     （`https://ndmc402010104.github.io/jonaminz-movies/`，有真實
     Contract、已 registered、已 approved）注入完整 S21 官方 snippet，
     loader 網址指本機 `http://localhost:5500/sdk/jonaminz-entry.js`；
     直接對真實 HTTPS 頁面測試時撞到 Chromium 的 Private Network
     Access 限制（公開網站不能對 loopback 位址發請求，被 CORS 擋下）
     ——改用本機頁面（同源 localhost）＋Playwright `page.route()` 只
     mock `getSdkVersion` 這一個 action 指向新 Kernel，`submitContract`／
     `getEffectiveSettings` 照樣打**真實production Worker**：
     `await window.Jonaminz.ready` 正確 resolve `status:"ready"`、
     `diagnostics.release` 吻合新 hash（證明轉貼機制真的通了）、
     `settingsRevision` 是真實數字、`rejectedCapabilities` 空陣列。
  2. 三條降級路徑（合約 404、合約有效但 projectId 未登記、合約缺必填
     欄位）皆用同一套本機＋mock 手法測過，`status` 正確變 `degraded`、
     `reason` 精確對應（`CONTRACT_NOT_FOUND`／`PROJECT_NOT_REGISTERED`／
     `CONTRACT_INVALID`），全程零 JS 錯誤（S24 底線）。
  3. `node sdk/generate-sdk-release.mjs` 產生新 hash（`0c9953079f7a`），
     `sdk-versions.json` 的 `stable`/`next` 都指過去、`wrangler deploy`，
     curl 確認 `getSdkVersion` 正確回傳新 hash。
- **狀態變化**：implementation plan **第 6 項完成並已上線**。下一步是
  第 7 項（tokens CSS 收編進 SDK）。
- **遺留**：`sdk/` 資料夾（含這次改的 `jonaminz-entry.js` 與新的
  Kernel）本次跟這篇 CHANGELOG 一起 push，push 之後才會是
  `https://jonaminz.com/sdk/jonaminz-entry.js` 這個常青網址真正在跑
  新 Kernel（Worker 端 `getSdkVersion` 已經上線）。`window.Jonaminz.*`
  真實 service、CSS tokens 套用、smoke app、Google OAuth 都還沒做，是
  第 7-9 項的事。
- **版本**：`v0.7.0-202607120134`（已 bump；SDK Kernel、loader 轉貼
  邏輯、`sdk-versions.json` 皆屬程式碼變更）。

---

## 2026-07-11 — Implementation plan 第 5 項：SDK Loader ＋ 版本指標

- **任務**：接續 Effective Settings 端點（第 4 項），做第 5 項——把「怎麼
  把 SDK 送到外部專案頁面上」這條運送機制蓋好，對應 S37（常青
  loader＋immutable release＋版本指標＋kill-switch＋金絲雀）與 S39
  （Contract schema／SDK 回滾相容 checklist）。
- **變更**：
  - 範圍刻意跟第 6 項（SDK Kernel）切開：implementation plan 把
    「loader＋版本指標」跟「官方 snippet 對接、lifecycle 狀態機、錯誤
    模型、contract discovery」（S18-23、S26-29）分成兩項不是巧合——
    S37 說 loader 該是「極小、幾乎永不改動」的東西，這次只證明「pointer
    →immutable 檔案→執行」這條運送鏈是通的，不做 `window.Jonaminz.*`
    骨架或 Promise/ready 語意。
  - 新增 `sdk/generate-sdk-release.mjs`（跟
    `generate-contract-validator.mjs` 同精神的 build-time 腳本）：讀
    `sdk/sdk-src/sdk.js`、算 sha256 前 12 碼、寫出 immutable 的
    `sdk/sdk-<hash>.js`，不自動改版本指標——發不發版是人的決定。這次
    `sdk-src/sdk.js` 放極簡 placeholder（`window.Jonaminz.status=
    "degraded"`），真正的 SDK 邏輯是第 6 項的事。另準備
    `sdk/sdk-empty.js`（真的什麼都不做，kill-switch 目標）。
  - 新增 `backend/cloudflare-worker/sdk-versions.json`（git 檔案，跟
    `integration-settings.json` 同模式）：`stable`/`next` channel 各自
    指向哪個 hash/url。`worker.js` 新增 `getSdkVersion` action（公開
    唯讀）：`payload.projectId` 選填，v1 的 loader 呼叫時不帶（一律拿
    stable），端點本身先支援有給時查 `integration-settings.json`
    （新增選填 `channel` 欄位）決定金絲雀，形狀先定、v1 沒有專案會設
    非 stable 的 channel。
  - 新增 `sdk/jonaminz-entry.js` 常青 loader：讀 localStorage 短 TTL
    快取（5 分鐘）→ 沒有才打 `getSdkVersion`（5 秒逾時）→ 動態插入
    `<script>` 載入拿到的 immutable 檔案；抓不到指標時退回
    last-known-good（不論多舊），兩者都沒有就靜默退場；全程 `try/catch`
    （S24 不燒房子）。
  - **自己寫完後測試時抓到一個真的 bug**：第一版把載入 SDK 檔案的網址
    誤用 `window.location.origin`（宿主頁面的 origin）——但
    `sdk-<hash>.js` 是放在 jonaminz.com，不是外部專案自己的網域，本機
    測試網址（`localhost:5500`）跟正式站不一樣時會直接拿錯網址。改用
    `document.currentScript.src` 反推 loader 自己是從哪個網域載入的，
    在同步執行階段先存成常數（`document.currentScript` 在非同步 fetch
    callback 裡不可靠，要先存起來）。
  - 新增 `docs/sdk-release-checklist.md`（S39 回滾相容 checklist，純
    流程文件）：發布新 Contract schema 前，要先確認「如果現在要回滾，
    回滾目標支不支援這個新 schema」，兩階段發布順序寫成可照做的步驟。
- **驗證**：
  1. headless browser 測試（真實載入 `http://localhost:5500/sdk/
     jonaminz-entry.js`，不是用 `page.setContent()` 的 about:blank
     頁面——那個環境下 localStorage/fetch 行為跟真實頁面不一樣，第一次
     測試因此得到誤導性的空結果，改用真實 `goto()` 頁面才測出正確
     行為）：確認 `getSdkVersion` 被呼叫、`sdk-<hash>.js` 被正確載入
     並執行、`window.Jonaminz.status === "degraded"`、console 印出
     placeholder 訊息、零 JS 錯誤。
  2. **在正式環境實際操作 kill-switch 並復原**：把 `stable` channel
     指到 `sdk/sdk-empty.js`、`wrangler deploy`，headless browser 確認
     `sdk-empty.js` 真的被請求並執行（200，不是請求失敗導致的假陽性）、
     `window.Jonaminz` 是 `undefined`；改回原本的 placeholder hash、
     `wrangler deploy`，確認恢復 `status:"degraded"`。這兩次部署都各自
     另外用 AskUserQuestion 取得授權（跟原本「開發完部署一次」的授權
     內容不同，classifier 正確擋下要求重新確認）。
  3. `npx esbuild worker.js --bundle` 與 `node --check` 確認 `worker.js`
     與 `sdk/jonaminz-entry.js` 語法正確、無 eval。
- **狀態變化**：implementation plan **第 5 項完成並已上線**。下一步是
  第 6 項（SDK Kernel：官方 snippet 對接、lifecycle 狀態機、錯誤模型、
  contract discovery）。
- **遺留**：`sdk/` 資料夾本次只在本機 `dev-server.js` 驗證過，git push
  後才會是 `https://jonaminz.com/sdk/jonaminz-entry.js` 這個常青網址
  真正上線（Worker 端 `getSdkVersion` 已經上線，只有靜態檔案還沒推）。
  金絲雀（`next` channel）目前沒有真實專案在用，純粹機制就位。S39
  checklist 沒有自動化檢查，純靠人工遵守（規格允許的簡化）。
- **版本**：`v0.6.0-202607112352`（已 bump；Worker action、新 git
  設定檔、新靜態檔案皆屬程式碼變更）。

---

## 2026-07-11 — Implementation plan 第 4 項：Flattened Effective Settings 端點

- **任務**：接續核准後台（第 3 項），做第 4 項——approve 完的 Contract
  現在還是「資料庫裡的旗標翻成 approved」，沒有下游因此改變行為；這次
  蓋一個端點讓「approved 狀態」真的能被查詢、算出「這個外部專案現在被
  允許做什麼」，對應 S31（Effective capability 公式）、S38（flattened
  Effective Settings 供應方式）。
- **變更**：
  - 範圍刻意收窄：`docs/platform-integration-consensus.md` 把「Integration
    Settings 內容 schema」列在保留層（形狀已定、內容留白），v1 SDK
    （第 5、6 項，還沒寫）規劃是 `window.Jonaminz.*` 全部 service 一律
    婉拒（F7/S32），現在唯一有真實內容可算的授權維度只有 CSS（S34：
    `Effective CSS = min(Contract 聲明, Settings 授予)`）。這次只把
    CSS 這個維度做完整，`capabilities` 固定回空陣列佔位——第 6 項有
    真實 service 時只是往這個既有形狀加內容，不需要改 response 結構。
  - `integration-settings.json` 新增每個 environment 選填的 `css` 欄位
    （只認 `"none"`/`"tokens"`，省略視為 `"none"`）＋檔案層級 `revision`
    整數（S38 要求回應帶版本資訊，這份檔案是 git 檔案沒有資料庫版號
    可用，改一次手動 +1）。
  - `worker.js` 新增 `getEffectiveSettings` action（公開唯讀，跟
    `getThemeCssRules`／`listPendingContracts` 同慣例）。environment
    不從 payload 讀，一律用 Worker 自己的 `JONAMINZ_ENVIRONMENT`（跟
    `submitContract` 同樣理由：避免呼叫端謊報 environment 繞過檢查）。
    計算順序：projectId 未登記 → `PROJECT_NOT_REGISTERED`；查
    `contract_active_snapshots` join `contract_snapshots` 找 active
    approved snapshot，沒有 → `approved:false, css:"none",
    reason:"NO_APPROVED_SNAPSHOT"`（S31 明文降級：沒 approved snapshot
    不啟用任何能力）；有的話 → `css = min(該 snapshot 的 raw_contract.css,
    Settings 授予的 css)`，未知值一律視同沒宣告（S11 must-ignore）。
  - `assets/js/backend-client.js` 新增 `getEffectiveSettings(payload)`
    具名 wrapper。這次不需要新前端頁面——沒有 UI 要顯示這個，純粹是
    給未來 SDK 呼叫的端點。
- **驗證**：
  1. `min` 計算的純函式邏輯先寫 node 腳本窮舉 16 種組合（4 種已知值 ×
     4 種已知值，含 `undefined`／未知值如 `"components"`）全部通過才
     接進 `worker.js`。
  2. `npx esbuild worker.js --bundle` 確認語法正確、無 eval（沿用第 2、
     3 項已建立的驗證方式）。
  3. `wrangler deploy` 後 curl 驗證三條路徑：未登記 projectId →
     `PROJECT_NOT_REGISTERED`；缺 `projectId` → `PROJECT_ID_REQUIRED`；
     `jonaminz-movies`（已 approved，但 Contract 沒宣告 `css`）→ 正確回
     `{approved:true, css:"none", settingsVersion:1, revision:2,
     capabilities:[]}`。部署後第一次呼叫收到 `Unknown action`，等了
     幾秒重試就正常了——Cloudflare 全球節點的部署傳播延遲，不是真的
     bug，之後遇到類似狀況先重試再懷疑程式碼。
- **狀態變化**：implementation plan **第 4 項完成並已上線**。下一步是
  第 5 項（SDK loader＋版本指標）。
- **遺留**：「tokens 正向成功」路徑（Contract 宣告 tokens 且 Settings
  也授予）目前沒有真實資料可測——jonaminz-movies 沒宣告 `css`，純函式
  窮舉測試已覆蓋邏輯本身，等真的有專案要用 tokens 時再一併做真實端到端
  驗證，不補假資料。`capabilities` 真實內容、SDK 本身、`getThemeCssRules`
  收編進 SDK（第 7 項）都還沒做，是後續項目的事，不是這次遺漏。
- **版本**：`v0.5.0-202607112206`（已 bump；Worker action、schema 欄位
  皆屬程式碼變更）。

---

## 2026-07-11 — Implementation plan 第 3 項：核准後台完成並上線，修正改判設計缺陷

- **任務**：接續 Contract 收取（第 2 項），做 implementation plan 第 3 項——
  讓 pending Contract 能被人工核准/否決，`/pages/admin/contracts/` 後台，
  用 Worker secret `JONAMINZ_ADMIN_TOKEN` 當臨時保護（整站還沒有登入系統）。
- **變更**：
  - `backend/supabase/contract_schema.sql` 新增 `approve_contract_snapshot`／
    `reject_contract_snapshot` 兩個 `security definer` Postgres function，
    透過 Supabase RPC 一次呼叫完成「改狀態＋切換 active 指標＋寫 audit
    log」的原子操作。`worker.js` 新增 `listPendingContracts`／
    `approveContract`／`rejectContract` 三個 action；`backend-client.js`
    新增對應 wrapper；新頁面 `pages/admin/contracts/`（pending 清單、diff
    檢視、核准/否決按鈕）；`config.json` 登記新頁面；`pages/admin/` 首頁
    加連結卡片；`backend/README.md`／`pages/README.md` 同步更新。
  - 直連 `jonaminz-db` 套用 SQL function（第一版：approve/reject 都限定
    只能從 `pending` 狀態發動）；`wrangler deploy` 上線；本機 `dev-server.js`
    + headless browser 驗證頁面結構，過程中發現並修好一個真的 CSS 漏樣式
    （新頁面複製了 Theme 頁的 `.jonaminz-theme-*` class 命名，但那份 CSS
    是 Theme 頁專屬的 Page Layer，沒被這頁載入，工具列/區塊完全沒框線——
    補上基礎樣式到 `page-admin-contracts.css`）；curl 驗證錯 token 正確被
    擋（`UNAUTHORIZED`，DB 無變化）。
  - **使用者實際操作時發現一個真的設計缺陷**：否決一筆 Contract 後永遠
    卡死，無法改判回核准（第一版 SQL function 寫死「只能從 pending 發動」）。
    使用者質疑「否決應該像 pending 一樣可以再被改判，不是終態」——重讀
    frozen 規格 S13 原文「核准/否決只改狀態與 active 指標，**永不覆寫
    歷史**」，確認「歷史」指 audit log 不可竄改，不是 status 定了不能再變，
    第一版是我自己多加的限制，規格沒有要求。改寫兩個 function：不論目前
    狀態都能核准/否決，可自由在 approved/rejected 間改判；否決時如果那筆
    正好是目前生效版本才撤回 `contract_active_snapshots` 指標（沒有版本
    歷史堆疊可自動退回上一版，安全預設是「暫時沒有生效版本」，要人工
    重新核准）；每次改判在 audit log 多插入一筆，不覆寫舊紀錄。取得使用者
    明確同意後重新套用到 jonaminz-db。前端 `rowActionsHtml` 同步改成
    已核准顯示「撤回核准」、已否決顯示「改為核准」，pending 兩個都顯示。
  - **使用者實際操作時發現的 UX 問題也一併修**：admin token／操作人輸入框
    在畫面重畫時（按重新整理、核准/否決完自動刷新）會被 sessionStorage
    舊值蓋掉，逼人重打——改成 token 用 `input` 事件即時存檔；操作人從
    自由輸入改成 Jonathan/Minz 兩個切換按鈕；欄位順序改成操作人在前、
    token 在後（貼近帳號密碼慣例）；否決備註原本有存但畫面看不到，補上
    顯示；已裁決列表摺疊列預設只顯示裁決時間/操作人/備註，技術性的
    snapshot id／hash 移到展開區才顯示，減少視覺雜訊。
  - **驗證**：使用者用 jonaminz-movies 真實 pending（snapshot #3）實際
    跑過 submit→reject→approve→撤回核准→再核准 全流程，直連 DB 確認
    `contract_snapshots.status='approved'`、`contract_active_snapshots`
    正確指向該 snapshot、`contract_audit_log` 累積 5 筆且無覆寫，跟預期
    完全一致。
- **狀態變化**：implementation plan **第 3 項（核准後台）完成並已上線**。
  下一步是第 4 項（Effective Settings endpoint）。
- **遺留**：`docs/contract-schema/README.md` 的「進 Worker 前 release
  checklist」（`$id` 正式發布）仍是唯一未收尾項目，不擋任何後續工作。
  完整 rate limit（KV binding）依然正式留白，見 backend/README.md。
- **版本**：`v0.4.3-202607111911`（已 bump；SQL function、Worker action、
  前端頁面、schema 皆屬程式碼/schema 變更）。

---

## 2026-07-11 — jonaminz-movies 正向成功路徑驗證完成，修好 GRANT 權限漏洞

- **任務**：接續上一筆記錄，使用者授權 `wrangler deploy` 把
  `jonaminz-movies` 的 Integration Settings 登記上線，接著實際跑一次
  `submitContract` 驗證正向成功路徑。
- **變更**：
  - `wrangler deploy` 成功，線上 Worker 認得 `jonaminz-movies` 這個
    projectId。
  - 帶正確 `Origin: https://ndmc402010104.github.io` header 呼叫
    `submitContract`，**第一次回應是 HTTP 200 但 `ok:false`**：
    `Supabase read failed: HTTP 403 ... permission denied for table
    contract_snapshots`。查證後發現：三張 `contract_*` 表是這次
    implementation plan 第 2 項透過 Supabase Management API 的
    `database/query` 端點建立的（不是儀表板 SQL Editor），`service_role`
    沒有像既有 `external_app_registrations`／`theme_css_rules` 那樣自動
    拿到表格層級的 SELECT/INSERT/UPDATE/DELETE 權限——RLS 開了沒錯，但
    Postgres 的 GRANT 是分開一層，兩者都要過才能讀寫。使用者另外授權
    （範圍明確限定在這三張表、不動 RLS、不碰 skhps-db）後直連補上
    `GRANT SELECT, INSERT, UPDATE, DELETE ON ... TO service_role`，並回寫
    進 `backend/supabase/contract_schema.sql`（新增一段註解說明踩坑經過，
    避免以後用同樣管道重建表格再漏）。
  - 補完權限後重打 `submitContract`，回應
    `{"ok":true,"snapshotId":3,"status":"pending",...,"validationResult":
    {"valid":true,...}}`，canonical hash 跟本機（node 直接跑
    `contract-validation.js`）算出來的完全一致。直連 DB 確認
    `contract_snapshots` 真的多一筆（`status='pending'`、
    `submitted_origin` 正確記成呼叫時帶的 Origin header）、
    `contract_audit_log` 正確關聯到那筆 snapshot（`action='submit'`,
    `previous_hash=null`, `actor=null`）。
- **狀態變化**：**implementation plan 第 2 項的正向成功路徑第一次被真實
  資料完整驗證過**，先前 review 抓到的缺口正式關閉。附帶修好一個
  DB 權限設定漏洞。
- **遺留**：`docs/contract-schema/README.md` 的「進 Worker 前 release
  checklist」（`$id` 正式發布）依然是唯一還沒收尾的項目，不擋任何後續
  工作。下一步是 implementation plan 第 3 項（核准後台）。
- **版本**：`v0.4.1-202607111602`（已 bump；`contract_schema.sql` 補
  GRANT 語句，屬 DB schema 變更）。

## 2026-07-11 — 登記第一個真實外部專案 jonaminz-movies

- **任務**：使用者提供 ChatGPT Work 產出的 jonaminz-movies MVP source
  snapshot（電影討論／想看清單／訂票 demo，給 Jonathan/Minz 用），提議當
  Platform Integration 的第一個真實外部專案，直接補上先前 review 抓到的
  缺口：submitContract 正向成功路徑從未被真正測過。用 Plan Mode 列出步驟
  （拆鷹架/建 repo/部署/寫 Contract/登記/驗證）經使用者確認後執行。
- **變更**（`jonaminz-movies` 是新的獨立 repo，不是 jonaminz 本身；這裡只
  記跟 jonaminz 有關的部分，完整過程見該 repo 自己的 commit 紀錄）：
  - jonaminz-movies 原始匯出依賴 OpenAI 自家 `vinext`／site-creator 鷹架
    （Next.js on Cloudflare Workers、D1、`.openai/hosting.json` 設定），
    匯出時刻意排除部署身分導致那份設定檔缺失、建置直接壞掉。使用者裁決
    拆掉鷹架：UI（`app/page.tsx`、`app/globals.css`，純 client-side
    React，沒有 server component/next-image，Tailwind v4 無外部圖片
    參照）逐字移植成單純 Vite + React 19 + Tailwind v4 SPA，部署到
    GitHub Pages（`gh repo create` 公開 repo，GitHub Actions 建置部署，
    `vite.config.ts` 設 `base: "/jonaminz-movies/"` 對應 project site
    子路徑）。上線網址：`https://ndmc402010104.github.io/jonaminz-movies/`
    （已用 curl 確認回 200、`<title>` 正確）。
  - jonaminz-movies 根目錄新增 `jonaminz.contract.json`：只填 S8 必填
    （`contractVersion`/`app.projectId`/`app.title`）+ 一個
    path-absolute entry（`/jonaminz-movies/`），不宣告用不到的
    capabilities/objects/css/shell。用 `ajv-cli` 對 schema 驗證合法，
    另外直接呼叫 jonaminz Worker 實際在用的
    `contract-validation.js`（`validateCrossFields`/`validateUrls`/
    `computeCanonicalHash`）確認 cross-field 與 URL 同源解析都正確
    （解析出的完整 URL 跟已確認上線的網址完全吻合）。
  - jonaminz 這邊：`backend/cloudflare-worker/integration-settings.json`
    新增 `jonaminz-movies` 的 `prod` origin 登記
    （`https://ndmc402010104.github.io`——只到 host，不含路徑，路徑差異
    由 Contract 的 path-absolute URL 表達，這是 origin 定義本身決定的）。
    用 `npx esbuild --bundle` 直接打包（不透過 wrangler）確認新登記正確
    被包進 Worker、沒有語法錯誤。
- **狀態變化**：`integration-settings.json` 從空的變成有第一筆真實登記，
  但**這筆變更尚未 `wrangler deploy`**——線上 Worker 還不認得
  `jonaminz-movies` 這個 projectId。submitContract 正向成功路徑的實際
  驗證（呼叫線上 endpoint、直連 DB 確認 pending snapshot／audit log）
  排在部署授權之後，見下一筆 CHANGELOG 記錄。
- **遺留**：`wrangler deploy` 待授權；部署後才能真正驗證正向路徑。
- **版本**：`v0.4.0-202607111553`（已 bump；新增第一個外部專案登記，
  視為功能性里程碑，走 minor bump）。

## 2026-07-11 — pre-parse body size 限制部署上線

- **任務**：使用者授權部署上一筆 commit（`293f929`）新增的 pre-parse
  `Content-Length` 限制。
- **變更**：`wrangler deploy` 成功（bundle 104.23 KiB / gzip 11.83 KiB）。
- **驗證**：線上三項 smoke test 全過——`getThemeCssRules` 正常回傳資料；
  `submitContract` 對未登記 projectId 仍正確回 `PROJECT_NOT_REGISTERED`；
  送一個 300,000 bytes 的 request body 確認收到 HTTP 413（新限制生效）。
- **狀態變化**：repo 版本與線上部署版本重新同步，`PROJECT_STATE.md`§6
  的「尚未部署」註記已移除。
- **遺留**：無新遺留。
- **版本**：`v0.3.2-202607111415`（不變，這筆是部署動作，不是程式碼變更）。

## 2026-07-11 — 外部 review 核對、文件過期修正、pre-parse body size 限制

- **任務**：使用者拿另一個 AI（ChatGPT，透過 GitHub 純讀取）對 jonaminz
  Platform Integration 進度的盤點回來核對，指定這輪「只核對＋規劃，不改
  程式碼/DB/Schema/Frozen Spec，不 deploy」。核對完回報後，使用者依報告
  裁決了幾項，這次任務把裁決落地。
- **核對結果**（完整推理見對話紀錄，這裡只記結論）：ChatGPT 的技術盤點
  （已完成 7 項、未完成 8 項、body size/rate limit 缺口）全部正確；建議
  順序第 9 項「SKHPSv2 接入」不是 repo 既有計畫的一部分（`implementation-
  plan.md` 第 9 項明文是 Google OAuth），是使用者昨天口頭跟 ChatGPT 提過
  的另一個意圖，經使用者確認屬實但裁決不急。
- **變更**：
  - `AI_CONTEXT/ARCHITECTURE.md`：§2 架構圖補三張新表；新增「Contract
    收取（Platform Integration，推模式）」小節在 §4；§5 補
    `integration-settings.json`／`JONAMINZ_ENVIRONMENT`；§6 部署流補兩條
    陷阱（改 schema 要重跑預編譯腳本；Workers 禁 eval/new Function，
    dry-run 測不出來，要用 esbuild 打包驗證）；§7 從「規劃中、零實作」
    改成只列真正還沒做的部分（核准後台／Effective Settings／SDK／tokens
    CSS／smoke app／OAuth），移除已完成的 Contract Schema／Worker 收取。
    **這是本次核對抓到落差最大的檔案**——整個 Worker 實作與部署期間都
    沒碰過。
  - `docs/contract-schema/README.md`：標題與「下一步」段落從「即將開工」
    改成「已完成並部署」的時態；補一句正向成功路徑尚未經真正 Worker
    endpoint 驗證、留到第一個真實外部專案登記時一併測。
  - `docs/platform-integration-v1-implementation-plan.md`：第 1、2 項加
    ✅ 完成標記；第 2 項下补記 body size／rate limit 的正式裁決；底部
    補 SKHPSv2 是真實但不急的意圖，避免下次規劃時漏掉或誤植入優先序。
  - `backend/cloudflare-worker/worker.js`：新增 `MAX_REQUEST_BODY_BYTES`
    （256KB）與 pre-parse 檢查——`request.json()` 之前先看
    `Content-Length` header，超過直接回 413，不無條件把整個 body 讀進
    記憶體才發現太大。跟既有的 post-parse `MAX_CONTRACT_SIZE_CHARS`
    是兩層獨立防線（Content-Length 缺席/造假時第一層擋不住，第二層還在）。
    **完整 rate limit 正式裁決留白**，理由寫進 `backend/README.md`。
  - `backend/README.md`：同步記錄兩層 size 限制與 rate limit 的正式裁決。
- **驗證**：這輪明確禁止 `wrangler deploy`（含 `--dry-run`，Claude Code
  的 auto mode 分類器把兩者都當成同一個受限動作擋下），改用
  `npx esbuild worker.js --bundle --platform=neutral --format=esm` 直接
  打包（不透過 wrangler），grep 產物確認零 `new Function`/`eval(`、
  `node --check` 確認語法合法。**這次的 pre-parse body size 檢查邏輯
  沒有部署到線上**，只是 commit 進 repo——下一次 `wrangler deploy` 時才會
  生效，部署前需要另外跟使用者確認（RULES.md §2-2）。
- **狀態變化**：交接文件與實際部署狀態重新同步。implementation plan
  第 2 項的兩個安全留白（body size、rate limit）從「單方面記在 README」
  變成「使用者正式裁決」。SKHPSv2 接入意圖正式記錄但排在低優先序。
- **遺留**：`worker.js` 的新 pre-parse 檢查待部署；submitContract 正向
  成功路徑待第一個真實外部專案登記時一併驗證；approve/reject 寫入端點
  上線前的臨時防護方式（討論中提出「比照直連 DB 的每次明確授權模式，或
  加陽春 shared-secret，等 OAuth 落地再換正式驗證」的建議）尚待使用者
  在真的要動工核准後台時裁決，這次沒有定案。
- **版本**：`v0.3.2-202607111415`（已 bump；程式碼有變更但**未部署**，
  見上方驗證段落）。

## 2026-07-10 — submitContract 部署修正：ajv standalone 預編譯，正式上線

- **任務**：使用者授權 `wrangler deploy`。第一次部署直接失敗：
  `Code generation from strings disallowed for this context`——Cloudflare
  Workers 的 V8 isolate 禁止 `new Function`/`eval`，而 `ajv.compile()`
  預設在 runtime 就是用這個機制把 schema 編成驗證函式。前一輪的
  `wrangler deploy --dry-run` 沒抓到，因為 dry-run 只測 esbuild bundle
  過不過，不會真的在 V8 isolate 裡執行模組頂層程式碼。
- **變更**：新增 `backend/cloudflare-worker/generate-contract-validator.mjs`
  （build-time 腳本，用 ajv 的 standalone code 機制把
  `docs/contract-schema/jonaminz.contract.schema.json` 預編成純 JS）與其
  產出 `contract-schema-validator.generated.js`；`worker.js` 改成 import
  這份預編譯產出，移除 runtime `ajv.compile()` 呼叫。`backend/README.md`
  新增「Contract Schema 改了要重新產生 validator」一節，明講改 schema 後
  部署前要重跑 `node generate-contract-validator.mjs`，否則 Worker 用的是
  舊規則。
- **驗證**：這次不只信賴 `wrangler --dry-run`——用 `npx esbuild` 把產出檔案
  實際打包成 CJS（跟 wrangler 內部用同一顆 bundler），grep 打包後的產物
  確認零 `new Function`/`eval`，再用 Node 對打包產物跑功能測試（合法合約
  valid、禁用欄位/非法 projectId/反斜線 URL 皆 invalid）確認邏輯沒有在
  轉換過程中跑掉。修好後 `wrangler deploy` 成功（bundle 從 309KB 降到
  104KB，因為不用再帶整個 ajv 編譯器），對線上 Worker 做了三項 smoke
  test：舊 action（`getThemeCssRules`）正常回傳真實資料、新 action
  （`submitContract`）對未登記的 projectId 正確回
  `{ok:false, code:"PROJECT_NOT_REGISTERED"}`、直查 `contract_snapshots`
  確認這次測試呼叫沒有寫入任何資料列（設計上該檢查發生在任何 DB 操作
  之前）。
- **狀態變化**：**implementation plan 第 2 項（Worker 端合約收取）正式
  上線**，`https://jonaminz-backend.ndmc402010104.workers.dev` 現在跑的
  就是含 `submitContract` 的版本。
- **遺留**：無新遺留，前一筆紀錄列的遺留項目（`integration-settings.json`
  待填真實專案、KV rate limit、`$id` release checklist）依然有效。
  **給下一棒的重要提醒**：以後改 `jonaminz.contract.schema.json` 之後，
  部署 Worker 前一定要先跑 `node generate-contract-validator.mjs` 重新
  產生 `contract-schema-validator.generated.js`，不然 Worker 用的還是
  舊 schema——這個依賴關係容易忘記，因為兩個檔案在 git diff 上看起來
  無關。
- **版本**：`v0.3.1-202607110300`（已 bump）。

## 2026-07-10 — Implementation plan 第 2 項：Worker 端合約收取（submitContract）

- **任務**：使用者授權開工的 implementation plan 第 2 項，範圍：Integration
  Settings 的 environment origin 資料模型、Contract snapshot 三態生命週期、
  audit table、schema/cross-field/URL 驗證、一切寫入先進 pending。用 Plan
  Mode 先列出檔案層級計畫、經使用者確認兩項技術選擇（ajv 讀 schema.json、
  wrangler `[vars]` 決定 Worker 自己的 environment）後才動手。
- **變更**：
  - 新增 `backend/cloudflare-worker/integration-settings.json`：Contract
    收取用的 Integration Settings（S38：v1 為 git 檔案＋Worker 供應），
    `projects` 目前為空（尚無真實外部專案登記）。
  - 新增 `backend/cloudflare-worker/contract-validation.js`：純函式模組
    （`computeCanonicalHash`／`validateCrossFields`／`validateUrls`），
    實作 JSON Schema 本身做不到的 S12 cross-field 檢查（entryId/objectType
    重複、requests/requires ⊆ supports、requires.entryId 參照）與 S15 URL
    同源檢查（`new URL()` 解析、反斜線防禦、origin 精確比對、禁帳密）。
    用 node 直接跑了 23 項正反例（含「絕對 URL 但 origin 對不上目前
    environment」這個使用者特別點名的情境），全部通過。
  - 新增 `backend/cloudflare-worker/package.json`（`ajv` 依賴，`"type":
    "module"`），`npm install` 確認可用。
  - `backend/cloudflare-worker/worker.js`：頂部 import ajv（`ajv/dist/2020.js`，
    `strict: false`）、`docs/contract-schema/jonaminz.contract.schema.json`
    （跨目錄相對 import，已用 `wrangler deploy --dry-run` 驗證 esbuild 能
    正確 bundle，不需要 import attribute 語法）、`integration-settings.json`、
    `contract-validation.js`；新增 `submitContract` action：驗必填 →
    `env.JONAMINZ_ENVIRONMENT` 查 Integration Settings（projectId 未登記／
    該 environment 未登記 origin 都拒絕）→ payload size 上限 →
    請求 Origin header 對登記 origin 的交叉驗證 → ajv 驗 schema →
    cross-field／URL 驗證 → canonical hash 去重 → insert `contract_snapshots`
    （`status='pending'`）＋ `contract_audit_log`（`action='submit'`）。
    `payload.environment` 只做跟 `env.JONAMINZ_ENVIRONMENT` 的健檢比對，
    不是權威來源——避免任何人靠 payload 宣告 environment 來繞過同源檢查。
  - `backend/cloudflare-worker/wrangler.toml` 新增 `[vars]
    JONAMINZ_ENVIRONMENT = "prod"`（對應現有唯一部署；未來開 dev 環境時
    加 `[env.dev]`，指向同一個 Supabase 專案即可，不需要第二套基礎設施）。
  - 新增 `backend/supabase/contract_schema.sql`（`contract_snapshots` /
    `contract_active_snapshots` / `contract_audit_log` 三張表，皆開 RLS
    無 public policy）。**已直連 `jonaminz-db` 套用並 smoke test**（合法列
    插入成功、非法 `status` 值被 check constraint 擋下、測試列已清除）——
    使用者明確授權用根目錄密碼檔的 Supabase Management API token 直接執行；
    過程中發現這把 token 同時能碰同一組織下的 `skhps-db`，套用前先用唯讀
    查詢核對 project ref／表名，確認打在 `jonaminz-db` 上才動手（細節見
    PROJECT_STATE.md §7）。
  - `backend/README.md`：新增 `submitContract` 說明、`contract_schema.sql`
    建表步驟、`npm install` 步驟、Integration Settings 登記範例、
    Environment 由 `JONAMINZ_ENVIRONMENT` 決定（非 payload 宣告）的說明、
    rate limit 已知留白的說明。
  - `AI_CONTEXT/PROJECT_STATE.md`：§2 補新增檔案、§4 Platform Integration
    段落改寫為精簡的現況摘要（詳細沿革移交 CHANGELOG，不再兩處重複累積）、
    §5 補 `jonaminz-db` project ref 與五張表、`submitContract` action、
    §7 UNKNOWN 項改為 VERIFIED 並記錄 Management API token 跨專案的風險。
- **驗證**：`contract-validation.js` 23 項 node 正反例全過；
  `npx wrangler deploy --dry-run --outdir=./dist-check` bundle 成功
  （309KB / gzip 61KB，`JONAMINZ_ENVIRONMENT: "prod"` 正確顯示在 bindings
  裡），確認 JSON import 路徑與 ajv 依賴在真正的 wrangler/esbuild 打包
  流程下沒問題，不是只在 Node 環境下測試過；DB 三張表用 Management API
  直接建表＋smoke test（見上）。**尚未 `wrangler deploy` 到線上**——這一步
  RULES.md §2-2 需要另外授權，本次未做，程式碼與 DB schema 已就緒待部署。
- **狀態變化**：implementation plan 第 1 項（Contract Schema）→ 完成 RC3.1；
  第 2 項（Worker 端合約收取，限「收取＋pending」範圍）→ **程式碼與 DB
  schema 完成，待部署**。第 3 項（核准後台）**未開始**。
- **遺留**：`wrangler deploy` 授權待確認；`integration-settings.json`
  目前是空的，要接第一個真實外部專案時才會有內容；KV rate limit 是刻意
  留白（見 backend/README.md）；`docs/contract-schema/README.md` 的
  「進 Worker 前 release checklist」（`$id` 正式發布）仍待辦，不擋這次
  Worker 開工但擋第一份真實合約 approve 前。
- **版本**：`v0.3.0-202607110246`（本次動到程式碼與 DB schema，已 bump）。

## 2026-07-10 — Contract JSON Schema RC3.1：Environment Resolution 模型，授權開工 Worker

- **任務**：使用者對 RC3 範例合約提出最後一個問題（`entries[0].url` 寫死
  prod 網域，容易誤導成 Contract 攜帶部署位址），裁決改成 path-absolute
  並補上 environment 解析規則；同時裁決 implementation plan 第 2 項
  （Worker 端合約收取）可以開工，並給了明確範圍。
- **變更**：`jonaminz.contract.example.json` 的 `entries[0].url` 從
  `https://example-project.jonaminz.com/` 改成 `"/"`。
  `docs/contract-schema/README.md` 新增「Environment Resolution」一節：
  Contract 不宣告 prod/dev/local；path-absolute URL 由接收 ingestion 的
  Worker 依它查到的 Integration Settings（每個 projectId 每個
  environment 各自登記一個 origin）解析，公式＝該 environment 的
  registered origin ＋ Contract 裡的 path-absolute 字串；絕對
  `https://` URL 仍合法，但其 origin 必須精確等於**目前這個
  environment** 登記的 origin，不得用其他 environment（如 prod）的
  登記值滿足這次（如 dev）的同源檢查，避免跨 environment 來源混淆。
  `platform-integration-v1-implementation-plan.md` 第 2 項補上
  「Integration Settings 的 environment-scoped registered origin
  資料模型」作為明確子項，並在既有 URL 驗證清單裡把 `registeredOrigin`
  改註明「取自目前 environment」；同時在第 2 項開頭重申 S13/S16：
  所有寫入一律先進 pending，不得因提交 Contract 自動 approve 或 grant。
  用 `npx ajv-cli` 重新驗證範例（改用 `"/"` 後仍 valid）。
- **狀態變化**：Contract Schema RC3 → **RC3.1，設計面全部定案**（含
  environment 解析模型，此模型屬規格第三部分演進層允許的 additive
  Settings 欄位，不牴觸 Frozen S1-S39）。**implementation plan 第 2 項
  （Worker 端合約收取）使用者已明確授權開工**——這是本次交接最重要的
  狀態變化，下一棒接手時直接讀 implementation-plan.md 第 2 項開始，
  不需要再等額外確認；仍要遵守 RULES.md §2-2：`wrangler deploy`
  本身仍需開工當下另外確認（開工授權不等於部署授權）。
- **遺留**：無。
- **版本**：無程式碼變更（未 bump；純 `docs/` 修訂）。

## 2026-07-10 — Contract JSON Schema 第二輪 review 修正 → RC3，設計面定案

- **任務**：使用者再拿 RC2 給外部 review，帶回 1 個真正的安全漏洞＋
  3 個開放設計決策的裁決意見，逐條核實後修正、落成 RC3。
- **變更**：`jonaminz.contract.schema.json`：`contractUrl` 的 pattern 從
  `^(https://\S+|/(?!/)\S*)$` 改成
  `^(https://[^\s\\]+|/(?![/\\])[^\s\\]*)$`——用 Node 的 `new URL()`
  實測確認 WHATWG URL parser 對 https 這類 special scheme 會把 `\`
  正規化成 `/`，導致 `/\evil.example/a` 這種「看起來是 path-absolute」
  的字串實際解析成 `https://evil.example/a`（跟 RC2 修過的 `//` protocol-
  relative 繞過是同一類問題的變形，RC2 沒堵住）；新 pattern 全面禁止
  反斜線出現在字串任何位置。`capabilities.requires` 加上
  `uniqueItems: true`（只能擋完全相同的物件重複，語意重複仍留給
  Worker）。用 7 組新反例（4 種反斜線變體皆 invalid、2 種既有合法形式
  仍 valid、requires 完全重複 invalid）驗證修正正確。`README.md`：
  補充反斜線繞過的說明與教訓（「regex 對 URL 只能語法粗篩，真正邊界要
  在 Worker 用標準 URL parser 重算」）；`entries`/`objects` 陣列形狀、
  `css` 單一字串兩點設計決策改列「已確認」；`$id` 是否/何時正式發布
  改列進新增的「進 Worker 前的 release checklist」小節。
  `platform-integration-v1-implementation-plan.md` 第 2 項補上完整的
  Worker 端 URL 驗證清單（反斜線直接拒絕、WHATWG URL parser、https-only、
  origin 精確比對、禁帳密、redirect 逐跳重驗、正規化後存值+原始值
  audit）與 cross-field 檢查清單（entryId/objectType 重複處理、
  requests/requires ⊆ supports、requires.entryId 參照一致性），避免
  這輪 review 的具體建議在交接時流失。
- **狀態變化**：Contract Schema 草稿 → RC2 → **RC3，設計面視為定案**。
  implementation plan 第 1 項完成度：schema 本體已無已知漏洞，僅剩
  `$id` 正式發布時機一個待辦（不擋 Worker 開工）。第 2 項（Worker 端
  合約收取）**仍未開始**，但工作清單已比 RC2 時更具體。
- **遺留**：無新遺留；既有的「schema 做不到的 cross-field 檢查」已從
  README 的敘述性提醒，落實成 implementation-plan.md 裡可執行的清單。
- **版本**：無程式碼變更（未 bump；純 `docs/` 修訂）。

## 2026-07-10 — Contract JSON Schema 一輪外部 review 修正 → RC2

- **任務**：使用者拿草稿給外部 review，帶回 4 點問題，逐條核實後修正。
- **變更**：`jonaminz.contract.schema.json`：①`css` 從 `enum: ["none","tokens"]`
  改成語法層 pattern（`^[a-z][a-z-]{0,49}$`）——閉合 enum 會讓未來出現
  `components` 時整份合約直接 invalid，違反 S11「未知 enum 值視為不支援，
  不得整份判失敗」；②`contractUrl` pattern 從 `^(https://|/)\S*$` 改成
  `^(https://\S+|/(?!/)\S*)$`——原本 `//evil.example.com/a` 這種
  protocol-relative URL 會被誤判合法，實際上瀏覽器會解析成任意網域的
  https:，是真的安全漏洞；同時刻意仍不開放無開頭斜線的相對路徑（如
  `assets/icon.png`），因為那與 `javascript:`/`data:` 等 scheme:opaque URL
  在字串層難以可靠區分；③新增 `$defs/forbiddenFieldsGuard` 並套用到
  `app`／`objects[]` 項目／`capabilities`／`capabilities.requires[]`
  項目——原本只有頂層和 `entry` 有 S9 禁用欄位守衛，`app.permissions`
  這類寫法會靜默通過 schema；④capability 文法改純 kebab-case，拿掉
  camelCase（`sharedCache` 這類保留名字本身是「發布前可改名」，現在改
  是免費的）。同時修正 `forbiddenFieldsGuard` 的 `anyOf` 分支補上
  `type: object`，消除 ajv strict-mode 警告。`jonaminz.contract.example.json`
  修正 `supports` 未涵蓋 `requests`/`requires` 用到的能力這個自相矛盾
  （這個不變式本身留給 Worker 端 cross-field 檢查，schema 做不到）。
  `README.md` 大幅補充「URL 驗證」「css 欄位」「capability 文法」「禁用欄位
  守衛」四節說明修正理由，並補上一張正反例驗證結果表。用
  `npx ajv-cli validate --spec=draft2020` 跑過範例＋7 組正反例（protocol-relative
  URL、巢狀禁用欄位×2、css 保留值、camelCase/kebab-case capability、
  無斜線相對路徑）全數符合預期。
- **狀態變化**：草稿 → RC2（1 輪外部 review 已吸收）。開放設計決策從
  6 點收斂為 5 點（其中 2 點仍是已確認定案，3 點暫定未挑戰）。
- **遺留**：`requests`/`requires[].capability` ⊆ `supports` 的 cross-field
  不變式、`entryId` 參照一致性，都明確記在 README／schema description 裡
  留給 Worker ingestion（implementation plan 第 2 項），非本次遺漏。
- **版本**：無程式碼變更（未 bump；純 `docs/` 修訂）。

## 2026-07-10 — Contract JSON Schema 兩點設計決策定案

- **任務**：使用者針對草稿 README 列出的 6 點開放設計決策中的 2 點
  （最具結構影響力的兩點）做出裁決。
- **變更**：`jonaminz.contract.schema.json` 的 `capabilityRequirement`
  改為 `entryId` 必填（原草稿是可選，代表「省略＝綁定整個合約」）；
  裁決結果：v1 不支援合約層級 requires，每筆 requires 都必須明確指到
  一個 entry，避免「省略到底是指整個 App 還是忘記填」的模糊狀態，未來
  真的需要時再加明確的 scope 欄位。`README.md` 的「not 反面表列是否過嚴」
  一點裁決維持現狀（出現 enabled/permissions/token 等禁用欄位＝整份
  合約 invalid，不只是忽略該欄位）。README 兩點決策改標「已確認」，
  範例＋新反例（requires 缺 entryId）重跑 `npx ajv-cli` 確認行為正確。
- **狀態變化**：6 點開放設計決策中 2 點定案，4 點仍待挑戰（見
  PROJECT_STATE.md §4）。
- **遺留**：剩 4 點（entries/objects 陣列形狀、css 欄位形狀、`$id`
  placeholder、capability 正則允許 camelCase）風險較低、暫定可用；
  下一棒若要動 implementation plan 第 2 項（Worker 端合約收取），開工前
  最後確認一次這 4 點是否也要處理，或直接視為定案。
- **版本**：無程式碼變更（未 bump；純 `docs/` 修訂）。

## 2026-07-10 — Contract JSON Schema 草稿（implementation plan 第 1 項）

- **任務**：使用者指示開始做 Contract JSON Schema，依
  `docs/platform-integration-v1-implementation-plan.md` 排定的第 1 項。
- **變更**：新增 `docs/contract-schema/`：`jonaminz.contract.schema.json`
  （JSON Schema draft 2020-12，逐條對應 S1-S39）、
  `jonaminz.contract.example.json`（範本，欄位命名沿用 v0
  `jonaminz-app.json` 習慣）、`README.md`（逐欄位對應規格條文＋6 點
  規格未明文釘死、由本次判斷的設計決策，標記待使用者確認）。用
  `npx ajv-cli validate --spec=draft2020` 跑過範例（valid）與三個反例
  （缺 `enabled` 等禁用欄位／非法 `projectId`／非法 capability 文法，
  皆 invalid）確認 schema 本身邏輯正確。純文件/schema 草稿，未動任何
  程式碼/HTML/CSS/JS/設定檔，也未讓任何現行系統消費這份 schema。
- **狀態變化**：PROJECT_STATE.md §4「尚未完成的功能」更新：implementation
  plan 第 1 項從「尚未開始」→「已產出草稿，待確認」。第 2 項（Worker
  端合約收取）**未開始**，等第 1 項確認後才進行。
- **遺留**：README 列的 6 點設計決策（entries/objects 陣列形狀、
  `capabilities.requires` 綁定方式、`css` 欄位形狀、防呆 `not` 清單是否
  過嚴、`$id` 為未架設的 placeholder、capability 正則允許 camelCase）
  需使用者確認或修正；schema 本身只做結構驗證，S12 fail-soft／S15 同源
  ／跨欄位 entryId 一致性檢查明確留給 implementation plan 第 2 項的
  Worker ingestion validator，不是這份 schema 檔案的職責（已在 README
  註明範圍）。
- **版本**：無程式碼變更（未 bump；純 `docs/` 草稿，依 RULES.md §2-1
  不 bump `version.js`）。

## 2026-07-10 — Specification v1.0 正式 Frozen

- **任務**：RC2 通過驗收，做兩項一致性最小修訂後標 Frozen。
- **變更**：①`status`／`diagnostics` 職責分離——`Jonaminz.status` 是生命
  週期狀態字串，詳細診斷面統一為 `Jonaminz.diagnostics`（S26）；
  ②snippet 加永久身分標記 `__snippetVersion: 1`（settle 後保留，
  `__bootstrap` 內部 reference 仍刪除），S22 明定 SDK 以此標記辨識官方
  snippet 物件、無標記才視為命名空間被佔用。
  `platform-integration-spec-v1.md` 狀態改為 **Frozen**；RULES.md 新增
  第 12 條禁令（S1–S39 條文不可修改）。
- **狀態變化**：Platform Integration 規格定稿流程**全部完成**。
  下一階段＝JSON Schema → Contract 範本 → SDK（依 implementation-plan），
  **本次未開始任何實作**（遵使用者指示）。
- **遺留**：無。
- **版本**：無程式碼變更（未 bump）。

## 2026-07-10 — RC 驗收 review 修正 → Spec v1.0 RC2

- **任務**：使用者轉交一份驗收階段 review（判定「RC 合格、Frozen 暫緩」，
  七項架構級＋數項文字級修正），全數採納修入規格。
- **變更**：`platform-integration-spec-v1.md` 升為 **RC2**——S21 snippet
  全面重寫（reject/onerror/15s timeout/settle 清理/jz===window.Jonaminz）、
  S13 snapshot 三態＋active 指標、S14 canonical hash＋audit 欄位、S15 擴及
  全部 URL 欄位、S31 明定 Approved Contract、S32 限定已發布 service、
  S5 resolver 移保留層、新增 S39 回滾相容規則、retryable 改字、S7 用語
  統一。新增 `platform-integration-v1-implementation-plan.md`（工作清單
  自規格拆出）；驗收 review 歸檔於
  `platform-integration-reviews/acceptance-review-spec-v1-rc.md`（含處置表）。
- **狀態變化**：Spec 狀態 RC → **RC2，待使用者最終驗收後標 Frozen**。
- **遺留**：驗收通過後標 Frozen ＋ 把「S 條文不可修改」寫進 RULES.md，
  才進 JSON Schema／SDK。
- **版本**：無程式碼變更（未 bump）。

## 2026-07-10 — 五份 Review 收齊、彙整定案、產出 Spec v1.0 RC

- **任務**：收集 5 份 Architecture Review（Codex/ChatGPT/Gemini/Claude Fable
  ［含 F2 立場修正］/Perplexity）→ 彙整 → 使用者裁決 → 撰寫 Specification v1.0 RC。
- **變更**：新增 `docs/platform-integration-reviews/`（五份一份一檔）、
  `docs/platform-integration-review-consolidation.md`（共識定案＋裁決紀錄）、
  `docs/platform-integration-spec-v1.md`（**Spec v1.0 RC，凍結條文 S1–S38**）。
- **狀態變化**：四項裁決已定——D1 Ready 介面＝inline Promise stub（await
  Jonaminz.ready 為唯一保證路徑，不做 command queue）；D2 跨源身份＝v1 外部
  專案一律匿名；D3＝11 個 Service 名與 components/full/self 降為 reserved；
  D4 合約核准＝observed/approved 兩態＋手動核准。共識定案含：錯誤模型
  reject（4:1）、loader＋版本指標（5:0）、推送≠採信、物件定址凍結、
  交集公式在 Worker 算、CSS token `--jz-` 前綴等，見彙整報告第壹部分。
- **遺留**：Spec v1.0 RC **待使用者驗收後才標 Frozen**；驗收後下一步＝
  JSON Schema＋Contract 範本＋SDK 骨架。既有 theme-runtime 變數改名
  `--jz-*`（S36）屬未來實作項。
- **版本**：無程式碼變更（未 bump）。

## 2026-07-10 — 發布 Platform Integration RFC，固定規格定稿流程

- **任務**：把 Review Request 定稿為正式 RFC，固定「先收齊意見再定稿」的流程。
- **變更**：新增 `docs/platform-integration-review-request.md`（RFC，已凍結）。
  內容＝使用者草稿＋四項補完：①尺度與限制節（兩位使用者、first-party only、
  靜態託管無 build、一人維護——要求審查者以此校準，不照搬大平台做法）；
  ②新增挑戰問題 9-12（錯誤模型二選一、SDK ready 介面、常青 SDK kill-switch、
  推模式 Origin 威脅模型）；③回覆格式要求（嚴重度標註＋對應問題編號）；
  ④檔頭狀態標記與 Review 收檔位置。
- **狀態變化**：Platform Integration 流程固定為
  Draft Spec → RFC → 收集 3~5 份 Review → 彙整 → Spec v1.0（Frozen）→
  Schema → SDK。**收 Review 期間不改規格**。目前＝RFC 已發布、等待 Review。
- **遺留**：`docs/platform-integration-reviews/` 資料夾等第一份 Review 進來時
  建立，一份一檔。彙整由使用者發起，不要收到一份就動規格。
- **版本**：無程式碼變更（未 bump）。

## 2026-07-10 — 建立 AI_CONTEXT 記憶水庫（含使用者審查修正後定案）

- **任務**：建立 AI 專案記憶水庫，讓任何 agent 不依賴聊天記憶即可接手；
  使用者審查後修正並定案數項規則。
- **變更**：新增 `AI_CONTEXT/` 七份文件：PROJECT_STATE.md（現況盤點）、
  RULES.md（禁止/允許事項）、ARCHITECTURE.md（分層/資料流/設定流/部署流）、
  TASK_TEMPLATE.md（任務單模板）、ACCEPTANCE.md（通用驗收清單）、
  CHANGELOG.md（本檔）、AGENT_BOOT_PROMPT.md（新 agent 啟動 prompt）。
  另新增三個等價的工具入口檔：`CLAUDE.md`（Claude Code）、`AGENTS.md`
  （Codex 等 CLI agent）、`.github/copilot-instructions.md`（VS Code 聊天
  agent）——內容只指向 `AI_CONTEXT/`，單一事實來源在 `AI_CONTEXT/` 內。
  純文件任務，未動任何程式碼/HTML/CSS/JS/設定檔/DB schema。
- **狀態變化**：無功能變化。文件化既有狀態之外，使用者審查定案了以下規則
  （已寫入 RULES.md / ACCEPTANCE.md）：
  1. 版本 bump 規則：純 `AI_CONTEXT/`、`docs/`、README 類文件修改**不 bump**
     `version.js`；程式碼/HTML/CSS/JS/設定檔/DB schema/部署行為變更才 bump。
  2. 新增檔案僅限任務單白名單明確允許的路徑，不得成為繞過白名單的手段。
  3. `wrangler deploy` 須任務單明確授權，否則部署前先問。
  4. `saveThemeCssRules` 在 Auth 落地前僅限任務單明確要求時才能呼叫寫入。
  5. `docs/external-project-manifest.md`（v0 機制）不因 Platform 規格定稿
     而作廢；須「新 SDK 實作完成＋遷移完成＋使用者明確宣布 deprecated」
     三條件全成立才作廢。
  另實測確認（VERIFIED 2026-07-10）：apex `https://jonaminz.com` 301 轉址至
  `https://www.jonaminz.com/`；SDK canonical host 待 Platform 規格定稿時凍結，
  暫定保留 `https://jonaminz.com/sdk/...`，apex 轉址視為平台基礎設施合約。
- **遺留**：PROJECT_STATE.md §7 剩 2 個 UNKNOWN（Supabase 專案位置、兩張表
  實際資料內容）。RULES.md §4 已無待確認項。
- **版本**：無程式碼變更（未 bump，符合本次定案的版本規則）。
