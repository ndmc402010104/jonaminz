/*
檔案位置：tools/project-memory/lib/context.mjs
用途：產生 AI_CONTEXT/CONTEXT_PACK.md——唯一的自動產物，內容全部用
確定性文字截取／規則式解析組成，不呼叫任何 LLM、不做語意摘要。相同
輸入永遠產生相同輸出（除了 generatedAt 時間戳本身）。

分節與截斷預算（見 README「Context Pack 規則」）：字數超過
config.contextMaxCharacters 時，依優先序（Critical Rules > Active
Decisions > Current State > Known Issues > 其餘）由低優先度往高優先度
依序砍到符合預算，這個順序在 DEFAULT_BUDGETS 與 TRIM_ORDER 兩個常數
裡實作。
*/
import path from "node:path";
import { getPaths, readFileIfExists, writeFile, readJsonIfExists } from "./files.mjs";

const DEFAULT_BUDGETS = {
  criticalRules: 3000,
  activeDecisions: 6000,
  currentState: 5000,
  knownIssues: 3000,
  confirmedFacts: 3000,
  recentCheckpoints: 2000,
  recentSessions: 2500,
  pendingCandidates: 2000
};

// 超出總預算時，由左到右依序砍（低優先度先砍），直到符合
// config.contextMaxCharacters。跟 DEFAULT_BUDGETS 的 key 對應。
const TRIM_ORDER = [
  "pendingCandidates",
  "recentSessions",
  "recentCheckpoints",
  "confirmedFacts",
  "knownIssues",
  "currentState",
  "activeDecisions",
  "criticalRules"
];

function stripLeadingTitle(text) {
  return (text || "").replace(/^#[^\n]*\n+/, "");
}

/** 截斷核心邏輯，不處理標題——供 truncateBody（會先剝掉檔案自己的
 * `# Title` 行）與 truncatePlain（給已經是二次組合過、第一行本身就是
 * 有意義內容的文字用，例如 extractActiveDecisions 組出來的
 * `## DEC-001: ...` 區塊，不能被當成「檔案標題」誤刪）共用。 */
function truncateCore(body, maxChars, sourceLabel) {
  if (!body) return "_（無內容）_";
  if (body.length <= maxChars) return body;

  const cut = body.slice(0, maxChars);
  const lastNewline = cut.lastIndexOf("\n");
  const safe = lastNewline > maxChars * 0.5 ? cut.slice(0, lastNewline) : cut;
  return safe.trim() + "\n\n…（已截斷，`" + sourceLabel + "` 原始內容共 " + body.length + " 字元，完整內容請直接讀取該檔案）";
}

/** 一般用途的確定性截斷：從檔案內容取前 maxChars 字元，在最後一個換行
 * 處收尾（避免斷在句子中間），超出時附上截斷提示與完整字數。會先剝掉
 * 檔案自己的 `# Title` 行（假設輸入是原始檔案內容）。 */
function truncateBody(text, maxChars, sourceLabel) {
  return truncateCore(stripLeadingTitle(text || "").trim(), maxChars, sourceLabel);
}

/** 跟 truncateBody 一樣的截斷邏輯，但不剝除第一行——用在輸入已經是
 * 組合好的區塊（第一行是刻意保留的 `## DEC-NNN` 標題，不是檔案標題）。 */
function truncatePlain(text, maxChars, sourceLabel) {
  return truncateCore((text || "").trim(), maxChars, sourceLabel);
}

function splitByHeading(text, level) {
  const marker = "#".repeat(level) + " ";
  const lines = (text || "").split("\n");
  const blocks = [];
  let current = null;

  lines.forEach(function (line) {
    if (line.indexOf(marker) === 0) {
      if (current) blocks.push(current);
      current = { heading: line.slice(marker.length).trim(), lines: [line] };
    } else if (current) {
      current.lines.push(line);
    }
  });
  if (current) blocks.push(current);

  return blocks.map(function (b) {
    return { heading: b.heading, body: b.lines.join("\n") };
  });
}

/** DECISIONS.md 若已經有 `## DEC-NNN: 標題` + `- Status: active` 這種
 * 結構化格式，就精準挑出 active 決策；本專案現有 DECISIONS.md 目前是
 * 自由文字記述（見 AI_CONTEXT/RULES.md 慣例），掃不到任何一筆時明確
 * 說明「改用文字截取」，不是假裝解析成功。這是刻意的誠實備援，不是
 * bug。 */
function extractActiveDecisions(text, maxChars, sourceLabel) {
  const blocks = splitByHeading(text, 2).filter(function (b) {
    return /^DEC-\d+/.test(b.heading);
  });

  if (!blocks.length) {
    return (
      "_（`" + sourceLabel + "` 目前沒有 `## DEC-NNN` 結構化決策條目" +
      "（自由文字記述格式），以下改用確定性文字截取，不是結構化清單）_\n\n" +
      truncateBody(text, maxChars, sourceLabel)
    );
  }

  const active = blocks.filter(function (b) {
    return /-\s*Status:\s*active/i.test(b.body);
  });

  if (!active.length) {
    return "_（掃描到 " + blocks.length + " 筆結構化決策，但沒有任何一筆 Status 是 active）_";
  }

  const combined = active
    .map(function (b) { return "## " + b.heading + "\n" + b.body.split("\n").slice(1).join("\n").trim(); })
    .join("\n\n");

  return truncatePlain(combined, maxChars, sourceLabel);
}

function extractRecentSessions(text, count, totalMaxChars, sourceLabel) {
  const blocks = splitByHeading(text, 2).slice(0, count);
  if (!blocks.length) return "_（`" + sourceLabel + "` 尚無任何 session 記錄）_";

  const perEntryCap = Math.max(200, Math.floor(totalMaxChars / blocks.length));
  const combined = blocks
    .map(function (b) { return truncatePlain("## " + b.heading + "\n" + b.body.split("\n").slice(1).join("\n"), perEntryCap, sourceLabel); })
    .join("\n\n");

  return truncatePlain(combined, totalMaxChars, sourceLabel);
}

/** PENDING.md 是這個工具自己定義並唯一寫入的格式（見
 * lib/pending.mjs 沒有獨立檔案——寫入邏輯在 memory.mjs 的 record
 * 指令），所以這裡可以放心做精準結構化解析，不用像 DECISIONS.md
 * 那樣要有文字截取備援。 */
function extractPendingCandidates(text, maxChars, sourceLabel) {
  const blocks = splitByHeading(text, 3).filter(function (b) {
    return /^PEND-\d+/.test(b.heading);
  });

  const pending = blocks.filter(function (b) {
    return /-\s*Status:\s*pending/i.test(b.body);
  });

  if (!pending.length) return "_（目前沒有待確認的候選內容）_";

  const lines = pending.map(function (b) {
    // 值可能是空字串（例如 Scope 沒填）：用 [^\S\r\n]（同一行內的空白，
    // 不含換行）而不是 \s，避免空值時貪婪跨行吃到下一個欄位的值。
    // (.*) 而非 (.+)，允許空字串合法匹配。
    const typeMatch = b.body.match(/^-[^\S\r\n]*Type:[^\S\r\n]*(\S*)/mi);
    const scopeMatch = b.body.match(/^-[^\S\r\n]*Scope:[^\S\r\n]*(.*)$/mi);
    const summaryMatch = b.body.match(/^-[^\S\r\n]*Summary:[^\S\r\n]*(.*)$/mi);
    const type = typeMatch && typeMatch[1] ? typeMatch[1] : "unknown";
    const scope = scopeMatch ? scopeMatch[1].trim() : "";
    const summary = summaryMatch ? summaryMatch[1].trim() : "";
    return "- **" + b.heading + "** [" + type + "]" + (scope ? " (" + scope + ")" : "") + " — " + summary;
  });

  return truncateBody(lines.join("\n"), maxChars, sourceLabel);
}

function extractCriticalRules(text, maxChars, sourceLabel) {
  const blocks = splitByHeading(text, 2);
  const forbidden = blocks.find(function (b) { return b.heading.indexOf("絕對禁止") !== -1; });
  if (!forbidden) return truncateBody(text, maxChars, sourceLabel);
  return truncateBody(forbidden.body.split("\n").slice(1).join("\n"), maxChars, sourceLabel);
}

const AGENT_INSTRUCTIONS = [
  "- 不得重新打開已裁決且仍為 active 的決策，除非使用者明確要求。",
  "- 不得把 Pending 或 Experiment 當成正式規則。",
  "- 不得宣稱尚未驗證的功能已完成。",
  "- 修改前先確認 CURRENT_STATE、KNOWN_ISSUES 與 CHECKPOINTS。",
  "- 發現文件與程式碼不一致時，先記錄衝突，不得自行選擇方便的版本。",
  "- 新事實與新決策先進入 Pending。",
  "- 結束工作前必須更新 Session Log 並執行 memory:check。"
].join("\n");

export function buildContextPack(rootDir, options) {
  const paths = getPaths(rootDir);
  const config = readJsonIfExists(paths.configFile) || {};
  const maxChars = (options && options.contextMaxCharacters) || config.contextMaxCharacters || 24000;
  const recentSessionCount = (options && options.recentSessionCount) || config.recentSessionCount || 5;

  const session = readJsonIfExists(paths.currentSessionFile);
  const projectName = path.basename(paths.root);

  const sections = {
    criticalRules: extractCriticalRules(readFileIfExists(paths.rulesFile), DEFAULT_BUDGETS.criticalRules, "AI_CONTEXT/RULES.md"),
    confirmedFacts: truncateBody(readFileIfExists(paths.factsFile), DEFAULT_BUDGETS.confirmedFacts, "AI_CONTEXT/FACTS.md"),
    activeDecisions: extractActiveDecisions(readFileIfExists(paths.decisionsFile), DEFAULT_BUDGETS.activeDecisions, "AI_CONTEXT/DECISIONS.md"),
    currentState: truncateBody(readFileIfExists(paths.currentStateFile), DEFAULT_BUDGETS.currentState, "AI_CONTEXT/CURRENT_STATE.md"),
    knownIssues: truncateBody(readFileIfExists(paths.knownIssuesFile), DEFAULT_BUDGETS.knownIssues, "AI_CONTEXT/KNOWN_ISSUES.md"),
    recentCheckpoints: truncateBody(readFileIfExists(paths.checkpointsFile), DEFAULT_BUDGETS.recentCheckpoints, "AI_CONTEXT/CHECKPOINTS.md"),
    recentSessions: extractRecentSessions(readFileIfExists(paths.sessionLogFile), recentSessionCount, DEFAULT_BUDGETS.recentSessions, "AI_CONTEXT/SESSION_LOG.md"),
    pendingCandidates: extractPendingCandidates(readFileIfExists(paths.pendingFile), DEFAULT_BUDGETS.pendingCandidates, "AI_CONTEXT/PENDING.md")
  };

  // 總長度超過預算時，依 TRIM_ORDER（低優先度先犧牲）逐段砍到一半、
  // 一半、一半…直到符合，最多砍 6 輪避免無窮迴圈（實務上 2-3 輪就會
  // 收斂，6 輪是保守上限）。
  function currentTotalLength() {
    return Object.keys(sections).reduce(function (sum, key) { return sum + sections[key].length; }, 0) + 1500;
  }

  let rounds = 0;
  while (currentTotalLength() > maxChars && rounds < 6) {
    for (const key of TRIM_ORDER) {
      if (currentTotalLength() <= maxChars) break;
      if (sections[key].length < 200) continue;
      sections[key] = sections[key].slice(0, Math.floor(sections[key].length / 2)).trim() +
        "\n\n…（因總字數預算限制被進一步截斷）";
    }
    rounds += 1;
  }

  const activeTask = session
    ? "- Session ID: " + session.sessionId + "\n- Agent: " + session.agent + "\n- Task: " + session.task + "\n- Started: " + session.startedAt
    : "_（目前沒有 active session，先執行 `memory.mjs start` 再開始工作）_";

  const generatedAt = new Date().toISOString();

  const content = [
    "<!-- AUTO-GENERATED. DO NOT EDIT DIRECTLY. -->",
    "<!-- generatedAt: " + generatedAt + " -->",
    "",
    "# PROJECT CONTEXT",
    "",
    "## Project",
    "",
    projectName,
    "",
    "## Active Task",
    "",
    activeTask,
    "",
    "## Critical Rules",
    "",
    sections.criticalRules,
    "",
    "## Confirmed Facts",
    "",
    sections.confirmedFacts,
    "",
    "## Active Decisions",
    "",
    sections.activeDecisions,
    "",
    "## Current State",
    "",
    sections.currentState,
    "",
    "## Known Issues",
    "",
    sections.knownIssues,
    "",
    "## Recent Checkpoints",
    "",
    sections.recentCheckpoints,
    "",
    "## Recent Sessions",
    "",
    sections.recentSessions,
    "",
    "## Pending Candidates",
    "",
    sections.pendingCandidates,
    "",
    "## Agent Instructions",
    "",
    AGENT_INSTRUCTIONS,
    ""
  ].join("\n");

  writeFile(paths.contextPackFile, content);
  return content;
}
