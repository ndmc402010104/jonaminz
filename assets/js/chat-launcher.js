/*
檔案位置：jonaminz/assets/js/chat-launcher.js
用途：水庫 shell 層——在 jonaminz 內部每一頁注入浮動 Chat 入口的 iframe。
真正的按鈕本體（大頭貼/未讀角標/在線點/polling）住在
pages/chat-launcher/index.html，這裡只是薄薄的注入器。

2026-07-14：從 header.js 拆出來獨立成自己的 shell script。「render 品牌列/
身分區塊」跟「Chat 入口」是兩個不相關的職責，不該長在同一個檔案裡。跟
header.js／footer.js／registry-loader.js／layout-metrics.js 同一批，由
entry-core.js 的 shellPromise 無條件在每一頁載入。

同一天再改成 iframe 模式：外部專案（SDK Kernel 的 chat.launcher@1
capability）跟內部頁面共用 pages/chat-launcher/ 這同一份實作，理由見
該檔案檔頭。這裡跟 SDK 端的差別只有兩個：src 用同源相對路徑（不用寫死
www.jonaminz.com，本機 dev server 也能跑）、點擊導頁用相對路徑。

沒登入時要不要嵌 iframe：交給 embed 頁自己判斷（沒 token 就整頁透明
空白），這裡只做一個粗篩（有 token 才嵌）省掉多數未登入頁面的 iframe
載入成本——兩邊判斷標準一樣，粗篩漏了也只是多載一個空白 iframe，
不會出現壞掉的按鈕。
*/
(function () {
  "use strict";

  var TOKEN_KEY = "jonaminz.sessionToken";
  var EMBED_PATH = "/pages/chat-launcher/";
  var CHAT_PATH = "/pages/chat/";

  function mountChatLauncher() {
    if (document.querySelector(".jonaminz-chat-launcher-frame")) return;
    if (window.location.pathname.indexOf(CHAT_PATH) === 0) return;

    var token = null;
    try { token = window.localStorage.getItem(TOKEN_KEY); } catch (error) { token = null; }
    if (!token) return;

    var iframe = document.createElement("iframe");
    iframe.className = "jonaminz-chat-launcher-frame";
    iframe.src = EMBED_PATH;
    iframe.title = "Chat";
    iframe.setAttribute("allowtransparency", "true");
    // 76x76 = 56px 按鈕 + 角標超出量(3px) + hover 上浮量(2px) + 邊距。
    // 透明區域會吃掉點擊，但這個尺寸小到不會擋住頁面上任何真的東西。
    iframe.style.cssText =
      "position:fixed;right:14px;bottom:14px;width:76px;height:76px;" +
      "border:0;background:transparent;z-index:9999;";

    window.addEventListener("message", function (event) {
      if (event.origin !== window.location.origin) return;
      var data = event.data;
      if (!data || data.source !== "jonaminz-chat-launcher") return;
      if (data.action === "open") window.location.href = CHAT_PATH;
    });

    document.body.appendChild(iframe);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mountChatLauncher, { once: true });
  } else {
    mountChatLauncher();
  }
})();
