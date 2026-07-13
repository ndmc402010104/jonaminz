/*
檔案位置：tools/project-memory/lib/validators.mjs
用途：`memory.mjs check` 背後的檢查邏輯。每項回傳 level（PASS /
WARNING / ERROR）+ message，check 指令彙整後決定 process exit code。
*/
import path from "node:path";
import { getPaths, readFileIfExists, exists } from "./files.mjs";
import { readAllEvents } from "./ledger.mjs";

const REQUIRED_FILES = [
  "factsFile", "decisionsFile", "currentStateFile", "knownIssuesFile",
  "experimentsFile", "sessionLogFile", "checkpointsFile", "pendingFile",
  "contextPackFile", "aiContextReadmeFile", "configFile", "ledgerFile"
];

const SECRET_PATTERNS = [
  { name: "sk- prefix", regex: /\bsk-[A-Za-z0-9]{10,}/ },
  { name: "sk-proj- prefix", regex: /\bsk-proj-[A-Za-z0-9_-]{10,}/ },
  { name: "Google API key (AIza)", regex: /\bAIza[A-Za-z0-9_-]{20,}/ },
  { name: "Bearer token", regex: /\bBearer\s+[A-Za-z0-9._-]{10,}/ },
  { name: "service_role", regex: /service_role/i },
  { name: "SUPABASE_SERVICE_ROLE_KEY", regex: /SUPABASE_SERVICE_ROLE_KEY/ },
  { name: "OPENAI_API_KEY", regex: /OPENAI_API_KEY/ },
  { name: "GEMINI_API_KEY", regex: /GEMINI_API_KEY/ },
  { name: "ANTHROPIC_API_KEY", regex: /ANTHROPIC_API_KEY/ },
  { name: "JWT-like string", regex: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/ }
];

const PLACEHOLDER_PATTERNS = [/TODO:\s*fill this/i, /\bFIXME\b/, /\bLOREM IPSUM\b/i];

function pushResult(results, level, message) {
  results.push({ level, message });
}

function checkRequiredFiles(rootDir, results) {
  const paths = getPaths(rootDir);
  REQUIRED_FILES.forEach(function (key) {
    if (exists(paths[key])) {
      pushResult(results, "PASS", "必要檔案存在：" + path.relative(paths.root, paths[key]));
    } else {
      pushResult(results, "ERROR", "缺少必要檔案：" + path.relative(paths.root, paths[key]));
    }
  });
}

function checkConfig(rootDir, results) {
  const paths = getPaths(rootDir);
  const text = readFileIfExists(paths.configFile);
  if (text === null) {
    pushResult(results, "ERROR", "config.json 不存在");
    return;
  }
  try {
    const parsed = JSON.parse(text);
    if (typeof parsed.contextMaxCharacters !== "number") {
      pushResult(results, "WARNING", "config.json 缺少 contextMaxCharacters 數字欄位");
    } else {
      pushResult(results, "PASS", "config.json 可解析且欄位齊全");
    }
  } catch (error) {
    pushResult(results, "ERROR", "config.json 不是合法 JSON：" + error.message);
  }
}

function checkLedger(rootDir, results) {
  const { events, errors } = readAllEvents(rootDir);
  if (errors.length) {
    errors.forEach(function (e) {
      pushResult(results, "ERROR", "ledger.jsonl 第 " + e.line + " 行不是合法 JSON：" + e.error);
    });
  } else {
    pushResult(results, "PASS", "ledger.jsonl 共 " + events.length + " 行事件，全部是合法 JSON");
  }

  const requiredFields = ["schemaVersion", "eventId", "timestamp", "type"];
  let missingFieldCount = 0;
  events.forEach(function (event, index) {
    const missing = requiredFields.filter(function (field) { return !(field in event); });
    if (missing.length) {
      missingFieldCount += 1;
      pushResult(results, "ERROR", "ledger 事件第 " + (index + 1) + " 筆缺少欄位：" + missing.join(", "));
    }
  });
  if (!missingFieldCount && events.length) {
    pushResult(results, "PASS", "所有 ledger 事件都有必要欄位");
  }
}

function checkActiveSession(rootDir, results) {
  const paths = getPaths(rootDir);
  if (exists(paths.currentSessionFile)) {
    pushResult(results, "WARNING", "目前有 active session 尚未 close（.project-memory/current-session.json 存在）");
  } else {
    pushResult(results, "PASS", "沒有未關閉的 session");
  }
}

function checkDecisionIds(rootDir, results) {
  const paths = getPaths(rootDir);
  const text = readFileIfExists(paths.decisionsFile) || "";
  const matches = [...text.matchAll(/^## (DEC-\d+)/gm)].map(function (m) { return m[1]; });

  if (!matches.length) {
    pushResult(results, "PASS", "DECISIONS.md 沒有 `## DEC-NNN` 結構化條目可檢查（自由文字記述格式，略過結構化檢查）");
    return;
  }

  const seen = new Set();
  const duplicates = new Set();
  matches.forEach(function (id) {
    if (seen.has(id)) duplicates.add(id);
    seen.add(id);
  });
  if (duplicates.size) {
    pushResult(results, "ERROR", "DECISIONS.md 有重複的 Decision ID：" + [...duplicates].join(", "));
  } else {
    pushResult(results, "PASS", "DECISIONS.md 沒有重複的 Decision ID（共 " + seen.size + " 筆）");
  }

  const supersedesMatches = [...text.matchAll(/-\s*Supersedes:\s*(DEC-\d+)/gi)].map(function (m) { return m[1]; });
  const dangling = supersedesMatches.filter(function (id) { return !seen.has(id); });
  if (dangling.length) {
    pushResult(results, "ERROR", "DECISIONS.md 有 Supersedes 指向不存在的 ID：" + dangling.join(", "));
  } else if (supersedesMatches.length) {
    pushResult(results, "PASS", "所有 Supersedes 參照都指向存在的 Decision ID");
  }
}

function checkContextPackMarker(rootDir, results) {
  const paths = getPaths(rootDir);
  const text = readFileIfExists(paths.contextPackFile);
  if (text === null) {
    pushResult(results, "WARNING", "CONTEXT_PACK.md 尚未產生，執行一次 `memory.mjs start` 即可");
    return;
  }
  if (text.indexOf("AUTO-GENERATED") === -1) {
    pushResult(results, "ERROR", "CONTEXT_PACK.md 缺少 AUTO-GENERATED 標記，可能被手動編輯過");
  } else {
    pushResult(results, "PASS", "CONTEXT_PACK.md 有正確的自動產物標記");
  }
}

function checkPendingFormat(rootDir, results) {
  const paths = getPaths(rootDir);
  const text = readFileIfExists(paths.pendingFile);
  if (text === null) {
    pushResult(results, "WARNING", "PENDING.md 不存在");
    return;
  }
  const blocks = [...text.matchAll(/^### (PEND-\d+)/gm)];
  let malformed = 0;
  blocks.forEach(function (m) {
    const startIndex = m.index;
    const nextBlock = text.indexOf("\n### ", startIndex + 1);
    const nextSection = text.indexOf("\n## ", startIndex + 1);
    const endCandidates = [nextBlock, nextSection, text.length].filter(function (i) { return i !== -1; });
    const end = Math.min.apply(null, endCandidates);
    const body = text.slice(startIndex, end);
    if (!/-\s*Status:\s*(pending|confirmed|rejected|promoted)/i.test(body)) {
      malformed += 1;
      pushResult(results, "ERROR", "PENDING.md 條目 " + m[1] + " 缺少合法的 Status 欄位");
    }
  });
  if (!malformed) {
    pushResult(results, "PASS", "PENDING.md 共 " + blocks.length + " 筆候選內容，格式正確");
  }
}

function checkPlaceholders(rootDir, results) {
  const paths = getPaths(rootDir);
  const filesToScan = [
    paths.factsFile, paths.decisionsFile, paths.currentStateFile,
    paths.knownIssuesFile, paths.experimentsFile
  ];
  let found = 0;
  filesToScan.forEach(function (filePath) {
    const text = readFileIfExists(filePath);
    if (text === null) return;
    PLACEHOLDER_PATTERNS.forEach(function (pattern) {
      if (pattern.test(text)) {
        found += 1;
        pushResult(results, "WARNING", path.basename(filePath) + " 疑似包含未填完的 placeholder（" + pattern.source + "）");
      }
    });
  });
  if (!found) pushResult(results, "PASS", "正式文件沒有偵測到明顯 placeholder");
}

function checkSecrets(rootDir, results) {
  const paths = getPaths(rootDir);
  const filesToScan = [paths.configFile, paths.ledgerFile, paths.currentSessionFile];
  let found = 0;
  filesToScan.forEach(function (filePath) {
    const text = readFileIfExists(filePath);
    if (text === null) return;
    SECRET_PATTERNS.forEach(function (pattern) {
      if (pattern.regex.test(text)) {
        found += 1;
        pushResult(results, "WARNING", ".project-memory 內 " + path.basename(filePath) + " 疑似包含 secret（" + pattern.name + "），請人工確認");
      }
    });
  });
  if (!found) pushResult(results, "PASS", ".project-memory 沒有偵測到疑似 secret 字串");
}

export function runAllChecks(rootDir) {
  const results = [];
  checkRequiredFiles(rootDir, results);
  checkConfig(rootDir, results);
  checkLedger(rootDir, results);
  checkActiveSession(rootDir, results);
  checkDecisionIds(rootDir, results);
  checkContextPackMarker(rootDir, results);
  checkPendingFormat(rootDir, results);
  checkPlaceholders(rootDir, results);
  checkSecrets(rootDir, results);

  const hasError = results.some(function (r) { return r.level === "ERROR"; });
  return { results, hasError };
}
