#!/usr/bin/env node
/**
 * Deterministic scorer for the AI Visibility Audit skill.
 *
 * Usage: node score.mjs <dir> [--page-type homepage|article|other]
 *
 * <dir> must contain robots.json, llms.json, schema.json, meta.json — each a
 * geo-inspector-mcp structuredContent payload, or {"error": "..."} when that
 * tool failed (a missing file counts as a failure). Prints one JSON document
 * to stdout. Node >= 20, zero dependencies.
 *
 * Rubric: docs/superpowers/specs/2026-07-06-ai-visibility-audit-design.md §5.
 */

import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const VERSION = "0.1.0";

const SEVERITY_RANK = { critical: 0, high: 1, medium: 2, low: 3 };
const EFFORT_RANK = { quick_fix: 0, small: 1, project: 2 };

const GRADE_BANDS = [
  [85, "AI-ready"],
  [70, "Good — gaps to close"],
  [50, "Needs work"],
  [0, "At risk"],
];

const CRAWLER_PENALTY = { search: 15, user_fetch: 10, training: 2 };

const PURPOSE_LABEL = {
  search: "AI search crawler",
  user_fetch: "on-demand fetcher",
  training: "training crawler",
};

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "_");

function severity(weightedLoss, { critical = false, capMedium = false } = {}) {
  if (critical) return "critical";
  const s = weightedLoss >= 4 ? "high" : weightedLoss >= 2 ? "medium" : "low";
  return capMedium && s === "high" ? "medium" : s;
}

function finding(categoryId, weight, id, pointsLost, opts) {
  const weighted = Math.round(pointsLost * weight) / 100;
  return {
    id: `${categoryId}.${id}`,
    severity: severity(weighted, opts),
    effort: opts.effort,
    owner: opts.owner,
    points_lost: pointsLost,
    weighted_loss: weighted,
    title: opts.title,
    detail: opts.detail,
    fix: opts.fix,
  };
}

// ---------- Category: AI Crawler Access (weight 40) ----------

export function scoreCrawlerAccess(robots) {
  const CAT = { id: "crawler_access", label: "AI Crawler Access", weight: 40 };
  if (!robots) return { ...CAT, assessed: false, score: null, findings: [] };
  const findings = [];

  if (robots.fetched === false && robots.status >= 500) {
    findings.push(finding(CAT.id, CAT.weight, "robots_unreachable", 100, {
      critical: true,
      effort: "quick_fix",
      owner: "hosting",
      title: "robots.txt is unreachable (server error)",
      detail: `Fetching ${robots.robotsUrl} returned HTTP ${robots.status}. Under RFC 9309 crawlers must treat an unreachable robots.txt as "block everything" — every AI crawler is currently locked out of the site.`,
      fix: "Fix the server error so robots.txt returns 200 (or 404 if you don't want one).",
    }));
    return { ...CAT, assessed: true, score: 0, findings };
  }

  let penalty = 0;
  if (robots.fetched === false) {
    findings.push(finding(CAT.id, CAT.weight, "no_robots_txt", 0, {
      effort: "quick_fix",
      owner: "developer",
      title: "No robots.txt file",
      detail: `No robots.txt was found (HTTP ${robots.status}), which means every crawler is allowed. That is fine for visibility — but the site has no explicit crawler policy at all.`,
      fix: "Optional: publish a robots.txt to make the crawler policy explicit.",
    }));
    return { ...CAT, assessed: true, score: 100, findings };
  }

  const groups = new Map();
  for (const c of robots.crawlers) {
    if (c.access !== "blocked") continue;
    penalty += CRAWLER_PENALTY[c.purpose];
    const key = `${c.vendor}:${c.purpose}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(c);
  }
  for (const [key, crawlers] of groups) {
    const [vendor, purpose] = key.split(":");
    const pointsLost = crawlers.reduce((n, c) => n + CRAWLER_PENALTY[c.purpose], 0);
    const names = crawlers.map((c) => c.name).join(", ");
    const rule = crawlers[0].matchedRule ?? "(group default)";
    const impact =
      purpose === "training"
        ? " Blocking training crawlers is a legitimate policy choice; the cost is that future AI models are less familiar with the site's content."
        : purpose === "search"
          ? " This crawler feeds AI search indexes — blocking it removes the site from AI-generated answers and citations."
          : " This crawler fetches pages live when a user asks an AI assistant about the site — blocking it means assistants cannot read the site on demand.";
    findings.push(finding(CAT.id, CAT.weight, `blocked.${slug(vendor)}_${purpose}`, pointsLost, {
      effort: "quick_fix",
      owner: "developer",
      title: `${vendor} ${PURPOSE_LABEL[purpose]} blocked (${names})`,
      detail: `robots.txt group "${crawlers[0].matchedGroup}" blocks ${names} via "${rule}".${impact}`,
      fix:
        purpose === "training"
          ? `If intentional, keep it. Otherwise allow ${names} in robots.txt.`
          : `Allow ${names} in robots.txt (remove or narrow the blocking rule).`,
    }));
  }
  if (robots.sitemaps.length === 0) {
    findings.push(finding(CAT.id, CAT.weight, "no_sitemap", 0, {
      effort: "quick_fix",
      owner: "developer",
      title: "No sitemap declared in robots.txt",
      detail: "A Sitemap: line helps all crawlers — AI and classic — discover the site's content.",
      fix: "Add a `Sitemap: https://…/sitemap.xml` line to robots.txt.",
    }));
  }
  return { ...CAT, assessed: true, score: Math.max(0, 100 - penalty), findings };
}

// Temporary stubs — replaced in Tasks 3-6.
export function scoreStructuredData() { throw new Error("not implemented"); }
export function scoreIndexing() { throw new Error("not implemented"); }
export function scoreLlmsTxt() { throw new Error("not implemented"); }
export function grade() { throw new Error("not implemented"); }
export function score() { throw new Error("not implemented"); }
