#!/usr/bin/env node
/*
檔案位置：tools/project-memory/memory.mjs
用途：Project Memory v0.1 CLI 入口。六個指令：init / start / record /
close / check / status，詳細規則見同資料夾 README.md。

刻意的設計限制（跟這個工具本身的目的一致，不是遺漏）：
- 只用 Node.js built-in module，沒有任何 npm 依賴、沒有 arg-parser
  套件，parseArgs() 是本檔自己寫的最小版本。
- 不會直接修改 AI_CONTEXT/FACTS.md 或 DECISIONS.md 這類正式真相文件的
  內容本體——record 一律只寫 PENDING.md 與 ledger，close 只 append
  SESSION_LOG.md，把 pending 內容「升級」成正式決策/事實永遠是人的
  動作，這個 CLI 沒有任何指令做這件事。
*/
import path from "node:path";
import fs from "node:fs";
import {
  getRootDir, getPaths, ensureDir, exists, readFileIfExists, writeFile,
  writeFileIfMissing, appendLine, prependAfterFirstDivider, readJsonIfExists,
  writeJson, removeFileIfExists
} from "./lib/files.mjs";
import { appendEvent } from "./lib/ledger.mjs";
import { newSessionId, nextCandidateId } from "./lib/ids.mjs";
import { buildContextPack } from "./lib/context.mjs";
import { runAllChecks } from "./lib/validators.mjs";

const DEFAULT_CONFIG = {
  schemaVersion: 1,
  commitLedger: false,
  contextMaxCharacters: 24000,
  recentSessionCount: 5
};

const CANDIDATE_TYPES = ["decision", "fact", "issue", "experiment"];
const LOG_ONLY_TYPES = ["note", "checkpoint", "validation"];

function parseArgs(argv) {
  const positional = [];
  const flags = {};

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg.indexOf("--") === 0) {
      const name = arg.slice(2);
      const next = argv[i + 1];
      const hasValue = next !== undefined && next.indexOf("--") !== 0;
      const value = hasValue ? next : true;
      if (hasValue) i += 1;

      if (flags[name] === undefined) {
        flags[name] = value;
      } else if (Array.isArray(flags[name])) {
        flags[name].push(value);
      } else {
        flags[name] = [flags[name], value];
      }
    } else {
      positional.push(arg);
    }
  }

  return { positional, flags };
}

function asArray(value) {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function asString(value) {
  if (value === undefined || value === true) return "";
  return String(value);
}

function fail(message) {
  console.error("[ERROR] " + message);
  process.exitCode = 1;
}

// ---------------------------------------------------------------------
// init
// ---------------------------------------------------------------------

const PENDING_TEMPLATE = `# PENDING — 未確認候選內容

本檔收 \`memory.mjs record\` 寫入的候選內容。Status 只有四種：
\`pending\`／\`confirmed\`／\`rejected\`／\`promoted\`。**只有使用者在當前
任務中明確要求，Agent 才能把某筆 pending 改成其他狀態或把內容搬進
FACTS.md／DECISIONS.md 等正式文件**，不得自行判斷「這應該算確認過了」。

每筆格式固定：

\`\`\`markdown
### PEND-NNN
- Type: <fact|decision|issue|experiment>
- Status: <pending|confirmed|rejected|promoted>
- Created: <ISO timestamp>
- Session: <sessionId>
- Scope: <字串，可留空>
- Summary: <一句話>
- Reason: <理由或證據，可留空>
- Files:
  - <相關檔案路徑，可省略整個清單>
\`\`\`

（上面是格式範例，標題 \`PEND-NNN\` 不是真實編號，不會被工具當成一筆
候選內容解析——真實條目的編號永遠是純數字接在 \`PEND-\` 後面，由
\`memory.mjs record\` 自動編號，不需要手動填寫。）

---

## Pending Facts

## Pending Decisions

## Pending Issues

## Pending Experiments
`;

const AI_CONTEXT_README_TEMPLATE = `# AI_CONTEXT/ 目錄說明

本資料夾是這個 repo 的 AI 交接文件單一事實來源。每份文件的責任互不
重疊，寫入前先確認你要寫的內容屬於哪一份，不要混著寫。

| 文件 | 只能放 | 不能放 |
|---|---|---|
| \`FACTS.md\` | 已用程式碼／schema／設定檔驗證過的事實 | 推測、偏好、未驗證說法、未完成構想 |
| \`DECISIONS.md\` | 使用者已明確裁決或已正式採用的決策 | 討論中、未拍板的想法（那些放 EXPERIMENTS.md） |
| \`CURRENT_STATE.md\` | 目前真實的實作狀態 | 理想架構、未來規劃、未驗證的完成宣稱 |
| \`KNOWN_ISSUES.md\` | 已知且仍存在的問題 | 已修好卻沒標記 resolved 的舊問題 |
| \`EXPERIMENTS.md\` | 未定案的想法、測試、候選方案 | 被當成既定決策使用 |
| \`SESSION_LOG.md\` | 每輪工作的結構化記錄（append-only） | 正式事實或決策本體 |
| \`CHECKPOINTS.md\` | 可安全回退的版本、驗收狀態、已知限制 | 一般工程流水帳（那些放 PROJECT_STATE.md／CHANGELOG.md） |
| \`PENDING.md\` | 尚未被確認的候選內容（fact/decision/issue/experiment） | 直接當成正式真相使用 |
| \`CONTEXT_PACK.md\` | 什麼都不要手動寫，這是自動產物 | — |

## 寫入規則

1. 新事實與新決策一律先進 \`PENDING.md\`（透過
   \`node tools/project-memory/memory.mjs record\`），不得由 Agent
   直接寫進 \`FACTS.md\`／\`DECISIONS.md\`。
2. 把 pending 內容「升級」成正式內容，必須是使用者在當前任務中明確
   要求的動作，不是 Agent 自行判斷。
3. \`DECISIONS.md\` 不得直接刪除舊決策；新決策取代舊決策時，把舊決策
   標記為 \`superseded\` 並互相引用。
4. \`CONTEXT_PACK.md\` 只能透過 \`memory.mjs start\`／\`close\` 重新產生，
   不得手動編輯——手動編輯過的版本會被 \`memory.mjs check\` 抓到（缺少
   或內容跟 AUTO-GENERATED 標記不符）。

## 禁止事項

- 不得把本資料夾以外的正式產品程式碼／Worker／Supabase schema 當成
  這個文件系統的一部分來管理。
- 不得為了讓 Context Pack 看起來更完整而在正式文件裡塞未驗證內容。
- 不得繞過 \`PENDING.md\` 直接修改正式真相文件來「省一步」。

完整工具說明見 \`tools/project-memory/README.md\`。
`;

function cmdInit(rootDir) {
  const paths = getPaths(rootDir);
  const created = [];
  const skipped = [];

  function note(filePath, wasCreated) {
    const rel = path.relative(paths.root, filePath);
    (wasCreated ? created : skipped).push(rel);
  }

  ensureDir(paths.aiContext);
  ensureDir(paths.memoryDir);
  ensureDir(paths.snapshotsDir);

  note(paths.pendingFile, writeFileIfMissing(paths.pendingFile, PENDING_TEMPLATE));
  note(paths.aiContextReadmeFile, writeFileIfMissing(paths.aiContextReadmeFile, AI_CONTEXT_README_TEMPLATE));

  const configCreated = writeFileIfMissing(paths.configFile, "");
  if (configCreated) {
    writeJson(paths.configFile, DEFAULT_CONFIG);
  }
  note(paths.configFile, configCreated);

  const ledgerCreated = writeFileIfMissing(paths.ledgerFile, "");
  note(paths.ledgerFile, ledgerCreated);

  const gitkeep = path.join(paths.snapshotsDir, ".gitkeep");
  note(gitkeep, writeFileIfMissing(gitkeep, ""));

  // CONTEXT_PACK.md 用真正的產生器建立，不是另外手寫一份格式可能
  // 跟 lib/context.mjs 產出對不上的樣板。
  const contextPackExisted = exists(paths.contextPackFile);
  buildContextPack(rootDir, readJsonIfExists(paths.configFile) || DEFAULT_CONFIG);
  note(paths.contextPackFile, !contextPackExisted);

  updateGitignore(rootDir);
  updateAgentBlock(paths.agentsFile);
  updateAgentBlock(paths.claudeFile);

  console.log("Project Memory init 完成。");
  console.log("");
  console.log("新建立（" + created.length + "）：");
  created.forEach(function (f) { console.log("  + " + f); });
  console.log("");
  console.log("已存在、跳過（" + skipped.length + "）：");
  skipped.forEach(function (f) { console.log("  = " + f); });
}

function updateGitignore(rootDir) {
  const paths = getPaths(rootDir);
  const config = readJsonIfExists(paths.configFile) || DEFAULT_CONFIG;
  const existing = readFileIfExists(paths.gitignoreFile) || "";

  const requiredLines = [
    ".project-memory/current-session.json",
    ".project-memory/snapshots/"
  ];
  if (!config.commitLedger) requiredLines.push(".project-memory/ledger.jsonl");

  const missing = requiredLines.filter(function (line) { return existing.indexOf(line) === -1; });
  if (!missing.length) return;

  const addition = "\n# project-memory (tools/project-memory)\n" + missing.join("\n") + "\n";
  writeFile(paths.gitignoreFile, existing.replace(/\n*$/, "\n") + addition);
}

const AGENT_BLOCK_START = "<!-- PROJECT_MEMORY_START -->";
const AGENT_BLOCK_END = "<!-- PROJECT_MEMORY_END -->";

function agentBlockContent() {
  return [
    AGENT_BLOCK_START,
    "## Project Memory Workflow",
    "",
    "Before making changes:",
    "",
    "1. Run `node tools/project-memory/memory.mjs start --agent <agent> --task \"<task>\"`",
    "2. Read `AI_CONTEXT/CONTEXT_PACK.md`",
    "3. Respect active decisions and known issues.",
    "",
    "During work:",
    "",
    "- Record new candidates with `memory.mjs record`.",
    "- Do not directly promote pending content into formal truth documents.",
    "",
    "Before finishing:",
    "",
    "1. Run relevant tests.",
    "2. Run `memory.mjs close`.",
    "3. Run `memory.mjs check`.",
    "4. Report changed files, validation results, pending decisions, and unresolved issues.",
    AGENT_BLOCK_END
  ].join("\n");
}

function updateAgentBlock(filePath) {
  if (!exists(filePath)) return;
  const existing = readFileIfExists(filePath) || "";
  const block = agentBlockContent();

  const startIndex = existing.indexOf(AGENT_BLOCK_START);
  const endIndex = existing.indexOf(AGENT_BLOCK_END);

  if (startIndex !== -1 && endIndex !== -1) {
    const before = existing.slice(0, startIndex);
    const after = existing.slice(endIndex + AGENT_BLOCK_END.length);
    writeFile(filePath, before + block + after);
    return;
  }

  writeFile(filePath, existing.replace(/\n*$/, "\n") + "\n" + block + "\n");
}

// ---------------------------------------------------------------------
// start
// ---------------------------------------------------------------------

function cmdStart(rootDir, flags) {
  const paths = getPaths(rootDir);

  if (exists(paths.currentSessionFile) && !flags.force) {
    fail(
      "已經有 active session（.project-memory/current-session.json 存在）。" +
      "先執行 `memory.mjs close`，或加 --force 覆蓋（會遺失前一個未關閉 session 的記錄）。"
    );
    return;
  }

  const agent = asString(flags.agent) || "unknown";
  const task = asString(flags.task) || "(no task description)";
  const sessionId = newSessionId();
  const startedAt = new Date().toISOString();

  ensureDir(paths.memoryDir);
  writeJson(paths.currentSessionFile, { sessionId, agent, task, startedAt });

  appendEvent(rootDir, { type: "session_started", sessionId, agent, summary: task });

  const config = readJsonIfExists(paths.configFile) || DEFAULT_CONFIG;
  buildContextPack(rootDir, config);

  console.log("Session 已開始：" + sessionId);
  console.log("Agent：" + agent);
  console.log("Task：" + task);
  console.log("");
  console.log("請先讀 AI_CONTEXT/CONTEXT_PACK.md 再開始工作。");
}

// ---------------------------------------------------------------------
// record
// ---------------------------------------------------------------------

const SECTION_HEADING_BY_TYPE = {
  fact: "Pending Facts",
  decision: "Pending Decisions",
  issue: "Pending Issues",
  experiment: "Pending Experiments"
};

function insertUnderSection(text, sectionHeading, block) {
  const marker = "## " + sectionHeading;
  const markerIndex = text.indexOf(marker);

  if (markerIndex === -1) {
    return text.trimEnd() + "\n\n" + marker + "\n\n" + block + "\n";
  }

  const afterMarker = markerIndex + marker.length;
  const nextSectionIndex = text.indexOf("\n## ", afterMarker);
  const insertAt = nextSectionIndex === -1 ? text.length : nextSectionIndex;

  const before = text.slice(0, insertAt).trimEnd();
  const after = text.slice(insertAt);
  return before + "\n\n" + block + "\n" + after;
}

function appendPendingCandidate(rootDir, type, fields) {
  const paths = getPaths(rootDir);
  const existing = readFileIfExists(paths.pendingFile) || PENDING_TEMPLATE;
  const candidateId = nextCandidateId(existing);

  const fileLines = fields.files.length
    ? "- Files:\n" + fields.files.map(function (f) { return "  - " + f; }).join("\n")
    : "- Files: (none)";

  const block = [
    "### " + candidateId,
    "- Type: " + type,
    "- Status: pending",
    "- Created: " + new Date().toISOString(),
    "- Session: " + (fields.sessionId || "(none)"),
    "- Scope: " + (fields.scope || ""),
    "- Summary: " + fields.summary,
    "- Reason: " + (fields.reason || ""),
    fileLines
  ].join("\n");

  const updated = insertUnderSection(existing, SECTION_HEADING_BY_TYPE[type], block);
  writeFile(paths.pendingFile, updated);
  return candidateId;
}

function cmdRecord(rootDir, positional, flags) {
  const type = positional[0];
  const allTypes = CANDIDATE_TYPES.concat(LOG_ONLY_TYPES);

  if (!type || allTypes.indexOf(type) === -1) {
    fail("record 需要一個合法的子指令：" + allTypes.join(" / "));
    return;
  }

  const summary = asString(flags.summary).trim();
  if (!summary) {
    fail("record " + type + " 需要 --summary，且不可為空");
    return;
  }

  const reason = asString(flags.reason).trim();
  if (type === "decision" && !reason) {
    fail("record decision 必須提供 --reason");
    return;
  }

  const paths = getPaths(rootDir);
  const session = readJsonIfExists(paths.currentSessionFile);
  const sessionId = session ? session.sessionId : null;
  const agent = session ? session.agent : null;
  const files = asArray(flags.file).map(asString);
  const scope = asString(flags.scope);

  const ledgerType = CANDIDATE_TYPES.indexOf(type) !== -1 ? type + "_candidate" : type;
  const event = appendEvent(rootDir, {
    type: ledgerType,
    sessionId,
    agent,
    scope: scope ? [scope] : [],
    summary,
    reason,
    relatedFiles: files
  });

  let candidateId = null;
  if (CANDIDATE_TYPES.indexOf(type) !== -1) {
    candidateId = appendPendingCandidate(rootDir, type, { sessionId, scope, summary, reason, files });
    // 新 pending candidate 要能立刻在 Context Pack 看到，不用等下一次
    // start/close 才刷新——不然同一個 session 裡連續 record 好幾筆，
    // Context Pack 會一直是舊的。
    const config = readJsonIfExists(paths.configFile) || DEFAULT_CONFIG;
    buildContextPack(rootDir, config);
  }

  console.log("已記錄 " + ledgerType + "（event " + event.eventId + "）" + (candidateId ? "，Pending ID：" + candidateId : ""));
}

// ---------------------------------------------------------------------
// close
// ---------------------------------------------------------------------

function formatListField(label, values) {
  if (!values.length) return "- **" + label + "**：無";
  return "- **" + label + "**：\n" + values.map(function (v) { return "  - " + v; }).join("\n");
}

function cmdClose(rootDir, flags) {
  const paths = getPaths(rootDir);
  const session = readJsonIfExists(paths.currentSessionFile);

  if (!session) {
    fail("目前沒有 active session，無法 close。先執行 `memory.mjs start`。");
    return;
  }

  const done = asArray(flags.done).map(asString);
  const changed = asArray(flags.changed).map(asString);
  const validation = asArray(flags.validation).map(asString);
  const next = asArray(flags.next).map(asString);
  const issues = asArray(flags.issue).map(asString);

  appendEvent(rootDir, {
    type: "session_closed",
    sessionId: session.sessionId,
    agent: session.agent,
    summary: done.join("; ") || session.task
  });

  const closedAt = new Date().toISOString();
  const entry = [
    "## " + session.sessionId + " — " + closedAt + " — " + session.agent,
    "",
    "- **Task**：" + session.task,
    formatListField("Done", done),
    formatListField("Changed files", changed),
    formatListField("Validation", validation),
    formatListField("Next", next),
    formatListField("New issues", issues),
    ""
  ].join("\n");

  prependAfterFirstDivider(paths.sessionLogFile, entry);

  const pendingIds = issues.map(function (issueSummary) {
    return appendPendingCandidate(rootDir, "issue", {
      sessionId: session.sessionId,
      scope: "",
      summary: issueSummary,
      reason: "close 指令的 --issue 自動建立",
      files: []
    });
  });
  issues.forEach(function (issueSummary, index) {
    appendEvent(rootDir, {
      type: "issue_candidate",
      sessionId: session.sessionId,
      agent: session.agent,
      summary: issueSummary,
      metadata: { pendingId: pendingIds[index] }
    });
  });

  removeFileIfExists(paths.currentSessionFile);

  const config = readJsonIfExists(paths.configFile) || DEFAULT_CONFIG;
  buildContextPack(rootDir, config);

  console.log("Session 已結束：" + session.sessionId);
  console.log("已寫入 AI_CONTEXT/SESSION_LOG.md");
  if (pendingIds.length) console.log("新增 pending issue：" + pendingIds.join(", "));
}

// ---------------------------------------------------------------------
// check
// ---------------------------------------------------------------------

function cmdCheck(rootDir) {
  const { results, hasError } = runAllChecks(rootDir);

  const counts = { PASS: 0, WARNING: 0, ERROR: 0 };
  results.forEach(function (r) {
    counts[r.level] = (counts[r.level] || 0) + 1;
    console.log("[" + r.level + "] " + r.message);
  });

  console.log("");
  console.log("PASS: " + counts.PASS + "  WARNING: " + counts.WARNING + "  ERROR: " + counts.ERROR);

  if (hasError) {
    process.exitCode = 1;
  }
}

// ---------------------------------------------------------------------
// status
// ---------------------------------------------------------------------

function cmdStatus(rootDir) {
  const paths = getPaths(rootDir);
  const projectName = path.basename(paths.root);
  const session = readJsonIfExists(paths.currentSessionFile);

  const sessionLogText = readFileIfExists(paths.sessionLogFile) || "";
  const firstSessionHeading = sessionLogText.match(/^## (.+)$/m);

  const pendingText = readFileIfExists(paths.pendingFile) || "";
  // 只數真實條目（標題是純數字 PEND-NNN），範本裡的格式範例標題是
  // 非數字的 "PEND-NNN" 字面量，不會被 \d+ 比對到。
  const pendingTotal = [...pendingText.matchAll(/### PEND-(\d+)[^]*?(?=\n### PEND-\d+|\n## |$)/g)]
    .filter(function (m) { return /-\s*Status:\s*pending/i.test(m[0]); }).length;

  const decisionsText = readFileIfExists(paths.decisionsFile) || "";
  const structuredActive = [...decisionsText.matchAll(/^## DEC-\d+[\s\S]*?-\s*Status:\s*active/gim)].length;

  const knownIssuesText = readFileIfExists(paths.knownIssuesFile) || "";
  const knownIssueCount = [...knownIssuesText.matchAll(/^## /gm)].length;

  const checkpointsText = readFileIfExists(paths.checkpointsFile) || "";
  const lastCheckpoint = checkpointsText.match(/^## (.+)$/m);

  const contextPackText = readFileIfExists(paths.contextPackFile) || "";
  const generatedAtMatch = contextPackText.match(/generatedAt:\s*([^\s-][^\n]*?)\s*-->/);

  console.log("Project: " + projectName);
  console.log("Active session: " + (session ? session.sessionId + " (" + session.agent + ")" : "none"));
  console.log("Last session log entry: " + (firstSessionHeading ? firstSessionHeading[1] : "(none)"));
  console.log("Pending candidates (status=pending): " + pendingTotal);
  console.log("Active decisions (structured DEC-NNN only): " + structuredActive);
  console.log("Known issue sections: " + knownIssueCount);
  console.log("Last checkpoint: " + (lastCheckpoint ? lastCheckpoint[1] : "(none)"));
  console.log("Context pack last generated: " + (generatedAtMatch ? generatedAtMatch[1] : "(never)"));
}

// ---------------------------------------------------------------------
// dispatch
// ---------------------------------------------------------------------

function main() {
  const [, , command, ...rest] = process.argv;
  const rootDir = getRootDir();
  const { positional, flags } = parseArgs(rest);

  switch (command) {
    case "init":
      cmdInit(rootDir);
      break;
    case "start":
      cmdStart(rootDir, flags);
      break;
    case "record":
      cmdRecord(rootDir, positional, flags);
      break;
    case "close":
      cmdClose(rootDir, flags);
      break;
    case "check":
      cmdCheck(rootDir);
      break;
    case "status":
      cmdStatus(rootDir);
      break;
    default:
      console.error("用法：node tools/project-memory/memory.mjs <init|start|record|close|check|status> [options]");
      process.exitCode = 1;
  }
}

main();
