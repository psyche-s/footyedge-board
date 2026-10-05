/**
 * FootyEdge — Football Whispers cross-check
 * Vercel Serverless Function
 *
 * Route:
 *   /api/whispers?home=Cyprus&away=Latvia&date=2026-10-05
 *
 * Returns:
 * {
 *   found: boolean,
 *   hotTip: string | null,
 *   correctScore: string | null,
 *   matchResult: string | null,
 *   btts: string | null,
 *   keyStats: string[],
 *   url: string | null,
 *   title: string | null,
 *   source: "Football Whispers",
 *   fetchedAt: string
 * }
 *
 * No API key is required.
 */

const FW_BASE = "https://footballwhispers.com";
const CACHE_SECONDS = 1800;

const TEAM_ALIASES = {
  "turkiye": ["turkiye", "turkey"],
  "turkey": ["turkey", "turkiye"],
  "bosniaherzegovina": ["bosnia-herzegovina", "bosnia-herzegovina", "bosnia"],
  "bosniaandherzegovina": ["bosnia-herzegovina", "bosnia"],
  "northernireland": ["northern-ireland", "northern ireland"],
  "northmacedonia": ["north-macedonia", "north macedonia", "macedonia"],
  "southkorea": ["south-korea", "south korea", "korea-republic"],
  "unitedstates": ["usa", "united-states", "united states"],
  "usa": ["usa", "united-states", "united states"],
  "czechia": ["czechia", "czech-republic", "czech republic"],
  "czechrepublic": ["czech-republic", "czechia"],
  "drcongo": ["dr-congo", "congo-dr", "democratic-republic-of-congo", "congo dr"],
  "congodr": ["congo-dr", "dr-congo", "democratic-republic-of-congo"],
  "stlucia": ["st-lucia", "saint-lucia", "st lucia"],
  "stkittsandnevis": ["st-kitts-and-nevis", "saint-kitts-and-nevis", "st kitts and nevis"],
};

function cleanText(value = "") {
  return String(value)
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#039;|&apos;/gi, "'")
    .replace(/&ndash;|&#8211;/gi, "–")
    .replace(/&mdash;|&#8212;/gi, "—")
    .replace(/&pound;/gi, "£")
    .replace(/&#x27;/gi, "'")
    .replace(/&#\d+;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripTags(html = "") {
  return cleanText(
    String(html)
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/<\/p>/gi, " ")
      .replace(/<\/li>/gi, " ")
      .replace(/<[^>]+>/g, " ")
  );
}

function normalized(value = "") {
  return cleanText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function compact(value = "") {
  return normalized(value).replace(/\s+/g, "");
}

function slugify(value = "") {
  return normalized(value).replace(/\s+/g, "-");
}

function teamVariants(name = "") {
  const key = compact(name);
  const base = [
    normalized(name),
    slugify(name),
    compact(name),
  ];

  const aliases = TEAM_ALIASES[key] || [];
  return [...new Set([...base, ...aliases.map(normalized), ...aliases.map(slugify)])]
    .filter(Boolean);
}

function dateParts(date = "") {
  const m = String(date).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return {
    yyyy: m[1],
    mm: m[2],
    dd: m[3],
    dmy: `${m[3]}-${m[2]}-${m[1]}`,
  };
}

async function fetchText(url, timeoutMs = 9000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; FootyEdge/1.0; +https://vercel.app)",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Cache-Control": "no-cache",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return {
      url: response.url || url,
      html: await response.text(),
    };
  } finally {
    clearTimeout(timer);
  }
}

function hrefsFromHtml(html = "") {
  const found = new Set();

  const absolute =
    /href\s*=\s*["'](https?:\/\/(?:www\.)?footballwhispers\.com\/blog\/[^"'#?]+)["']/gi;
  const relative = /href\s*=\s*["'](\/blog\/[^"'#?]+)["']/gi;

  let match;

  while ((match = absolute.exec(html))) {
    found.add(match[1].replace(/\/?$/, "/"));
  }

  while ((match = relative.exec(html))) {
    found.add((FW_BASE + match[1]).replace(/\/?$/, "/"));
  }

  return [...found];
}

function urlMatchScore(url, home, away, date) {
  const slug = normalized(
    decodeURIComponent(
      String(url)
        .replace(/^https?:\/\/[^/]+/i, "")
        .replace(/^\/blog\//i, "")
        .replace(/\/$/, "")
    )
  );

  const homeVars = teamVariants(home);
  const awayVars = teamVariants(away);

  const hasHome = homeVars.some((v) => {
    const n = normalized(v);
    return n && slug.includes(n);
  });

  const hasAway = awayVars.some((v) => {
    const n = normalized(v);
    return n && slug.includes(n);
  });

  let score = 0;
  if (hasHome) score += 45;
  if (hasAway) score += 45;

  if (slug.includes("prediction")) score += 8;
  if (slug.includes("betting tips")) score += 2;

  const parts = dateParts(date);
  if (parts && slug.includes(normalized(parts.dmy))) score += 6;

  return score;
}

function findBestArticleUrl(html, home, away, date) {
  const links = hrefsFromHtml(html)
    .map((url) => ({ url, score: urlMatchScore(url, home, away, date) }))
    .sort((a, b) => b.score - a.score);

  return links[0] && links[0].score >= 80 ? links[0].url : null;
}

function captureAfter(text, labels, stopLabels, max = 120) {
  const escapedLabels = labels
    .map((x) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|");

  const escapedStops = stopLabels
    .map((x) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|");

  const rx = new RegExp(
    `(?:${escapedLabels})\\s*[:\\-–—]?\\s*([\\s\\S]{1,${max}}?)(?=\\s*(?:${escapedStops})|$)`,
    "i"
  );

  const m = text.match(rx);
  return m ? cleanText(m[1]) : null;
}

function extractTitle(html) {
  const og = html.match(
    /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i
  );
  if (og) return cleanText(og[1]);

  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  return h1 ? stripTags(h1[1]) : null;
}

function extractHotTip(text) {
  let value = captureAfter(
    text,
    ["Our Hot tip", "Hot tip", "Top tip", "Our prediction"],
    [
      "Correct score",
      "Match result",
      "Both Teams To Score",
      "BTTS",
      "Quick Predictions",
      "Form:",
      "H2H:",
      "Squad News:",
      "Head-to-head:",
      "Read our prediction",
    ],
    100
  );

  if (!value) {
    const m = text.match(
      /(?:Top tip|Hot tip)\s*[:\-–—]?\s*((?:Under|Over)\s+\d+(?:\.\d+)?\s+goals?|Both teams to score(?:\s*[—-]?\s*(?:Yes|No))?|[A-Za-zÀ-ž .'&-]+\s+(?:win|draw no bet))/i
    );
    value = m ? cleanText(m[1]) : null;
  }

  if (!value) return null;

  value = value
    .replace(/\s+(?:Neither|Both|The|We|This|With)\b[\s\S]*$/i, "")
    .replace(/\s+at\s+[+-]?\d+\/?\d*[\s\S]*$/i, "")
    .trim();

  return value.length <= 90 ? value : value.slice(0, 90).trim();
}

function extractCorrectScore(text) {
  const patterns = [
    /Correct score\s*[:\-–—]?\s*([A-Za-zÀ-ž0-9 .'&()-]{1,50}\s+\d+\s*[-–]\s*\d+\s+[A-Za-zÀ-ž0-9 .'&()-]{1,50})/i,
    /Score prediction\s*[:\-–—]?\s*([A-Za-zÀ-ž0-9 .'&()-]{1,50}\s+\d+\s*[-–]\s*\d+\s+[A-Za-zÀ-ž0-9 .'&()-]{1,50})/i,
    /Whispers predicts\s*[:\-–—]?\s*([A-Za-zÀ-ž0-9 .'&()-]{1,50}\s+\d+\s*[-–]\s*\d+\s+[A-Za-zÀ-ž0-9 .'&()-]{1,50})/i,
  ];

  for (const rx of patterns) {
    const m = text.match(rx);
    if (m) return cleanText(m[1]);
  }

  return null;
}

function extractMatchResult(text) {
  const value = captureAfter(
    text,
    ["Match result"],
    [
      "Correct score",
      "Both Teams To Score",
      "BTTS",
      "Quick Predictions",
      "Read our prediction",
      "Hot tip",
    ],
    80
  );

  if (!value) return null;

  return value
    .replace(/\s+(?:Read|Quick|Form|H2H)\b[\s\S]*$/i, "")
    .trim()
    .slice(0, 80);
}

function extractBTTS(text) {
  const m = text.match(
    /(?:Both Teams To Score|BTTS)\s*[:\-–—]?\s*(Yes|No)/i
  );
  return m ? `BTTS — ${m[1][0].toUpperCase()}${m[1].slice(1).toLowerCase()}` : null;
}

function extractKeyStats(html) {
  const candidates = [];

  const sectionMatch = html.match(
    /<h[1-4][^>]*>[\s\S]{0,120}?key stats[\s\S]{0,120}?<\/h[1-4]>([\s\S]*?)(?=<h[1-4][^>]*>|$)/i
  );

  if (sectionMatch) {
    const li = /<li[^>]*>([\s\S]*?)<\/li>/gi;
    let m;
    while ((m = li.exec(sectionMatch[1]))) {
      const stat = stripTags(m[1]);
      if (stat.length >= 12 && stat.length <= 220) candidates.push(stat);
      if (candidates.length >= 6) break;
    }
  }

  if (!candidates.length) {
    const text = stripTags(html);
    const idx = normalized(text).indexOf("key stats");

    if (idx >= 0) {
      const chunk = text.slice(Math.max(0, idx), idx + 1600);

      const sentences = chunk
        .split(/(?<=[.!?])\s+/)
        .map(cleanText)
        .filter(
          (s) =>
            s.length >= 20 &&
            s.length <= 220 &&
            !/^key stats$/i.test(s) &&
            !/preview:/i.test(s)
        );

      candidates.push(...sentences.slice(0, 4));
    }
  }

  return [...new Set(candidates)].slice(0, 5);
}


function limitWords(value = "", maxWords = 24) {
  const words = cleanText(value).split(/\s+/).filter(Boolean);
  return words.length <= maxWords ? words.join(" ") : words.slice(0, maxWords).join(" ") + "…";
}

function extractSquadNews(text) {
  const value = captureAfter(
    text,
    ["Squad News", "Team news"],
    ["Head-to-head", "H2H", "Form:", "Team Form", "Top tip", "Key stats", "Preview:"],
    260
  );
  return value ? limitWords(value, 28) : null;
}

function extractTeamNews(html, home, away) {
  const paras = [];
  const rx = /<p[^>]*>([\s\S]*?)<\/p>/gi;
  let m;
  while ((m = rx.exec(html))) {
    const text = stripTags(m[1]);
    if (text && text.length >= 18 && text.length <= 420) paras.push(text);
  }

  const homeN = normalized(home);
  const awayN = normalized(away);
  let activeTeam = null;
  const out = [];

  for (const p of paras) {
    const n = normalized(p);
    const hasHome = homeN && n.includes(homeN);
    const hasAway = awayN && n.includes(awayN);
    if (hasHome && !hasAway) activeTeam = home;
    if (hasAway && !hasHome) activeTeam = away;

    const availability = /\b(suspend|suspended|suspension|injur|injured|injury|ruled out|miss out|misses out|will miss|without|unavailable|doubt|doubtful|sent off|yellow cards?|fitness issue|knee issue)\b/i.test(p);
    const projected = /\b(set to play|expected to (?:start|play|see)|likely to (?:start|play)|same lineups?|name the same lineups?|partnered by|could be replaced by|absence(?:s)? could be filled by)\b/i.test(p);

    if (availability || projected) {
      out.push({
        team: activeTeam,
        type: availability ? "availability" : "projected",
        text: limitWords(p, 24),
      });
    }
  }

  const seen = new Set();
  return out.filter((item) => {
    const key = normalized(item.text);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 5);
}

function pageContainsFixture(html, home, away) {
  const text = normalized(stripTags(html));
  const homeVars = teamVariants(home).map(normalized);
  const awayVars = teamVariants(away).map(normalized);

  return (
    homeVars.some((v) => v && text.includes(v)) &&
    awayVars.some((v) => v && text.includes(v))
  );
}

function parseArticle(html, url, home, away) {
  const text = stripTags(html);

  return {
    found: true,
    hotTip: extractHotTip(text),
    correctScore: extractCorrectScore(text),
    matchResult: extractMatchResult(text),
    btts: extractBTTS(text),
    keyStats: extractKeyStats(html),
    squadNews: extractSquadNews(text),
    teamNews: extractTeamNews(html, home, away),
    title: extractTitle(html),
    url,
    source: "Football Whispers",
    fetchedAt: new Date().toISOString(),
  };
}

async function discoverArticle(home, away, date) {
  const query = `${home} ${away} prediction`;

  const searchUrls = [
    `${FW_BASE}/?s=${encodeURIComponent(query)}`,
    `${FW_BASE}/blog/todays-betting-tips/`,
    `${FW_BASE}/`,
  ];

  for (const searchUrl of searchUrls) {
    try {
      const result = await fetchText(searchUrl);

      const direct = findBestArticleUrl(result.html, home, away, date);
      if (direct) return direct;

      // The daily tips page itself can contain the fixture even before a full
      // preview link is discoverable. Return it as a fallback source page.
      if (
        /todays-betting-tips/i.test(searchUrl) &&
        pageContainsFixture(result.html, home, away)
      ) {
        return result.url;
      }
    } catch {
      // Try the next discovery source.
    }
  }

  return null;
}

async function getWhispers(home, away, date) {
  const url = await discoverArticle(home, away, date);

  if (!url) {
    return {
      found: false,
      hotTip: null,
      correctScore: null,
      matchResult: null,
      btts: null,
      keyStats: [],
      squadNews: null,
      teamNews: [],
      url: null,
      title: null,
      source: "Football Whispers",
      fetchedAt: new Date().toISOString(),
    };
  }

  try {
    const article = await fetchText(url);

    if (!pageContainsFixture(article.html, home, away)) {
      return {
        found: false,
        hotTip: null,
        correctScore: null,
        matchResult: null,
        btts: null,
        keyStats: [],
        url: null,
        title: null,
        source: "Football Whispers",
        fetchedAt: new Date().toISOString(),
      };
    }

    const parsed = parseArticle(article.html, article.url || url, home, away);

    // Only mark it verified if we extracted at least one useful prediction.
    parsed.found = Boolean(
      parsed.hotTip ||
        parsed.correctScore ||
        parsed.matchResult ||
        parsed.btts ||
        parsed.keyStats.length
    );

    return parsed;
  } catch {
    return {
      found: false,
      hotTip: null,
      correctScore: null,
      matchResult: null,
      btts: null,
      keyStats: [],
      squadNews: null,
      teamNews: [],
      url: null,
      title: null,
      source: "Football Whispers",
      fetchedAt: new Date().toISOString(),
    };
  }
}

module.exports = async function handler(req, res) {
  if (req.method && req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const home = cleanText(req.query?.home || "");
  const away = cleanText(req.query?.away || "");
  const date = cleanText(req.query?.date || "");

  if (!home || !away) {
    return res.status(400).json({
      error: "Missing required query parameters: home and away",
      example: "/api/whispers?home=Cyprus&away=Latvia&date=2026-10-05",
    });
  }

  res.setHeader(
    "Cache-Control",
    `public, s-maxage=${CACHE_SECONDS}, stale-while-revalidate=300`
  );
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  try {
    const result = await getWhispers(home, away, date);
    return res.status(200).json(result);
  } catch (error) {
    return res.status(200).json({
      found: false,
      hotTip: null,
      correctScore: null,
      matchResult: null,
      btts: null,
      keyStats: [],
      squadNews: null,
      teamNews: [],
      url: null,
      title: null,
      source: "Football Whispers",
      fetchedAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : "Whispers lookup failed",
    });
  }
};
