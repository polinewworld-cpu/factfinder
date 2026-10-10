import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ROLES } from '@/lib/roles';
import { getCurrentUser } from '@/lib/session';
import { buildNewsletter, subscribers, upcomingSaturday, weeklyPicks, weekLabel } from '@/lib/newsletter';
import { gmailStatus } from '@/lib/gmail';
import { authorName } from '@/lib/byline';

// 뉴스레터 관리 (2026-10-09, 10-10 자동 발송) — GET: 고를 수 있는 최근 기사 + 기본 선택 + 구독자 수 + 지메일 연결·토요일 자동 발송 상태·발송 이력
// POST: 고른 기사·인사말로 만든 메일 미리보기
async function chiefOnly() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });
  if (user.role !== ROLES.CHIEF_EDITOR) return NextResponse.json({ error: '편집장만 볼 수 있습니다' }, { status: 403 });
  return null;
}

// 한국시간 이번 주 월요일 0시
function kstMonday() {
  const kst = new Date(Date.now() + 9 * 3600_000);
  const day = kst.getUTCDay();
  kst.setUTCDate(kst.getUTCDate() - (day === 0 ? 6 : day - 1));
  kst.setUTCHours(0, 0, 0, 0);
  return new Date(kst.getTime() - 9 * 3600_000);
}

export async function GET() {
  const denied = await chiefOnly();
  if (denied) return denied;

  const monday = kstMonday();
  const week = upcomingSaturday();
  const [articles, subscriberList, history, config, gmail, autoIds] = await Promise.all([
    prisma.article.findMany({
      where: { status: 'PUBLISHED', publishedAt: { gte: new Date(Date.now() - 30 * 86400_000) } },
      orderBy: { publishedAt: 'desc' },
      take: 200,
      select: { id: true, title: true, publishedAt: true, category: { select: { name: true } }, author: { select: { name: true, nickname: true } } },
    }),
    subscribers(),
    prisma.newsletterSend.findMany({ orderBy: { sentAt: 'desc' }, take: 12 }),
    prisma.siteConfig.findUnique({ where: { id: 'singleton' }, select: { newsletterAuto: true, newsletterSkipWeek: true } }),
    gmailStatus(),
    weeklyPicks(week),
  ]);

  return NextResponse.json({
    articles: articles.map((a) => ({
      id: a.id,
      title: a.title,
      publishedAt: a.publishedAt,
      category: a.category?.name ?? null,
      author: authorName(a.author),
    })),
    defaultIds: articles.filter((a) => a.publishedAt && a.publishedAt >= monday).map((a) => a.id),
    subscriberCount: subscriberList.length,
    emailConfigured: gmail.connected,
    lastSentAt: history.find((h) => h.status === 'SENT')?.sentAt ?? null,
    // 토요일 자동 발송 (2026-10-10)
    gmail,
    auto: {
      enabled: config?.newsletterAuto !== false,
      week,
      weekLabel: weekLabel(week),
      skipped: config?.newsletterSkipWeek === week,
      alreadySent: history.some((h) => h.weekKey === week),
      ids: autoIds,
    },
    history: history.map((h) => ({ id: h.id, sentAt: h.sentAt, status: h.status, auto: h.auto, recipientCount: h.recipientCount, failedCount: h.failedCount, subject: h.subject, note: h.note })),
  });
}

export async function POST(req: NextRequest) {
  const denied = await chiefOnly();
  if (denied) return denied;
  const { ids, greeting } = await req.json().catch(() => ({}));
  const { subject, html, articles } = await buildNewsletter(Array.isArray(ids) ? ids.map(String) : [], String(greeting ?? ''));
  return NextResponse.json({ subject, html, articleCount: articles.length });
}
