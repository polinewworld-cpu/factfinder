import { prisma } from '@/lib/prisma';
import { generateText, geminiReady } from '@/lib/gemini';
import { resolveMarkers, stripMarkers } from '@/lib/linkMarkup';

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
  { name: 'France 24', url: 'https://www.france24.com/en/rss' },
] as const;

// 특파원이 그날 "있는 곳" — 매체 본사 도시. 매일(회차마다) 기사가 있는 나라로 바뀜. 날씨는 이 좌표로 실측값을 가져온다.
const OUTLET_CITY: Record<string, { ko: string; lat: number; lon: number }> = {
  BBC: { ko: '런던', lat: 51.5074, lon: -0.1278 },
  'The Guardian': { ko: '런던', lat: 51.5074, lon: -0.1278 },
  'The New York Times': { ko: '뉴욕', lat: 40.7128, lon: -74.006 },
  WSJ: { ko: '뉴욕', lat: 40.7128, lon: -74.006 },
  NPR: { ko: '워싱턴', lat: 38.9072, lon: -77.0369 },
  'The Washington Post': { ko: '워싱턴', lat: 38.9072, lon: -77.0369 },
  CNN: { ko: '홍콩', lat: 22.3193, lon: 114.1694 },
  'Al Jazeera': { ko: '도하', lat: 25.2854, lon: 51.531 },
  DW: { ko: '베를린', lat: 52.52, lon: 13.405 },
  'France 24': { ko: '파리', lat: 48.8566, lon: 2.3522 },
};

const WEATHER_KO = (code: number) =>
  code === 0 ? '맑음' : code <= 3 ? '구름 낀 하늘' : code <= 48 ? '안개' : code <= 57 ? '이슬비' : code <= 67 ? '비' : code <= 77 ? '눈' : code <= 82 ? '소나기' : code <= 86 ? '눈보라' : '뇌우';

async function fetchWeather(lat: number, lon: number): Promise<{ text: string; temp: number } | null> {
  try {
    const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&timezone=auto`, {
      signal: AbortSignal.timeout(8_000),
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const c = (await res.json())?.current;
    if (typeof c?.temperature_2m !== 'number') return null;
    return { text: WEATHER_KO(Number(c.weather_code)), temp: Math.round(c.temperature_2m) };
  } catch {
    return null; // 날씨를 못 받아도 보고는 올림(날씨 이야기만 뺌)
  }
}

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

export type ForeignBrief = {
  text: string; // 한국 관련 기사가 무슨 일인지 한 문장(사실)
  advice?: string; // 편집국이 어떤 방향으로 쓰면 좋을지 권고 한 문장(존댓말)
  outlet: string;
  url: string; // 현지 언론 기사 링크 — 항상 있음
};

export type ForeignNewsReport = {
  generatedAt: string;
  slot: number; // 보고 시각(한국시간 7·13·19, 0은 새벽 수동 갱신)
  greeting: string; // 특파원 인사(화면에는 표시하지 않음)
  overview: string; // (옛 보고서용) 이번 회차 종합 문단 — 새 보고서는 overviewItems를 씀
  overviewItems?: string[]; // 이번 회차 이슈를 불릿 한 줄씩(진실이처럼) — 줄마다 핵심 구절 링크
  place?: { city: string; weather: string | null; temp: number | null }; // 그날 특파원이 있는 곳(실측 날씨)
  localColor?: string; // 현지 분위기 이야기(날씨·현지 소식·연예계 등, 재미있게)
  closing?: string; // 마무리 인사(말미에 한두 문장, 편집국을 챙기는 따뜻한 한마디)
  briefs: ForeignBrief[]; // 한 줄 브리핑 — 다양한 이슈를 한 줄씩(링크 포함)
  picks: ForeignPick[];
  fetched: number; // 모은 기사 수
  candidates: number; // 한국 관련 1차 후보 수
  sourceErrors: { outlet: string; error: string }[];
  aiError?: string | null;
};

type Raw = { outlet: string; title: string; url: string; summary: string; publishedAt: string | null };

export const REPORT_SLOTS = [7, 13, 19]; // 하루 3번(한국시간)
const ID_PREFIX = '0-fn-';
const MAX_AGE_MS = 48 * 3600_000;
const MAX_CANDIDATES = 70;

// 한국 관련 1차 거름 — 놓치지 않으려고 넓게, 진짜 관련성은 제미나이가 가림
const KOREA_RE =
  /\b(south korea|north korea|korea|korean|koreans|seoul|pyongyang|kim jong|lee jae[- ]?myung|yoon suk|han duck|han dong-?hoon|park chung|moon jae|people power party|national assembly|blue house|dmz|panmunjom|busan|incheon|samsung|hyundai|sk hynix|lg energy|k-pop|bts|blackpink|kospi)\b/i;

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
    greeting: '편집장님. 김정신 특파원입니다.',
    overview: '',
    briefs: [],
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
    candidates.slice(0, 15).map((c, i): ForeignPick => ({
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

  // 오늘 있는 곳: 후보 기사가 있는 매체들의 도시 중에서 날짜·회차로 돌려가며 고름
  const cities = Array.from(new Set(candidates.map((c) => OUTLET_CITY[c.outlet]?.ko).filter(Boolean))) as string[];
  const dayNum = Math.floor((Date.now() + 9 * 3600_000) / 86400_000);
  const cityKo = cities.length ? cities[(dayNum * 3 + REPORT_SLOTS.indexOf(slot) + 1) % cities.length] : null;
  const cityInfo = Object.values(OUTLET_CITY).find((c) => c.ko === cityKo) ?? null;
  const weather = cityInfo ? await fetchWeather(cityInfo.lat, cityInfo.lon) : null;
  if (cityKo) report.place = { city: cityKo, weather: weather?.text ?? null, temp: weather?.temp ?? null };
  // 현지 분위기 재료 — 그 도시 매체의 한국 무관 헤드라인(파업·행사·연예 등) 최대 25개
  const nonKorea = all.filter((r) => !KOREA_RE.test(`${r.title} ${r.summary}`));
  const localRaw = [
    ...nonKorea.filter((r) => cityKo && OUTLET_CITY[r.outlet]?.ko === cityKo).slice(0, 25),
    ...nonKorea.filter((r) => !(cityKo && OUTLET_CITY[r.outlet]?.ko === cityKo)).slice(0, 20),
  ];
  const localHeads = localRaw.map((r, i) => `[L${i}] (${r.outlet}) ${r.title}`);
  const nextReport = slot === 7 ? '낮 보고' : slot === 13 ? '저녁 보고' : slot === 19 ? '내일 아침 보고' : '아침 보고';
  const todayKo = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);

  const hoursAgo = (iso: string | null) => (iso ? `${Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 3600_000))}시간 전` : '시각 미상');
  const list = candidates.map((c, i) => `[C${i}] (${c.outlet}, ${hoursAgo(c.publishedAt)}) ${c.title}\n    ${c.summary}`).join('\n');
  const prompt = `당신은 한국 인터넷신문 "팩트파인더"(중도주의 관점으로 정치·사회를 다룸)의 김정신 특파원입니다. 현지 주요 언론이 한국 관련 이슈를 어떻게 다루는지 살펴 편집국에 ${when} 보고를 올립니다.
아래는 영미 주요 외신의 최근 기사 목록(번호, 매체, 제목, 짧은 소개글)입니다.

할 일: 보고서는 아래 네 부분이고, **부분끼리 내용이 겹치지 않게** 나눕니다.
1. localColor: 보고 맨 앞의 정감 있는 현지 이야기(규칙은 아래).
2. overviewItems = "오늘의 이슈": **한국과 무관한** 해외 소식 불릿 5~7줄. 재미있거나, 쓸모 있거나, 유행·화제인 이야기(생활·과학·기술·음식·문화·날씨·신기한 뉴스 등)를 수다 떨듯 한 줄씩 소개합니다. 재료는 아래 "현지 헤드라인"([L번호])뿐이고 목록에 없는 건 쓰지 마세요. 전쟁·정치 공방·참사 속보 같은 무거운 소식은 피하고, 한국 관련 기사([C번호])는 여기에 넣지 마세요(3번에서 다룹니다). 마땅한 헤드라인이 없으면 빈 배열로 둡니다.
3. briefs = "한 줄 브리핑": **한국 관련 기사** 8~12개([C번호]). 한국이 직접 주제이거나 한국의 정치·외교·안보·경제·사회·문화 이슈를 의미 있게 다룬 기사만 고릅니다(지나가듯 한 번 언급되거나 연예·스포츠 단신은 제외). 같은 사건을 여러 매체가 다뤘다면 한 줄로 묶고 매체 시각 차이를 언급합니다. 항목마다 text(무슨 일인지 사실만 한 문장)와 advice(편집국이 어떤 방향으로 쓰면 좋을지 **권고** 한 문장)를 씁니다. 예) text: "우크라이나가 북한군 포로 전향 사실을 밝히면서 한국 정부가 대사를 소환했어요." advice: "미국 쪽 시각과 우리 정부 입장을 나란히 놓고 쟁점을 정리해 보세요, 그래야 진영 싸움으로 안 보이거든요." 팩트파인더는 진영논리를 벗어난 중도 관점입니다. 중요한 순서대로 씁니다.
4. closing: 마무리 인사(규칙은 아래).
최근 기사를 우선합니다. 기사 목록의 "N시간 전"을 참고하세요. 하루 이상 지난 기사는 정말 중요한 경우만 포함합니다.
4. 말투(중요): 편집장님과 선배 기자님들께 말하듯 **따뜻하고 재치 있는 존댓말**로 씁니다. 딱딱한 보고서체는 금지입니다. "~이에요", "~해요", "~거든요", "~하세요"를 자연스럽게 섞고, 위트는 한 스푼만 넣습니다. 이유를 곁들여 권하고 강조할 건 강조하세요. 예) "이 건은 미국 쪽 시각이 갈려서 이런 이유로 더 챙겨보세요. 여기가 포인트라서 이건 꼭 강조하셔야 해요."

   현지 이야기(localColor): 보고 맨 앞에 붙는 3~6문장. 오늘 ${cityKo ?? '현지'} 현지에서 막 쓰는 것처럼 **재미있고 가볍게**, 현지 느낌을 냅니다. 재료는 위에 준 **실측 날씨**와 **현지 헤드라인**뿐입니다. 날씨를 한마디 하고, 헤드라인에서 보이는 파업·행사·기념일·사건, 그리고 연예계·문화 소식이 있으면 "나도 봤다"는 식으로 수다 떨듯 소개하세요. 예) "여긴 오늘 비가 와서 다들 우산 쓰고 종종걸음이에요. 현지 뉴스를 보니 철도 파업 얘기가 한창이고요, 연예면에서 ○○ 소식도 눈에 띄었어요. 저도 괜히 한참 들여다봤네요." 규칙: 노래·영화·인물·차트 순위·기념일·파업 같은 **구체적 사실은 위 재료에 있을 때만** 말하고, 없으면 지어내지 마세요(가벼운 개인 일화는 허용: 커피, 우산, 흥얼거림 등. 단 곡명·순위처럼 확인 가능한 사실은 재료에 있을 때만). 오늘 날짜에 **확실히 알려진** 공휴일·기념일은 한마디 해도 되지만 확실하지 않으면 생략하세요. 기사 목록이나 현지 헤드라인에 **중국 관련 소식**(중국 정부·경제·안보·사회·문화 등)이 눈에 띄면 한 줄 언급해도 좋습니다. 없으면 억지로 넣지 마세요. 소식은 있는 그대로 사실대로 전하고, 중국인·화교 같은 **집단 전체를 싸잡거나 반감을 부추기는 표현은 쓰지 마세요**(개별 사건은 사건 자체로만).
   링크(중요): 현지 이야기(localColor)와 오늘의 이슈(overviewItems)에서 **핵심 구절**(사건·인물·이슈 이름)은 [[구절|번호]] 형식으로 감쌉니다. 번호는 기사 목록의 [C번호] 또는 현지 헤드라인의 [L번호]를 그대로 쓰세요(예: [[대만 큰 지진 소식|L3]], [[대사 소환|C5]]). 목록에 없는 건 링크하지 않습니다. 현지 이야기는 구절마다, 오늘의 이슈는 줄마다 하나 이상 링크를 답니다. 구절은 짧게(2~12자), 문장을 통째로 감싸지 마세요.
   마무리 인사(closing): 보고 끝의 따뜻한 한두 문장. **위에 준 실측 날씨**에 맞춰 챙기는 말(예: 쌀쌀하면 "날씨가 꽤 쌀쌀하니 감기 조심하시고요")을 하고, 이어서 **다음 보고(${nextReport})를 올리겠다는 예고**로 끝맺습니다. 예) "날씨가 꽤 쌀쌀하니 감기 조심하시고요, 저는 남은 외신들 마저 살펴보고 ${nextReport} 올릴게요." 실측 날씨가 없으면 날씨 얘기는 빼고 다른 안부로 합니다. 현지에서 실제로 벌어지는 구체적 사실(질병 유행, 사건, 통계 등)을 지어내서 단정하지 마세요.
6. 기사 본문은 주어지지 않았습니다. 제목과 소개글에 없는 사실을 지어내지 마세요. 확실하지 않으면 "소개글 기준으로는"이라고 쓰세요. 직접 현지에서 취재했다거나 본 것처럼 쓰지 마세요.
7. 출력은 JSON 객체 하나만(설명·코드블록 금지):
{"localColor": "현지 이야기 3~6문장", "overviewItems": ["오늘의 이슈 한 줄(한국 무관, 핵심 구절 [[구절|L번호]])"], "briefs": [{"idx": C번호의 숫자, "text": "사실 한 문장", "advice": "권고 한 문장(위 말투)"}], "closing": "마무리 인사 1~2문장"}

오늘 특파원이 있는 곳: ${cityKo ?? '(정해지지 않음)'} / 오늘 날짜(한국시간): ${todayKo} / 실측 날씨: ${weather ? `${weather.text}, ${weather.temp}도` : '(못 받음)'}
현지 매체의 오늘 헤드라인(현지 분위기 재료, 한국과 무관한 것들):
${localHeads.length ? localHeads.join('\n') : '(없음)'}

기사 목록:
${list}`;

  try {
    const parsed = parseJson(await generateText(prompt, { temperature: 0.3 }));
    const picks: ForeignPick[] = [];
    for (const p of Array.isArray(parsed?.items) ? parsed.items : []) {
      const c = candidates[Number(String(p?.idx ?? '').replace(/^C/i, ''))];
      if (!c) continue; // 번호가 목록에 없으면 버림 — 링크는 번호로만 연결되므로 항상 실제 수집한 기사 주소
      picks.push({
        priority: [1, 2, 3].includes(Number(p.priority)) ? Number(p.priority) : 3,
        outlet: c.outlet,
        originalTitle: c.title,
        titleKo: stripMarkers(String(p.titleKo ?? '')),
        summaryKo: stripMarkers(String(p.summaryKo ?? '')),
        whyKorea: stripMarkers(String(p.whyKorea ?? '')),
        tone: stripMarkers(String(p.tone ?? '')),
        advice: stripMarkers(String(p.advice ?? '')),
        url: c.url,
        publishedAt: c.publishedAt,
      });
    }
    report.picks = picks.sort((a, b) => a.priority - b.priority).slice(0, 15);
    // [[구절|C3 / L2]] 번호 → 실제로 수집한 기사 주소 (틀린 번호는 링크 없이 구절만 남김)
    const link = (t: string) =>
      resolveMarkers(t, (k) => {
        const n = Number(k.slice(1));
        return /^c/i.test(k) ? candidates[n]?.url : /^l/i.test(k) ? localRaw[n]?.url : undefined;
      });
    report.overviewItems = (Array.isArray(parsed?.overviewItems) ? parsed.overviewItems : [])
      .map((t: unknown) => link(String(t ?? '').trim()))
      .filter(Boolean)
      .slice(0, 8);
    report.overview = report.overviewItems?.length ? '' : link(String(parsed?.overview ?? ''));
    report.closing = stripMarkers(String(parsed?.closing ?? '').trim());
    report.localColor = link(String(parsed?.localColor ?? '').trim());
    const briefs: ForeignBrief[] = [];
    for (const b of Array.isArray(parsed?.briefs) ? parsed.briefs : []) {
      const c = candidates[Number(String(b?.idx ?? '').replace(/^C/i, ''))];
      const text = stripMarkers(String(b?.text ?? '').trim()); // 한 줄 브리핑은 옆에 매체 링크가 따로 있으니 글 속 표시는 글자만 남김
      if (!c || !text) continue; // 링크 없는 한 줄은 싣지 않음
      const advice = stripMarkers(String(b?.advice ?? '').trim());
      briefs.push({ text, advice: advice || undefined, outlet: c.outlet, url: c.url });
    }
    report.briefs = briefs.slice(0, 15);
    if (!report.briefs.length && !report.picks.length) {
      report.overview ||= '이번 회차에는 한국과 관련해 보고드릴 만한 현지 기사를 찾지 못했습니다.';
    }
  } catch (e) {
    report.aiError = e instanceof Error ? e.message : '자동 선별 실패';
    report.overview = '자동 요약에 실패해 후보 기사 목록만 올립니다.';
    report.picks = fallback();
    report.briefs = [];
  }
  return report;
}

let inFlight: Promise<ForeignNewsReport> | null = null;

// 한 회차를 새로 만들어 저장(같은 회차가 있으면 덮어씀, 지난 회차는 지우지 않고 계속 보관 — 추억으로 간직, 2026-10-10) — 수동 "지금 새로 받기"도 이걸 씀
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

// 최근 보고서들(최신 먼저)
export async function recentForeignReports(limit = 120): Promise<ForeignNewsReport[]> {
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
