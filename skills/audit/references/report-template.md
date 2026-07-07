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
