# AI Visibility Audit Plugin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `ai-visibility-audit` Claude Code plugin — a skill that orchestrates the four geo-inspector-mcp tools into a deterministic, scored, client-readable AI-visibility report — packaged with a self-marketplace so `/plugin marketplace add Bigsupe55/ai-visibility-audit` + `/plugin install` delivers skill and MCP server in one step.

**Architecture:** SKILL.md orchestrates (tool calls, JSON persistence, narrative report); a zero-dependency Node ESM script (`score.mjs`) computes all scores/severities/priorities mechanically so identical inputs always produce identical numbers. Spec: `docs/superpowers/specs/2026-07-06-ai-visibility-audit-design.md` (authoritative for all rubric numbers).

**Tech Stack:** Node >= 20 (`node:test`, zero runtime deps), Claude Code plugin system (plugin.json / marketplace.json / .mcp.json), markdown skill + references.

**Working directory for every command:** `C:\Users\Nick\ai-visibility-audit` (repo root; git already initialized on `main` with the spec committed). Commands are Git-Bash compatible.

**Context you need:** The scorer consumes the `structuredContent` payloads of the four tools in `Bigsupe55/geo-inspector-mcp` (local: `C:\Users\Nick\geo-inspector-mcp`). Their exact shapes are documented in spec §4 — do not guess fields; the fixture builders in Task 2 mirror them.

---

### Task 1: Repo scaffolding — manifests, license, gitignore

**Files:**
- Create: `.claude-plugin/plugin.json`
- Create: `.claude-plugin/marketplace.json`
- Create: `.mcp.json`
- Create: `.gitignore`
- Create: `LICENSE`

- [ ] **Step 1: Create `.claude-plugin/plugin.json`**

```json
{
  "name": "ai-visibility-audit",
  "version": "0.1.0",
  "description": "Run a scored AI-search visibility audit of any website and get a client-ready report — powered by the geo-inspector-mcp tools.",
  "author": { "name": "Nick Hernandez" }
}
```

- [ ] **Step 2: Create `.claude-plugin/marketplace.json`**

```json
{
  "name": "ai-visibility-audit",
  "owner": { "name": "Nick Hernandez" },
  "plugins": [
    {
      "name": "ai-visibility-audit",
      "source": "./",
      "description": "Run a scored AI-search visibility audit of any website and get a client-ready report — powered by the geo-inspector-mcp tools.",
      "version": "0.1.0"
    }
  ]
}
```

- [ ] **Step 3: Create `.mcp.json`** (works once geo-inspector-mcp is on npm; Task 11 covers pre-publish testing)

```json
{
  "mcpServers": {
    "geo-inspector": {
      "command": "npx",
      "args": ["-y", "geo-inspector-mcp"]
    }
  }
}
```

- [ ] **Step 4: Create `.gitignore`**

```
*.log
.DS_Store
scratch/
```

- [ ] **Step 5: Create `LICENSE`** (MIT)

```
MIT License

Copyright (c) 2026 Nick Hernandez

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

- [ ] **Step 6: Sanity-check the JSON files parse**

Run: `node -e "['.claude-plugin/plugin.json','.claude-plugin/marketplace.json','.mcp.json'].forEach(f => JSON.parse(require('fs').readFileSync(f,'utf8'))); console.log('OK')"`
Expected: `OK`

- [ ] **Step 7: Commit**

```bash
git add .claude-plugin .mcp.json .gitignore LICENSE
git commit -m "chore: plugin, marketplace, and MCP manifests + MIT license

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Scorer — constants, helpers, and the AI Crawler Access category

**Files:**
- Create: `skills/audit/scripts/score.mjs`
- Create: `tests/score.test.mjs`

- [ ] **Step 1: Write the failing tests (test file with fixture builders + crawler tests)**

Create `tests/score.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  score,
  scoreCrawlerAccess,
  scoreStructuredData,
  scoreIndexing,
  scoreLlmsTxt,
  grade,
} from "../skills/audit/scripts/score.mjs";

// ---------- fixture builders (mirror geo-inspector-mcp structuredContent, spec §4) ----------

const CRAWLERS = [
  ["GPTBot", "OpenAI", "training"],
  ["OAI-SearchBot", "OpenAI", "search"],
  ["ChatGPT-User", "OpenAI", "user_fetch"],
  ["ClaudeBot", "Anthropic", "training"],
  ["Claude-SearchBot", "Anthropic", "search"],
  ["Claude-User", "Anthropic", "user_fetch"],
  ["anthropic-ai", "Anthropic", "training"],
  ["PerplexityBot", "Perplexity", "search"],
  ["Perplexity-User", "Perplexity", "user_fetch"],
  ["Google-Extended", "Google", "training"],
  ["CCBot", "Common Crawl", "training"],
  ["Bytespider", "ByteDance", "training"],
  ["Applebot-Extended", "Apple", "training"],
  ["meta-externalagent", "Meta", "training"],
  ["cohere-ai", "Cohere", "training"],
];

export function robotsFixture({ blocked = [], fetched = true, status = 200, sitemaps = ["https://x.com/sitemap.xml"] } = {}) {
  return {
    robotsUrl: "https://x.com/robots.txt",
    fetched,
    status,
    path: "/",
    sitemaps,
    groupCount: 1,
    crawlers: CRAWLERS.map(([name, vendor, purpose]) => ({
      name,
      vendor,
      purpose,
      access: blocked === "all" || blocked.includes(name) ? "blocked" : "allowed",
      matchedGroup: "*",
      matchedRule: "Disallow: /",
    })),
  };
}

export function schemaFixture({ types = [], sameAs = false, blockCount = 1, parseErrors = 0 } = {}) {
  const aiRelevant = { Organization: false, WebSite: false, Article: false, FAQPage: false, BreadcrumbList: false, Person: false };
  for (const t of types) aiRelevant[t] = true;
  return {
    pageUrl: "https://x.com/",
    blockCount,
    parseErrors,
    typeCounts: {},
    aiRelevant,
    entities: sameAs ? [{ types: ["Organization"], name: "X Co", hasSameAs: true }] : [],
  };
}

export function metaFixture({ indexable = true, followable = true, aiDirectives = [] } = {}) {
  return {
    pageUrl: "https://x.com/",
    status: 200,
    metaTags: [],
    xRobotsTag: [],
    summary: { indexable, followable, aiDirectives },
  };
}

export function llmsFixture({ present = true, valid = true, oversized = false, fullPresent = false } = {}) {
  const files = [];
  if (!present) {
    files.push({ file: "llms.txt", url: "https://x.com/llms.txt", present: false, status: 404 });
  } else if (oversized) {
    files.push({ file: "llms.txt", url: "https://x.com/llms.txt", present: true, oversized: true, warnings: ["File exceeds the 2 MB fetch limit; it exists but was not validated."] });
  } else {
    files.push({ file: "llms.txt", url: "https://x.com/llms.txt", present: true, status: 200, bytes: 120, valid, title: "X", hasSummary: true, sections: [], warnings: valid ? [] : ["Missing H1 title"] });
  }
  files.push(
    fullPresent
      ? { file: "llms-full.txt", url: "https://x.com/llms-full.txt", present: true, status: 200, bytes: 9000, valid: true, title: "X", warnings: [] }
      : { file: "llms-full.txt", url: "https://x.com/llms-full.txt", present: false, status: 404 },
  );
  return { files };
}

// ---------- Category: AI Crawler Access (spec §5.1) ----------

test("crawler access: all allowed scores 100 with no findings", () => {
  const c = scoreCrawlerAccess(robotsFixture());
  assert.equal(c.assessed, true);
  assert.equal(c.score, 100);
  assert.equal(c.findings.length, 0);
});

test("crawler access: every crawler blocked scores 7 with 14 vendor+purpose groups", () => {
  const c = scoreCrawlerAccess(robotsFixture({ blocked: "all" }));
  assert.equal(c.score, 7); // 100 - (3x15 + 3x10 + 9x2) = 100 - 93
  assert.equal(c.findings.length, 14);
});

test("crawler access: blocked search crawler is -15 and High", () => {
  const c = scoreCrawlerAccess(robotsFixture({ blocked: ["OAI-SearchBot"] }));
  assert.equal(c.score, 85);
  assert.equal(c.findings.length, 1);
  assert.equal(c.findings[0].id, "crawler_access.blocked.openai_search");
  assert.equal(c.findings[0].severity, "high"); // 15 * 40/100 = 6 >= 4
  assert.equal(c.findings[0].effort, "quick_fix");
});

test("crawler access: blocked training crawler is -2 and Low (choice framing)", () => {
  const c = scoreCrawlerAccess(robotsFixture({ blocked: ["GPTBot"] }));
  assert.equal(c.score, 98);
  assert.equal(c.findings[0].severity, "low"); // 2 * 0.4 = 0.8
  assert.match(c.findings[0].detail, /policy choice/i);
});

test("crawler access: robots 5xx zeroes the category with a Critical finding", () => {
  const c = scoreCrawlerAccess(robotsFixture({ fetched: false, status: 503 }));
  assert.equal(c.score, 0);
  assert.equal(c.findings.length, 1);
  assert.equal(c.findings[0].severity, "critical");
});

test("crawler access: robots 404 scores 100 with a Low informational finding", () => {
  const c = scoreCrawlerAccess(robotsFixture({ fetched: false, status: 404, sitemaps: [] }));
  assert.equal(c.score, 100);
  assert.equal(c.findings.length, 1);
  assert.equal(c.findings[0].id, "crawler_access.no_robots_txt");
  assert.equal(c.findings[0].severity, "low");
  assert.equal(c.findings[0].points_lost, 0);
});

test("crawler access: missing sitemap is a zero-point Low finding", () => {
  const c = scoreCrawlerAccess(robotsFixture({ sitemaps: [] }));
  assert.equal(c.score, 100);
  assert.equal(c.findings.length, 1);
  assert.equal(c.findings[0].id, "crawler_access.no_sitemap");
});

test("crawler access: error sentinel means not assessed", () => {
  const c = scoreCrawlerAccess(null);
  assert.equal(c.assessed, false);
  assert.equal(c.score, null);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test`
Expected: FAIL — `Cannot find module ...score.mjs`

- [ ] **Step 3: Create `skills/audit/scripts/score.mjs` with constants, helpers, and `scoreCrawlerAccess`**

```js
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
```

Note: `readFileSync`, `join`, `resolve`, `fileURLToPath` are used by the CLI entry added in Task 7; importing them now is intentional.

- [ ] **Step 4: Run tests — crawler tests pass, later suites don't exist yet**

Run: `node --test`
Expected: FAIL overall — the file also imports `scoreStructuredData`, `scoreIndexing`, `scoreLlmsTxt`, `score`, `grade`, which don't exist yet. Add temporary stub exports at the bottom of `score.mjs` so the module loads and the crawler tests can run:

```js
// Temporary stubs — replaced in Tasks 3-6.
export function scoreStructuredData() { throw new Error("not implemented"); }
export function scoreIndexing() { throw new Error("not implemented"); }
export function scoreLlmsTxt() { throw new Error("not implemented"); }
export function grade() { throw new Error("not implemented"); }
export function score() { throw new Error("not implemented"); }
```

Run again: `node --test`
Expected: PASS — 8 tests, all in the crawler suite.

- [ ] **Step 5: Commit**

```bash
git add skills/audit/scripts/score.mjs tests/score.test.mjs
git commit -m "feat: scorer skeleton + AI Crawler Access category (40%)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Scorer — Structured Data category

**Files:**
- Modify: `skills/audit/scripts/score.mjs` (replace the `scoreStructuredData` stub)
- Modify: `tests/score.test.mjs` (append tests)

- [ ] **Step 1: Append failing tests to `tests/score.test.mjs`**

```js
// ---------- Category: Structured Data (spec §5.2) ----------

test("structured data: fully marked-up homepage scores 100", () => {
  const c = scoreStructuredData(schemaFixture({ types: ["Organization", "WebSite", "FAQPage", "BreadcrumbList", "Person"], sameAs: true }), "homepage");
  assert.equal(c.score, 100);
  assert.equal(c.findings.length, 0);
});

test("structured data: homepage with Org+WebSite+sameAs scores 75", () => {
  const c = scoreStructuredData(schemaFixture({ types: ["Organization", "WebSite"], sameAs: true }), "homepage");
  assert.equal(c.score, 75); // 35 + 20 + 20
  assert.equal(c.findings.length, 3); // BreadcrumbList, FAQPage, Person
  const faq = c.findings.find((f) => f.id === "structured_data.missing.faqpage");
  assert.equal(faq.severity, "medium"); // 10 * 25/100 = 2.5
});

test("structured data: no JSON-LD at all is 0 with one High finding (not Critical)", () => {
  const c = scoreStructuredData(schemaFixture({ blockCount: 0 }), "homepage");
  assert.equal(c.score, 0);
  assert.equal(c.findings.length, 1);
  assert.equal(c.findings[0].severity, "high");
});

test("structured data: article page type uses the article point table", () => {
  const c = scoreStructuredData(schemaFixture({ types: ["Article", "Organization", "Person"] }), "article");
  assert.equal(c.score, 70); // 35 + 20 + 15
  assert.equal(c.findings.length, 3); // WebSite, sameAs, BreadcrumbList
  assert.ok(!c.findings.some((f) => f.id.includes("faqpage")), "FAQPage is N/A on articles");
});

test("structured data: parse-error penalty caps at 30", () => {
  const c = scoreStructuredData(schemaFixture({ types: ["Organization", "WebSite", "FAQPage", "BreadcrumbList", "Person"], sameAs: true, parseErrors: 5 }), "homepage");
  assert.equal(c.score, 70); // 100 - min(30, 50)
  assert.equal(c.findings.length, 1);
});

test("structured data: sameAs requires an Organization or Person entity", () => {
  const fixture = schemaFixture({ types: ["Organization"] });
  fixture.entities = [{ types: ["Article"], name: "Post", hasSameAs: true }];
  const c = scoreStructuredData(fixture, "homepage");
  assert.ok(c.findings.some((f) => f.id === "structured_data.missing.sameas"));
});

test("structured data: error sentinel means not assessed", () => {
  const c = scoreStructuredData(null, "homepage");
  assert.equal(c.assessed, false);
});
```

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `node --test`
Expected: FAIL — new tests hit the `not implemented` stub.

- [ ] **Step 3: Replace the `scoreStructuredData` stub with the implementation**

Add these constants near `CRAWLER_PENALTY`, and replace the stub:

```js
const SCHEMA_POINTS = {
  homepage: { Organization: 35, WebSite: 20, sameAs: 20, BreadcrumbList: 5, FAQPage: 10, Person: 10 },
  article: { Organization: 20, WebSite: 10, sameAs: 10, BreadcrumbList: 10, Article: 35, Person: 15 },
  other: { Organization: 30, WebSite: 15, sameAs: 15, BreadcrumbList: 10, FAQPage: 15, Person: 15 },
};

const SCHEMA_FIX = {
  Organization: "Add an Organization JSON-LD block with name, url, logo, and sameAs links to official profiles.",
  WebSite: "Add a WebSite JSON-LD block with the site name and url.",
  Article: "Add an Article (or BlogPosting/NewsArticle) JSON-LD block with headline, author, and dates.",
  FAQPage: "If the page answers common questions, mark them up with FAQPage JSON-LD.",
  BreadcrumbList: "Add BreadcrumbList JSON-LD reflecting the page's position in the site structure.",
  Person: "Add Person JSON-LD for the people behind the content (founder, author).",
  sameAs: "Add sameAs links (official social/profile URLs) to the Organization or Person markup so AI systems can disambiguate the entity.",
};

// ---------- Category: Structured Data (weight 25) ----------

export function scoreStructuredData(schema, pageType) {
  const CAT = { id: "structured_data", label: "Structured Data", weight: 25 };
  if (!schema) return { ...CAT, assessed: false, score: null, findings: [] };
  const findings = [];

  if (schema.blockCount === 0) {
    findings.push(finding(CAT.id, CAT.weight, "no_json_ld", 100, {
      effort: "small",
      owner: "developer",
      title: "No JSON-LD structured data at all",
      detail: "The page ships no machine-readable description of who the site is or what the page contains — AI systems must guess from raw text.",
      fix: "Start with an Organization block (name, url, logo, sameAs) and build from there.",
    }));
    return { ...CAT, assessed: true, score: 0, findings };
  }

  const table = SCHEMA_POINTS[pageType];
  let earned = 0;
  for (const [signal, points] of Object.entries(table)) {
    const present =
      signal === "sameAs"
        ? schema.entities.some((e) => e.hasSameAs && e.types.some((t) => t === "Organization" || t === "Person"))
        : schema.aiRelevant[signal] === true;
    if (present) {
      earned += points;
    } else {
      findings.push(finding(CAT.id, CAT.weight, `missing.${signal.toLowerCase()}`, points, {
        effort: "small",
        owner: "developer",
        title: signal === "sameAs" ? "Missing sameAs entity links" : `Missing ${signal} markup`,
        detail:
          signal === "sameAs"
            ? `No sameAs disambiguation found on an Organization or Person entity on this ${pageType} page.`
            : `No ${signal} JSON-LD found on this ${pageType} page.`,
        fix: SCHEMA_FIX[signal],
      }));
    }
  }

  let parsePenalty = 0;
  if (schema.parseErrors > 0) {
    parsePenalty = Math.min(30, schema.parseErrors * 10);
    findings.push(finding(CAT.id, CAT.weight, "parse_errors", parsePenalty, {
      effort: "small",
      owner: "developer",
      title: `${schema.parseErrors} JSON-LD block(s) fail to parse`,
      detail: "Broken JSON-LD is invisible to every consumer — the markup may as well not exist.",
      fix: "Validate the JSON-LD (e.g. with the schema.org validator) and fix the syntax errors.",
    }));
  }
  return { ...CAT, assessed: true, score: Math.max(0, earned - parsePenalty), findings };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test`
Expected: PASS — 15 tests.

- [ ] **Step 5: Commit**

```bash
git add skills/audit/scripts/score.mjs tests/score.test.mjs
git commit -m "feat: Structured Data category with page-type-aware point tables (25%)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Scorer — Indexing Directives category

**Files:**
- Modify: `skills/audit/scripts/score.mjs` (replace the `scoreIndexing` stub)
- Modify: `tests/score.test.mjs` (append tests)

- [ ] **Step 1: Append failing tests**

```js
// ---------- Category: Indexing Directives (spec §5.3) ----------

test("indexing: clean page scores 100", () => {
  const c = scoreIndexing(metaFixture());
  assert.equal(c.score, 100);
  assert.equal(c.findings.length, 0);
});

test("indexing: noindex zeroes the category with a Critical finding", () => {
  const c = scoreIndexing(metaFixture({ indexable: false }));
  assert.equal(c.score, 0);
  assert.equal(c.findings.length, 1);
  assert.equal(c.findings[0].id, "indexing.noindex");
  assert.equal(c.findings[0].severity, "critical");
});

test("indexing: nofollow is -30 and High", () => {
  const c = scoreIndexing(metaFixture({ followable: false }));
  assert.equal(c.score, 70);
  assert.equal(c.findings[0].severity, "high"); // 30 * 20/100 = 6
});

test("indexing: AI directives are deduped, -20 each", () => {
  const c = scoreIndexing(metaFixture({ aiDirectives: ["noai", "noai", "noimageai"] }));
  assert.equal(c.score, 60); // 100 - 2x20
  assert.equal(c.findings.length, 2);
  assert.equal(c.findings[0].severity, "high"); // 20 * 0.2 = 4
});

test("indexing: penalties floor at 0", () => {
  const c = scoreIndexing(metaFixture({ followable: false, aiDirectives: ["a", "b", "c", "d"] }));
  assert.equal(c.score, 0); // 100 - 30 - 80 floored
});

test("indexing: error sentinel means not assessed", () => {
  assert.equal(scoreIndexing(null).assessed, false);
});
```

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `node --test`
Expected: FAIL — `not implemented` stub.

- [ ] **Step 3: Replace the `scoreIndexing` stub**

```js
// ---------- Category: Indexing Directives (weight 20) ----------

export function scoreIndexing(meta) {
  const CAT = { id: "indexing", label: "Indexing Directives", weight: 20 };
  if (!meta) return { ...CAT, assessed: false, score: null, findings: [] };
  const findings = [];

  if (meta.summary.indexable === false) {
    findings.push(finding(CAT.id, CAT.weight, "noindex", 100, {
      critical: true,
      effort: "quick_fix",
      owner: "developer",
      title: "Page is set to noindex",
      detail: "A noindex directive makes the page invisible to classic search and to every AI system that respects indexing directives.",
      fix: "Remove the noindex directive (meta robots tag or X-Robots-Tag header) if this page should be findable.",
    }));
    return { ...CAT, assessed: true, score: 0, findings };
  }

  let penalty = 0;
  if (meta.summary.followable === false) {
    penalty += 30;
    findings.push(finding(CAT.id, CAT.weight, "nofollow", 30, {
      effort: "quick_fix",
      owner: "developer",
      title: "Links are set to nofollow",
      detail: "nofollow tells crawlers not to follow links from this page, cutting off discovery of the rest of the site from here.",
      fix: "Remove the nofollow directive unless there is a specific reason for it.",
    }));
  }
  for (const d of [...new Set(meta.summary.aiDirectives)]) {
    penalty += 20;
    findings.push(finding(CAT.id, CAT.weight, `ai_directive.${slug(d)}`, 20, {
      effort: "quick_fix",
      owner: "developer",
      title: `AI-specific restriction: ${d}`,
      detail: `The ${d} directive asks AI systems not to use this page. Like blocking training crawlers, this is a deliberate choice — with a visibility cost.`,
      fix: `If intentional, keep it. Otherwise remove the ${d} directive.`,
    }));
  }
  return { ...CAT, assessed: true, score: Math.max(0, 100 - penalty), findings };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test`
Expected: PASS — 21 tests.

- [ ] **Step 5: Commit**

```bash
git add skills/audit/scripts/score.mjs tests/score.test.mjs
git commit -m "feat: Indexing Directives category (20%)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: Scorer — llms.txt Adoption category

**Files:**
- Modify: `skills/audit/scripts/score.mjs` (replace the `scoreLlmsTxt` stub)
- Modify: `tests/score.test.mjs` (append tests)

- [ ] **Step 1: Append failing tests**

```js
// ---------- Category: llms.txt Adoption (spec §5.4) ----------

test("llms.txt: valid with llms-full.txt scores 100", () => {
  const c = scoreLlmsTxt(llmsFixture({ valid: true, fullPresent: true }));
  assert.equal(c.score, 100);
  assert.equal(c.findings.length, 0);
});

test("llms.txt: valid without llms-full.txt scores 90 with a Low suggestion", () => {
  const c = scoreLlmsTxt(llmsFixture({ valid: true }));
  assert.equal(c.score, 90);
  assert.equal(c.findings.length, 1);
  assert.equal(c.findings[0].id, "llms_txt.no_full");
  assert.equal(c.findings[0].severity, "low");
  assert.equal(c.findings[0].effort, "project");
});

test("llms.txt: invalid scores 55 and severity caps at Medium", () => {
  const c = scoreLlmsTxt(llmsFixture({ valid: false }));
  assert.equal(c.score, 55);
  const f = c.findings.find((x) => x.id === "llms_txt.invalid");
  assert.equal(f.severity, "medium"); // 35 * 0.15 = 5.25 would be High; capped
  assert.match(f.detail, /Missing H1 title/);
});

test("llms.txt: absent scores 0 with a Medium (capped) early-adopter finding", () => {
  const c = scoreLlmsTxt(llmsFixture({ present: false }));
  assert.equal(c.score, 0);
  assert.equal(c.findings[0].severity, "medium"); // 90 * 0.15 = 13.5 capped from High
  assert.match(c.findings[0].detail, /early-adopter/i);
});

test("llms.txt: oversized scores 55 (+10 with full present = 65)", () => {
  assert.equal(scoreLlmsTxt(llmsFixture({ oversized: true })).score, 55);
  assert.equal(scoreLlmsTxt(llmsFixture({ oversized: true, fullPresent: true })).score, 65);
});

test("llms.txt: absent but llms-full.txt present scores 10", () => {
  const c = scoreLlmsTxt(llmsFixture({ present: false, fullPresent: true }));
  assert.equal(c.score, 10);
});

test("llms.txt: error sentinel means not assessed", () => {
  assert.equal(scoreLlmsTxt(null).assessed, false);
});
```

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `node --test`
Expected: FAIL — `not implemented` stub.

- [ ] **Step 3: Replace the `scoreLlmsTxt` stub**

```js
// ---------- Category: llms.txt Adoption (weight 15) ----------

export function scoreLlmsTxt(llms) {
  const CAT = { id: "llms_txt", label: "llms.txt Adoption", weight: 15 };
  if (!llms) return { ...CAT, assessed: false, score: null, findings: [] };
  const findings = [];
  const entry = llms.files.find((f) => f.file === "llms.txt");
  const full = llms.files.find((f) => f.file === "llms-full.txt");
  const fullPresent = full?.present === true;
  let score;

  if (!entry || entry.present !== true) {
    score = 0;
    findings.push(finding(CAT.id, CAT.weight, "absent", 90, {
      capMedium: true,
      effort: "small",
      owner: "content",
      title: "No llms.txt published",
      detail: "llms.txt is an emerging standard: a concise, AI-readable index of the site. Adoption is still early, so this is an early-adopter advantage waiting to be claimed rather than a defect.",
      fix: "Publish /llms.txt: an H1 title, a one-line summary blockquote, and H2 sections linking to key pages (see llmstxt.org).",
    }));
  } else if (entry.oversized === true) {
    score = 55;
    findings.push(finding(CAT.id, CAT.weight, "oversized", 35, {
      capMedium: true,
      effort: "quick_fix",
      owner: "content",
      title: "llms.txt is too large to validate",
      detail: "llms.txt is meant to be a concise index (expanded content belongs in llms-full.txt). This file exceeds the 2 MB fetch limit.",
      fix: "Slim llms.txt down to a short index; move full content to llms-full.txt.",
    }));
  } else if (entry.valid === true) {
    score = 90;
  } else {
    score = 55;
    findings.push(finding(CAT.id, CAT.weight, "invalid", 35, {
      capMedium: true,
      effort: "quick_fix",
      owner: "content",
      title: "llms.txt does not follow the spec",
      detail: `The file exists but fails validation: ${(entry.warnings ?? []).join("; ") || "structure does not match llmstxt.org"}.`,
      fix: "Fix the listed issues: H1 title first, optional summary blockquote, then H2 link sections.",
    }));
  }

  if (fullPresent) {
    score = Math.min(100, score + 10);
  } else if (entry?.present === true && entry.valid === true) {
    findings.push(finding(CAT.id, CAT.weight, "no_full", 10, {
      capMedium: true,
      effort: "project",
      owner: "content",
      title: "No llms-full.txt",
      detail: "llms-full.txt carries the expanded content for AI systems that want more than the index.",
      fix: "Consider publishing /llms-full.txt with the full text of key pages.",
    }));
  }
  return { ...CAT, assessed: true, score, findings };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test`
Expected: PASS — 28 tests.

- [ ] **Step 5: Commit**

```bash
git add skills/audit/scripts/score.mjs tests/score.test.mjs
git commit -m "feat: llms.txt Adoption category with early-adopter framing (15%)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: Scorer — aggregation, grades, renormalization, priorities

**Files:**
- Modify: `skills/audit/scripts/score.mjs` (replace the `grade` and `score` stubs)
- Modify: `tests/score.test.mjs` (append tests)

- [ ] **Step 1: Append failing tests**

```js
// ---------- Aggregation (spec §5.5-5.6) ----------

function perfectInputs() {
  return {
    robots: robotsFixture(),
    schema: schemaFixture({ types: ["Organization", "WebSite", "FAQPage", "BreadcrumbList", "Person"], sameAs: true }),
    meta: metaFixture(),
    llms: llmsFixture({ valid: true, fullPresent: true }),
  };
}

test("overall: perfect inputs score 100, AI-ready", () => {
  const doc = score(perfectInputs(), "homepage");
  assert.equal(doc.overall.score, 100);
  assert.equal(doc.overall.grade, "AI-ready");
  assert.equal(doc.overall.assessed_weight, 100);
  assert.equal(doc.version, "0.1.0");
  assert.equal(doc.page_type, "homepage");
});

test("overall: unassessed category renormalizes the remaining weights", () => {
  const inputs = perfectInputs();
  inputs.robots = null; // tool failed
  inputs.llms = llmsFixture({ valid: true }); // 90
  const doc = score(inputs, "homepage");
  // (100*25 + 100*20 + 90*15) / 60 = 97.5 -> 98
  assert.equal(doc.overall.score, 98);
  assert.equal(doc.overall.assessed_weight, 60);
  assert.equal(doc.categories.find((c) => c.id === "crawler_access").assessed, false);
});

test("overall: all categories unassessed yields null score, 'Not assessed'", () => {
  const doc = score({ robots: null, schema: null, meta: null, llms: null }, "homepage");
  assert.equal(doc.overall.score, null);
  assert.equal(doc.overall.grade, "Not assessed");
  assert.equal(doc.overall.assessed_weight, 0);
});

test("grade bands match the spec boundaries", () => {
  assert.equal(grade(85), "AI-ready");
  assert.equal(grade(84), "Good — gaps to close");
  assert.equal(grade(70), "Good — gaps to close");
  assert.equal(grade(69), "Needs work");
  assert.equal(grade(50), "Needs work");
  assert.equal(grade(49), "At risk");
  assert.equal(grade(0), "At risk");
});

test("priorities: Critical first, then effort, then weighted loss", () => {
  const inputs = perfectInputs();
  inputs.meta = metaFixture({ indexable: false });          // critical
  inputs.llms = llmsFixture({ present: false });             // medium (capped), effort small
  inputs.robots = robotsFixture({ blocked: ["GPTBot"] });    // low, effort quick_fix
  const doc = score(inputs, "homepage");
  assert.equal(doc.priorities[0], "indexing.noindex");
  const last = doc.priorities[doc.priorities.length - 1];
  assert.equal(last, "crawler_access.blocked.openai_training"); // only Low in this set
  assert.ok(doc.priorities.includes("llms_txt.absent"));
});
```

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `node --test`
Expected: FAIL — `not implemented` stubs.

- [ ] **Step 3: Replace the `grade` and `score` stubs**

```js
// ---------- Aggregation ----------

export function grade(points) {
  for (const [min, label] of GRADE_BANDS) if (points >= min) return label;
  return "At risk";
}

export function score(inputs, pageType = "homepage") {
  const categories = [
    scoreCrawlerAccess(inputs.robots),
    scoreStructuredData(inputs.schema, pageType),
    scoreIndexing(inputs.meta),
    scoreLlmsTxt(inputs.llms),
  ];
  const assessed = categories.filter((c) => c.assessed);
  const assessedWeight = assessed.reduce((n, c) => n + c.weight, 0);
  let overall;
  if (assessedWeight === 0) {
    overall = { score: null, grade: "Not assessed", assessed_weight: 0 };
  } else {
    const points = Math.round(assessed.reduce((n, c) => n + c.score * c.weight, 0) / assessedWeight);
    overall = { score: points, grade: grade(points), assessed_weight: assessedWeight };
  }
  const priorities = categories
    .flatMap((c) => c.findings)
    .sort(
      (a, b) =>
        SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] ||
        EFFORT_RANK[a.effort] - EFFORT_RANK[b.effort] ||
        b.weighted_loss - a.weighted_loss,
    )
    .map((f) => f.id);
  return { version: VERSION, page_type: pageType, categories, overall, priorities };
}
```

Delete the now-unused stub comments if any remain.

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test`
Expected: PASS — 33 tests.

- [ ] **Step 5: Commit**

```bash
git add skills/audit/scripts/score.mjs tests/score.test.mjs
git commit -m "feat: overall score, grade bands, weight renormalization, priority ordering

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 7: Scorer — CLI entry point

**Files:**
- Modify: `skills/audit/scripts/score.mjs` (append CLI code)
- Modify: `tests/score.test.mjs` (append CLI smoke tests)

- [ ] **Step 1: Append failing CLI smoke tests**

```js
// ---------- CLI (spec §5, header) ----------
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const SCORE_MJS = fileURLToPath(new URL("../skills/audit/scripts/score.mjs", import.meta.url));

function writeInputs(dir, inputs) {
  writeFileSync(join(dir, "robots.json"), JSON.stringify(inputs.robots ?? { error: "failed" }));
  writeFileSync(join(dir, "llms.json"), JSON.stringify(inputs.llms ?? { error: "failed" }));
  writeFileSync(join(dir, "schema.json"), JSON.stringify(inputs.schema ?? { error: "failed" }));
  writeFileSync(join(dir, "meta.json"), JSON.stringify(inputs.meta ?? { error: "failed" }));
}

test("CLI: scores a directory of tool outputs", () => {
  const dir = mkdtempSync(join(tmpdir(), "ava-"));
  writeInputs(dir, perfectInputs());
  const out = JSON.parse(execFileSync(process.execPath, [SCORE_MJS, dir], { encoding: "utf8" }));
  assert.equal(out.overall.score, 100);
  assert.equal(out.page_type, "homepage");
});

test("CLI: --page-type article is honored and error sentinels are unassessed", () => {
  const dir = mkdtempSync(join(tmpdir(), "ava-"));
  writeInputs(dir, { schema: schemaFixture({ types: ["Article"] }) }); // others are sentinels
  const out = JSON.parse(execFileSync(process.execPath, [SCORE_MJS, dir, "--page-type", "article"], { encoding: "utf8" }));
  assert.equal(out.page_type, "article");
  assert.equal(out.overall.assessed_weight, 25);
  assert.equal(out.categories.find((c) => c.id === "structured_data").score, 35);
});

test("CLI: invalid page type exits non-zero with usage", () => {
  const dir = mkdtempSync(join(tmpdir(), "ava-"));
  writeInputs(dir, perfectInputs());
  assert.throws(() => execFileSync(process.execPath, [SCORE_MJS, dir, "--page-type", "landing"], { encoding: "utf8" }));
});

test("CLI: missing dir argument exits non-zero", () => {
  assert.throws(() => execFileSync(process.execPath, [SCORE_MJS], { encoding: "utf8" }));
});
```

Note: `join` / `fileURLToPath` may already be imported at the top of the test file if you consolidated imports — keep exactly one import of each.

- [ ] **Step 2: Run tests to verify the CLI tests fail**

Run: `node --test`
Expected: FAIL — CLI produces no output (no main entry yet), JSON.parse throws.

- [ ] **Step 3: Append the CLI entry to `score.mjs`**

```js
// ---------- CLI ----------

function readInput(dir, name) {
  try {
    const parsed = JSON.parse(readFileSync(join(dir, name), "utf8"));
    return parsed && typeof parsed === "object" && !("error" in parsed) ? parsed : null;
  } catch {
    return null; // missing or unreadable file == tool failure
  }
}

function main(argv) {
  const args = argv.slice(2);
  let pageType = "homepage";
  const flagIdx = args.indexOf("--page-type");
  if (flagIdx !== -1) {
    pageType = args[flagIdx + 1];
    args.splice(flagIdx, 2);
  }
  const dir = args[0];
  if (!dir || !Object.hasOwn(SCHEMA_POINTS, pageType ?? "")) {
    process.stderr.write("Usage: node score.mjs <dir> [--page-type homepage|article|other]\n");
    process.exit(1);
  }
  const inputs = {
    robots: readInput(dir, "robots.json"),
    llms: readInput(dir, "llms.json"),
    schema: readInput(dir, "schema.json"),
    meta: readInput(dir, "meta.json"),
  };
  process.stdout.write(JSON.stringify(score(inputs, pageType), null, 2) + "\n");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main(process.argv);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test`
Expected: PASS — 37 tests.

- [ ] **Step 5: Commit**

```bash
git add skills/audit/scripts/score.mjs tests/score.test.mjs
git commit -m "feat: score.mjs CLI entry — reads tool JSONs, prints score document

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 8: SKILL.md and rubric reference

**Files:**
- Create: `skills/audit/SKILL.md`
- Create: `skills/audit/references/rubric.md`

- [ ] **Step 1: Create `skills/audit/SKILL.md`** (exact content)

````markdown
---
name: audit
description: Run a scored AI-search visibility audit of a website and produce a client-ready markdown report. Use when the user asks for an AI visibility audit, an AI search readiness check, a GEO audit of a URL, or asks how visible a site is to ChatGPT/Claude/Perplexity/AI search. Requires the bundled geo-inspector MCP server.
---

# AI Visibility Audit

Produce a scored, client-readable audit of one web page's AI-search readiness using the four geo-inspector tools and the deterministic scorer bundled with this skill. The work splits in two: **collect and score mechanically** (never adjust numbers), then **translate findings into plain language** for a non-technical site owner.

## Procedure

1. **Target.** Take the URL from the user's request. Classify the page type:
   - `homepage` — the site root (path `/` or no path)
   - `article` — clearly a blog post, news story, or article page
   - `other` — anything else
   State this classification in the report's methodology section.

2. **Collect.** Call all four geo-inspector tools on the URL: `check_robots_txt`, `fetch_llms_txt`, `detect_schema_markup`, `check_meta_directives`. If a tool call fails, retry it once. If it fails twice, record the failure (step 3) and continue.

3. **Persist.** Create a temporary working directory (outside the user's project). Write each tool's `structuredContent` JSON — exactly as returned, no edits — to `robots.json`, `llms.json`, `schema.json`, `meta.json` respectively. For a tool that failed twice, write `{"error": "<the error message>"}` instead. If **all four** failed: stop — explain the connectivity problem plainly and do not produce a report.

4. **Score.** Run:

   ```
   node "${CLAUDE_PLUGIN_ROOT}/skills/audit/scripts/score.mjs" <dir> --page-type <homepage|article|other>
   ```

   Parse the JSON from stdout. These numbers are final: scores, grades, severities, efforts, owners, and the priority order come from the scorer verbatim. Do not recompute, adjust, or re-rank anything.

5. **Report.** Write the report to `ai-visibility-audit-<domain>-<YYYY-MM-DD>.md` in the user's current working directory, following `references/report-template.md` for structure, tone, and phrasing. Use `references/rubric.md` for the "why it matters" explanations — it explains the weighting rationale; it never changes scores.

6. **Deliver.** Tell the user the overall score, the grade, and the single most important fix, and point them to the report file.

## Optional secondary page

If the user supplies a second URL (e.g. a blog post alongside the homepage): run only `detect_schema_markup` and `check_meta_directives` on it, and add an **appendix** to the report with those findings, clearly marked "informational — not scored." robots.txt and llms.txt are origin-level and are not re-run.

## Hard rules

- Never present a number the scorer didn't output; if `assessed_weight < 100`, say which category could not be checked and why.
- Never soften a Critical finding or inflate a Low one.
- Blocking training crawlers and `noai` directives are deliberate choices with trade-offs — never call them defects.
- Every acronym gets a one-time plain-word definition (GEO, JSON-LD, crawler, etc.).
````

- [ ] **Step 2: Create `skills/audit/references/rubric.md`** (exact content)

```markdown
# Scoring rubric — rationale

The scorer (`scripts/score.mjs`) is the single source of truth for numbers. This file explains **why** the rubric is shaped the way it is, so the report's "why it matters" sections are grounded. It is original work derived from public specifications: RFC 9309 (robots.txt), llmstxt.org, schema.org, and vendor-published crawler documentation.

## Weights

| Category | Weight | Why this weight |
|---|---|---|
| AI Crawler Access | 40 | Access is binary and upstream of everything else: a blocked AI crawler cannot read, quote, or cite the site no matter how good the content is. |
| Structured Data | 25 | JSON-LD is how a site tells machines who it is. Entity clarity (Organization + sameAs) strongly affects whether AI systems attribute content correctly. |
| Indexing Directives | 20 | noindex/noai directives silently remove pages from both classic and AI search. Errors here are rare but severe — hence high per-finding penalties within a mid weight. |
| llms.txt Adoption | 15 | An emerging standard. Weighted lowest because adoption is still uncommon — absence is an opportunity, not a failure, and the score must stay credible for typical sites. |

## Crawler purpose taxonomy (the 40% category's core idea)

geo-inspector-mcp tags each of its 15 tracked AI crawlers with a purpose:

- **search** (e.g. OAI-SearchBot, Claude-SearchBot, PerplexityBot): feeds AI search indexes. Blocking = the site cannot appear in AI answers. Penalty −15 each.
- **user_fetch** (e.g. ChatGPT-User, Claude-User, Perplexity-User): fetches a page live when a user asks about it. Blocking = assistants cannot read the site on demand. Penalty −10 each.
- **training** (e.g. GPTBot, ClaudeBot, CCBot): collects training data. Blocking is a **legitimate content-policy choice**; the cost is only future-model familiarity. Penalty −2 each, and the report must present it neutrally.

robots.txt returning a server error (5xx) is Critical: RFC 9309 requires crawlers to treat it as "block everything."

## Severity and effort

- Severity comes from weighted loss (points lost × category weight / 100): ≥4 High, ≥2 Medium, else Low. Only two findings are ever Critical: unreachable robots.txt and noindex.
- llms.txt findings cap at Medium, consistent with the emerging-standard framing.
- Effort tags: **Quick fix** (≤1 hour: a robots.txt line, a meta tag), **Small** (≤1 day: add a JSON-LD block, write an llms.txt), **Project** (>1 day: an llms-full.txt content program).
- Priority order: severity, then effort (quickest first), then weighted loss.

## Grade bands

85–100 **AI-ready** · 70–84 **Good — gaps to close** · 50–69 **Needs work** · 0–49 **At risk**.
```

- [ ] **Step 3: Validate the plugin**

Run: `claude plugin validate .`
Expected: validation passes (manifests + skill discovered). If the command reports the marketplace and plugin entries, confirm no schema errors are listed.

- [ ] **Step 4: Commit**

```bash
git add skills/audit/SKILL.md skills/audit/references/rubric.md
git commit -m "feat: audit skill workflow + rubric rationale reference

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 9: Report template reference

**Files:**
- Create: `skills/audit/references/report-template.md`

- [ ] **Step 1: Create `skills/audit/references/report-template.md`** (exact content)

````markdown
# Report template

The report is written FOR a non-technical site owner. It should read like something a consultant sends a client — not a log dump. Follow this structure exactly; adapt the prose to the actual findings.

## Structure

```markdown
# AI Visibility Audit — <domain>

**Overall score: <overall.score>/100 — <overall.grade>**
Audited <page URL> (<page_type>) on <YYYY-MM-DD> · ai-visibility-audit v0.1.0 + geo-inspector-mcp

## The short version

<3-4 sentences. What's helping, what's hurting, and the single most important fix
(the first item in `priorities`). Plain words only.>

## Scoreboard

| Area | Score | Weight | Status |
|---|---|---|---|
| AI Crawler Access | <score>/100 | 40% | <✅ ≥85 / ⚠️ 50-84 / ❌ <50> |
| Structured Data | ... | 25% | ... |
| Indexing Directives | ... | 20% | ... |
| llms.txt Adoption | ... | 15% | ... |

## <Category name> — <score>/100

**What we checked:** <one line>
**What we found:** <plain-language summary of the findings — no raw JSON, no jargon>
**Why it matters:** <concrete stakes, grounded in references/rubric.md>
**The fix:** <the finding fixes, verbatim intent, phrased for the owner>

<repeat per category, in scoreboard order. For an unassessed category, say what
couldn't be checked and why, and note the score was renormalized.>

## Fix first

| # | Fix | Why it matters | Effort | Who |
|---|---|---|---|---|
<one row per finding, in the scorer's `priorities` order. Effort: "Quick fix (≤1h)" /
"Small (≤1 day)" / "Project (>1 day)". Who: developer / content / hosting.>

## Methodology & limitations

<Which page was audited and its page-type classification. Point-in-time, single-page
check. JavaScript rendering not evaluated. robots.txt and llms.txt are site-wide;
schema and directives are page-specific. If assessed_weight < 100: which category
was skipped and that the overall score was renormalized accordingly.>
```

## Tone rules

- Every acronym or term of art gets a one-time plain definition: "JSON-LD (a small block of machine-readable page data)", "crawler (the software AI companies use to read websites)".
- Concrete stakes, not abstractions: "when someone asks ChatGPT about your industry, your site can't be quoted or cited" — not "reduced discoverability."
- No fearmongering. Blocked training crawlers and noai directives are **deliberate choices with trade-offs**; present both sides in one sentence each.
- Numbers always contextualized: "62/100 — most sites we see without an explicit AI policy land in this range" style is fine; invented statistics are not.
- Status icons: ✅ score ≥ 85, ⚠️ 50–84, ❌ < 50.

## Worked example excerpt (style calibration)

> ## AI Crawler Access — 62/100
>
> **What we checked:** which AI companies' crawlers (the software they use to read websites) your robots.txt file allows or blocks.
> **What we found:** Your site blocks OpenAI's search crawler (OAI-SearchBot), which means your pages can't appear in ChatGPT's web-search answers. You also block two training crawlers (GPTBot, CCBot) — that's a common, deliberate content-protection choice, and we've flagged it only so you can confirm it's intentional.
> **Why it matters:** AI search is becoming a primary way people find businesses. A blocked search crawler is the AI equivalent of being unlisted.
> **The fix:** Allow OAI-SearchBot in robots.txt (one line). Keep the training-crawler blocks if protecting content from model training matters more to you than future-model familiarity.
````

- [ ] **Step 2: Commit**

```bash
git add skills/audit/references/report-template.md
git commit -m "feat: client-readable report template with tone rules

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 10: README

**Files:**
- Create: `README.md`

- [ ] **Step 1: Create `README.md`** (exact content)

````markdown
# ai-visibility-audit

Ask Claude for a scored, client-ready **AI visibility audit** of any website: is the site readable, quotable, and citable by ChatGPT, Claude, Perplexity, and AI search?

<!-- demo GIF goes here: record /ai-visibility-audit:audit running against a real site -->

## Why this exists

AI assistants are becoming a primary way people find and cite content — and whether a site can appear in those answers comes down to plumbing: robots.txt rules for AI crawlers, schema.org markup, indexing directives, and the emerging llms.txt standard. [geo-inspector-mcp](https://github.com/Bigsupe55/geo-inspector-mcp) exposes those checks as raw tools (the **tool layer**). This plugin is the **workflow layer**: it orchestrates the tools into a deterministic 0–100 score and a report written for the site's owner, not for an engineer.

## Quickstart

```
/plugin marketplace add Bigsupe55/ai-visibility-audit
/plugin install ai-visibility-audit
/ai-visibility-audit:audit example.com
```

The bundled geo-inspector MCP server installs with the plugin (via `npx geo-inspector-mcp`).

## What you get

A markdown report with an overall score and grade, a category scoreboard (AI Crawler Access 40% · Structured Data 25% · Indexing Directives 20% · llms.txt 15%), plain-language findings, and a prioritized fix list with effort estimates. Sample excerpt:

> **Overall score: 74/100 — Good, gaps to close**
>
> Your site welcomes every AI crawler and has solid Organization markup. The two gaps: your blog posts ship no Article markup (so AI systems can't attribute them cleanly), and there's no llms.txt — an emerging standard you could adopt ahead of most of your competitors. Quickest high-impact fix: add the missing `sameAs` links so AI systems can tell your brand apart from similarly-named companies.

Scoring is **deterministic**: a bundled zero-dependency script computes every number from the tools' structured output, so the same site state always produces the same score. Claude writes the words; it never invents the math. Full rubric: [skills/audit/references/rubric.md](skills/audit/references/rubric.md). Worked examples: [examples/](examples/).

## Development

```bash
node --test        # scorer unit tests
claude plugin validate .  # manifest + skill validation
```

## License

MIT
````

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: README — why, quickstart, sample excerpt, rubric pointer

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 11: End-to-end verification, captured fixtures, worked examples

This task exercises the real plugin against real sites. It needs the geo-inspector server available under the name `geo-inspector`.

**Files:**
- Create: `tests/fixtures/<site>/robots.json` (+ llms/schema/meta) — captured during the run
- Create: `examples/<site>-report.md` × 2
- Modify: `tests/score.test.mjs` (append fixture regression test)

- [ ] **Step 1: Check whether geo-inspector-mcp is published**

Run: `npm view geo-inspector-mcp version`
- If it prints a version: the shipped `.mcp.json` works as-is; continue.
- If it 404s: for this test session only, point the server at Nick's local build. **Do not commit this change** — revert in Step 6:

```json
{
  "mcpServers": {
    "geo-inspector": {
      "command": "node",
      "args": ["C:\\Users\\Nick\\geo-inspector-mcp\\dist\\index.js"]
    }
  }
}
```

(If `dist/` is missing, run `npm run build` inside `C:\Users\Nick\geo-inspector-mcp` first.)

- [ ] **Step 2: Run the audit end-to-end on two real sites**

Preferred (headless): from the repo root run

```bash
claude --plugin-dir . -p "Use the audit skill from the ai-visibility-audit plugin to audit https://www.anthropic.com and write the report in the current directory."
```

and the same for a second, structurally different site (e.g. `https://stripe.com`). If `--plugin-dir` headless invocation is unavailable in the installed Claude Code version, fall back to an interactive session with Nick: `/plugin marketplace add C:\Users\Nick\ai-visibility-audit`, `/plugin install ai-visibility-audit`, then `/ai-visibility-audit:audit <url>`.

Expected per run: all four tools called; scorer executed; a `ai-visibility-audit-<domain>-<date>.md` report produced whose numbers match the scorer output.

- [ ] **Step 3: Read both reports critically**

Check against `references/report-template.md`: structure complete, tone rules followed, no raw JSON leakage, scores match the scorer JSON, priorities order preserved. Fix SKILL.md/template wording if the output drifts, and re-run.

- [ ] **Step 4: Capture fixtures and examples**

- Copy the four tool JSONs from each run's temp dir into `tests/fixtures/<domain>/` (e.g. `tests/fixtures/anthropic.com/robots.json`).
- Copy the two reports into `examples/`, named `<domain>-report.md`. Anonymize only if a site looks bad enough to embarrass someone.

- [ ] **Step 5: Append the fixture regression test**

```js
// ---------- Captured-fixture regression (spec §9) ----------
import { readdirSync } from "node:fs";

const FIXTURES = fileURLToPath(new URL("./fixtures/", import.meta.url));

for (const site of readdirSync(FIXTURES)) {
  test(`captured fixtures: ${site} produces a valid score document`, () => {
    const read = (n) => JSON.parse(readFileSync(join(FIXTURES, site, n), "utf8"));
    const inputs = { robots: read("robots.json"), llms: read("llms.json"), schema: read("schema.json"), meta: read("meta.json") };
    const doc = score(inputs, "homepage");
    assert.ok(doc.overall.score >= 0 && doc.overall.score <= 100);
    assert.equal(doc.categories.length, 4);
    for (const c of doc.categories) assert.equal(c.assessed, true);
  });
}
```

Add `readFileSync` to the existing `node:fs` import in the test file if not already imported.

Run: `node --test`
Expected: PASS — 37 unit tests + 2 fixture tests.

- [ ] **Step 6: Revert any temporary `.mcp.json` change**

Run: `git diff .mcp.json`
Expected: no diff (or restore with `git checkout -- .mcp.json` if the local-path variant is still in place).

- [ ] **Step 7: Commit**

```bash
git add tests/fixtures examples tests/score.test.mjs
git commit -m "test: captured real-site fixtures + worked example reports

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 12: Final review and wrap-up

- [ ] **Step 1: Full verification suite**

Run: `node --test` → all PASS.
Run: `claude plugin validate .` → no errors.
Run: `git status --short` → clean tree.

- [ ] **Step 2: Spec coverage walk**

Open `docs/superpowers/specs/2026-07-06-ai-visibility-audit-design.md` and confirm each of §3–§9 maps to shipped files (layout, scorer rules, SKILL.md steps, template sections, manifests, tests). Fix any gap found before proceeding.

- [ ] **Step 3: Report to Nick with the release checklist (his actions, not yours)**

1. `npm publish` in `C:\Users\Nick\geo-inspector-mcp` (prerequisite for the shipped `.mcp.json`), then re-run one audit with the published package.
2. Create public GitHub repo `Bigsupe55/ai-visibility-audit` and say the word to push (pushing requires Nick's explicit go).
3. Record the README demo GIF; LinkedIn Featured + build-log post; submit to plugin directories.

Do **not** push, publish, or create remote repos autonomously.
