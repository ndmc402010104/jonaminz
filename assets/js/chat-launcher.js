/*
檔案位置：jonaminz/assets/js/chat-launcher.js
用途：水庫 shell 層——在 jonaminz 內部每一頁注入浮動 Chat 入口。真正的
按鈕/面板本體住在 pages/chat-launcher/（大頭貼）與 pages/chat-panel/
（面板），這裡只是薄薄的注入器，同時管理這兩個獨立的 iframe。

2026-07-14：從 header.js 拆出來獨立成自己的 shell script，後來改成
iframe 模式（外部專案跟內部頁面共用同一份實作）。

2026-07-14（同日第三次修正，教訓見 CHANGELOG）：原本大頭貼跟面板擠在
同一個 iframe 裡（靠內部視圖切換 + 宿主端 border-radius 裁形狀解決
Android 上 iframe 內部透明不可靠的問題），但一個 iframe 只能裁一種
形狀，逼得展開時要把大頭貼縮成面板內部的「迷你版」——使用者在真實
裝置上連續兩輪回報「還是被蓋住/收不回來」，因為大頭貼本質上該是面板
外面一個永遠存在的獨立元素，不是塞進面板內部的裝飾。

**這次的架構**：兩個完全獨立的 iframe，各自裁一種固定形狀：
- Iframe A（`pages/chat-launcher/`）：永遠存在（登入後），固定小尺寸
  圓形，只負責顯示大頭貼＋通知宿主「使用者點了它」（`toggle` 訊息）。
- Iframe B（`pages/chat-panel/`）：只有使用者點過 Iframe A 之後才建立，
  圓角矩形，尺寸依半版/全版狀態決定（`setSize` 訊息），使用者再點一次
  Iframe A 就整個移除（不是自己內部切換 hidden）。

`border-radius`／`box-shadow` 直接套在這裡建立的兩個 `<iframe>` 元素
本身（跟之前一樣，不依賴 iframe 內部透明——這個技巧本身沒有錯，錯的是
把兩個形狀塞進同一個 iframe，這次分開處理）。尺寸數字跟 sdk-src/sdk.js
的 mountChatLauncher() 是刻意重複的兩份（跟 TOKEN_KEY/readToken() 那組
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
  var PANEL_CLASS = "jonaminz-chat-panel-frame";

  function mountChat() {
    if (document.querySelector("." + LAUNCHER_CLASS)) return;
    if (window.location.pathname.indexOf(CHAT_PATH) === 0) return;

    var token = null;
    try { token = window.localStorage.getItem(TOKEN_KEY); } catch (error) { token = null; }
    if (!token) return;

    var style = document.createElement("style");
    style.textContent =
      "." + LAUNCHER_CLASS + "{position:fixed;right:14px;bottom:14px;width:64px;height:64px;" +
      "border:0;border-radius:50%;z-index:9999;box-shadow:0 8px 24px rgba(38,34,32,0.28);}" +
      "." + PANEL_CLASS + "{position:fixed;right:14px;bottom:92px;border:0;border-radius:20px;" +
      "z-index:9998;box-shadow:0 8px 24px rgba(38,34,32,0.28);" +
      "transition:width .22s ease,height .22s ease;}" +
      "." + PANEL_CLASS + ".size-half{width:min(430px,calc(100vw - 28px));height:min(720px,calc(100dvh - 140px));}" +
      "." + PANEL_CLASS + ".size-full{width:min(760px,calc(100vw - 28px));height:calc(100dvh - 110px);}";
    document.head.appendChild(style);

    var launcherFrame = document.createElement("iframe");
    launcherFrame.className = LAUNCHER_CLASS;
    launcherFrame.src = LAUNCHER_PATH;
    launcherFrame.title = "Chat";
    document.body.appendChild(launcherFrame);

    var panelFrame = null;

    function removePanel() {
      if (panelFrame && panelFrame.parentNode) panelFrame.parentNode.removeChild(panelFrame);
      panelFrame = null;
    }

    function createPanel(initialSize) {
      panelFrame = document.createElement("iframe");
      panelFrame.className = PANEL_CLASS + " size-" + initialSize;
      panelFrame.src = PANEL_PATH;
      panelFrame.title = "Chat 對話面板";
      document.body.appendChild(panelFrame);
    }

    var lastSize = "half";

    window.addEventListener("message", function (event) {
      if (event.origin !== window.location.origin) return;
      var data = event.data;
      if (!data) return;

      if (data.source === "jonaminz-chat-launcher" && data.action === "toggle") {
        if (panelFrame) removePanel();
        else createPanel(lastSize);
        return;
      }

      if (data.source === "jonaminz-chat-panel" && data.action === "setSize") {
        var size = data.size === "full" ? "full" : "half";
        lastSize = size;
        if (panelFrame) panelFrame.className = PANEL_CLASS + " size-" + size;
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mountChat, { once: true });
  } else {
    mountChat();
  }
})();
