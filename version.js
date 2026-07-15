/*
檔案位置：jonaminz/version.js
時間戳：2026-07-15 22:33 UTC+8
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
    version: "v0.44.2-202607152233",
    major: 0,
    minor: 44,
    patch: 2,
    buildTime: "202607152233",
    updatedAt: "2026-07-15T22:33:00+08:00",
    source: "version.js"
  };
})();
