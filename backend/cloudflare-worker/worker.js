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
- getGrantedIdentity：implementation plan 第 9 項階段 B（`identity.currentUser@1`
  capability，S30-33）。只給 `pages/identity-relay/` 呼叫，不是給外部
  專案的 SDK 直接打——token 永遠留在 jonaminz.com 自己的瀏覽器裡。用
  `resolveEffectiveCapabilities` 重新算一次 `identity.currentUser@1`
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
  // 讓前端可以把 pending 的內容跟這個做 diff（S14）。
  const activeByKey = {};
  activeRows.forEach(function (row) {
    const linked = row.contract_snapshots;
    if (!linked) return;
    activeByKey[row.project_id + "::" + row.environment] = {
      snapshotId: linked.id,
      canonicalHash: linked.canonical_hash,
      rawContract: linked.raw_contract
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

function resolveOauthReturnOrigin(candidate) {
  candidate = String(candidate || "");
  if (candidate === OAUTH_DEFAULT_RETURN_ORIGIN) return candidate;
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
// 用 resolveEffectiveCapabilities 逐請求重算一次「identity.currentUser@1」
// 是不是真的在授權交集裡，granted:false 時完全不查身分、直接回 null，
// 避免對未授權的呼叫端洩漏「這個人現在有沒有登入」這個資訊本身。
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
  if (capabilities.indexOf("identity.currentUser@1") === -1) {
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
