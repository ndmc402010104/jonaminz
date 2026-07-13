/*
檔案位置：jonaminz/pages/jonathan/about/assets/js/app.js
用途：Jonathan About 子頁自己的業務入口（水庫下游層）。內容是靜態文字＋
照片，直接寫在 index.html 裡，這裡只掛身分登入狀態＋回報 loading task，
不需要動態資料，跟 pages/jonathan/assets/js/app.js 的 mountIdentity()
做法一致（各頁各自掛一次，不共用一份 DOM 操作邏輯）。
*/
(function () {
  "use strict";

  var READY_TASK = "app-ready";

  function mountIdentity() {
    if (!window.JonaminzIdentity || typeof window.JonaminzIdentity.mount !== "function") return;
    var container = document.querySelector("[data-nav-identity]");
    if (!container) return;

    window.JonaminzIdentity.mount(container, {
      wrapperClassName: "nav-identity",
      greetingClassName: "nav-identity-greeting",
      linkClassName: "jonathan-nav-link",
      logoutClassName: "jonathan-nav-link jonathan-nav-link--button",
      adminLinkClassName: "jonathan-nav-link",
      showAdminLink: true
    });
  }

  function init() {
    try {
      mountIdentity();
      window.JonaminzLoading.done(READY_TASK);
    } catch (error) {
      console.error("[jonaminz] jonathan/about app.js init failed", error);
      window.JonaminzLoading.fail(READY_TASK, error);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
