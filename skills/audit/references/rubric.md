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
