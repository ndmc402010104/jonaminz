/*
檔案位置：jonaminz/pages/admin/journal/assets/js/app.js
用途：決策與待辦頁的業務入口（水庫下游層）。只能回報自己的 loading
task，不可以自己決定 css/shell ready。

2026-07-15 二次改版（使用者回饋：待辦看板不該排最下面；決策時間軸要能
點進去看更詳細的流程，不是一行 why 就結束）：
1. 版面順序改成「待辦看板在上、決策時間軸在下」——待辦是常態要看/要
   操作的，決策時間軸是參考/回顧用的，操作優先權該在前面。
2. 決策時間軸改成主從式（master-detail）：左側是精簡清單（日期/分類/
   標題/狀態），點一筆，右側（窄螢幕是下方）展開那一則的詳細流程
   （情境→考慮的選項→決定與理由→現況，四步驟，跟 OneDrive 流程圖
   同一種卡片+箭頭+分支視覺語言）。

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

  // ---------- 決策時間軸（精選，不是全部） ----------
  // tag 決定色卡：architecture／chat／bubble／onedrive／process 五種。
  // status：done（已上線）／designed（設計完成待實作）／wip（執行中/暫時）。
  // detail 是四步驟陣列：{heading, text} 一般步驟，或
  // {heading, branch:[{label,text,chosen}]} 呈現「考慮過的選項」分支。
  var DECISION_TIMELINE = [
    {
      date: "2026-07-09",
      tag: "architecture",
      tagLabel: "平台",
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
      date: "2026-07-11",
      tag: "architecture",
      tagLabel: "平台",
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
      date: "2026-07-13",
      tag: "architecture",
      tagLabel: "平台",
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
      date: "2026-07-14",
      tag: "onedrive",
      tagLabel: "OneDrive",
      title: "圖片分享不准存 Supabase",
      summary: "使用者明訂：Supabase 只存訊息列＋中繼資料，圖片本體另外走 OneDrive。",
      status: "done",
      detail: [
        { heading: "情境", text: "Chat 要做圖片分享，圖片本體要存在哪裡。" },
        { heading: "考慮的選項", branch: [
          { label: "Supabase Storage", text: "跟其他資料同一個後端，整合簡單", chosen: false },
          { label: "OneDrive", text: "使用者自己的雲端硬碟，容量大、自己掌握", chosen: true }
        ] },
        { heading: "決定與理由", text: "使用者明確表態「圖片之後要傳到 onedrive，不要用 supabase 做」——一次性的方向指示，之後所有設計都照這個前提走。" },
        { heading: "現況", text: "OneDrive Phase A（授權底座）已上線，Phase B（真正的傳圖功能）尚未開工。" }
      ]
    },
    {
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
      date: "2026-07-15",
      tag: "bubble",
      tagLabel: "App 發佈",
      title: "APK 暫時走公開 GitHub Release",
      summary: "手機下載不方便的權宜之計，等 OneDrive 自架發佈線通了就收回公開通道。",
      status: "wip",
      detail: [
        { heading: "情境", text: "使用者只用手機操作，Claude 傳的 APK 檔案在手機端下載不了，急需一個能安裝新版 App 的管道。" },
        { heading: "考慮的選項", branch: [
          { label: "自架私有分發", text: "當下就做完整的自己伺服器發佈機制", chosen: false },
          { label: "暫時開公開 GitHub Release", text: "先求有，之後再收回", chosen: true }
        ] },
        { heading: "決定與理由", text: "使用者明確要求「你先做github release，等onedrive那一條線接通，再收回來我們自己更新版本」——是一個帶著明確回收計畫的暫時方案，不是永久決定。" },
        { heading: "現況", text: "執行中（暫時）。等 OneDrive 線 Phase C（自架 APK 發佈）完成後，要 `gh release delete app-latest` 收回公開通道。" }
      ]
    },
    {
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
      date: "2026-07-15",
      tag: "onedrive",
      tagLabel: "OneDrive",
      title: "Phase B 用單一副本＋Graph 分享，不做雙寫鏡射",
      summary: "省空間、只上傳一次；接受「傳送者斷線＝對方看不到」的代價。",
      status: "designed",
      detail: [
        { heading: "情境", text: "決定雙帳號後，要決定圖片實際怎麼存——每張圖要在兩人帳號各存一份，還是只存一份、授權對方讀取。" },
        { heading: "考慮的選項", branch: [
          { label: "雙寫鏡射", text: "兩份實體副本，互相獨立，一邊斷線不影響另一邊，但佔用兩倍容量、要上傳兩次", chosen: false },
          { label: "單一副本＋Graph 分享", text: "只存一份，用 Graph 原生「分享給特定人」機制授權對方讀取，省空間但有依賴", chosen: true }
        ] },
        { heading: "決定與理由", text: "使用者問「這樣有比較省空間嗎」確認後選擇省空間版本，明確接受代價：傳送者若之後斷開連線，對方會連同舊照片一起看不到。使用者的判斷理由是兩人本來就共用資源池——「等於把獨立的1+1TB改成2TB」，不擔心這個情境。" },
        { heading: "現況", text: "設計完成，Phase B 尚未開工實作。已記錄退路：如果之後常斷線，可以改成雙寫鏡射，不用重做 Phase A 的雙帳號基礎，只是換 Worker 的上傳邏輯。" }
      ]
    },
    {
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
    }
  ];

  var STATUS_LABEL = { done: "已上線", designed: "設計完成", wip: "執行中" };

  function decisionRowHtml(item, index) {
    return (
      '<li class="jonaminz-journal-decision-row' + (index === 0 ? " is-active" : "") + '" data-decision-index="' + index + '">' +
        '<div class="jonaminz-journal-decision-row-head">' +
          '<span class="jonaminz-journal-date">' + escapeHtml(item.date) + '</span>' +
          '<span class="jonaminz-journal-tag jonaminz-journal-tag--' + escapeHtml(item.tag) + '">' + escapeHtml(item.tagLabel) + '</span>' +
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

  function renderDecisionDetail(index) {
    var root = document.querySelector("[data-decision-detail]");
    if (!root) return;
    var item = DECISION_TIMELINE[index];
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
    listRoot.innerHTML = DECISION_TIMELINE.map(decisionRowHtml).join("");
    renderDecisionDetail(0);

    listRoot.addEventListener("click", function (event) {
      var row = event.target.closest("[data-decision-index]");
      if (!row) return;
      listRoot.querySelectorAll(".jonaminz-journal-decision-row").forEach(function (el) {
        el.classList.remove("is-active");
      });
      row.classList.add("is-active");
      renderDecisionDetail(Number(row.dataset.decisionIndex));
    });
  }

  // ---------- 待辦看板 ----------

  var currentToken = null;

  function taskItemHtml(task) {
    return (
      '<li class="jonaminz-journal-task' + (task.done ? " is-done" : "") + '" data-task-id="' + escapeHtml(task.id) + '">' +
        '<label>' +
          '<input type="checkbox" data-task-toggle' + (task.done ? " checked" : "") + '>' +
          '<span>' + escapeHtml(task.text) + '</span>' +
        '</label>' +
        '<button type="button" class="jonaminz-journal-task-delete" data-task-delete aria-label="刪除">✕</button>' +
      '</li>'
    );
  }

  function renderLane(lane, rows) {
    var listRoot = document.querySelector('[data-lane-active="' + lane + '"]');
    var doneRoot = document.querySelector('[data-lane-done="' + lane + '"]');
    var doneCount = document.querySelector('[data-lane-done-count="' + lane + '"]');
    if (!listRoot || !doneRoot) return;

    var active = rows.filter(function (row) { return !row.done; });
    var done = rows.filter(function (row) { return row.done; });

    listRoot.innerHTML = active.length
      ? active.map(taskItemHtml).join("")
      : '<li class="jonaminz-journal-empty">目前沒有項目。</li>';
    doneRoot.innerHTML = done.map(taskItemHtml).join("");
    if (doneCount) doneCount.textContent = "已完成（" + done.length + "）";
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
        renderLane("for_user", rows.filter(function (r) { return r.lane === "for_user"; }));
        renderLane("for_claude", rows.filter(function (r) { return r.lane === "for_claude"; }));
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
          '<ul class="jonaminz-journal-task-list" data-lane-done="' + lane + '"></ul>' +
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
        input.disabled = true;
        window.JonaminzBackend.addProjectTask({ token: currentToken, lane: lane, text: text })
          .then(function () {
            input.value = "";
            input.disabled = false;
            loadTasks();
          })
          .catch(function (error) {
            input.disabled = false;
            window.alert("新增失敗：" + (error && error.message ? error.message : String(error)));
          });
      });
    }

    // checkbox 勾選／✕ 刪除都用事件代理掛在整個看板容器上（列表每次
    // loadTasks() 都會整個重繪，個別綁定會失效，代理在外層容器上就
    // 不用每次重繪後重新綁定）。
    var board = document.querySelector("[data-journal-board]");
    if (!board || board.dataset.bound) return;
    board.dataset.bound = "true";
    board.addEventListener("change", function (event) {
      if (!event.target.matches("[data-task-toggle]")) return;
      var li = event.target.closest("[data-task-id]");
      if (!li) return;
      var checked = event.target.checked;
      window.JonaminzBackend.toggleProjectTask({ token: currentToken, id: li.dataset.taskId, done: checked })
        .then(loadTasks)
        .catch(function (error) {
          window.alert("更新失敗：" + (error && error.message ? error.message : String(error)));
        });
    });
    board.addEventListener("click", function (event) {
      if (!event.target.matches("[data-task-delete]")) return;
      var li = event.target.closest("[data-task-id]");
      if (!li) return;
      window.JonaminzBackend.deleteProjectTask({ token: currentToken, id: li.dataset.taskId })
        .then(loadTasks)
        .catch(function (error) {
          window.alert("刪除失敗：" + (error && error.message ? error.message : String(error)));
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
      '<section class="jonaminz-journal-timeline-section">' +
        '<p class="jonaminz-admin-section-title">決策時間軸</p>' +
        '<div class="jonaminz-journal-decision-split">' +
          '<ul class="jonaminz-journal-decision-list" data-decision-list></ul>' +
          '<div class="jonaminz-journal-decision-detail" data-decision-detail></div>' +
        '</div>' +
      '</section>';

    renderDecisions();
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
