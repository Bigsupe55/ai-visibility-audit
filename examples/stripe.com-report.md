# AI Visibility Audit — stripe.com

**Overall score: 92/100 — AI-ready**
Audited https://stripe.com/ (homepage) on 2026-07-07 · ai-visibility-audit v0.1.0 + geo-inspector-mcp

---

## The short version

Stripe is in excellent shape for AI search. Every AI crawler is allowed in — OpenAI's, Anthropic's, Perplexity's, and more — and the page carries no indexing restrictions that would hide it from AI systems. Stripe has also published a well-structured llms.txt (a concise, AI-readable index of the site), putting it ahead of the vast majority of the web. The only meaningful gap is in structured data (the small, machine-readable blocks of page description that help AI systems understand who Stripe is and what it does): the homepage is missing three schema types that would strengthen how AI assistants attribute and describe the company. The single most important fix is adding FAQPage markup if the homepage answers common questions — a one-day developer task.

---

## Scoreboard

| Area | Score | Weight | Status |
|---|---|---|---|
| AI Crawler Access | 100/100 | 40% | ✅ |
| Structured Data | 75/100 | 25% | ⚠️ |
| Indexing Directives | 100/100 | 20% | ✅ |
| llms.txt Adoption | 90/100 | 15% | ✅ |

---

## AI Crawler Access — 100/100

**What we checked:** Which AI companies' crawlers (the software they use to read websites) your robots.txt file allows or blocked, evaluated for the site root path.

**What we found:** All 15 tracked AI crawlers are allowed — including search crawlers from OpenAI (OAI-SearchBot), Anthropic (Claude-SearchBot), and Perplexity (PerplexityBot); on-demand fetchers (ChatGPT-User, Claude-User, Perplexity-User) that retrieve pages live when a user asks a question; and training crawlers (GPTBot, ClaudeBot, Google-Extended, and others) that build AI model knowledge. The robots.txt file is reachable and properly served, and it includes a sitemap declaration pointing crawlers to the full content index.

**Why it matters:** Crawler access is the foundation of AI visibility — no matter how good the structured data or indexing setup, a blocked crawler cannot read, quote, or cite the site. Allowing search crawlers means Stripe's pages can appear in AI-generated answers and citations. Allowing on-demand fetchers means assistants can read Stripe pages live when users ask about them. Allowing training crawlers means future AI models build familiarity with Stripe's content over time.

**The fix:** Nothing to do — this category is fully covered.

---

## Structured Data — 75/100

**What we checked:** JSON-LD (a small block of machine-readable page data embedded in the page's HTML) — specifically the schema.org types that most affect AI discoverability: Organization, WebSite, Article, FAQPage, BreadcrumbList, and Person, plus sameAs disambiguation links.

**What we found:** The homepage ships one JSON-LD block with two types: Organization (with sameAs links to official profiles, which is the most important disambiguation signal) and WebSite. These two together give AI systems a solid foundation for knowing who Stripe is. What's missing: FAQPage markup (for any Q&A content on the page), Person markup (for the people behind the company — founders, leadership), and BreadcrumbList markup (for the page's position in the site structure). No parse errors were found — all existing markup is valid.

**Why it matters:** JSON-LD is how a site explicitly tells AI systems who it is and what it contains. The existing Organization + sameAs combination is the most valuable signal — it lets AI systems correctly attribute Stripe content and link it to the right entity across the web. The missing types would sharpen that picture: FAQPage content is commonly surfaced verbatim in AI-generated answers; Person markup links leadership to the company entity; BreadcrumbList helps AI systems understand content hierarchy. Together, they're responsible for 25% of the overall score — and the gap is three small developer tasks.

**The fixes:**
- **FAQPage:** If any section of the homepage answers a common question (pricing, how Stripe works, etc.), wrap it in FAQPage JSON-LD. AI systems frequently quote FAQ content word-for-word in answers.
- **Person:** Add Person JSON-LD for Stripe's founders or key leadership (name, role, URL to their profile). This connects people to the company entity in AI knowledge graphs.
- **BreadcrumbList:** Add BreadcrumbList JSON-LD reflecting that this page is the site root (a single-item list is valid and sufficient for a homepage).

---

## Indexing Directives — 100/100

**What we checked:** Meta robots tags (HTML directives that tell crawlers what to do with a page) and X-Robots-Tag response headers — including AI-specific directives like `noai` and `noimageai`.

**What we found:** No restrictions of any kind. The page is fully indexable, links are followable, and there are no AI-specific directives asking systems to skip or not quote the content. Both the HTML and the HTTP headers are clean.

**Why it matters:** A noindex directive would silently remove the page from both classic and AI search — it's one of the most severe and easy-to-miss mistakes. AI-specific directives like `noai` ask AI systems to exclude the content from responses; like blocking training crawlers, these are legitimate choices, but they carry a visibility cost. Stripe carries none of these — the page is fully open.

**The fix:** Nothing to do — this category is fully covered.

---

## llms.txt Adoption — 90/100

**What we checked:** Whether the site publishes `/llms.txt` and `/llms-full.txt`, and whether llms.txt follows the llmstxt.org spec (an H1 title, an optional summary blockquote, and H2 sections with links).

**What we found:** Stripe publishes a valid, well-structured llms.txt at https://stripe.com/llms.txt. It has a proper title ("Stripe"), a summary, and 28 organized sections covering every major product area — Payments, Connect, Billing, Radar, Issuing, and more — plus documentation, resources, and an Optional section with 155 deep links. The file is 64 KB, which is on the larger side for an index but still within spec. There is no llms-full.txt (the companion file that carries expanded page content for AI systems that want more detail).

**Why it matters:** llms.txt is an emerging standard — a concise, AI-readable guide to a site that helps AI assistants navigate the content quickly. Adoption is still early across the web, so having a valid one is already a meaningful advantage. The missing llms-full.txt is the only gap: it would give AI systems that want to go deeper a single document with the full text of key pages, rather than requiring them to crawl individually.

**The fix:** Consider publishing `/llms-full.txt` with the full text of key documentation and product pages. This is a content program (more than a day's work) rather than a quick technical change — it's worth doing eventually but is not urgent.

---

## Fix first

| # | Fix | Why it matters | Effort | Who |
|---|---|---|---|---|
| 1 | Add FAQPage JSON-LD for any Q&A content on the homepage | FAQ content is frequently quoted verbatim in AI answers | Small (≤1 day) | Developer |
| 2 | Add Person JSON-LD for founders or key leadership | Connects people to the Stripe entity in AI knowledge graphs | Small (≤1 day) | Developer |
| 3 | Add BreadcrumbList JSON-LD for the homepage (single-item list is fine) | Helps AI systems understand the page's place in the site structure | Small (≤1 day) | Developer |
| 4 | Publish /llms-full.txt with full text of key pages | Gives AI systems a single deep-read document, reducing crawl burden | Project (>1 day) | Content |

---

## Methodology & limitations

This audit checked the Stripe homepage (https://stripe.com/, classified as `homepage`) on 2026-07-07 using four automated inspection tools. It is a point-in-time, single-page check.

- **robots.txt and llms.txt** are evaluated at the site level (they apply to the whole origin, not one page).
- **Structured data and indexing directives** are evaluated for the homepage URL only; other pages on the site may differ.
- **JavaScript rendering** was not evaluated. The structured data and meta directives reflect what is present in the initial HTML response; any markup injected by client-side JavaScript is not included.
- All four categories were assessed; `assessed_weight` is 100, so the overall score reflects the full rubric with no renormalization.
