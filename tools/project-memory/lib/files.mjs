/*
檔案位置：tools/project-memory/lib/files.mjs
用途：Project Memory 工具的路徑解析與檔案讀寫工具，全部是純 Node.js
built-in（fs/path/url），不依賴任何 npm package。

Root 解析：預設用這個檔案自己的位置往上兩層算出 repo root
（tools/project-memory/lib/ -> repo root），測試時可以用環境變數
PROJECT_MEMORY_ROOT 覆蓋，指到臨時目錄——這是唯一的例外路徑，CLI 六個
正式指令（init/start/record/close/check/status）本身完全不需要知道
這個變數存在。
*/
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

export function getRootDir() {
  if (process.env.PROJECT_MEMORY_ROOT) {
    return path.resolve(process.env.PROJECT_MEMORY_ROOT);
  }
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, "..", "..", "..");
}

export function getPaths(rootDir) {
  const root = rootDir || getRootDir();
  const aiContext = path.join(root, "AI_CONTEXT");
  const memoryDir = path.join(root, ".project-memory");

  return {
    root,
    aiContext,
    memoryDir,
    factsFile: path.join(aiContext, "FACTS.md"),
    decisionsFile: path.join(aiContext, "DECISIONS.md"),
    currentStateFile: path.join(aiContext, "CURRENT_STATE.md"),
    knownIssuesFile: path.join(aiContext, "KNOWN_ISSUES.md"),
    experimentsFile: path.join(aiContext, "EXPERIMENTS.md"),
    sessionLogFile: path.join(aiContext, "SESSION_LOG.md"),
    checkpointsFile: path.join(aiContext, "CHECKPOINTS.md"),
    pendingFile: path.join(aiContext, "PENDING.md"),
    contextPackFile: path.join(aiContext, "CONTEXT_PACK.md"),
    aiContextReadmeFile: path.join(aiContext, "README.md"),
    rulesFile: path.join(aiContext, "RULES.md"),
    configFile: path.join(memoryDir, "config.json"),
    ledgerFile: path.join(memoryDir, "ledger.jsonl"),
    currentSessionFile: path.join(memoryDir, "current-session.json"),
    snapshotsDir: path.join(memoryDir, "snapshots"),
    gitignoreFile: path.join(root, ".gitignore"),
    agentsFile: path.join(root, "AGENTS.md"),
    claudeFile: path.join(root, "CLAUDE.md")
  };
}

export function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

export function exists(filePath) {
  return fs.existsSync(filePath);
}

export function readFileIfExists(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return fs.readFileSync(filePath, "utf8");
}

/**
 * 只在檔案不存在時才寫入——正式真相文件的既有內容永遠不被覆蓋，這是
 * init 指令可重複執行、且不破壞既有內容的核心保證。
 * 回傳 true = 真的建立了新檔案，false = 檔案已存在、跳過。
 */
export function writeFileIfMissing(filePath, content) {
  if (fs.existsSync(filePath)) return false;
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, content, "utf8");
  return true;
}

export function writeFile(filePath, content) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, content, "utf8");
}

export function appendLine(filePath, line) {
  ensureDir(path.dirname(filePath));
  const text = line.endsWith("\n") ? line : line + "\n";
  fs.appendFileSync(filePath, text, "utf8");
}

/** 把新內容插在檔案「第一個 --- 分隔線」之後——本專案 AI_CONTEXT 文件
 * 一貫的「新紀錄加在最上面」慣例（見 CHANGELOG.md／SESSION_LOG.md 檔頭
 * 規則），找不到分隔線就直接附加在檔尾，不猜測結構。 */
export function prependAfterFirstDivider(filePath, entryMarkdown) {
  const existing = readFileIfExists(filePath) || "";
  const dividerIndex = existing.indexOf("\n---\n");

  if (dividerIndex === -1) {
    const combined = existing.trimEnd() + "\n\n" + entryMarkdown.trimEnd() + "\n";
    writeFile(filePath, combined);
    return;
  }

  const insertAt = dividerIndex + "\n---\n".length;
  const before = existing.slice(0, insertAt);
  const after = existing.slice(insertAt);
  const combined = before + "\n" + entryMarkdown.trimEnd() + "\n" + after;
  writeFile(filePath, combined);
}

export function readJsonIfExists(filePath) {
  const text = readFileIfExists(filePath);
  if (text === null) return null;
  return JSON.parse(text);
}

export function writeJson(filePath, value) {
  writeFile(filePath, JSON.stringify(value, null, 2) + "\n");
}

export function removeFileIfExists(filePath) {
  if (fs.existsSync(filePath)) fs.rmSync(filePath);
}
