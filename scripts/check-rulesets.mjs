import { readdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { fileURLToPath, URL } from "node:url";

const repo = process.env.GITHUB_REPOSITORY;
const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
const apiBaseUrl = process.env.GITHUB_API_URL || "https://api.github.com";
const currentFilePath = import.meta.url.startsWith("file:")
  ? fileURLToPath(import.meta.url)
  : "";

function fail(message) {
  console.error(`[ruleset-check] ${message}`);
  process.exitCode = 1;
}

function sortByJson(values) {
  return [...(values ?? [])].sort((left, right) =>
    JSON.stringify(left).localeCompare(JSON.stringify(right)),
  );
}

export function normalizeRequiredStatusCheck(check) {
  const normalized = { context: check.context };
  if (check.integration_id != null) {
    normalized.integration_id = check.integration_id;
  }
  return normalized;
}

export function normalizeRule(rule) {
  const normalized = { type: rule.type };
  if (!rule.parameters) {
    return normalized;
  }

  normalized.parameters = { ...rule.parameters };
  if (
    Array.isArray(normalized.parameters.required_reviewers) &&
    normalized.parameters.required_reviewers.length === 0
  ) {
    delete normalized.parameters.required_reviewers;
  }
  if (Array.isArray(normalized.parameters.required_reviewers)) {
    normalized.parameters.required_reviewers = sortByJson(
      normalized.parameters.required_reviewers,
    );
  }
  if (Array.isArray(normalized.parameters.allowed_merge_methods)) {
    normalized.parameters.allowed_merge_methods = [
      ...normalized.parameters.allowed_merge_methods,
    ].sort();
  }
  if (Array.isArray(normalized.parameters.required_status_checks)) {
    normalized.parameters.required_status_checks = sortByJson(
      normalized.parameters.required_status_checks.map(
        normalizeRequiredStatusCheck,
      ),
    );
  }
  return normalized;
}

export function normalizeRuleset(ruleset) {
  return {
    name: ruleset.name,
    target: ruleset.target,
    enforcement: ruleset.enforcement,
    conditions: {
      ref_name: {
        include: [...(ruleset.conditions?.ref_name?.include ?? [])].sort(),
        exclude: [...(ruleset.conditions?.ref_name?.exclude ?? [])].sort(),
      },
    },
    bypass_actors: sortByJson(
      (ruleset.bypass_actors ?? []).map((actor) => ({
        actor_id: actor.actor_id,
        actor_type: actor.actor_type,
        bypass_mode: actor.bypass_mode,
      })),
    ),
    rules: sortByJson((ruleset.rules ?? []).map(normalizeRule)),
  };
}

function getRulesetDirectory() {
  return fileURLToPath(new URL("../.github/rulesets/", import.meta.url));
}

export function readLocalRulesets() {
  const rulesetDirectory = getRulesetDirectory();
  return readdirSync(rulesetDirectory)
    .filter((file) => file.endsWith(".json"))
    .map((file) => {
      const fullPath = join(rulesetDirectory, file);
      return {
        file,
        ruleset: normalizeRuleset(JSON.parse(readFileSync(fullPath, "utf8"))),
      };
    });
}

export async function githubApi(pathname) {
  const response = await globalThis.fetch(`${apiBaseUrl}${pathname}`, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`${response.status} ${response.statusText}: ${body}`);
  }
  return response.json();
}

export async function readRemoteRulesets() {
  const summaries = await githubApi(
    `/repos/${repo}/rulesets?per_page=100&includes_parents=false`,
  );
  const remoteRulesets = new Map();
  for (const summary of summaries) {
    const detail = await githubApi(`/repos/${repo}/rulesets/${summary.id}`);
    remoteRulesets.set(detail.name, normalizeRuleset(detail));
  }
  return remoteRulesets;
}

function stringify(value) {
  return JSON.stringify(value, null, 2);
}

export async function runRulesetCheck() {
  if (!repo) {
    fail("GITHUB_REPOSITORY is required, for example Wfrm-Qz/sekiei.");
    return;
  }
  if (!token) {
    fail("GITHUB_TOKEN or GH_TOKEN is required.");
    return;
  }

  try {
    const localRulesets = readLocalRulesets();
    const remoteRulesets = await readRemoteRulesets();
    let mismatchCount = 0;

    for (const { file, ruleset } of localRulesets) {
      const remote = remoteRulesets.get(ruleset.name);
      if (!remote) {
        console.error(
          `[ruleset-check] ${file}: remote ruleset "${ruleset.name}" was not found.`,
        );
        mismatchCount += 1;
        continue;
      }

      if (stringify(remote) !== stringify(ruleset)) {
        console.error(
          `[ruleset-check] ${file}: remote ruleset "${ruleset.name}" differs from the local file.`,
        );
        console.error("[ruleset-check] local:");
        console.error(stringify(ruleset));
        console.error("[ruleset-check] remote:");
        console.error(stringify(remote));
        mismatchCount += 1;
      }
    }

    const expectedNames = new Set(
      localRulesets.map(({ ruleset }) => ruleset.name),
    );
    for (const remoteName of remoteRulesets.keys()) {
      if (!expectedNames.has(remoteName)) {
        console.warn(
          `[ruleset-check] remote ruleset "${remoteName}" has no local file under ${basename(
            getRulesetDirectory(),
          )}/.`,
        );
      }
    }

    if (mismatchCount > 0) {
      process.exitCode = 1;
    } else {
      console.log("[ruleset-check] local ruleset files match GitHub settings.");
    }
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
  }
}

if (process.argv[1] === currentFilePath) {
  await runRulesetCheck();
}
