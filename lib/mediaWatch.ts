import { prisma } from '@/lib/prisma';

// 매체 동향 (2026-10-09) — 사장님이 지정한 5개 매체의 오늘 신문 지면(1면 등)·많이 본 뉴스·댓글 많은 뉴스를
// 네이버 언론사 페이지에서 모아, 여러 매체가 함께 다룬 키워드와 팩트파인더가 아직 안 쓴 이슈를 숫자로 뽑는다.
// 제미나이 기사 아이디어(lib/geminiAnalysis.ts)의 재료. 대상 매체: 조선·중앙·동아·매일신문·서울신문 (진보지는 넣지 않음 — 사장님 지시)

export const OUTLETS = [
  { oid: '023', name: '조선일보' },
  { oid: '025', name: '중앙일보' },
  { oid: '020', name: '동아일보' },
  { oid: '088', name: '매일신문' },
  { oid: '081', name: '서울신문' },
  { oid: '015', name: '한국경제' }, // 2026-10-09 사장님 추가
] as const;

export type MediaItem = { title: string; url: string; rank?: number; page?: string };
export type OutletData = {
  oid: string;
  name: string;
  paperDate: string | null; // 지면 날짜(오늘 지면이 아직 없으면 어제)
  newspaper: MediaItem[]; // 지면 기사(면 표시)
  popular: MediaItem[]; // 많이 본 뉴스 20
  commented: MediaItem[]; // 댓글 많은 뉴스 20
  error?: string;
};
export type KeywordRow = {
  word: string;
  outlets: string[]; // 다룬 매체
  articles: number; // 제목에 나온 기사 수(중복 제거)
  front: number; // 1면에 나온 매체 수
  popular: number; // 많이 본 뉴스에 든 기사 수
  commented: number; // 댓글 많은 뉴스에 든 기사 수
  oursWeek: number; // 팩트파인더 최근 7일 기사 수
  oursAll: number; // 팩트파인더 전체(옛 기사 포함)
  related: { id: string; title: string; date: string | null }[]; // 연결할 우리 옛 기사
};
export type MediaWatch = { generatedAt: string; outlets: OutletData[]; keywords: KeywordRow[] };

const UA = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36' };

async function get(url: string) {
  const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(20_000), cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

const decode = (s: string) =>
  s
    .replace(/&quot;|&#034;/g, '"')
    .replace(/&#039;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();

// 지면: <h3><span class="page_notation"><em>A1</em>면</span></h3> 아래 <a href=…><strong>제목</strong>
function parseNewspaper(html: string): MediaItem[] {
  const items: MediaItem[] = [];
  const blocks = html.split('class="page_notation"').slice(1);
  for (const b of blocks) {
    const page = b.match(/<em>([^<]+)<\/em>/)?.[1]?.trim();
    const end = b.indexOf('</ul>');
    const part = end > 0 ? b.slice(0, end) : b;
    for (const m of part.matchAll(/<a [^>]*?href="([^"]+)"[\s\S]*?<strong>([\s\S]*?)<\/strong>/g)) {
      const title = decode(m[2].replace(/<[^>]+>/g, ''));
      if (title) items.push({ title, url: m[1].replace(/&amp;/g, '&'), page: page ? `${page}면` : undefined });
    }
  }
  return items;
}

// 랭킹: <a href=…><em class="list_ranking_num">1</em> … <strong class="list_title">제목</strong>
function parseRanking(html: string): MediaItem[] {
  const items: MediaItem[] = [];
  for (const m of html.matchAll(/<a [^>]*?href="([^"]+)"[^>]*>\s*<em class="list_ranking_num">(\d+)<\/em>[\s\S]*?<strong class="list_title">([\s\S]*?)<\/strong>/g)) {
    items.push({ title: decode(m[3].replace(/<[^>]+>/g, '')), url: m[1].replace(/&amp;/g, '&'), rank: Number(m[2]) });
  }
  return items.slice(0, 20);
}

const kstYmd = (offsetDays = 0) => new Date(Date.now() + 9 * 3600_000 - offsetDays * 86400_000).toISOString().slice(0, 10).replace(/-/g, '');

async function fetchOutlet(oid: string, name: string): Promise<OutletData> {
  const out: OutletData = { oid, name, paperDate: null, newspaper: [], popular: [], commented: [] };
  const errors: string[] = [];
  await Promise.all([
    (async () => {
      // 오늘 지면이 아직 안 올라왔으면(이른 아침·휴간일) 어제 지면
      for (const off of [0, 1, 2]) {
        const d = kstYmd(off);
        const items = parseNewspaper(await get(`https://media.naver.com/press/${oid}/newspaper?date=${d}`));
        if (items.length) {
          out.newspaper = items;
          out.paperDate = `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
          return;
        }
      }
    })().catch((e) => errors.push(`지면 ${e.message}`)),
    get(`https://media.naver.com/press/${oid}/ranking`)
      .then((h) => (out.popular = parseRanking(h)))
      .catch((e) => errors.push(`많이 본 ${e.message}`)),
    get(`https://media.naver.com/press/${oid}/ranking?type=comment`)
      .then((h) => (out.commented = parseRanking(h)))
      .catch((e) => errors.push(`댓글 ${e.message}`)),
  ]);
  if (errors.length) out.error = errors.join(', ');
  return out;
}

// ── 제목 → 키워드 (형태소 분석기 없이: 조사 떼기 + 불용어) ──
const HANJA: Record<string, string> = {
  北: '북한', 美: '미국', 中: '중국', 日: '일본', 野: '야당', 與: '여당', 韓: '한국', 李: '이재명', 尹: '윤석열', 盧: '노무현', 文: '문재인', 朴: '박근혜', 檢: '검찰', 靑: '청와대', 軍: '군', 英: '영국', 獨: '독일', 佛: '프랑스', 露: '러시아', 與野: '여야',
};
const STOP = new Set(
  (
    '사진 단독 종합 속보 오늘 내일 어제 올해 내년 작년 지난 이번 최대 최고 최초 전국 관련 위해 대해 통해 따라 위한 대한 있다 없다 한다 했다 된다 됐다 ' +
    '아니 그리고 하지만 이유 결국 다시 모두 기자 칼럼 사설 오피니언 포토 영상 인터뷰 논란 가능 여부 우리 정부 대통령 국회 의원 사람 이후 이전 ' +
    '이상 이하 가운데 그런데 이런 그런 어떻게 무슨 이제 아직 지금 바로 더는 계속 처음 마지막 하루 시간 오전 오후 주년 만에 가장 앞두고 앞서 ' +
    '발표 공개 확인 추진 검토 강조 주장 지적 비판 반발 촉구 요구 제기 언급 밝혀 밝혔다 말했다 전망 우려 예정 시작 진행 결정 기준 사실 문제 상황 ' +
    '한글날 기념 행사 개최 축제 특집 연재 기획 시론 포럼 사람들 이야기 세상 한국 국민 여야 여당 야당 세계 서울 물러선 새로운 모든'
  ).split(/\s+/),
);
const JOSA_LONG = ['에서는', '으로는', '에게서', '이라고', '이라며', '에서도', '으로도', '에서', '으로', '에게', '까지', '부터', '처럼', '보다', '이라', '라고', '하고', '이나', '에는', '와의', '과의', '에도', '이며', '이자'];
const JOSA_SHORT = ['은', '는', '이', '가', '을', '를', '의', '에', '엔'];
const JOSA_SHORT4 = ['도', '로', '와', '과', '만', '서']; // 짧은 명사(한반도·제도 등)를 망치지 않게 4글자 이상에서만

export function titleKeywords(title: string): string[] {
  let t = title.replace(/\[[^\]]*\]|【[^】]*】|<[^>]*>/g, ' ');
  for (const [h, w] of Object.entries(HANJA)) t = t.replace(new RegExp(`${h}(?=[^\\u4e00-\\u9fff]|$)`, 'g'), ` ${w} `);
  const words = new Set<string>();
  for (let w of t.split(/[^0-9A-Za-z가-힣]+/)) {
    if (!w) continue;
    for (const j of JOSA_LONG) if (w.length - j.length >= 2 && w.endsWith(j)) { w = w.slice(0, -j.length); break; }
    for (const j of JOSA_SHORT) if (w.length - j.length >= 2 && w.endsWith(j)) { w = w.slice(0, -j.length); break; }
    for (const j of JOSA_SHORT4) if (w.length >= 4 && w.endsWith(j)) { w = w.slice(0, -j.length); break; }
    if (w.length < 2 || w.length > 12 || /^\d+$/.test(w) || STOP.has(w)) continue;
    words.add(w);
  }
  return [...words];
}

export async function buildMediaWatch(): Promise<MediaWatch> {
  const outlets = await Promise.all(OUTLETS.map((o) => fetchOutlet(o.oid, o.name)));

  // 키워드 집계 — 같은 기사(제목)가 지면·랭킹에 겹쳐도 한 번만 셈
  type Acc = { outlets: Set<string>; titles: Set<string>; front: Set<string>; popular: Set<string>; commented: Set<string> };
  const acc = new Map<string, Acc>();
  const add = (word: string, outlet: string, title: string, kind: 'paper' | 'front' | 'popular' | 'commented') => {
    let a = acc.get(word);
    if (!a) acc.set(word, (a = { outlets: new Set(), titles: new Set(), front: new Set(), popular: new Set(), commented: new Set() }));
    a.outlets.add(outlet);
    a.titles.add(title);
    if (kind === 'front') a.front.add(outlet);
    if (kind === 'popular') a.popular.add(title);
    if (kind === 'commented') a.commented.add(title);
  };
  for (const o of outlets) {
    for (const it of o.newspaper) for (const w of titleKeywords(it.title)) add(w, o.name, it.title, /^A?1면$/.test(it.page ?? '') ? 'front' : 'paper');
    for (const it of o.popular) for (const w of titleKeywords(it.title)) add(w, o.name, it.title, 'popular');
    for (const it of o.commented) for (const w of titleKeywords(it.title)) add(w, o.name, it.title, 'commented');
  }

  const candidates = [...acc.entries()]
    .map(([word, a]) => ({
      word,
      a,
      score: a.outlets.size * 3 + a.front.size * 3 + a.popular.size * 2 + a.commented.size * 2 + a.titles.size,
    }))
    .filter((x) => x.a.outlets.size >= 2 || x.a.front.size || x.a.popular.size + x.a.commented.size >= 2)
    .sort((x, y) => y.score - x.score);
  const scored = candidates
    // 같은 기사들에서 나온 곁가지 단어는 뺌 — 예) "정청래" 뒤의 "비자·발급·보류" (기사 70% 이상 겹치면 같은 이슈)
    .reduce<typeof candidates>((picked, c) => {
      if (picked.length >= 15) return picked;
      const dup = picked.some((p) => {
        let common = 0;
        for (const t of c.a.titles) if (p.a.titles.has(t)) common++;
        // 넓은 단어(미국·북한)가 구체적인 단어(정청래)를 삼키지 않게 양쪽 다 많이 겹칠 때만
        return common / c.a.titles.size >= 0.7 && common / p.a.titles.size >= 0.5;
      });
      if (!dup) picked.push(c);
      return picked;
    }, []);

  // 팩트파인더 기사와 대조 — 최근 7일 몇 건, 전체 몇 건, 연결할 옛 기사 2건
  const since = new Date(Date.now() - 7 * 86400_000);
  const keywords: KeywordRow[] = await Promise.all(
    scored.map(async ({ word, a }) => {
      const where = { status: 'PUBLISHED' as const, title: { contains: word } };
      const [oursWeek, oursAll, related] = await Promise.all([
        prisma.article.count({ where: { ...where, publishedAt: { gte: since } } }),
        prisma.article.count({ where }),
        prisma.article.findMany({ where, orderBy: { publishedAt: 'desc' }, take: 2, select: { id: true, title: true, publishedAt: true } }),
      ]);
      return {
        word,
        outlets: OUTLETS.map((o) => o.name).filter((n) => a.outlets.has(n)),
        articles: a.titles.size,
        front: a.front.size,
        popular: a.popular.size,
        commented: a.commented.size,
        oursWeek,
        oursAll,
        related: related.map((r) => ({ id: r.id, title: r.title, date: r.publishedAt?.toISOString().slice(0, 10) ?? null })),
      };
    }),
  );

  if (outlets.every((o) => !o.newspaper.length && !o.popular.length)) {
    throw new Error(`네이버에서 매체 기사를 받지 못했습니다 (${outlets.map((o) => o.error).filter(Boolean)[0] ?? '빈 응답'})`);
  }
  return { generatedAt: new Date().toISOString(), outlets, keywords };
}
