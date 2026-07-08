# AI Visibility Audit — anthropic.com

**Overall score: 60/100 — Needs work**
Audited https://www.anthropic.com/ (homepage) on 2026-07-07 · ai-visibility-audit v0.1.0 + geo-inspector-mcp

## The short version

Anthropic's homepage rolls out the welcome mat for every AI crawler — 15 of 15 are explicitly allowed, and the page has clean indexing directives with nothing blocking AI access. The problem is what's missing: the homepage carries no machine-readable description of the organization (no JSON-LD, the small blocks of structured data that help AI systems understand *who* the site is), and there is no llms.txt file (a concise AI-readable index that an increasing number of AI systems look for). The single most important fix is adding an Organization JSON-LD block — it takes a developer half a day and immediately tells every AI system the site's name, URL, logo, and official social profiles without relying on the AI to guess from marketing copy.

## Scoreboard

| Area | Score | Weight | Status |
|---|---|---|---|
| AI Crawler Access | 100/100 | 40% | ✅ |
| Structured Data | 0/100 | 25% | ❌ |
| Indexing Directives | 100/100 | 20% | ✅ |
| llms.txt Adoption | 0/100 | 15% | ❌ |

## AI Crawler Access — 100/100

**What we checked:** which AI companies' crawlers (the software they use to read websites) robots.txt allows or blocks.
**What we found:** All 15 crawlers we track are explicitly allowed via a single `Allow: /` rule applied to the wildcard group — meaning every AI company's reader, from OpenAI's GPTBot to Perplexity's PerplexityBot to Anthropic's own ClaudeBot, can access the site freely. A sitemap is declared at `/sitemap.xml`, which helps crawlers discover content efficiently.
**Why it matters:** Crawler access is the foundation. A blocked search crawler (one that feeds AI-generated answers) removes the site from AI citations entirely. A blocked on-demand fetcher means an AI assistant can't read the page live when a user asks about it. None of that applies here.
**The fix:** Nothing to change. The crawler policy is as open as it can be.

## Structured Data — 0/100

**What we checked:** JSON-LD structured data blocks (small, invisible snippets of machine-readable page description) embedded in the homepage HTML.
**What we found:** Zero JSON-LD blocks. The homepage ships no machine-readable description of the organization — no name, no logo, no official social-profile links, no indication that this is a WebSite rather than an arbitrary web page. AI systems reading the page must infer everything from raw marketing text.
**Why it matters:** When someone asks ChatGPT or Perplexity "who is Anthropic?", those systems build their answer partly from structured data. An Organization block with `sameAs` links to LinkedIn, Wikipedia, and Twitter lets AI systems confidently identify Anthropic as a specific entity — rather than falling back on training data that may be out of date or conflated with similarly named organizations. The homepage point table for a missing Organization block alone is 35 out of 100 for this category.
**The fix:** Add at minimum an `Organization` JSON-LD block (name, url, logo, sameAs pointing to official profiles) and a `WebSite` block. Both together take a developer roughly half a day to write and deploy.

## Indexing Directives — 100/100

**What we checked:** meta robots tags (HTML instructions telling crawlers what to do with the page) and X-Robots-Tag HTTP headers, including any AI-specific directives like `noai` or `noimageai`.
**What we found:** No meta robots tags and no X-Robots-Tag headers at all. The page is fully indexable and followable, and there are no AI-specific restrictions in place.
**Why it matters:** A `noindex` directive would make the page invisible to classic search and AI systems alike. A `noai` directive would explicitly ask AI systems not to use the page's content. Neither is present, so the page is fully available for AI indexing and citation.
**The fix:** Nothing to change.

## llms.txt Adoption — 0/100

**What we checked:** whether `/llms.txt` and `/llms-full.txt` are published at the site root, and whether they follow the llmstxt.org specification (H1 title, optional summary blockquote, H2 link sections).
**What we found:** Neither file exists — both return HTTP 404. llms.txt is a concise, AI-readable site index: think of it as a table of contents written specifically for AI systems rather than human browsers. The standard is still early (adopted by a minority of sites), so this is an emerging gap rather than an active failure.
**Why it matters:** As AI assistants increasingly use llms.txt to understand a site's structure before answering questions about it, sites that publish one have a head start. For a company in the AI industry whose audience includes developers building AI products, early adoption here also signals technical credibility.
**The fix:** Publish `/llms.txt` — an H1 with the site name, a one-sentence summary blockquote, then H2 sections linking to key pages (Documentation, Research, Careers, etc.). This is a content task, not a code task; a content manager can draft it in a day. Optionally add `/llms-full.txt` with expanded page text for AI systems that want the full content.

## Fix first

| # | Fix | Why it matters | Effort | Who |
|---|---|---|---|---|
| 1 | Add Organization (and WebSite) JSON-LD to the homepage | AI systems must guess the site's identity from marketing copy; structured data gives them a definitive answer | Small (≤1 day) | Developer |
| 2 | Publish /llms.txt | Early-adopter advantage; especially credible for an AI company whose audience is AI builders | Small (≤1 day) | Content |

## Methodology & limitations

This audit checked the homepage (`https://www.anthropic.com/`, classified as `homepage`) on 2026-07-07. All four tools ran successfully; the overall score is based on all 100 assessed weight points.

**Point-in-time, single-page check.** robots.txt and llms.txt are site-wide signals; schema markup and indexing directives are page-specific. Other pages on the site (blog posts, docs, research papers) may carry structured data not reflected here.

**JavaScript rendering not evaluated.** The structured-data check reads static HTML. If JSON-LD is injected by client-side JavaScript after the initial HTML load, it would not appear in these results — though AI crawlers typically process the rendered DOM, so server-side or static JSON-LD is still the more reliable approach.

**Crawler intent not inferred.** Blocking training crawlers (GPTBot, CCBot, etc.) is a legitimate content-protection choice with a trade-off: future AI models trained without the site's content will be less familiar with it. Anthropic currently allows all training crawlers; this report treats that as the intended policy.
