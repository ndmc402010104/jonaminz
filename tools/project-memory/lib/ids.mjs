/*
檔案位置：tools/project-memory/lib/ids.mjs
用途：Project Memory 用到的各種 ID 產生器。只用 node:crypto
built-in，不依賴 uuid 之類的 npm package。
*/
import crypto from "node:crypto";

function timestampSlug() {
  return new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
}

export function newEventId() {
  return "evt_" + timestampSlug() + "_" + crypto.randomUUID().slice(0, 8);
}

export function newSessionId() {
  return "session_" + timestampSlug() + "_" + crypto.randomUUID().slice(0, 8);
}

/** candidateId 格式固定 PEND-NNN（3 位數起跳，超過就自然變 4 位數）。
 * 掃描既有 PENDING.md 內容找出目前最大編號，回傳下一個——單一寫入者
 * 的本機 CLI 工具，不需要處理併發衝突。 */
export function nextCandidateId(pendingMarkdown) {
  const text = pendingMarkdown || "";
  const matches = [...text.matchAll(/PEND-(\d+)/g)].map(function (m) {
    return Number(m[1]);
  });
  const max = matches.length ? Math.max.apply(null, matches) : 0;
  const next = max + 1;
  return "PEND-" + String(next).padStart(3, "0");
}
