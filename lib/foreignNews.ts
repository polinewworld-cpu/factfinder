import { prisma } from '@/lib/prisma';
import { generateText, geminiReady } from '@/lib/gemini';

// 외신 추천 (2026-10-10) — 영미 주요 외신의 공개 RSS에서 "한국 관련 이슈"를 다룬 기사만 골라
// 한국어 제목·요약·팩트파인더가 쓸 각도를 붙여 관리자에게 보여준다. 기사 본문은 가져오지 않음(RSS가 주는 제목·짧은 소개글만 사용 → 저작권 안전).
// 순서: ① RSS 수집 → ② 영문 키워드로 한국 관련 후보만 1차 거름 → ③ 제미나이가 진짜 한국 관련인 것을 골라 번역·요약.
// 결과는 AnalyticsSnapshot 표에 id '0-foreign-news' 한 줄로 저장 — 방문 분석 화면은 id 내림차순 첫 줄을 쓰므로 날짜(2026-…)보다 앞서도록 '0'으로 시작.

export const FOREIGN_FEEDS = [
  { name: 'BBC', url: 'https://feeds.bbci.co.uk/news/world/asia/rss.xml' },
  { name: 'The New York Times', url: 'https://rss.nytimes.com/services/xml/rss/nyt/AsiaPacific.xml' },
  { name: 'The New York Times', url: 'https://rss.nytimes.com/services/xml/rss/nyt/World.xml' },
  { name: 'The Guardian', url: 'https://www.theguardian.com/world/rss' },
  { name: 'Al Jazeera', url: 'https://www.aljazeera.com/xml/rss/all.xml' },
  { name: 'CNN', url: 'http://rss.cnn.com/rss/edition_asia.rss' },
  { name: 'NPR', url: 'https://feeds.npr.org/1004/rss.xml' },
  { name: 'DW', url: 'https://rss.dw.com/rdf/rss-en-asia' },
  { name: 'The Washington Post', url: 'https://feeds.washingtonpost.com/rss/world' },
  { name: 'WSJ', url: 'https://feeds.content.dowjones.io/public/rss/RSSWorldNews' },
] as const;

export type ForeignPick = {
  priority: number; // 1~3 (1이 가장 먼저)
  outlet: string;
  originalTitle: string;
  titleKo: string;
  summaryKo: string; // 두세 줄
  whyKorea: string; // 한국과 어떻게 관련되는지 한 줄
  angle: string; // 팩트파인더가 쓸 각도
  url: string;
  publishedAt: string | null;
};

export type ForeignNewsReport = {
  generatedAt: string;
  picks: ForeignPick[];
  fetched: number; // 모은 기사 수
  candidates: number; // 한국 관련 1차 후보 수
  sourceErrors: { outlet: string; error: string }[];
  aiError?: string | null;
};

type Raw = { outlet: string; title: string; url: string; summary: string; publishedAt: string | null };

const REPORT_ID = '0-foreign-news';
const EVERY_MS = 3 * 3600_000 - 5 * 60_000; // 핑 간격(10분) 오차 감안
const MAX_AGE_MS = 48 * 3600_000;
const MAX_CANDIDATES = 40;

// 한국 관련 1차 거름 — 놓치지 않으려고 넓게, 진짜 관련성은 제미나이가 가림
const KOREA_RE =
  /\b(south korea|north korea|korea|korean|koreans|seoul|pyongyang|kim jong|lee jae-?myung|yoon suk|han duck|park chung|moon jae|dmz|panmunjom|busan|incheon|samsung|hyundai|sk hynix|lg energy|k-pop|bts|blackpink|kospi)\b/i;

const decode = (s: string) =>
  s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&quot;|&#34;/g, '"')
    .replace(/&#39;|&#039;|&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

function tag(block: string, name: string) {
  const m = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i'));
  return m ? m[1] : '';
}

function parseFeed(xml: string, outlet: string): Raw[] {
  const blocks = xml.match(/<item[\s>][\s\S]*?<\/item>|<entry[\s>][\s\S]*?<\/entry>/gi) ?? [];
  const out: Raw[] = [];
  for (const b of blocks) {
    const title = decode(tag(b, 'title'));
    let url = decode(tag(b, 'link'));
    if (!url) url = b.match(/<link[^>]+href="([^"]+)"/i)?.[1] ?? '';
    const summary = decode(tag(b, 'description') || tag(b, 'summary') || tag(b, 'content:encoded')).slice(0, 400);
    const dateRaw = decode(tag(b, 'pubDate') || tag(b, 'published') || tag(b, 'updated') || tag(b, 'dc:date'));
    const t = Date.parse(dateRaw);
    if (!title || !/^https?:\/\//.test(url)) continue;
    out.push({ outlet, title, url, summary, publishedAt: Number.isNaN(t) ? null : new Date(t).toISOString() });
  }
  return out;
}

async function fetchFeed(feed: { name: string; url: string }): Promise<Raw[]> {
  const res = await fetch(feed.url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; FactfinderBot/1.0)', Accept: 'application/rss+xml, application/xml, text/xml, */*' },
    signal: AbortSignal.timeout(15_000),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return parseFeed(await res.text(), feed.name);
}

function parseJson(text: string): any {
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
  const start = cleaned.indexOf('[');
  const end = cleaned.lastIndexOf(']');
  return JSON.parse(start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned);
}

export async function buildForeignNews(): Promise<ForeignNewsReport> {
  const sourceErrors: ForeignNewsReport['sourceErrors'] = [];
  const results = await Promise.all(
    FOREIGN_FEEDS.map((f) =>
      fetchFeed(f).catch((e) => {
        sourceErrors.push({ outlet: f.name, error: e instanceof Error ? e.message : String(e) });
        return [] as Raw[];
      })
    )
  );

  // 같은 주소 중복 제거 + 최근 48시간(날짜를 모르면 포함)
  const seen = new Set<string>();
  const all = results.flat().filter((r) => {
    if (seen.has(r.url)) return false;
    seen.add(r.url);
    return !r.publishedAt || Date.now() - Date.parse(r.publishedAt) <= MAX_AGE_MS;
  });

  const candidates = all
    .filter((r) => KOREA_RE.test(`${r.title} ${r.summary}`))
    .sort((a, b) => Date.parse(b.publishedAt ?? '') - Date.parse(a.publishedAt ?? '') || 0)
    .slice(0, MAX_CANDIDATES);

  const report: ForeignNewsReport = {
    generatedAt: new Date().toISOString(),
    picks: [],
    fetched: all.length,
    candidates: candidates.length,
    sourceErrors,
    aiError: null,
  };
  if (!candidates.length) return report;

  const fallback = () =>
    candidates.slice(0, 10).map((c, i): ForeignPick => ({
      priority: i < 3 ? 1 : i < 6 ? 2 : 3,
      outlet: c.outlet,
      originalTitle: c.title,
      titleKo: '',
      summaryKo: '',
      whyKorea: '',
      angle: '',
      url: c.url,
      publishedAt: c.publishedAt,
    }));

  if (!geminiReady()) {
    report.aiError = '제미나이 키(GEMINI_API_KEY)가 없어 번역·요약 없이 원문 제목만 보여 드립니다.';
    report.picks = fallback();
    return report;
  }

  const list = candidates
    .map((c, i) => `[${i}] (${c.outlet}) ${c.title}\n    ${c.summary}`)
    .join('\n');
  const prompt = `당신은 한국 인터넷신문 "팩트파인더"(중도주의 관점으로 정치·사회를 다룸) 편집국의 외신 담당입니다.
아래는 영미 주요 외신의 최근 기사 목록(번호, 매체, 제목, 짧은 소개글)입니다. 이 중 **한국이 직접 주제이거나 한국의 정치·외교·안보·경제·사회 이슈를 의미 있게 다룬 기사만** 최대 10개 고르세요.
- 한국이 지나가듯 한 번 언급되는 기사, 연예·스포츠 단신은 제외합니다.
- 기사 본문은 주어지지 않았으니, 주어진 제목과 소개글에 없는 사실을 지어내지 마세요. 확실하지 않은 것은 "소개글 기준"이라고 쓰세요.
- 우선순위(priority)는 1(가장 먼저 다룰 가치)~3.
- 결과는 JSON 배열만 출력하세요(설명·코드블록 금지). 각 원소:
{"idx": 번호, "priority": 1~3, "titleKo": "자연스러운 한국어 제목", "summaryKo": "한국어 2~3문장 요약", "whyKorea": "한국과 어떻게 관련되는지 한 문장", "angle": "팩트파인더가 쓸 만한 각도 한 문장(중도 관점)"}

기사 목록:
${list}`;

  try {
    const parsed = parseJson(await generateText(prompt, { temperature: 0.3 }));
    const picks: ForeignPick[] = [];
    for (const p of Array.isArray(parsed) ? parsed : []) {
      const c = candidates[Number(p?.idx)];
      if (!c) continue; // 번호가 목록에 없으면 버림(주소를 지어내지 못하게 번호로만 연결)
      picks.push({
        priority: [1, 2, 3].includes(Number(p.priority)) ? Number(p.priority) : 3,
        outlet: c.outlet,
        originalTitle: c.title,
        titleKo: String(p.titleKo ?? ''),
        summaryKo: String(p.summaryKo ?? ''),
        whyKorea: String(p.whyKorea ?? ''),
        angle: String(p.angle ?? ''),
        url: c.url,
        publishedAt: c.publishedAt,
      });
    }
    report.picks = picks.sort((a, b) => a.priority - b.priority).slice(0, 10);
    if (!report.picks.length) report.aiError = '이번에는 한국과 관련 있는 외신 기사를 찾지 못했습니다.';
  } catch (e) {
    report.aiError = e instanceof Error ? e.message : '자동 선별 실패';
    report.picks = fallback();
  }
  return report;
}

let inFlight: Promise<ForeignNewsReport> | null = null;

export function refreshForeignNews(): Promise<ForeignNewsReport> {
  if (!inFlight) {
    inFlight = (async () => {
      const report = await buildForeignNews();
      await prisma.analyticsSnapshot.upsert({
        where: { id: REPORT_ID },
        update: { data: report as any, createdAt: new Date() },
        create: { id: REPORT_ID, data: report as any },
      });
      return report;
    })().finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
}

export async function latestForeignNews(): Promise<ForeignNewsReport | null> {
  const row = await prisma.analyticsSnapshot.findUnique({ where: { id: REPORT_ID } });
  return row ? (row.data as unknown as ForeignNewsReport) : null;
}

// /api/health에서 호출 — 기다리지 않고, 3시간(06~23시)마다 한 번만 새로 받음
export function ensureForeignNews() {
  const hour = new Date(Date.now() + 9 * 3600_000).getUTCHours();
  if (hour < 6 || inFlight) return;
  latestForeignNews()
    .then((r) => {
      if (!r || !(Date.now() - Date.parse(r.generatedAt) < EVERY_MS)) return refreshForeignNews();
      return null;
    })
    .catch(() => {});
}
