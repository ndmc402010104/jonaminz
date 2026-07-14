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
  var ANCHOR_RIGHT = 14;
  var ANCHOR_BOTTOM = 14;
  var DRAG_THRESHOLD = 8;

  function mountChat() {
    if (document.querySelector("." + LAUNCHER_CLASS)) return;
    if (window.location.pathname.indexOf(CHAT_PATH) === 0) return;

    var token = null;
    try { token = window.localStorage.getItem(TOKEN_KEY); } catch (error) { token = null; }
    if (!token) return;

    var style = document.createElement("style");
    style.textContent =
      "." + LAUNCHER_CLASS + "{position:fixed;right:" + ANCHOR_RIGHT + "px;bottom:" + ANCHOR_BOTTOM + "px;" +
      "width:64px;height:64px;border:0;border-radius:50%;z-index:9999;" +
      "box-shadow:0 8px 24px rgba(38,34,32,0.28);pointer-events:none;}" +
      "." + OVERLAY_CLASS + "{position:fixed;right:" + ANCHOR_RIGHT + "px;bottom:" + ANCHOR_BOTTOM + "px;" +
      "width:64px;height:64px;border-radius:50%;z-index:10000;background:transparent;" +
      "touch-action:none;cursor:pointer;}" +
      "." + PANEL_CLASS + "{position:fixed;right:14px;bottom:92px;border:0;border-radius:20px;" +
      "z-index:9998;box-shadow:0 8px 24px rgba(38,34,32,0.28);" +
      "transition:width .22s ease,height .22s ease;}" +
      "." + PANEL_CLASS + ".size-half{width:min(430px,calc(100vw - 28px));height:min(720px,calc(100dvh - 140px));}" +
      "." + PANEL_CLASS + ".size-full{width:min(760px,calc(100vw - 28px));height:calc(100dvh - 110px);}" +
      "." + PANEL_CLASS + ".jcl-panel-hidden{visibility:hidden;pointer-events:none;}";
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
    var panelFrame = document.createElement("iframe");
    panelFrame.className = PANEL_CLASS + " size-" + lastSize + " jcl-panel-hidden";
    panelFrame.src = PANEL_PATH + "?" + cacheBuster;
    panelFrame.title = "Chat 對話面板";
    document.body.appendChild(panelFrame);

    function setPanelOpen(open) {
      panelOpen = open;
      panelFrame.classList.toggle("jcl-panel-hidden", !open);
    }

    function moveLauncherTo(left, top) {
      var width = launcherFrame.offsetWidth;
      var height = launcherFrame.offsetHeight;
      var clampedLeft = Math.min(Math.max(0, left), window.innerWidth - width);
      var clampedTop = Math.min(Math.max(0, top), window.innerHeight - height);
      [launcherFrame, overlay].forEach(function (el) {
        el.style.right = "";
        el.style.bottom = "";
        el.style.left = clampedLeft + "px";
        el.style.top = clampedTop + "px";
      });
    }

    function snapToAnchor() {
      [launcherFrame, overlay].forEach(function (el) {
        el.style.left = "";
        el.style.top = "";
        el.style.right = ANCHOR_RIGHT + "px";
        el.style.bottom = ANCHOR_BOTTOM + "px";
      });
    }

    // ---- 拖動／點擊覆蓋層：全程只在宿主自己的 document 裡發生，不跨
    // iframe 邊界，見檔頭說明。----
    var overlay = document.createElement("div");
    overlay.className = OVERLAY_CLASS;
    document.body.appendChild(overlay);

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
      var dx = event.clientX - dragStart.x;
      var dy = event.clientY - dragStart.y;
      if (!dragStart.moved && Math.sqrt(dx * dx + dy * dy) < DRAG_THRESHOLD) return;
      dragStart.moved = true;
      moveLauncherTo(dragStart.originLeft + dx, dragStart.originTop + dy);
    });

    function endDrag(event) {
      if (!dragStart || dragStart.pointerId !== event.pointerId) return;
      var moved = dragStart.moved;
      dragStart = null;
      try { overlay.releasePointerCapture(event.pointerId); } catch (error) {}
      if (!moved) {
        snapToAnchor();
        setPanelOpen(!panelOpen);
      }
    }

    overlay.addEventListener("pointerup", endDrag);
    overlay.addEventListener("pointercancel", endDrag);

    window.addEventListener("message", function (event) {
      if (event.origin !== window.location.origin) return;
      var data = event.data;
      if (!data) return;

      if (data.source === "jonaminz-chat-panel" && data.action === "setSize") {
        var size = data.size === "full" ? "full" : "half";
        lastSize = size;
        panelFrame.className = PANEL_CLASS + " size-" + size + (panelOpen ? "" : " jcl-panel-hidden");
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mountChat, { once: true });
  } else {
    mountChat();
  }
})();
