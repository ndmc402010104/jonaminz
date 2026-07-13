/*
檔案位置：tools/project-memory/test/memory.test.mjs
用途：Project Memory CLI 的自動化測試，用 Node.js built-in test runner
（node --test）。每個測試都在臨時目錄跑，完全不碰真實 AI_CONTEXT/——
PROJECT_MEMORY_ROOT 環境變數是 lib/files.mjs 唯一支援的 root 覆蓋方式
（見該檔案註解），CLI 本身的六個正式指令不需要知道這個變數存在。

這個測試套件本身跑在 Windows（本機開發環境）上，所以「所有路徑處理在
Windows 可正常運作」這項要求是被自然涵蓋的，不需要另外模擬 POSIX 路徑
——用的就是這台機器的真實檔案系統與 node:path 行為。
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CLI_PATH = path.join(HERE, "..", "memory.mjs");

function makeTempRoot() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pm-test-"));
  fs.mkdirSync(path.join(dir, "AI_CONTEXT"), { recursive: true });
  return dir;
}

function writeFixture(root, relPath, content) {
  const full = path.join(root, relPath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content, "utf8");
}

function readIfExists(root, relPath) {
  const full = path.join(root, relPath);
  return fs.existsSync(full) ? fs.readFileSync(full, "utf8") : null;
}

function run(root, args) {
  try {
    const stdout = execFileSync(process.execPath, [CLI_PATH, ...args], {
      env: { ...process.env, PROJECT_MEMORY_ROOT: root },
      encoding: "utf8"
    });
    return { code: 0, stdout, stderr: "" };
  } catch (error) {
    return { code: error.status ?? 1, stdout: error.stdout || "", stderr: error.stderr || "" };
  }
}

const MINIMAL_RULES = `# RULES\n\n## 一、絕對禁止事項\n\n1. 測試用禁止事項第一條。\n2. 測試用禁止事項第二條。\n`;

function seedMinimalFixtures(root) {
  writeFixture(root, "AI_CONTEXT/RULES.md", MINIMAL_RULES);
  writeFixture(root, "AI_CONTEXT/FACTS.md", "# FACTS\n\n測試事實內容。\n");
  writeFixture(root, "AI_CONTEXT/DECISIONS.md", "# DECISIONS\n\n舊格式自由文字內容。\n");
  writeFixture(root, "AI_CONTEXT/CURRENT_STATE.md", "# CURRENT_STATE\n\n測試現況內容。\n");
  writeFixture(root, "AI_CONTEXT/KNOWN_ISSUES.md", "# KNOWN_ISSUES\n\n測試已知問題。\n");
  writeFixture(root, "AI_CONTEXT/EXPERIMENTS.md", "# EXPERIMENTS\n\n測試實驗內容。\n");
  writeFixture(root, "AI_CONTEXT/SESSION_LOG.md", "# SESSION_LOG\n\n用途：測試。\n\n---\n\n## 舊 session 記錄\n\n舊內容不應被覆蓋。\n");
  writeFixture(root, "AI_CONTEXT/CHECKPOINTS.md", "# CHECKPOINTS\n\n## Checkpoint: 舊 checkpoint\n\n測試內容。\n");
}

// ---------------------------------------------------------------------
// 1. init 可重複執行
// ---------------------------------------------------------------------
test("init 可重複執行且 idempotent", () => {
  const root = makeTempRoot();
  seedMinimalFixtures(root);

  const first = run(root, ["init"]);
  assert.equal(first.code, 0, first.stderr);
  assert.match(first.stdout, /新建立/);

  const second = run(root, ["init"]);
  assert.equal(second.code, 0, second.stderr);
  assert.match(second.stdout, /新建立（0）/, "第二次執行不應該再建立任何檔案");
});

// ---------------------------------------------------------------------
// 2. 既有文件不會被覆蓋
// ---------------------------------------------------------------------
test("init 不會覆蓋既有的 PENDING.md 或 README.md 內容", () => {
  const root = makeTempRoot();
  seedMinimalFixtures(root);
  writeFixture(root, "AI_CONTEXT/PENDING.md", "# 使用者自己寫的 PENDING 內容\n\n不應被覆蓋。\n");

  run(root, ["init"]);

  const pending = readIfExists(root, "AI_CONTEXT/PENDING.md");
  assert.match(pending, /使用者自己寫的 PENDING 內容/);
  assert.match(pending, /不應被覆蓋/);
});

// ---------------------------------------------------------------------
// 3. start 建立 session
// ---------------------------------------------------------------------
test("start 建立 current-session.json 與 session_started 事件", () => {
  const root = makeTempRoot();
  seedMinimalFixtures(root);
  run(root, ["init"]);

  const result = run(root, ["start", "--agent", "claude", "--task", "測試任務"]);
  assert.equal(result.code, 0, result.stderr);

  const session = JSON.parse(readIfExists(root, ".project-memory/current-session.json"));
  assert.equal(session.agent, "claude");
  assert.equal(session.task, "測試任務");
  assert.ok(session.sessionId);

  const ledger = readIfExists(root, ".project-memory/ledger.jsonl");
  const events = ledger.trim().split("\n").map((line) => JSON.parse(line));
  const started = events.find((e) => e.type === "session_started");
  assert.ok(started, "應該有 session_started 事件");
  assert.equal(started.sessionId, session.sessionId);
});

// ---------------------------------------------------------------------
// 4. 重複 start 會被阻止
// ---------------------------------------------------------------------
test("重複 start（沒有 --force）會被阻止，加 --force 才會成功", () => {
  const root = makeTempRoot();
  seedMinimalFixtures(root);
  run(root, ["init"]);
  run(root, ["start", "--agent", "claude", "--task", "第一輪"]);

  const blocked = run(root, ["start", "--agent", "claude", "--task", "第二輪"]);
  assert.notEqual(blocked.code, 0, "沒有 --force 應該失敗");

  const forced = run(root, ["start", "--agent", "claude", "--task", "第二輪", "--force"]);
  assert.equal(forced.code, 0, forced.stderr);
  const session = JSON.parse(readIfExists(root, ".project-memory/current-session.json"));
  assert.equal(session.task, "第二輪");
});

// ---------------------------------------------------------------------
// 5. record decision 缺 reason 時失敗
// ---------------------------------------------------------------------
test("record decision 缺 --reason 時失敗，且不寫入 PENDING", () => {
  const root = makeTempRoot();
  seedMinimalFixtures(root);
  run(root, ["init"]);
  run(root, ["start", "--agent", "claude", "--task", "測試"]);

  const result = run(root, ["record", "decision", "--summary", "沒有理由的決策"]);
  assert.notEqual(result.code, 0);

  const pending = readIfExists(root, "AI_CONTEXT/PENDING.md");
  assert.doesNotMatch(pending, /沒有理由的決策/);
});

// ---------------------------------------------------------------------
// 6. record 會同時寫入 ledger 與 Pending
// ---------------------------------------------------------------------
test("record fact 同時寫入 ledger.jsonl 與 PENDING.md", () => {
  const root = makeTempRoot();
  seedMinimalFixtures(root);
  run(root, ["init"]);
  run(root, ["start", "--agent", "claude", "--task", "測試"]);

  const result = run(root, ["record", "fact", "--scope", "theme", "--summary", "測試事實內容XYZ"]);
  assert.equal(result.code, 0, result.stderr);

  const ledger = readIfExists(root, ".project-memory/ledger.jsonl");
  const events = ledger.trim().split("\n").map((line) => JSON.parse(line));
  assert.ok(events.some((e) => e.type === "fact_candidate" && e.summary === "測試事實內容XYZ"));

  const pending = readIfExists(root, "AI_CONTEXT/PENDING.md");
  assert.match(pending, /測試事實內容XYZ/);
  assert.match(pending, /PEND-001/);
});

// ---------------------------------------------------------------------
// 7. close 會 append Session Log
// ---------------------------------------------------------------------
test("close 會把新記錄加在 SESSION_LOG.md 最上面，不覆蓋舊內容", () => {
  const root = makeTempRoot();
  seedMinimalFixtures(root);
  run(root, ["init"]);
  run(root, ["start", "--agent", "claude", "--task", "測試"]);

  const result = run(root, ["close", "--done", "完成測試", "--next", "下一步"]);
  assert.equal(result.code, 0, result.stderr);

  const log = readIfExists(root, "AI_CONTEXT/SESSION_LOG.md");
  assert.match(log, /完成測試/);
  assert.match(log, /舊 session 記錄/, "舊內容應該還在");
  assert.match(log, /舊內容不應被覆蓋/);

  const completedIndex = log.indexOf("完成測試");
  const oldIndex = log.indexOf("舊 session 記錄");
  assert.ok(completedIndex < oldIndex, "新記錄應該在舊記錄上面");
});

// ---------------------------------------------------------------------
// 8. close 後清除 active session
// ---------------------------------------------------------------------
test("close 後 current-session.json 被刪除", () => {
  const root = makeTempRoot();
  seedMinimalFixtures(root);
  run(root, ["init"]);
  run(root, ["start", "--agent", "claude", "--task", "測試"]);
  assert.ok(fs.existsSync(path.join(root, ".project-memory", "current-session.json")));

  run(root, ["close", "--done", "完成"]);
  assert.equal(fs.existsSync(path.join(root, ".project-memory", "current-session.json")), false);
});

// ---------------------------------------------------------------------
// 9. Context Pack 不包含 superseded decisions
// ---------------------------------------------------------------------
test("Context Pack 的 Active Decisions 只列 active，不列 superseded", () => {
  const root = makeTempRoot();
  seedMinimalFixtures(root);
  writeFixture(
    root,
    "AI_CONTEXT/DECISIONS.md",
    [
      "# DECISIONS",
      "",
      "## DEC-001: 現行有效的決策",
      "- Date: 2026-07-13",
      "- Status: active",
      "- Scope: test",
      "- Decision: 這條應該出現在 Context Pack。",
      "",
      "## DEC-002: 已被取代的舊決策",
      "- Date: 2026-07-01",
      "- Status: superseded",
      "- Scope: test",
      "- Decision: 這條不應該出現在 Context Pack。",
      ""
    ].join("\n")
  );

  run(root, ["init"]);
  const pack = readIfExists(root, "AI_CONTEXT/CONTEXT_PACK.md");

  assert.match(pack, /DEC-001/);
  assert.match(pack, /現行有效的決策/);
  assert.doesNotMatch(pack, /DEC-002/);
  assert.doesNotMatch(pack, /已被取代的舊決策/);
});

// ---------------------------------------------------------------------
// 10. Context Pack 將 pending 標示為未確認
// ---------------------------------------------------------------------
test("Context Pack 的 Pending Candidates 區塊清楚標示未確認", () => {
  const root = makeTempRoot();
  seedMinimalFixtures(root);
  run(root, ["init"]);
  run(root, ["start", "--agent", "claude", "--task", "測試"]);
  run(root, ["record", "decision", "--summary", "待確認的決策內容", "--reason", "測試理由"]);

  const pack = readIfExists(root, "AI_CONTEXT/CONTEXT_PACK.md");
  const pendingSectionStart = pack.indexOf("## Pending Candidates");
  const nextSectionStart = pack.indexOf("## Agent Instructions");
  const pendingSection = pack.slice(pendingSectionStart, nextSectionStart);

  assert.match(pendingSection, /待確認的決策內容/);
  assert.match(pendingSection, /PEND-001/);
  assert.match(pendingSection, /\[decision\]/);
});

// ---------------------------------------------------------------------
// 11. check 能抓到損壞的 JSONL
// ---------------------------------------------------------------------
test("check 能抓到損壞的 ledger.jsonl 並回傳非 0 exit code", () => {
  const root = makeTempRoot();
  seedMinimalFixtures(root);
  run(root, ["init"]);

  fs.appendFileSync(path.join(root, ".project-memory", "ledger.jsonl"), "這不是合法 JSON\n", "utf8");

  const result = run(root, ["check"]);
  assert.notEqual(result.code, 0);
  assert.match(result.stdout, /ERROR/);
  assert.match(result.stdout, /不是合法 JSON/);
});

// ---------------------------------------------------------------------
// 12. check 能警告疑似 secret
// ---------------------------------------------------------------------
test("check 能警告 .project-memory 內疑似 secret 字串", () => {
  const root = makeTempRoot();
  seedMinimalFixtures(root);
  run(root, ["init"]);

  const configPath = path.join(root, ".project-memory", "config.json");
  const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  config.leakedForTest = "sk-proj-abcdefghijklmnopqrstuvwxyz1234567890";
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf8");

  const result = run(root, ["check"]);
  assert.match(result.stdout, /WARNING.*secret/);
});

// ---------------------------------------------------------------------
// 13. 所有路徑處理在 Windows 可正常運作
// ---------------------------------------------------------------------
test("在巢狀含空白的 Windows 路徑下也能正常運作", () => {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "pm test space "));
  const root = path.join(parent, "nested dir", "repo");
  fs.mkdirSync(path.join(root, "AI_CONTEXT"), { recursive: true });
  seedMinimalFixtures(root);

  const result = run(root, ["init"]);
  assert.equal(result.code, 0, result.stderr);
  assert.ok(fs.existsSync(path.join(root, "AI_CONTEXT", "CONTEXT_PACK.md")));
});

// ---------------------------------------------------------------------
// 14. 中文內容不亂碼
// ---------------------------------------------------------------------
test("中文內容在 ledger、PENDING、SESSION_LOG 往返都不亂碼", () => {
  const root = makeTempRoot();
  seedMinimalFixtures(root);
  run(root, ["init"]);
  run(root, ["start", "--agent", "claude", "--task", "測試繁體中文與符號「」、。！？"]);
  run(root, ["record", "issue", "--summary", "已知問題：登入頁在窄螢幕下按鈕會被截斷"]);
  run(root, ["close", "--done", "完成中文驗證：核准／否決流程正常"]);

  const session = readIfExists(root, ".project-memory/ledger.jsonl");
  assert.match(session, /測試繁體中文與符號「」、。！？/);
  assert.match(session, /已知問題：登入頁在窄螢幕下按鈕會被截斷/);

  const pending = readIfExists(root, "AI_CONTEXT/PENDING.md");
  assert.match(pending, /已知問題：登入頁在窄螢幕下按鈕會被截斷/);

  const log = readIfExists(root, "AI_CONTEXT/SESSION_LOG.md");
  assert.match(log, /完成中文驗證：核准／否決流程正常/);
});
