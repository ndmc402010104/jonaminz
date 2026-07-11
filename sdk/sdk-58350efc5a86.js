/*
 * 自動產生，不要手動編輯。
 * 來源：sdk/sdk-src/sdk.js（內容的 sha256 前 12 碼）
 * 產生方式：node sdk/generate-sdk-release.mjs
 * immutable：這個檔名就是這份內容的身分，內容不會變、也不該被覆寫。
 * sdk-src/sdk.js 改了要重跑這支腳本產生新檔名，並自行決定要不要把
 * backend/cloudflare-worker/sdk-versions.json 的某個 channel 指過來。
 */
/*
檔案位置：jonaminz/sdk/sdk-src/sdk.js
用途：implementation plan 第 5 項的 placeholder release 原始碼。這不是
第 6 項（SDK Kernel）的 window.Jonaminz.* 真實骨架——這裡只證明「版本指標
→ immutable 檔案 → 執行」這條運送鏈是通的，不做 Contract discovery、不做
S21-23 的 Promise/ready 語意。

改這個檔案後要重跑 sdk/generate-sdk-release.mjs 產生新的
sdk/sdk-<hash>.js，並且要人工決定要不要把某個 channel 的指標指過去
（不自動發生）。
*/
(function () {
  "use strict";

  window.Jonaminz = window.Jonaminz || {};
  window.Jonaminz.status = "degraded";
  window.Jonaminz.diagnostics = {
    release: "placeholder",
    reason: "SDK_KERNEL_NOT_IMPLEMENTED"
  };

  console.info("[jonaminz] SDK placeholder loaded — 第 6 項（SDK Kernel）還沒實作。");
})();
