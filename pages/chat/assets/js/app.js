/*
檔案位置：jonaminz/pages/chat/assets/js/app.js
用途：Jonaminz Chat「主頁」的呼叫端。整頁在 init() 就先過
window.JonaminzIdentity.requireLogin()，沒登入會被導去
/pages/login/?next=...，不會執行到下面的邏輯——跟 pages/admin/
contracts/ 同一套權限關卡。

2026-07-14（P2）：真正的訊息串/composer 渲染邏輯搬去共用模組
assets/js/chat-thread.js——這裡（跟 pages/chat-launcher/ 那邊）都只是
呼叫端，各自負責「怎麼取得 token」跟「頁面/面板特有的生命週期」（這裡是
requireLogin＋loading-gate task 回報），不重複實作訊息渲染那一大段，
避免「主頁」跟浮動面板（主頁的攜帶版）長出兩套會 drift 的邏輯。
*/
(function () {
  "use strict";

  var READY_TASK = "app-ready";
  var thread = null;

  function init() {
    window.JonaminzIdentity.requireLogin().then(function () {
      try {
        var token = window.JonaminzIdentity.readToken();
        var root = document.querySelector("[data-app-root]");

        thread = window.JonaminzChatThread.mount(root, { token: token });

        window.addEventListener("beforeunload", function () {
          if (thread) thread.destroy();
        });

        window.JonaminzLoading.done(READY_TASK);
      } catch (error) {
        window.JonaminzLoading.fail(READY_TASK, error);
      }
    });
  }

  init();
})();
