import type { SourceType } from '@/lib/photoBankRules';
import { autoCredit, blockedAgency } from '@/lib/photoBankRules';

// 사진 뱅크 2단계 — 외부 검색 (2026-10-09). 통과 기준을 만족하는 사진만 돌려준다.
//  위키미디어 커먼즈: 공식 API, 키 불필요 — 퍼블릭 도메인·CC0·CC BY·CC BY-SA(+공공누리 1·0유형)
//  플리커: 공식 API, FLICKR_API_KEY — 미국 정부 저작물·퍼블릭 도메인 마크·CC0·CC BY·CC BY-SA
//  DVIDS(미 국방부): 공식 API, DVIDS_API_KEY — 퍼블릭 도메인
//  네이버 뉴스 "제공" 사진: 네이버 뉴스 검색 결과의 기사 페이지 캡션에서 의원실·정당·정부기관 "제공" 표기만
export type ExternalSource = 'wikimedia' | 'flickr' | 'dvids' | 'naver';

export type ExternalItem = {
  key: string;
  source: ExternalSource;
  thumb: string;
  image: string; // 가져올 원본(또는 큰) 이미지
  pageUrl: string; // 원본 페이지
  viaArticleUrl?: string;
  title: string;
  caption: string;
  author: string;
  license: string;
  takenAt: string | null; // YYYY-MM-DD
  sourceType: SourceType;
  credit: string;
  note?: string; // 사람이 확인할 점
};

export type ExternalResult = { source: ExternalSource; available: boolean; items: ExternalItem[]; error?: string };

const UA = 'FactFinderPhotoBank/1.0 (https://www.factfinder.tv; polinewworld@gmail.com)';
const NAVER_PROXY = process.env.NAVER_SEARCH_PROXY || 'https://naver-news-proxy.zoohyup.workers.dev';
const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36';
const strip = (s: string) =>
  s
    .replace(/<[^>]+>/g, ' ')
    .replace(/&quot;|&#034;/g, '"')
    .replace(/&#039;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
const day = (s?: string | null) => (s && /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : s && /^\d{4}$/.test(s) ? null : null);

async function getJson(url: string, headers: Record<string, string> = {}) {
  const res = await fetch(url, { headers: { 'User-Agent': UA, ...headers }, signal: AbortSignal.timeout(20_000), cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ── 위키미디어 커먼즈 ──
function wikimediaLicense(short: string): { type: SourceType; license: string } | null {
  const s = short.trim();
  if (/\b(NC|ND)\b|NonCommercial|NoDeriv|fair use|GFDL/i.test(s)) return null;
  if (/^CC0/i.test(s)) return { type: 'CC', license: 'CC0' };
  if (/^(Public domain|PD\b)/i.test(s)) return { type: 'PUBLIC_DOMAIN', license: '퍼블릭 도메인' };
  if (/^CC BY-SA/i.test(s)) return { type: 'CC', license: s.replace(/^CC BY-SA/i, 'CC BY-SA') };
  if (/^CC BY\b/i.test(s)) return { type: 'CC', license: s };
  if (/^KOGL Type [01]\b/i.test(s)) return { type: 'KOGL', license: `공공누리 ${s.match(/Type ([01])/i)![1]}유형` };
  return null;
}

// 위키데이터로 검색어의 정식 이름(영문 표기·별칭)과 항목 번호를 찾음 — "한동훈" → Han Dong-hoon, Q97199071
// 사람(P31=Q5)일 때만 — "국방부"가 미국 국방부로 잡히는 식의 오인 방지
async function wikidataNames(q: string): Promise<{ qid: string | null; names: string[] }> {
  try {
    const s0 = await getJson(
      `https://www.wikidata.org/w/api.php?action=wbsearchentities&format=json&type=item&limit=1&language=ko&uselang=ko&search=${encodeURIComponent(q)}`,
    );
    const qid: string | undefined = s0.search?.[0]?.id;
    if (!qid) return { qid: null, names: [] };
    const e = await getJson(`https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&props=labels|aliases|claims&languages=en|ko&ids=${qid}`);
    const ent = e.entities?.[qid] ?? {};
    const human = (ent.claims?.P31 ?? []).some((c: any) => c.mainsnak?.datavalue?.value?.id === 'Q5');
    if (!human) return { qid: null, names: [] };
    const names = [
      ent.labels?.en?.value,
      ent.labels?.ko?.value,
      ...(ent.aliases?.en ?? []).map((x: any) => x.value),
      ...(ent.aliases?.ko ?? []).map((x: any) => x.value),
    ].filter((x): x is string => typeof x === 'string' && x.trim().length >= 2);
    return { qid, names: Array.from(new Set(names)) };
  } catch {
    return { qid: null, names: [] };
  }
}

// 띄어쓰기·하이픈·대소문자 무시하고 비교 ("Han Dong-hoon" = "han donghoon")
const norm = (t: string) => t.toLowerCase().replace(/[^0-9a-z가-힣]/g, '');

async function commonsSearch(query: string, limit = 40): Promise<any[]> {
  const url =
    `https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrnamespace=6&gsrlimit=${limit}` +
    `&gsrsearch=${encodeURIComponent(`${query} filetype:bitmap`)}` +
    '&prop=imageinfo&iiprop=url|extmetadata|size&iiurlwidth=1600' +
    '&iiextmetadatafilter=LicenseShortName|Artist|DateTimeOriginal|ImageDescription|ObjectName|Categories';
  const d = await getJson(url);
  return Object.values<any>(d.query?.pages ?? {}).sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
}

// 위키미디어는 검색어를 넓게 풀어(다른 언어·비슷한 글자) 엉뚱한 사진이 섞임 — 2026-10-09 "한동훈" 검색에 배우·조개 사진이 섞인 문제
// → ① 위키데이터 "이 사진에 나온 인물(depicts)"로 등록된 사진을 맨 앞에 ② 정식 이름(영문 포함)으로 다시 찾고
//   ③ 글자 검색 결과는 제목·설명·분류에 그 이름이 실제로 들어 있는 것만 남김
async function searchWikimedia(q: string): Promise<ExternalItem[]> {
  const { qid, names } = await wikidataNames(q);
  const terms = Array.from(new Set([q, ...names])).map(norm).filter((t) => t.length >= 2);
  const [depicts, byName, byText] = await Promise.all([
    qid ? commonsSearch(`haswbstatement:P180=${qid}`).catch(() => []) : Promise.resolve([]),
    names[0] && norm(names[0]) !== norm(q) ? commonsSearch(`"${names[0]}"`).catch(() => []) : Promise.resolve([]),
    commonsSearch(q),
  ]);
  const seen = new Set<number>();
  const pages: { p: any; trusted: boolean }[] = [];
  for (const [list, trusted] of [
    [depicts, true],
    [byName, false],
    [byText, false],
  ] as const) {
    for (const p of list) {
      if (seen.has(p.pageid)) continue;
      seen.add(p.pageid);
      pages.push({ p, trusted });
    }
  }

  const items: ExternalItem[] = [];
  for (const { p, trusted } of pages) {
    const ii = p.imageinfo?.[0];
    if (!ii) continue;
    const m = ii.extmetadata ?? {};
    if (!trusted) {
      const hay = norm(`${p.title} ${strip(m.ImageDescription?.value ?? '')} ${strip(m.ObjectName?.value ?? '')} ${m.Categories?.value ?? ''}`);
      if (!terms.some((t) => hay.includes(t))) continue;
    }
    const lic = wikimediaLicense(m.LicenseShortName?.value ?? '');
    if (!lic) continue;
    const author = strip(m.Artist?.value ?? '') || '위키미디어 커먼즈';
    if (blockedAgency(author)) continue;
    const caption = strip(m.ImageDescription?.value ?? '').slice(0, 300);
    const credit =
      lic.type === 'CC' ? `사진=${author}·위키미디어 커먼즈(${lic.license})` : autoCredit(lic.type, author, lic.license);
    items.push({
      key: `wm-${p.pageid}`,
      source: 'wikimedia',
      thumb: ii.thumburl ?? ii.url,
      image: ii.thumburl && ii.width > 1600 ? ii.thumburl : ii.url,
      pageUrl: ii.descriptionurl ?? `https://commons.wikimedia.org/wiki/${encodeURIComponent(p.title)}`,
      title: String(p.title).replace(/^File:/, '').replace(/\.[a-z]+$/i, ''),
      caption,
      author,
      license: lic.license,
      takenAt: day(m.DateTimeOriginal?.value?.replace(/\s.*$/, '')),
      sourceType: lic.type,
      credit,
    });
  }
  return items;
}

// ── 플리커 ──
let flickrLicenses: Map<string, { type: SourceType; license: string }> | null = null;
async function flickrLicenseMap(key: string) {
  if (flickrLicenses) return flickrLicenses;
  const d = await getJson(`https://api.flickr.com/services/rest/?method=flickr.photos.licenses.getInfo&api_key=${key}&format=json&nojsoncallback=1`);
  const map = new Map<string, { type: SourceType; license: string }>();
  for (const l of d.licenses?.license ?? []) {
    const name = String(l.name);
    if (/NonCommercial|NoDeriv|No known|All Rights/i.test(name)) continue;
    if (/United States Government Work/i.test(name)) map.set(String(l.id), { type: 'PUBLIC_DOMAIN', license: '미국 정부 저작물' });
    else if (/Public Domain Mark/i.test(name)) map.set(String(l.id), { type: 'PUBLIC_DOMAIN', license: '퍼블릭 도메인' });
    else if (/CC0|Public Domain Dedication/i.test(name)) map.set(String(l.id), { type: 'CC', license: 'CC0' });
    else if (/ShareAlike|BY-SA/i.test(name)) map.set(String(l.id), { type: 'CC', license: 'CC BY-SA' });
    else if (/^Attribution|CC BY\b/i.test(name)) map.set(String(l.id), { type: 'CC', license: 'CC BY' });
  }
  flickrLicenses = map;
  return map;
}

async function searchFlickr(q: string): Promise<ExternalItem[]> {
  const key = process.env.FLICKR_API_KEY!;
  const lic = await flickrLicenseMap(key);
  const d = await getJson(
    `https://api.flickr.com/services/rest/?method=flickr.photos.search&api_key=${key}&format=json&nojsoncallback=1` +
      `&text=${encodeURIComponent(q)}&license=${[...lic.keys()].join(',')}&sort=relevance&content_types=0&media=photos&per_page=40` +
      '&extras=license,date_taken,owner_name,url_m,url_l,url_c,description',
  );
  if (d.stat !== 'ok') throw new Error(d.message ?? '플리커 오류');
  const items: ExternalItem[] = [];
  for (const p of d.photos?.photo ?? []) {
    const l = lic.get(String(p.license));
    const image = p.url_l ?? p.url_c ?? p.url_m;
    if (!l || !image) continue;
    const author = String(p.ownername ?? '').trim() || 'Flickr';
    if (blockedAgency(author)) continue;
    items.push({
      key: `fl-${p.id}`,
      source: 'flickr',
      thumb: p.url_m ?? image,
      image,
      pageUrl: `https://www.flickr.com/photos/${p.owner}/${p.id}`,
      title: strip(p.title ?? ''),
      caption: strip(p.description?._content ?? '').slice(0, 300),
      author,
      license: l.license,
      takenAt: day(p.datetaken),
      sourceType: l.type,
      credit: l.type === 'CC' ? `사진=${author}·플리커(${l.license})` : `사진=${author}`,
    });
  }
  return items;
}

// ── DVIDS (미 국방부) ──
async function searchDvids(q: string): Promise<ExternalItem[]> {
  const key = process.env.DVIDS_API_KEY!;
  const d = await getJson(`https://api.dvidshub.net/search?api_key=${key}&q=${encodeURIComponent(q)}&type[]=image&max_results=30&sort=date&sortdir=desc`);
  const results: any[] = d.results ?? [];
  // 검색 결과에는 큰 이미지·크레디트가 없어 상위 몇 장만 상세 조회
  const details = await Promise.all(
    results.slice(0, 18).map((r) =>
      getJson(`https://api.dvidshub.net/asset?api_key=${key}&id=${encodeURIComponent(r.id)}&fields=id,title,description,image,url,date,credit,unit_name,keywords`)
        .then((x) => x.results ?? x)
        .catch(() => null),
    ),
  );
  const items: ExternalItem[] = [];
  results.slice(0, 18).forEach((r, i) => {
    const a = details[i] ?? {};
    const image = a.image?.url ?? a.image ?? r.thumbnail?.url ?? r.thumbnail;
    if (!image || typeof image !== 'string') return;
    const credit0 = Array.isArray(a.credit) ? a.credit.map((c: any) => c.name ?? c).join(', ') : strip(String(a.credit ?? ''));
    const author = credit0 || a.unit_name || r.unit_name || 'U.S. Department of Defense';
    if (blockedAgency(author)) return;
    items.push({
      key: `dv-${r.id}`,
      source: 'dvids',
      thumb: r.thumbnail?.url ?? r.thumbnail ?? image,
      image,
      pageUrl: a.url ?? r.url ?? 'https://www.dvidshub.net',
      title: strip(a.title ?? r.title ?? ''),
      caption: strip(a.description ?? r.description ?? '').slice(0, 300),
      author,
      license: '퍼블릭 도메인 (미 국방부)',
      takenAt: day(a.date ?? r.date_published ?? r.date),
      sourceType: 'PUBLIC_DOMAIN',
      credit: `사진=${a.unit_name || r.unit_name || '미 국방부'}(DVIDS)`,
      note: 'DVIDS 페이지에서 저작권 표시(퍼블릭 도메인)를 한 번 확인하세요',
    });
  });
  return items;
}

// ── 네이버 뉴스 "제공" 사진 ──
const PARTY_RE = /의원실|의원\s?측|의원$|국민의힘|민주당|개혁신당|조국혁신당|진보당|정의당|기본소득당|새미래|캠프|선대위|선거대책|원내대표실|당대표실|비서실|당$/;
const GOV_RE = /대통령실|청와대|국무총리|총리실|국회(사무처)?$|부$|처$|청$|위원회|원$|본부|사령부|합참|합동참모|국방|외교|경찰|소방|검찰|법원|헌법재판소|대사관|정부|시$|도$|군$|구$|시청|도청|군청|구청|교육청|공사$|공단$|재단$|센터$|기관$/;
const PRESS_RE = /연합|뉴시스|뉴스1|뉴스|일보|신문|방송|TV|KBS|MBC|SBS|YTN|JTBC|채널A|MBN|기자단|기자|통신|포토|getty|게티|\bAP\b|AFP|로이터|EPA/i;

// 캡션 끝의 "○○ 제공" 주체 — "/○○ 제공", "(사진=○○ 제공)", "[○○ 제공]", "○○ 제공"
export function providerOf(caption: string): string | null {
  const m = caption.match(/(?:^|[\s/(=\[·,])([가-힣A-Za-z0-9·&\s]{1,30}?)\s*제공\s*[)\]]?\s*\.?\s*$/);
  if (!m) return null;
  return m[1].replace(/^사진\s*=?\s*/, '').trim() || null;
}

export function classifyProvider(p: string): 'PARTY' | 'KOGL' | null {
  if (PRESS_RE.test(p) || blockedAgency(p)) return null;
  if (PARTY_RE.test(p)) return 'PARTY';
  if (GOV_RE.test(p)) return 'KOGL';
  return null;
}

// 네이버 검색 API 키(NAVER_CLIENT_ID·NAVER_CLIENT_SECRET, developers.naver.com 무료)가 있으면 한 번에 100건 중 네이버 뉴스 기사를,
// 없으면 검색 화면(한 쪽에 네이버 뉴스 기사 2~5건뿐)을 읽는다 — 키 없이는 "제공" 사진이 거의 안 잡힘(2026-10-09 실측)
async function naverArticles(q: string, pages = [1, 11, 21, 31]): Promise<string[]> {
  const urls = new Set<string>();
  if (process.env.NAVER_CLIENT_ID && process.env.NAVER_CLIENT_SECRET) {
    const res = await fetch(`https://openapi.naver.com/v1/search/news.json?query=${encodeURIComponent(q)}&display=100&sort=date`, {
      headers: { 'X-Naver-Client-Id': process.env.NAVER_CLIENT_ID, 'X-Naver-Client-Secret': process.env.NAVER_CLIENT_SECRET },
      signal: AbortSignal.timeout(15_000),
      cache: 'no-store',
    });
    if (!res.ok) throw new Error(`네이버 검색 API HTTP ${res.status}`);
    for (const it of (await res.json()).items ?? []) {
      const m = String(it.link ?? '').match(/https:\/\/n\.news\.naver\.com\/mnews\/article\/\d+\/\d+/);
      if (m) urls.add(m[0]);
    }
    return [...urls].slice(0, 40);
  }
  // 키가 없으면 정글2의 네이버 뉴스 검색 중계(Cloudflare Worker, 네이버 클라우드 API HUB 키 보유)를 씀 — 2026-10-09
  // (developers.naver.com 검색 API는 신규 신청 목록에서 빠짐). 수집기는 시간당 몇 번이라 정글2 한도에 영향 거의 없음.
  try {
    const res = await fetch(`${NAVER_PROXY}/?query=${encodeURIComponent(q)}&display=100&sort=date`, { signal: AbortSignal.timeout(15_000), cache: 'no-store' });
    if (res.ok) {
      for (const it of (await res.json()).items ?? []) {
        const m = String(it.link ?? '').match(/https:\/\/n\.news\.naver\.com\/mnews\/article\/\d+\/\d+/);
        if (m) urls.add(m[0]);
      }
      if (urls.size) return [...urls].slice(0, 40);
    }
  } catch {
    // 중계가 안 되면 아래 검색 화면 읽기로
  }
  for (const start of pages) {
    const res = await fetch(`https://search.naver.com/search.naver?where=news&sort=1&query=${encodeURIComponent(q)}&start=${start}`, {
      headers: { 'User-Agent': BROWSER_UA },
      signal: AbortSignal.timeout(15_000),
      cache: 'no-store',
    });
    if (!res.ok) throw new Error(`네이버 검색 HTTP ${res.status}`);
    for (const m of (await res.text()).matchAll(/https:\/\/n\.news\.naver\.com\/mnews\/article\/\d+\/\d+/g)) urls.add(m[0]);
  }
  return [...urls].slice(0, 24);
}

async function naverArticlePhotos(articleUrl: string): Promise<ExternalItem[]> {
  const res = await fetch(articleUrl, { headers: { 'User-Agent': BROWSER_UA }, signal: AbortSignal.timeout(15_000), cache: 'no-store' });
  if (!res.ok) return [];
  const html = await res.text();
  const title = strip(html.match(/<meta property="og:title" content="([^"]*)"/)?.[1] ?? '');
  const date = html.match(/data-date-time="(\d{4}-\d{2}-\d{2})/)?.[1] ?? null;
  const items: ExternalItem[] = [];
  // 사진 하나 = end_photo_org 블록 안의 img(data-src) + 바로 뒤 캡션(em.img_desc)
  const blocks = html.split(/class="end_photo_org"/).slice(1);
  blocks.forEach((b, i) => {
    const src = b.match(/data-src="([^"]+)"/)?.[1] ?? b.match(/<img[^>]*src="([^"]+)"/)?.[1];
    // 캡션 형식이 언론사마다 다름 — ① <em class="img_desc"> ② 사진 표(nbd_table)의 다음 칸
    const caption = strip(
      b.match(/<em class="img_desc"[^>]*>([\s\S]*?)<\/em>/)?.[1] ?? b.match(/<\/span>\s*<\/td>\s*<\/tr>\s*<tr>\s*<td[^>]*>([\s\S]*?)<\/td>/)?.[1] ?? '',
    );
    if (!src || !caption) return;
    const provider = providerOf(caption);
    const type = provider ? classifyProvider(provider) : null;
    if (!provider || !type) return;
    const image = src.replace(/&amp;/g, '&').replace(/\?type.*$/, ''); // ?type&#x3D;w860 같은 크기 지정 떼고 원본
    items.push({
      key: `nv-${articleUrl.split('/article/')[1]}-${i}`,
      source: 'naver',
      thumb: `${image}?type=w647`,
      image,
      pageUrl: image,
      viaArticleUrl: articleUrl,
      title,
      caption: caption.replace(/\s*[/(\[]?\s*(사진\s*=\s*)?[^/(\[]*제공\s*[)\]]?\s*\.?\s*$/, '').trim(),
      author: provider,
      license: '',
      takenAt: date,
      sourceType: type,
      credit: `사진=${provider}`,
      note: type === 'KOGL' ? '정부기관 제공 — 공공누리 유형을 원본에서 확인하세요. 언론사 로고가 박혀 있지 않은지도 확인하세요.' : '언론사 로고가 박혀 있지 않은지 확인하세요.',
    });
  });
  return items;
}

// 자동 수집기(lib/photoCollector.ts)도 씀 — 수집기는 쪽 수를 줄여 부르기
export async function searchNaver(q: string, pages?: number[]): Promise<ExternalItem[]> {
  const urls = await naverArticles(`${q} 제공`, pages);
  const out: ExternalItem[] = [];
  for (let i = 0; i < urls.length; i += 5) {
    const chunk = await Promise.all(urls.slice(i, i + 5).map((u) => naverArticlePhotos(u).catch(() => [])));
    out.push(...chunk.flat());
  }
  // 같은 사진(같은 이미지 주소)은 한 번만
  const seen = new Set<string>();
  return out.filter((x) => (seen.has(x.image) ? false : (seen.add(x.image), true)));
}

export function externalAvailable(source: ExternalSource) {
  if (source === 'flickr') return !!process.env.FLICKR_API_KEY;
  if (source === 'dvids') return !!process.env.DVIDS_API_KEY;
  return true;
}

export async function searchExternal(source: ExternalSource, q: string): Promise<ExternalResult> {
  if (!externalAvailable(source)) return { source, available: false, items: [] };
  try {
    const items =
      source === 'wikimedia' ? await searchWikimedia(q) : source === 'flickr' ? await searchFlickr(q) : source === 'dvids' ? await searchDvids(q) : await searchNaver(q);
    return { source, available: true, items };
  } catch (e) {
    return { source, available: true, items: [], error: e instanceof Error ? e.message : '검색 실패' };
  }
}
