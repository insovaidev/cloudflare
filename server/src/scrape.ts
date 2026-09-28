// Fetch a job posting and reduce it to readable text for Claude.

const MAX_CHARS = 60_000;

const ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'",
};

const decodeEntities = (s: string) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e: string) => {
    if (e[0] === '#') {
      const code = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });

export const htmlToText = (html: string) => {
  const title = decodeEntities(/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1]?.trim() ?? '');
  const text = decodeEntities(
    html
      .replace(/<(script|style|noscript|svg|template|iframe)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/tr|\/section|\/article)[^>]*>/gi, '\n')
      .replace(/<li[^>]*>/gi, '\n• ')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/[ \t\f\v\r]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return { title, text };
};

export const sha256 = async (s: string) => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
};

export const scrapeJob = async (url: string) => {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; SkillGapBot/1.0; +https://workers.cloudflare.com)',
      Accept: 'text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`Fetching job page failed: HTTP ${res.status}`);

  const body = await res.text();
  const isHtml = (res.headers.get('content-type') ?? '').includes('html') || /<html|<body/i.test(body);
  const { title, text } = isHtml ? htmlToText(body) : { title: '', text: body.trim() };
  if (text.length < 200) throw new Error('Job page has too little text (it may require JavaScript or a login)');

  // Hash the full text so edits anywhere in the posting trigger a re-analysis.
  const hash = await sha256(text);
  const truncated = text.length > MAX_CHARS;
  return { title, text: truncated ? text.slice(0, MAX_CHARS) : text, truncated, hash };
};
