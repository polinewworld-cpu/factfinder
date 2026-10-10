import { prisma } from '@/lib/prisma';
import { generateText, geminiReady } from '@/lib/gemini';

// 김정신 특파원 (2026-10-10) — 영미 주요 외신의 공개 RSS에서 "한국 관련 이슈"를 다룬 기사만 골라,
// 현지 언론의 동정을 살핀 보고서를 하루 3번(한국시간 07·13·19시) 올린다. 존댓말로 "이런 방향으로 쓰시길 권합니다"라는 권고를 하고,
// 근거가 된 현지 언론 기사 링크는 항목마다 반드시 붙인다(링크는 AI가 쓰지 않고 수집한 기사 번호로만 연결 → 지어낼 수 없음).
// 기사 본문은 가져오지 않음(RSS가 주는 제목·짧은 소개글만 사용 → 저작권 안전). 관리자 화면 전용 내부 참고 자료.
// 순서: ① RSS 수집 → ② 영문 키워드로 한국 관련 후보만 1차 거름 → ③ 제미나이가 한국 관련 기사를 골라 번역·요약·권고.
// 저장: AnalyticsSnapshot 표에 id '0-fn-YYYY-MM-DD-HH'(HH=보고 시각)로 한 회차씩 — 방문 분석 화면은 id 내림차순 첫 줄을 쓰므로 날짜(2026-…)보다 앞서도록 '0'으로 시작.

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
  tone: string; // 현지 언론이 이 이슈를 보는 시각·관심 포인트(소개글 기준)
  advice: string; // 팩트파인더가 어떤 방향으로 쓰면 좋을지 권고(존댓말)
  url: string; // 현지 언론 기사 링크 — 항상 있음
  publishedAt: string | null;
};

export type ForeignNewsReport = {
  generatedAt: string;
  slot: number; // 보고 시각(한국시간 7·13·19, 0은 새벽 수동 갱신)
  greeting: string; // 특파원 인사
  overview: string; // 이번 회차 종합(존댓말)
  picks: ForeignPick[];
  fetched: number; // 모은 기사 수
  candidates: number; // 한국 관련 1차 후보 수
  sourceErrors: { outlet: string; error: string }[];
  aiError?: string | null;
};

type Raw = { outlet: string; title: string; url: string; summary: string; publishedAt: string | null };

export const REPORT_SLOTS = [7, 13, 19]; // 하루 3번(한국시간)
const ID_PREFIX = '0-fn-';
const KEEP_REPORTS = 30; // 최근 30회차(약 열흘)만 보관
const MAX_AGE_MS = 48 * 3600_000;
const MAX_CANDIDATES = 40;

// 한국 관련 1차 거름 — 놓치지 않으려고 넓게, 진짜 관련성은 제미나이가 가림
const KOREA_RE =
  /\b(south korea|north korea|korea|korean|koreans|seoul|pyongyang|kim jong|lee jae-?myung|yoon suk|han duck|park chung|moon jae|dmz|panmunjom|busan|incheon|samsung|hyundai|sk hynix|lg energy|k-pop|bts|blackpink|kospi)\b/i;

const kstNow = () => new Date(Date.now() + 9 * 3600_000);
const kstDate = () => kstNow().toISOString().slice(0, 10);
const kstHour = () => kstNow().getUTCHours();
const slotFor = (hour: number) => (hour >= 19 ? 19 : hour >= 13 ? 13 : hour >= 7 ? 7 : 0);
const slotId = (slot: number) => `${ID_PREFIX}${kstDate()}-${String(slot).padStart(2, '0')}`;

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
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  return JSON.parse(start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned);
}

const SLOT_NAME: Record<number, string> = { 7: '아침', 13: '낮', 19: '저녁', 0: '새벽' };

export async function buildForeignNews(slot: number): Promise<ForeignNewsReport> {
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
    .sort((a, b) => (Date.parse(b.publishedAt ?? '') || 0) - (Date.parse(a.publishedAt ?? '') || 0))
    .slice(0, MAX_CANDIDATES);

  const when = SLOT_NAME[slot] ?? '';
  const report: ForeignNewsReport = {
    generatedAt: new Date().toISOString(),
    slot,
    greeting: `${when} 보고드립니다. 김정신 특파원입니다.`,
    overview: '',
    picks: [],
    fetched: all.length,
    candidates: candidates.length,
    sourceErrors,
    aiError: null,
  };
  if (!candidates.length) {
    report.overview = '이번 회차에는 현지 주요 언론에서 한국과 관련해 눈에 띄는 기사를 찾지 못했습니다.';
    return report;
  }

  // 자동 선별이 안 될 때도 현지 언론 기사 링크는 그대로 보여 드림
  const fallback = () =>
    candidates.slice(0, 10).map((c, i): ForeignPick => ({
      priority: i < 3 ? 1 : i < 6 ? 2 : 3,
      outlet: c.outlet,
      originalTitle: c.title,
      titleKo: '',
      summaryKo: '',
      whyKorea: '',
      tone: '',
      advice: '',
      url: c.url,
      publishedAt: c.publishedAt,
    }));

  if (!geminiReady()) {
    report.aiError = '제미나이 키(GEMINI_API_KEY)가 없어 번역·권고 없이 원문 제목과 링크만 보여 드립니다.';
    report.overview = '자동 요약을 쓸 수 없어 한국 관련 후보 기사 목록만 올립니다.';
    report.picks = fallback();
    return report;
  }

  const list = candidates.map((c, i) => `[${i}] (${c.outlet}) ${c.title}\n    ${c.summary}`).join('\n');
  const prompt = `당신은 한국 인터넷신문 "팩트파인더"(중도주의 관점으로 정치·사회를 다룸)의 김정신 특파원입니다. 현지 주요 언론이 한국 관련 이슈를 어떻게 다루는지 살펴 편집국에 ${when} 보고를 올립니다.
아래는 영미 주요 외신의 최근 기사 목록(번호, 매체, 제목, 짧은 소개글)입니다.

할 일:
1. 한국이 직접 주제이거나 한국의 정치·외교·안보·경제·사회 이슈를 의미 있게 다룬 기사만 최대 8개 고릅니다. 한국이 지나가듯 한 번 언급되는 기사, 연예·스포츠 단신은 제외합니다.
2. 말투는 **반드시 존댓말**(예: "~입니다", "~로 보입니다", "~하시길 권합니다")을 쓰고, 편집국에 보고하는 정중한 어조로 씁니다.
3. 각 기사마다 편집국이 어떤 방향으로 쓰면 좋을지 **권고**(advice)를 존댓말로 한 문장 씁니다. 예: "미국 쪽 시각과 우리 정부 입장을 나란히 놓고 쟁점을 정리하는 방향으로 쓰시길 권합니다." 팩트파인더는 진영논리를 벗어난 중도 관점입니다.
4. 기사 본문은 주어지지 않았습니다. 제목과 소개글에 없는 사실을 지어내지 마세요. 확실하지 않으면 "소개글 기준으로는"이라고 쓰세요. 직접 현지에서 취재했다거나 본 것처럼 쓰지 마세요.
5. 출력은 JSON 객체 하나만(설명·코드블록 금지):
{"overview": "이번 회차 종합 2~3문장(존댓말)", "items": [{"idx": 번호, "priority": 1~3(1이 가장 먼저), "titleKo": "자연스러운 한국어 제목", "summaryKo": "한국어 2~3문장 요약", "whyKorea": "한국과 어떻게 관련되는지 한 문장", "tone": "현지 언론이 이 이슈를 어떤 시각·관심으로 다루는지 한 문장", "advice": "권고 한 문장(존댓말)"}]}

기사 목록:
${list}`;

  try {
    const parsed = parseJson(await generateText(prompt, { temperature: 0.3 }));
    const picks: ForeignPick[] = [];
    for (const p of Array.isArray(parsed?.items) ? parsed.items : []) {
      const c = candidates[Number(p?.idx)];
      if (!c) continue; // 번호가 목록에 없으면 버림 — 링크는 번호로만 연결되므로 항상 실제 수집한 기사 주소
      picks.push({
        priority: [1, 2, 3].includes(Number(p.priority)) ? Number(p.priority) : 3,
        outlet: c.outlet,
        originalTitle: c.title,
        titleKo: String(p.titleKo ?? ''),
        summaryKo: String(p.summaryKo ?? ''),
        whyKorea: String(p.whyKorea ?? ''),
        tone: String(p.tone ?? ''),
        advice: String(p.advice ?? ''),
        url: c.url,
        publishedAt: c.publishedAt,
      });
    }
    report.picks = picks.sort((a, b) => a.priority - b.priority).slice(0, 8);
    report.overview = String(parsed?.overview ?? '');
    if (!report.picks.length) {
      report.overview ||= '이번 회차에는 한국과 관련해 보고드릴 만한 현지 기사를 찾지 못했습니다.';
    }
  } catch (e) {
    report.aiError = e instanceof Error ? e.message : '자동 선별 실패';
    report.overview = '자동 요약에 실패해 후보 기사 목록만 올립니다.';
    report.picks = fallback();
  }
  return report;
}

let inFlight: Promise<ForeignNewsReport> | null = null;

// 한 회차를 새로 만들어 저장(같은 회차가 있으면 덮어씀) — 수동 "지금 새로 받기"도 이걸 씀
export function refreshForeignNews(): Promise<ForeignNewsReport> {
  if (!inFlight) {
    inFlight = (async () => {
      const slot = slotFor(kstHour());
      const report = await buildForeignNews(slot);
      const id = slotId(slot);
      await prisma.analyticsSnapshot.upsert({
        where: { id },
        update: { data: report as any, createdAt: new Date() },
        create: { id, data: report as any },
      });
      // 오래된 회차 정리
      const old = await prisma.analyticsSnapshot.findMany({
        where: { id: { startsWith: ID_PREFIX } },
        orderBy: { id: 'desc' },
        skip: KEEP_REPORTS,
        select: { id: true },
      });
      if (old.length) await prisma.analyticsSnapshot.deleteMany({ where: { id: { in: old.map((o) => o.id) } } });
      return report;
    })().finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
}

// 특파원 프로필 사진(AI가 만든 가상 인물) 주소 — 편집장이 관리 화면에서 올림. 보고서와 섞이지 않게 id를 '0-fa-'로 따로 둠
const AVATAR_ID = '0-fa-avatar';

export async function getForeignAvatar(): Promise<string | null> {
  const row = await prisma.analyticsSnapshot.findUnique({ where: { id: AVATAR_ID } });
  const url = (row?.data as any)?.url;
  return typeof url === 'string' ? url : null;
}

export async function setForeignAvatar(url: string) {
  await prisma.analyticsSnapshot.upsert({
    where: { id: AVATAR_ID },
    update: { data: { url } as any, createdAt: new Date() },
    create: { id: AVATAR_ID, data: { url } as any },
  });
}

// 최근 보고서들(최신 먼저)
export async function recentForeignReports(limit = 6): Promise<ForeignNewsReport[]> {
  const rows = await prisma.analyticsSnapshot.findMany({
    where: { id: { startsWith: ID_PREFIX } },
    orderBy: { id: 'desc' },
    take: limit,
  });
  return rows.map((r) => r.data as unknown as ForeignNewsReport);
}

// /api/health에서 호출 — 기다리지 않고, 07·13·19시 보고 시각이 지났는데 그 회차가 아직 없으면 한 번 만듦
export function ensureForeignNews() {
  const hour = kstHour();
  if (hour < REPORT_SLOTS[0] || inFlight) return;
  const id = slotId(slotFor(hour));
  prisma.analyticsSnapshot
    .findUnique({ where: { id }, select: { id: true } })
    .then((row) => (row ? null : refreshForeignNews()))
    .catch(() => {});
}
