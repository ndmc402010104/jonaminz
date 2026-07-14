/*
檔案位置：jonaminz/assets/js/chat-launcher.js
用途：水庫 shell 層——在 jonaminz 內部每一頁注入浮動 Chat 入口的 iframe。
真正的按鈕/面板本體（大頭貼/未讀角標/在線點/三態機/polling）住在
pages/chat-launcher/index.html，這裡只是薄薄的注入器。

2026-07-14：從 header.js 拆出來獨立成自己的 shell script。「render 品牌列/
身分區塊」跟「Chat 入口」是兩個不相關的職責，不該長在同一個檔案裡。跟
header.js／footer.js／registry-loader.js／layout-metrics.js 同一批，由
entry-core.js 的 shellPromise 無條件在每一頁載入。

同一天再改成 iframe 模式：外部專案（SDK Kernel 的 chat.launcher@1
capability）跟內部頁面共用 pages/chat-launcher/ 這同一份實作，理由見
該檔案檔頭。這裡跟 SDK 端的差別只有兩個：src 用同源相對路徑（不用寫死
www.jonaminz.com，本機 dev server 也能跑）、點擊導頁用相對路徑。

同一天稍晚（P2）：從「固定 76x76、點擊導頁」改成三態懸浮面板——embed 頁
只 postMessage 目前狀態字串（collapsed/half/full），實際尺寸由這裡的
CSS 決定（vw/dvh 相對單位，交給宿主自己的瀏覽器引擎算，不是 embed 頁
自己在 iframe 內猜宿主視窗多大）。尺寸數字跟 sdk-src/sdk.js 的
mountChatLauncher() 是刻意重複的兩份（跟 TOKEN_KEY/readToken() 那組
小工具一樣的理由：這批 shell script/SDK 注入器彼此獨立，不互相依賴）。

2026-07-14（同日第二次修正）：使用者在真實 Android 裝置上回報「圓形外
面卡一個方框」，且比早上那次（以為是 box-shadow 被裁到、加大邊距）
還嚴重——真正原因是 iframe 內部的透明背景在那台裝置的瀏覽器/WebView
上不可靠，不是邊距大小問題。改成**不依賴 iframe 內部透明**：
`border-radius`／`box-shadow` 直接套在這裡建立的 `<iframe>` 元素本身
（收合態裁成圓形、展開態裁成圓角矩形）——這是瀏覽器對「一般元素」的
裁形狀與陰影繪製能力，跟這個元素裡面的文件透不透明完全無關，遠比
「指望 iframe 內容透明疊在頁面上」更穩固。embed 頁那邊對應改成兩個
視圖（收合/展開）都完整填滿 100%、不留任何透明空白，見該檔案檔頭。

沒登入時要不要嵌 iframe：交給 embed 頁自己判斷（沒 token 兩個視圖都
不顯示），這裡只做一個粗篩（有 token 才嵌）省掉多數未登入頁面的 iframe
載入成本——兩邊判斷標準一樣，粗篩漏了也只是多載一個空白 iframe，
不會出現壞掉的按鈕。
*/
(function () {
  "use strict";

  var TOKEN_KEY = "jonaminz.sessionToken";
  var EMBED_PATH = "/pages/chat-launcher/";
  var CHAT_PATH = "/pages/chat/";
  var FRAME_CLASS = "jonaminz-chat-launcher-frame";

  function mountChatLauncher() {
    if (document.querySelector("." + FRAME_CLASS)) return;
    if (window.location.pathname.indexOf(CHAT_PATH) === 0) return;

    var token = null;
    try { token = window.localStorage.getItem(TOKEN_KEY); } catch (error) { token = null; }
    if (!token) return;

    var style = document.createElement("style");
    style.textContent =
      "." + FRAME_CLASS + "{position:fixed;right:14px;bottom:14px;border:0;" +
      "z-index:9999;box-shadow:0 8px 24px rgba(38,34,32,0.28);" +
      "transition:width .22s ease,height .22s ease,border-radius .22s ease;}" +
      "." + FRAME_CLASS + ".state-collapsed{width:64px;height:64px;border-radius:50%;}" +
      "." + FRAME_CLASS + ".state-half{width:min(430px,calc(100vw - 28px));height:min(720px,calc(100dvh - 60px));border-radius:20px;}" +
      "." + FRAME_CLASS + ".state-full{width:min(760px,calc(100vw - 28px));height:calc(100dvh - 40px);border-radius:20px;}";
    document.head.appendChild(style);

    var iframe = document.createElement("iframe");
    iframe.className = FRAME_CLASS + " state-collapsed";
    iframe.src = EMBED_PATH;
    iframe.title = "Chat";

    window.addEventListener("message", function (event) {
      if (event.origin !== window.location.origin) return;
      var data = event.data;
      if (!data || data.source !== "jonaminz-chat-launcher") return;
      if (data.action !== "setState") return;
      var state = data.state === "half" || data.state === "full" ? data.state : "collapsed";
      iframe.className = FRAME_CLASS + " state-" + state;
    });

    document.body.appendChild(iframe);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mountChatLauncher, { once: true });
  } else {
    mountChatLauncher();
  }
})();
