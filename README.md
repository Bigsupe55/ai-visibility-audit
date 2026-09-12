# ai-visibility-audit

[![Claude Code plugin](https://img.shields.io/badge/Claude%20Code-plugin-6b4fbb)](https://docs.claude.com/en/docs/claude-code)
[![license](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

**An agent workflow that turns four MCP tools into one scored, client-ready report.**
Ask Claude whether a site is readable, quotable, and citable by ChatGPT, Claude,
Perplexity, and AI search, and get back a document you could hand to the site's owner.

A Claude Code plugin, not a library. It is a skill that orchestrates the
[geo-inspector-mcp](https://github.com/Bigsupe55/geo-inspector-mcp) server (the tool
layer) plus a zero-dependency scoring script, bundled together so `/plugin install` is
the entire setup.

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

## How it is built

This repo exists to answer a specific question: **where do you put the judgment?**

An LLM asked to score a website will produce a plausible number that moves every time
you ask. That is fine for prose and useless for a report someone is going to act on, or
compare against last quarter's.

So the work is split down the middle, and the split is enforced by the file layout:

| Layer | Who does it | Why |
| --- | --- | --- |
| Fetch and parse | MCP server, pure functions | Deterministic, testable, no model involved |
| **Scoring** | **`skills/audit/scripts/score.mjs`** | **Every number traces to a rule in the rubric. Same site state, same score, always.** |
| Findings and prose | Claude, reading the structured output | The part that genuinely needs judgment and audience awareness |
| Report assembly | The skill, against a fixed template | Consistent shape across runs and across sites |

**Claude writes the words. It never invents the math.** The scorer reads the tools'
`structuredContent`, not the model's summary of it, so there is no path for a
hallucinated number to reach the report. The full rubric is checked in at
[skills/audit/references/rubric.md](skills/audit/references/rubric.md), with the weights
in the open, so a client can argue with the methodology instead of with a black box.

The scorer is plain Node with no dependencies and its own unit tests, which means the
numbers in a report can be reproduced without Claude, an API key, or the plugin.

## Development

```bash
node --test        # scorer unit tests
claude plugin validate .  # manifest + skill validation
```

## License

MIT, see [LICENSE](LICENSE).
