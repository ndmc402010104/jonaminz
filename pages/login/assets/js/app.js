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
Google OAuth 那條路（2026-07-12 起）也把同一個 next 值帶進
/auth/google/start?next=...，worker.js 驗證後存進 oauth_states，
handleGoogleCallback 導回時一併帶上，行為跟內部密語登入一致。

2026-07-13：jonaminz-mobile-app（Capacitor 殼）跑 Google 登入時不能用
一般的整頁導轉——Google 從 2017 年起封鎖從內嵌 WebView 發起的登入請求
（防釣魚，見 https://developers.googleblog.com/2016/08/modernizing-oauth-interactions-in-native-apps.html），
Capacitor 的 server.url 模式底層還是內嵌 WebView，即使載入的是真的
jonaminz 網站也一樣會被擋。isNativeApp() 判斷是不是跑在 Capacitor 殼裡
（server.url 模式下 Capacitor 還是會把 window.Capacitor 注入進來，不用
額外 bundle 任何東西）；是的話改用 window.Capacitor.Plugins.Browser
（Custom Tabs，Google 官方認可的方式）開 Google 登入畫面，origin 也改
成殼註冊的 deep link scheme（com.jonaminz.app://oauth-callback），不是
window.location.origin——Worker 才知道要導回 App 而不是網站本身。deep
link 收到 token 之後怎麼接回網站的 localStorage，見 assets/js/header.js
的對應說明。

只能回報自己的 loading task，不可以自己決定 css/shell ready。
*/
(function () {
  "use strict";

  var READY_TASK = "app-ready";
  var TOKEN_KEY = "jonaminz.sessionToken";
  var IDENTITY_LABEL = { jonathan: "Jonathan", minz: "Minz" };

  // Google 官方四色 "G" 標誌，純視覺辨識用（純 2 人用的個人網站，不是要
  // 拿去上架給大眾用，沒有照 Google 品牌規範做像素級還原的必要）。
  var GOOGLE_ICON_SVG =
    '<svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">' +
      '<path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"/>' +
      '<path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"/>' +
      '<path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/>' +
      '<path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"/>' +
    '</svg>';

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

  var APP_OAUTH_RETURN_ORIGIN = "com.jonaminz.app://oauth-callback";

  function isNativeApp() {
    try {
      return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
    } catch (error) {
      return false;
    }
  }

  function googleStartUrl() {
    var siteConfig = window.JONAMINZ_SITE_CONFIG || {};
    var baseUrl = (siteConfig.backend && siteConfig.backend.worker && siteConfig.backend.worker.baseUrl) || "";
    // 帶自己的網域給 Worker，登入完成後才知道要導回正式站、本機
    // localhost:5500，還是 App 殼的 deep link（見 worker.js 的
    // resolveOauthReturnOrigin 白名單——Worker 只認白名單裡的值，這裡
    // 帶什麼字串都不會變成漏洞）。跑在 App 殼裡時用註冊好的 deep link
    // scheme，不是 window.location.origin（那個永遠是
    // https://www.jonaminz.com，因為 WebView 載入的就是真的網站，用
    // 這個值 Worker 會導回網站本身而不是 App）。
    // next 用 getNextUrl() 同一套白名單邏輯（本檔案函式宣告會 hoist，
    // 呼叫順序跟定義順序無關），讓 Google 登入跟內部密語登入一樣能
    // 導回原本要去的那一頁，不是永遠回首頁。
    var origin = isNativeApp() ? APP_OAUTH_RETURN_ORIGIN : window.location.origin;
    return (
      baseUrl.replace(/\/+$/, "") +
      "/auth/google/start?origin=" + encodeURIComponent(origin) +
      "&next=" + encodeURIComponent(getNextUrl())
    );
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

  function identityBadgeHtml(identityValue) {
    var label = IDENTITY_LABEL[identityValue] || identityValue || "?";
    return '<span class="jonaminz-identity-badge jonaminz-identity-badge--' + escapeHtml(identityValue || "") + '">' +
      escapeHtml(label.charAt(0).toUpperCase()) + '</span>';
  }

  function renderLoggedIn(root, identity) {
    root.innerHTML =
      '<p class="jonaminz-eyebrow">Jonaminz Login</p>' +
      '<h1 class="jonaminz-admin-title">已經登入了</h1>' +
      '<p class="jonaminz-login-identity">' + identityBadgeHtml(identity) +
        '<span>' + escapeHtml(IDENTITY_LABEL[identity] || identity) + '你好，不用重複登入。</span></p>' +
      '<a class="btn btn-primary" href="' + escapeHtml(getNextUrl()) + '">回首頁</a>';
  }

  function renderForm(root) {
    root.innerHTML =
      '<p class="jonaminz-eyebrow">Jonaminz Login</p>' +
      '<h1 class="jonaminz-admin-title">登入</h1>' +
      '<a class="jonaminz-login-google-btn" data-google-login href="' + escapeHtml(googleStartUrl()) + '">' +
        GOOGLE_ICON_SVG + '<span>用 Google 登入</span></a>' +
      '<p class="jonaminz-login-divider"><span>或</span></p>' +
      '<form data-login-form class="jonaminz-login-form">' +
        '<label>內部密語 <input type="password" data-login-token placeholder="Jonathan / Minz 才知道的密語" autocomplete="current-password"></label>' +
        '<button type="submit" class="btn btn-ghost">登入</button>' +
      '</form>' +
      '<p data-login-error class="jonaminz-login-error"></p>';

    // App 殼裡不能讓這顆連結直接導轉整個 WebView 去 Google（會被 Google
    // 政策擋下，見檔頭說明）——攔截點擊，改用 Custom Tabs 開。一般瀏覽器
    // （isNativeApp() 為 false）維持原本的整頁導轉，不用多一層 JS。
    var googleLink = root.querySelector("[data-google-login]");
    if (googleLink && isNativeApp()) {
      googleLink.addEventListener("click", function (event) {
        event.preventDefault();
        if (window.Capacitor.Plugins && window.Capacitor.Plugins.Browser) {
          window.Capacitor.Plugins.Browser.open({ url: googleStartUrl() });
        }
      });
    }

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
