/*
檔案位置：jonaminz/pages/login/assets/js/app.js
用途：登入頁自己的業務入口（水庫下游層）。兩條登入路都在這頁：
1. 內部密語表單 -> loginWithInternalToken action。
2. 「用 Google 登入」連結 -> 直接導去 Worker 的 /auth/google/start
   （這是一般網頁導頁，不是 fetch；Worker 會 302 到 Google 的同意畫面）。

session token 存進 localStorage 的 key（jonaminz.sessionToken）跟
pages/identity-relay/index.html、assets/js/header.js 用的是同一把 key，
三邊都要一致，登入/登出/身分轉發才能認到同一顆 token。

支援 ?next=<路徑>（後台頁被 requireLogin() 導過來時會帶這個），內部密語
登入成功後導去 next 而不是固定回首頁。next 只接受同源相對路徑（開頭是
單一個 /，不含 :// 也不是 //開頭）——不驗證就直接拿使用者可控的字串當
redirect 目標是開放式重導向漏洞，這裡故意收斂成白名單式檢查而不是黑名單。
Google OAuth 那條路這次沒有把 next 一起帶過去（worker.js 的
handleGoogleCallback 固定導回首頁），是已知、刻意先不修的小缺口。

只能回報自己的 loading task，不可以自己決定 css/shell ready。
*/
(function () {
  "use strict";

  var READY_TASK = "app-ready";
  var TOKEN_KEY = "jonaminz.sessionToken";
  var IDENTITY_LABEL = { jonathan: "Jonathan", minz: "Minz" };

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  }

  function readToken() {
    try {
      return window.localStorage.getItem(TOKEN_KEY);
    } catch (error) {
      return null;
    }
  }

  function writeToken(token) {
    try {
      window.localStorage.setItem(TOKEN_KEY, token);
    } catch (error) {
      // 存不進去就算了，下面會顯示登入成功但畫面不會自動切換成已登入狀態，
      // 使用者重新整理應該就會發現沒有真的登入——不隱藏這個失敗比較誠實。
    }
  }

  function googleStartUrl() {
    var siteConfig = window.JONAMINZ_SITE_CONFIG || {};
    var baseUrl = (siteConfig.backend && siteConfig.backend.worker && siteConfig.backend.worker.baseUrl) || "";
    return baseUrl.replace(/\/+$/, "") + "/auth/google/start";
  }

  function getNextUrl() {
    try {
      var next = new URLSearchParams(window.location.search).get("next");
      if (!next) return "/";
      if (next.indexOf("://") !== -1) return "/";
      if (next.slice(0, 2) === "//") return "/";
      if (next.charAt(0) !== "/") return "/";
      return next;
    } catch (error) {
      return "/";
    }
  }

  function renderLoggedIn(root, identity) {
    root.innerHTML =
      '<p class="jonaminz-eyebrow">Jonaminz Login</p>' +
      '<h1 class="jonaminz-admin-title">已經登入了</h1>' +
      '<p class="jonaminz-admin-subtitle">' + escapeHtml(IDENTITY_LABEL[identity] || identity) + '你好，不用重複登入。</p>' +
      '<a class="btn" href="' + escapeHtml(getNextUrl()) + '">回首頁</a>';
  }

  function renderForm(root) {
    root.innerHTML =
      '<p class="jonaminz-eyebrow">Jonaminz Login</p>' +
      '<h1 class="jonaminz-admin-title">登入</h1>' +
      '<a class="btn jonaminz-login-google-btn" href="' + escapeHtml(googleStartUrl()) + '">用 Google 登入</a>' +
      '<p class="jonaminz-login-divider">或</p>' +
      '<form data-login-form class="jonaminz-login-form">' +
        '<label>內部密語 <input type="password" data-login-token placeholder="Jonathan / Minz 才知道的密語" autocomplete="current-password"></label>' +
        '<button type="submit" class="btn">登入</button>' +
      '</form>' +
      '<p data-login-error class="jonaminz-login-error"></p>';

    var form = root.querySelector("[data-login-form]");
    var tokenInput = root.querySelector("[data-login-token]");
    var errorEl = root.querySelector("[data-login-error]");

    form.addEventListener("submit", function (event) {
      event.preventDefault();

      var token = (tokenInput.value || "").trim();
      errorEl.textContent = "";

      if (!token) {
        errorEl.textContent = "請輸入密語。";
        return;
      }

      if (!window.JonaminzBackend || typeof window.JonaminzBackend.loginWithInternalToken !== "function") {
        errorEl.textContent = "後端尚未載入，稍後再試。";
        return;
      }

      window.JonaminzBackend.loginWithInternalToken({ token: token })
        .then(function (response) {
          if (!response || !response.ok || !response.token) {
            throw new Error("登入失敗");
          }
          writeToken(response.token);
          window.location.href = getNextUrl();
        })
        .catch(function (error) {
          errorEl.textContent = "登入失敗：" + (error && error.message ? error.message : String(error));
        });
    });
  }

  function render() {
    var root = document.querySelector("[data-app-root]");
    if (!root) return;

    var token = readToken();
    if (!token || !window.JonaminzBackend || typeof window.JonaminzBackend.getCurrentIdentity !== "function") {
      renderForm(root);
      return;
    }

    window.JonaminzBackend.getCurrentIdentity({ token: token })
      .then(function (response) {
        if (response && response.identity) {
          renderLoggedIn(root, response.identity);
        } else {
          renderForm(root);
        }
      })
      .catch(function () {
        renderForm(root);
      });
  }

  function init() {
    try {
      render();
      window.JonaminzLoading.done(READY_TASK);
    } catch (error) {
      console.error("[jonaminz] login app.js init failed", error);
      window.JonaminzLoading.fail(READY_TASK, error);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
