/*
檔案位置：jonaminz/backend/cloudflare-worker/worker.js
用途：jonaminz 水庫唯一後端入口。目前支援五個 action：
- registerExternalApp：外部專案自己的頁面載入時回報「我上線了」，upsert 進 Supabase。
- listExternalAppRegistrations：後台讀取回報清單。
- getThemeCssRules：讀取 Theme（CSS 疊加第 8 層）目前的規則，任何頁面 / 外部專案都能讀
  （公開、唯讀，selector=":root" 的規則是跨專案共用的 token 介面）。
- saveThemeCssRules：後台 Theme 頁存檔用，整批覆蓋規則。目前沒有身分驗證保護，
  是已知的暫時限制（見 backend/README.md）。
- submitContract：Platform Integration（圖書館模型）的合約推送入口。對應規格
  docs/platform-integration-spec-v1.md（Frozen, S13-S16）。收下的合約一律存成
  immutable snapshot、status 一律 'pending'——推送 ≠ 採信，不會自動 approve。
- listPendingContracts：核准後台讀取清單用，公開唯讀（跟
  listExternalAppRegistrations 同一個原則）。回傳最近 N 筆 snapshot，並附上
  每個 (project_id, environment) 目前 active 的版本供前端做 diff（S14）。
- approveContract / rejectContract：implementation plan 第 3 項的核准/否決。
  **這兩個是目前唯一有身分驗證保護的寫入動作**：整站還沒有登入系統
  （Google OAuth 是第 9 項），這兩個先用 Worker secret
  JONAMINZ_ADMIN_TOKEN 當臨時關卡，呼叫時 payload.adminToken 要吻合。
  實際的狀態切換透過 Supabase RPC 呼叫 Postgres function
  approve_contract_snapshot / reject_contract_snapshot（見
  backend/supabase/contract_schema.sql），確保「改狀態＋切換 active 指標＋
  寫 audit log」是同一個原子操作，不是 Worker 端連續多次 fetch。

機密只存在 Cloudflare Worker 的 secret（SUPABASE_URL / SUPABASE_SECRET_KEY，對應
Supabase 新版 API key 命名：sb_secret_... 這把，不是 sb_publishable_...），
不寫死在程式碼裡，也不會回傳給前端。
*/

import validateContractSchema from "./contract-schema-validator.generated.js";
import integrationSettings from "./integration-settings.json";
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

function checkAdminToken(env, payload) {
  const provided = String((payload && payload.adminToken) || "");
  const expected = env.JONAMINZ_ADMIN_TOKEN;

  // 沒設定 secret 時一律拒絕，不要因為忘記設定就變成沒有保護。
  if (!expected || !provided || provided !== expected) {
    return false;
  }
  return true;
}

// implementation plan 第 3 項：approve/reject 是目前唯一有保護的寫入動作。
// 整站還沒有登入系統，這裡先用 Worker secret 當臨時關卡（見檔頭註解），
// 等 Google OAuth（第 9 項）落地後要換成正式驗證。
async function approveContract(env, payload) {
  if (!checkAdminToken(env, payload)) {
    return { ok: false, code: "UNAUTHORIZED", error: "Invalid or missing adminToken" };
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
      p_actor: String(payload.actor || "").trim() || null,
      p_note: String(payload.note || "").trim() || null
    })
  });

  if (!response.ok) {
    throw new Error("Supabase RPC failed: HTTP " + response.status + " " + (await response.text()));
  }

  return { ok: true, snapshotId: snapshotId, status: "approved" };
}

async function rejectContract(env, payload) {
  if (!checkAdminToken(env, payload)) {
    return { ok: false, code: "UNAUTHORIZED", error: "Invalid or missing adminToken" };
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
      p_actor: String(payload.actor || "").trim() || null,
      p_note: String(payload.note || "").trim() || null
    })
  });

  if (!response.ok) {
    throw new Error("Supabase RPC failed: HTTP " + response.status + " " + (await response.text()));
  }

  return { ok: true, snapshotId: snapshotId, status: "rejected" };
}
