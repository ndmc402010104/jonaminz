/*
檔案位置：jonaminz/assets/js/chat-launcher.js
用途：水庫 shell 層——在 jonaminz 內部每一頁注入浮動 Chat 入口。真正的
按鈕/面板本體住在 pages/chat-launcher/（大頭貼）與 pages/chat-panel/
（面板），這裡只是薄薄的注入器，同時管理這兩個獨立的 iframe，以及
（第七次修正起）蓋在大頭貼上面、實際處理拖動/點擊手勢的透明覆蓋層。

2026-07-14：從 header.js 拆出來獨立成自己的 shell script，後來改成
iframe 模式（外部專案跟內部頁面共用同一份實作）。

2026-07-14（同日第三次修正，教訓見 CHANGELOG）：原本大頭貼跟面板擠在
同一個 iframe 裡（靠內部視圖切換 + 宿主端 border-radius 裁形狀解決
Android 上 iframe 內部透明不可靠的問題），但一個 iframe 只能裁一種
形狀，逼得展開時要把大頭貼縮成面板內部的「迷你版」——使用者在真實
裝置上連續兩輪回報「還是被蓋住/收不回來」，因為大頭貼本質上該是面板
外面一個永遠存在的獨立元素，不是塞進面板內部的裝飾。

2026-07-14（同日第四次修正）：兩個獨立 iframe 部署上線後，使用者手機
上還是看到「圈圈在對話框裡面」——不是新架構本身的問題，是 `<iframe>`
的 `src` 這個網址本身完全沒有 cache-busting（跟 script/style 走
withVersion() 不一樣），所以瀏覽器/WebView 直接把今天稍早那幾輪
「大頭貼塞在面板內部」的舊版 `pages/chat-launcher/`／`pages/chat-panel/`
HTML 當快取命中，即使外層 chat-launcher.js 本身已經正確更新成兩個
iframe 的新版也沒用。修法：iframe 的 `src` 也加上跟 mountChat() 這次
呼叫綁定的 cache-buster 查詢字串，強迫每次頁面重新載入都真的重新跟
伺服器要一次。

2026-07-14（第七次修正）：兩個獨立 iframe 上線後使用者又提兩個新需求：
1. 面板每次點開都要重新 mount/fetch，會閃一下「載入中」——使用者要的是
   「隨時 realtime 都是最新的，點擊只是展示」。改法：面板 iframe 現在
   **一開始（跟大頭貼同時）就建立**，一直掛著在背景跑
   `chat-thread.js` 自己的 poll（不受要不要顯示影響），開關面板只是
   切換 CSS 可見度（`jcl-panel-hidden` class），不再整個 create/remove
   iframe——所以使用者點開時內容早就是最新的，沒有重新載入的空檔。
2. 大頭貼要能自由拖動，點一下（不是拖動）才回彈固定角落＋開關面板
   （參考 Android 原生「聊天泡泡」的互動模型）。

   **這項的第一版做法**（已放棄）：拖動手勢判斷放在
   pages/chat-launcher/ 自己的 iframe 文件裡（pointerdown/move/up 全部
   同一個 document），量出位移後才 postMessage 給宿主。Playwright 實測
   發現：一旦拖動距離超出這個 iframe 原本 64x64 的範圍，
   `setPointerCapture` 對後續 pointermove 的位移回報就開始失準（量到的
   位移只剩實際移動量的一半左右左右）——這是真的碰到「pointer capture
   能不能可靠跨 iframe 邊界持續轉發」這個瀏覽器行為的邊界，拖動距離越大
   風險越高，不能冒險上真機。

   **現在的做法**：拖動/點擊手勢判斷整個移到這裡（宿主頁面自己的
   document），做法是在大頭貼 iframe 正上方（z-index 更高）蓋一個
   完全透明、大小/位置永遠跟 iframe 同步的 `<div>` 覆蓋層，
   pointerdown/move/up 全部發生在這個覆蓋層上——覆蓋層是宿主自己文件裡
   的普通元素，pointer capture 不必跨任何 iframe 邊界，沒有前述失準
   風險。大頭貼 iframe 本身（pages/chat-launcher/）因此變回純展示元件，
   不再處理任何 pointer 事件。

2026-07-14（第八次修正，拖動行為微調）：使用者實機試用後三個回饋：
(1) 拖動放開應該「飛」到最近的左右邊緣（像 iOS AssistiveTouch），不是
停在放開的任意位置；(2) 面板開著的時候大頭貼要鎖在固定角落、不能拖動，
直到關閉；(3) 關閉面板後要還原回「開啟前」的位置，不是每次都回預設
右下角。改法：`freeLeft`/`freeTop` 記住「拖動吸邊後的休息位置」
（`null` 代表從沒拖過、維持在預設錨點），開面板時用 `lockToOpenAnchor()`
鎖到固定角落（面板期間 `pointermove` 直接忽略，擋掉拖動），關面板時用
`restoreRestingPosition()` 還原。`animateTo()` 包一層短暫的 CSS
transition，讓吸邊/鎖定/還原這幾個瞬間都有平滑的飛行動畫，不是硬切。

`border-radius`／`box-shadow` 直接套在這裡建立的兩個 `<iframe>` 元素
本身（不依賴 iframe 內部透明）。尺寸數字跟 sdk-src/sdk.js 的
mountChatLauncher() 是刻意重複的兩份（跟 TOKEN_KEY/readToken() 那組
小工具一樣的理由：這批 shell script/SDK 注入器彼此獨立，不互相依賴）。

沒登入時要不要嵌 iframe：交給 embed 頁自己判斷（沒 token 就不顯示
大頭貼，面板本來就要點大頭貼才會建立），這裡只做一個粗篩（有 token
才嵌 Iframe A）省掉多數未登入頁面的 iframe 載入成本。
*/
(function () {
  "use strict";

  var TOKEN_KEY = "jonaminz.sessionToken";
  var LAUNCHER_PATH = "/pages/chat-launcher/";
  var PANEL_PATH = "/pages/chat-panel/";
  var CHAT_PATH = "/pages/chat/";
  var LAUNCHER_CLASS = "jonaminz-chat-launcher-frame";
  var OVERLAY_CLASS = "jonaminz-chat-launcher-overlay";
  var PANEL_CLASS = "jonaminz-chat-panel-frame";
  // 2026-07-14（第九次修正）：使用者實機回報兩個問題：(1) 長按大頭貼
  // 會冒出瀏覽器預設的長按框框/選取提示（FB 那種原生 View 完全不會有
  // 這個問題，因為它根本不經過瀏覽器的觸控事件模型）——加上
  // -webkit-touch-callout/-webkit-user-select/-webkit-user-drag 全部
  // 設為 none 關掉。(2) 大頭貼吸邊之後，從休息位置要再次拖動時很容易
  // 誤觸 Android 系統手勢返回（螢幕最邊緣那條窄帶是系統保留給「滑邊緣
  // 返回」的手勢區，觸控從那裡開始很容易被系統攔截，不會進到我們的
  // pointerdown）——原生 App（FB）可以呼叫
  // `View.setSystemGestureExclusionRects()` 完全排除這個問題，但純
  // 網頁沒有對應的 API 可以用，只能讓大頭貼的休息位置離螢幕真正邊緣
  // 遠一點，降低觸控落在系統手勢區內的機率（不是 100% 保證，是網頁
  // 天生的限制，跟原生 App 沒辦法比）。ANCHOR_RIGHT 從 14 加大到 28。
  var ANCHOR_RIGHT = 28;
  // GAP_BELOW_LAUNCHER：面板頂端跟大頭貼底端的間距。64=大頭貼高度，
  // 14=間距，加起來就是面板 top 要比大頭貼 top 多讓出來的空間。
  var GAP_BELOW_LAUNCHER = 64 + 14;
  var DRAG_THRESHOLD = 8;
  var AVATAR_CLIP_ID = "jcl-avatar-clip";

  // 2026-07-14（第十三次修正）：未讀角標／在線小綠點原本貼著大頭貼
  // iframe（64x64 方形文件）的角落，但外層 <iframe> 被宿主裁成正圓，
  // 角標超出圓的部分就被裁掉一角——第十輪的做法是把角標「縮進去」避開
  // 裁切，使用者指出這是偷吃步，正確做法應該是讓角標像 FB／多數 App 一樣
  // 漂亮地畫在圓圈外面。真正的修法：裁切形狀從單純的正圓換成「正圓 +
  // 角標位置的小圓 + 小綠點位置的小圓」union 起來的複合形狀——CSS
  // `clip-path` 的 basic shape（`circle()`）沒辦法用逗號 union 多個形狀，
  // 要用 SVG `<clipPath>`（原生支援多個子形狀 union）搭配
  // `clip-path:url(#id)` 引用。座標算過：大頭貼 iframe 64x64、主圓
  // r=32；角標(20x20,top:2/right:2)中心約(52,12)，對角距離~14.14，用
  // r=15 留緩衝；小綠點(13x13,right:4/bottom:5)中心約(53.5,52.5)，對角
  // 距離~9.19，用 r=11 留緩衝。（跟之前「內部透明不可靠」是同一類技巧：
  // 裁切形狀本身在宿主端定義，不依賴 iframe 內部透不透明。）
  function ensureAvatarClipPath() {
    if (document.getElementById(AVATAR_CLIP_ID)) return;
    var svgNs = "http://www.w3.org/2000/svg";
    var svg = document.createElementNS(svgNs, "svg");
    svg.setAttribute("width", "0");
    svg.setAttribute("height", "0");
    svg.style.position = "absolute";
    var clipPath = document.createElementNS(svgNs, "clipPath");
    clipPath.setAttribute("id", AVATAR_CLIP_ID);
    clipPath.setAttribute("clipPathUnits", "userSpaceOnUse");
    [
      { cx: 32, cy: 32, r: 32 },   // 主要的大頭貼正圓
      { cx: 52, cy: 12, r: 15 },   // 未讀角標（top:2/right:2）的位置
      { cx: 53.5, cy: 52.5, r: 11 } // 在線小綠點（right:4/bottom:5）的位置
    ].forEach(function (spec) {
      var circle = document.createElementNS(svgNs, "circle");
      circle.setAttribute("cx", spec.cx);
      circle.setAttribute("cy", spec.cy);
      circle.setAttribute("r", spec.r);
      clipPath.appendChild(circle);
    });
    svg.appendChild(clipPath);
    // 掛在 <head> 不是 <body>：SVG defs/clipPath 本身不是可見內容，不需要
    // 等 document.body 存在（跟上面 <style> 標籤是同一個安全考量）。
    document.head.appendChild(svg);
  }

  function mountChat() {
    if (document.querySelector("." + LAUNCHER_CLASS)) return;
    if (window.location.pathname.indexOf(CHAT_PATH) === 0) return;

    var token = null;
    try { token = window.localStorage.getItem(TOKEN_KEY); } catch (error) { token = null; }
    if (!token) return;

    ensureAvatarClipPath();

    // 2026-07-14（第十一次修正）：使用者要求「整個展開後泡泡的位置」
    // 也移到頁首下方，不要只有收合時的休息位置改、展開時還是跳回右
    // 下角（原本右下角一樣會壓到「Jonathan」連結）。這次把「休息錨點」
    // 跟「展開錨點」直接統一成同一個位置——大頭貼固定在頁首正下方，
    // 面板改成往下展開（原本是往上，因為大頭貼原本在螢幕最下面；現在
    // 大頭貼在上面，面板自然改成从大頭貼下緣往下長）。
    //
    // 用 CSS 自訂屬性 `--jcl-anchor-top` 存「大頭貼錨點距離頁面頂端的
    // px 值」，大頭貼／覆蓋層／面板的 top 都透過 calc(var(...)) 算，這樣
    // header 高度之後如果變動（例如 webfont 載入完成），只要更新這一個
    // CSS 變數，三個元素會自動跟著動，不用個別重新套用樣式。
    var style = document.createElement("style");
    style.textContent =
      ":root{--jcl-anchor-top:84px;}" +
      "." + LAUNCHER_CLASS + "{position:fixed;right:" + ANCHOR_RIGHT + "px;top:var(--jcl-anchor-top);" +
      "width:64px;height:64px;border:0;border-radius:50%;z-index:9999;" +
      "clip-path:url(#" + AVATAR_CLIP_ID + ");" +
      "box-shadow:0 8px 24px rgba(38,34,32,0.28);pointer-events:none;}" +
      "." + OVERLAY_CLASS + "{position:fixed;right:" + ANCHOR_RIGHT + "px;top:var(--jcl-anchor-top);" +
      "width:64px;height:64px;border-radius:50%;z-index:10000;background:transparent;" +
      "touch-action:none;cursor:pointer;" +
      "-webkit-touch-callout:none;-webkit-user-select:none;user-select:none;-webkit-user-drag:none;" +
      "-webkit-tap-highlight-color:transparent;outline:none;}" +
      "." + PANEL_CLASS + "{position:fixed;right:14px;" +
      "top:calc(var(--jcl-anchor-top) + " + GAP_BELOW_LAUNCHER + "px);border:0;border-radius:20px;" +
      "z-index:9998;box-shadow:0 8px 24px rgba(38,34,32,0.28);" +
      "transition:width .22s ease,height .22s ease;}" +
      // 鍵盤適配（2026-07-15 第二十九輪定案）：鍵盤高度「恰好扣一次」。
      // - App（Capacitor）：原生層蓋掉 Capacitor SystemBars 的鍵盤縮放
      //   （視窗完全不縮、dvh 不變、背景不動），鍵盤高度由原生寫進
      //   --jonaminz-keyboard-inset，這裡扣一次讓面板下緣抬到鍵盤上。
      // - 一般瀏覽器：變數不存在（fallback 0px），瀏覽器自己縮 100dvh，
      //   一樣恰好扣一次。
      // 第二十八輪的教訓：Capacitor 縮視窗（dvh 跟著縮）＋這裡又扣變數
      // ＝扣兩次、面板縮成一條——修法是把「誰負責縮」在兩個環境各自
      // 固定成一個，不能兩邊同時作用。
      "." + PANEL_CLASS + ".size-half{width:min(430px,calc(100vw - 28px));" +
      "height:calc(min(720px,100dvh - var(--jcl-anchor-top) - " + GAP_BELOW_LAUNCHER + "px - 14px) - var(--jonaminz-keyboard-inset, 0px));}" +
      "." + PANEL_CLASS + ".size-full{width:min(760px,calc(100vw - 28px));" +
      "height:calc(100dvh - var(--jcl-anchor-top) - " + GAP_BELOW_LAUNCHER + "px - 14px - var(--jonaminz-keyboard-inset, 0px));}" +
      "." + PANEL_CLASS + ".jcl-panel-hidden{visibility:hidden;pointer-events:none;}" +
      // 2026-07-15：「叫出聊天泡泡」按鈕——使用者主動關掉懸浮泡泡後，
      // App 開啟時不會自動彈回來（見 syncOverlayBubbleState 的說明），
      // 這顆按鈕是使用者自己決定「現在要」的手動入口，只在那個狀態下
      // 才顯示。刻意用固定位置（不是塞進 header.js 的 DOM），因為
      // header.js 的 render() 每次都會 el.textContent="" 清空重建，
      // 塞進去會被清掉；獨立元素才不受它的重繪週期影響。
      ".jonaminz-summon-bubble-btn{position:fixed;top:12px;right:14px;z-index:10001;" +
      "padding:8px 14px;border:none;border-radius:999px;" +
      "background:var(--color-primary,#1f3a5f);color:#fff;" +
      "font-size:14px;font-weight:600;box-shadow:0 4px 14px rgba(38,34,32,0.28);" +
      "cursor:pointer;display:none;}";
    document.head.appendChild(style);

    // 每次 mountChat() 執行（也就是每次頁面重新載入）算一個新的 buster，
    // 逼 iframe src 變成新網址，繞過瀏覽器/WebView 對舊 HTML 的快取。
    var cacheBuster = "v=" + Date.now();

    var launcherFrame = document.createElement("iframe");
    launcherFrame.className = LAUNCHER_CLASS;
    launcherFrame.src = LAUNCHER_PATH + "?" + cacheBuster;
    launcherFrame.title = "Chat";
    document.body.appendChild(launcherFrame);

    // 面板一開始就建立、藏在背景持續 poll（見檔頭第七次修正說明），開關
    // 面板只是切換可見度，不是重新建立 iframe——使用者點開時看到的內容
    // 一直都是「已經在跑」的最新狀態，不會閃一下載入中。
    var lastSize = "half";
    var panelOpen = false;
    var lastToggleAt = 0;
    var panelFrame = document.createElement("iframe");
    panelFrame.className = PANEL_CLASS + " size-" + lastSize + " jcl-panel-hidden";
    panelFrame.src = PANEL_PATH + "?" + cacheBuster;
    panelFrame.title = "Chat 對話面板";
    document.body.appendChild(panelFrame);

    // 拖動後「休息位置」（吸邊之後的 left/top）；null 代表從沒拖動過，
    // 維持在預設錨點（跟著 CSS 的 right/bottom，responsive 於 viewport）。
    // 開啟面板時一律鎖到固定角落，關閉時還原回這個休息位置——見使用者
    // 回饋：「開啟時跳到右下角不能拖動，關掉後回到開啟前的位置」。
    var freeLeft = null;
    var freeTop = null;

    function setTransitionEnabled(on) {
      var value = on ? "left .22s ease, top .22s ease, right .22s ease, bottom .22s ease" : "";
      launcherFrame.style.transition = value;
      overlay.style.transition = value;
    }

    function applyPosition(left, top) {
      [launcherFrame, overlay].forEach(function (el) {
        el.style.right = "";
        el.style.bottom = "";
        el.style.left = left + "px";
        el.style.top = top + "px";
      });
    }

    // 「休息位置」（沒拖過時）跟「展開時鎖定的位置」現在是同一個地方
    // （頁首正下方），清掉 left/top/right/bottom 這些 inline 覆蓋值，
    // 讓上面靜態 CSS 規則裡的 right/top(var(--jcl-anchor-top)) 生效即可，
    // 不需要另外指定數字。
    function applyDefaultAnchor() {
      [launcherFrame, overlay].forEach(function (el) {
        el.style.left = "";
        el.style.right = "";
        el.style.top = "";
        el.style.bottom = "";
      });
    }

    function animateTo(applyFn) {
      setTransitionEnabled(true);
      applyFn();
      window.setTimeout(function () { setTransitionEnabled(false); }, 240);
    }

    function lockToOpenAnchor() {
      animateTo(applyDefaultAnchor);
    }

    function restoreRestingPosition() {
      animateTo(function () {
        if (freeLeft === null) applyDefaultAnchor();
        else applyPosition(freeLeft, freeTop);
      });
    }

    // --jcl-anchor-top 存「大頭貼距離頁面頂端的 px 值」，優先讀全站共用
    // 的 window.JonaminzLayoutMetrics（assets/js/layout-metrics.js，量
    // 真實 header 的 bottom），量不到就退回一個保底值。header 高度剛
    // 開始量測時可能還不準（webfont/圖片還沒載完），layout-metrics.js
    // 自己會延遲重算幾次——這裡訂閱它的更新事件，隨時把最新高度寫回這個
    // CSS 變數，大頭貼/覆蓋層/面板只要沒有 inline 覆蓋值就會自動跟著動
    // （使用者自己拖過的位置、或面板展開時鎖定的位置都是靠 inline
    // left/top 蓋掉這個變數，不會被這裡影響）。
    function computeAnchorTop() {
      try {
        if (window.JonaminzLayoutMetrics && typeof window.JonaminzLayoutMetrics.getState === "function") {
          var header = window.JonaminzLayoutMetrics.getState().header;
          if (header && header.exists) return Math.max(0, header.bottom + 14);
        }
      } catch (error) {}
      return 84;
    }

    function updateAnchorTopVar() {
      document.documentElement.style.setProperty("--jcl-anchor-top", computeAnchorTop() + "px");
      // 錨點變動會移動大頭貼的預設停靠位置，手勢排除區要跟著搬。
      scheduleGestureExclusionSync();
    }

    updateAnchorTopVar();
    if (window.JonaminzLayoutMetrics && typeof window.JonaminzLayoutMetrics.subscribe === "function") {
      window.JonaminzLayoutMetrics.subscribe(updateAnchorTopVar);
    }

    function snapToNearestEdge(left, top) {
      var width = launcherFrame.offsetWidth;
      var height = launcherFrame.offsetHeight;
      var clampedTop = Math.min(Math.max(0, top), window.innerHeight - height);
      var midX = left + width / 2;
      var snappedLeft = midX < window.innerWidth / 2
        ? ANCHOR_RIGHT
        : window.innerWidth - width - ANCHOR_RIGHT;
      freeLeft = snappedLeft;
      freeTop = clampedTop;
      animateTo(function () { applyPosition(snappedLeft, clampedTop); });
      scheduleGestureExclusionSync();
    }

    // 2026-07-15（真機回饋）：面板開著時在裡面打字，手機鍵盤跳出會把
    // 「後面的宿主頁面」整個擠上來/捲動——面板是浮在頁面上的獨立元素，
    // 宿主內容不該跟著動。面板開啟（手機版）時鎖定宿主頁捲動：body 定住
    // 在目前的捲動位置（position:fixed + 負 top 的標準手法，單純
    // overflow:hidden 在部分瀏覽器會把捲動位置歸零），關閉時還原。
    var savedScrollY = 0;
    var hostScrollLocked = false;
    function lockHostScroll() {
      if (hostScrollLocked) return;
      hostScrollLocked = true;
      savedScrollY = window.scrollY || 0;
      document.body.style.position = "fixed";
      document.body.style.top = (-savedScrollY) + "px";
      document.body.style.left = "0";
      document.body.style.right = "0";
      document.body.style.width = "100%";
    }
    function unlockHostScroll() {
      if (!hostScrollLocked) return;
      hostScrollLocked = false;
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.left = "";
      document.body.style.right = "";
      document.body.style.width = "";
      window.scrollTo(0, savedScrollY);
    }

    function setPanelOpen(open) {
      // 防呆：重複呼叫同一個狀態不做事——使用者連續快速點擊時，任何
      // 一次重複觸發都不該再疊加一次 postMessage/動畫。
      if (open === panelOpen) return;
      panelOpen = open;
      lastToggleAt = Date.now();
      panelFrame.classList.toggle("jcl-panel-hidden", !open);
      if (open && isMobileRwd()) lockHostScroll();
      else if (!open) unlockHostScroll();
      // 告訴面板自己現在是不是真的看得到——面板一直在背景 poll，不能把
      // 「poll 到新訊息」當成「使用者看到了」，只有這裡真的說可見才算
      // （見 chat-thread.js 的 maybeMarkRead()）。
      try {
        panelFrame.contentWindow.postMessage({
          source: "jonaminz-chat-panel-host",
          action: "visibility",
          visible: open
        }, window.location.origin);
      } catch (error) {}
      if (open) lockToOpenAnchor();
      else restoreRestingPosition();
      scheduleGestureExclusionSync();
    }

    // ---- 拖動／點擊覆蓋層：全程只在宿主自己的 document 裡發生，不跨
    // iframe 邊界，見檔頭說明。面板開著時鎖定不能拖動，只能點一下關閉。----
    var overlay = document.createElement("div");
    overlay.className = OVERLAY_CLASS;
    document.body.appendChild(overlay);

    // 2026-07-15（第三十輪）：App 裡這顆網頁大頭貼貼著螢幕邊緣，拖動
    // 起手很容易被系統當成返回手勢——跟懸浮泡泡一樣把大頭貼目前的範圍
    // 宣告成系統手勢排除區。差別是這顆活在網頁裡，座標要交給原生外掛
    // （JonaminzNative.setGestureExclusion）乘密度換算後掛到 WebView 上
    // （CSS px 等於 dp）。只在「停下來」的時機同步（初始、吸邊完成、
    // 面板開關、錨點變動、讓位/回歸）：排除區只影響下一次手勢的起手點，
    // 拖動進行中不需要跟著更新。瀏覽器（非 App）沒有這個外掛，靜默跳過。
    var gestureExclusionTimer = null;
    function syncGestureExclusion(clear) {
      try {
        var plugin = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.JonaminzNative;
        if (!plugin || typeof plugin.setGestureExclusion !== "function") return;
        if (clear || !overlay || overlay.style.display === "none") {
          plugin.setGestureExclusion({ x: 0, y: 0, width: 0, height: 0 });
          return;
        }
        var rect = overlay.getBoundingClientRect();
        plugin.setGestureExclusion({
          x: rect.left, y: rect.top, width: rect.width, height: rect.height
        });
      } catch (error) {}
    }
    function scheduleGestureExclusionSync() {
      if (gestureExclusionTimer) window.clearTimeout(gestureExclusionTimer);
      // 等吸邊/錨定動畫（240ms）跑完、位置定下來才量。
      gestureExclusionTimer = window.setTimeout(function () {
        gestureExclusionTimer = null;
        syncGestureExclusion(false);
      }, 320);
    }
    scheduleGestureExclusionSync();

    var dragStart = null;

    overlay.addEventListener("pointerdown", function (event) {
      var rect = overlay.getBoundingClientRect();
      dragStart = {
        pointerId: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        originLeft: rect.left,
        originTop: rect.top,
        moved: false
      };
      try { overlay.setPointerCapture(event.pointerId); } catch (error) {}
    });

    overlay.addEventListener("pointermove", function (event) {
      if (!dragStart || dragStart.pointerId !== event.pointerId) return;
      if (panelOpen) return; // 面板開著時鎖定位置，不接受拖動
      var dx = event.clientX - dragStart.x;
      var dy = event.clientY - dragStart.y;
      if (!dragStart.moved && Math.sqrt(dx * dx + dy * dy) < DRAG_THRESHOLD) return;
      dragStart.moved = true;
      var width = launcherFrame.offsetWidth;
      var height = launcherFrame.offsetHeight;
      var left = Math.min(Math.max(0, dragStart.originLeft + dx), window.innerWidth - width);
      var top = Math.min(Math.max(0, dragStart.originTop + dy), window.innerHeight - height);
      applyPosition(left, top);
    });

    function endDrag(event) {
      if (!dragStart || dragStart.pointerId !== event.pointerId) return;
      var moved = dragStart.moved;
      dragStart = null;
      try { overlay.releasePointerCapture(event.pointerId); } catch (error) {}

      if (panelOpen) {
        // 面板開著時只有「點一下關閉」這條路徑，拖動已經在 pointermove
        // 被擋掉了。
        setPanelOpen(false);
        return;
      }
      if (!moved) {
        setPanelOpen(true);
        return;
      }
      // 真的拖動過，放開時吸到最近的左右邊緣（不開面板）。
      var rect = launcherFrame.getBoundingClientRect();
      snapToNearestEdge(rect.left, rect.top);
    }

    overlay.addEventListener("pointerup", endDrag);
    overlay.addEventListener("pointercancel", endDrag);

    // 2026-07-15（第二十二輪）：App 點系統通知進來要直接展開聊天面板
    // ——原生 MainActivity 收到通知的 openChat extra 後，對這個頁面
    // evaluateJavascript 觸發這個事件（見 jonaminz-mobile-app 的
    // MainActivity.java）。setPanelOpen 有同狀態防呆，原生端重複觸發
    // 兩次（冷啟動保險）也無害。
    window.addEventListener("jonaminz-open-chat", function () {
      setPanelOpen(true);
    });

    // 手機版點對話框外面的區塊要關掉泡泡，電腦版不要（桌機通常同時看
    // 著頁面內容跟聊天，點別的地方不代表想關掉）。手機/電腦的判斷直接
    // 讀全站共用的 assets/js/layout-metrics.js（window.JonaminzLayoutMetrics
    // 的 rwdGroup：small=手機/平板、large=桌機/寬版），不要另外發明一套
    // 判斷邏輯。外部專案（SDK 路徑）沒有這支水庫腳本可讀，退回同一組
    // 斷點門檻（960px，跟 layout-metrics.js 的 small/large 分界一致）。
    function isMobileRwd() {
      try {
        if (window.JonaminzLayoutMetrics && typeof window.JonaminzLayoutMetrics.getState === "function") {
          return window.JonaminzLayoutMetrics.getState().rwdGroup === "small";
        }
      } catch (error) {}
      return window.innerWidth <= 960;
    }

    // click 事件天生就不會跨 iframe 邊界冒泡到宿主的 document，所以這裡
    // 收到的一定是「宿主頁面自己內容」被點了（面板/大頭貼 iframe 內部的
    // 點擊不會流到這裡）——不需要額外判斷是不是點在面板範圍內。
    document.addEventListener("click", function (event) {
      if (!panelOpen) return;
      if (!isMobileRwd()) return;
      if (overlay.contains(event.target) || launcherFrame.contains(event.target)) return;
      // 防呆：剛開面板那一瞬間（300ms 內）不接受「點外面關閉」——避免
      // 手機上開面板那次點擊殘留的合成 click／連續快速點擊，跟這裡的
      // 判斷互相干擾，造成開了又立刻被關掉的閃爍。
      if (Date.now() - lastToggleAt < 300) return;
      setPanelOpen(false);
    }, true);

    window.addEventListener("message", function (event) {
      if (event.origin !== window.location.origin) return;
      var data = event.data;
      if (!data) return;

      if (data.source === "jonaminz-chat-panel" && data.action === "setSize") {
        var size = data.size === "full" ? "full" : "half";
        lastSize = size;
        panelFrame.className = PANEL_CLASS + " size-" + size + (panelOpen ? "" : " jcl-panel-hidden");
        return;
      }

      // Shared 分享內容模組：面板（composer 的「分享目前內容」）不知道
      // 自己被嵌在哪個宿主頁面，跟這裡要目前頁面的 title/url。回覆只送給
      // 面板 iframe 自己（用 contentWindow.postMessage，不是廣播），避免
      // 其他 iframe 或頁面收到不相干的內容。
      if (data.source === "jonaminz-chat-panel" && data.action === "requestContext") {
        try {
          panelFrame.contentWindow.postMessage({
            source: "jonaminz-chat-panel-host",
            action: "contextReply",
            title: document.title,
            url: window.location.href
          }, window.location.origin);
        } catch (error) {}
        return;
      }

      // 2026-07-14（真機回報修正）：撥打電話跟開啟推播通知在面板 iframe
      // 裡都失敗（使用者實機回報：tel: 連結沒反應、推播沒跳出權限請求）。
      // 面板是 iframe，不一定是瀏覽器認定的「最上層瀏覽環境」——部分
      // 瀏覽器（尤其 WebKit/iOS）只信任最上層環境觸發自訂協定導頁
      // （tel:/mailto: 之類）跟 Notification 權限請求，交給宿主頁面
      // （這裡本身就是使用者看到的網址列所在的最上層頁面）代為執行。
      if (data.source === "jonaminz-chat-panel" && data.action === "requestCall") {
        try {
          if (data.phoneNumber) window.location.href = "tel:" + data.phoneNumber;
        } catch (error) {}
        return;
      }

      if (data.source === "jonaminz-chat-panel" && data.action === "requestPushSubscribe") {
        handlePushSubscribeRequest(data.applicationServerKey);
        return;
      }

      // 2026-07-15（第二十三輪）：兩種泡泡都是 App 原生能力（自訂外掛
      // JonaminzNative，見 jonaminz-mobile-app 的 JonaminzNativePlugin），
      // 面板請宿主代呼叫。mode: "system"＝Android 11 Bubbles、
      // "overlay"＝Messenger 式懸浮泡泡（覆蓋視窗＋前景服務）。
      if (data.source === "jonaminz-chat-panel" && data.action === "requestBubble") {
        handleBubbleRequest(data.mode === "overlay" ? "overlay" : "system");
        return;
      }
    });

    function replyBubbleResult(payload) {
      try {
        panelFrame.contentWindow.postMessage(Object.assign({
          source: "jonaminz-chat-panel-host",
          action: "bubbleResult"
        }, payload), window.location.origin);
      } catch (error) {}
    }

    // 2026-07-15（第二十四輪補）：懸浮泡泡運作期間，App 網頁裡這顆
    // 大頭貼要讓位（同時兩顆泡泡很怪）。開 App、切回 App、按下「懸浮
    // 泡泡」成功當下都同步一次；懸浮泡泡被拖到 ✕ 關掉後，下次切回
    // App 會自動把這顆放回來。
    var inAppLauncherHidden = false;
    function setInAppLauncherHidden(hidden) {
      if (hidden === inAppLauncherHidden) return;
      inAppLauncherHidden = hidden;
      if (hidden) setPanelOpen(false);
      launcherFrame.style.display = hidden ? "none" : "";
      overlay.style.display = hidden ? "none" : "";
      if (hidden) panelFrame.classList.add("jcl-panel-hidden");
      // 讓位（隱藏）時清掉手勢排除區，回歸時重新量。
      if (hidden) syncGestureExclusion(true);
      else scheduleGestureExclusionSync();
    }

    function syncOverlayBubbleState() {
      var plugin = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.JonaminzNative;
      if (!plugin || typeof plugin.isOverlayBubbleActive !== "function") return;
      plugin.isOverlayBubbleActive()
        .then(function (result) {
          var active = Boolean(result && result.active);
          if (active) {
            setInAppLauncherHidden(true);
            hideSummonBubbleButton();
            return;
          }
          // 2026-07-15（使用者實機回饋）：手機這種攜帶裝置（也就是跑在
          // Capacitor App 裡，這支外掛只有那邊才存在）如果已經授權過
          // 「顯示在其他應用程式上層」，開啟/回到 App 就自動彈出懸浮
          // 泡泡，不用每次手動點；還沒授權過的話維持原本手動流程，
          // 不要自動跳去系統設定頁（那樣太突兀）。桌機版（純瀏覽器，
          // 沒有這支外掛）本來就不會走到這裡，維持用網頁內建的那顆
          // 圓圓大頭貼當入口，不受影響。
          if (typeof plugin.hasOverlayPermission !== "function") {
            setInAppLauncherHidden(false);
            hideSummonBubbleButton();
            return;
          }
          plugin.hasOverlayPermission()
            .then(function (permResult) {
              if (!permResult || !permResult.granted) {
                setInAppLauncherHidden(false);
                hideSummonBubbleButton();
                return null;
              }
              // 2026-07-15（使用者提出）：使用者上次是不是「主動」拖到
              // ✕ 關掉泡泡——是的話尊重這個選擇，不要又自動彈回來，
              // 改顯示「叫出聊天泡泡」按鈕讓使用者自己決定何時要泡泡；
              // 沒有這支方法（舊版 App）就維持原本「有權限就自動彈」。
              if (typeof plugin.getOverlayAutoPopupPreference !== "function") {
                setInAppLauncherHidden(true);
                return plugin.openOverlayBubble();
              }
              return plugin.getOverlayAutoPopupPreference().then(function (prefResult) {
                var autoPopupEnabled = Boolean(prefResult && prefResult.enabled);
                if (!autoPopupEnabled) {
                  setInAppLauncherHidden(false);
                  showSummonBubbleButton();
                  return "SKIP_AUTO_LAUNCH";
                }
                // 樂觀讓位：假設接下來會成功開啟，先讓位掉這顆大頭貼，
                // 真的失敗才切回來顯示——避免「先冒出來一下又馬上消失」
                // 的閃爍。
                setInAppLauncherHidden(true);
                return plugin.openOverlayBubble();
              });
            })
            .then(function (openResult) {
              if (!openResult || openResult === "SKIP_AUTO_LAUNCH") return;
              hideSummonBubbleButton();
              if (openResult.status !== "opened") {
                setInAppLauncherHidden(false);
              }
            })
            .catch(function () {
              setInAppLauncherHidden(false);
            });
        })
        .catch(function () {});
    }

    // 「叫出聊天泡泡」按鈕：獨立於 header.js 的 DOM 之外（見上面 CSS
    // 註解說明原因），只在「有權限但使用者上次主動關掉」這個狀態下
    // 才顯示；按下去手動重新開啟懸浮泡泡。
    var summonBubbleBtn = null;
    function ensureSummonBubbleButton() {
      if (summonBubbleBtn) return summonBubbleBtn;
      summonBubbleBtn = document.createElement("button");
      summonBubbleBtn.type = "button";
      summonBubbleBtn.className = "jonaminz-summon-bubble-btn";
      summonBubbleBtn.textContent = "🫧 開啟泡泡";
      summonBubbleBtn.addEventListener("click", function () {
        var plugin = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.JonaminzNative;
        if (!plugin || typeof plugin.openOverlayBubble !== "function") return;
        plugin.openOverlayBubble()
          .then(function (result) {
            if (result && result.status === "opened") {
              hideSummonBubbleButton();
              setInAppLauncherHidden(true);
            }
          })
          .catch(function () {});
      });
      document.body.appendChild(summonBubbleBtn);
      return summonBubbleBtn;
    }
    function showSummonBubbleButton() {
      ensureSummonBubbleButton().style.display = "block";
    }
    function hideSummonBubbleButton() {
      if (summonBubbleBtn) summonBubbleBtn.style.display = "none";
    }

    syncOverlayBubbleState();
    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState === "visible") syncOverlayBubbleState();
    });

    function handleBubbleRequest(mode) {
      var plugin = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.JonaminzNative;
      if (!plugin) {
        replyBubbleResult({
          status: "unsupported",
          error: window.Capacitor
            ? "App 版本太舊還沒有泡泡功能，要重新安裝新版 App"
            : "瀏覽器沒有系統泡泡，這功能在 App 裡用"
        });
        return;
      }
      var request = mode === "overlay" ? plugin.openOverlayBubble() : plugin.openBubble();
      Promise.resolve(request)
        .then(function (result) {
          var status = (result && result.status) || "opened";
          replyBubbleResult({ status: status });
          // 懸浮泡泡開起來的當下就把 App 內這顆大頭貼收掉。
          if (mode === "overlay" && status === "opened") {
            setInAppLauncherHidden(true);
          }
        })
        .catch(function (error) {
          replyBubbleResult({ status: "unsupported", error: (error && error.message) || "開啟失敗" });
        });
    }

    function replyPushSubscribeResult(ok, subscriptionOrError) {
      try {
        panelFrame.contentWindow.postMessage({
          source: "jonaminz-chat-panel-host",
          action: "pushSubscribeResult",
          ok: ok,
          subscription: ok ? subscriptionOrError : undefined,
          error: ok ? undefined : String((subscriptionOrError && subscriptionOrError.message) || subscriptionOrError)
        }, window.location.origin);
      } catch (error) {}
    }

    // 2026-07-14（第十八輪）：Jonaminz App（Capacitor，Android WebView）
    // 平台層沒有網頁推播 API，App 內收推播走 Firebase 原生推播——用
    // @capacitor/push-notifications 外掛（App 殼裡裝的，網頁端透過
    // window.Capacitor.Plugins 呼叫）拿 FCM device token，回給面板存進
    // Worker（kind='fcm'，Worker 端送 FCM v1）。外掛還沒裝（舊版 App）
    // 就顯示要更新 App 的提示。
    function handleCapacitorPushSubscribe() {
      var PN = window.Capacitor.Plugins && window.Capacitor.Plugins.PushNotifications;
      if (!PN) {
        replyPushSubscribeResult(false, "App 版本太舊還沒有推播功能，要重新安裝新版 App");
        return;
      }
      var registrationListener = null;
      var errorListener = null;
      var settled = false;
      function cleanup() {
        try { if (registrationListener) registrationListener.remove(); } catch (error) {}
        try { if (errorListener) errorListener.remove(); } catch (error) {}
      }
      function settle(ok, value) {
        if (settled) return;
        settled = true;
        cleanup();
        replyPushSubscribeResult(ok, value);
      }
      // registration 事件在 register() 之後非同步觸發，先掛好監聽再註冊。
      Promise.resolve(PN.addListener("registration", function (tokenData) {
        settle(true, { kind: "fcm", token: tokenData.value });
      })).then(function (listener) { registrationListener = listener; });
      Promise.resolve(PN.addListener("registrationError", function (error) {
        settle(false, (error && error.error) || "FCM 註冊失敗");
      })).then(function (listener) { errorListener = listener; });

      PN.requestPermissions()
        .then(function (result) {
          if (result.receive !== "granted") throw new Error("使用者未允許通知權限");
          return PN.register();
        })
        .catch(function (error) { settle(false, error); });

      setTimeout(function () { settle(false, "逾時，沒有拿到 FCM token"); }, 15000);
    }

    function handlePushSubscribeRequest(applicationServerKeyArray) {
      var applicationServerKey = new Uint8Array(applicationServerKeyArray || []);
      if (window.Capacitor) {
        handleCapacitorPushSubscribe();
        return;
      }
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        replyPushSubscribeResult(false, "此瀏覽器不支援推播通知");
        return;
      }
      Notification.requestPermission()
        .then(function (permission) {
          if (permission !== "granted") throw new Error("使用者未允許通知權限");
          return navigator.serviceWorker.register("/sw.js");
        })
        // register() 回傳的 registration 不保證已經 active（第一次註冊通常
        // 還在 installing），直接拿它訂閱容易撞到「no active Service
        // Worker」——改用 navigator.serviceWorker.ready，保證拿到的是真的
        // 已經 active 的 registration。
        .then(function () { return navigator.serviceWorker.ready; })
        .then(function (registration) {
          return registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: applicationServerKey });
        })
        .then(function (subscription) {
          replyPushSubscribeResult(true, subscription.toJSON());
        })
        .catch(function (error) {
          replyPushSubscribeResult(false, error);
        });
    }

  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mountChat, { once: true });
  } else {
    mountChat();
  }
})();
