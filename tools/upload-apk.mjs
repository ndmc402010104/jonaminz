/*
檔案位置：jonaminz/tools/upload-apk.mjs
用途：OneDrive 線 Phase C（APK 自架，見 AI_CONTEXT/ONEDRIVE_LINE_SPEC.md
§2.3/§7）。本機建完 jonaminz-mobile-app 的 APK 後，用這支腳本上傳到
Jonathan 的 OneDrive App Folder。每次上傳的檔名由 Worker 端決定、帶
時間戳（releases/jonaminz-<時間戳>.apk，不覆蓋舊檔），Worker 的
GET /appDownload 永遠轉址到 releases/ 資料夾裡最新那個檔案的下載連結
——2026-07-15 同日稍後改的：原本固定覆蓋同一個檔名，手機下載下來的
檔案永遠同名，使用者反映「怕裝錯」分不出新舊下載。

位元組不經過 Worker：先呼叫 createApkUploadSession action 拿 Graph
的 uploadUrl，再直接 PUT 檔案內容給 Graph。

用法：
  node tools/upload-apk.mjs <APK路徑> <token> [versionCode] [versionName]

`versionCode`／`versionName` 選填——有帶的話上傳成功後會順便呼叫
`reportLatestApkVersion` 存進 Worker，給原生 App 裡的更新提示比對用
（見 `assets/js/app-update-check.js`，2026-07-16 新增）。versionCode
要跟 `jonaminz-mobile-app/android/app/build.gradle` 這次 build 實際
寫的數字一致（可以用 `aapt dump badging` 那個 APK 檔確認，不要手動
猜），沒帶就只上傳檔案、不影響既有下載流程，只是 App 裡不會跳更新
提示。

`<token>` 有兩種都能用，Worker 端會自動判斷（見 worker.js
`requireSessionOrAgentToken()`）：
1. **優先用這個**：`pages/admin/toolkit/`「Agent 存取」小節產生的
   APK 上傳專用固定密鑰——不會過期，agent 自己 build 完可以直接用，
   不用每次跟使用者要。2026-07-16 新增，就是為了取代下面這個選項。
2. 任一身分（Jonathan／Minz）已登入的瀏覽器 devtools console 讀：
   localStorage.getItem("jonaminz.sessionToken")——個人登入 session，
   會過期，且每次都要重新問使用者要，只在專用密鑰還沒設定/失效時
   當備援。
實際存放固定用 Jonathan 的 OneDrive 帳號，跟這個 token 是哪個身分
登入的（或是不是個人登入）無關，這裡只是借用「有沒有效」這個門檻
擋掉未授權呼叫。
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

// 2026-07-16：APK 上傳金鑰改成本機檔案 tools/.apk-upload-token（gitignore，
// 不進版控）。這是為了讓「發佈 APK」完全不用每次跟使用者要 token——
// 存進 Supabase agent_secrets 那份是給 Worker 內部驗證用的，agent 本機
// 讀不到（安全機制擋下把存起來的密鑰值印出來），所以本機工具改用這個
// 慣例的 gitignore 憑證檔（跟 .env 同一個模式）。CLI 第二個參數還是可以
// 手動帶 token 覆蓋（備援），沒帶就讀這個檔。
function loadTokenFromFile() {
  try {
    return readFileSync(path.join(__dirname, ".apk-upload-token"), "utf8").trim();
  } catch (error) {
    return "";
  }
}

async function main() {
  const apkPath = process.argv[2];
  const sessionToken = process.argv[3] || loadTokenFromFile();
  const versionCode = process.argv[4] ? Number(process.argv[4]) : null;
  const versionName = process.argv[5] || "";
  if (!apkPath || !sessionToken) {
    console.error("用法：node tools/upload-apk.mjs <APK路徑> [token] [versionCode] [versionName]");
    console.error("（token 省略時讀 tools/.apk-upload-token）");
    process.exitCode = 1;
    return;
  }
  if (process.argv[4] && (!Number.isInteger(versionCode) || versionCode <= 0)) {
    console.error("versionCode 必須是正整數，收到：" + process.argv[4]);
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

  if (versionCode) {
    const reportResponse = await fetch(baseUrl + "/api/action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "reportLatestApkVersion",
        payload: { token: sessionToken, versionCode: versionCode, versionName: versionName }
      })
    });
    const reportResult = await reportResponse.json();
    if (!reportResponse.ok || !reportResult.ok) {
      console.error("回報版本號失敗（不影響已完成的上傳）：" + (reportResult.error || ("HTTP " + reportResponse.status)));
    } else {
      console.log("已回報最新版本：versionCode=" + versionCode + (versionName ? " versionName=" + versionName : ""));
    }
  }
}

main().catch(function (error) {
  console.error("失敗：" + (error && error.message ? error.message : String(error)));
  process.exitCode = 1;
});
