/*
檔案位置：jonaminz/pages/admin/journal/assets/js/app.js
用途：決策與待辦頁的業務入口（水庫下游層）。只能回報自己的 loading
task，不可以自己決定 css/shell ready。

2026-07-15 三次改版：
1. 補上專案真正的起源（2026-07-09 repo 第一個 commit「Scaffold jonaminz
   self-contained reservoir architecture」、2026-07-10 五個 AI 系統
   審查 RFC 後才凍結規格）——使用者回饋原本從「Core 治理」開始記錄
   太晚，漏掉最根本的誕生脈絡。
2. 決策時間軸改成依「線」分組（起源與治理／Chat／泡泡與 App 發佈／
   OneDrive／工作流程），每組內按時間排序，這樣每條線的來龍去脈連著
   看才看得懂，不是所有領域混在一起的單一時間序。
3. 待辦看板「你要做的」欄位的動作從 ✕ 刪除改成 ›（需要調整）——
   使用者指出「為什麼有X？我幹嘛不測試」：驗收項目測完發現有問題，
   該做的是把「需要怎麼調整」的說明轉去「你想叫我做的」那欄給
   Claude 接手，不是把驗收項目直接刪掉當沒發生過。「你想叫我做的」
   欄仍保留 ✕（自己加的點子不想要了，刪掉合理）。

DECISION_TIMELINE 是手動維護的精選清單（不是自動生成，日後每次出現
值得記錄的重大決策，就手動在這個陣列加一筆，跟 CHANGELOG.md 的維護
方式同一個精神：這是「精選重點＋詳細脈絡」，不是取代 AI_CONTEXT/
DECISIONS.md／CHANGELOG.md 的完整記錄，三者互補——這裡給「一眼看懂
全貌，點進去看懂為什麼」，那兩份給「完整技術細節」）。
*/
(function () {
  "use strict";

  var READY_TASK = "app-ready";

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  }

  // 決策時間軸／決策圖標題後面顯示「最後更新」，讓使用者一眼確認這兩份
  // 手動維護的清單是不是真的有跟上——不轉當地時間就直接印會跟後台首頁
  // 那個 OneDrive 時間戳一樣犯錯，這裡用同一套 toLocaleString 處理。
  function formatUpdatedAt(value) {
    if (!value) return "";
    try {
      return new Date(value).toLocaleString("zh-TW", {
        year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit", hour12: false
      });
    } catch (error) {
      return String(value);
    }
  }

  // 2026-07-15：使用者質疑「你是不是沒有在更新」，要求在標題後面加上
  // 最後更新時間——這是手動維護的常數，**每次改動 DECISION_TIMELINE
  // 這個陣列都要記得跟著更新這一行**，跟 version.js 的 bump 紀律同一
  // 個精神，寫錯/忘記更新就是自打嘴巴（畫面上寫著剛更新過，內容卻是
  // 舊的）。
  var DECISION_TIMELINE_UPDATED_AT = "2026-07-16T09:18:00+08:00";

  // ---------- 決策時間軸（精選，不是全部） ----------
  // tag 決定色卡也決定分組：architecture／chat／bubble／onedrive／
  // process 五條「線」。status：done（已上線）／designed（設計完成待
  // 實作）／wip（執行中/暫時）。detail 是四步驟陣列：{heading, text}
  // 一般步驟，或 {heading, branch:[{label,text,chosen}]} 呈現「考慮過
  // 的選項」分支。
  var DECISION_TIMELINE = [
    {
      id: "genesis-independent-reservoir",
      date: "2026-07-09",
      tag: "architecture",
      tagLabel: "起源",
      title: "jonaminz 誕生：獨立自足的水庫本體，不依賴 SKHPS",
      summary: "架構精神沿用 SKHPS 的水庫理論，但完全自成一體，不共用任何 SKHPS runtime 檔案。",
      status: "done",
      detail: [
        { heading: "情境", text: "石益昇原本的 SKHPS 專案是 GAS＋Google Sheets＋GitHub 的舊架構；jonaminz 要作為個人網站與未來多個 App 的平台本體，需要決定跟 SKHPS 的關係。" },
        { heading: "考慮的選項", branch: [
          { label: "沿用 SKHPS runtime", text: "直接依賴／共用 SKHPS 既有的水庫檔案，省事但耦合", chosen: false },
          { label: "獨立自足的新水庫", text: "沿用「水庫理論」的架構精神，但完全重新打造，不依賴 SKHPS 任何 runtime 檔案", chosen: true }
        ] },
        { heading: "決定與理由", text: "jonaminz 自己就是自己的水庫本體——8 層 CSS 疊加、loading gate、shell 機制全部重新實作一份，跟 SKHPS 完全獨立。未來 SKHPSv2 要接入 jonaminz 平台，是透過 Contract 機制以「外部專案」身分登記，不是程式碼合併。" },
        { heading: "現況", text: "已上線。2026-07-09 這個 repo 的第一個 commit 就是「Scaffold jonaminz self-contained reservoir architecture」。" }
      ]
    },
    {
      id: "genesis-multi-ai-rfc",
      date: "2026-07-10",
      tag: "architecture",
      tagLabel: "起源",
      title: "平台規格先經五個 AI 系統審查，凍結後才開工",
      summary: "Codex／ChatGPT／Gemini／Claude／Perplexity 各自審查同一份 RFC，共識後才 Frozen（S1-S39）。",
      status: "done",
      detail: [
        { heading: "情境", text: "jonaminz 要做成給多個未來 App 共用的平台，架構決策的影響範圍大，需要比一般專案更謹慎的驗證方式。" },
        { heading: "考慮的選項", branch: [
          { label: "單一 AI 直接設計", text: "由當時對話的 AI 獨自設計並直接開工", chosen: false },
          { label: "多方 AI 審查 RFC 後共識凍結", text: "發布 RFC，讓 Codex／ChatGPT／Gemini／Claude／Perplexity 五個系統各自審查，收斂成共識後才凍結規格", chosen: true }
        ] },
        { heading: "決定與理由", text: "五份獨立審查互相檢查盲點，收斂出共識，再寫成 `docs/platform-integration-spec-v1.md` 正式凍結（S1-S39）——條文凍結後不再修改，新需求只能走演進層。" },
        { heading: "現況", text: "已上線，規格 Frozen 後 implementation plan 第 1-9 項已陸續完成，詳見 `AI_CONTEXT/DECISIONS.md`。" }
      ]
    },
    {
      id: "core-governance",
      date: "2026-07-10",
      tag: "architecture",
      tagLabel: "起源",
      title: "身分/登入/Contract 治理屬於 Core",
      summary: "身分、Session、Contract 治理全部收在 Worker+Supabase，外部專案不能自己授權自己。",
      status: "done",
      detail: [
        { heading: "情境", text: "平台要決定「哪些能力放在核心（Jonathan／Minz 共用的水庫），哪些留給各自獨立的外部專案」，不然規則會各自為政、互相衝突。" },
        { heading: "考慮的選項", branch: [
          { label: "各自管理", text: "每個外部專案自己刻登入/驗證邏輯", chosen: false },
          { label: "集中在 Core", text: "外部專案只信任 Core 發出的身分，不自己驗證", chosen: true }
        ] },
        { heading: "決定與理由", text: "身分、Session（登入狀態）、Contract／Registry／Capability 治理全部是 Worker（Core 後端）持有的邏輯，外部專案永遠不直接寫入或授權自己。" },
        { heading: "現況", text: "已上線：Google OAuth＋內部密語登入，Supabase sessions 表管理登入狀態。" }
      ]
    },
    {
      id: "library-model",
      date: "2026-07-11",
      tag: "architecture",
      tagLabel: "起源",
      title: "圖書館模型：外部專案是「同一人的多本書」",
      summary: "Contract 只宣告「自己是什麼」，Registry 決定「誰看得到」——不是陌生第三方的治理模型。",
      status: "done",
      detail: [
        { heading: "情境", text: "需要一個心智模型描述 jonaminz 平台跟外部專案（movies／travel 等）的關係，避免套用不合身的「多租戶 SaaS」或「插件市場」比喻。" },
        { heading: "考慮的選項", branch: [
          { label: "多租戶 SaaS", text: "嚴格隔離、每個專案要通過審核才能上架", chosen: false },
          { label: "圖書館模式", text: "每本書＝一個專案，各自完整世界觀，平台只負責展示與最低限度規則", chosen: true }
        ] },
        { heading: "決定與理由", text: "Contract 只宣告「自己是什麼」（entries／capabilities／css），Registry／Integration Settings 決定「誰看得到、誰能進、放在哪裡」，平台不介入每本書的內容或視覺本體。" },
        { heading: "現況", text: "機制已上線，第一個真實案例是 jonaminz-movies（酒紅 Editorial 調性），平台完全不干涉它的視覺。" }
      ]
    },
    {
      id: "three-space-visual",
      date: "2026-07-13",
      tag: "architecture",
      tagLabel: "起源",
      title: "大廳／房間／後台三層視覺各自獨立",
      summary: "首頁「米紙」、Jonathan「深夜訊號」黑、Minz「手帳」風、後台「亞麻米」暖色，四套配色互不統一。",
      status: "done",
      detail: [
        { heading: "情境", text: "原本全站共用一套「亞麻米」視覺，但首頁、Jonathan／Minz 個人頁、後台的性質差異很大，硬套同一套顯得不合身。" },
        { heading: "考慮的選項", branch: [
          { label: "全站統一", text: "省事，但每個空間的個性會被磨平", chosen: false },
          { label: "三層各自獨立", text: "大廳／房間／後台各自一套配色 token", chosen: true }
        ] },
        { heading: "決定與理由", text: "首頁「米紙」輕盈紙感負責導覽；Jonathan「深夜訊號」黑色系呼應醫師的專業信任感；Minz「手帳」風有生活感；後台沿用「亞麻米」——溫暖私密的共用空間，不因為有管理功能就自動設計成冷冰冰的企業 SaaS Dashboard。" },
        { heading: "現況", text: "四套配色 token 已在 02-tokens.css 實作並上線，Playwright 驗證過零 console error。" }
      ]
    },
    {
      id: "chat-polling",
      date: "2026-07-14",
      tag: "chat",
      tagLabel: "Chat",
      title: "Chat 用 Worker polling，不做 WebSocket／Durable Object",
      summary: "先證明端到端能動的極簡 MVP，之後真的需要即時性再評估換方案。",
      status: "done",
      detail: [
        { heading: "情境", text: "要做兩人即時聊天，技術選項是 Durable Object 全雙工即時通道，或前端定時輪詢。" },
        { heading: "考慮的選項", branch: [
          { label: "Durable Object", text: "真即時，但架構複雜、要多學一套持久連線模型", chosen: false },
          { label: "Worker polling", text: "前端每幾秒問一次，簡單但有延遲", chosen: true }
        ] },
        { heading: "決定與理由", text: "先證明「兩人能傳訊息、看到已讀」這條端到端流程能動——這是交接包自己列出的「方案 C：極簡 MVP」，不是長期最終架構。" },
        { heading: "現況", text: "已上線並持續擴充（typing／reactions／reply 都是在這個 polling 基礎上加的），之後如果真的需要更即時的 presence，再評估要不要換方案 A。" }
      ]
    },
    {
      id: "chat-visual-contract",
      date: "2026-07-14",
      tag: "chat",
      tagLabel: "Chat",
      title: "視覺合約用平台元件，不是文字規格",
      summary: "chat.launcher@1 是真實 iframe 元件而非自訂規格，「用了＝合規」，平台改版全站自動跟上。",
      status: "done",
      detail: [
        { heading: "情境", text: "外部專案要嵌入 Chat 浮動入口，「長相要一致」這件事該怎麼落實。" },
        { heading: "考慮的選項", branch: [
          { label: "發規格文件", text: "外部專案照規格自己刻 UI，長相容易跑歪", chosen: false },
          { label: "提供真實元件", text: "外部專案直接掛載平台的 iframe 元件", chosen: true }
        ] },
        { heading: "決定與理由", text: "元件本體是同源小頁面（比照 identity-relay 模式），SDK 端偵測到 capability 就自動掛載——同一份程式碼跑出來的長相不會歪，平台改版時所有專案自動跟上，不用逐家重審。" },
        { heading: "現況", text: "已上線，全平台只有一份 launcher 實作，jonaminz 內部頁面也用同一份。" }
      ]
    },
    {
      id: "system-bubble-primary",
      date: "2026-07-15",
      tag: "bubble",
      tagLabel: "泡泡",
      title: "系統泡泡是日常主力，自繪覆蓋層是備援",
      summary: "對照 Messenger 等成熟 App 的手感落差後定案，把力氣留給更值得投入的地方。",
      status: "done",
      detail: [
        { heading: "情境", text: "手刻的懸浮泡泡（Messenger 式覆蓋層）細節手感一直追不上參考 App，使用者質疑「我們手刻這些人家千錘百鍊的東西真的有勝算嗎」。" },
        { heading: "考慮的選項", branch: [
          { label: "持續打磨覆蓋層", text: "追求跟 Messenger 一樣完美的手感", chosen: false },
          { label: "System Bubble 當主力", text: "Android 原生泡泡當日常，覆蓋層當備援/展示", chosen: true }
        ] },
        { heading: "決定與理由", text: "使用者的判斷標準很直接：「我們也是用了10幾年這些成品，怕是不好用到時候還是跑回去用 messenger」——日常可用性是生存線，System Bubble 已經夠用，不值得把時間繼續砸在覆蓋層的細節上。" },
        { heading: "現況", text: "已定案。覆蓋層仍完成了甩動慣性/磁吸/手勢排除/初始位置四項優化，但停在「堪用」，不再追加打磨。" }
      ]
    },
    {
      id: "apk-github-release",
      date: "2026-07-15",
      tag: "bubble",
      tagLabel: "App 發佈",
      title: "APK 暫時走公開 GitHub Release",
      summary: "手機下載不方便的權宜之計，OneDrive 自架發佈線已通、真機驗證成功，收回只差最後一步。",
      status: "wip",
      detail: [
        { heading: "情境", text: "使用者只用手機操作，Claude 傳的 APK 檔案在手機端下載不了，急需一個能安裝新版 App 的管道。" },
        { heading: "考慮的選項", branch: [
          { label: "自架私有分發", text: "當下就做完整的自己伺服器發佈機制", chosen: false },
          { label: "暫時開公開 GitHub Release", text: "先求有，之後再收回", chosen: true }
        ] },
        { heading: "決定與理由", text: "使用者明確要求「你先做github release，等onedrive那一條線接通，再收回來我們自己更新版本」——是一個帶著明確回收計畫的暫時方案，不是永久決定。" },
        { heading: "現況", text: "OneDrive 線 Phase C（自架 APK 發佈，見 onedrive-apk-selfhost 條目）已上線並完成第一次真人上傳/下載驗證。收回公開通道前的最後一步：使用者手機實際下載安裝這個 OneDrive 版本確認沒問題，過了就 `gh release delete app-latest`。" }
      ]
    },
    {
      id: "onedrive-apk-selfhost",
      date: "2026-07-15",
      tag: "onedrive",
      tagLabel: "OneDrive",
      title: "Phase C：APK 自架上線，安裝檔改用帶時間戳的獨立檔名",
      summary: "固定下載網址永遠指向 releases/ 資料夾裡最新一個檔案，不再覆蓋同一個檔名。",
      status: "done",
      detail: [
        { heading: "情境", text: "Phase A/B 底定後接著做 APK 自架（`ONEDRIVE_LINE_SPEC.md` §2.3/§7 早就排好的下一步）；上線後使用者實測回報「每次下載檔名都一樣，怕裝錯」。" },
        { heading: "考慮的選項", branch: [
          { label: "固定檔名、每次覆蓋", text: "`releases/jonaminz.apk`，實作最簡單，但手機下載/快取分不出新舊", chosen: false },
          { label: "每次上傳用帶時間戳的獨立檔名", text: "`GET /appDownload` 改成列出資料夾挑最新一筆，網址不變、檔名永遠唯一", chosen: true }
        ] },
        { heading: "決定與理由", text: "順手也發現 Android 自己的 `versionCode`/`versionName` 從第一次 build 起就沒更新過（一直是 1/\"1.0\"）——這其實是「怕裝錯」更根本的原因，兩邊一起修：OneDrive 檔名帶時間戳＋Android 版本號每次發版都要更新。" },
        { heading: "現況", text: "已上線並完成真人端到端驗證：`tools/upload-apk.mjs` 上傳成功、`GET /appDownload` 的 302 目標精確對上最新那個 itemId。過程中也踩到一次 Cloudflare 部署傳播延遲的假警報（deploy 剛完成時 curl 還打到舊版），等幾秒重試才確認真的生效。" }
      ]
    },
    {
      id: "onedrive-dual-account",
      date: "2026-07-15",
      tag: "onedrive",
      tagLabel: "OneDrive",
      title: "雙帳號模式：Jonathan／Minz 各自連自己的 OneDrive",
      summary: "兩人都想從自己帳號查得到聊天圖庫，不是共用 Jonathan 一個人的容量。",
      status: "done",
      detail: [
        { heading: "情境", text: "原設計是單一帳號（只有 Jonathan 連 OneDrive，兩人共用他的容量），使用者追問「onedrive能夠一次用兩個帳號嗎」。" },
        { heading: "考慮的選項", branch: [
          { label: "維持單一帳號", text: "簡單，但圖庫都堆在 Jonathan 一人的容量裡", chosen: false },
          { label: "雙帳號", text: "各自連自己的，各自都能查詢", chosen: true }
        ] },
        { heading: "決定與理由", text: "使用者的理由是「兩邊都想要有自己的資料可以查詢」，未來想直接連資料庫抓自己的照片。" },
        { heading: "現況", text: "已上線，Jonathan、Minz 兩人都已連接並通過測試連線。" }
      ]
    },
    {
      id: "onedrive-single-copy-share",
      date: "2026-07-15",
      tag: "onedrive",
      tagLabel: "OneDrive",
      title: "Phase B 用單一副本＋Graph 分享，不做雙寫鏡射",
      summary: "省空間、只上傳一次；接受「傳送者斷線＝對方看不到」的代價。",
      status: "done",
      detail: [
        { heading: "情境", text: "決定雙帳號後，要決定圖片實際怎麼存——每張圖要在兩人帳號各存一份，還是只存一份、授權對方讀取。" },
        { heading: "考慮的選項", branch: [
          { label: "雙寫鏡射", text: "兩份實體副本，互相獨立，一邊斷線不影響另一邊，但佔用兩倍容量、要上傳兩次", chosen: false },
          { label: "單一副本＋Graph 分享", text: "只存一份，用 Graph 原生「分享給特定人」機制授權對方讀取，省空間但有依賴", chosen: true }
        ] },
        { heading: "決定與理由", text: "使用者問「這樣有比較省空間嗎」確認後選擇省空間版本，明確接受代價：傳送者若之後斷開連線，對方會連同舊照片一起看不到。使用者的判斷理由是兩人本來就共用資源池——「等於把獨立的1+1TB改成2TB」，不擔心這個情境。" },
        { heading: "現況", text: "已上線：schema／Worker（`requestImageUpload`／`sendImageMessage`／`getImageUrls`）／前端上傳顯示 lightbox 全部完成並部署。剩下：雙方各自重新走一次 OneDrive 連接（Azure 補了 `Files.ReadWrite` 權限後才能拿到新 scope），還沒做真機互傳的最終驗收。退路仍在：如果之後常斷線，可以改成雙寫鏡射，不用重做 Phase A 的雙帳號基礎，只是換 Worker 的上傳邏輯。" }
      ]
    },
    {
      id: "onedrive-cross-identity",
      date: "2026-07-15",
      tag: "onedrive",
      tagLabel: "OneDrive",
      title: "取消「只能操作自己身分」的連接限制",
      summary: "Jonathan／Minz 本來就共用帳密，這層限制沒有實際安全意義。",
      status: "done",
      detail: [
        { heading: "情境", text: "使用者連 Minz 的 OneDrive 時，自己登入她的 jonaminz 身分＋輸入她的 Google 帳密代辦，事後問「幹嘛還要登出再登她的」。" },
        { heading: "考慮的選項", branch: [
          { label: "維持限制", text: "只能連接/測試登入者自己的身分", chosen: false },
          { label: "放寬限制", text: "任一登入者可操作任一身分的帳號", chosen: true }
        ] },
        { heading: "決定與理由", text: "兩人本來就共用帳密、彼此完全信任，「只能連自己」這層限制在他們的信任模型下沒有實際安全意義，純粹是設計上多繞的一步。" },
        { heading: "現況", text: "已上線：後台兩張 OneDrive 卡片都能直接連接／測試，不限定只能操作登入者自己那張。" }
      ]
    },
    {
      id: "github-issue-checklist",
      date: "2026-07-15",
      tag: "process",
      tagLabel: "流程",
      title: "驗收流程改用 GitHub Issue checkbox",
      summary: "使用者勾選、Claude 之後查狀態更新，取代逐項截圖來回。",
      status: "done",
      detail: [
        { heading: "情境", text: "過去驗收靠使用者截圖＋文字描述來回好幾輪（尤其鍵盤擠壓／泡泡手感那幾輪），手機操作不便、來回成本高。" },
        { heading: "考慮的選項", branch: [
          { label: "繼續截圖來回", text: "每一項都要使用者手動描述結果", chosen: false },
          { label: "GitHub Issue checkbox", text: "使用者直接勾選，Claude 之後查狀態", chosen: true }
        ] },
        { heading: "決定與理由", text: "GitHub 的 markdown checkbox 在 Issue／PR 裡是真的可勾選並持久化的（一般檔案裡的純文字 checkbox 做不到這件事）。" },
        { heading: "現況", text: "使用中，Issue #1 已經跑過兩輪驗收。" }
      ]
    },
    {
      id: "journal-page",
      date: "2026-07-15",
      tag: "process",
      tagLabel: "流程",
      title: "新增「決策與待辦」頁，趁還不複雜先記錄",
      summary: "兩人共用的工作空間，趁專案還沒變得非常複雜前，把決策脈絡趁早留下來。",
      status: "done",
      detail: [
        { heading: "情境", text: "使用者提議：在專案還沒到非常複雜的階段，趕快把一路走來的決策記錄下來，用當天 OneDrive 流程圖 Artifact 那種清楚明瞭的視覺風格。" },
        { heading: "考慮的選項", branch: [
          { label: "只寫進 CHANGELOG/DECISIONS.md", text: "完整但難以快速掃過全貌", chosen: false },
          { label: "獨立視覺化頁面＋待辦看板", text: "精選重點、點進去看詳情，加上兩人交辦事項看板", chosen: true }
        ] },
        { heading: "決定與理由", text: "這頁不取代既有文件，是給「一眼看懂全貌」用的，完整技術細節仍在 CHANGELOG.md／DECISIONS.md。待辦看板則是使用者具體提議的 Google Todo List 風格兩泳道清單。" },
        { heading: "現況", text: "已上線，這份清單本身也是手動維護的——之後每次出現值得記錄的決策，要記得手動加一筆。" }
      ]
    },
    {
      id: "task-board-origin-lock",
      date: "2026-07-15",
      tag: "process",
      tagLabel: "流程",
      title: "待辦板加 origin 規則：Claude 交辦的項目不能刪除",
      summary: "使用者用舊分頁的過期 JS 不小心刪掉一筆驗證項目，改成 Worker 端強制鎖死，不只是前端藏按鈕。",
      status: "done",
      detail: [
        { heading: "情境", text: "使用者不小心用舊分頁快取的 JS 把一筆 Claude 交辦的驗證項目整個刪掉，回報「這樣很容易東西就不見了」。" },
        { heading: "考慮的選項", branch: [
          { label: "只在前端藏刪除按鈕", text: "改畫面邏輯就好，實作快，但擋不住舊快取/直接呼叫 action 的情況——這正是這次事故發生的方式", chosen: false },
          { label: "Worker 端查 DB 現況強制擋下", text: "deleteProjectTask 查這筆的 origin，'claude' 一律拒絕，不管前端傳什麼、不管是不是舊版本", chosen: true }
        ] },
        { heading: "決定與理由", text: "使用者的原話：「你給我的我可以變到右邊，也可以變到左邊，但是不能取消，最後要到左邊的已完成，只有我自己輸入的才能取消」——落成規則：Claude 交辦的項目只能移動泳道或勾選完成（完成後自動搬回「你要做的」），永遠不能刪除；只有使用者自己打的字才有刪除按鈕。" },
        { heading: "現況", text: "已上線並用 Playwright harness 逐項驗證過，部署後另外用 curl 對正式環境確認 `ORIGIN_LOCKED` 真的擋下刪除。既有 9 筆歷史資料已人工核對回填成 `origin='claude'`。" }
      ]
    },
    {
      id: "decision-map",
      date: "2026-07-15",
      tag: "process",
      tagLabel: "流程",
      title: "新增「決策圖」：候選項目跟待辦板雙向連動",
      summary: "跟決策時間軸同一種精選精神但方向相反——記還沒做、值得考慮的下一步；加入/刪除都跟待辦板真正連動。",
      status: "done",
      detail: [
        { heading: "情境", text: "使用者要求：「把接下來可以做的東西也放到頁面裡面，這樣我們可以一直記得還有甚麼沒有做甚麼可以選擇繼續完成」。" },
        { heading: "考慮的選項", branch: [
          { label: "純靜態清單", text: "候選項目寫死顯示，加進待辦板後手動維護、容易忘記同步", chosen: false },
          { label: "source_map_id 動態連動", text: "任務帶著候選出身的 id，候選卡片是否顯示由「有沒有對應任務存在」動態算出來", chosen: true }
        ] },
        { heading: "決定與理由", text: "使用者當面糾正一個關鍵細節：「從決策圖點加入的項目按 ✕ 要回到決策圖，跟我自己打字新增的邏輯不一樣」——落地成 `source_map_id` 欄位，讓「加入後卡片消失」跟「✕ 刪除後卡片重新出現」共用同一份判斷，不用額外狀態機。" },
        { heading: "現況", text: "已上線，Playwright 測過完整迴圈（加入→候選消失→✕刪除→候選重新出現）。第一個從決策圖畢業變成真正任務的候選項目是「Chat 檔案附件」，見 chat 線同一天的條目。" }
      ]
    },
    {
      id: "chat-file-attachment",
      date: "2026-07-15",
      tag: "chat",
      tagLabel: "Chat",
      title: "Chat 檔案附件上線",
      summary: "跟圖片訊息共用同一套 OneDrive 上傳/分享管道，決策圖第一個被實作的候選項目。",
      status: "done",
      detail: [
        { heading: "情境", text: "使用者從決策圖挑選「Chat 檔案附件」優先實作（「幫我先做 chat 接著做工具包」）。" },
        { heading: "考慮的選項", branch: [
          { label: "另外重做一套上傳/分享/下載邏輯", text: "檔案跟圖片終究不是同一種東西，各自一套比較乾淨", chosen: false },
          { label: "沿用圖片訊息的 Graph 管道", text: "上傳/分享/換 downloadUrl 這件事本來就跟檔案類型無關，只是省略壓縮/縮圖那層", chosen: true }
        ] },
        { heading: "決定與理由", text: "`getImageUrls` 這支查 itemId 換 downloadUrl 的邏輯完全跟圖片無關，直接沿用不用重複做一支 `getFileUrls`；只有 `requestFileUpload`／`sendFileMessage` 是新的，且刻意保留原始檔名（`sanitizeGraphFileName` 清掉 Graph 路徑不合法字元）。" },
        { heading: "現況", text: "已上線，用 iframe 包裹的 Playwright harness（`inPanel` 判斷需要真的在 iframe 裡）測過選檔/預覽/上傳/顯示/下載完整流程。跟 Phase B 圖片訊息共用同一個前提：雙方要重新連接 OneDrive 才能拿到新 scope，分享步驟才會真的成功。" }
      ]
    },
    {
      id: "toolkit-page-launch",
      date: "2026-07-15",
      tag: "process",
      tagLabel: "流程",
      title: "新增後台「工具包」頁",
      summary: "決策圖第二個畢業的候選項目——常用開發/發佈連結集中一頁。",
      status: "done",
      detail: [
        { heading: "情境", text: "使用者自己在決策圖新增這個候選項目：「既然 APK 下載已經成功，是不是應該在後台增加一個工具包的頁面」，要能快速連到 local dev 區網測試網址跟 APK 下載連結。" },
        { heading: "考慮的選項", branch: [
          { label: "自動偵測區網 IP", text: "靜態頁面沒有辦法知道使用者現在在哪台機器、哪個網路，做不到", chosen: false },
          { label: "寫死目前已知 IP＋清楚註解", text: "接受這個限制，換網路/換電腦時手動更新一行常數即可", chosen: true }
        ] },
        { heading: "決定與理由", text: "工程量很小、價值明確：不用每次都自己記網址。IP 會變是已知、可接受的限制，程式碼裡明確寫清楚「換網路要回來改哪裡」，不追求自動化偵測。" },
        { heading: "現況", text: "已上線，純靜態頁面（沒有呼叫任何 Worker action）。用本機 dev-server.js＋Playwright（灌真實 session token，走真正的 requireLogin 流程）實際驗證版面/連結/複製按鈕都正確。" }
      ]
    },
    {
      id: "app-pull-to-refresh",
      date: "2026-07-15",
      tag: "bubble",
      tagLabel: "泡泡與 App 發佈",
      title: "App 內下拉重新整理頁面",
      summary: "解決長時間開著的 App/懸浮泡泡卡在網站部署前舊 JS 的問題，不用整個關掉重開。",
      status: "done",
      detail: [
        { heading: "情境", text: "使用者實測 Chat 檔案附件時，Minz 端一直沒顯示下載卡片、只有一行文字——查證後判斷是 Minz 的 App 長時間開著、還在跑上線前的舊 JavaScript，不是程式碼 bug；使用者接著要求「App 內下拉要可以重新整理頁面」解決這整類問題。" },
        { heading: "考慮的選項", branch: [
          { label: "改 Capacitor 內部 layout 檔案", text: "capacitor_bridge_layout_main.xml 在 node_modules 裡，改了下次 npm install/sync 會被蓋掉", chosen: false },
          { label: "程式碼事後包裝既有 WebView", text: "super.onCreate() 建好 WebView 之後，用程式碼拔出來包進 SwipeRefreshLayout 再放回原位，不動 Capacitor 自己的檔案", chosen: true }
        ] },
        { heading: "決定與理由", text: "查證發現 app 自己的 res/layout/activity_main.xml 其實從來沒被用到——BridgeActivity.onCreate() 永遠呼叫 Capacitor 內建的 capacitor_bridge_layout_main.xml。改用標準 Android 手法：拿到 WebView 現有的 parent／LayoutParams，removeView 後包進新建的 SwipeRefreshLayout，再放回原本的位置跟索引。刻意排在 setupKeyboardInsetPipe() 之後執行，讓那支已經調過好幾輪的鍵盤 inset 邏輯先拿到「原本」的 CoordinatorLayout 掛好監聽，兩者互不干擾。" },
        { heading: "現況", text: "已上線（jonaminz-mobile-app repo），下拉觸發 webView.reload()。本機沒有可連線的裝置做真機測試（無線 ADB 連線已過期），改用已上線的 OneDrive Phase C 發佈管道上傳新版 APK，請使用者自己下載安裝驗證。" }
      ]
    },
    {
      id: "connections-page-split",
      date: "2026-07-15",
      tag: "architecture",
      tagLabel: "後台架構",
      title: "OneDrive 連接狀態獨立成「連線狀態」頁",
      summary: "後台首頁只留入口卡片，OneDrive 連接/測試/重新連接搬去 /pages/admin/connections/，並刻意設計成能裝下未來其他外部服務。",
      status: "done",
      detail: [
        { heading: "情境", text: "使用者問「onedrive連線這個東西是不是應該找個地方放？工具包？還是應該另外做一個頁面專門做管理」，並補充「不一定都是給onedrive之後連接其他東西也可以在這邊檢查健康」。" },
        { heading: "考慮的選項", branch: [
          { label: "塞進工具包頁", text: "工具包刻意做成純靜態、不呼叫任何 Worker action 的快速連結頁，OneDrive 有真實登入/測試連線等後端互動，硬塞進去會混淆兩個頁面的角色", chosen: false },
          { label: "獨立開一個通用的「連線狀態」頁", text: "跟 Theme／Contract 核准同一個模式，從首頁用入口卡片連過去；命名跟結構刻意不綁死 OneDrive，之後每種連線類型各自一個 <section>，不用回頭改首頁", chosen: true }
        ] },
        { heading: "決定與理由", text: "新增 pages/admin/connections/，把 renderOnedriveSection／renderOnedriveCard 整段從首頁搬過去，首頁只留一張入口卡片。" },
        { heading: "現況", text: "已上線，OneDrive 是目前唯一的小節，之後要加其他外部服務健康檢查就在這頁多加一個小節。" }
      ]
    },
    {
      id: "task-board-archive-and-edit-scope",
      date: "2026-07-16",
      tag: "process",
      tagLabel: "流程",
      title: "待辦板：已完成項目可封存＋編輯範圍收窄成使用者自己的內容",
      summary: "永久保留的 Claude 完成紀錄改用「封存」而非刪除來清空視野；文字編輯功能限縮成只能改使用者自己打的內容，不開放編輯 Claude 的驗證說明。",
      status: "done",
      detail: [
        { heading: "情境", text: "使用者回報「永久保留可以封存嗎？不然越來越多都不知道看哪裡」；另外對第一版「不分 origin 都能編輯文字」的功能回饋「可以編輯應該是指我寫的內容吧你寫的我編輯幹嘛」。" },
        { heading: "考慮的選項", branch: [
          { label: "編輯開放給所有項目（第一版做法）", text: "邏輯簡單，但使用者認為 Claude 的「請驗證」說明文字沒有使用者編輯的必要，反而可能造成誰改的搞不清楚", chosen: false },
          { label: "編輯限縮成 origin==='user'", text: "只有使用者自己打的內容能改，Claude 交辦的驗證文字維持只能讀，跟既有的刪除權限（origin lock）同一個判斷邊界，好理解", chosen: true },
          { label: "封存/清除全部各自獨立按鈕", text: "使用者接著指出「其實可以把封存跟清除全部統一啊，就是按下去該刪除刪除該封存封存」——統一成同一顆按鈕，origin==='user' 刪除、origin==='claude' 封存，一次點擊清空「已完成」清單", chosen: true }
        ] },
        { heading: "決定與理由", text: "project_tasks 加 archived 欄位＋setProjectTaskArchived action；clearDoneProjectTasks 同時處理刪除跟封存兩種情況；編輯按鈕只在 origin==='user' 時顯示，且改成原地把文字換成多行 textarea，不再另外彈出複製一份內容的表單。" },
        { heading: "現況", text: "已上線。" }
      ]
    },
    {
      id: "apk-agent-token",
      date: "2026-07-16",
      tag: "onedrive",
      tagLabel: "OneDrive",
      title: "APK 上傳認證新增專用固定密鑰，不再每次跟使用者要個人 session token",
      summary: "createApkUploadSession 除了登入 session，也接受一把跟個人登入分開、不會過期、只給這個 action 用的鑰匙，後台自助產生/輪替。",
      status: "done",
      detail: [
        { heading: "情境", text: "使用者反映每次 agent build 完新 APK 要上傳 OneDrive，都要重新問使用者要一組活著的登入 session token（尤其使用者人在外面用手機時特別麻煩）；agent 一度試圖直接查 Supabase sessions 表撈現成 token，被 Auto Mode 安全機制正確擋下（未經授權讓真實登入憑證出現在對話紀錄）。" },
        { heading: "考慮的選項", branch: [
          { label: "每次跟使用者要個人 session token", text: "原本的作法，使用者要嘛自己跑上傳腳本、要嘛用瀏覽器書籤取值貼給 agent，每次都要人工介入", chosen: false },
          { label: "agent 直接查/建 session 冒充登入", text: "繞過 Auto Mode 對讀取真實登入憑證的限制，違反安全機制設計的意圖", chosen: false },
          { label: "另開一把 agent 專用固定密鑰", text: "跟個人登入分開、不會過期、只給 createApkUploadSession 一個 action 用（最小權限），存在 app_settings（不是 Worker secret）讓使用者能在後台頁面自助查看/輪替", chosen: true }
        ] },
        { heading: "決定與理由", text: "使用者明確要求要能在後台管理（不要純 wrangler secret put 黑盒子）——新增 requireSessionOrAgentToken()，getApkAgentTokenStatus 只回報有沒有設定/上次輪替時間，rotateApkAgentToken 產生新鑰匙覆蓋舊的，回應是唯一看得到明文的時機，沒有「讀出目前值」的 action，逼每次需要新值就重新輪替、舊值自動失效。UI 放在 pages/admin/toolkit/「Agent 存取」小節，跟這頁本來就放 APK 下載連結的定位一致。" },
        { heading: "現況", text: "已上線（Worker Version 0620940c）。tools/upload-apk.mjs 完全不用改，同一個 token 參數位置放個人 session token 或這把 agent 鑰匙都能用。" }
      ]
    }
  ];

  // ---------- 決策圖：接下來可以做的候選清單（2026-07-15 新增） ----------
  // 使用者提議：「把接下來可以做的東西也放到頁面裡面...這樣我們可以
  // 一直記得還有甚麼沒有做甚麼可以選擇繼續完成」——手動維護的精選
  // 候選清單，跟 DECISION_TIMELINE 同一種「精選重點」精神，但方向
  // 相反：那個記已經做的決定，這個記還沒做、值得考慮的下一步。挑一項
  // 按「加進你想叫我做的」會直接呼叫 addProjectTask（origin 'user'，
  // 因為是使用者自己選的，不是 Claude 片面塞進去的；同時帶
  // sourceMapId 記住這筆任務的出身）。
  //
  // 2026-07-15（同日稍後）使用者釐清規則：從決策圖點加入的項目，將來
  // 在 for_claude 被 ✕ 個別刪除時要「回到決策圖」（重新顯示候選卡片）
  // ；使用者自己從零打字新增的項目、或已經勾選完成的項目（只會透過
  // 「清除全部」批次清掉，這條路徑不會複用「‹/‹」下面這個判斷）刪除
  // 就是真的刪除，不會有候選卡片可以回去。落地方式：候選項目只要還有
  // 任一筆任務（不分泳道/完成狀態）的 source_map_id 指著它，就不顯示
  // 這張卡片（避免重複加入）——這樣「is active」的判斷跟「該不該回到
  // 決策圖」共用同一份資料，不用額外狀態機。
  //
  // 跟 DECISION_TIMELINE_UPDATED_AT 同一個規則：每次改這個陣列都要
  // 記得更新下面這個時間戳。
  var DECISION_MAP_UPDATED_AT = "2026-07-16T00:51:00+08:00";

  var DECISION_MAP = [
    {
      id: "chat-file-attachment",
      title: "Chat 檔案附件（不只圖片）",
      summary: "延伸 OneDrive Phase B/C 已經打通的上傳/分享管道，讓 Chat 可以傳一般檔案（PDF、文件）。",
      why: "上傳/下載/分享的 Graph 邏輯都已經現成（跟圖片訊息共用同一套），主要工作是前端多一種「檔名＋下載連結」卡片，不是圖片預覽那種。"
    },
    {
      id: "toolkit-page",
      title: "後台「工具包」頁面",
      summary: "快速連結：local dev 區網 IP 網址、APK 下載連結。",
      why: "使用者已經提出的需求——APK 下載連結、local dev 網址現在都要自己記，集中一頁最方便，工程量很小。"
    },
    {
      id: "chat-sticker-panel",
      title: "Chat 貼圖/常用回覆面板",
      summary: "Composer 加一個貼圖或常用回覆快速鍵面板。",
      why: "交接包 checklist 早就列過的項目，屬於錦上添花，不是急迫需求，適合手邊沒有更重要的事時再做。"
    },
    {
      id: "onedrive-chat-file-retention",
      title: "Chat OneDrive 檔案自動過期（預設 6 個月）＋設定面板",
      summary: "聊天傳的圖片/檔案目前會永久留在 OneDrive App Folder 裡，使用者提出應該預設 6 個月後自動過期；同時這類「這種東西」的設定值（過期天數等）之後應該有一個設定面板可以調整，不是寫死在程式碼裡。",
      why: "需要新增 Cron Trigger 排程（查詢逾期項目、呼叫 Graph 刪除、可能要通知使用者)，加上一個新的設定儲存機制（供之後的設定面板讀寫），份量比之前處理過的小修都大，需要先設計清楚排程頻率/刪除時機/失敗重試再動工，不適合當成單筆待辦直接做。"
    }
  ];

  function isMapCandidateActive(id) {
    var lanes = ["for_user", "for_claude"];
    for (var i = 0; i < lanes.length; i += 1) {
      for (var j = 0; j < taskCache[lanes[i]].length; j += 1) {
        if (taskCache[lanes[i]][j].source_map_id === id) return true;
      }
    }
    return false;
  }

  function decisionMapCardHtml(item) {
    return (
      '<div class="jonaminz-journal-map-card" data-map-card="' + escapeHtml(item.id) + '">' +
        '<h4 class="jonaminz-journal-map-title">' + escapeHtml(item.title) + '</h4>' +
        '<p class="jonaminz-journal-map-summary">' + escapeHtml(item.summary) + '</p>' +
        '<p class="jonaminz-journal-map-why">' + escapeHtml(item.why) + '</p>' +
        '<button type="button" class="jonaminz-journal-map-add" data-map-add data-map-id="' + escapeHtml(item.id) + '">＋ 加進你想叫我做的</button>' +
      '</div>'
    );
  }

  function renderDecisionMap() {
    var root = document.querySelector("[data-map-list]");
    if (!root) return;
    var visible = DECISION_MAP.filter(function (item) { return !isMapCandidateActive(item.id); });
    root.innerHTML = visible.length
      ? visible.map(decisionMapCardHtml).join("")
      : '<p class="jonaminz-journal-empty">候選項目都已經加進待辦板了。</p>';
  }

  function bindDecisionMapEvents() {
    var root = document.querySelector("[data-map-list]");
    if (!root) return;
    root.addEventListener("click", function (event) {
      var btn = event.target.closest("[data-map-add]");
      if (!btn) return;
      var candidate = DECISION_MAP.filter(function (item) { return item.id === btn.dataset.mapId; })[0];
      if (!candidate) return;
      btn.disabled = true;
      btn.textContent = "加入中...";
      var text = candidate.title + "：" + candidate.summary;
      var tempId = "temp-" + Date.now() + "-" + Math.random().toString(36).slice(2);
      taskCache.for_claude.push({ id: tempId, lane: "for_claude", text: text, done: false, _pending: true, origin: "user", source_map_id: candidate.id });
      renderLane("for_claude");
      renderDecisionMap();
      window.JonaminzBackend.addProjectTask({ token: currentToken, lane: "for_claude", text: text, sourceMapId: candidate.id })
        .then(function (response) {
          var found = findTask(tempId);
          if (found && response && response.row) {
            taskCache[found.lane][found.index] = response.row;
            renderLane(found.lane);
          }
        })
        .catch(function (error) {
          var found = findTask(tempId);
          if (found) {
            taskCache[found.lane].splice(found.index, 1);
            renderLane(found.lane);
          }
          // renderDecisionMap() 在樂觀更新那一刻已經整批重繪過一次
          // （把這張卡片藏起來），這裡失敗回滾後原本的 btn 參照已經是
          // 從 DOM 拔掉的舊節點，不能再直接改它的屬性——重新呼叫
          // renderDecisionMap() 讓卡片重新長出來才是對的做法。
          renderDecisionMap();
          window.alert("加入失敗：" + (error && error.message ? error.message : String(error)));
        });
    });
  }

  var STATUS_LABEL = { done: "已上線", designed: "設計完成", wip: "執行中" };
  var ROUTE_ORDER = ["architecture", "chat", "bubble", "onedrive", "process"];
  var ROUTE_GROUP_LABEL = {
    architecture: "起源與治理",
    chat: "Chat 線",
    bubble: "泡泡與 App 發佈線",
    onedrive: "OneDrive 線",
    process: "工作流程線"
  };

  function groupedDecisions() {
    var groups = {};
    DECISION_TIMELINE.forEach(function (item) {
      if (!groups[item.tag]) groups[item.tag] = [];
      groups[item.tag].push(item);
    });
    return ROUTE_ORDER.filter(function (key) { return groups[key]; }).map(function (key) {
      return { key: key, label: ROUTE_GROUP_LABEL[key] || key, items: groups[key] };
    });
  }

  function decisionRowHtml(item, isActive) {
    return (
      '<li class="jonaminz-journal-decision-row' + (isActive ? " is-active" : "") + '" data-decision-id="' + escapeHtml(item.id) + '">' +
        '<div class="jonaminz-journal-decision-row-head">' +
          '<span class="jonaminz-journal-date">' + escapeHtml(item.date) + '</span>' +
        '</div>' +
        '<div class="jonaminz-journal-decision-row-title">' + escapeHtml(item.title) + '</div>' +
        '<span class="jonaminz-journal-status jonaminz-journal-status--' + escapeHtml(item.status) + '">' + escapeHtml(STATUS_LABEL[item.status] || item.status) + '</span>' +
      '</li>'
    );
  }

  function detailStepHtml(step) {
    if (step.branch) {
      return (
        '<div class="jonaminz-journal-detail-step">' +
          '<p class="jonaminz-journal-detail-heading">' + escapeHtml(step.heading) + '</p>' +
          '<div class="jonaminz-journal-branch">' +
            step.branch.map(function (option) {
              return (
                '<div class="jonaminz-journal-branch-option' + (option.chosen ? " is-chosen" : "") + '">' +
                  (option.chosen ? '<span class="jonaminz-journal-chosen-badge">✓ 選擇</span>' : "") +
                  '<p class="jonaminz-journal-branch-label">' + escapeHtml(option.label) + '</p>' +
                  '<p class="jonaminz-journal-branch-text">' + escapeHtml(option.text) + '</p>' +
                '</div>'
              );
            }).join("") +
          '</div>' +
        '</div>'
      );
    }
    return (
      '<div class="jonaminz-journal-detail-step">' +
        '<p class="jonaminz-journal-detail-heading">' + escapeHtml(step.heading) + '</p>' +
        '<p class="jonaminz-journal-detail-text">' + escapeHtml(step.text) + '</p>' +
      '</div>'
    );
  }

  function renderDecisionDetail(id) {
    var root = document.querySelector("[data-decision-detail]");
    if (!root) return;
    var item = DECISION_TIMELINE.filter(function (d) { return d.id === id; })[0];
    if (!item) return;

    root.innerHTML =
      '<div class="jonaminz-journal-detail-head">' +
        '<span class="jonaminz-journal-date">' + escapeHtml(item.date) + '</span>' +
        '<span class="jonaminz-journal-tag jonaminz-journal-tag--' + escapeHtml(item.tag) + '">' + escapeHtml(item.tagLabel) + '</span>' +
        '<span class="jonaminz-journal-status jonaminz-journal-status--' + escapeHtml(item.status) + '">' + escapeHtml(STATUS_LABEL[item.status] || item.status) + '</span>' +
      '</div>' +
      '<h3 class="jonaminz-journal-detail-title">' + escapeHtml(item.title) + '</h3>' +
      item.detail.map(function (step, stepIndex) {
        var connector = stepIndex > 0 ? '<div class="jonaminz-journal-connector">↓</div>' : "";
        return connector + detailStepHtml(step);
      }).join("");
  }

  function renderDecisions() {
    var listRoot = document.querySelector("[data-decision-list]");
    if (!listRoot) return;

    var groups = groupedDecisions();
    var firstId = null;
    var html = "";
    groups.forEach(function (group) {
      html += '<li class="jonaminz-journal-decision-group-label">' + escapeHtml(group.label) + '</li>';
      group.items.forEach(function (item) {
        var isFirst = firstId === null;
        if (isFirst) firstId = item.id;
        html += decisionRowHtml(item, isFirst);
      });
    });
    listRoot.innerHTML = html;
    if (firstId) renderDecisionDetail(firstId);

    listRoot.addEventListener("click", function (event) {
      var row = event.target.closest("[data-decision-id]");
      if (!row) return;
      listRoot.querySelectorAll(".jonaminz-journal-decision-row").forEach(function (el) {
        el.classList.remove("is-active");
      });
      row.classList.add("is-active");
      renderDecisionDetail(row.dataset.decisionId);
    });
  }

  // ---------- 待辦看板 ----------
  // 「你要做的」(for_user)：驗收/交辦項目，勾選＝完成；發現有問題不是
  // 刪掉，是按「▾」把「需要怎麼調整」的說明轉去「你想叫我做的」給
  // Claude 接手，原項目隨之移除（不是複製兩份）。已完成的項目不再顯示
  // 動作按鈕（打勾完就結束了，不需要再轉送/刪除）。
  // 「你想叫我做的」(for_claude)：使用者自由新增的點子清單，不想要了
  // 就直接 ✕ 刪除，這裡刪除是合理的動作。
  //
  // 2026-07-15：全部改成 optimistic UI（本地 taskCache 先更新畫面，
  // API 呼叫在背景跑，失敗才回滾＋跳提示）——原本每個動作都等伺服器
  // 回應才用 loadTasks() 整批重抓，操作起來有明顯延遲。
  //
  // 2026-07-15（同日稍後）新增 origin 規則：使用者不小心用舊分頁的
  // 過期 JS 把一筆 Claude 交辦的驗證項目整個刪掉，回報「這樣很容易
  // 東西就不見了」，要求「Claude 給的項目可以左右移動，但不能取消，
  // 最後要到左邊的已完成；只有自己輸入的才能取消」。落地規則：
  // - `task.origin === "claude"`：不管在哪個泳道，動作按鈕永遠是
  //   「移動」（for_user 顯示既有的「▾」轉送流程；for_claude 顯示新的
  //   「‹」直接移回，不用附加說明），從來不顯示 ✕。勾選完成時
  //   （toggleProjectTask 回傳 movedToLane）如果伺服器把它搬回
  //   for_user，本地快取也要跟著搬，不然畫面會跟資料庫對不上。
  // - `task.origin === "user"`：不管在哪個泳道都顯示 ✕ 刪除，這是
  //   使用者自己打的字，刪掉是合理的動作。
  // 這條規則也在 Worker 端強制（deleteProjectTask 查 DB 現況擋下
  // origin='claude'），前端這裡只是配合畫成對的按鈕，不是唯一防線。
  //
  // **驗證迴圈（給操作這塊看板的 agent 看，不是給使用者看的 UI 文字）**
  // 〔使用者，2026-07-15 定案，這條被使用者當面糾正過一次——agent 曾經
  // 修完 for_claude 的項目後直接呼叫 toggleProjectTask 把它標記完成，
  // 使用者說「錯了，你改好是回到你要做的等我驗證後才打勾」〕：agent
  // 修完 `for_claude` 裡的一筆項目後，**不能自己把它標記完成**——正確
  // 做法是呼叫 `moveProjectTaskLane`（`lane:"for_user"`，可以順便帶
  // `text` 改寫成「請驗證：...」開頭），讓它回到「你要做的」但維持
  // `done:false`，由使用者自己實測後親手打勾。已經做完的事只有使用者
  // 自己知道「真的驗證過了」，agent 沒有立場替使用者按下那個勾。

  var currentToken = null;
  var taskCache = { for_user: [], for_claude: [] };
  // 純畫面暫存狀態（哪些項目目前正在原地編輯），不是任務資料本身，
  // 不放進 taskCache，重新整理頁面就會清空，這是預期行為。
  var editingTaskIds = {};

  function findTask(id) {
    var lanes = ["for_user", "for_claude"];
    for (var i = 0; i < lanes.length; i += 1) {
      var index = -1;
      for (var j = 0; j < taskCache[lanes[i]].length; j += 1) {
        if (taskCache[lanes[i]][j].id === id) { index = j; break; }
      }
      if (index !== -1) return { lane: lanes[i], index: index };
    }
    return null;
  }

  function taskItemHtml(lane, task, isDoneItem) {
    if (isDoneItem) {
      // 2026-07-16：使用者回報「永久保留的已完成項目越來越多，不知道
      // 要看哪裡」——加一顆「封存」按鈕（已封存清單裡則是「取消封存」），
      // 不是刪除，只是換一個 <details> 放，資料完全不變。
      var archiveButtonHtml = task.archived
        ? '<button type="button" class="jonaminz-journal-task-unarchive" data-task-unarchive aria-label="取消封存">還原</button>'
        : '<button type="button" class="jonaminz-journal-task-archive" data-task-archive aria-label="封存">封存</button>';
      return (
        '<li class="jonaminz-journal-task is-done" data-task-id="' + escapeHtml(task.id) + '">' +
          '<div class="jonaminz-journal-task-row">' +
            '<label>' +
              '<input type="checkbox" data-task-toggle checked>' +
              '<span>' + escapeHtml(task.text) + '</span>' +
            '</label>' +
            archiveButtonHtml +
          '</div>' +
        '</li>'
      );
    }
    var isClaudeOrigin = task.origin === "claude";
    var actionHtml;
    if (isClaudeOrigin) {
      actionHtml = lane === "for_user"
        ? '<button type="button" class="jonaminz-journal-task-escalate" data-task-escalate aria-label="需要調整">▾</button>'
        : '<button type="button" class="jonaminz-journal-task-move-back" data-task-move-back aria-label="移回你要做的">‹</button>';
    } else {
      actionHtml = '<button type="button" class="jonaminz-journal-task-delete" data-task-delete aria-label="刪除">✕</button>';
    }
    var escalateFormHtml = (lane === "for_user" && isClaudeOrigin)
      ? '<form class="jonaminz-journal-escalate" data-escalate-form hidden>' +
          '<input type="text" placeholder="說明需要怎麼調整..." data-escalate-input>' +
          '<button type="submit" aria-label="送出給 Claude">送出</button>' +
        '</form>'
      : "";
    // 2026-07-16：使用者兩點回饋修正上一輪的編輯功能——
    // (1)「可以編輯應該是指我寫的內容吧你寫的我編輯幹嘛」：範圍收窄成
    //     只有 origin==='user'（使用者自己打的）能編輯，Claude 的
    //     「請驗證」文字不開放編輯。
    // (2)「編輯直接編輯前文就好幹嘛複製到下面的編輯框框」：不再用
    //     另外彈出的表單複製一份文字，改成原地把 <span> 換成
    //     <textarea>（多行，文字長也看得清楚），編輯狀態記在
    //     editingTaskIds（純畫面暫存狀態，不寫進 taskCache）。
    var canEdit = task.origin === "user";
    var isEditing = !!editingTaskIds[task.id];
    var bodyHtml;
    if (isEditing) {
      bodyHtml =
        '<div class="jonaminz-journal-task-edit-row">' +
          '<textarea data-edit-input rows="3">' + escapeHtml(task.text) + '</textarea>' +
          '<div class="jonaminz-journal-task-edit-actions">' +
            '<button type="button" class="jonaminz-journal-task-edit-save" data-edit-save aria-label="儲存">儲存</button>' +
            '<button type="button" class="jonaminz-journal-task-edit-cancel" data-edit-cancel aria-label="取消">取消</button>' +
          '</div>' +
        '</div>';
    } else {
      bodyHtml =
        '<div class="jonaminz-journal-task-row">' +
          '<label>' +
            '<input type="checkbox" data-task-toggle>' +
            '<span>' + escapeHtml(task.text) + '</span>' +
          '</label>' +
          (canEdit ? '<button type="button" class="jonaminz-journal-task-edit" data-task-edit aria-label="編輯">✎</button>' : "") +
          actionHtml +
        '</div>';
    }
    return (
      '<li class="jonaminz-journal-task' + (task._pending ? " is-pending" : "") + '" data-task-id="' + escapeHtml(task.id) + '" data-task-text="' + escapeHtml(task.text) + '">' +
        bodyHtml +
        escalateFormHtml +
      '</li>'
    );
  }

  function renderLane(lane) {
    var listRoot = document.querySelector('[data-lane-active="' + lane + '"]');
    var doneRoot = document.querySelector('[data-lane-done="' + lane + '"]');
    var doneCount = document.querySelector('[data-lane-done-count="' + lane + '"]');
    var archivedRoot = document.querySelector('[data-lane-archived="' + lane + '"]');
    var archivedCount = document.querySelector('[data-lane-archived-count="' + lane + '"]');
    if (!listRoot || !doneRoot) return;

    var rows = taskCache[lane];
    var active = rows.filter(function (row) { return !row.done; });
    // 2026-07-16：「已完成」跟「已封存」是同一批 done===true 的項目，
    // 用 archived 這個布林分成兩個平行清單，不是巢狀關係。
    var done = rows.filter(function (row) { return row.done && !row.archived; });
    var archived = rows.filter(function (row) { return row.done && row.archived; });

    listRoot.innerHTML = active.length
      ? active.map(function (row) { return taskItemHtml(lane, row, false); }).join("")
      : '<li class="jonaminz-journal-empty">目前沒有項目。</li>';
    doneRoot.innerHTML = done.map(function (row) { return taskItemHtml(lane, row, true); }).join("");
    if (doneCount) doneCount.textContent = "已完成（" + done.length + "）";
    if (archivedRoot) archivedRoot.innerHTML = archived.map(function (row) { return taskItemHtml(lane, row, true); }).join("");
    if (archivedCount) archivedCount.textContent = "已封存（" + archived.length + "）";
  }

  function renderBothLanes() {
    renderLane("for_user");
    renderLane("for_claude");
  }

  function loadTasks() {
    window.JonaminzBackend.listProjectTasks({ token: currentToken })
      .then(function (response) {
        if (!response || !response.ok) {
          ["for_user", "for_claude"].forEach(function (lane) {
            var listRoot = document.querySelector('[data-lane-active="' + lane + '"]');
            if (listRoot) listRoot.textContent = "讀取失敗：" + ((response && response.error) || "未知錯誤");
          });
          return;
        }
        var rows = response.rows || [];
        taskCache.for_user = rows.filter(function (r) { return r.lane === "for_user"; });
        taskCache.for_claude = rows.filter(function (r) { return r.lane === "for_claude"; });
        renderBothLanes();
        // 2026-07-15：真正的 bug 根因——render() 一開始就呼叫過一次
        // renderDecisionMap()，但那時候 taskCache 還是初始的空陣列
        // （loadTasks() 是非同步的，資料還沒回來），所以候選卡片一律
        // 顯示，之後任務資料真的載入完成卻沒有再重繪一次決策圖，導致
        // 已經有對應任務的候選項目像幽靈一樣永遠留著。這裡資料真的
        // 到手之後要再呼叫一次，才能正確藏掉已經畢業的候選卡片。
        renderDecisionMap();
      })
      .catch(function (error) {
        ["for_user", "for_claude"].forEach(function (lane) {
          var listRoot = document.querySelector('[data-lane-active="' + lane + '"]');
          if (listRoot) listRoot.textContent = "讀取失敗：" + (error && error.message ? error.message : String(error));
        });
      });
  }

  function laneHtml(lane, title, placeholder) {
    return (
      '<div class="jonaminz-journal-lane">' +
        '<h3>' + escapeHtml(title) + '</h3>' +
        '<form class="jonaminz-journal-add" data-lane-form="' + lane + '">' +
          '<input type="text" placeholder="' + escapeHtml(placeholder) + '" data-lane-input="' + lane + '" required>' +
          '<button type="submit">新增</button>' +
        '</form>' +
        '<ul class="jonaminz-journal-task-list" data-lane-active="' + lane + '">讀取中...</ul>' +
        '<details class="jonaminz-journal-done">' +
          '<summary data-lane-done-count="' + lane + '">已完成</summary>' +
          '<button type="button" class="jonaminz-journal-clear-done" data-lane-clear-done="' + lane + '">清除全部</button>' +
          '<ul class="jonaminz-journal-task-list" data-lane-done="' + lane + '"></ul>' +
        '</details>' +
        // 2026-07-16：使用者回報「永久保留的已完成項目越來越多，不知道
        // 要看哪裡」——封存是獨立於「已完成」的第二個 <details>，預設
        // 也是收合的，跟「已完成」平行，不是巢狀在裡面（巢狀會讓已經
        // 很長的清單更難點開）。
        '<details class="jonaminz-journal-archived">' +
          '<summary data-lane-archived-count="' + lane + '">已封存</summary>' +
          '<ul class="jonaminz-journal-task-list" data-lane-archived="' + lane + '"></ul>' +
        '</details>' +
      '</div>'
    );
  }

  function bindLaneEvents(lane) {
    var form = document.querySelector('[data-lane-form="' + lane + '"]');
    var input = document.querySelector('[data-lane-input="' + lane + '"]');
    if (form) {
      form.addEventListener("submit", function (event) {
        event.preventDefault();
        var text = input.value.trim();
        if (!text) return;
        input.value = "";
        var tempId = "temp-" + Date.now() + "-" + Math.random().toString(36).slice(2);
        taskCache[lane].push({ id: tempId, lane: lane, text: text, done: false, _pending: true });
        renderLane(lane);
        window.JonaminzBackend.addProjectTask({ token: currentToken, lane: lane, text: text })
          .then(function (response) {
            var found = findTask(tempId);
            if (found && response && response.row) {
              taskCache[found.lane][found.index] = response.row;
              renderLane(found.lane);
            }
          })
          .catch(function (error) {
            var found = findTask(tempId);
            if (found) {
              taskCache[found.lane].splice(found.index, 1);
              renderLane(found.lane);
            }
            window.alert("新增失敗：" + (error && error.message ? error.message : String(error)));
          });
      });
    }

    var clearBtn = document.querySelector('[data-lane-clear-done="' + lane + '"]');
    if (clearBtn) {
      clearBtn.addEventListener("click", function () {
        // 2026-07-16：使用者回報「其實可以把封存跟清除全部統一啊，就是
        // 按下去該刪除刪除該封存封存」——原本 origin==='claude' 的完成
        // 項目完全不動，按下去只清一半，「已完成」清單永遠清不空。改成
        // 同一顆按鈕做兩件事：origin==='user' 照舊刪除；
        // origin==='claude' 改成標記封存（不是刪除，搬去「已封存」），
        // Worker 端 clearDoneProjectTasks 同一次呼叫兩者都處理。
        var toDelete = taskCache[lane].filter(function (t) { return t.done && t.origin === "user"; });
        var toArchive = taskCache[lane].filter(function (t) { return t.done && t.origin === "claude" && !t.archived; });
        if (!toDelete.length && !toArchive.length) {
          var allDone = taskCache[lane].filter(function (t) { return t.done; });
          if (allDone.length) {
            window.alert("沒有可清除的項目——已完成清單裡的項目都已經封存過了。");
          }
          return;
        }
        var previousArchivedFlags = toArchive.map(function (t) { return t.archived; });
        toArchive.forEach(function (t) { t.archived = true; });
        taskCache[lane] = taskCache[lane].filter(function (t) { return !(t.done && t.origin === "user"); });
        renderLane(lane);
        window.JonaminzBackend.clearDoneProjectTasks({ token: currentToken, lane: lane })
          .catch(function (error) {
            taskCache[lane] = taskCache[lane].concat(toDelete);
            toArchive.forEach(function (t, i) { t.archived = previousArchivedFlags[i]; });
            renderLane(lane);
            window.alert("清除失敗：" + (error && error.message ? error.message : String(error)));
          });
      });
    }

    // checkbox 勾選／刪除／›轉送 都用事件代理掛在整個看板容器上（列表
    // 每次重繪都會整個換掉，個別綁定會失效，代理在外層容器上就不用
    // 每次重繪後重新綁定）。只在第一次呼叫時掛一次。
    var board = document.querySelector("[data-journal-board]");
    if (!board || board.dataset.bound) return;
    board.dataset.bound = "true";

    board.addEventListener("change", function (event) {
      if (!event.target.matches("[data-task-toggle]")) return;
      var li = event.target.closest("[data-task-id]");
      if (!li) return;
      var found = findTask(li.dataset.taskId);
      if (!found) return;
      var task = taskCache[found.lane][found.index];
      var previousDone = task.done;
      var previousLane = found.lane;
      var checked = event.target.checked;
      task.done = checked;

      // 跟 Worker 端 toggleProjectTask 同一條規則：Claude 交辦的項目
      // 打勾完成時，不管當下在哪個泳道，一律搬回 for_user——這裡先
      // 樂觀套用同一條規則，成功回應不用再處理，失敗才連同 done 一起
      // 回滾泳道。
      var didMoveLane = false;
      if (checked && task.origin === "claude" && found.lane === "for_claude") {
        taskCache.for_claude.splice(found.index, 1);
        task.lane = "for_user";
        taskCache.for_user.push(task);
        didMoveLane = true;
        renderBothLanes();
      } else {
        renderLane(found.lane);
      }

      window.JonaminzBackend.toggleProjectTask({ token: currentToken, id: task.id, done: checked })
        .catch(function (error) {
          task.done = previousDone;
          if (didMoveLane) {
            var idx = taskCache.for_user.indexOf(task);
            if (idx !== -1) taskCache.for_user.splice(idx, 1);
            task.lane = previousLane;
            taskCache[previousLane].push(task);
            renderBothLanes();
          } else {
            renderLane(found.lane);
          }
          window.alert("更新失敗：" + (error && error.message ? error.message : String(error)));
        });
    });

    board.addEventListener("click", function (event) {
      if (event.target.matches("[data-task-archive], [data-task-unarchive]")) {
        var archiveTargetLi = event.target.closest("[data-task-id]");
        if (!archiveTargetLi) return;
        var archiveFound = findTask(archiveTargetLi.dataset.taskId);
        if (!archiveFound) return;
        var archiveTask = taskCache[archiveFound.lane][archiveFound.index];
        var previousArchived = archiveTask.archived;
        var nextArchived = event.target.matches("[data-task-archive]");
        archiveTask.archived = nextArchived;
        renderLane(archiveFound.lane);
        window.JonaminzBackend.setProjectTaskArchived({ token: currentToken, id: archiveTask.id, archived: nextArchived })
          .catch(function (error) {
            archiveTask.archived = previousArchived;
            renderLane(archiveFound.lane);
            window.alert((nextArchived ? "封存" : "取消封存") + "失敗：" + (error && error.message ? error.message : String(error)));
          });
        return;
      }
      if (event.target.matches("[data-task-delete]")) {
        var deleteLi = event.target.closest("[data-task-id]");
        if (!deleteLi) return;
        var deleteFound = findTask(deleteLi.dataset.taskId);
        if (!deleteFound) return;
        var removedTask = taskCache[deleteFound.lane].splice(deleteFound.index, 1)[0];
        renderLane(deleteFound.lane);
        // 使用者要求：如果這筆是從決策圖加進來的（有 source_map_id），
        // ✕ 刪除要讓對應的候選卡片重新出現——樂觀更新這裡先重繪一次，
        // 失敗回滾時再重繪一次把候選卡片藏回去（任務畢竟還存在）。
        if (removedTask.source_map_id) renderDecisionMap();
        window.JonaminzBackend.deleteProjectTask({ token: currentToken, id: removedTask.id })
          .catch(function (error) {
            taskCache[deleteFound.lane].push(removedTask);
            renderLane(deleteFound.lane);
            if (removedTask.source_map_id) renderDecisionMap();
            window.alert("刪除失敗：" + (error && error.message ? error.message : String(error)));
          });
        return;
      }
      if (event.target.matches("[data-task-edit]")) {
        var editLi = event.target.closest("[data-task-id]");
        if (!editLi) return;
        editingTaskIds[editLi.dataset.taskId] = true;
        var editFoundForRender = findTask(editLi.dataset.taskId);
        if (!editFoundForRender) return;
        renderLane(editFoundForRender.lane);
        var newEditArea = document.querySelector('[data-task-id="' + editLi.dataset.taskId + '"] [data-edit-input]');
        if (newEditArea) {
          newEditArea.focus();
          newEditArea.select();
        }
        return;
      }
      if (event.target.matches("[data-edit-cancel]")) {
        var cancelLi = event.target.closest("[data-task-id]");
        if (!cancelLi) return;
        delete editingTaskIds[cancelLi.dataset.taskId];
        var cancelFound = findTask(cancelLi.dataset.taskId);
        if (cancelFound) renderLane(cancelFound.lane);
        return;
      }
      if (event.target.matches("[data-edit-save]")) {
        var saveLi = event.target.closest("[data-task-id]");
        if (!saveLi) return;
        var saveFound = findTask(saveLi.dataset.taskId);
        if (!saveFound) return;
        var saveTextarea = saveLi.querySelector("[data-edit-input]");
        var savedText = saveTextarea ? saveTextarea.value.trim() : "";
        if (!savedText) return;
        var saveTask = taskCache[saveFound.lane][saveFound.index];
        var previousSavedText = saveTask.text;
        saveTask.text = savedText;
        delete editingTaskIds[saveTask.id];
        renderLane(saveFound.lane);

        window.JonaminzBackend.moveProjectTaskLane({ token: currentToken, id: saveTask.id, lane: saveFound.lane, text: savedText })
          .catch(function (error) {
            saveTask.text = previousSavedText;
            renderLane(saveFound.lane);
            window.alert("編輯失敗：" + (error && error.message ? error.message : String(error)));
          });
        return;
      }
      if (event.target.matches("[data-task-escalate]")) {
        var escalateLi = event.target.closest("[data-task-id]");
        if (!escalateLi) return;
        var escalateForm = escalateLi.querySelector("[data-escalate-form]");
        if (!escalateForm) return;
        escalateForm.hidden = !escalateForm.hidden;
        // 使用者要求：按鈕本身的箭頭要跟著開合狀態變化——一開始是向下
        // 箭頭（▾），點下去變成向上箭頭（▴）同時彈出說明輸入框跟送出
        // 按鈕；再按一次向上箭頭＝取消，不用另外做一顆取消按鈕。
        // 2026-07-15：第一版用「›⇄⌃」，使用者糾正「一開始應該是向下
        // 箭頭」，改用實心三角形（▾/▴）明確表達方向，不用容易被誤讀
        // 成「前進/收回」的角括號。
        event.target.textContent = escalateForm.hidden ? "▾" : "▴";
        event.target.setAttribute("aria-label", escalateForm.hidden ? "需要調整" : "取消轉送");
        if (!escalateForm.hidden) {
          var escalateInput = escalateForm.querySelector("[data-escalate-input]");
          if (escalateInput) escalateInput.focus();
        }
        return;
      }
    });

    // 2026-07-15：原本只靠 Enter 送出、沒有按鈕，使用者實測回報在手機
    // 上不夠直觀（不知道怎麼送出）——補回一個「送出」按鈕，按 Enter
    // 也一樣能送出（不衝突）；「取消」還是不用另外做，展開後箭頭變成
    // ▴，再按一次就等於收起來（見上面 escalate 按鈕的點擊處理）。
    // 2026-07-15（同日稍後）：origin 規則上線後，轉送改成直接 UPDATE
    // 同一筆的 lane/text（呼叫 moveProjectTaskLane 帶 text），不再是
    // 「新增一筆＋刪除原筆」——Claude 交辦的項目現在禁止刪除，原本的
    // delete 呼叫會被 Worker 擋下來，而且直接 UPDATE 本來就更精簡。
    board.addEventListener("submit", function (event) {
      if (!event.target.matches("[data-escalate-form]")) return;
      event.preventDefault();
      var li = event.target.closest("[data-task-id]");
      if (!li) return;
      var found = findTask(li.dataset.taskId);
      if (!found) return;
      var input = event.target.querySelector("[data-escalate-input]");
      var note = input.value.trim();
      var task = taskCache[found.lane][found.index];
      var previousText = task.text;
      var previousLane = found.lane;
      var newText = note ? (task.text + "：" + note) : task.text;

      taskCache[found.lane].splice(found.index, 1);
      task.lane = "for_claude";
      task.text = newText;
      taskCache.for_claude.push(task);
      renderBothLanes();

      window.JonaminzBackend.moveProjectTaskLane({ token: currentToken, id: task.id, lane: "for_claude", text: newText })
        .catch(function (error) {
          var idx = taskCache.for_claude.indexOf(task);
          if (idx !== -1) taskCache.for_claude.splice(idx, 1);
          task.lane = previousLane;
          task.text = previousText;
          taskCache[previousLane].push(task);
          renderBothLanes();
          window.alert("轉送失敗：" + (error && error.message ? error.message : String(error)));
        });
    });

    // 「‹ 移回你要做的」：只有 for_claude 裡 origin==='claude' 的項目
    // 才會顯示這顆按鈕（見 taskItemHtml）。單純換 lane，不用附加說明、
    // 也不改文字，跟「▾」轉送刻意不同——回頭不需要解釋原因。
    board.addEventListener("click", function (event) {
      if (!event.target.matches("[data-task-move-back]")) return;
      var li = event.target.closest("[data-task-id]");
      if (!li) return;
      var found = findTask(li.dataset.taskId);
      if (!found) return;
      var task = taskCache[found.lane][found.index];
      var previousLane = found.lane;

      taskCache[found.lane].splice(found.index, 1);
      task.lane = "for_user";
      taskCache.for_user.push(task);
      renderBothLanes();

      window.JonaminzBackend.moveProjectTaskLane({ token: currentToken, id: task.id, lane: "for_user" })
        .catch(function (error) {
          var idx = taskCache.for_user.indexOf(task);
          if (idx !== -1) taskCache.for_user.splice(idx, 1);
          task.lane = previousLane;
          taskCache[previousLane].push(task);
          renderBothLanes();
          window.alert("移動失敗：" + (error && error.message ? error.message : String(error)));
        });
    });
  }

  function render() {
    var root = document.querySelector("[data-app-root]");
    if (!root) return;

    root.innerHTML =
      '<section class="jonaminz-journal-board" data-journal-board>' +
        '<p class="jonaminz-admin-section-title">待辦看板</p>' +
        '<div class="jonaminz-journal-lanes">' +
          laneHtml("for_user", "你要做的", "新增一件交辦事項...") +
          laneHtml("for_claude", "你想叫我做的", "新增一件之後要做的事...") +
        '</div>' +
      '</section>' +
      '<section class="jonaminz-journal-map-section">' +
        '<p class="jonaminz-admin-section-title">決策圖：接下來可以做的' +
        '<span class="jonaminz-journal-updated-at">最後更新：' + escapeHtml(formatUpdatedAt(DECISION_MAP_UPDATED_AT)) + '</span></p>' +
        '<p class="jonaminz-page-subtitle">還沒排進待辦板，但值得記住的候選項目——挑一個加進「你想叫我做的」就會變成真正的待辦。</p>' +
        '<div class="jonaminz-journal-map-list" data-map-list></div>' +
      '</section>' +
      '<section class="jonaminz-journal-timeline-section">' +
        '<p class="jonaminz-admin-section-title">決策時間軸' +
        '<span class="jonaminz-journal-updated-at">最後更新：' + escapeHtml(formatUpdatedAt(DECISION_TIMELINE_UPDATED_AT)) + '</span></p>' +
        '<div class="jonaminz-journal-decision-split">' +
          '<ul class="jonaminz-journal-decision-list" data-decision-list></ul>' +
          '<div class="jonaminz-journal-decision-detail" data-decision-detail></div>' +
        '</div>' +
      '</section>';

    renderDecisions();
    renderDecisionMap();
    bindDecisionMapEvents();
    bindLaneEvents("for_user");
    bindLaneEvents("for_claude");
    loadTasks();
  }

  function init() {
    window.JonaminzIdentity.requireLogin().then(function () {
      try {
        currentToken = (window.JonaminzIdentity && window.JonaminzIdentity.readToken)
          ? window.JonaminzIdentity.readToken() : null;
        render();
        window.JonaminzLoading.done(READY_TASK);
      } catch (error) {
        console.error("[jonaminz] admin/journal app.js init failed", error);
        window.JonaminzLoading.fail(READY_TASK, error);
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
