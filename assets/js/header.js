/*
檔案位置：jonaminz/assets/js/header.js
用途：jonaminz 共用 header（水庫 shell 層）。頁面本身不應該自己 render header。

implementation plan 第 9 項擴充：每頁載入時檢查登入狀態，顯示「OO你好」＋
登出按鈕，或未登入時顯示「登入」連結。這是全站共用能力，所以核心邏輯放在
這裡（shell 層），透過 window.JonaminzIdentity 讓其他頁面重複使用——首頁
（index.html）是簽名式導覽版型，沒有用共用的 [data-jonaminz-header] 元素，
是自己的 nav-links 疊 class，所以 assets/js/app.js 會呼叫
window.JonaminzIdentity.mount() 把身分區塊插進它自己的 nav 容器，
不重複寫一份 token/getCurrentIdentity 邏輯。

Google OAuth 走 /auth/google/callback 302 導回首頁時，token 會帶在網址
fragment（#jonaminzSessionToken=...，見 worker.js handleGoogleCallback）
——fragment 不會送到伺服器，所以要在前端自己讀出來、存進 localStorage、
再用 history.replaceState 清掉，避免留在網址列/瀏覽紀錄。captureTokenFromHash()
故意寫在 IIFE 最外層、不等 [data-jonaminz-header] 元素存在就先執行——首頁
沒有這個元素，如果邏輯包在「找不到就 return」的 render() 裡面，OAuth
導回首頁時 token 永遠不會被存下來，這是本檔案第一版寫法漏掉的情況。

2026-07-13：jonaminz-mobile-app（Capacitor 殼）跑 Google 登入走 Custom
Tabs（見 pages/login/assets/js/app.js 檔頭說明），完成後 Worker 導回的
不是網頁網址，是 App 註冊的 deep link（com.jonaminz.app://oauth-callback，
見 android/app/src/main/AndroidManifest.xml 的 intent-filter）——這個
URL 不會經過 WebView 的一般導頁流程，是 Capacitor 的 App 外掛
（@capacitor/app）用 appUrlOpen 事件通知回來，captureTokenFromHash()
讀的 window.location.hash 收不到它。listenForAppUrlOpen() 是這條路
專用的接收端，直接從事件帶的 URL 字串抓 token、寫 localStorage，跟
captureTokenFromHash() 共用同一個 writeToken()，不重複一套邏輯。只在
isNativeApp() 為 true（真的跑在殼裡）才註冊監聽，一般瀏覽器不受影響。

backend-client.js 平常只有需要它的頁面才會在 config.json 的 afterScripts
載入，但這裡（shell 層，比 afterScripts 更早跑）需要它來查登入狀態，所以
用 ensureBackendClient() 動態補載入，沒有改 entry-core.js 的載入順序或
各頁 config.json 的 afterScripts 設定——backend-client.js 本身是 idempotent
（重複載入只是重複賦值 window.JonaminzBackend），後台頁之後自己的
afterScripts 再載一次也不會壞。

後續（後台整站加登入保護）：window.JonaminzIdentity 另外暴露
requireLogin()——沒登入就導去 /pages/login/?next=<目前路徑>，是後台
三頁（pages/admin/、admin/theme/、admin/contracts/）跟 Theme 存檔/
Contract 核准/否決這三個寫入動作共用的權限關卡。跟 mount() 的差異見
requireLogin() 自己的註解。
*/
(function () {
  "use strict";

  var TOKEN_KEY = "jonaminz.sessionToken";
  var IDENTITY_LABEL = { jonathan: "Jonathan", minz: "Minz" };

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
      // localStorage 不可用（例如無痕模式的部分瀏覽器設定）就放棄，
      // 不影響頁面其他功能，之後 getCurrentIdentity 單純會查不到身分。
    }
  }

  function clearToken() {
    try {
      window.localStorage.removeItem(TOKEN_KEY);
    } catch (error) {
      // 同上，放棄即可。
    }
  }

  function isNativeApp() {
    try {
      return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
    } catch (error) {
      return false;
    }
  }

  function listenForAppUrlOpen() {
    if (!isNativeApp()) return;
    if (!window.Capacitor.Plugins || !window.Capacitor.Plugins.App) return;

    window.Capacitor.Plugins.App.addListener("appUrlOpen", function (event) {
      var url = String((event && event.url) || "");
      var match = url.match(/[#&]jonaminzSessionToken=([^&]+)/);
      if (!match) return;

      writeToken(decodeURIComponent(match[1]));
      // 重新整理讓 header 的「OO你好」、後台頁的 requireLogin() 重新
      // 判斷一次登入狀態——token 是直接從 deep link 事件拿到的，不是從
      // 網址列 fragment 讀來的，不用像 captureTokenFromHash() 那樣另外
      // 清網址。
      window.location.reload();
    });
  }

  // Android 實體返回鍵預設行為是直接關掉整個 App（Capacitor 本身不會
  // 自動把返回鍵接到 WebView 的瀏覽歷史，要自己註冊）。canGoBack 是
  // Capacitor 用 WebView 自己的 canGoBack() 算出來的，比自己猜
  // window.history.length 準——能往前一頁就往前一頁，真的沒有上一頁
  // （已經在最外層，例如首頁）才整個退出 App，是 Capacitor 官方文件
  // 建議的標準寫法。
  function listenForBackButton() {
    if (!isNativeApp()) return;
    if (!window.Capacitor.Plugins || !window.Capacitor.Plugins.App) return;

    window.Capacitor.Plugins.App.addListener("backButton", function (event) {
      if (event && event.canGoBack) {
        window.history.back();
      } else {
        window.Capacitor.Plugins.App.exitApp();
      }
    });
  }

  function captureTokenFromHash() {
    var hash = window.location.hash || "";
    var match = hash.match(/[#&]jonaminzSessionToken=([^&]+)/);
    if (!match) return;

    writeToken(decodeURIComponent(match[1]));

    var cleaned = hash.replace(/[#&]jonaminzSessionToken=[^&]+/, "");
    if (cleaned && cleaned !== "#") {
      cleaned = "#" + cleaned.replace(/^[#&]+/, "");
    } else {
      cleaned = "";
    }
    var url = window.location.pathname + window.location.search + cleaned;
    window.history.replaceState(null, "", url);
  }

  function ensureBackendClient() {
    if (window.JonaminzBackend) return Promise.resolve();

    return new Promise(function (resolve, reject) {
      var script = document.createElement("script");
      script.src = "/assets/js/backend-client.js";
      script.onload = function () { resolve(); };
      script.onerror = function () { reject(new Error("load failed: backend-client.js")); };
      document.head.appendChild(script);
    });
  }

  function classOrDefault(value, fallback) {
    return value === undefined ? fallback : value;
  }

  function buildIdentityBox(identity, options) {
    options = options || {};

    var box = document.createElement("span");
    box.className = classOrDefault(options.wrapperClassName, "jonaminz-header-identity");

    if (identity && IDENTITY_LABEL[identity]) {
      var greeting = document.createElement("span");
      var greetingClassName = classOrDefault(options.greetingClassName, "");
      if (greetingClassName) greeting.className = greetingClassName;
      greeting.textContent = IDENTITY_LABEL[identity] + "你好";
      box.appendChild(greeting);

      // 首頁拿掉「共用入口」按鈕後，登入態下沒有路徑回後台了——只有
      // 呼叫端明確要求（options.showAdminLink）才加這個連結，避免在
      // 已經身處後台的頁面（admin/theme/contracts）也顯示一個多餘的
      // 「回後台」。
      if (options.showAdminLink) {
        var adminLink = document.createElement("a");
        adminLink.className = classOrDefault(options.adminLinkClassName, "");
        adminLink.href = "/pages/admin/";
        adminLink.textContent = "後台";
        box.appendChild(adminLink);
      }

      var logoutBtn = document.createElement("button");
      logoutBtn.type = "button";
      logoutBtn.className = classOrDefault(options.logoutClassName, "btn");
      logoutBtn.textContent = "登出";
      logoutBtn.addEventListener("click", function () {
        var token = readToken();
        clearToken();
        if (token && window.JonaminzBackend && typeof window.JonaminzBackend.logout === "function") {
          window.JonaminzBackend.logout({ token: token }).catch(function () {});
        }
        window.location.reload();
      });
      box.appendChild(logoutBtn);
    } else {
      var loginLink = document.createElement("a");
      loginLink.className = classOrDefault(options.linkClassName, "jonaminz-header-login-link");
      loginLink.href = "/pages/login/";
      loginLink.textContent = "登入";
      box.appendChild(loginLink);
    }

    return box;
  }

  function mount(container, options) {
    if (!container) return;

    var token = readToken();
    if (!token) {
      container.appendChild(buildIdentityBox(null, options));
      return;
    }

    ensureBackendClient()
      .then(function () {
        return window.JonaminzBackend.getCurrentIdentity({ token: token });
      })
      .then(function (response) {
        container.appendChild(buildIdentityBox(response && response.identity ? response.identity : null, options));
      })
      .catch(function (error) {
        console.error("[jonaminz] JonaminzIdentity.mount failed", error);
        container.appendChild(buildIdentityBox(null, options));
      });
  }

  function redirectToLogin() {
    var next = window.location.pathname + window.location.search;
    window.location.href = "/pages/login/?next=" + encodeURIComponent(next);
  }

  // 給真正需要「沒登入就不准看」的頁面用（後台三頁），跟 mount() 刻意不
  // 對稱：mount() 網路失敗時「失敗開放」（顯示登入連結，頁面照常運作，
  // 適合只是「順便打個招呼」的場合），requireLogin() 是「失敗關閉」
  // （任何失敗都導去登入頁）——對一個真正的權限關卡來說，寧可 Worker/
  // Supabase 短暫故障時後台進不去，也不要意外讓沒登入的人看到內容。
  // 回傳的 Promise 在「沒登入」的情況下設計成永遠不 resolve/reject：
  // 呼叫端這時候已經在導頁離開了，不需要、也不應該讓後續程式碼繼續跑。
  function requireLogin() {
    var token = readToken();
    if (!token) {
      redirectToLogin();
      return new Promise(function () {});
    }

    return ensureBackendClient()
      .then(function () {
        return window.JonaminzBackend.getCurrentIdentity({ token: token });
      })
      .then(function (response) {
        var identity = response && response.identity;
        if (!identity) {
          redirectToLogin();
          return new Promise(function () {});
        }
        return identity;
      })
      .catch(function (error) {
        console.error("[jonaminz] JonaminzIdentity.requireLogin failed", error);
        redirectToLogin();
        return new Promise(function () {});
      });
  }

  window.JonaminzIdentity = {
    captureTokenFromHash: captureTokenFromHash,
    mount: mount,
    requireLogin: requireLogin,
    readToken: readToken
  };

  captureTokenFromHash();
  listenForAppUrlOpen();
  listenForBackButton();

  function render() {
    var el = document.querySelector("[data-jonaminz-header]");
    if (!el) return;

    var siteConfig = window.JONAMINZ_SITE_CONFIG || {};

    el.textContent = "";

    // 品牌字回首頁（原本是 <span>，點了沒反應——後台/Theme/Contracts/
    // 登入頁沒有其他回首頁的路，只能靠瀏覽器上一頁）。
    var title = document.createElement("a");
    title.className = "jonaminz-header-title";
    title.href = "/";
    title.textContent = siteConfig.title || "Jonaminz";
    el.appendChild(title);

    mount(el);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", render, { once: true });
  } else {
    render();
  }
})();
