// 이재명 대통령 X(트위터) — 링크와 관련 기사 (2026-10-10, 오진실 기자 화면에 따로 보여 줌)
// 대통령 X가 연일 화제라 관련 기사가 항상 있어야 한다는 지시. 구글 뉴스 검색 RSS로 최근 이틀 기사를 모음(여러 매체가 한꺼번에 잡힘).
// 계정 주소는 환경변수 LEE_X_URL로 바꿀 수 있음(사칭 계정 주의 — 공식 계정인지 편집장이 확인).
export const LEE_X_URL = process.env.LEE_X_URL || 'https://x.com/Jaemyung_Lee';

export type LeeXArticle = { outlet: string; title: string; url: string; publishedAt: string | null };
export type LeeXInfo = { url: string; articles: LeeXArticle[]; checkedAt: string };

const decode = (s: string) =>
  s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .trim();
const tag = (b: string, t: string) => decode(b.match(new RegExp(`<${t}[^>]*>([\\s\\S]*?)</${t}>`))?.[1] ?? '');

const RELATED = /(\bX\b|엑스|트위터|SNS|소셜미디어|게시글|글을 올|올린 글)/;

export async function fetchLeeX(): Promise<LeeXInfo> {
  const q = encodeURIComponent('이재명 대통령 X 게시글 when:2d');
  const res = await fetch(`https://news.google.com/rss/search?q=${q}&hl=ko&gl=KR&ceid=KR:ko`, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; FactfinderBot/1.0)' },
    signal: AbortSignal.timeout(15_000),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const xml = await res.text();
  const articles: LeeXArticle[] = [];
  const seen = new Set<string>();
  for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const b = m[1];
    const source = tag(b, 'source');
    let title = tag(b, 'title');
    if (source && title.endsWith(` - ${source}`)) title = title.slice(0, -(source.length + 3));
    const url = tag(b, 'link');
    if (!title || !url || !/(이재명|李|대통령|이 대통령)/.test(title) || !RELATED.test(title) || seen.has(title)) continue;
    seen.add(title);
    const t = Date.parse(tag(b, 'pubDate'));
    articles.push({ outlet: source || '언론', title, url, publishedAt: Number.isNaN(t) ? null : new Date(t).toISOString() });
  }
  articles.sort((a, b) => (Date.parse(b.publishedAt ?? '') || 0) - (Date.parse(a.publishedAt ?? '') || 0));
  return { url: LEE_X_URL, articles: articles.slice(0, 10), checkedAt: new Date().toISOString() };
}
