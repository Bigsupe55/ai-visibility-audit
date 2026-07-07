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
