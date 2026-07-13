/*
檔案位置：tools/project-memory/lib/ledger.mjs
用途：ledger.jsonl 的讀寫——append-only 事件記錄，每行一個合法 JSON
object。只能 append，任何指令都不會重寫或刪除既有行。
*/
import fs from "node:fs";
import path from "node:path";
import { getPaths, ensureDir, readFileIfExists } from "./files.mjs";
import { newEventId } from "./ids.mjs";

const SUPPORTED_TYPES = [
  "session_started",
  "session_closed",
  "fact_candidate",
  "decision_candidate",
  "issue_candidate",
  "experiment_candidate",
  "checkpoint",
  "validation",
  "note"
];

export function isSupportedEventType(type) {
  return SUPPORTED_TYPES.indexOf(type) !== -1;
}

/**
 * 補上 schemaVersion/eventId/timestamp/project/status 等固定欄位後
 * append 一行 JSON 到 ledger.jsonl。呼叫端只需要提供會變動的欄位
 * （type/sessionId/agent/scope/summary/reason/relatedFiles/metadata）。
 */
export function appendEvent(rootDir, partial) {
  const paths = getPaths(rootDir);
  ensureDir(paths.memoryDir);

  const event = {
    schemaVersion: 1,
    eventId: newEventId(),
    timestamp: new Date().toISOString(),
    project: path.basename(paths.root),
    sessionId: partial.sessionId || null,
    agent: partial.agent || null,
    type: partial.type,
    scope: partial.scope || [],
    summary: partial.summary || "",
    reason: partial.reason || "",
    status: partial.status || "recorded",
    relatedFiles: partial.relatedFiles || [],
    metadata: partial.metadata || {}
  };

  fs.appendFileSync(paths.ledgerFile, JSON.stringify(event) + "\n", "utf8");
  return event;
}

/**
 * 讀取全部事件。每一行各自 try/catch parse，壞掉的行收進 errors
 * （附行號與原始內容），不會讓整個檔案讀取失敗——check 指令要能明確
 * 指出「第幾行壞掉」，不是整份判死。
 */
export function readAllEvents(rootDir) {
  const paths = getPaths(rootDir);
  const text = readFileIfExists(paths.ledgerFile);
  const events = [];
  const errors = [];

  if (text === null) return { events, errors };

  const lines = text.split("\n");
  lines.forEach(function (line, index) {
    const trimmed = line.trim();
    if (!trimmed) return;

    try {
      const parsed = JSON.parse(trimmed);
      events.push(parsed);
    } catch (error) {
      errors.push({ line: index + 1, raw: trimmed, error: error.message });
    }
  });

  return { events, errors };
}
