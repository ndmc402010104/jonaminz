/*
檔案位置：jonaminz/sdk/generate-sdk-release.mjs
用途：implementation plan 第 5 項（S37）——immutable SDK release 檔名即身分
（sdk-<hash>.js），內容一改，檔名就要跟著換，才能安全地長快取。這支腳本讀
sdk-src/sdk.js、算 sha256 取前 12 碼、寫出 sdk/sdk-<hash>.js。

用法：改了 sdk-src/sdk.js 之後，在 jonaminz 根目錄執行：

    node sdk/generate-sdk-release.mjs

會印出新產生的檔名與 hash。**這支腳本不會自動改
backend/cloudflare-worker/sdk-versions.json**——要不要把某個 channel
（stable/next）的指標指去這個新版本，是人的發布決定，不該是跑腳本的
副作用（避免半成品或還沒測過的版本被誤發成正式版）。
*/

import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";

const srcPath = new URL("./sdk-src/sdk.js", import.meta.url);
const source = readFileSync(srcPath, "utf8");

const hash = createHash("sha256").update(source).digest("hex").slice(0, 12);
const outName = "sdk-" + hash + ".js";
const outPath = new URL("./" + outName, import.meta.url);

const header =
  "/*\n" +
  " * 自動產生，不要手動編輯。\n" +
  " * 來源：sdk/sdk-src/sdk.js（內容的 sha256 前 12 碼）\n" +
  " * 產生方式：node sdk/generate-sdk-release.mjs\n" +
  " * immutable：這個檔名就是這份內容的身分，內容不會變、也不該被覆寫。\n" +
  " * sdk-src/sdk.js 改了要重跑這支腳本產生新檔名，並自行決定要不要把\n" +
  " * backend/cloudflare-worker/sdk-versions.json 的某個 channel 指過來。\n" +
  " */\n";

writeFileSync(outPath, header + source);
console.log("Wrote " + outPath.pathname);
console.log("hash: " + hash);
console.log("url:  /sdk/" + outName);
