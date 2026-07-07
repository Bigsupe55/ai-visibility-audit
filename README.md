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
