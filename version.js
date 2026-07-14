/*
檔案位置：jonaminz/version.js
時間戳：2026-07-14 11:57 UTC+8
用途：jonaminz 業務版本宣告。
獨立於 SKHPS，這不是 SKHPS_APP_VERSION。這個檔案的 version 字串本身
2026-07-12 起也兼任全站資源的 cache-buster（見 assets/js/entry-core.js
的 resourceVersion／withVersion()）——bump 這個檔案就是讓瀏覽器對所有
靜態資源都拿新版本的唯一機制，push 前一定要記得改。
*/
(function () {
  "use strict";

  window.JONAMINZ_APP_VERSION = {
    appId: "jonaminz",
    version: "v0.24.0-202607141157",
    major: 0,
    minor: 24,
    patch: 0,
    buildTime: "202607141157",
    updatedAt: "2026-07-14T11:57:00+08:00",
    source: "version.js"
  };
})();
