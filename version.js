/*
檔案位置：jonaminz/version.js
用途：jonaminz 業務版本宣告。
獨立於 SKHPS，這不是 SKHPS_APP_VERSION，也不是 cache-buster（cache-buster 是 JONAMINZ_ENTRY_VERSION，見 index.html）。
*/
(function () {
  "use strict";

  window.JONAMINZ_APP_VERSION = {
    appId: "jonaminz",
    version: "v0.1.0-202607090000",
    major: 0,
    minor: 1,
    patch: 0,
    buildTime: "202607090000",
    updatedAt: "2026-07-09T00:00:00+08:00",
    source: "version.js"
  };
})();
