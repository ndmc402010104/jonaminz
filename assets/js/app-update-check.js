/*
檔案位置：jonaminz/assets/js/app-update-check.js
用途：全站 shell script（跟 chat-launcher.js 同一批，entry-core.js 載入）
——只在原生 Android App（Capacitor WebView）裡執行，比對目前安裝的
versionCode 跟 Worker 回報的最新一版，落後就顯示一條可關閉的更新提示。

2026-07-16：使用者原話「進入頁面通知有app更新請更新」。原生 App 的
versionCode（jonaminz-mobile-app/android/app/build.gradle）跟這個 repo
的 version.js 是兩個獨立版本序列，這支只管前者——網頁本身的版本新舊
已經有既有的 resourceVersion cache-buster 機制處理，不是這支的責任。

刻意獨立成一個檔案：「品牌列/身分」「Chat 入口」「更新提示」是三個不同
職責，不該糾在同一個檔案裡（跟 chat-launcher.js 檔頭同一個理由）。

在瀏覽器（不是原生 App）裡完全不做任何事，第一行就直接 return。
*/
(function () {
  "use strict";

  var plugin = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App;
  if (!plugin || typeof plugin.getInfo !== "function") return;

  var DISMISSED_KEY = "jonaminz.dismissedUpdateVersionCode";

  function readDismissedVersionCode() {
    try {
      var raw = window.localStorage.getItem(DISMISSED_KEY);
      return raw ? parseInt(raw, 10) : 0;
    } catch (error) {
      return 0;
    }
  }

  function writeDismissedVersionCode(versionCode) {
    try {
      window.localStorage.setItem(DISMISSED_KEY, String(versionCode));
    } catch (error) {
      // localStorage 不可用（隱私模式等）：這次提示關掉就沒了，下次
      // 開 App 還是會再跳一次，不是嚴重問題，不用特別處理。
    }
  }

  // 跟 chat-launcher.js 同一個模式：這支是獨立的 shell script，樣式
  // 用注入 <style> 標籤自帶，不額外掛一份 CSS 檔案進 reservoir 層。
  function injectStyle() {
    var style = document.createElement("style");
    style.textContent =
      ".jonaminz-app-update-banner{position:fixed;left:0;right:0;bottom:0;z-index:9998;" +
      "display:flex;align-items:center;gap:10px;flex-wrap:wrap;" +
      "padding:10px 16px;padding-bottom:calc(10px + env(safe-area-inset-bottom));" +
      "background:#2f2a22;color:#f6f3ec;font-size:14px;box-shadow:0 -2px 10px rgba(0,0,0,.2);}" +
      ".jonaminz-app-update-banner span{flex:1;min-width:0;}" +
      ".jonaminz-app-update-banner a{color:#f6f3ec;font-weight:700;text-decoration:underline;white-space:nowrap;}" +
      ".jonaminz-app-update-banner button{flex:none;border:0;background:transparent;color:#f6f3ec;" +
      "font-size:16px;line-height:1;cursor:pointer;padding:4px 6px;}";
    document.head.appendChild(style);
  }

  function showBanner(latestVersionCode, latestVersionName) {
    injectStyle();
    var banner = document.createElement("div");
    banner.className = "jonaminz-app-update-banner";
    banner.innerHTML =
      '<span>有新版本可更新' + (latestVersionName ? "（" + escapeHtml(latestVersionName) + "）" : "") + '</span>' +
      '<a href="https://jonaminz-backend.ndmc402010104.workers.dev/appDownload">下載更新</a>' +
      '<button type="button" aria-label="關閉">✕</button>';
    banner.querySelector("a").addEventListener("click", function () {
      writeDismissedVersionCode(latestVersionCode);
      // 2026-07-16（使用者回報「按了大概5秒才出現開始下載」）：/appDownload
      // 要 Worker 先解析最新檔才回傳，原生 DownloadListener 的 Toast 要
      // 等那幾秒才跳，體感像沒反應。點下去這一刻就把文字換成「準備
      // 下載中…」給即時回饋（同分頁導覽到下載不會離開頁面，這個字會
      // 留著直到系統下載通知出現）。
      var link = this;
      link.textContent = "準備下載中…";
      link.style.pointerEvents = "none";
    });
    banner.querySelector("button").addEventListener("click", function () {
      writeDismissedVersionCode(latestVersionCode);
      banner.remove();
    });
    document.body.appendChild(banner);
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  }

  // 2026-07-16（使用者回報更新提示不跳的根因之一）：backend-client.js
  // 只在需要後端的頁面載入，一般頁面上 window.JonaminzBackend 是
  // undefined，check() 原本第一行就 return、提示永遠不會跳。這支只在
  // 原生 App 裡跑（上面第一行已擋掉瀏覽器），確定要用後端就自己把
  // backend-client 載進來，載完再檢查。
  function ensureBackendThen(callback) {
    if (window.JonaminzBackend && typeof window.JonaminzBackend.getLatestApkVersion === "function") {
      callback();
      return;
    }
    var existing = document.querySelector('script[data-jonaminz-backend-client]');
    if (existing) {
      existing.addEventListener("load", callback, { once: true });
      return;
    }
    var s = document.createElement("script");
    s.src = "/assets/js/backend-client.js";
    s.setAttribute("data-jonaminz-backend-client", "1");
    s.addEventListener("load", callback, { once: true });
    s.addEventListener("error", function () {}, { once: true });
    document.head.appendChild(s);
  }

  function check() {
    if (!window.JonaminzBackend || typeof window.JonaminzBackend.getLatestApkVersion !== "function") return;
    Promise.all([
      plugin.getInfo(),
      window.JonaminzBackend.getLatestApkVersion({})
    ]).then(function (results) {
      var appInfo = results[0];
      var latest = results[1];
      if (!latest || !latest.ok || !latest.versionCode) return;
      var currentVersionCode = parseInt(appInfo && appInfo.build, 10) || 0;
      var latestVersionCode = Number(latest.versionCode);
      if (!currentVersionCode || latestVersionCode <= currentVersionCode) return;
      if (readDismissedVersionCode() >= latestVersionCode) return;
      showBanner(latestVersionCode, latest.versionName);
    }).catch(function () {
      // 查詢失敗（離線／Worker 暫時打不到）：安靜放棄，不影響其他功能，
      // 下次開 App 再試一次就好，不用跳錯誤訊息打擾使用者。
    });
  }

  function run() {
    ensureBackendThen(check);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run, { once: true });
  } else {
    run();
  }
})();
