/*
檔案位置：jonaminz/tools/upload-apk.mjs
用途：OneDrive 線 Phase C（APK 自架，見 AI_CONTEXT/ONEDRIVE_LINE_SPEC.md
§2.3/§7）。本機建完 jonaminz-mobile-app 的 APK 後，用這支腳本上傳到
Jonathan 的 OneDrive App Folder（releases/jonaminz.apk），之後
Worker 的 GET /appDownload 永遠轉址到這份檔案目前的下載連結。

位元組不經過 Worker：先呼叫 createApkUploadSession action 拿 Graph
的 uploadUrl，再直接 PUT 檔案內容給 Graph。

用法：
  node tools/upload-apk.mjs <APK路徑> <session-token>

session-token 從任一身分（Jonathan／Minz）已登入的瀏覽器 devtools
console 讀：localStorage.getItem("jonaminz.sessionToken")——實際存放
固定用 Jonathan 的 OneDrive 帳號，跟這個 token 是哪個身分登入的無關，
這裡只是借用「已登入」這個門檻擋掉未授權呼叫。
*/

import { readFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadWorkerBaseUrl() {
  const configPath = path.join(__dirname, "..", "config.json");
  const config = JSON.parse(readFileSync(configPath, "utf8"));
  const baseUrl = config && config.backend && config.backend.worker && config.backend.worker.baseUrl;
  if (!baseUrl) {
    throw new Error("config.json 缺少 backend.worker.baseUrl");
  }
  return String(baseUrl).replace(/\/+$/, "");
}

async function main() {
  const apkPath = process.argv[2];
  const sessionToken = process.argv[3];
  if (!apkPath || !sessionToken) {
    console.error("用法：node tools/upload-apk.mjs <APK路徑> <session-token>");
    process.exitCode = 1;
    return;
  }

  const baseUrl = loadWorkerBaseUrl();
  const bytes = await readFile(apkPath);
  console.log("讀到 APK：" + apkPath + "（" + bytes.length + " bytes）");

  const sessionResponse = await fetch(baseUrl + "/api/action", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "createApkUploadSession", payload: { token: sessionToken } })
  });
  const sessionResult = await sessionResponse.json();
  if (!sessionResponse.ok || !sessionResult.ok) {
    throw new Error("拿上傳位址失敗：" + (sessionResult.error || ("HTTP " + sessionResponse.status)));
  }
  console.log("已拿到 Graph 上傳位址，開始上傳...");

  const uploadResponse = await fetch(sessionResult.uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Length": String(bytes.length),
      "Content-Range": "bytes 0-" + (bytes.length - 1) + "/" + bytes.length
    },
    body: bytes
  });
  if (!uploadResponse.ok) {
    const text = await uploadResponse.text();
    throw new Error("上傳失敗：HTTP " + uploadResponse.status + " " + text);
  }
  const item = await uploadResponse.json();
  console.log("上傳完成：" + (item.name || "jonaminz.apk") + "（itemId=" + item.id + "）");
  console.log("下載網址：" + baseUrl + "/appDownload");
}

main().catch(function (error) {
  console.error("失敗：" + (error && error.message ? error.message : String(error)));
  process.exitCode = 1;
});
