/**
 * このスクリプトは、変更ファイル単位で Prettier / ESLint / Stylelint /
 * html-validate / TypeScript typecheck を振り分けて実行する。
 * 既存の repo 全体 lint を毎回走らせると古い違反に巻き込まれるため、
 * 作業完了前の安全な最小スコープ検証を優先するために使う。
 */

import { existsSync } from "node:fs";
import { dirname, extname, isAbsolute, relative, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");
const isWindows = process.platform === "win32";
const selfRelativePath = relative(repoRoot, fileURLToPath(import.meta.url));

/**
 * ローカル依存の実行ファイルパスを返す。
 * npm 経由だと環境依存で失敗することがあるため、repo-local bin を優先する。
 */
function getLocalBin(name) {
  return resolve(
    repoRoot,
    "node_modules",
    ".bin",
    isWindows ? `${name}.cmd` : name,
  );
}

/**
 * コマンドを同期実行し、失敗時は即座に終了コードを伝播する。
 * 標準出力はそのまま表示して、最終報告しやすいよう実行コマンドも出す。
 */
function runStep(command, args) {
  const printable = [command, ...args].join(" ");
  console.log(`\n[lint-on-change] ${printable}`);
  const shouldUseCmdWrapper =
    isWindows && command.toLowerCase().endsWith(".cmd");
  const result = shouldUseCmdWrapper
    ? spawnSync(command, args, {
        cwd: repoRoot,
        stdio: "inherit",
        shell: true,
      })
    : spawnSync(command, args, {
        cwd: repoRoot,
        stdio: "inherit",
        shell: false,
      });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

/**
 * 引数から対象ファイルを解決する。
 * changed-file の自動検出は PowerShell ラッパー側で行い、このスクリプトは
 * 明示ファイル実行を担当する。
 */
function resolveTargetFiles(argv) {
  const filesFlagIndex = argv.indexOf("--files");
  if (filesFlagIndex >= 0) {
    return argv
      .slice(filesFlagIndex + 1)
      .filter((value) => !value.startsWith("--"));
  }

  return [];
}

/**
 * repo 内の既存ファイルに正規化し、重複と未対応拡張子を落とす。
 * lint 対象外の拡張子でも prettier 対象になりうるものは後段で扱う。
 */
function normalizeFiles(files) {
  const seen = new Set();
  return files
    .map((file) => (isAbsolute(file) ? file : resolve(repoRoot, file)))
    .filter((absolutePath) => existsSync(absolutePath))
    .map((absolutePath) => relative(repoRoot, absolutePath))
    .filter((relativePath) => {
      if (relativePath === selfRelativePath) {
        return false;
      }
      if (seen.has(relativePath)) {
        return false;
      }
      seen.add(relativePath);
      return true;
    });
}

/**
 * 変更ファイルごとに使うツールを分類する。
 * mjs/json/md などは整形だけを行い、lint は HTML/CSS/TS に限定する。
 */
function classifyFiles(files) {
  const prettierExtensions = new Set([
    ".css",
    ".d.ts",
    ".html",
    ".json",
    ".md",
    ".mjs",
    ".ts",
    ".yaml",
    ".yml",
  ]);

  const prettierTargets = [];
  const tsTargets = [];
  const cssTargets = [];
  const htmlTargets = [];

  for (const file of files) {
    const extension = extname(file).toLowerCase();
    if (prettierExtensions.has(extension)) {
      prettierTargets.push(file);
    }
    if (extension === ".ts") {
      tsTargets.push(file);
    }
    if (extension === ".css") {
      cssTargets.push(file);
    }
    if (extension === ".html") {
      htmlTargets.push(file);
    }
  }

  return {
    prettierTargets,
    tsTargets,
    cssTargets,
    htmlTargets,
  };
}

const targetFiles = normalizeFiles(resolveTargetFiles(process.argv.slice(2)));

if (targetFiles.length === 0) {
  console.log(
    "[lint-on-change] 対象ファイルが見つからなかったため、何も実行しません。",
  );
  process.exit(0);
}

const { prettierTargets, tsTargets, cssTargets, htmlTargets } =
  classifyFiles(targetFiles);

console.log("[lint-on-change] 対象ファイル:");
for (const file of targetFiles) {
  console.log(`- ${file}`);
}

if (prettierTargets.length > 0) {
  runStep(getLocalBin("prettier"), ["--write", ...prettierTargets]);
}

if (tsTargets.length > 0) {
  runStep(getLocalBin("eslint"), [...tsTargets]);
}

if (cssTargets.length > 0) {
  runStep(getLocalBin("stylelint"), [...cssTargets]);
}

if (htmlTargets.length > 0) {
  runStep(getLocalBin("html-validate"), [...htmlTargets]);
}

if (tsTargets.length > 0) {
  runStep(getLocalBin("tsc"), ["-p", "tsconfig.json", "--noEmit"]);
}

console.log("\n[lint-on-change] 完了");
