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
