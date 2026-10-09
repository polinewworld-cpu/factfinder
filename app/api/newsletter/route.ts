import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ROLES } from '@/lib/roles';
import { getCurrentUser } from '@/lib/session';
import { buildNewsletter } from '@/lib/newsletter';
import { isEmailConfigured } from '@/lib/resend';
import { authorName } from '@/lib/byline';

// 뉴스레터 관리 (2026-10-09) — GET: 고를 수 있는 최근 기사 + 기본 선택(이번 주 월요일부터) + 구독자 수
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
  const [articles, subscriberCount, lastSend] = await Promise.all([
    prisma.article.findMany({
      where: { status: 'PUBLISHED', publishedAt: { gte: new Date(Date.now() - 30 * 86400_000) } },
      orderBy: { publishedAt: 'desc' },
      take: 200,
      select: { id: true, title: true, publishedAt: true, category: { select: { name: true } }, author: { select: { name: true, nickname: true } } },
    }),
    prisma.user.count({ where: { newsletterOptIn: true } }),
    prisma.newsletterSend.findFirst({ orderBy: { sentAt: 'desc' } }),
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
    subscriberCount,
    emailConfigured: isEmailConfigured(),
    lastSentAt: lastSend?.sentAt ?? null,
  });
}

export async function POST(req: NextRequest) {
  const denied = await chiefOnly();
  if (denied) return denied;
  const { ids, greeting } = await req.json().catch(() => ({}));
  const { subject, html, articles } = await buildNewsletter(Array.isArray(ids) ? ids.map(String) : [], String(greeting ?? ''));
  return NextResponse.json({ subject, html, articleCount: articles.length });
}
