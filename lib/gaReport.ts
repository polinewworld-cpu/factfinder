import { prisma } from '@/lib/prisma';
import { runReport } from '@/lib/ga';
import { authorName } from '@/lib/byline';

// 방문 분석 보고서 + 자동 인사이트 (2026-10-08) — 관리자 "방문 분석" 화면이 보여주는 내용 전체를 한 번에 만든다.
// GA 페이지 주소를 우리 기사와 이어 붙여(새 주소 /article/{id}, 옛 주소 /news/view.php?idx=N·/article/N) 기자·카테고리 성과까지 계산.

export type AnalyticsReport = {
  generatedAt: string;
  period: { from: string; to: string };
  summary: Totals & { prev: Totals };
  daily: { date: string; users: number; views: number }[];
  topArticles: { key: string; title: string; views: number; users: number; author: string | null; category: string | null; href: string | null }[];
  reporters: { name: string; views: number; articles: number }[];
  categories: { name: string; views: number }[];
  channels: { label: string; sessions: number; prevSessions: number }[];
  devices: { label: string; users: number }[];
  hours: { hour: number; views: number }[];
  weekdays: { day: number; views: number }[];
  insights: { tone: 'up' | 'down' | 'info'; text: string }[];
  // 제미나이 전략·정성 분석 (lib/geminiAnalysis.ts) — 키가 없거나 실패하면 null + 사유
  ai?: import('@/lib/geminiAnalysis').GeminiAnalysis | null;
  aiError?: string | null;
};

type Totals = { users: number; newUsers: number; sessions: number; views: number; engagementSec: number };

const THIS_WEEK = { startDate: '7daysAgo', endDate: 'yesterday' };
const LAST_WEEK = { startDate: '14daysAgo', endDate: '8daysAgo' };
const FOUR_WEEKS = { startDate: '28daysAgo', endDate: 'yesterday' };

const WEEKDAY = ['일', '월', '화', '수', '목', '금', '토'];
const DEVICE: Record<string, string> = { mobile: '모바일', desktop: 'PC', tablet: '태블릿' };

// GA 유입 출처 → 사람이 읽는 이름
function sourceLabel(src: string) {
  const s = src.toLowerCase();
  if (s === '(direct)') return '직접 방문';
  if (s.includes('naver')) return '네이버';
  if (s.includes('daum') || s.includes('kakao.com/search')) return '다음';
  if (s.includes('google')) return '구글';
  if (s.includes('kakao')) return '카카오톡';
  if (s.includes('facebook') || s === 'fb' || s.includes('m.facebook')) return '페이스북';
  if (s === 't.co' || s.includes('twitter') || s === 'x.com') return 'X(트위터)';
  if (s.includes('youtube')) return '유튜브';
  if (s.includes('instagram')) return '인스타그램';
  if (s.includes('bing')) return '빙';
  if (s.includes('factfinder')) return '사이트 내부';
  return src;
}

async function totals(range: { startDate: string; endDate: string }): Promise<Totals> {
  const [r] = await runReport({
    dateRanges: [range],
    metrics: ['activeUsers', 'newUsers', 'sessions', 'screenPageViews', 'userEngagementDuration'],
  });
  const m = r?.mets ?? [0, 0, 0, 0, 0];
  return { users: m[0], newUsers: m[1], sessions: m[2], views: m[3], engagementSec: m[0] ? Math.round(m[4] / m[0]) : 0 };
}

const pct = (now: number, prev: number) => (prev > 0 ? Math.round(((now - prev) / prev) * 100) : null);
const share = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);

export async function buildAnalyticsReport(): Promise<AnalyticsReport> {
  const [now, prev, dailyRows, pageRows, srcNow, srcPrev, deviceRows, hourRows, weekdayRows] = await Promise.all([
    totals(THIS_WEEK),
    totals(LAST_WEEK),
    runReport({ dateRanges: [FOUR_WEEKS], dimensions: ['date'], metrics: ['activeUsers', 'screenPageViews'], orderBy: { dimension: 'date' } }),
    runReport({ dateRanges: [THIS_WEEK], dimensions: ['pagePathPlusQueryString', 'pageTitle'], metrics: ['screenPageViews', 'activeUsers'], orderBy: { metric: 'screenPageViews' }, limit: 2000 }),
    runReport({ dateRanges: [THIS_WEEK], dimensions: ['sessionSource'], metrics: ['sessions'], limit: 200 }),
    runReport({ dateRanges: [LAST_WEEK], dimensions: ['sessionSource'], metrics: ['sessions'], limit: 200 }),
    runReport({ dateRanges: [THIS_WEEK], dimensions: ['deviceCategory'], metrics: ['activeUsers'] }),
    runReport({ dateRanges: [FOUR_WEEKS], dimensions: ['hour'], metrics: ['screenPageViews'] }),
    runReport({ dateRanges: [FOUR_WEEKS], dimensions: ['dayOfWeek'], metrics: ['screenPageViews'] }),
  ]);

  // ── 페이지 → 기사 연결 ──
  const ids = new Set<string>();
  const legacyIds = new Set<number>();
  const keyOf = (path: string) => {
    const cuid = path.match(/\/article\/([a-z0-9]{20,})/)?.[1];
    if (cuid) {
      ids.add(cuid);
      return `id:${cuid}`;
    }
    const legacy = path.match(/(?:\/article\/|\/news\/|[?&]idx=)(\d{1,7})(?!\d)/)?.[1];
    if (legacy && /article|news|idx=/.test(path)) {
      legacyIds.add(Number(legacy));
      return `legacy:${legacy}`;
    }
    return null;
  };
  const pageKeys = pageRows.map((r) => ({ key: keyOf(r.dims[0]), path: r.dims[0], title: r.dims[1], views: r.mets[0], users: r.mets[1] }));
  const articles = await prisma.article.findMany({
    where: { OR: [{ id: { in: [...ids] } }, { legacyId: { in: [...legacyIds] } }] },
    select: { id: true, legacyId: true, title: true, author: { select: { name: true, nickname: true } }, category: { select: { name: true } } },
  });
  const byKey = new Map<string, (typeof articles)[number]>();
  for (const a of articles) {
    byKey.set(`id:${a.id}`, a);
    if (a.legacyId) byKey.set(`legacy:${a.legacyId}`, a);
  }

  const agg = new Map<string, AnalyticsReport['topArticles'][number]>();
  let articleViews = 0;
  let legacyUrlViews = 0;
  for (const p of pageKeys) {
    if (!p.key) continue;
    const a = byKey.get(p.key);
    const k = a ? a.id : p.key;
    articleViews += p.views;
    if (p.key.startsWith('legacy:')) legacyUrlViews += p.views;
    const cur = agg.get(k) ?? {
      key: k,
      title: a?.title ?? p.title.replace(/\s*[-|]\s*팩트파인더.*$/, ''),
      views: 0,
      users: 0,
      author: a ? authorName(a.author) : null,
      category: a?.category?.name ?? null,
      href: a ? `/article/${a.id}` : null,
    };
    cur.views += p.views;
    cur.users += p.users;
    agg.set(k, cur);
  }
  const topAll = [...agg.values()].sort((x, y) => y.views - x.views);

  const sumBy = (field: 'author' | 'category') => {
    const m = new Map<string, { views: number; articles: number }>();
    for (const a of topAll) {
      const name = a[field];
      if (!name) continue;
      const cur = m.get(name) ?? { views: 0, articles: 0 };
      cur.views += a.views;
      cur.articles += 1;
      m.set(name, cur);
    }
    return [...m.entries()].map(([name, v]) => ({ name, ...v })).sort((x, y) => y.views - x.views);
  };
  const reporters = sumBy('author');
  const categories = sumBy('category').map(({ name, views }) => ({ name, views }));

  // ── 유입 출처 ──
  const groupSources = (rows: { dims: string[]; mets: number[] }[]) => {
    const m = new Map<string, number>();
    for (const r of rows) m.set(sourceLabel(r.dims[0]), (m.get(sourceLabel(r.dims[0])) ?? 0) + r.mets[0]);
    return m;
  };
  const chNow = groupSources(srcNow);
  const chPrev = groupSources(srcPrev);
  const channels = [...new Set([...chNow.keys(), ...chPrev.keys()])]
    .map((label) => ({ label, sessions: chNow.get(label) ?? 0, prevSessions: chPrev.get(label) ?? 0 }))
    .sort((x, y) => y.sessions - x.sessions)
    .slice(0, 10);

  const devices = deviceRows
    .map((r) => ({ label: DEVICE[r.dims[0]] ?? r.dims[0], users: r.mets[0] }))
    .sort((x, y) => y.users - x.users);
  const hours = Array.from({ length: 24 }, (_, h) => ({ hour: h, views: hourRows.find((r) => Number(r.dims[0]) === h)?.mets[0] ?? 0 }));
  const weekdays = Array.from({ length: 7 }, (_, d) => ({ day: d, views: weekdayRows.find((r) => Number(r.dims[0]) === d)?.mets[0] ?? 0 }));
  // GA는 방문 0인 날을 빼고 주므로 28일(한국시간 기준 28일 전~어제)을 0으로 채운다 (2026-10-09)
  const dailyMap = new Map(dailyRows.map((r) => [r.dims[0], r.mets]));
  const daily = Array.from({ length: 28 }, (_, k) => {
    const d = new Date(Date.now() + 9 * 3600_000 - (28 - k) * 86400_000).toISOString().slice(0, 10);
    const m = dailyMap.get(d.replace(/-/g, ''));
    return { date: d, users: m?.[0] ?? 0, views: m?.[1] ?? 0 };
  });

  // ── 인사이트 (규칙 기반, 매일 자동) ──
  const insights: AnalyticsReport['insights'] = [];
  const say = (tone: 'up' | 'down' | 'info', text: string) => insights.push({ tone, text });

  if (now.users < 30) say('info', `지난 7일 방문자가 ${now.users}명으로 아직 적어 아래 수치는 참고용입니다. 도메인을 2.0으로 옮긴 뒤 1~2주가 지나면 의미 있는 비교가 가능합니다.`);

  const du = pct(now.users, prev.users);
  if (du !== null && Math.abs(du) >= 5) {
    say(du > 0 ? 'up' : 'down', `방문자가 지난주보다 ${Math.abs(du)}% ${du > 0 ? '늘었습니다' : '줄었습니다'} (${prev.users.toLocaleString()}명 → ${now.users.toLocaleString()}명).`);
  } else if (du !== null) {
    say('info', `방문자는 지난주와 비슷합니다 (${now.users.toLocaleString()}명, ${du >= 0 ? '+' : ''}${du}%).`);
  }
  const perUser = now.users ? now.views / now.users : 0;
  const perUserPrev = prev.users ? prev.views / prev.users : 0;
  if (perUser && perUserPrev && Math.abs(perUser - perUserPrev) / perUserPrev >= 0.15) {
    say(perUser > perUserPrev ? 'up' : 'down', `방문자 1명이 보는 페이지가 ${perUserPrev.toFixed(1)}개 → ${perUser.toFixed(1)}개로 ${perUser > perUserPrev ? '늘었습니다. 관련기사·추천 동선이 효과를 내고 있습니다' : '줄었습니다. 기사 끝 관련기사·추천 노출을 점검해 보세요'}.`);
  }

  const top = topAll[0];
  if (top) {
    say('info', `이번 주 가장 많이 읽힌 기사는 「${top.title}」${top.author ? `(${top.author})` : ''} — 조회 ${top.views.toLocaleString()}회, 기사 조회의 ${share(top.views, articleViews)}%입니다.`);
    const top5Share = share(topAll.slice(0, 5).reduce((s, a) => s + a.views, 0), articleViews);
    if (top5Share >= 50) say('info', `상위 5개 기사가 기사 조회의 ${top5Share}%를 차지합니다. 잘 되는 주제의 후속 기사를 이어 쓰면 효과가 큽니다.`);
  }
  if (reporters[0] && reporters.length > 1) {
    say('info', `기자별로는 ${reporters[0].name}의 기사가 가장 많이 읽혔습니다 (조회 ${reporters[0].views.toLocaleString()}회, 기사 ${reporters[0].articles}건).`);
  }
  if (categories[0]) {
    const total = categories.reduce((s, c) => s + c.views, 0);
    say('info', `카테고리별 조회 비중: ${categories.slice(0, 4).map((c) => `${c.name} ${share(c.views, total)}%`).join(', ')}.`);
  }

  const totalSessions = channels.reduce((s, c) => s + c.sessions, 0);
  if (channels[0] && totalSessions > 0) {
    say('info', `유입 1위는 ${channels[0].label}(${share(channels[0].sessions, totalSessions)}%)입니다${channels[1] ? `, 그다음 ${channels[1].label}(${share(channels[1].sessions, totalSessions)}%)` : ''}.`);
    for (const c of channels.slice(0, 5)) {
      const change = pct(c.sessions, c.prevSessions);
      if (change !== null && c.prevSessions >= 20 && Math.abs(change) >= 30) {
        say(change > 0 ? 'up' : 'down', `${c.label} 유입이 지난주보다 ${Math.abs(change)}% ${change > 0 ? '늘었습니다' : '줄었습니다'}${
          c.label === '네이버' && change < 0 ? ' — 네이버 검색 노출(서치어드바이저 사이트맵·RSS 제출 상태)을 점검해 보세요' : ''
        }.`);
      }
    }
  }

  const mobile = devices.find((d) => d.label === '모바일');
  const devTotal = devices.reduce((s, d) => s + d.users, 0);
  if (mobile && devTotal) say('info', `방문자의 ${share(mobile.users, devTotal)}%가 휴대폰으로 봅니다${share(mobile.users, devTotal) >= 70 ? ' — 기사 제목·첫 사진은 휴대폰 화면 기준으로 다듬는 게 좋습니다' : ''}.`);

  const peak = [...hours].sort((a, b) => b.views - a.views)[0];
  if (peak?.views) {
    const before = (peak.hour + 23) % 24;
    say('info', `하루 중 가장 많이 읽히는 시간은 ${peak.hour}시대입니다. 중요한 기사는 ${before}시 전후에 발행하면 노출이 가장 큽니다.`);
  }
  const peakDay = [...weekdays].sort((a, b) => b.views - a.views)[0];
  const lowDay = [...weekdays].sort((a, b) => a.views - b.views)[0];
  if (peakDay?.views && lowDay) say('info', `요일별로는 ${WEEKDAY[peakDay.day]}요일이 가장 많고 ${WEEKDAY[lowDay.day]}요일이 가장 적습니다 (최근 4주).`);

  if (now.users) {
    const newShare = share(now.newUsers, now.users);
    say('info', `처음 온 방문자가 ${newShare}%, 다시 온 독자가 ${100 - newShare}%입니다${newShare >= 80 ? ' — 재방문을 늘리려면 뉴스레터 가입 유도가 효과적입니다' : ''}.`);
  }
  if (now.engagementSec) say('info', `방문자 1명당 평균 ${Math.floor(now.engagementSec / 60)}분 ${now.engagementSec % 60}초 머뭅니다.`);
  if (legacyUrlViews > 0 && articleViews > 0) {
    say('info', `기사 조회 중 ${share(legacyUrlViews, articleViews)}%가 옛 사이트 주소로 들어왔습니다${share(legacyUrlViews, articleViews) >= 20 ? ' — 옛 주소 연결(301)이 검색 유입을 지켜 주고 있습니다' : ''}.`);
  }

  const ymd = (offsetDays: number) => {
    const d = new Date(Date.now() + 9 * 3600_000 - offsetDays * 86400_000);
    return d.toISOString().slice(0, 10);
  };

  return {
    generatedAt: new Date().toISOString(),
    period: { from: ymd(7), to: ymd(1) },
    summary: { ...now, prev },
    daily,
    topArticles: topAll.slice(0, 20),
    reporters: reporters.slice(0, 15),
    categories,
    channels,
    devices,
    hours,
    weekdays,
    insights,
  };
}
