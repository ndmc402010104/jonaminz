/*
檔案位置：jonaminz/backend/cloudflare-worker/contract-validation.js
用途：Contract 收取的驗證邏輯，純函式、不碰 network/Supabase，方便獨立用
node 測試。對應規格 docs/platform-integration-spec-v1.md（S12, S14, S15）
與 docs/contract-schema/README.md 記錄的、JSON Schema 本身做不到的部分：
cross-field 一致性（entryId/objectType 重複、requests/requires ⊆ supports、
requires.entryId 參照）與 URL 的實際同源解析（ajv 只驗過語法層）。

worker.js 呼叫順序：ajv 驗過結構 → validateCrossFields → validateUrls
（用 Integration Settings 查到的 registeredOrigin）。兩者都回傳結構化
result（S12：不是 true/false），不會讓一個壞掉的 entry 拖垮整份合約。
*/

export function canonicalize(value) {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (value && typeof value === "object") {
    const sorted = {};
    for (const key of Object.keys(value).sort()) {
      sorted[key] = canonicalize(value[key]);
    }
    return sorted;
  }
  return value;
}

export async function computeCanonicalHash(contract) {
  const canonicalJson = JSON.stringify(canonicalize(contract));
  const data = new TextEncoder().encode(canonicalJson);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function countBy(list, keyFn) {
  const counts = {};
  for (const item of list) {
    const key = keyFn(item);
    if (key === undefined || key === null) continue;
    counts[key] = (counts[key] || 0) + 1;
  }
  return counts;
}

// S12: entryId/objectType 重複 → 該區段整段無效；requests/requires 的能力
// 沒出現在 supports 裡、或 requires.entryId 對不到任何 entry → 該筆無效，
// 不阻擋其餘部分。
export function validateCrossFields(contract) {
  const errors = [];
  const entries = Array.isArray(contract.entries) ? contract.entries : [];
  const objects = Array.isArray(contract.objects) ? contract.objects : [];
  const capabilities =
    contract.capabilities && typeof contract.capabilities === "object" ? contract.capabilities : {};
  const supports = Array.isArray(capabilities.supports) ? capabilities.supports : [];
  const requests = Array.isArray(capabilities.requests) ? capabilities.requests : [];
  const requires = Array.isArray(capabilities.requires) ? capabilities.requires : [];

  const entryIdCounts = countBy(entries, (e) => e && e.entryId);
  const hasDuplicateEntryId = Object.values(entryIdCounts).some((count) => count > 1);
  const validEntries = hasDuplicateEntryId ? [] : entries;
  const droppedEntries = hasDuplicateEntryId ? entries.slice() : [];
  if (hasDuplicateEntryId) {
    errors.push({
      path: "entries",
      code: "DUPLICATE_ENTRY_ID",
      message: "entries 內有重複的 entryId，整個 entries 區段視為無效"
    });
  }

  const objectTypeCounts = countBy(objects, (o) => o && o.objectType);
  const hasDuplicateObjectType = Object.values(objectTypeCounts).some((count) => count > 1);
  const validObjects = hasDuplicateObjectType ? [] : objects;
  const droppedObjects = hasDuplicateObjectType ? objects.slice() : [];
  if (hasDuplicateObjectType) {
    errors.push({
      path: "objects",
      code: "DUPLICATE_OBJECT_TYPE",
      message: "objects 內有重複的 objectType，整個 objects 區段視為無效"
    });
  }

  const validEntryIds = new Set(validEntries.map((e) => e.entryId));
  const supportsSet = new Set(supports);

  const validRequests = requests.filter((cap) => {
    if (supportsSet.has(cap)) return true;
    errors.push({
      path: "capabilities.requests",
      code: "CAPABILITY_NOT_IN_SUPPORTS",
      message: `"${cap}" 出現在 requests 但不在 supports 裡，視為無效`
    });
    return false;
  });

  const droppedRequires = [];
  const validRequires = requires.filter((req) => {
    if (!req || typeof req !== "object") return false;
    if (!supportsSet.has(req.capability)) {
      errors.push({
        path: "capabilities.requires",
        code: "CAPABILITY_NOT_IN_SUPPORTS",
        message: `requires 的 "${req.capability}" 不在 supports 裡，該筆 requires 視為無效`
      });
      droppedRequires.push(req);
      return false;
    }
    if (!validEntryIds.has(req.entryId)) {
      errors.push({
        path: "capabilities.requires",
        code: "ENTRY_ID_NOT_FOUND",
        message: `requires 的 entryId "${req.entryId}" 找不到對應的 entries[].entryId，該筆 requires 視為無效`
      });
      droppedRequires.push(req);
      return false;
    }
    return true;
  });

  return {
    valid: errors.length === 0,
    errors,
    droppedEntries,
    droppedObjects,
    droppedRequires,
    normalized: {
      entries: validEntries,
      objects: validObjects,
      capabilities: {
        supports,
        requests: validRequests,
        requires: validRequires
      }
    }
  };
}

// S15：ajv 只驗過 contractUrl 的語法層（https:// 或 path-absolute、禁反斜線）；
// 這裡用真正的 URL parser 把每個 URL 解析到 registeredOrigin 底下，確認
// 解析後的 origin 精確等於登記的 origin，並再擋一次反斜線（防禦 WHATWG
// URL 正規化繞過，見 docs/contract-schema/README.md 的 RC3 修正紀錄）。
export function validateUrls(contract, registeredOrigin) {
  const errors = [];
  const droppedEntries = [];

  function checkUrl(value, path) {
    if (typeof value !== "string" || !value) {
      return { ok: true, value: undefined };
    }
    if (value.indexOf("\\") !== -1) {
      errors.push({ path, code: "URL_CONTAINS_BACKSLASH", message: `${path} 含反斜線，視為無效` });
      return { ok: false };
    }
    let parsed;
    try {
      parsed = new URL(value, registeredOrigin);
    } catch (e) {
      errors.push({ path, code: "URL_UNPARSEABLE", message: `${path} 無法解析為合法 URL` });
      return { ok: false };
    }
    if (parsed.protocol !== "https:") {
      errors.push({ path, code: "URL_NOT_HTTPS", message: `${path} 解析後不是 https:` });
      return { ok: false };
    }
    if (parsed.username || parsed.password) {
      errors.push({ path, code: "URL_HAS_CREDENTIALS", message: `${path} 不得帶帳號密碼` });
      return { ok: false };
    }
    if (parsed.origin !== registeredOrigin) {
      errors.push({
        path,
        code: "URL_ORIGIN_MISMATCH",
        message: `${path} 解析後的 origin (${parsed.origin}) 與登記的 origin (${registeredOrigin}) 不符`
      });
      return { ok: false };
    }
    return { ok: true, value: parsed.href };
  }

  let normalizedAppIcon;
  if (contract.app && contract.app.icon) {
    const result = checkUrl(contract.app.icon, "app.icon");
    normalizedAppIcon = result.ok ? result.value : undefined;
  }

  const entries = Array.isArray(contract.entries) ? contract.entries : [];
  const validEntries = [];
  entries.forEach((entry, index) => {
    if (!entry || typeof entry !== "object") return;
    const urlResult = checkUrl(entry.url, `entries[${index}].url`);
    if (!urlResult.ok) {
      droppedEntries.push(entry);
      return;
    }
    if (entry.icon) {
      const iconResult = checkUrl(entry.icon, `entries[${index}].icon`);
      if (!iconResult.ok) {
        droppedEntries.push(entry);
        return;
      }
    }
    validEntries.push(entry);
  });

  return {
    valid: errors.length === 0,
    errors,
    droppedEntries,
    normalized: {
      appIcon: normalizedAppIcon,
      entries: validEntries
    }
  };
}
