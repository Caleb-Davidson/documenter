#!/usr/bin/env node
// The issue-tracker CLI, over the repo's open Gitea issues:
//   npm run todo [list]       list them grouped In Progress / Next / Blocked / Someday (the default)
//   npm run todo details <n>  show one issue's full body
//   npm run todo claim <n>    add the `in-progress` label to claim issue <n>
// Reading and claiming live here — the per-task hot path — so a session works the tracker in one
// command instead of re-deriving how to query Gitea. Richer authoring and triage go through the
// issue-triage skill; the label taxonomy is defined in that skill and in AGENTS.md.
import { execFileSync } from "node:child_process";

const TOKEN = process.env.GITEA_TOKEN;
const BASE = process.env.GITEA_BASE;

if (!TOKEN) {
  console.error("todo: GITEA_TOKEN is not set.");
  process.exit(1);
}
if (!BASE) {
  console.error("todo: GITEA_BASE is not set (e.g. http://<gitea-host>:<port>).");
  process.exit(1);
}

const REPO = resolveRepo();

/**
 * Derives the `owner/repo` slug from the `origin` remote, so the tracker targets whatever repo it
 * runs in without a hardcoded owner and ports across repos unchanged. Handles http(s) and ssh
 * remote URLs, with or without a trailing `.git`.
 * @returns {string} The `owner/repo` slug.
 */
function resolveRepo() {
  let url;
  try {
    url = execFileSync("git", ["remote", "get-url", "origin"], { encoding: "utf-8" }).trim();
  } catch {
    console.error("todo: could not read the 'origin' git remote — run this inside the repository.");
    process.exit(1);
  }
  const segments = url.replace(/\.git$/, "").split(/[/:]/).filter(Boolean);
  const [owner, repo] = segments.slice(-2);
  if (!owner || !repo) {
    console.error(`todo: could not parse owner/repo from the origin URL '${url}'.`);
    process.exit(1);
  }
  return `${owner}/${repo}`;
}

// "next" is the neutral default: an open issue carrying no status label. The status labels
// decide the section; every other label on an issue is an area label.
const STATUS_LABELS = new Set(["in-progress", "blocked", "someday"]);

const SECTIONS = [
  { key: "in-progress", heading: "In Progress" },
  { key: "next", heading: "Next" },
  { key: "blocked", heading: "Blocked" },
  { key: "someday", heading: "Someday" },
];

/** @typedef {{ number: number, title: string, body: string, labels: Array<{ id: number, name: string }> }} Issue */

/**
 * Calls the repo-scoped Gitea REST API, exiting with a message on any non-OK response.
 * @param {string} path Path after `/repos/{owner}/{repo}` — e.g. `/issues/8`.
 * @param {object} [options] Extra fetch options; the auth and content-type headers are added here.
 * @returns {Promise<object>} The parsed JSON response.
 */
async function api(path, options = {}) {
  const res = await fetch(`${BASE}/api/v1/repos/${REPO}${path}`, {
    ...options,
    headers: { Authorization: `token ${TOKEN}`, "Content-Type": "application/json", ...options.headers },
  });
  if (!res.ok) {
    console.error(`todo: Gitea returned ${res.status} ${res.statusText} for ${path}`);
    process.exit(1);
  }
  return res.json();
}

/**
 * Fetches every open issue, following pagination so a growing backlog is never silently truncated.
 * @returns {Promise<Issue[]>} The open issues, oldest first.
 */
async function fetchOpenIssues() {
  const issues = [];
  let page = 1;
  let batch = [];
  do {
    batch = await api(`/issues?state=open&type=issues&limit=50&page=${page}`);
    issues.push(...batch);
    page++;
  } while (batch.length === 50);
  return issues.sort((a, b) => a.number - b.number);
}

/**
 * The section an issue belongs to: in-progress outranks blocked outranks someday; none means next.
 * @param {Issue} issue The issue to classify.
 * @returns {"in-progress" | "blocked" | "someday" | "next"} The section key.
 */
function sectionOf(issue) {
  const names = issue.labels.map((label) => label.name);
  if (names.includes("in-progress")) return "in-progress";
  if (names.includes("blocked")) return "blocked";
  if (names.includes("someday")) return "someday";
  return "next";
}

/**
 * The area labels on an issue as a bracket tag, or `[—]` when it has none.
 * @param {Issue} issue The issue.
 * @returns {string} The bracketed area tag.
 */
function areaTag(issue) {
  const areas = issue.labels.map((label) => label.name).filter((name) => !STATUS_LABELS.has(name));
  return areas.length > 0 ? `[${areas.join(", ")}]` : "[—]";
}

/**
 * Collapses markdown links to their visible text so a one-line preview stays readable.
 * @param {string} text The raw markdown.
 * @returns {string} The text with every `[label](url)` reduced to `label`.
 */
function stripLinks(text) {
  return text.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
}

/** Lists the open issues grouped In Progress / Next / Blocked / Someday, one preview line each. */
async function list() {
  const issues = await fetchOpenIssues();
  console.log(`\n${REPO} — ${issues.length} open issues\n`);

  for (const section of SECTIONS) {
    const inSection = issues.filter((issue) => sectionOf(issue) === section.key);
    console.log(`${section.heading} (${inSection.length})`);

    if (inSection.length === 0) {
      console.log("  —");
    }
    for (const issue of inSection) {
      const preview = stripLinks(issue.body.trim().split("\n")[0]);
      console.log(`  #${issue.number}  ${areaTag(issue)}  ${issue.title}`);
      if (preview.length > 0) {
        console.log(`      ${preview.length > 96 ? `${preview.slice(0, 95)}…` : preview}`);
      }
    }
    console.log("");
  }
}

/**
 * Prints one issue in full: number, title, labels, and its complete body.
 * @param {number} number The issue number.
 */
async function details(number) {
  const issue = await api(`/issues/${number}`);
  const labels = issue.labels.map((label) => label.name).join(", ") || "—";
  console.log(`\n#${issue.number}  ${issue.title}`);
  console.log(`labels: ${labels}\n`);
  console.log(issue.body.trim());
  console.log("");
}

/**
 * Claims an issue by adding the `in-progress` label, resolved by name so a recreated label still works.
 * @param {number} number The issue number.
 */
async function claim(number) {
  const labels = await api("/labels");
  const inProgress = labels.find((label) => label.name === "in-progress");
  if (inProgress === undefined) {
    console.error("todo: the 'in-progress' label does not exist in this repo.");
    process.exit(1);
  }
  await api(`/issues/${number}/labels`, { method: "POST", body: JSON.stringify({ labels: [inProgress.id] }) });
  console.log(`#${number} claimed — added the in-progress label.`);
}

/** Prints the subcommand usage. */
function usage() {
  console.log(`Usage:
  npm run todo [list]       list open issues grouped In Progress / Next / Blocked / Someday (default)
  npm run todo details <n>  show the full body of issue <n>
  npm run todo claim <n>    add the in-progress label to claim issue <n>`);
}

/**
 * Parses a required issue-number argument, printing usage and exiting when it is missing or invalid.
 * @param {string | undefined} arg The raw CLI argument.
 * @returns {number} The parsed issue number.
 */
function requireId(arg) {
  const number = Number(arg);
  if (!Number.isInteger(number) || number <= 0) {
    usage();
    process.exit(1);
  }
  return number;
}

const [command, arg] = process.argv.slice(2);

switch (command) {
  case undefined:
  case "list":
    await list();
    break;
  case "details":
    await details(requireId(arg));
    break;
  case "claim":
    await claim(requireId(arg));
    break;
  default:
    usage();
    process.exit(1);
}
