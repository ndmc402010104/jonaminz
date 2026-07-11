/*
檔案位置：jonaminz/assets/js/app.js
用途：home 頁自己的業務入口（水庫下游層）。
只能回報自己的 loading task，不可以自己 release all-ready，
不可以自己決定 css-loading / shell-loading ready。

首頁是簽名式導覽版型，沒有用共用的 [data-jonaminz-header] 元素（見
index.html 開頭註解），所以身分登入狀態顯示不會自動出現在
assets/js/header.js 的 render() 裡——這裡呼叫 header.js 暴露的
window.JonaminzIdentity.mount()，把同一套邏輯插進首頁自己的
nav-links（[data-nav-identity] 容器），不重寫一份 token 判斷邏輯。
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
      linkClassName: "",
      logoutClassName: ""
    });
  }

  function init() {
    try {
      window.JonaminzLoading.done(READY_TASK);
      mountIdentity();
    } catch (error) {
      console.error("[jonaminz] app.js init failed", error);
      window.JonaminzLoading.fail(READY_TASK, error);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
