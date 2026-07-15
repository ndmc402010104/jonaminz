/*
檔案位置：jonaminz/backend/cloudflare-worker/worker.js
用途：jonaminz 水庫唯一後端入口。目前支援的 action：
- registerExternalApp：外部專案自己的頁面載入時回報「我上線了」，upsert 進 Supabase。
- listExternalAppRegistrations：後台讀取回報清單。
- getThemeCssRules：讀取 Theme（CSS 疊加第 8 層）目前的規則，任何頁面 / 外部專案都能讀
  （公開、唯讀，selector=":root" 的規則是跨專案共用的 token 介面）。
- saveThemeCssRules：後台 Theme 頁存檔用，整批覆蓋規則。要求 payload.token
  是一筆有效的 session（見 requireSession），沒登入一律拒絕。
- submitContract：Platform Integration（圖書館模型）的合約推送入口。對應規格
  docs/platform-integration-spec-v1.md（Frozen, S13-S16）。收下的合約一律存成
  immutable snapshot、status 一律 'pending'——推送 ≠ 採信，不會自動 approve。
- listPendingContracts：核准後台讀取清單用，公開唯讀（跟
  listExternalAppRegistrations 同一個原則）。回傳最近 N 筆 snapshot，並附上
  每個 (project_id, environment) 目前 active 的版本供前端做 diff（S14）。
  active 版本裡的 `origin` 欄位（implementation plan：Movie 主題卡片
  真實連結）來自 integration-settings.json 的伺服器端登記資料，不是
  snapshot 自己的 submitted_origin——後者是送出當下的自報值、同一專案
  不同筆可能不一致或是 null，前端組外部連結不能信它。
- approveContract / rejectContract：implementation plan 第 3 項的核准/否決。
  要求 payload.token 是一筆有效的 session（見 requireSession，跟
  saveThemeCssRules 同一套機制，取代了原本第 3 項寫的 Worker secret
  JONAMINZ_ADMIN_TOKEN 臨時關卡——那把密語已經淘汰，Worker 不再讀它）。
  **操作人（p_actor）直接用登入身分**，不再吃 payload.actor：原本前端
  是按鈕手動切換 Jonathan/Minz 自報身分，沒有真的驗證是誰在按，現在
  改成用登入者是誰決定，堵掉「可以假裝是另一個人」的漏洞。
  實際的狀態切換透過 Supabase RPC 呼叫 Postgres function
  approve_contract_snapshot / reject_contract_snapshot（見
  backend/supabase/contract_schema.sql），確保「改狀態＋切換 active 指標＋
  寫 audit log」是同一個原子操作，不是 Worker 端連續多次 fetch。
- getEffectiveSettings：implementation plan 第 4 項。S31 公式（Effective =
  Approved Contract supports ∩ Settings 授權 ∩ Runtime 可用 ∩ Actor 允許）
  在這裡算，公開唯讀。environment 不從 payload 讀，理由跟 submitContract
  一樣：一律用這個 Worker 部署自己的 JONAMINZ_ENVIRONMENT，避免呼叫端
  謊報 environment 繞過檢查。沒有 active approved snapshot 時回
  `approved:false, css:"none"`（S31 明文規定的降級）；有的話回
  `css: Contract 聲明 × Settings 授予 的 min`（S34，v1 只有 none/tokens
  兩級）。`capabilities` 從 implementation plan 第 9 項階段 B 起是真實值
  （Approved Contract `capabilities.supports` ∩ Integration Settings
  `capabilities` 授權，見 `resolveEffectiveCapabilities`）——但這只是給
  SDK 一個「值不值得嘗試」的提示，S33 規定不能當授權證明，會回傳實際資料
  的 action（例如下面的 getGrantedIdentity）要自己逐請求重算一次。這個
  端點回答的是「准不准套用 tokens／有哪些 capability」，不是「tokens 的
  規則長怎樣」，後者仍是 getThemeCssRules 的事，這次沒有動它。
- getSdkVersion：implementation plan 第 5 項（S37）。公開唯讀，回傳
  `sdk-versions.json` 裡某個 channel（stable/next）目前指向哪個
  immutable release（`hash`/`url`）。`payload.projectId` 選填——有給的話
  查 `integration-settings.json` 該專案的 `channel` 欄位決定金絲雀
  channel，省略/查無 → `"stable"`。這是 SDK loader（`sdk/jonaminz-entry.js`）
  用來決定該載入哪個 `sdk/sdk-<hash>.js` 的唯一依據；回滾／kill-switch
  都是直接改 `sdk-versions.json` 對應 channel 的指標再 `wrangler deploy`，
  不是複雜系統（S39）。
- loginWithInternalToken / getCurrentIdentity / logout：implementation
  plan 第 9 項階段 A，jonaminz 主站登入（S6：只做 Jonathan/Minz 兩個
  固定身分，不是開放註冊系統）。內部密語登入跟 JONAMINZ_ADMIN_TOKEN
  同精神，但要分辨是誰（JONAMINZ_LOGIN_JONATHAN／JONAMINZ_LOGIN_MINZ
  兩個 secret）。登入成功後的身分存在 Supabase `sessions` 表（不是
  自簽 JWT，是為了能真的登出/撤銷），token 由前端存自己的
  localStorage、之後每次呼叫 getCurrentIdentity/logout 都帶在
  payload 裡——不是 cookie（`jonaminz.com` 的 DNS 掛在 Squarespace，
  Worker 沒辦法對 `.jonaminz.com` 設 cookie，見
  `docs/platform-integration-v1-implementation-plan.md` 第 9 項的
  查證紀錄）。這三個 action 走既有的 `Access-Control-Allow-Origin: *`，
  不涉及 credentials，不用改 CORS。
- listChatMessages / sendChatMessage / markChatRead：2026-07-14 新增，
  Jonaminz Chat 第一個真實里程碑（見 jonaminz-chat交接包/00_START_HERE.md）：
  Jonathan／Minz 兩個真實登入身分互傳文字、真實未讀、真實已讀。三個
  action 都要求 `requireSession`（沒登入一律拒絕），身分不是前端自報。
  只有一間固定聊天室（couple-chat/jonathan-minz），Worker 端直接解析
  room id，前端不傳也不能指定房間。**刻意不做 WebSocket／Durable
  Object**，前端用 polling（每幾秒呼叫一次 listChatMessages）取代即時
  推播——這是交接包 WORK_PLAN.md 自己列出的「方案 C：Worker polling 作為
  極簡 MVP」，用來先證明端到端流程能動，不是長期最終架構；之後如果需要
  更即時的 typing/presence，再評估要不要換成方案 A（Durable Object）。
  `sendChatMessage` 用 `clientMessageId` 做 idempotent 重試（撞到既有的
  unique constraint 時回傳既有那筆，不當錯誤）。資料表見
  `backend/supabase/chat_schema.sql`（已套用到正式 `jonaminz-db`）。
- getGrantedIdentity：implementation plan 第 9 項階段 B（`identity.current-user@1`
  capability，S30-33）。只給 `pages/identity-relay/` 呼叫，不是給外部
  專案的 SDK 直接打——token 永遠留在 jonaminz.com 自己的瀏覽器裡。用
  `resolveEffectiveCapabilities` 重新算一次 `identity.current-user@1`
  是否在該 (projectId, environment) 的授權交集裡（S33：不信任何快取），
  沒授權直接回 `granted:false, identity:null`，連 session 查詢都不做，
  避免對未授權的呼叫端洩漏「現在有沒有人登入」這個資訊本身。
- `GET /auth/google/start` ／ `GET /auth/google/callback`：**唯二
  不是 `POST /api/action` 的路徑**——Google OAuth 的 authorization
  code flow 本質是瀏覽器導航（302 redirect），不是 fetch() 呼叫。
  `start` 讀 `?origin=`（登入頁自己的網域）比對
  `ALLOWED_OAUTH_RETURN_ORIGINS` 白名單，連同一次性 `state`（存
  Supabase `oauth_states` 表，短 TTL，CSRF 防護）一起存進去，再導去
  Google 同意畫面；`callback` 核對 `state`、拿 `code` 跟 Google 換
  token、解出 email、比對允許清單（JONAMINZ_GOOGLE_EMAIL_JONATHAN／
  JONAMINZ_GOOGLE_EMAIL_MINZ，不在清單內一律拒絕）、建立 session，
  302 導回 **當初存的那個 origin**（不是寫死正式站——2026-07-12 修，
  本機 `localhost:5500` 登入以前一律被導去正式站，本機測不了這條路），
  token 放在 URL fragment（`#jonaminzSessionToken=...`，fragment 不會
  送到伺服器）。
- `GET /auth/onedrive/start` ／ `GET /auth/onedrive/callback`：OneDrive
  線 Phase A（2026-07-15，AI_CONTEXT/ONEDRIVE_LINE_SPEC.md）。不是
  使用者登入，是把「這個 App 讀寫某人 OneDrive App Folder」的授權動作
  ——**雙帳號模式**：Jonathan／Minz 各自連自己的 OneDrive（兩人都想
  從自己帳號查得到聊天圖庫；Phase B 傳圖只上傳一份到傳送者帳號，用
  Graph 原生分享機制授權對方讀取，不重複佔用兩份容量）。跟 Google
  登入共用 `oauth_states` 表擋 CSRF（`return_origin` 欄位這裡存的是
  發起連接的登入身分，不是要導回的網域）。`start` 要求呼叫者已登入
  （不管哪個身分），要連接誰的帳號由 `?identity=jonathan|minz` 參數
  決定，不強制等於呼叫者自己的登入身分——2026-07-15 使用者明確要求：
  Jonathan／Minz 本來就共用彼此帳密，「只能連自己」這層限制沒有實際
  安全意義；`callback` 用 authorization code 跟 Microsoft 換 refresh
  token 存進 `onedrive_account` 表（見 `backend/supabase/onedrive_schema.sql`，
  `identity` 是 primary key，兩人各一列），完成後回一頁純文字結果
  （沒有 session token 要交回瀏覽器）。
- `getOnedriveStatus`：回傳 Jonathan／Minz 兩人各自的連接狀態（後台
  要同時畫兩張卡片），任何已登入身分都能查。`testOnedriveConnection`：
  payload 可選填 `identity` 指定要測誰的帳號（不填就測呼叫者自己），
  實際拿 access token 打 Graph `me/drive/special/approot` 驗證連線是否
  真的可用（不只是「有存 refresh_token」這種表面狀態），Phase A 的
  驗收動作。
- `listProjectTasks` / `addProjectTask` / `toggleProjectTask` /
  `deleteProjectTask`：`pages/admin/journal/`（決策與待辦頁）的待辦
  看板，2026-07-15 新增。單一全域清單，兩條泳道（`for_user`／
  `for_claude`），任何已登入身分都能操作任一泳道的任一筆——跟
  OneDrive 連接同一個信任模型（兩人共用帳密，不用分誰能動哪個泳道）。

機密只存在 Cloudflare Worker 的 secret（SUPABASE_URL / SUPABASE_SECRET_KEY，對應
Supabase 新版 API key 命名：sb_secret_... 這把，不是 sb_publishable_...），
不寫死在程式碼裡，也不會回傳給前端。
*/

import validateContractSchema from "./contract-schema-validator.generated.js";
import integrationSettings from "./integration-settings.json";
import sdkVersions from "./sdk-versions.json";
import { computeCanonicalHash, validateCrossFields, validateUrls } from "./contract-validation.js";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};

// S15：payload size 上限。兩層防線：MAX_REQUEST_BODY_BYTES 是 pre-parse（在
// request.json() 之前，用 Content-Length header 擋，避免無條件把任意大小的
// body 讀進記憶體才發現太大）；MAX_CONTRACT_SIZE_CHARS 是 post-parse，專門
// 針對 payload.contract 的字串長度。完整 rate limit（依 request 頻率擋濫用）
// 需要 KV binding，2026-07-11 使用者正式裁決留白——目前沒有真實外部專案在
// 打這支 API，等第一個真的要接時再做，見 backend/README.md。
const MAX_REQUEST_BODY_BYTES = 256 * 1024;
const MAX_CONTRACT_SIZE_CHARS = 200000;

// validateContractSchema 是 build time 用 generate-contract-validator.mjs 預先編譯好的
// ajv standalone validator，不是 runtime ajv.compile()——Cloudflare Workers 禁止
// new Function/eval，runtime 編譯 schema 會直接讓部署失敗。改 schema 後要重跑那支腳本。

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Google OAuth 的 redirect flow 是瀏覽器導航，不是 fetch()——這兩條
    // 路徑刻意不走下面 POST /api/action 那套，各自獨立處理、獨立回應，
    // 自己包 try/catch（不燒房子：拋出例外也要回一個看得懂的錯誤頁，
    // 不是丟 Cloudflare 預設的 500 頁面）。
    if (request.method === "GET" && url.pathname === "/auth/google/start") {
      try {
        return await handleGoogleStart(env, url);
      } catch (error) {
        return new Response("Login failed: " + (error.message || String(error)), { status: 500 });
      }
    }
    if (request.method === "GET" && url.pathname === "/auth/google/callback") {
      try {
        return await handleGoogleCallback(env, url);
      } catch (error) {
        return new Response("Login failed: " + (error.message || String(error)), { status: 500 });
      }
    }

    // OneDrive 線（見 AI_CONTEXT/ONEDRIVE_LINE_SPEC.md）：這不是「使用者
    // 登入」，是「把 Jonathan 的個人 OneDrive 授權給這個 App 讀寫 App
    // Folder」的一次性連接動作，跟 Google 登入一樣是瀏覽器導向流程，
    // 所以也不走 POST /api/action。
    if (request.method === "GET" && url.pathname === "/auth/onedrive/start") {
      try {
        return await handleOnedriveStart(env, url);
      } catch (error) {
        return new Response("OneDrive connect failed: " + (error.message || String(error)), { status: 500 });
      }
    }
    if (request.method === "GET" && url.pathname === "/auth/onedrive/callback") {
      try {
        return await handleOnedriveCallback(env, url);
      } catch (error) {
        return new Response("OneDrive connect failed: " + (error.message || String(error)), { status: 500 });
      }
    }

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS_HEADERS });
    }

    if (request.method !== "POST") {
      return json({ ok: false, error: "Method not allowed" }, 405);
    }

    // pre-parse 粗防：Content-Length 超過上限直接拒絕，不要無條件把整個 body
    // 讀進記憶體、parse 完才發現太大。Content-Length 缺席或造假時這層擋不住
    // （例如 chunked encoding），但擋得住絕大多數正常情況，且成本極低。
    const contentLength = request.headers.get("Content-Length");
    if (contentLength && Number(contentLength) > MAX_REQUEST_BODY_BYTES) {
      return json({ ok: false, error: "Request body too large" }, 413);
    }

    let body;

    try {
      body = await request.json();
    } catch (error) {
      return json({ ok: false, error: "Invalid JSON body" }, 400);
    }

    const action = body && body.action;
    const payload = (body && body.payload) || {};

    try {
      if (action === "registerExternalApp") {
        return json(await registerExternalApp(env, payload), 200);
      }

      if (action === "listExternalAppRegistrations") {
        return json(await listExternalAppRegistrations(env), 200);
      }

      if (action === "getThemeCssRules") {
        return json(await getThemeCssRules(env), 200);
      }

      if (action === "saveThemeCssRules") {
        return json(await saveThemeCssRules(env, payload), 200);
      }

      if (action === "submitContract") {
        return json(await submitContract(env, payload, request), 200);
      }

      if (action === "listPendingContracts") {
        return json(await listPendingContracts(env), 200);
      }

      if (action === "approveContract") {
        return json(await approveContract(env, payload), 200);
      }

      if (action === "rejectContract") {
        return json(await rejectContract(env, payload), 200);
      }

      if (action === "getEffectiveSettings") {
        return json(await getEffectiveSettings(env, payload), 200);
      }

      if (action === "getSdkVersion") {
        return json(getSdkVersion(payload), 200);
      }

      if (action === "loginWithInternalToken") {
        return json(await loginWithInternalToken(env, payload), 200);
      }

      if (action === "getCurrentIdentity") {
        return json(await getCurrentIdentity(env, payload), 200);
      }

      if (action === "getGrantedIdentity") {
        return json(await getGrantedIdentity(env, payload), 200);
      }

      if (action === "logout") {
        return json(await logout(env, payload), 200);
      }

      if (action === "listChatMessages") {
        return json(await listChatMessages(env, payload), 200);
      }

      if (action === "sendChatMessage") {
        return json(await sendChatMessage(env, payload), 200);
      }

      if (action === "markChatRead") {
        return json(await markChatRead(env, payload), 200);
      }

      if (action === "shareCurrentContent") {
        return json(await shareCurrentContent(env, payload), 200);
      }

      if (action === "markSharedItemSeen") {
        return json(await markSharedItemSeen(env, payload), 200);
      }

      if (action === "editChatMessage") {
        return json(await editChatMessage(env, payload), 200);
      }

      if (action === "deleteChatMessage") {
        return json(await deleteChatMessage(env, payload), 200);
      }

      if (action === "loadOlderChatMessages") {
        return json(await loadOlderChatMessages(env, payload), 200);
      }

      if (action === "searchChatMessages") {
        return json(await searchChatMessages(env, payload), 200);
      }

      if (action === "setTypingState") {
        return json(await setTypingState(env, payload), 200);
      }

      if (action === "toggleMessageReaction") {
        return json(await toggleMessageReaction(env, payload), 200);
      }

      if (action === "getContactInfo") {
        return json(await getContactInfo(env, payload), 200);
      }

      if (action === "setMyPhoneNumber") {
        return json(await setMyPhoneNumber(env, payload), 200);
      }

      if (action === "getVapidPublicKey") {
        return json(getVapidPublicKey(env), 200);
      }

      if (action === "savePushSubscription") {
        return json(await savePushSubscription(env, payload), 200);
      }

      if (action === "removePushSubscription") {
        return json(await removePushSubscription(env, payload), 200);
      }

      if (action === "replyFromNotification") {
        return json(await replyFromNotification(env, payload), 200);
      }

      if (action === "getOnedriveStatus") {
        return json(await getOnedriveStatus(env, payload), 200);
      }

      if (action === "testOnedriveConnection") {
        return json(await testOnedriveConnection(env, payload), 200);
      }

      if (action === "listProjectTasks") {
        return json(await listProjectTasks(env, payload), 200);
      }

      if (action === "addProjectTask") {
        return json(await addProjectTask(env, payload), 200);
      }

      if (action === "toggleProjectTask") {
        return json(await toggleProjectTask(env, payload), 200);
      }

      if (action === "deleteProjectTask") {
        return json(await deleteProjectTask(env, payload), 200);
      }

      return json({ ok: false, error: "Unknown action: " + action }, 400);
    } catch (error) {
      return json({ ok: false, error: error.message || String(error) }, 500);
    }
  }
};

function json(data, status) {
  return new Response(JSON.stringify(data), {
    status,
    headers: Object.assign({ "Content-Type": "application/json" }, CORS_HEADERS)
  });
}

function supabaseHeaders(env) {
  return {
    apikey: env.SUPABASE_SECRET_KEY,
    Authorization: "Bearer " + env.SUPABASE_SECRET_KEY,
    "Content-Type": "application/json"
  };
}

async function registerExternalApp(env, payload) {
  const projectId = String(payload.projectId || payload.appId || "").trim();

  if (!projectId) {
    return { ok: false, error: "projectId is required" };
  }

  const row = {
    project_id: projectId,
    title: String(payload.title || "").trim(),
    href: String(payload.href || "").trim(),
    version: String(payload.version || "").trim(),
    env: String(payload.env || "").trim(),
    origin: String(payload.origin || "").trim(),
    user_agent: String(payload.userAgent || "").trim(),
    last_seen_at: new Date().toISOString()
  };

  const url =
    env.SUPABASE_URL.replace(/\/+$/, "") +
    "/rest/v1/external_app_registrations?on_conflict=project_id";

  const response = await fetch(url, {
    method: "POST",
    headers: Object.assign(supabaseHeaders(env), {
      Prefer: "resolution=merge-duplicates,return=representation"
    }),
    body: JSON.stringify(row)
  });

  if (!response.ok) {
    throw new Error("Supabase upsert failed: HTTP " + response.status + " " + (await response.text()));
  }

  const data = await response.json();
  return { ok: true, data: data[0] || row };
}

async function listExternalAppRegistrations(env) {
  const url =
    env.SUPABASE_URL.replace(/\/+$/, "") +
    "/rest/v1/external_app_registrations?select=*&order=last_seen_at.desc";

  const response = await fetch(url, {
    method: "GET",
    headers: supabaseHeaders(env)
  });

  if (!response.ok) {
    throw new Error("Supabase read failed: HTTP " + response.status + " " + (await response.text()));
  }

  return { ok: true, rows: await response.json() };
}

async function getThemeCssRules(env) {
  const url =
    env.SUPABASE_URL.replace(/\/+$/, "") +
    "/rest/v1/theme_css_rules?select=*&order=selector.asc,order_index.asc";

  const response = await fetch(url, {
    method: "GET",
    headers: supabaseHeaders(env)
  });

  if (!response.ok) {
    throw new Error("Supabase read failed: HTTP " + response.status + " " + (await response.text()));
  }

  return { ok: true, rows: await response.json() };
}

async function saveThemeCssRules(env, payload) {
  if (!(await requireSession(env, payload))) {
    return { ok: false, code: "UNAUTHORIZED", error: "Login required" };
  }

  const upsertRows = Array.isArray(payload.upsert) ? payload.upsert : [];
  const deleteIds = Array.isArray(payload.deleteIds)
    ? payload.deleteIds.map(function (id) { return Number(id); }).filter(function (id) { return Number.isFinite(id); })
    : [];

  const result = { upserted: 0, deleted: 0 };

  if (upsertRows.length) {
    const rows = upsertRows
      .map(function (item) {
        return {
          selector: String(item.selector || "").trim(),
          property: String(item.property || "").trim(),
          value: String(item.value || "").trim(),
          group_name: String(item.groupName || item.group_name || "").trim(),
          description: String(item.description || "").trim(),
          order_index: Number(item.orderIndex || item.order_index || 0) || 0,
          updated_at: new Date().toISOString()
        };
      })
      .filter(function (row) {
        return row.selector && row.property;
      });

    if (rows.length) {
      const url =
        env.SUPABASE_URL.replace(/\/+$/, "") +
        "/rest/v1/theme_css_rules?on_conflict=selector,property";

      const response = await fetch(url, {
        method: "POST",
        headers: Object.assign(supabaseHeaders(env), {
          Prefer: "resolution=merge-duplicates,return=representation"
        }),
        body: JSON.stringify(rows)
      });

      if (!response.ok) {
        throw new Error("Supabase upsert failed: HTTP " + response.status + " " + (await response.text()));
      }

      result.upserted = (await response.json()).length;
    }
  }

  if (deleteIds.length) {
    const url =
      env.SUPABASE_URL.replace(/\/+$/, "") +
      "/rest/v1/theme_css_rules?id=in.(" + deleteIds.join(",") + ")";

    const response = await fetch(url, {
      method: "DELETE",
      headers: supabaseHeaders(env)
    });

    if (!response.ok) {
      throw new Error("Supabase delete failed: HTTP " + response.status + " " + (await response.text()));
    }

    result.deleted = deleteIds.length;
  }

  return { ok: true, result: result };
}

// S13, S16：推送 ≠ 採信，任何寫入一律 status='pending'，approve/reject 是
// implementation plan 第 3 項的後台功能，這裡不做也不能做。
async function submitContract(env, payload, request) {
  const projectId = String(payload.projectId || "").trim();
  const contract = payload.contract;
  const declaredEnvironment =
    payload.environment !== undefined && payload.environment !== null
      ? String(payload.environment).trim()
      : undefined;

  if (!projectId) {
    return { ok: false, code: "PROJECT_ID_REQUIRED", error: "projectId is required" };
  }

  if (!contract || typeof contract !== "object" || Array.isArray(contract)) {
    return { ok: false, code: "CONTRACT_REQUIRED", error: "contract (a parsed JSON object) is required" };
  }

  // env.JONAMINZ_ENVIRONMENT 是這個 Worker 部署時定的（wrangler.toml [vars]），
  // 不是 payload 能宣告或偽造的；payload.environment 只用來做健檢比對，權威
  // 永遠是 env.JONAMINZ_ENVIRONMENT。
  const environment = env.JONAMINZ_ENVIRONMENT;
  if (!environment) {
    return { ok: false, code: "WORKER_MISCONFIGURED", error: "Worker misconfigured: JONAMINZ_ENVIRONMENT is not set" };
  }
  if (declaredEnvironment && declaredEnvironment !== environment) {
    return {
      ok: false,
      code: "ENVIRONMENT_MISMATCH",
      error:
        'payload.environment ("' + declaredEnvironment + '") does not match this Worker\'s environment ("' +
        environment + '")'
    };
  }

  // S15：只收 Integration Settings 已登記的 projectId。
  const projectSettings = integrationSettings.projects && integrationSettings.projects[projectId];
  if (!projectSettings) {
    return {
      ok: false,
      code: "PROJECT_NOT_REGISTERED",
      error: 'projectId "' + projectId + '" is not registered in Integration Settings'
    };
  }
  const envSettings = projectSettings.environments && projectSettings.environments[environment];
  if (!envSettings || !envSettings.origin) {
    return {
      ok: false,
      code: "ENVIRONMENT_NOT_REGISTERED",
      error: 'projectId "' + projectId + '" has no registered origin for environment "' + environment + '"'
    };
  }
  const registeredOrigin = envSettings.origin;

  const contractSize = JSON.stringify(contract).length;
  if (contractSize > MAX_CONTRACT_SIZE_CHARS) {
    return {
      ok: false,
      code: "CONTRACT_TOO_LARGE",
      error: "contract too large (" + contractSize + " chars, limit " + MAX_CONTRACT_SIZE_CHARS + ")"
    };
  }

  // 推模式：SDK 從自己的頁面 POST 過來，瀏覽器會送 Origin header。核對它跟
  // 這個 projectId + environment 登記的 origin 是否吻合，擋掉來源不對的推送。
  const requestOrigin = request.headers.get("Origin");
  if (requestOrigin && requestOrigin !== registeredOrigin) {
    return {
      ok: false,
      code: "ORIGIN_MISMATCH",
      error:
        'Request Origin header ("' + requestOrigin + '") does not match the registered origin ("' +
        registeredOrigin + '") for projectId "' + projectId + '" in environment "' + environment + '"'
    };
  }

  // S12：頂層結構／contractVersion／projectId 錯誤 → 整份無效。
  const schemaValid = validateContractSchema(contract);
  if (!schemaValid) {
    return {
      ok: false,
      code: "SCHEMA_INVALID",
      error: "Contract failed JSON Schema validation",
      details: validateContractSchema.errors
    };
  }

  // S12 fail-soft：單一 entry/object/requires 壞掉時剔除該項、其餘照收——
  // 這兩個函式做的是 schema 本身做不到的 cross-field 與 URL 同源檢查。
  const crossFieldResult = validateCrossFields(contract);
  const urlResult = validateUrls(contract, registeredOrigin);
  const validationResult = {
    valid: crossFieldResult.valid && urlResult.valid,
    crossField: crossFieldResult,
    url: urlResult
  };

  // S14：對解析後正規化的 JSON 語意內容計算 hash，不是原始 bytes。
  const canonicalHash = await computeCanonicalHash(contract);

  const latestUrl =
    env.SUPABASE_URL.replace(/\/+$/, "") +
    "/rest/v1/contract_snapshots?project_id=eq." + encodeURIComponent(projectId) +
    "&environment=eq." + encodeURIComponent(environment) +
    "&select=id,canonical_hash,status&order=submitted_at.desc&limit=1";

  const latestResponse = await fetch(latestUrl, { method: "GET", headers: supabaseHeaders(env) });
  if (!latestResponse.ok) {
    throw new Error("Supabase read failed: HTTP " + latestResponse.status + " " + (await latestResponse.text()));
  }
  const latestRows = await latestResponse.json();
  const latest = latestRows[0];

  // S15：content hash 去重——同一份內容重複推送不必再開一筆新 snapshot。
  if (latest && latest.canonical_hash === canonicalHash) {
    return {
      ok: true,
      snapshotId: latest.id,
      status: latest.status,
      canonicalHash: canonicalHash,
      deduped: true,
      validationResult: validationResult
    };
  }

  const snapshotRow = {
    project_id: projectId,
    environment: environment,
    raw_contract: contract,
    canonical_hash: canonicalHash,
    status: "pending",
    validation_result: validationResult,
    submitted_origin: requestOrigin || null,
    submitted_at: new Date().toISOString()
  };

  const insertUrl = env.SUPABASE_URL.replace(/\/+$/, "") + "/rest/v1/contract_snapshots";
  const insertResponse = await fetch(insertUrl, {
    method: "POST",
    headers: Object.assign(supabaseHeaders(env), { Prefer: "return=representation" }),
    body: JSON.stringify(snapshotRow)
  });
  if (!insertResponse.ok) {
    throw new Error("Supabase insert failed: HTTP " + insertResponse.status + " " + (await insertResponse.text()));
  }
  const inserted = (await insertResponse.json())[0];

  const auditUrl = env.SUPABASE_URL.replace(/\/+$/, "") + "/rest/v1/contract_audit_log";
  const auditResponse = await fetch(auditUrl, {
    method: "POST",
    headers: supabaseHeaders(env),
    body: JSON.stringify({
      project_id: projectId,
      environment: environment,
      snapshot_id: inserted.id,
      action: "submit",
      previous_hash: latest ? latest.canonical_hash : null,
      new_hash: canonicalHash,
      actor: null,
      note: null
    })
  });
  if (!auditResponse.ok) {
    throw new Error("Supabase audit insert failed: HTTP " + auditResponse.status + " " + (await auditResponse.text()));
  }

  return {
    ok: true,
    snapshotId: inserted.id,
    status: "pending",
    canonicalHash: canonicalHash,
    deduped: false,
    validationResult: validationResult
  };
}

// 核准後台讀取清單，公開唯讀（S16：讀合約不代表採信，看清單不用保護）。
async function listPendingContracts(env) {
  const snapshotsUrl =
    env.SUPABASE_URL.replace(/\/+$/, "") +
    "/rest/v1/contract_snapshots?select=*&order=submitted_at.desc&limit=50";

  const activeUrl =
    env.SUPABASE_URL.replace(/\/+$/, "") +
    "/rest/v1/contract_active_snapshots?select=project_id,environment,active_snapshot_id," +
    "contract_snapshots(id,raw_contract,canonical_hash)";

  const [snapshotsResponse, activeResponse] = await Promise.all([
    fetch(snapshotsUrl, { method: "GET", headers: supabaseHeaders(env) }),
    fetch(activeUrl, { method: "GET", headers: supabaseHeaders(env) })
  ]);

  if (!snapshotsResponse.ok) {
    throw new Error("Supabase read failed: HTTP " + snapshotsResponse.status + " " + (await snapshotsResponse.text()));
  }
  if (!activeResponse.ok) {
    throw new Error("Supabase read failed: HTTP " + activeResponse.status + " " + (await activeResponse.text()));
  }

  const snapshots = await snapshotsResponse.json();
  const activeRows = await activeResponse.json();

  // key = "<project_id>::<environment>" -> 目前 active 的那份合約內容，
  // 讓前端可以把 pending 的內容跟這個做 diff（S14）。origin 額外從
  // integration-settings.json（伺服器端登記資料）查出來一起附上——
  // 前端組「進入」連結時需要一個可信任的 origin，不能拿 snapshot 自己的
  // submitted_origin（那是送出當下的自報值，同一個專案不同筆可能不一致
  // 甚至是 null，也不保證跟目前 active 的是同一筆），更不能讓 Contract
  // 任意宣告的欄位當 origin 用。
  const activeByKey = {};
  activeRows.forEach(function (row) {
    const linked = row.contract_snapshots;
    if (!linked) return;
    const projectSettings = integrationSettings.projects && integrationSettings.projects[row.project_id];
    const envSettings = projectSettings && projectSettings.environments && projectSettings.environments[row.environment];
    activeByKey[row.project_id + "::" + row.environment] = {
      snapshotId: linked.id,
      canonicalHash: linked.canonical_hash,
      rawContract: linked.raw_contract,
      origin: (envSettings && envSettings.origin) || null
    };
  });

  const rows = snapshots.map(function (row) {
    return {
      id: row.id,
      projectId: row.project_id,
      environment: row.environment,
      status: row.status,
      canonicalHash: row.canonical_hash,
      rawContract: row.raw_contract,
      validationResult: row.validation_result,
      submittedOrigin: row.submitted_origin,
      submittedAt: row.submitted_at,
      decidedAt: row.decided_at,
      decidedBy: row.decided_by,
      note: row.note,
      previousApproved: activeByKey[row.project_id + "::" + row.environment] || null
    };
  });

  return { ok: true, rows: rows };
}

// implementation plan 第 3 項：approve/reject 是目前唯一有保護的寫入動作
// 之一（跟 saveThemeCssRules 一起，都是靠 requireSession）。p_actor 直接
// 用登入身分，不再吃 payload.actor——原本前端是按鈕手動切換 Jonathan/Minz
// 自報身分，沒有真的驗證是誰在按，這裡堵掉「可以假裝是另一個人」的漏洞。
async function approveContract(env, payload) {
  const identity = await requireSession(env, payload);
  if (!identity) {
    return { ok: false, code: "UNAUTHORIZED", error: "Login required" };
  }

  const snapshotId = Number(payload.snapshotId);
  if (!snapshotId) {
    return { ok: false, code: "SNAPSHOT_ID_REQUIRED", error: "snapshotId is required" };
  }

  const url = env.SUPABASE_URL.replace(/\/+$/, "") + "/rest/v1/rpc/approve_contract_snapshot";
  const response = await fetch(url, {
    method: "POST",
    headers: supabaseHeaders(env),
    body: JSON.stringify({
      p_snapshot_id: snapshotId,
      p_actor: identity,
      p_note: String(payload.note || "").trim() || null
    })
  });

  if (!response.ok) {
    throw new Error("Supabase RPC failed: HTTP " + response.status + " " + (await response.text()));
  }

  return { ok: true, snapshotId: snapshotId, status: "approved" };
}

async function rejectContract(env, payload) {
  const identity = await requireSession(env, payload);
  if (!identity) {
    return { ok: false, code: "UNAUTHORIZED", error: "Login required" };
  }

  const snapshotId = Number(payload.snapshotId);
  if (!snapshotId) {
    return { ok: false, code: "SNAPSHOT_ID_REQUIRED", error: "snapshotId is required" };
  }

  const url = env.SUPABASE_URL.replace(/\/+$/, "") + "/rest/v1/rpc/reject_contract_snapshot";
  const response = await fetch(url, {
    method: "POST",
    headers: supabaseHeaders(env),
    body: JSON.stringify({
      p_snapshot_id: snapshotId,
      p_actor: identity,
      p_note: String(payload.note || "").trim() || null
    })
  });

  if (!response.ok) {
    throw new Error("Supabase RPC failed: HTTP " + response.status + " " + (await response.text()));
  }

  return { ok: true, snapshotId: snapshotId, status: "rejected" };
}

// implementation plan 第 4 項：flattened Effective Settings 端點（S31、S38）。
const KNOWN_CSS_LEVELS = new Set(["none", "tokens"]);

// S11 must-ignore：schema 認不得的值（例如未來的 components/full/self）
// 視同沒宣告，不整份判失敗，只是這個值本身不生效。
function normalizeCssLevel(value) {
  return KNOWN_CSS_LEVELS.has(value) ? value : "none";
}

// S34：Effective CSS = min(Contract 聲明, Settings 授予)。v1 只有
// none/tokens 兩級，min 語意簡化成「兩者都是 tokens 才是 tokens」。
function computeEffectiveCss(contractCss, settingsCss) {
  const c = normalizeCssLevel(contractCss);
  const s = normalizeCssLevel(settingsCss);
  return c === "tokens" && s === "tokens" ? "tokens" : "none";
}

// implementation plan 第 9 項階段 B：S31 capability 公式（Effective =
// Approved Contract capabilities.supports ∩ Settings 授權）。抽成共用
// helper 是因為 getEffectiveSettings（給 SDK 當提示用）跟 getGrantedIdentity
// （真正的授權判斷，S33 要求 Worker 逐請求重算）都需要同一份邏輯——兩處
// 各自算一次很容易因為改一邊忘了改另一邊而產生真正的安全漏洞。呼叫端自己
// 先查好 projectId/environment 是否登記（各自的錯誤 code 語意不同，這裡
// 不重複判斷），把已經解出來的 envSettings 傳進來即可。
async function resolveEffectiveCapabilities(env, projectId, environment, envSettings) {
  const activeUrl =
    env.SUPABASE_URL.replace(/\/+$/, "") +
    "/rest/v1/contract_active_snapshots?project_id=eq." + encodeURIComponent(projectId) +
    "&environment=eq." + encodeURIComponent(environment) +
    "&select=contract_snapshots(raw_contract)";

  const response = await fetch(activeUrl, { method: "GET", headers: supabaseHeaders(env) });
  if (!response.ok) {
    throw new Error("Supabase read failed: HTTP " + response.status + " " + (await response.text()));
  }
  const rows = await response.json();
  const active = rows[0] && rows[0].contract_snapshots;
  if (!active) {
    return { capabilities: [], activeContract: null };
  }

  const rawContract = active.raw_contract || {};
  const supports = (rawContract.capabilities && rawContract.capabilities.supports) || [];
  const granted = envSettings.capabilities || [];
  const capabilities = supports.filter(function (c) { return granted.indexOf(c) !== -1; });

  return { capabilities: capabilities, activeContract: rawContract };
}

async function getEffectiveSettings(env, payload) {
  const projectId = String((payload && payload.projectId) || "").trim();
  if (!projectId) {
    return { ok: false, code: "PROJECT_ID_REQUIRED", error: "projectId is required" };
  }

  // environment 不從 payload 讀：一律用這個 Worker 部署自己的
  // JONAMINZ_ENVIRONMENT，理由跟 submitContract 一樣，避免呼叫端謊報
  // environment 繞過檢查。
  const environment = env.JONAMINZ_ENVIRONMENT;
  if (!environment) {
    return { ok: false, code: "WORKER_MISCONFIGURED", error: "Worker misconfigured: JONAMINZ_ENVIRONMENT is not set" };
  }

  const projectSettings = integrationSettings.projects && integrationSettings.projects[projectId];
  if (!projectSettings) {
    return {
      ok: false,
      code: "PROJECT_NOT_REGISTERED",
      error: 'projectId "' + projectId + '" is not registered in Integration Settings'
    };
  }
  const envSettings = projectSettings.environments && projectSettings.environments[environment];
  if (!envSettings) {
    return {
      ok: false,
      code: "ENVIRONMENT_NOT_REGISTERED",
      error: 'projectId "' + projectId + '" has no registered settings for environment "' + environment + '"'
    };
  }

  const { capabilities, activeContract } = await resolveEffectiveCapabilities(env, projectId, environment, envSettings);

  // S31：沒有 active approved snapshot 時不啟用任何能力、不掛 Shell——
  // observed 推送照收，這裡只是不採信而已（S13/S16 一路貫徹下來）。
  if (!activeContract) {
    return {
      ok: true,
      projectId: projectId,
      environment: environment,
      approved: false,
      reason: "NO_APPROVED_SNAPSHOT",
      settingsVersion: integrationSettings.schemaVersion,
      revision: integrationSettings.revision,
      generatedAt: new Date().toISOString(),
      css: "none",
      capabilities: []
    };
  }

  const effectiveCss = computeEffectiveCss(activeContract.css, envSettings.css);

  return {
    ok: true,
    projectId: projectId,
    environment: environment,
    approved: true,
    settingsVersion: integrationSettings.schemaVersion,
    revision: integrationSettings.revision,
    generatedAt: new Date().toISOString(),
    css: effectiveCss,
    // implementation plan 第 9 項階段 B：真實 capability 交集（S30-33），
    // 不再是佔位空陣列。這裡只是給 SDK 一個「值不值得嘗試」的提示，S33
    // 規定真正的授權判斷要在 getGrantedIdentity 這類會回傳實際資料的
    // action 裡逐請求重算，不能只信這個回應。
    capabilities: capabilities
  };
}

// implementation plan 第 5 項：SDK loader 用的版本指標（S37）。純讀 git
// 檔案（sdk-versions.json），不碰 Supabase，不需要 async。
function getSdkVersion(payload) {
  const projectId = String((payload && payload.projectId) || "").trim();

  // v1 的 loader 呼叫時不帶 projectId（永遠拿 stable）；有給的話查該專案
  // 的 channel 授權，查無或沒登記一律回退 stable，不讓打錯字的 projectId
  // 意外拿到 next channel。
  let channel = "stable";
  if (projectId) {
    const projectSettings = integrationSettings.projects && integrationSettings.projects[projectId];
    // 注意：這裡故意不用 env.JONAMINZ_ENVIRONMENT 查特定 environment
    // （getSdkVersion 不接 request context，也不需要）——channel 授權只看
    // projectId 底下任一 environment 有沒有登記 channel:"next"。v1 沒有
    // 專案會設非 stable 的 channel，這段路徑目前恆等於 stable，只是
    // 形狀先定，之後 loader 真的知道自己的 projectId 時直接補傳就有效。
    const anyEnvSettings =
      projectSettings && projectSettings.environments && Object.values(projectSettings.environments)[0];
    if (anyEnvSettings && anyEnvSettings.channel === "next") {
      channel = "next";
    }
  }

  const channelInfo = sdkVersions.channels && sdkVersions.channels[channel];
  if (!channelInfo) {
    return { ok: false, code: "CHANNEL_NOT_CONFIGURED", error: 'channel "' + channel + '" has no configured release' };
  }

  return {
    ok: true,
    channel: channel,
    hash: channelInfo.hash,
    url: channelInfo.url,
    revision: sdkVersions.revision,
    generatedAt: new Date().toISOString()
  };
}

// implementation plan 第 9 項階段 A：jonaminz 主站登入（S6）。兩種登入
// 方式（內部密語／Google OAuth）都導向同一張 sessions 表——用真的
// session row，不是自簽 JWT，才能真的登出/撤銷，不用維護 blocklist。
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 天，兩人自用不逼頻繁重登入
const OAUTH_STATE_TTL_MS = 10 * 60 * 1000; // 10 分鐘，只是 redirect 往返這段時間需要存在
const GOOGLE_REDIRECT_URI = "https://jonaminz-backend.ndmc402010104.workers.dev/auth/google/callback";

// 2026-07-12：Google OAuth 完成後導回哪個網域——不能直接信任呼叫端帶來的
// origin 字串，不然變成開放式重導向（任何人都能把登入 session token 導到
// 自己的網域去）。正式站精確比對；本機開發用正規式放行整個 loopback
// （localhost／127.0.0.1，任何 port）而不是列舉單一 port：第一版只列
// `:5500` 一個 port，使用者換一個本機工具（例如 `127.0.0.1:18765` 的
// helper）就又不在白名單裡，這種列舉法永遠補不完。**這樣放寬沒有安全
// 疑慮**——loopback 網址不管誰塞在連結裡，瀏覽器永遠只會解析成使用者
// 自己這台機器，外部攻擊者沒辦法讓別人的瀏覽器把它導去攻擊者控制的伺服
// 器，跟精確比對單一網域要防的「導去別人網域」是不同的威脅模型。只允許
// http（本機開發不會走 https），不接受 loopback 以外的其他值走這條路。
const OAUTH_DEFAULT_RETURN_ORIGIN = "https://www.jonaminz.com";
const OAUTH_LOOPBACK_RETURN_ORIGIN_PATTERN = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
// 2026-07-13：jonaminz-mobile-app（Capacitor 殼）用這個固定字串當 deep
// link scheme（見 android/app/src/main/AndroidManifest.xml 的
// intent-filter），跟 pages/login/assets/js/app.js 的 APP_OAUTH_RETURN_ORIGIN
// 必須完全一致，兩邊各自寫死一份（不是共用模組，跨 repo 沒有共用機制）。
// 精確字串比對，不是正規式——這個值不像 loopback 有「任何 port」的彈性
// 需求，固定死一個值即可。
const OAUTH_APP_RETURN_ORIGIN = "com.jonaminz.app://oauth-callback";

function resolveOauthReturnOrigin(candidate) {
  candidate = String(candidate || "");
  if (candidate === OAUTH_DEFAULT_RETURN_ORIGIN) return candidate;
  if (candidate === OAUTH_APP_RETURN_ORIGIN) return candidate;
  if (OAUTH_LOOPBACK_RETURN_ORIGIN_PATTERN.test(candidate)) return candidate;
  return OAUTH_DEFAULT_RETURN_ORIGIN;
}

// 2026-07-12：Google OAuth 完成後導回網站裡的哪一頁——跟 return_origin
// 是兩個獨立的東西（origin 是「哪個網站」，這個是「網站裡的哪一頁」）。
// 內部密語登入是純前端 POST，登入成功後直接用 JS 導去 next，這條路本來
// 就完整支援；Google OAuth 要整個跳去 Google 再跳回來，中間是這支
// Worker 做 302，一直沒有把 next 一起存進 oauth_states 帶著走，導致
// Google 登入完永遠回網站根目錄，不會回到原本被 requireLogin() 攔下來
// 的那一頁——這裡補上。跟 pages/login/assets/js/app.js 的 getNextUrl()
// 同一套白名單邏輯（只接受同源相對路徑，開頭單一個 `/`，不含 `://`
// 也不是 `//` 開頭）：不驗證就直接拿使用者可控的字串當 redirect 路徑
// 的一部分，是開放式重導向漏洞，這裡故意收斂成白名單式檢查。
function resolveOauthReturnNext(candidate) {
  candidate = String(candidate || "");
  if (!candidate) return "/";
  if (candidate.indexOf("://") !== -1) return "/";
  if (candidate.slice(0, 2) === "//") return "/";
  if (candidate.charAt(0) !== "/") return "/";
  return candidate;
}

function randomToken() {
  return crypto.randomUUID() + crypto.randomUUID();
}

async function createSession(env, identity, provider) {
  const token = randomToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();

  const url = env.SUPABASE_URL.replace(/\/+$/, "") + "/rest/v1/sessions";
  const response = await fetch(url, {
    method: "POST",
    headers: supabaseHeaders(env),
    body: JSON.stringify({ token: token, identity: identity, provider: provider, expires_at: expiresAt })
  });
  if (!response.ok) {
    throw new Error("Supabase insert failed: HTTP " + response.status + " " + (await response.text()));
  }
  return { token: token, expiresAt: expiresAt };
}

async function loginWithInternalToken(env, payload) {
  const provided = String((payload && payload.token) || "").trim();
  if (!provided) {
    return { ok: false, code: "TOKEN_REQUIRED", error: "token is required" };
  }

  let identity = null;
  if (env.JONAMINZ_LOGIN_JONATHAN && provided === env.JONAMINZ_LOGIN_JONATHAN) {
    identity = "jonathan";
  } else if (env.JONAMINZ_LOGIN_MINZ && provided === env.JONAMINZ_LOGIN_MINZ) {
    identity = "minz";
  }

  if (!identity) {
    return { ok: false, code: "INVALID_TOKEN", error: "Invalid login token" };
  }

  const session = await createSession(env, identity, "internal");
  return { ok: true, identity: identity, token: session.token, expiresAt: session.expiresAt };
}

// 共用的 session 驗證：查 sessions 表，回登入身分或 null（過期/查無資料/沒帶
// token 都算 null，不拋錯）。saveThemeCssRules/approveContract/rejectContract
// 這些寫入動作跟 getCurrentIdentity 這個唯讀查詢都靠這支同一份邏輯，避免
// 兩邊各自維護一份查詢條件、之後改一邊忘了改另一邊。
async function requireSession(env, payload) {
  const token = String((payload && payload.token) || "").trim();
  if (!token) {
    return null;
  }

  const url =
    env.SUPABASE_URL.replace(/\/+$/, "") +
    "/rest/v1/sessions?token=eq." + encodeURIComponent(token) +
    "&select=identity,expires_at&limit=1";
  const response = await fetch(url, { method: "GET", headers: supabaseHeaders(env) });
  if (!response.ok) {
    throw new Error("Supabase read failed: HTTP " + response.status + " " + (await response.text()));
  }
  const rows = await response.json();
  const row = rows[0];

  // 過期的 session 當作沒登入，不主動刪（下次登入自然會蓋掉/新增，
  // 過期資料留著不影響任何行為，不值得為了清理另外排 cron）。
  if (!row || new Date(row.expires_at).getTime() < Date.now()) {
    return null;
  }

  return row.identity;
}

async function getCurrentIdentity(env, payload) {
  return { ok: true, identity: await requireSession(env, payload) };
}

// implementation plan 第 9 項階段 B：給 pages/identity-relay/ 呼叫，不是
// 給外部專案直接打（session token 永遠不離開 jonaminz.com 自己的瀏覽器）。
// S33：不能只信 getEffectiveSettings 回應裡快取的 capabilities 陣列，這裡
// 用 resolveEffectiveCapabilities 逐請求重算一次「identity.current-user@1」
// 是不是真的在授權交集裡，granted:false 時完全不查身分、直接回 null，
// 避免對未授權的呼叫端洩漏「這個人現在有沒有登入」這個資訊本身。
//
// 2026-07-14：capability ID 從 identity.currentUser@1 改名成這個
// kebab-case 版本——原本的 camelCase 撞上 contract schema 的
// capabilityId pattern（強制 kebab-case），外部專案永遠無法在合約裡
// 合法宣告它，等於這條授權路徑結構上不可能被使用。函式名
// window.Jonaminz.identity.currentUser() 不受影響，改的只是這個
// 識別字串本身。細節見 KNOWN_ISSUES.md #12。
async function getGrantedIdentity(env, payload) {
  const projectId = String((payload && payload.projectId) || "").trim();
  if (!projectId) {
    return { ok: true, granted: false, identity: null };
  }

  const environment = env.JONAMINZ_ENVIRONMENT;
  const projectSettings = integrationSettings.projects && integrationSettings.projects[projectId];
  const envSettings = projectSettings && projectSettings.environments && projectSettings.environments[environment];
  if (!envSettings) {
    return { ok: true, granted: false, identity: null };
  }

  const { capabilities } = await resolveEffectiveCapabilities(env, projectId, environment, envSettings);
  if (capabilities.indexOf("identity.current-user@1") === -1) {
    return { ok: true, granted: false, identity: null };
  }

  return { ok: true, granted: true, identity: await requireSession(env, payload) };
}

async function logout(env, payload) {
  const token = String((payload && payload.token) || "").trim();
  if (!token) {
    return { ok: true };
  }

  const url = env.SUPABASE_URL.replace(/\/+$/, "") + "/rest/v1/sessions?token=eq." + encodeURIComponent(token);
  const response = await fetch(url, { method: "DELETE", headers: supabaseHeaders(env) });
  if (!response.ok) {
    throw new Error("Supabase delete failed: HTTP " + response.status + " " + (await response.text()));
  }
  return { ok: true };
}

// ---------- Jonaminz Chat（第一個真實里程碑：見 jonaminz-chat交接包） ----------
// 只有一間固定聊天室（couple-chat / jonathan-minz），所以這裡不接受前端傳
// roomId，一律在 Worker 端解析，避免前端猜/傳錯 id。schema 見
// backend/supabase/chat_schema.sql（要先在 Supabase SQL Editor 貼上執行，
// 這幾個 table 才會存在）。刻意不做 WebSocket/Durable Object——用最簡單的
// polling（前端每幾秒呼叫一次 listChatMessages）先證明「兩個真實身分互傳
// 訊息＋已讀」這條端到端流程能動，符合交接包 WORK_PLAN.md 自己建議的
// 「Worker polling 作為極簡 MVP」路線，不是长期最終架構。

// 2026-07-14（第十五輪）：訊息查詢統一用這個 select 字串（listChatMessages／
// loadOlderChatMessages 都要一致，不然分頁載入的舊訊息會少了 reply/reactions
// 欄位）。reply_to_message_id 是既有欄位（chat_schema.sql 第一版就有，不是
// 這輪新加）；chat_message_reactions(identity,emoji) 是 PostgREST 的反向
// resource embedding（靠 chat_message_reactions.message_id 這條既有 FK 自動
// 偵測），一次查詢就把每則訊息底下的表情反應一起帶出來，不用前端再問一次。
var CHAT_MESSAGE_SELECT =
  "id,sender_identity,body,kind,created_at,edited_at,deleted_at,client_message_id," +
  "shared_item_id,reply_to_message_id,chat_message_reactions(identity,emoji)";

let cachedChatRoomId = null;

async function resolveChatRoomId(env) {
  if (cachedChatRoomId) return cachedChatRoomId;

  const url =
    env.SUPABASE_URL.replace(/\/+$/, "") +
    "/rest/v1/chat_rooms?instance_id=eq.couple-chat&room_key=eq.jonathan-minz&select=id&limit=1";
  const response = await fetch(url, { method: "GET", headers: supabaseHeaders(env) });
  if (!response.ok) {
    throw new Error("Supabase read failed: HTTP " + response.status + " " + (await response.text()));
  }
  const rows = await response.json();
  if (!rows[0]) {
    throw new Error("chat room not found — 先在 Supabase SQL Editor 執行 backend/supabase/chat_schema.sql");
  }
  cachedChatRoomId = rows[0].id;
  return cachedChatRoomId;
}

async function listChatMessages(env, payload) {
  const identity = await requireSession(env, payload);
  if (!identity) {
    return { ok: false, code: "LOGIN_REQUIRED", error: "login required" };
  }

  const roomId = await resolveChatRoomId(env);
  const base = env.SUPABASE_URL.replace(/\/+$/, "");

  const messagesUrl =
    base + "/rest/v1/chat_messages?room_id=eq." + roomId +
    "&order=created_at.asc,id.asc&limit=500" +
    "&select=" + CHAT_MESSAGE_SELECT;
  const membersUrl =
    base + "/rest/v1/chat_room_members?room_id=eq." + roomId +
    "&select=identity,last_read_message_id,last_read_at,last_delivered_message_id,last_delivered_at,last_seen_at";
  // Shared 分享內容：跟訊息平行查這個房間目前所有 Shared item（連同各自
  // 的已讀狀態），前端靠 message.shared_item_id 對到這個 map 畫內容卡。
  // 這兩張表（chat_shared_items／chat_shared_item_seen）要等使用者手動
  // 在 Supabase SQL Editor 執行 backend/supabase/chat_shared_schema.sql
  // 才會存在——在那之前這裡刻意容錯（查詢失敗就當作沒有分享內容），
  // 不能讓一個還沒建表的新功能拖垮既有的收發訊息主線。
  const sharedItemsUrl =
    base + "/rest/v1/chat_shared_items?room_id=eq." + roomId +
    "&select=id,url,title,source,note,share_count,first_shared_by,last_shared_by,created_at,last_shared_at";
  const sharedSeenUrl =
    base + "/rest/v1/chat_shared_item_seen?select=item_id,identity,seen_at";

  const [messagesRes, membersRes] = await Promise.all([
    fetch(messagesUrl, { method: "GET", headers: supabaseHeaders(env) }),
    fetch(membersUrl, { method: "GET", headers: supabaseHeaders(env) })
  ]);
  if (!messagesRes.ok) {
    throw new Error("Supabase read failed: HTTP " + messagesRes.status + " " + (await messagesRes.text()));
  }
  if (!membersRes.ok) {
    throw new Error("Supabase read failed: HTTP " + membersRes.status + " " + (await membersRes.text()));
  }

  const messages = await messagesRes.json();
  const members = await membersRes.json();

  var sharedItemRows = [];
  var sharedSeenRows = [];
  try {
    const [sharedItemsRes, sharedSeenRes] = await Promise.all([
      fetch(sharedItemsUrl, { method: "GET", headers: supabaseHeaders(env) }),
      fetch(sharedSeenUrl, { method: "GET", headers: supabaseHeaders(env) })
    ]);
    if (sharedItemsRes.ok && sharedSeenRes.ok) {
      sharedItemRows = await sharedItemsRes.json();
      sharedSeenRows = await sharedSeenRes.json();
    }
  } catch (error) {
    // 表還沒建立或其他暫時性錯誤：分享內容這次就是空的，不影響訊息本身。
  }

  const readState = {};
  const deliveryState = {};
  const presence = {};
  members.forEach(function (m) {
    readState[m.identity] = { lastReadMessageId: m.last_read_message_id, lastReadAt: m.last_read_at };
    deliveryState[m.identity] = { lastDeliveredMessageId: m.last_delivered_message_id, lastDeliveredAt: m.last_delivered_at };
    presence[m.identity] = m.last_seen_at || null;
  });

  // 送達（三態已讀的中間態）：這支 action 本身就是「我方裝置正在跟伺服器
  // 要訊息」，所以呼叫這支 action 這個事實本身就等於「我方已經送達到這個
  // 時間點的所有訊息」——不需要前端另外回報一次。只在真的有訊息、且比
  // 目前記錄的還新時才寫入，避免每次 1.5 秒 poll 都無意義地 PATCH 一次。
  //
  // 在線心跳（2026-07-15 第二十七輪）：payload.visible=true 代表「面板
  // 真的展開、使用者正在看」——每 30 秒把 last_seen_at 心跳一次（節流，
  // 不是每次 1.5 秒 poll 都寫）。在線的定義從「最後訊息/已讀在 5 分鐘內」
  // （只要有在聊就永遠在線，從沒出現過離線）改成「2 分鐘內有可見心跳」。
  const patchBody = {};
  const newestMessage = messages[messages.length - 1];
  if (newestMessage && deliveryState[identity] && deliveryState[identity].lastDeliveredMessageId !== newestMessage.id) {
    patchBody.last_delivered_message_id = newestMessage.id;
    patchBody.last_delivered_at = new Date().toISOString();
    deliveryState[identity] = { lastDeliveredMessageId: newestMessage.id, lastDeliveredAt: patchBody.last_delivered_at };
  }
  if (payload && payload.visible === true) {
    const lastSeen = presence[identity] ? new Date(presence[identity]).getTime() : 0;
    if (Date.now() - lastSeen > 30 * 1000) {
      patchBody.last_seen_at = new Date().toISOString();
      presence[identity] = patchBody.last_seen_at;
    }
  }
  if (Object.keys(patchBody).length) {
    try {
      await fetch(
        base + "/rest/v1/chat_room_members?room_id=eq." + roomId + "&identity=eq." + identity,
        { method: "PATCH", headers: supabaseHeaders(env), body: JSON.stringify(patchBody) }
      );
    } catch (error) {
      // 送達/心跳寫入失敗不影響訊息本身能不能顯示，靜靜失敗即可。
    }
  }

  // 輸入中：跟已讀/送達一樣是「錦上添花」的次要資訊，查詢失敗（例如表還
  // 沒套用完成）不能拖垮訊息主線，整段包 try/catch。只看對方最後一次回報
  // 「正在輸入」的時間是不是在 4 秒內（略大於前端 3 秒送一次心跳的間隔，
  // 容忍一次漏送）。
  var typing = {};
  try {
    const peerIdentity = identity === "jonathan" ? "minz" : "jonathan";
    const typingRes = await fetch(
      base + "/rest/v1/chat_typing_state?room_id=eq." + roomId + "&identity=eq." + peerIdentity + "&select=updated_at&limit=1",
      { method: "GET", headers: supabaseHeaders(env) }
    );
    if (typingRes.ok) {
      const typingRows = await typingRes.json();
      const row = typingRows[0];
      typing[peerIdentity] = Boolean(row && (Date.now() - new Date(row.updated_at).getTime()) < 4000);
    }
  } catch (error) {
    // 查不到就當作沒有在輸入，不影響訊息本身。
  }

  const sharedItems = {};
  sharedItemRows.forEach(function (item) {
    sharedItems[item.id] = {
      id: item.id,
      url: item.url,
      title: item.title,
      source: item.source,
      note: item.note,
      shareCount: item.share_count,
      firstSharedBy: item.first_shared_by,
      lastSharedBy: item.last_shared_by,
      createdAt: item.created_at,
      lastSharedAt: item.last_shared_at,
      seenState: {}
    };
  });
  sharedSeenRows.forEach(function (row) {
    if (sharedItems[row.item_id]) {
      sharedItems[row.item_id].seenState[row.identity] = row.seen_at;
    }
  });

  return {
    ok: true,
    identity: identity,
    roomId: roomId,
    messages: messages,
    readState: readState,
    deliveryState: deliveryState,
    presence: presence,
    typing: typing,
    sharedItems: sharedItems
  };
}

async function sendChatMessage(env, payload) {
  const identity = await requireSession(env, payload);
  if (!identity) {
    return { ok: false, code: "LOGIN_REQUIRED", error: "login required" };
  }

  const body = String((payload && payload.body) || "").trim();
  if (!body) {
    return { ok: false, code: "BODY_REQUIRED", error: "body is required" };
  }
  if (body.length > 4000) {
    return { ok: false, code: "BODY_TOO_LONG", error: "body must be 4000 characters or fewer" };
  }

  const clientMessageId = String((payload && payload.clientMessageId) || "").trim() || randomToken();
  // 選填：這則文字訊息是不是「討論中」綁定某個 Shared item（見任務書
  // 「按討論把該 Shared item 綁定到 composer，後續文字訊息保留
  // shared_item_id」）——不驗證跨房間，這支 Worker 目前只有一個房間，
  // 跟既有程式碼一致的簡化。
  const sharedItemId = String((payload && payload.sharedItemId) || "").trim() || null;
  // 選填：回覆／引用某一則既有訊息——reply_to_message_id 是既有欄位
  // （chat_schema.sql 第一版就有），不像 shared_item_id 需要條件式加欄位。
  const replyToMessageId = String((payload && payload.replyToMessageId) || "").trim() || null;
  const roomId = await resolveChatRoomId(env);
  const base = env.SUPABASE_URL.replace(/\/+$/, "");

  const insertUrl = base + "/rest/v1/chat_messages";
  var insertBody = {
    room_id: roomId,
    sender_identity: identity,
    client_message_id: clientMessageId,
    kind: "text",
    body: body,
    reply_to_message_id: replyToMessageId
  };
  // 只有真的要帶 shared_item_id 才放進去這個 key——這欄位要等使用者
  // 手動套用 backend/supabase/chat_shared_schema.sql 才存在，一般傳文字
  // 訊息（sharedItemId 是 null）絕對不能在請求裡出現這個 key，不然
  // PostgREST 會因為欄位不存在直接拒絕整個 insert，連最基本的傳訊息都
  // 會壞掉。
  if (sharedItemId) insertBody.shared_item_id = sharedItemId;

  const response = await fetch(insertUrl, {
    method: "POST",
    headers: Object.assign({ Prefer: "return=representation" }, supabaseHeaders(env)),
    body: JSON.stringify(insertBody)
  });

  if (response.status === 409) {
    // 同一個 clientMessageId 已經送過（例如前端重送）——回傳既有那筆，
    // 不視為錯誤，讓重試天生 idempotent。
    const existingUrl =
      base + "/rest/v1/chat_messages?room_id=eq." + roomId +
      "&sender_identity=eq." + identity +
      "&client_message_id=eq." + encodeURIComponent(clientMessageId) +
      "&select=" + CHAT_MESSAGE_SELECT + "&limit=1";
    const existingRes = await fetch(existingUrl, { method: "GET", headers: supabaseHeaders(env) });
    const rows = await existingRes.json();
    return { ok: true, message: rows[0] || null };
  }

  if (!response.ok) {
    throw new Error("Supabase insert failed: HTTP " + response.status + " " + (await response.text()));
  }

  const rows = await response.json();
  // 訊息送出＝這個人不在「輸入中」了——立刻清掉 typing 列，不要等 4 秒
  // 過期，避免對方畫面上訊息都到了「•••」還在跳。最佳努力，失敗無所謂。
  await fetch(
    base + "/rest/v1/chat_typing_state?room_id=eq." + roomId + "&identity=eq." + identity,
    { method: "DELETE", headers: supabaseHeaders(env) }
  ).catch(function () {});
  // 真推播：對方如果有訂閱，送一則系統通知。最佳努力（best-effort）——
  // 失敗（沒訂閱／推播服務暫時性錯誤）不能讓「訊息有沒有送出」這個核心
  // 功能跟著壞掉，整段包在 sendPushToIdentity 自己的 try/catch 裡。
  const peerIdentity = identity === "jonathan" ? "minz" : "jonathan";
  await sendPushToIdentity(env, peerIdentity, IDENTITY_LABEL[identity] || identity, body.slice(0, 120));
  return { ok: true, message: rows[0] || null };
}

var IDENTITY_LABEL = { jonathan: "Jonathan", minz: "Minz" };

async function markChatRead(env, payload) {
  const identity = await requireSession(env, payload);
  if (!identity) {
    return { ok: false, code: "LOGIN_REQUIRED", error: "login required" };
  }

  const messageId = String((payload && payload.messageId) || "").trim();
  if (!messageId) {
    return { ok: false, code: "MESSAGE_ID_REQUIRED", error: "messageId is required" };
  }

  const roomId = await resolveChatRoomId(env);
  const base = env.SUPABASE_URL.replace(/\/+$/, "");

  const url = base + "/rest/v1/chat_room_members?room_id=eq." + roomId + "&identity=eq." + identity;
  const response = await fetch(url, {
    method: "PATCH",
    headers: supabaseHeaders(env),
    body: JSON.stringify({ last_read_message_id: messageId, last_read_at: new Date().toISOString() })
  });
  if (!response.ok) {
    throw new Error("Supabase update failed: HTTP " + response.status + " " + (await response.text()));
  }
  return { ok: true };
}

// ---------- Chat Shared 分享內容模組（第一階段唯一垂直流程，見任務書：
// 分享目前內容→正規化 URL→相同 URL 合併→內容卡→明確點進去才算已看到→
// 討論綁定 composer）。schema 見
// backend/supabase/chat_shared_schema.sql（要先在 Supabase SQL Editor
// 貼上執行）。正規化規則跟已看到定義都照抄交接包
// jonaminz-chat交接包/SOURCE/ux-mvp-v0.11/index.html 已經驗證過的原型
// 邏輯，不是重新設計一套。----------

function normalizeSharedUrl(raw) {
  var TRACKING_PARAMS = [
    "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
    "igsh", "igshid", "fbclid", "gclid"
  ];
  try {
    var parsed = new URL(String(raw).trim());
    TRACKING_PARAMS.forEach(function (key) { parsed.searchParams.delete(key); });
    parsed.hash = "";
    parsed.hostname = parsed.hostname.toLowerCase();
    parsed.pathname = parsed.pathname.replace(/\/+$/, "") || "/";
    return parsed.toString();
  } catch (error) {
    return String(raw).trim();
  }
}

function sourceFromSharedUrl(url) {
  if (/instagram\.com/i.test(url)) return "Instagram";
  if (/threads\.net/i.test(url)) return "Threads";
  if (/youtu\.?be/i.test(url)) return "YouTube";
  if (/maps\.google/i.test(url)) return "Google Maps";
  if (/facebook\.com/i.test(url)) return "Facebook";
  if (/tiktok\.com/i.test(url)) return "TikTok";
  return "Web";
}

async function shareCurrentContent(env, payload) {
  const identity = await requireSession(env, payload);
  if (!identity) {
    return { ok: false, code: "LOGIN_REQUIRED", error: "login required" };
  }

  const rawUrl = String((payload && payload.url) || "").trim();
  if (!rawUrl) {
    return { ok: false, code: "URL_REQUIRED", error: "url is required" };
  }
  const title = String((payload && payload.title) || "").trim() || rawUrl;
  const normalizedUrl = normalizeSharedUrl(rawUrl);

  const roomId = await resolveChatRoomId(env);
  const base = env.SUPABASE_URL.replace(/\/+$/, "");
  const now = new Date().toISOString();

  const existingUrl =
    base + "/rest/v1/chat_shared_items?room_id=eq." + roomId +
    "&url=eq." + encodeURIComponent(normalizedUrl) + "&limit=1";
  const existingRes = await fetch(existingUrl, { method: "GET", headers: supabaseHeaders(env) });
  if (!existingRes.ok) {
    throw new Error("Supabase read failed: HTTP " + existingRes.status + " " + (await existingRes.text()));
  }
  const existingRows = await existingRes.json();
  var sharedItem;

  if (existingRows[0]) {
    // 相同 URL 合併成同一個 Shared item：累加分享次數、更新最後分享者。
    const updateUrl = base + "/rest/v1/chat_shared_items?id=eq." + existingRows[0].id;
    const updateRes = await fetch(updateUrl, {
      method: "PATCH",
      headers: Object.assign({ Prefer: "return=representation" }, supabaseHeaders(env)),
      body: JSON.stringify({
        share_count: existingRows[0].share_count + 1,
        last_shared_by: identity,
        last_shared_at: now
      })
    });
    if (!updateRes.ok) {
      throw new Error("Supabase update failed: HTTP " + updateRes.status + " " + (await updateRes.text()));
    }
    const updatedRows = await updateRes.json();
    sharedItem = updatedRows[0];
  } else {
    const insertUrl = base + "/rest/v1/chat_shared_items";
    const insertRes = await fetch(insertUrl, {
      method: "POST",
      headers: Object.assign({ Prefer: "return=representation" }, supabaseHeaders(env)),
      body: JSON.stringify({
        room_id: roomId,
        url: normalizedUrl,
        title: title,
        source: sourceFromSharedUrl(normalizedUrl),
        share_count: 1,
        first_shared_by: identity,
        last_shared_by: identity,
        created_at: now,
        last_shared_at: now
      })
    });
    if (!insertRes.ok) {
      throw new Error("Supabase insert failed: HTTP " + insertRes.status + " " + (await insertRes.text()));
    }
    const insertedRows = await insertRes.json();
    sharedItem = insertedRows[0];
  }

  // 分享者視同已經看過自己剛分享的東西。
  const seenUpsertUrl = base + "/rest/v1/chat_shared_item_seen";
  await fetch(seenUpsertUrl, {
    method: "POST",
    headers: Object.assign({ Prefer: "resolution=merge-duplicates" }, supabaseHeaders(env)),
    body: JSON.stringify({ item_id: sharedItem.id, identity: identity, seen_at: now })
  });

  // 建立一則引用這個 Shared item 的 Chat message，內容卡靠前端對
  // shared_item_id 查 listChatMessages 回應的 sharedItems map 來畫。
  const messageInsertUrl = base + "/rest/v1/chat_messages";
  const messageRes = await fetch(messageInsertUrl, {
    method: "POST",
    headers: Object.assign({ Prefer: "return=representation" }, supabaseHeaders(env)),
    body: JSON.stringify({
      room_id: roomId,
      sender_identity: identity,
      client_message_id: randomToken(),
      kind: "shared_item",
      body: title,
      shared_item_id: sharedItem.id
    })
  });
  if (!messageRes.ok) {
    throw new Error("Supabase insert failed: HTTP " + messageRes.status + " " + (await messageRes.text()));
  }
  const messageRows = await messageRes.json();

  const peerIdentity = identity === "jonathan" ? "minz" : "jonathan";
  await sendPushToIdentity(env, peerIdentity, IDENTITY_LABEL[identity] || identity, "分享了：" + title);

  return { ok: true, message: messageRows[0] || null, sharedItem: sharedItem };
}

async function markSharedItemSeen(env, payload) {
  const identity = await requireSession(env, payload);
  if (!identity) {
    return { ok: false, code: "LOGIN_REQUIRED", error: "login required" };
  }

  const itemId = String((payload && payload.itemId) || "").trim();
  if (!itemId) {
    return { ok: false, code: "ITEM_ID_REQUIRED", error: "itemId is required" };
  }

  const base = env.SUPABASE_URL.replace(/\/+$/, "");
  const seenUpsertUrl = base + "/rest/v1/chat_shared_item_seen";
  const response = await fetch(seenUpsertUrl, {
    method: "POST",
    headers: Object.assign({ Prefer: "resolution=merge-duplicates" }, supabaseHeaders(env)),
    body: JSON.stringify({ item_id: itemId, identity: identity, seen_at: new Date().toISOString() })
  });
  if (!response.ok) {
    throw new Error("Supabase upsert failed: HTTP " + response.status + " " + (await response.text()));
  }
  return { ok: true };
}

// ---------- 2026-07-14（第十四輪）：對照成熟聊天 App 慣例補的功能——
// 訊息編輯/刪除、歷史分頁、全文搜尋。全部沿用既有的
// requireSession/resolveChatRoomId 慣例，不另起爐灶。----------

async function editChatMessage(env, payload) {
  const identity = await requireSession(env, payload);
  if (!identity) {
    return { ok: false, code: "LOGIN_REQUIRED", error: "login required" };
  }

  const messageId = String((payload && payload.messageId) || "").trim();
  const body = String((payload && payload.body) || "").trim();
  if (!messageId) {
    return { ok: false, code: "MESSAGE_ID_REQUIRED", error: "messageId is required" };
  }
  if (!body) {
    return { ok: false, code: "BODY_REQUIRED", error: "body is required" };
  }
  if (body.length > 4000) {
    return { ok: false, code: "BODY_TOO_LONG", error: "body must be 4000 characters or fewer" };
  }

  const base = env.SUPABASE_URL.replace(/\/+$/, "");
  // 篩選條件直接帶 sender_identity=eq.<identity>——不是自己的訊息這個
  // filter 撞不到任何列，PATCH 影響 0 筆，不用另外先查一次確認擁有權。
  const url = base + "/rest/v1/chat_messages?id=eq." + encodeURIComponent(messageId) +
    "&sender_identity=eq." + identity + "&deleted_at=is.null";
  const response = await fetch(url, {
    method: "PATCH",
    headers: Object.assign({ Prefer: "return=representation" }, supabaseHeaders(env)),
    body: JSON.stringify({ body: body, edited_at: new Date().toISOString() })
  });
  if (!response.ok) {
    throw new Error("Supabase update failed: HTTP " + response.status + " " + (await response.text()));
  }
  const rows = await response.json();
  if (!rows[0]) {
    return { ok: false, code: "NOT_FOUND_OR_FORBIDDEN", error: "message not found or not editable" };
  }
  return { ok: true, message: rows[0] };
}

async function deleteChatMessage(env, payload) {
  const identity = await requireSession(env, payload);
  if (!identity) {
    return { ok: false, code: "LOGIN_REQUIRED", error: "login required" };
  }

  const messageId = String((payload && payload.messageId) || "").trim();
  if (!messageId) {
    return { ok: false, code: "MESSAGE_ID_REQUIRED", error: "messageId is required" };
  }

  const base = env.SUPABASE_URL.replace(/\/+$/, "");
  const url = base + "/rest/v1/chat_messages?id=eq." + encodeURIComponent(messageId) +
    "&sender_identity=eq." + identity;
  // 軟刪除：body 清空、deleted_at 蓋上時間戳，前端看到 deleted_at 就畫
  // 「此訊息已刪除」的樣式，不是真的從資料庫移除這一列（保留稽核軌跡）。
  const response = await fetch(url, {
    method: "PATCH",
    headers: Object.assign({ Prefer: "return=representation" }, supabaseHeaders(env)),
    body: JSON.stringify({ body: "", deleted_at: new Date().toISOString() })
  });
  if (!response.ok) {
    throw new Error("Supabase update failed: HTTP " + response.status + " " + (await response.text()));
  }
  const rows = await response.json();
  if (!rows[0]) {
    return { ok: false, code: "NOT_FOUND_OR_FORBIDDEN", error: "message not found or not deletable" };
  }
  return { ok: true, message: rows[0] };
}

async function loadOlderChatMessages(env, payload) {
  const identity = await requireSession(env, payload);
  if (!identity) {
    return { ok: false, code: "LOGIN_REQUIRED", error: "login required" };
  }

  const beforeMessageId = String((payload && payload.beforeMessageId) || "").trim();
  if (!beforeMessageId) {
    return { ok: false, code: "BEFORE_MESSAGE_ID_REQUIRED", error: "beforeMessageId is required" };
  }

  const roomId = await resolveChatRoomId(env);
  const base = env.SUPABASE_URL.replace(/\/+$/, "");
  const PAGE_SIZE = 50;

  // 用「錨點訊息的 created_at」當分頁游標（不是用 id，因為 UUID 沒有
  // 時間順序）——先查那則訊息本身的時間，再抓更早的一頁。
  const anchorUrl = base + "/rest/v1/chat_messages?id=eq." + encodeURIComponent(beforeMessageId) +
    "&select=created_at&limit=1";
  const anchorRes = await fetch(anchorUrl, { method: "GET", headers: supabaseHeaders(env) });
  if (!anchorRes.ok) {
    throw new Error("Supabase read failed: HTTP " + anchorRes.status + " " + (await anchorRes.text()));
  }
  const anchorRows = await anchorRes.json();
  if (!anchorRows[0]) {
    return { ok: true, messages: [], hasMore: false };
  }
  const anchorCreatedAt = anchorRows[0].created_at;

  const olderUrl = base + "/rest/v1/chat_messages?room_id=eq." + roomId +
    "&created_at=lt." + encodeURIComponent(anchorCreatedAt) +
    "&order=created_at.desc,id.desc&limit=" + (PAGE_SIZE + 1) +
    "&select=" + CHAT_MESSAGE_SELECT;
  const olderRes = await fetch(olderUrl, { method: "GET", headers: supabaseHeaders(env) });
  if (!olderRes.ok) {
    throw new Error("Supabase read failed: HTTP " + olderRes.status + " " + (await olderRes.text()));
  }
  const olderRowsDesc = await olderRes.json();
  const hasMore = olderRowsDesc.length > PAGE_SIZE;
  const page = olderRowsDesc.slice(0, PAGE_SIZE).reverse(); // 換回正序（舊到新）給前端

  return { ok: true, messages: page, hasMore: hasMore };
}

async function searchChatMessages(env, payload) {
  const identity = await requireSession(env, payload);
  if (!identity) {
    return { ok: false, code: "LOGIN_REQUIRED", error: "login required" };
  }

  const query = String((payload && payload.query) || "").trim();
  if (!query) {
    return { ok: true, messages: [] };
  }
  if (query.length > 200) {
    return { ok: false, code: "QUERY_TOO_LONG", error: "query must be 200 characters or fewer" };
  }

  const roomId = await resolveChatRoomId(env);
  const base = env.SUPABASE_URL.replace(/\/+$/, "");
  // ilike 簡單子字串搜尋——這個聊天室的量級（兩人、幾百則訊息）用不到
  // 全文索引那種規模的搜尋引擎，PostgREST 的 ilike 就夠用。PostgREST 的
  // like/ilike 篩選用 * 當萬用字元（不是 %，URL 裡 % 是保留字元）。
  const url = base + "/rest/v1/chat_messages?room_id=eq." + roomId +
    "&deleted_at=is.null&body=ilike." + encodeURIComponent("*" + query + "*") +
    "&order=created_at.desc&limit=50" +
    "&select=id,sender_identity,body,kind,created_at,shared_item_id";
  const response = await fetch(url, { method: "GET", headers: supabaseHeaders(env) });
  if (!response.ok) {
    throw new Error("Supabase read failed: HTTP " + response.status + " " + (await response.text()));
  }
  const rows = await response.json();
  return { ok: true, messages: rows };
}

// ---------- 2026-07-14（第十五輪）：對照成熟聊天 App 慣例再補一輪——
// 輸入中、表情反應、聯絡電話（語音通話改撥打真實電話取代）、真推播通知。
// schema 見 backend/supabase/chat_features_v2_schema.sql（已套用到
// jonaminz-db）。----------

async function setTypingState(env, payload) {
  const identity = await requireSession(env, payload);
  if (!identity) {
    return { ok: false, code: "LOGIN_REQUIRED", error: "login required" };
  }
  const roomId = await resolveChatRoomId(env);
  const base = env.SUPABASE_URL.replace(/\/+$/, "");
  const url = base + "/rest/v1/chat_typing_state?on_conflict=room_id,identity";
  const response = await fetch(url, {
    method: "POST",
    headers: Object.assign({ Prefer: "resolution=merge-duplicates" }, supabaseHeaders(env)),
    body: JSON.stringify({ room_id: roomId, identity: identity, updated_at: new Date().toISOString() })
  });
  if (!response.ok) {
    throw new Error("Supabase upsert failed: HTTP " + response.status + " " + (await response.text()));
  }
  return { ok: true };
}

// 表情反應：一個人對一則訊息同時間只有一個反應（跟 FB Messenger 一致），
// primary key (message_id, identity) 天生就撞成這個語意。再點一次同一個
// emoji＝取消（toggle off），點不同 emoji＝換成新的（upsert 覆蓋）。
async function toggleMessageReaction(env, payload) {
  const identity = await requireSession(env, payload);
  if (!identity) {
    return { ok: false, code: "LOGIN_REQUIRED", error: "login required" };
  }
  const messageId = String((payload && payload.messageId) || "").trim();
  const emoji = String((payload && payload.emoji) || "").trim();
  if (!messageId || !emoji) {
    return { ok: false, code: "MESSAGE_ID_AND_EMOJI_REQUIRED", error: "messageId and emoji are required" };
  }

  const base = env.SUPABASE_URL.replace(/\/+$/, "");
  const existingUrl = base + "/rest/v1/chat_message_reactions?message_id=eq." + encodeURIComponent(messageId) +
    "&identity=eq." + identity + "&select=emoji&limit=1";
  const existingRes = await fetch(existingUrl, { method: "GET", headers: supabaseHeaders(env) });
  if (!existingRes.ok) {
    throw new Error("Supabase read failed: HTTP " + existingRes.status + " " + (await existingRes.text()));
  }
  const existingRows = await existingRes.json();

  if (existingRows[0] && existingRows[0].emoji === emoji) {
    const deleteUrl = base + "/rest/v1/chat_message_reactions?message_id=eq." + encodeURIComponent(messageId) +
      "&identity=eq." + identity;
    const deleteRes = await fetch(deleteUrl, { method: "DELETE", headers: supabaseHeaders(env) });
    if (!deleteRes.ok) {
      throw new Error("Supabase delete failed: HTTP " + deleteRes.status + " " + (await deleteRes.text()));
    }
    return { ok: true, action: "removed", emoji: emoji };
  }

  const upsertUrl = base + "/rest/v1/chat_message_reactions?on_conflict=message_id,identity";
  const upsertRes = await fetch(upsertUrl, {
    method: "POST",
    headers: Object.assign({ Prefer: "resolution=merge-duplicates" }, supabaseHeaders(env)),
    body: JSON.stringify({ message_id: messageId, identity: identity, emoji: emoji, updated_at: new Date().toISOString() })
  });
  if (!upsertRes.ok) {
    throw new Error("Supabase upsert failed: HTTP " + upsertRes.status + " " + (await upsertRes.text()));
  }
  return { ok: true, action: "added", emoji: emoji };
}

// 聯絡電話：語音/視訊通話這輪「偷吃步」改成直接撥打真實手機號碼（tel:
// 連結）——使用者不想把號碼寫死在程式碼裡（用途只有 Jonathan/Minz 兩人
// 自己用），改存這張表，每個人只能改自己的號碼（identity 直接來自登入
// session，不是 payload 自報，跟這個專案其他寫入動作一致的防護）。
async function getContactInfo(env, payload) {
  const identity = await requireSession(env, payload);
  if (!identity) {
    return { ok: false, code: "LOGIN_REQUIRED", error: "login required" };
  }
  const base = env.SUPABASE_URL.replace(/\/+$/, "");
  const url = base + "/rest/v1/chat_contact_info?select=identity,phone_number";
  const response = await fetch(url, { method: "GET", headers: supabaseHeaders(env) });
  if (!response.ok) {
    throw new Error("Supabase read failed: HTTP " + response.status + " " + (await response.text()));
  }
  const rows = await response.json();
  const byIdentity = {};
  rows.forEach(function (row) { byIdentity[row.identity] = row.phone_number || ""; });
  const peerIdentity = identity === "jonathan" ? "minz" : "jonathan";
  return {
    ok: true,
    myPhoneNumber: byIdentity[identity] || "",
    peerPhoneNumber: byIdentity[peerIdentity] || ""
  };
}

async function setMyPhoneNumber(env, payload) {
  const identity = await requireSession(env, payload);
  if (!identity) {
    return { ok: false, code: "LOGIN_REQUIRED", error: "login required" };
  }
  const phoneNumber = String((payload && payload.phoneNumber) || "").trim().slice(0, 40);
  const base = env.SUPABASE_URL.replace(/\/+$/, "");
  const url = base + "/rest/v1/chat_contact_info?on_conflict=identity";
  const response = await fetch(url, {
    method: "POST",
    headers: Object.assign({ Prefer: "resolution=merge-duplicates" }, supabaseHeaders(env)),
    body: JSON.stringify({ identity: identity, phone_number: phoneNumber, updated_at: new Date().toISOString() })
  });
  if (!response.ok) {
    throw new Error("Supabase upsert failed: HTTP " + response.status + " " + (await response.text()));
  }
  return { ok: true, myPhoneNumber: phoneNumber };
}

// ---------- 真推播通知（Web Push，RFC8291 aes128gcm + RFC8292 VAPID）。
// 刻意不用第三方 web-push 套件——那套件內部用 Node 的 crypto 模組
// （createECDH/createCipheriv 等），Cloudflare Workers 沒有 Node crypto，
// 只有標準 WebCrypto（crypto.subtle）。這裡整段用 crypto.subtle 重新實作，
// 已經用本機腳本驗證過「加密→用標準流程解密」能還原出原始明文，證明
// HKDF/AES-128-GCM 這幾步沒有算錯，但沒有辦法在這個環境實際打一次
// Google/Mozilla 的真推播服務——最終還是要使用者在真機上允許通知權限、
// 實際收一次推播才算完全驗證過。----------

function b64urlEncode(bytes) {
  var bin = "";
  var arr = new Uint8Array(bytes);
  for (var i = 0; i < arr.length; i += 1) bin += String.fromCharCode(arr[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(str) {
  var padded = String(str).replace(/-/g, "+").replace(/_/g, "/");
  while (padded.length % 4) padded += "=";
  var bin = atob(padded);
  var bytes = new Uint8Array(bin.length);
  for (var i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function concatBytes(arrays) {
  var total = arrays.reduce(function (sum, a) { return sum + a.length; }, 0);
  var out = new Uint8Array(total);
  var offset = 0;
  arrays.forEach(function (a) { out.set(a, offset); offset += a.length; });
  return out;
}

// RFC8292：VAPID JWT，ES256（ECDSA P-256 + SHA-256），header/claims 都是
// base64url 過的 JSON，簽章是 WebCrypto 原生輸出的 r||s（IEEE P1363 格式，
// 剛好就是 JWS ES256 要的格式，不需要額外轉換）。
async function buildVapidJwt(env, endpoint) {
  var aud = new URL(endpoint).origin;
  var header = { typ: "JWT", alg: "ES256" };
  var claims = {
    aud: aud,
    exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
    sub: env.VAPID_SUBJECT || "mailto:admin@jonaminz.com"
  };
  var signingInput =
    b64urlEncode(new TextEncoder().encode(JSON.stringify(header))) + "." +
    b64urlEncode(new TextEncoder().encode(JSON.stringify(claims)));

  var jwk = JSON.parse(env.VAPID_PRIVATE_KEY_JWK);
  var privateKey = await crypto.subtle.importKey(
    "jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]
  );
  var signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" }, privateKey, new TextEncoder().encode(signingInput)
  );
  return signingInput + "." + b64urlEncode(signature);
}

// RFC8291：Message Encryption for Web Push（aes128gcm content-encoding）。
// 回傳可以直接當 fetch body 送出去的 bytes（RFC8188 header + 密文+authTag）。
async function encryptWebPushPayload(subscription, plaintextObj) {
  var plaintext = new TextEncoder().encode(JSON.stringify(plaintextObj));
  var uaPublicRaw = b64urlDecode(subscription.p256dh); // 訂閱者的公鑰，65 bytes 未壓縮格式
  var authSecret = b64urlDecode(subscription.auth); // 16 bytes

  var uaPublicKey = await crypto.subtle.importKey(
    "raw", uaPublicRaw, { name: "ECDH", namedCurve: "P-256" }, true, []
  );
  var ephemeralKeyPair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]
  );
  var asPublicRaw = new Uint8Array(await crypto.subtle.exportKey("raw", ephemeralKeyPair.publicKey));

  var sharedSecretBits = await crypto.subtle.deriveBits(
    { name: "ECDH", public: uaPublicKey }, ephemeralKeyPair.privateKey, 256
  );
  var ecdhSecret = new Uint8Array(sharedSecretBits);

  var salt = crypto.getRandomValues(new Uint8Array(16));

  // 第一段 HKDF：用 auth_secret 當 salt，ecdh 共享金鑰當 IKM，"WebPush: info"
  // + 0x00 + 訂閱者公鑰 + 我方臨時公鑰 當 info，取 32 bytes 當第二段用的 IKM。
  var ecdhKeyMaterial = await crypto.subtle.importKey("raw", ecdhSecret, "HKDF", false, ["deriveBits"]);
  var webpushInfo = concatBytes([
    new TextEncoder().encode("WebPush: info"),
    new Uint8Array([0]),
    uaPublicRaw,
    asPublicRaw
  ]);
  var ikmBits = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt: authSecret, info: webpushInfo }, ecdhKeyMaterial, 256
  );
  var ikm = new Uint8Array(ikmBits);

  // 第二段 HKDF：用內容加密的隨機 salt（跟上面的 auth_secret 是不同變數）、
  // 上一步算出來的 ikm，分別取 16 bytes 的 CEK 跟 12 bytes 的 nonce。
  var ikmKeyMaterial = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  var cekBits = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt: salt, info: new TextEncoder().encode("Content-Encoding: aes128gcm\0") },
    ikmKeyMaterial, 128
  );
  var nonceBits = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt: salt, info: new TextEncoder().encode("Content-Encoding: nonce\0") },
    ikmKeyMaterial, 96
  );

  var cek = await crypto.subtle.importKey("raw", cekBits, { name: "AES-GCM" }, false, ["encrypt"]);
  // 單一 record（訊息夠短，不用分段）：明文尾端補一個 0x02 當 last-record
  // 分隔符（RFC8188），沒有額外 padding 需求。
  var padded = concatBytes([plaintext, new Uint8Array([2])]);
  var ciphertextBits = await crypto.subtle.encrypt({ name: "AES-GCM", iv: new Uint8Array(nonceBits) }, cek, padded);
  var ciphertext = new Uint8Array(ciphertextBits);

  var recordSize = new Uint8Array(4);
  new DataView(recordSize.buffer).setUint32(0, 4096, false);
  var keyIdLength = new Uint8Array([asPublicRaw.length]);
  var rfc8188Header = concatBytes([salt, recordSize, keyIdLength, asPublicRaw]);

  return concatBytes([rfc8188Header, ciphertext]);
}

function getVapidPublicKey(env) {
  if (!env.VAPID_PUBLIC_KEY) {
    return { ok: false, code: "VAPID_NOT_CONFIGURED", error: "VAPID public key not configured" };
  }
  return { ok: true, publicKey: env.VAPID_PUBLIC_KEY };
}

async function savePushSubscription(env, payload) {
  const identity = await requireSession(env, payload);
  if (!identity) {
    return { ok: false, code: "LOGIN_REQUIRED", error: "login required" };
  }
  const subscription = payload && payload.subscription;

  // 2026-07-14（第十八輪）：兩種訂閱。kind='fcm' 是 Capacitor App 的
  // Firebase 原生推播，只有一個 device token（存進 endpoint 欄），沒有
  // Web Push 的 p256dh/auth 加密參數。
  var row;
  if (subscription && subscription.kind === "fcm") {
    const fcmToken = String(subscription.token || "").trim();
    if (!fcmToken) {
      return { ok: false, code: "SUBSCRIPTION_REQUIRED", error: "subscription.token is required for kind=fcm" };
    }
    row = { identity: identity, endpoint: fcmToken, kind: "fcm", p256dh: null, auth: null, updated_at: new Date().toISOString() };
  } else {
    const endpoint = subscription && String(subscription.endpoint || "").trim();
    const p256dh = subscription && subscription.keys && String(subscription.keys.p256dh || "").trim();
    const auth = subscription && subscription.keys && String(subscription.keys.auth || "").trim();
    if (!endpoint || !p256dh || !auth) {
      return { ok: false, code: "SUBSCRIPTION_REQUIRED", error: "subscription.endpoint/keys.p256dh/keys.auth are required" };
    }
    row = { identity: identity, endpoint: endpoint, kind: "webpush", p256dh: p256dh, auth: auth, updated_at: new Date().toISOString() };
  }

  const base = env.SUPABASE_URL.replace(/\/+$/, "");
  const url = base + "/rest/v1/chat_push_subscriptions?on_conflict=identity,endpoint";
  const response = await fetch(url, {
    method: "POST",
    headers: Object.assign({ Prefer: "resolution=merge-duplicates" }, supabaseHeaders(env)),
    body: JSON.stringify(row)
  });
  if (!response.ok) {
    throw new Error("Supabase upsert failed: HTTP " + response.status + " " + (await response.text()));
  }
  return { ok: true };
}

async function removePushSubscription(env, payload) {
  const identity = await requireSession(env, payload);
  if (!identity) {
    return { ok: false, code: "LOGIN_REQUIRED", error: "login required" };
  }
  const endpoint = String((payload && payload.endpoint) || "").trim();
  if (!endpoint) {
    return { ok: false, code: "ENDPOINT_REQUIRED", error: "endpoint is required" };
  }
  const base = env.SUPABASE_URL.replace(/\/+$/, "");
  const url = base + "/rest/v1/chat_push_subscriptions?identity=eq." + identity + "&endpoint=eq." + encodeURIComponent(endpoint);
  const response = await fetch(url, { method: "DELETE", headers: supabaseHeaders(env) });
  if (!response.ok) {
    throw new Error("Supabase delete failed: HTTP " + response.status + " " + (await response.text()));
  }
  return { ok: true };
}

// ---------- FCM 原生推播（Capacitor App 用，2026-07-14 第十八輪）。
// Android WebView 沒有網頁推播 API，App 內收推播要走 Firebase Cloud
// Messaging。FCM HTTP v1 API 的認證是 Google service account：用服務
// 帳戶金鑰（FCM_SERVICE_ACCOUNT_JSON secret，含 client_email/
// private_key/project_id）簽一個 RS256 JWT，跟 Google 換一小時效期的
// access token，再拿它打 messages:send。access token 用 module 變數
// 快取（同一個 Worker isolate 存活期間重複使用，過期前 5 分鐘就換新），
// 不用每則訊息都重新簽章換發。----------

var cachedFcmAccessToken = null;
var cachedFcmTokenExpiresAt = 0;

function pemToDer(pem) {
  var body = String(pem)
    .replace(/-----BEGIN [^-]+-----/, "")
    .replace(/-----END [^-]+-----/, "")
    .replace(/\s+/g, "");
  var bin = atob(body);
  var bytes = new Uint8Array(bin.length);
  for (var i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function getFcmAccessToken(env) {
  if (cachedFcmAccessToken && Date.now() < cachedFcmTokenExpiresAt - 5 * 60 * 1000) {
    return cachedFcmAccessToken;
  }
  var serviceAccount = JSON.parse(env.FCM_SERVICE_ACCOUNT_JSON);
  var nowSeconds = Math.floor(Date.now() / 1000);
  var header = { alg: "RS256", typ: "JWT" };
  var claims = {
    iss: serviceAccount.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: nowSeconds,
    exp: nowSeconds + 3600
  };
  var signingInput =
    b64urlEncode(new TextEncoder().encode(JSON.stringify(header))) + "." +
    b64urlEncode(new TextEncoder().encode(JSON.stringify(claims)));
  var privateKey = await crypto.subtle.importKey(
    "pkcs8", pemToDer(serviceAccount.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]
  );
  var signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5", privateKey, new TextEncoder().encode(signingInput)
  );
  var jwt = signingInput + "." + b64urlEncode(signature);

  var tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt
    })
  });
  if (!tokenResponse.ok) {
    throw new Error("FCM token exchange failed: HTTP " + tokenResponse.status + " " + (await tokenResponse.text()));
  }
  var tokenData = await tokenResponse.json();
  cachedFcmAccessToken = tokenData.access_token;
  cachedFcmTokenExpiresAt = Date.now() + (Number(tokenData.expires_in) || 3600) * 1000;
  return cachedFcmAccessToken;
}

// 回傳 true 代表這個 device token 已失效（App 移除/資料清掉），呼叫端
// 要把這筆訂閱刪掉。
//
// 2026-07-15（第二十二輪）：從 notification message 改成 **data message**
// ——notification message 在 App 背景時是「系統」自動呈現通知，App 完全
// 插不了手，掛不了通知內回覆按鈕（RemoteInput）也做不了系統聊天泡泡
// （Bubbles）。data message 不管前景背景都會叫起 App 的
// FirebaseMessagingService.onMessageReceived（高優先權會喚醒行程），
// 通知改由 App 端的 JonaminzMessagingService 自己組（MessagingStyle＋
// 回覆按鈕＋泡泡 metadata），呈現權才在我們手上。
// 注意：data 的值必須全部是字串（FCM 規定）。
async function sendFcmMessage(env, deviceToken, title, bodyText) {
  var accessToken = await getFcmAccessToken(env);
  var projectId = JSON.parse(env.FCM_SERVICE_ACCOUNT_JSON).project_id;
  var response = await fetch(
    "https://fcm.googleapis.com/v1/projects/" + projectId + "/messages:send",
    {
      method: "POST",
      headers: {
        Authorization: "Bearer " + accessToken,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        message: {
          token: deviceToken,
          data: { title: String(title), body: String(bodyText) },
          android: { priority: "HIGH" }
        }
      })
    }
  );
  if (response.status === 404 || response.status === 400) {
    var text = await response.text();
    if (text.indexOf("UNREGISTERED") !== -1 || text.indexOf("INVALID_ARGUMENT") !== -1) {
      return true; // token 失效，讓呼叫端清掉
    }
  }
  return false;
}

// 通知內直接回覆（2026-07-15，第二十二輪）：App 的通知回覆按鈕
// （RemoteInput）打這支。認證用 **FCM device token 本身**——原生層天生
// 知道自己的 token（FirebaseMessaging.getToken()），不用把 session token
// 塞進原生儲存；token 是不可猜測的裝置密鑰、只存在我們的 DB 跟該裝置上，
// 兩人自用的信任模型下跟 session token 同等級。查 chat_push_subscriptions
// 反解 identity，之後流程跟 sendChatMessage 一致（插訊息、清 typing、
// 推播給對方）。
async function replyFromNotification(env, payload) {
  const fcmToken = String((payload && payload.fcmToken) || "").trim();
  const body = String((payload && payload.body) || "").trim();
  if (!fcmToken) {
    return { ok: false, code: "FCM_TOKEN_REQUIRED", error: "fcmToken is required" };
  }
  if (!body) {
    return { ok: false, code: "BODY_REQUIRED", error: "body is required" };
  }
  if (body.length > 4000) {
    return { ok: false, code: "BODY_TOO_LONG", error: "body must be 4000 characters or fewer" };
  }

  const base = env.SUPABASE_URL.replace(/\/+$/, "");
  const subUrl = base + "/rest/v1/chat_push_subscriptions?endpoint=eq." + encodeURIComponent(fcmToken) +
    "&kind=eq.fcm&select=identity&limit=1";
  const subRes = await fetch(subUrl, { method: "GET", headers: supabaseHeaders(env) });
  if (!subRes.ok) {
    throw new Error("Supabase read failed: HTTP " + subRes.status + " " + (await subRes.text()));
  }
  const subRows = await subRes.json();
  if (!subRows[0]) {
    return { ok: false, code: "UNKNOWN_DEVICE", error: "device is not subscribed" };
  }
  const identity = subRows[0].identity;
  const roomId = await resolveChatRoomId(env);

  const insertRes = await fetch(base + "/rest/v1/chat_messages", {
    method: "POST",
    headers: Object.assign({ Prefer: "return=representation" }, supabaseHeaders(env)),
    body: JSON.stringify({
      room_id: roomId,
      sender_identity: identity,
      client_message_id: randomToken(),
      kind: "text",
      body: body
    })
  });
  if (!insertRes.ok) {
    throw new Error("Supabase insert failed: HTTP " + insertRes.status + " " + (await insertRes.text()));
  }
  const insertedRows = await insertRes.json();

  await fetch(
    base + "/rest/v1/chat_typing_state?room_id=eq." + roomId + "&identity=eq." + identity,
    { method: "DELETE", headers: supabaseHeaders(env) }
  ).catch(function () {});
  const peerIdentity = identity === "jonathan" ? "minz" : "jonathan";
  await sendPushToIdentity(env, peerIdentity, IDENTITY_LABEL[identity] || identity, body.slice(0, 120));

  return { ok: true, message: insertedRows[0] || null };
}

// 對某個 identity 名下所有裝置送一次推播——這支是「盡力而為」的背景動作，
// 呼叫端（sendChatMessage／shareCurrentContent）不應該因為推播寄不出去
// 就讓訊息本身送失敗，所以整支函式自己吞掉所有錯誤，不 throw。
// 兩種訂閱各走各的：kind='webpush' 走 RFC8291 加密＋VAPID；kind='fcm'
// 走 Firebase HTTP v1（Capacitor App）。
async function sendPushToIdentity(env, identity, senderLabel, bodyText) {
  try {
    const base = env.SUPABASE_URL.replace(/\/+$/, "");
    const url = base + "/rest/v1/chat_push_subscriptions?identity=eq." + identity + "&select=endpoint,kind,p256dh,auth";
    const response = await fetch(url, { method: "GET", headers: supabaseHeaders(env) });
    if (!response.ok) return;
    const subscriptions = await response.json();

    await Promise.all(subscriptions.map(async function (sub) {
      try {
        var expired = false;

        if (sub.kind === "fcm") {
          if (!env.FCM_SERVICE_ACCOUNT_JSON) return;
          expired = await sendFcmMessage(env, sub.endpoint, senderLabel, bodyText);
        } else {
          if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY_JWK) return;
          const jwt = await buildVapidJwt(env, sub.endpoint);
          const encryptedBody = await encryptWebPushPayload(sub, {
            title: senderLabel,
            body: bodyText,
            tag: "jonaminz-chat"
          });
          const pushResponse = await fetch(sub.endpoint, {
            method: "POST",
            headers: {
              "Content-Type": "application/octet-stream",
              "Content-Encoding": "aes128gcm",
              TTL: "86400",
              Authorization: "vapid t=" + jwt + ", k=" + env.VAPID_PUBLIC_KEY
            },
            body: encryptedBody
          });
          // 404/410：訂閱已經失效（使用者移除通知權限／清了瀏覽器資料）。
          expired = pushResponse.status === 404 || pushResponse.status === 410;
        }

        if (expired) {
          // 清掉過期訂閱，避免之後每次送訊息都白打一次失敗的請求。
          await fetch(
            base + "/rest/v1/chat_push_subscriptions?identity=eq." + identity + "&endpoint=eq." + encodeURIComponent(sub.endpoint),
            { method: "DELETE", headers: supabaseHeaders(env) }
          ).catch(function () {});
        }
      } catch (error) {
        // 單一裝置推播失敗不影響其他裝置或訊息本身。
      }
    }));
  } catch (error) {
    // 整段推播失敗（例如查訂閱清單就出錯）不影響訊息本身。
  }
}

async function handleGoogleStart(env, url) {
  if (!env.JONAMINZ_GOOGLE_CLIENT_ID) {
    return new Response("Google OAuth not configured", { status: 500 });
  }

  // 登入頁自己的網域（正式站或本機 localhost:5500）帶在 ?origin= 這個
  // query string 裡，這裡驗證過白名單後存進 oauth_states，callback 才
  // 知道要導回哪裡——不然永遠寫死導回正式站，本機測不了這條路。
  const returnOrigin = resolveOauthReturnOrigin(url.searchParams.get("origin") || "");
  // 登入頁被 requireLogin() 導來時帶的 ?next=，同一套白名單邏輯驗證過
  // 後存進 oauth_states，callback 才能導回原本要去的那一頁而不是網站
  // 根目錄（見上方 resolveOauthReturnNext() 註解）。
  const returnNext = resolveOauthReturnNext(url.searchParams.get("next") || "");

  const state = randomToken();
  const expiresAt = new Date(Date.now() + OAUTH_STATE_TTL_MS).toISOString();

  const insertUrl = env.SUPABASE_URL.replace(/\/+$/, "") + "/rest/v1/oauth_states";
  const insertResponse = await fetch(insertUrl, {
    method: "POST",
    headers: supabaseHeaders(env),
    body: JSON.stringify({ state: state, return_origin: returnOrigin, next: returnNext, expires_at: expiresAt })
  });
  if (!insertResponse.ok) {
    throw new Error("Supabase insert failed: HTTP " + insertResponse.status + " " + (await insertResponse.text()));
  }

  const authorizeUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authorizeUrl.searchParams.set("client_id", env.JONAMINZ_GOOGLE_CLIENT_ID);
  authorizeUrl.searchParams.set("redirect_uri", GOOGLE_REDIRECT_URI);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("scope", "openid email");
  authorizeUrl.searchParams.set("state", state);
  authorizeUrl.searchParams.set("prompt", "select_account");

  return Response.redirect(authorizeUrl.toString(), 302);
}

// JWT 只取中間那段 payload，base64url decode——這個 ID token 是 Worker
// 自己拿 client_secret 跟 Google 換來的（server-to-server，走 TLS），
// 不是瀏覽器轉交的第三方憑證，不需要再驗簽章。前端直接收 ID token
// 那種用法才需要驗簽章防偽造，這裡不是那種情況。
function decodeGoogleIdTokenEmail(idToken) {
  const parts = String(idToken || "").split(".");
  if (parts.length !== 3) return null;
  try {
    const payloadJson = atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"));
    const payload = JSON.parse(payloadJson);
    return payload && payload.email ? String(payload.email).toLowerCase() : null;
  } catch (error) {
    return null;
  }
}

async function handleGoogleCallback(env, url) {
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  if (!code || !state) {
    return new Response("Missing code or state", { status: 400 });
  }

  const stateUrl =
    env.SUPABASE_URL.replace(/\/+$/, "") +
    "/rest/v1/oauth_states?state=eq." + encodeURIComponent(state) +
    "&select=state,expires_at,return_origin,next";
  const stateResponse = await fetch(stateUrl, { method: "GET", headers: supabaseHeaders(env) });
  if (!stateResponse.ok) {
    throw new Error("Supabase read failed: HTTP " + stateResponse.status + " " + (await stateResponse.text()));
  }
  const stateRows = await stateResponse.json();
  const stateRow = stateRows[0];

  // state 核對後立刻刪除，一次性——防止重放，不管核對結果是否有效都刪。
  await fetch(
    env.SUPABASE_URL.replace(/\/+$/, "") + "/rest/v1/oauth_states?state=eq." + encodeURIComponent(state),
    { method: "DELETE", headers: supabaseHeaders(env) }
  );

  if (!stateRow || new Date(stateRow.expires_at).getTime() < Date.now()) {
    return new Response("Invalid or expired state", { status: 400 });
  }

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code: code,
      client_id: env.JONAMINZ_GOOGLE_CLIENT_ID,
      client_secret: env.JONAMINZ_GOOGLE_CLIENT_SECRET,
      redirect_uri: GOOGLE_REDIRECT_URI,
      grant_type: "authorization_code"
    })
  });
  if (!tokenResponse.ok) {
    throw new Error("Google token exchange failed: HTTP " + tokenResponse.status + " " + (await tokenResponse.text()));
  }
  const tokenData = await tokenResponse.json();
  const email = decodeGoogleIdTokenEmail(tokenData.id_token);

  let identity = null;
  if (email && env.JONAMINZ_GOOGLE_EMAIL_JONATHAN && email === String(env.JONAMINZ_GOOGLE_EMAIL_JONATHAN).toLowerCase()) {
    identity = "jonathan";
  } else if (email && env.JONAMINZ_GOOGLE_EMAIL_MINZ && email === String(env.JONAMINZ_GOOGLE_EMAIL_MINZ).toLowerCase()) {
    identity = "minz";
  }

  if (!identity) {
    // 不在允許清單——這不是開放註冊系統（S6：只有 Jonathan/Minz 兩個
    // 固定身分），拒絕任何其他 Google 帳號登入。
    return new Response("This Google account is not authorized for jonaminz.", { status: 403 });
  }

  const session = await createSession(env, identity, "google");
  // stateRow.return_origin／stateRow.next 是 handleGoogleStart 當時就已經
  // 驗證過白名單存進 DB 的值，這裡直接信任、不用再驗一次；
  // resolveOauthReturnOrigin／resolveOauthReturnNext 再包一層只是防禦舊
  // 資料列（升級前建立、沒有這兩欄）落到各自的 fallback。
  const returnOrigin = resolveOauthReturnOrigin(stateRow.return_origin || "");
  const returnNext = resolveOauthReturnNext(stateRow.next || "");
  const redirectUrl = returnOrigin + returnNext + "#jonaminzSessionToken=" + encodeURIComponent(session.token);
  return Response.redirect(redirectUrl, 302);
}

// ---------- OneDrive 線 Phase A：授權底座（2026-07-15，見
// AI_CONTEXT/ONEDRIVE_LINE_SPEC.md）。這不是使用者登入——是把「這個
// App 讀寫某人 OneDrive App Folder」的授權，雙帳號模式：Jonathan／
// Minz 各自連自己的 OneDrive（2026-07-15 使用者決策：兩人都想從自己
// 帳號查得到聊天圖庫；Phase B 傳圖只上傳一份到傳送者帳號，用 Graph
// 原生的「分享給特定人」授權對方帳號讀取，不重複佔用兩份容量——見
// SPEC 的取捨記錄）。用同一套 oauth_states 表擋 CSRF（跟 Google 登入
// 共用表、不同語意：return_origin 這裡存的是發起連接的登入身分，不是
// 要導回的網域）。連接誰的帳號＝呼叫者自己的登入身分，不能選（`start`
// 不接受指定 identity 參數，永遠是 `requireSession` 解出來的那個人）；
// redirect_uri 直接用這個 Worker 自己的網域（跟 GOOGLE_REDIRECT_URI
// 同一個模式），不需要另外在 jonaminz.com 開一個中繼頁面——連接完成
// 後看到的就是 Worker 直接回的純文字結果頁，沒有 session token 要交回
// 瀏覽器（refresh token 全程只活在 Supabase，前端從頭到尾拿不到）。----------

const ONEDRIVE_REDIRECT_URI = "https://jonaminz-backend.ndmc402010104.workers.dev/auth/onedrive/callback";
const ONEDRIVE_SCOPE = "Files.ReadWrite.AppFolder offline_access";
const ONEDRIVE_AUTHORIZE_URL = "https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize";
const ONEDRIVE_TOKEN_URL = "https://login.microsoftonline.com/consumers/oauth2/v2.0/token";

async function handleOnedriveStart(env, url) {
  if (!env.JONAMINZ_ONEDRIVE_CLIENT_ID) {
    return new Response("OneDrive OAuth not configured (missing JONAMINZ_ONEDRIVE_CLIENT_ID)", { status: 500 });
  }

  const token = url.searchParams.get("token") || "";
  const caller = await requireSession(env, { token: token });
  if (!caller) {
    return new Response("請先登入 jonaminz 再連接 OneDrive。", { status: 403 });
  }
  // 2026-07-15：連接的是哪個身分由 `identity` 參數決定，不強制等於呼叫者
  // 自己的登入身分——Jonathan／Minz 這兩人本來就共用彼此的帳密，這層
  // 「只能連自己」的限制在他們的信任模型下沒有實際安全意義，只留下
  // 「必須先登入 jonaminz（不管哪個身分）」這一道最外層關卡。
  const requestedIdentity = url.searchParams.get("identity");
  const identity = (requestedIdentity === "jonathan" || requestedIdentity === "minz")
    ? requestedIdentity
    : caller;

  const state = randomToken();
  const expiresAt = new Date(Date.now() + OAUTH_STATE_TTL_MS).toISOString();
  const insertUrl = env.SUPABASE_URL.replace(/\/+$/, "") + "/rest/v1/oauth_states";
  const insertResponse = await fetch(insertUrl, {
    method: "POST",
    headers: supabaseHeaders(env),
    body: JSON.stringify({ state: state, return_origin: identity, next: "", expires_at: expiresAt })
  });
  if (!insertResponse.ok) {
    throw new Error("Supabase insert failed: HTTP " + insertResponse.status + " " + (await insertResponse.text()));
  }

  const authorizeUrl = new URL(ONEDRIVE_AUTHORIZE_URL);
  authorizeUrl.searchParams.set("client_id", env.JONAMINZ_ONEDRIVE_CLIENT_ID);
  authorizeUrl.searchParams.set("redirect_uri", ONEDRIVE_REDIRECT_URI);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("scope", ONEDRIVE_SCOPE);
  authorizeUrl.searchParams.set("state", state);
  // 個人帳號的 refresh token 要拿得到，必須明確要求 offline access 的
  // consent prompt（consumers 端點在使用者之前同意過的情況下有時會
  // 跳過畫面、不重新核發 refresh_token）。
  authorizeUrl.searchParams.set("prompt", "consent");

  return Response.redirect(authorizeUrl.toString(), 302);
}

async function handleOnedriveCallback(env, url) {
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const errorParam = url.searchParams.get("error");

  if (errorParam) {
    return htmlResponse(
      "OneDrive 連接失敗：" + escapeHtmlText(url.searchParams.get("error_description") || errorParam),
      400
    );
  }
  if (!code || !state) {
    return htmlResponse("OneDrive 連接失敗：缺少 code 或 state。", 400);
  }

  const stateUrl =
    env.SUPABASE_URL.replace(/\/+$/, "") +
    "/rest/v1/oauth_states?state=eq." + encodeURIComponent(state) +
    "&select=state,expires_at,return_origin";
  const stateResponse = await fetch(stateUrl, { method: "GET", headers: supabaseHeaders(env) });
  if (!stateResponse.ok) {
    throw new Error("Supabase read failed: HTTP " + stateResponse.status + " " + (await stateResponse.text()));
  }
  const stateRows = await stateResponse.json();
  const stateRow = stateRows[0];

  await fetch(
    env.SUPABASE_URL.replace(/\/+$/, "") + "/rest/v1/oauth_states?state=eq." + encodeURIComponent(state),
    { method: "DELETE", headers: supabaseHeaders(env) }
  );

  if (!stateRow || new Date(stateRow.expires_at).getTime() < Date.now()) {
    return htmlResponse("OneDrive 連接失敗：連結已過期，請重新從後台發起連接。", 400);
  }
  const identity = stateRow.return_origin === "minz" ? "minz" : "jonathan";

  const tokenResponse = await fetch(ONEDRIVE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code: code,
      client_id: env.JONAMINZ_ONEDRIVE_CLIENT_ID,
      client_secret: env.JONAMINZ_ONEDRIVE_CLIENT_SECRET,
      redirect_uri: ONEDRIVE_REDIRECT_URI,
      grant_type: "authorization_code",
      scope: ONEDRIVE_SCOPE
    })
  });
  if (!tokenResponse.ok) {
    return htmlResponse(
      "OneDrive 連接失敗：跟 Microsoft 換 token 失敗（HTTP " + tokenResponse.status + "）。" +
        escapeHtmlText(await tokenResponse.text()),
      502
    );
  }
  const tokenData = await tokenResponse.json();
  if (!tokenData.refresh_token) {
    return htmlResponse("OneDrive 連接失敗：Microsoft 沒有回傳 refresh_token（scope 或帳號類型可能不對）。", 502);
  }

  await saveOnedriveRefreshToken(env, identity, tokenData.refresh_token);
  onedriveTokenCache[identity] = {
    accessToken: tokenData.access_token,
    expiresAt: Date.now() + (Number(tokenData.expires_in) || 3600) * 1000
  };

  return htmlResponse("OneDrive 已連接成功！可以關掉這個分頁了。", 200);
}

function escapeHtmlText(value) {
  return String(value == null ? "" : value).replace(/[&<>"']/g, function (ch) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
  });
}

function htmlResponse(message, status) {
  return new Response(
    "<!doctype html><html lang=\"zh-Hant\"><meta charset=\"utf-8\">" +
      "<body style=\"font-family:system-ui;padding:40px;text-align:center;\">" +
      "<p>" + message + "</p></body></html>",
    { status: status, headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}

async function fetchOnedriveAccountRow(env, identity) {
  const url = env.SUPABASE_URL.replace(/\/+$/, "") +
    "/rest/v1/onedrive_account?identity=eq." + encodeURIComponent(identity) +
    "&select=identity,refresh_token,connected_at";
  const response = await fetch(url, { method: "GET", headers: supabaseHeaders(env) });
  if (!response.ok) {
    throw new Error("Supabase read failed: HTTP " + response.status + " " + (await response.text()));
  }
  const rows = await response.json();
  return rows[0] || null;
}

async function fetchAllOnedriveAccountRows(env) {
  const url = env.SUPABASE_URL.replace(/\/+$/, "") + "/rest/v1/onedrive_account?select=identity,connected_at";
  const response = await fetch(url, { method: "GET", headers: supabaseHeaders(env) });
  if (!response.ok) {
    throw new Error("Supabase read failed: HTTP " + response.status + " " + (await response.text()));
  }
  return response.json();
}

async function saveOnedriveRefreshToken(env, identity, refreshToken) {
  const upsertUrl = env.SUPABASE_URL.replace(/\/+$/, "") + "/rest/v1/onedrive_account";
  const row = {
    identity: identity,
    refresh_token: refreshToken,
    updated_at: new Date().toISOString()
  };
  const response = await fetch(upsertUrl, {
    method: "POST",
    headers: Object.assign({ Prefer: "resolution=merge-duplicates" }, supabaseHeaders(env)),
    body: JSON.stringify(row)
  });
  if (!response.ok) {
    throw new Error("Supabase upsert failed: HTTP " + response.status + " " + (await response.text()));
  }
}

// access token 用 module 變數快取，跟 getFcmAccessToken 同一個模式，
// 差別是這裡兩個人各自的 token 要分開存——一個物件，key 是 identity。
var onedriveTokenCache = {};

async function getOnedriveAccessToken(env, identity) {
  const cached = onedriveTokenCache[identity];
  if (cached && Date.now() < cached.expiresAt - 5 * 60 * 1000) {
    return cached.accessToken;
  }
  const row = await fetchOnedriveAccountRow(env, identity);
  if (!row || !row.refresh_token) {
    throw new Error("OneDrive 還沒連接");
  }
  const tokenResponse = await fetch(ONEDRIVE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.JONAMINZ_ONEDRIVE_CLIENT_ID,
      client_secret: env.JONAMINZ_ONEDRIVE_CLIENT_SECRET,
      grant_type: "refresh_token",
      refresh_token: row.refresh_token,
      scope: ONEDRIVE_SCOPE
    })
  });
  if (!tokenResponse.ok) {
    throw new Error("OneDrive token refresh failed: HTTP " + tokenResponse.status + " " + (await tokenResponse.text()));
  }
  const tokenData = await tokenResponse.json();
  onedriveTokenCache[identity] = {
    accessToken: tokenData.access_token,
    expiresAt: Date.now() + (Number(tokenData.expires_in) || 3600) * 1000
  };
  // 個人帳號的 refresh token 會滾動更新——回應帶新的一定要覆蓋存檔，
  // 不然舊的用完之後（通常幾個月的效期）整條線就斷了。
  if (tokenData.refresh_token && tokenData.refresh_token !== row.refresh_token) {
    await saveOnedriveRefreshToken(env, identity, tokenData.refresh_token);
  }
  return onedriveTokenCache[identity].accessToken;
}

// 回傳兩人各自的連接狀態（不是只回呼叫者自己那一個）——後台頁面要同時
// 畫「你」跟「另一半」兩張狀態卡片。
async function getOnedriveStatus(env, payload) {
  const identity = await requireSession(env, payload);
  if (!identity) {
    return { ok: false, code: "LOGIN_REQUIRED", error: "login required" };
  }
  const rows = await fetchAllOnedriveAccountRows(env);
  const accounts = { jonathan: null, minz: null };
  rows.forEach(function (row) {
    if (row.identity === "jonathan" || row.identity === "minz") {
      accounts[row.identity] = { connected: true, connectedAt: row.connected_at };
    }
  });
  if (!accounts.jonathan) accounts.jonathan = { connected: false, connectedAt: null };
  if (!accounts.minz) accounts.minz = { connected: false, connectedAt: null };
  return { ok: true, accounts: accounts };
}

// Phase A 的驗收動作：確認指定身分的帳號 access token 真的能對 Graph
// 說話、App Folder 真的存在——不是只驗證「有存 refresh_token」這種
// 表面狀態。要求呼叫者已登入（不管哪個身分），但可以測任一人的帳號
// ——理由同 handleOnedriveStart，兩人共用帳密，這層限制沒有實際意義。
async function testOnedriveConnection(env, payload) {
  const caller = await requireSession(env, payload);
  if (!caller) {
    return { ok: false, code: "LOGIN_REQUIRED", error: "login required" };
  }
  const requestedIdentity = payload && payload.identity;
  const identity = (requestedIdentity === "jonathan" || requestedIdentity === "minz")
    ? requestedIdentity
    : caller;
  let accessToken;
  try {
    accessToken = await getOnedriveAccessToken(env, identity);
  } catch (error) {
    return { ok: false, error: error.message || String(error) };
  }
  const response = await fetch("https://graph.microsoft.com/v1.0/me/drive/special/approot", {
    headers: { Authorization: "Bearer " + accessToken }
  });
  if (!response.ok) {
    return { ok: false, error: "Graph HTTP " + response.status + ": " + (await response.text()) };
  }
  const folder = await response.json();
  return { ok: true, folderId: folder.id, folderName: folder.name, webUrl: folder.webUrl };
}

// ---------- 「決策與待辦」頁（pages/admin/journal/）的待辦看板，
// 2026-07-15 使用者提議：Google Todo List 風格的兩泳道清單——
// 'for_user'（Claude 交辦給使用者做的事）、'for_claude'（使用者隨時
// 記下、之後給 Claude 挑來做的待辦）。單一全域清單，任何已登入身分
// 都能新增/勾選/刪除任一泳道的項目（跟 OneDrive 連接同一個信任模型：
// 兩人共用帳密，不用分誰能動哪個泳道）。----------

async function listProjectTasks(env, payload) {
  const identity = await requireSession(env, payload);
  if (!identity) {
    return { ok: false, code: "LOGIN_REQUIRED", error: "login required" };
  }
  const url = env.SUPABASE_URL.replace(/\/+$/, "") +
    "/rest/v1/project_tasks?select=id,lane,text,done,created_by,created_at,done_at&order=created_at.asc";
  const response = await fetch(url, { method: "GET", headers: supabaseHeaders(env) });
  if (!response.ok) {
    throw new Error("Supabase read failed: HTTP " + response.status + " " + (await response.text()));
  }
  const rows = await response.json();
  return { ok: true, rows: rows };
}

async function addProjectTask(env, payload) {
  const identity = await requireSession(env, payload);
  if (!identity) {
    return { ok: false, code: "LOGIN_REQUIRED", error: "login required" };
  }
  const lane = (payload && payload.lane) === "for_claude" ? "for_claude" : "for_user";
  const text = String((payload && payload.text) || "").trim();
  if (!text) {
    return { ok: false, code: "TEXT_REQUIRED", error: "text is required" };
  }
  const insertUrl = env.SUPABASE_URL.replace(/\/+$/, "") + "/rest/v1/project_tasks";
  const response = await fetch(insertUrl, {
    method: "POST",
    headers: Object.assign({ Prefer: "return=representation" }, supabaseHeaders(env)),
    body: JSON.stringify({ lane: lane, text: text, created_by: identity })
  });
  if (!response.ok) {
    throw new Error("Supabase insert failed: HTTP " + response.status + " " + (await response.text()));
  }
  const rows = await response.json();
  return { ok: true, row: rows[0] };
}

async function toggleProjectTask(env, payload) {
  const identity = await requireSession(env, payload);
  if (!identity) {
    return { ok: false, code: "LOGIN_REQUIRED", error: "login required" };
  }
  const id = String((payload && payload.id) || "").trim();
  if (!id) {
    return { ok: false, code: "ID_REQUIRED", error: "id is required" };
  }
  const done = Boolean(payload && payload.done);
  const updateUrl = env.SUPABASE_URL.replace(/\/+$/, "") + "/rest/v1/project_tasks?id=eq." + encodeURIComponent(id);
  const response = await fetch(updateUrl, {
    method: "PATCH",
    headers: supabaseHeaders(env),
    body: JSON.stringify({ done: done, done_at: done ? new Date().toISOString() : null })
  });
  if (!response.ok) {
    throw new Error("Supabase update failed: HTTP " + response.status + " " + (await response.text()));
  }
  return { ok: true };
}

async function deleteProjectTask(env, payload) {
  const identity = await requireSession(env, payload);
  if (!identity) {
    return { ok: false, code: "LOGIN_REQUIRED", error: "login required" };
  }
  const id = String((payload && payload.id) || "").trim();
  if (!id) {
    return { ok: false, code: "ID_REQUIRED", error: "id is required" };
  }
  const deleteUrl = env.SUPABASE_URL.replace(/\/+$/, "") + "/rest/v1/project_tasks?id=eq." + encodeURIComponent(id);
  const response = await fetch(deleteUrl, { method: "DELETE", headers: supabaseHeaders(env) });
  if (!response.ok) {
    throw new Error("Supabase delete failed: HTTP " + response.status + " " + (await response.text()));
  }
  return { ok: true };
}
