/*
檔案位置：jonaminz/backend/cloudflare-worker/worker.js
用途：jonaminz 水庫唯一後端入口。目前支援四個 action：
- registerExternalApp：外部專案自己的頁面載入時回報「我上線了」，upsert 進 Supabase。
- listExternalAppRegistrations：後台讀取回報清單。
- getThemeCssRules：讀取 Theme（CSS 疊加第 8 層）目前的規則，任何頁面 / 外部專案都能讀
  （公開、唯讀，selector=":root" 的規則是跨專案共用的 token 介面）。
- saveThemeCssRules：後台 Theme 頁存檔用，整批覆蓋規則。目前沒有身分驗證保護，
  是已知的暫時限制（見 backend/README.md）。

機密只存在 Cloudflare Worker 的 secret（SUPABASE_URL / SUPABASE_SECRET_KEY，對應
Supabase 新版 API key 命名：sb_secret_... 這把，不是 sb_publishable_...），
不寫死在程式碼裡，也不會回傳給前端。
*/

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS_HEADERS });
    }

    if (request.method !== "POST") {
      return json({ ok: false, error: "Method not allowed" }, 405);
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
