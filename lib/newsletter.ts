import { prisma } from '@/lib/prisma';
import { toFrenchBrackets } from '@/lib/frenchBrackets';
import { SITE_URL } from '@/lib/siteTags';
import { sign } from '@/lib/secretBox';
import { authorName } from '@/lib/byline';

// 팩트파인더 주간 뉴스레터 (기능정의서 6 → 2026-10-09 편집장 선택 → 2026-10-10 토요일 아침 자동 발송)
// 메일 HTML은 구독자마다 수신거부 링크만 다름 — {{UNSUBSCRIBE}} 자리에 끼워 넣어 보냄.

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const KST = 9 * 3600_000;
export const UNSUBSCRIBE_PLACEHOLDER = '{{UNSUBSCRIBE}}';
export const WEEKLY_MAX = 8;

// ── 날짜 ─────────────────────────────────────────────
// 한국 날짜 YYYY-MM-DD
export const kstDate = (d = new Date()) => new Date(d.getTime() + KST).toISOString().slice(0, 10);

// 발송 토요일 기준 지난 한 주: 지난 토요일 0시 ~ 금요일 24시(한국시간)
export function weekRangeFor(saturdayKey: string) {
  const end = new Date(`${saturdayKey}T00:00:00+09:00`);
  const start = new Date(end.getTime() - 7 * 86400_000);
  return { start, end };
}

// 오늘이 토요일이면 오늘, 아니면 다가오는 토요일 (한국 날짜)
export function upcomingSaturday(now = new Date()) {
  const k = new Date(now.getTime() + KST);
  const add = (6 - k.getUTCDay() + 7) % 7;
  k.setUTCDate(k.getUTCDate() + add);
  return k.toISOString().slice(0, 10);
}

// "10월 둘째 주" 같은 이름 (발송 토요일 기준 지난주 금요일이 속한 주)
const NTH = ['첫째', '둘째', '셋째', '넷째', '다섯째'];
export function weekLabel(saturdayKey: string) {
  const fri = new Date(new Date(`${saturdayKey}T12:00:00+09:00`).getTime() - 86400_000 + KST);
  return `${fri.getUTCMonth() + 1}월 ${NTH[Math.floor((fri.getUTCDate() - 1) / 7)]} 주`;
}

// ── 기사 ─────────────────────────────────────────────
const ARTICLE_SELECT = {
  id: true,
  title: true,
  excerpt: true,
  coverImageUrl: true,
  publishedAt: true,
  createdAt: true,
  viewCount: true,
  isFrontpageTop: true,
  category: { select: { name: true } },
  author: { select: { name: true, nickname: true } },
} as const;

export async function selectedArticles(ids: string[]) {
  if (!ids.length) return [];
  const rows = await prisma.article.findMany({ where: { id: { in: ids }, status: 'PUBLISHED' }, select: { ...ARTICLE_SELECT, content: true } });
  return rows.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
}

// 자동 선정: 그 주 발행 기사 중 1면톱 먼저, 나머지는 조회수 순으로 카테고리가 골고루 섞이게 최대 8개 (후원하기 제외)
export async function weeklyPicks(saturdayKey: string) {
  const { start, end } = weekRangeFor(saturdayKey);
  const rows = await prisma.article.findMany({
    where: { status: 'PUBLISHED', publishedAt: { gte: start, lt: end }, NOT: { category: { name: '후원하기' } } },
    select: { id: true, viewCount: true, isFrontpageTop: true, category: { select: { name: true } } },
    orderBy: { viewCount: 'desc' },
  });
  const picked: string[] = rows.filter((r) => r.isFrontpageTop).map((r) => r.id);
  const queues = new Map<string, string[]>();
  for (const r of rows) {
    if (picked.includes(r.id)) continue;
    const k = r.category?.name ?? '기타';
    queues.set(k, [...(queues.get(k) ?? []), r.id]);
  }
  // 카테고리마다 조회수 1등부터 돌아가며 한 개씩 (많이 읽힌 카테고리 먼저)
  const order = [...queues.entries()].sort((a, b) => (rows.find((r) => r.id === b[1][0])?.viewCount ?? 0) - (rows.find((r) => r.id === a[1][0])?.viewCount ?? 0));
  while (picked.length < WEEKLY_MAX && order.some(([, q]) => q.length)) {
    for (const [, q] of order) {
      const id = q.shift();
      if (id && picked.length < WEEKLY_MAX) picked.push(id);
    }
  }
  return picked;
}

// ── 인사말 ───────────────────────────────────────────
export const DEFAULT_GREETING = '구독자 여러분, 안녕하세요. 팩트파인더입니다.\n지난 한 주 팩트파인더가 전한 주요 기사를 모았습니다. 편안한 주말 보내세요.';

export function plainText(html: string, max = 1200) {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

export function greetingPrompt(articles: { title: string; content: string }[]) {
  const list = articles
    .map((a, i) => `[${i + 1}] 제목: ${toFrenchBrackets(a.title)}\n본문(앞부분): ${plainText(a.content, articles.length > 10 ? 600 : 1200)}`)
    .join('\n\n');
  return `당신은 인터넷신문 "팩트파인더"(정치·사회 중심)의 편집장입니다. 구독자에게 보내는 주간 뉴스레터 맨 앞 인사말을 쓰세요.
아래는 이번 뉴스레터에 담는 기사들입니다. 각 기사의 핵심을 간략히 정리해 인사말에 녹이세요.

형식:
- 첫 문장: 구독자에게 건네는 짧은 인사 (예: "구독자 여러분, 안녕하세요. 팩트파인더입니다.")
- 이어서 2~3개 문단: 기사들의 핵심 내용을 한두 문장씩, 비슷한 주제는 묶어서 자연스럽게
- 마지막 문장: 짧은 맺음말
- 전체 400~700자, 존댓말, 평문(마크다운·글머리표·이모지·따옴표 강조 없이)

규칙: 기사에 없는 사실을 만들지 말 것. 특정 정당·정치인을 지지하거나 비난하는 표현 없이 담담하게. 과장 금지.

기사:
${list}`;
}

// ── 메일 ─────────────────────────────────────────────
// 수신거부 링크 — 회원 id + 서명(위조 방지). 누르면 바로 해지, 지메일 [구독 취소] 버튼도 같은 주소
export const unsubscribeUrl = (userId: string) => `${SITE_URL}/api/newsletter/unsubscribe?u=${encodeURIComponent(userId)}&t=${sign(`unsub:${userId}`)}`;
export const validUnsubscribe = (userId: string, token: string) => !!userId && token === sign(`unsub:${userId}`);

// 메일 속 사진은 jpg 축소본(일부 메일 프로그램이 webp를 못 보여 줌). GIF도 정지 jpg로 — 원본은 수 MB라 메일이 무거워짐
const mailImage = (url: string | null) => {
  if (!url) return null;
  const abs = new URL(url, SITE_URL).toString();
  return url.startsWith('/api/blob/') ? `${abs}?w=800&f=jpg` : abs;
};

type MailArticle = Awaited<ReturnType<typeof selectedArticles>>[number];

export function buildNewsletterHtml(articles: MailArticle[], greeting: string, opts: { title: string; campaign: string }) {
  const link = (id: string) => `${SITE_URL}/article/${id}?utm_source=newsletter&utm_medium=email&utm_campaign=${opts.campaign}`;
  const items = articles
    .map((a, i) => {
      const img = mailImage(a.coverImageUrl);
      const meta = [authorName(a.author), a.category?.name].filter(Boolean).join(' · ');
      return `
      <tr><td style="padding:${i ? '22px' : '8px'} 0 22px;border-bottom:1px solid #eee;">
        ${img ? `<a href="${link(a.id)}"><img src="${esc(img)}" alt="" width="520" style="display:block;width:100%;max-width:520px;height:auto;border-radius:8px;margin:0 0 12px;border:0;"></a>` : ''}
        <a href="${link(a.id)}" style="font-size:18px;line-height:1.45;font-weight:700;color:#111;text-decoration:none;">${esc(toFrenchBrackets(a.title))}</a>
        ${a.excerpt ? `<p style="margin:8px 0 0;color:#444;font-size:14px;line-height:1.65;">${esc(toFrenchBrackets(a.excerpt))}</p>` : ''}
        <p style="margin:8px 0 0;color:#999;font-size:12px;">${esc(meta)}</p>
      </td></tr>`;
    })
    .join('');
  const greet = greeting.trim()
    ? `<div style="margin:0 0 8px;padding:18px 20px;background:#f7f4ee;border-radius:10px;color:#333;font-size:14px;line-height:1.8;">${esc(greeting.trim()).replace(/\n/g, '<br>')}</div>`
    : '';
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(opts.title)}</title></head>
<body style="margin:0;padding:0;background:#f2f2f2;">
<div style="max-width:560px;margin:0 auto;padding:24px 20px;background:#fff;font-family:'Apple SD Gothic Neo','Malgun Gothic',sans-serif;">
  <a href="${SITE_URL}/?utm_source=newsletter&utm_medium=email&utm_campaign=${opts.campaign}" style="display:inline-block;background:#ec1561;color:#fff;font-weight:800;font-size:18px;padding:6px 12px;border-radius:4px;text-decoration:none;">팩트파인더</a>
  <h1 style="font-size:20px;margin:16px 0 4px;color:#111;">${esc(opts.title)}</h1>
  <p style="margin:0 0 18px;color:#999;font-size:12px;">진영에 기대지 않는 중도의 시선</p>
  ${greet}
  <table role="presentation" style="width:100%;border-collapse:collapse;">${items || '<tr><td style="padding:16px 0;color:#999;">이번 주 기사가 없습니다.</td></tr>'}</table>
  <div style="margin:24px 0 0;padding:16px;border:1px solid #f3c6d6;border-radius:10px;text-align:center;">
    <p style="margin:0 0 10px;color:#333;font-size:14px;">진영에 기대지 않는 저널리즘은 독자 여러분의 후원으로 지켜집니다.</p>
    <a href="${SITE_URL}/donate?utm_source=newsletter&utm_medium=email&utm_campaign=${opts.campaign}" style="display:inline-block;background:#ec1561;color:#fff;font-weight:700;font-size:14px;padding:8px 18px;border-radius:999px;text-decoration:none;">팩트파인더 후원하기</a>
  </div>
  <p style="margin:28px 0 0;color:#aaa;font-size:11px;line-height:1.7;">
    이 메일은 팩트파인더 뉴스레터 구독을 신청한 회원에게 보냈습니다. 더 받지 않으려면 <a href="${UNSUBSCRIBE_PLACEHOLDER}" style="color:#888;">수신거부</a>를 누르세요(바로 해지).<br>
    팩트파인더 · 발행인 김남훈 · 편집인 윤주협 · 서울 마포구 와우산로32길 41 명인빌딩 B1 · 070-8028-2438 · polinewworld@gmail.com
  </p>
</div></body></html>`;
}

// 편집장이 직접 고른 기사 + 인사말 (뉴스레터 관리 화면 미리보기·발송)
export async function buildNewsletter(ids: string[], greeting: string, saturdayKey = upcomingSaturday()) {
  const articles = await selectedArticles(ids);
  const top = articles[0] ? ` — ${toFrenchBrackets(articles[0].title).replace(/\s+/g, ' ').slice(0, 40)}` : '';
  const title = `팩트파인더 주간 · ${weekLabel(saturdayKey)}`;
  const subject = `[팩트파인더 주간] ${weekLabel(saturdayKey)}${top}`;
  const html = buildNewsletterHtml(articles, greeting, { title, campaign: `weekly-${saturdayKey.replace(/-/g, '')}` });
  return { articles, subject, html };
}

// 구독자 목록 + 각자 수신거부 주소
export async function subscribers() {
  const users = await prisma.user.findMany({
    where: { newsletterOptIn: true, ghost: false, NOT: { email: { endsWith: '@legacy.invalid' } } },
    select: { id: true, email: true },
  });
  return users.map((u) => ({ email: u.email, unsubscribeUrl: unsubscribeUrl(u.id) }));
}

export const personalize = (html: string, unsub?: string) => html.split(UNSUBSCRIBE_PLACEHOLDER).join(unsub ?? `${SITE_URL}/profile`);
