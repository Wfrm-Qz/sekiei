/**
 * 公開前に、tracked file に internal path、機密らしい文字列、生成物が混ざっていないかを確認する。
 * ここでは軽い静的検査だけを行い、lint / test / build は package script 側で続けて実行する。
 */

import { readFileSync } from "node:fs";
import { extname } from "node:path";
import { spawnSync } from "node:child_process";

function runGit(args) {
  const result = spawnSync("git", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.status !== 0) {
    throw new Error(result.stderr || `git ${args.join(" ")} failed`);
  }
  return result.stdout;
}

function getTrackedFiles() {
  return runGit(["ls-files", "-z"]).split("\0").filter(Boolean).sort();
}

function isTextLike(file) {
  const extension = extname(file).toLowerCase();
  return new Set([
    "",
    ".css",
    ".d.ts",
    ".html",
    ".js",
    ".json",
    ".md",
    ".mjs",
    ".ps1",
    ".ts",
    ".txt",
    ".yaml",
    ".yml",
  ]).has(extension);
}

const trackedFiles = getTrackedFiles();

const generatedPathPatterns = [
  /(^|\/)dist(\/|$)/,
  /(^|\/)coverage(\/|$)/,
  /(^|\/)node_modules(\/|$)/,
  /(^|\/)playwright-report(\/|$)/,
  /(^|\/)test-results(\/|$)/,
  /(^|\/)temp(\/|$)/,
  /(^|\/)tasks(\/|$)/,
  /(^|\/)(server|server-error|dev|dev-error)\.log$/,
];

const textPatterns = [
  {
    label: "old or local workspace path",
    pattern: /C:[/\\]work[/\\]/i,
  },
  {
    label: "internal repo name",
    pattern: /\b[a-z0-9][a-z0-9-]*-internal\b/i,
  },
  {
    label: "local Windows user path",
    pattern: /C:[/\\]Users[/\\]/i,
  },
  {
    label: "personal user or machine marker",
    pattern: /\b(Shohei Hashimoto|YAMATO\\|CodexSandboxOffline)\b/i,
  },
  {
    label: "private key block",
    pattern: /-----BEGIN (RSA |OPENSSH |EC |DSA |)?PRIVATE KEY-----/,
  },
  {
    label: "authorization bearer token",
    pattern: /\bAuthorization:\s*Bearer\s+\S+/i,
  },
  {
    label: "likely secret assignment",
    pattern:
      /\b(API[_-]?KEY|SECRET|PASSWORD|ACCESS[_-]?TOKEN|AUTH[_-]?TOKEN)\s*[:=]\s*['"]?[A-Za-z0-9_./+=-]{12,}/i,
  },
];

const failures = [];

for (const file of trackedFiles) {
  for (const pattern of generatedPathPatterns) {
    if (pattern.test(file)) {
      failures.push(`${file}: generated or private path is tracked`);
      break;
    }
  }

  if (!isTextLike(file) || file === "scripts/check-public-ready.mjs") {
    continue;
  }

  let content;
  try {
    content = readFileSync(file, "utf8");
  } catch (error) {
    failures.push(`${file}: failed to read as text (${error.message})`);
    continue;
  }

  for (const { label, pattern } of textPatterns) {
    const match = content.match(pattern);
    if (match) {
      failures.push(`${file}: ${label}: ${match[0]}`);
    }
  }
}

if (failures.length > 0) {
  console.error("[public-check] 公開前チェックで問題候補を検出しました:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("[public-check] tracked files look public-ready.");
