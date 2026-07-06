# AI Visibility Audit — Claude Code Plugin (Phase 2) — Design Spec

Date: 2026-07-06
Status: Approved by Nick (2026-07-06)
Repo: `C:\Users\Nick\ai-visibility-audit` → to be published as `Bigsupe55/ai-visibility-audit` (public)

## 1. Context and goals

Phase 2 of Nick's public GEO portfolio. Phase 1 (`geo-inspector-mcp`, github.com/Bigsupe55/geo-inspector-mcp) is a shipped MCP server exposing four atomic website-inspection tools. This project is the **workflow layer**: a Claude Code skill, packaged as a plugin that bundles the skill plus the Phase 1 MCP server config, so one install gives users both.

Given a URL, the skill runs an audit using the Phase 1 tools and produces a **scored, client-readable markdown report** for a non-technical site owner. The portfolio narrative is "tool layer (MCP server) vs. workflow layer (skill)."

Constraints:

- **Original rubric.** Nothing copied from Nick's private GEO agency toolkit (its internals were deliberately not read during this design). The rubric derives only from public specs (RFC 9309, llmstxt.org, schema.org) and the public crawler purpose-taxonomy in geo-inspector-mcp.
- **README is the product.** Demo GIF at top, "why this exists," 3-line quickstart, sample report excerpt.
- **Small and finishable.** MIT license. Mostly SKILL.md authoring, rubric design, one small script.
- Phase 1 tools are treated as a stable public API; no scoring or report logic goes into the server.

## 2. Decisions log

| Decision | Choice |
|---|---|
| Plugin/repo name | `ai-visibility-audit` |
| Report format | Markdown only (PDF/HTML export deferred) |
| Phase 1 npm dependency | Nick publishes `geo-inspector-mcp` to npm; development/testing uses his local build; shipped `.mcp.json` uses `npx -y geo-inspector-mcp` |
| Architecture | **B: SKILL.md orchestration + deterministic scorer script.** Claude calls tools and writes the narrative; a bundled zero-dependency Node script computes all scores mechanically (same inputs → same score, unit-tested) |
| Scoring weights | Crawler Access 40 / Structured Data 25 / Indexing Directives 20 / llms.txt 15 (approved as proposed) |

## 3. Repo layout

```
ai-visibility-audit/
├── .claude-plugin/
│   ├── plugin.json              # manifest: name, version 0.1.0, description, author
│   └── marketplace.json         # self-marketplace; one plugin entry with source: "./"
├── .mcp.json                    # {"mcpServers": {"geo-inspector": {"command": "npx", "args": ["-y", "geo-inspector-mcp"]}}}
├── skills/
│   └── audit/                   # invoked as /ai-visibility-audit:audit
│       ├── SKILL.md
│       ├── references/
│       │   ├── rubric.md        # human-readable rubric + rationale (mirrors §5, the scorer is authoritative)
│       │   └── report-template.md
│       └── scripts/
│           └── score.mjs        # deterministic scorer, zero-dep ESM, Node >= 20
├── tests/
│   ├── fixtures/                # captured + synthetic structuredContent JSONs
│   └── score.test.mjs           # node:test
├── examples/                    # 2 worked example reports from real public sites
├── docs/superpowers/specs/      # this spec
├── README.md
└── LICENSE                      # MIT
```

Install story: `/plugin marketplace add Bigsupe55/ai-visibility-audit` → `/plugin install ai-visibility-audit`. Marketplace name = `ai-visibility-audit`, owner = Nick Hernandez. The bundled MCP server goes through Claude Code's normal per-server approval.

## 4. Phase 1 tool contract (inputs to the scorer)

All four tools return human text plus `structuredContent`. Errors return `isError: true` with **no** `structuredContent`. Shapes as implemented (authoritative source: `C:\Users\Nick\geo-inspector-mcp\src\tools\*.ts`):

- `check_robots_txt(url, path?)` → `{robotsUrl, fetched: bool, status, path, sitemaps[], groupCount, crawlers[]}`; each crawler `{name, vendor, purpose: "training"|"search"|"user_fetch", access: "allowed"|"blocked", matchedGroup, matchedRule}`. 15-crawler inventory: 3 search, 3 user_fetch, 9 training. Server 5xx ⇒ `fetched: false`, all blocked (RFC 9309); 4xx ⇒ `fetched: false`, all allowed.
- `fetch_llms_txt(url)` → `{files[]}`; llms.txt entry: `{file, url, present, status?, bytes?, valid?, title?, hasSummary?, sections?, warnings?, oversized?}`; llms-full.txt entry: `{file, url, present, status?, bytes?, valid?, title?, warnings?, oversized?}`.
- `detect_schema_markup(url)` → `{pageUrl, blockCount, parseErrors, typeCounts{}, aiRelevant: {Organization, WebSite, Article, FAQPage, BreadcrumbList, Person → bool}, entities[]}`; each entity `{types[], name?, hasSameAs}`.
- `check_meta_directives(url)` → `{pageUrl, status, metaTags[{name, directives[]}], xRobotsTag[{agent, directives[]}], summary: {indexable, followable, aiDirectives[]}}`.

## 5. Scorer specification (`skills/audit/scripts/score.mjs`)

CLI: `node score.mjs <dir> [--page-type homepage|article|other]` (default `homepage`). Reads `robots.json`, `llms.json`, `schema.json`, `meta.json` from `<dir>` — each file is either a tool's `structuredContent` or the sentinel `{"error": "<message>"}` written by the skill when a tool failed. Missing file ≡ error sentinel. Prints one JSON document to stdout. Zero dependencies; Node >= 20.

### 5.1 Category: AI Crawler Access — weight 40

From `robots.json`. Start at 100, subtract per **blocked** crawler by purpose, floor at 0:

| Purpose | Penalty each | Rationale |
|---|---|---|
| `search` (3 crawlers) | −15 | Directly removes the site from AI search answers/citations |
| `user_fetch` (3 crawlers) | −10 | Blocks live retrieval when a user asks an assistant about the site |
| `training` (9 crawlers) | −2 | Legitimate policy choice; costs future-model familiarity only. Framed in the report as a choice, not a defect |

Special cases: `fetched: false` with 5xx status ⇒ category score 0 and a single **Critical** finding (unreachable robots.txt means total disallow per RFC 9309). `fetched: false` with 4xx ⇒ all allowed ⇒ 100, plus a Low informational finding ("no robots.txt — fine, but you have no crawler policy"). Sitemap absence: Low informational finding, no point impact (not a robots concern per se).

Findings: one per blocked crawler-group, grouped by vendor+purpose for readability (e.g. "OpenAI search crawler blocked (`OAI-SearchBot`, line: `Disallow: /`)"), citing `matchedGroup`/`matchedRule`.

### 5.2 Category: Structured Data — weight 25

From `schema.json`. If `blockCount == 0` ⇒ score 0 with one High finding ("no JSON-LD structured data at all"). Otherwise sum points for present items per page type (N/A items are excluded from both earning and penalty):

| Signal | homepage | article | other |
|---|---|---|---|
| Organization | 35 | 20 | 30 |
| WebSite | 20 | 10 | 15 |
| sameAs disambiguation¹ | 20 | 10 | 15 |
| BreadcrumbList | 5 | 10 | 10 |
| FAQPage | 10 | N/A | 15 |
| Person | 10 | 15 | 15 |
| Article² | N/A | 35 | N/A |

¹ Satisfied when ≥1 entity has `hasSameAs: true` and a type of `Organization` or `Person`.
² The tool's `aiRelevant.Article` already covers Article/NewsArticle/BlogPosting.

Each column sums to 100. Penalty after summing: −10 per `parseErrors` (cap −30), floor 0. Missing-signal findings use the point value as `points_lost`; parse errors are one finding.

### 5.3 Category: Indexing Directives — weight 20

From `meta.json`. `summary.indexable == false` ⇒ score 0, **Critical** finding (invisible to both classic and AI search). Otherwise start at 100: `summary.followable == false` ⇒ −30 (High); each **unique** directive in `summary.aiDirectives` ⇒ −20, framed like training-bot blocking (deliberate choice with a visibility cost). Floor 0.

### 5.4 Category: llms.txt Adoption — weight 15

From `llms.json`, using the `llms.txt` entry, checked in this order (oversized entries carry no `valid` field): absent ⇒ 0; present + `oversized: true` ⇒ 55 (llms.txt is meant to be a concise index; too large to validate); present + `valid: true` ⇒ 90; present + `valid: false` ⇒ 55 (findings from `warnings[]`). Bonus: +10 if `llms-full.txt` is present (oversized still counts), cap 100. **Framing rule:** absence is reported as "emerging standard — early-adopter advantage available," never as a defect; see severity cap in §5.5.

### 5.5 Severity, effort, priorities

`weighted_loss = points_lost_in_category × category_weight / 100`.

- **Critical**: two enumerated emergencies only — robots.txt unreachable (5xx) and `indexable: false`. (Other category-zeroing states, like having no JSON-LD at all or no llms.txt, are deliberately *not* Critical: they are common baseline conditions, not emergencies.)
- **High**: `weighted_loss ≥ 4`.
- **Medium**: `weighted_loss ≥ 2`.
- **Low**: otherwise.
- Override: all llms.txt-category findings cap at **Medium** (consistent with the emerging-standard framing).

Effort tags from a fixed lookup: robots.txt rule change / meta-or-header directive change / fix invalid llms.txt → **Quick fix (≤1h)**; add a schema type / fix JSON-LD parse errors / create llms.txt → **Small (≤1 day)**; create llms-full.txt content program → **Project (>1 day)**.

Priority order: severity (Critical→Low), then effort (Quick fix→Project), then `weighted_loss` descending.

### 5.6 Overall score and output shape

`overall = round(Σ assessed (score_c × weight_c) / Σ assessed weight_c)`. A category whose input is an error sentinel is `assessed: false` and its weight is excluded (renormalization); the output records `assessed_weight` so the report can flag partial audits. Grade bands: 85–100 **AI-ready**; 70–84 **Good — gaps to close**; 50–69 **Needs work**; 0–49 **At risk**.

Output JSON:

```json
{
  "version": "0.1.0",
  "page_type": "homepage",
  "categories": [
    {"id": "crawler_access", "label": "AI Crawler Access", "weight": 40,
     "assessed": true, "score": 62,
     "findings": [{"id": "crawler_access.blocked.openai_search", "severity": "high",
                    "effort": "quick_fix", "points_lost": 15, "weighted_loss": 6,
                    "title": "...", "detail": "...", "fix": "...", "owner": "developer"}]}
  ],
  "overall": {"score": 74, "grade": "Good — gaps to close", "assessed_weight": 100}
}
```

`owner` ∈ `developer` | `content` | `hosting` (fixed per finding type; feeds the report's "who does it" column).

## 6. Skill specification (`skills/audit/SKILL.md`)

Frontmatter: `name: audit`; description triggers on "AI visibility audit", "audit <url>", "AI search readiness", "GEO audit" etc.

Procedure the skill instructs:

1. Determine target URL from the user request. Classify `--page-type`: homepage if the URL is the site root, `article` if it is clearly a post/article page, else `other`. State the classification in the report's methodology note.
2. Call all four geo-inspector tools on the URL (`check_robots_txt`, `fetch_llms_txt`, `detect_schema_markup`, `check_meta_directives`). On a tool error, retry once; if it still fails, record the error sentinel.
3. Write the four `structuredContent` payloads (or sentinels) to a temporary working directory as `robots.json` / `llms.json` / `schema.json` / `meta.json`.
4. Run `node <plugin>/skills/audit/scripts/score.mjs <dir> --page-type <t>` (path via `${CLAUDE_PLUGIN_ROOT}`), parse the JSON.
5. Write the report per `references/report-template.md` to `ai-visibility-audit-<domain>-<YYYY-MM-DD>.md` in the working directory the user is in. Never alter the numbers: scores, severities, and priority order come from the scorer verbatim; the skill's job is translation into plain language.
6. If **all four** tools failed: no report — explain the connectivity problem and stop.
7. Optional secondary content-page URL (if the user supplies one): run `detect_schema_markup` + `check_meta_directives` on it and add an **informational appendix** (findings only, explicitly excluded from the score). Robots/llms.txt are origin-level and are not re-run.

## 7. Report template (`references/report-template.md`)

Audience: non-technical site owner; consultant-quality. Sections:

1. **Header** — site, date, overall score + grade, "audited with ai-visibility-audit v0.1.0 + geo-inspector-mcp".
2. **The short version** — 3–4 sentences: what's helping, what's hurting, the single most important fix.
3. **Scoreboard** — table: category | score/100 | weight | status (✅/⚠️/❌).
4. **Per category** — "What we checked" (1 line) / "What we found" (plain language) / "Why it matters" (concrete stakes, e.g. "when someone asks ChatGPT about your industry, your site can't be quoted or cited") / "The fix" (exact, actionable).
5. **Fix first** — table: # | fix | why it matters | effort | who does it (developer/content/hosting), in the scorer's priority order.
6. **Methodology & limitations** — which page, when, page-type classification, single-page point-in-time scope, JS rendering not evaluated, partial-audit flag if `assessed_weight < 100`.

Tone rules baked into the template: every acronym defined once in plain words; no fearmongering — training-crawler and `noai` blocks are described as deliberate choices with trade-offs; numbers always contextualized.

## 8. Packaging manifests

- `plugin.json`: `{"name": "ai-visibility-audit", "version": "0.1.0", "description": "Run a scored AI-search visibility audit of any website and get a client-ready report — powered by the geo-inspector-mcp tools.", "author": {"name": "Nick Hernandez"}}`
- `marketplace.json`: `{"name": "ai-visibility-audit", "owner": {"name": "Nick Hernandez"}, "plugins": [{"name": "ai-visibility-audit", "source": "./", "description": "<same description as plugin.json>", "version": "0.1.0"}]}`
- `.mcp.json`: geo-inspector via `npx -y geo-inspector-mcp` (works once Phase 1 is on npm).

## 9. Testing and verification

- **Unit**: `node --test tests/` — scorer against fixtures: captured real outputs (generated via the local Phase 1 build) plus synthetic edge cases (all crawlers blocked; robots 5xx; robots 404; no JSON-LD; parse errors; noindex; noai; invalid llms.txt; oversized llms.txt; each error-sentinel combination; every page type). Assert scores, severities, renormalization, and priority ordering.
- **Manifest**: `claude plugin validate .` passes.
- **End-to-end** (verification-before-completion): install the plugin locally, run `/ai-visibility-audit:audit` against 2+ real public sites, read the generated reports for quality; polish, then save those runs (anonymized if needed) as `examples/`.
- Development uses a local MCP config pointing at `C:\Users\Nick\geo-inspector-mcp\dist\index.js`; the shipped `.mcp.json` is verified after Nick runs `npm publish` on Phase 1.

## 10. Release checklist (after implementation)

1. Nick: `npm publish` geo-inspector-mcp (prerequisite for the shipped `.mcp.json`).
2. Re-run e2e with the published package via `npx`.
3. Nick: create public GitHub repo `Bigsupe55/ai-visibility-audit`, push (push only on Nick's explicit go).
4. README demo GIF recording; LinkedIn Featured + build-log post; submit where discoverable (Nick's follow-ups, out of session scope).

## 11. Out of scope for v1

PDF/HTML export; multi-page crawling; scoring or report logic inside the MCP server; comparison/delta reports; CRM features; `citability_snapshot` (until it exists in Phase 1); non-English report localization.
