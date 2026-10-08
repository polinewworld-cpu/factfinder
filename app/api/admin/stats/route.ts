import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ROLES } from '@/lib/roles';
import { getCurrentUser } from '@/lib/session';

// 후원 집계는 실제 이니시스 결제가 확인된 건(거래번호 tid 있음)만 — 결제 없이 생긴 옛 시험 기록 제외 (2026-10-08)
const PAID = { status: 'ACTIVE' as const, tid: { not: null } };

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });
  if (user.role !== ROLES.CHIEF_EDITOR) {
    return NextResponse.json({ error: '편집장만 볼 수 있습니다' }, { status: 403 });
  }

  // '오늘' = 한국시간 자정부터 (서버는 UTC로 돌아서 그냥 setHours(0)이면 오전 9시 기준이 됨, 2026-10-08 수정)
  const kstNow = new Date(Date.now() + 9 * 3600_000);
  const todayStart = new Date(Date.UTC(kstNow.getUTCFullYear(), kstNow.getUTCMonth(), kstNow.getUTCDate()) - 9 * 3600_000);

  // 대시보드 카드 안 목록 (2026-10-08 신설) — 최근 발행 7, 승인 대기 기사, 최근 회원 12, 최근 기자 12, 최근 후원 8
  const [recentArticles, pendingArticles, recentMembers, recentReporters, recentDonations] = await Promise.all([
    prisma.article.findMany({
      where: { status: 'PUBLISHED' },
      orderBy: { publishedAt: 'desc' },
      take: 7,
      select: { id: true, title: true, publishedAt: true, author: { select: { name: true } } },
    }),
    prisma.article.findMany({
      where: { status: 'DRAFT' },
      orderBy: { updatedAt: 'desc' },
      take: 12,
      select: { id: true, title: true, updatedAt: true, author: { select: { name: true } } },
    }),
    prisma.user.findMany({
      where: { NOT: { email: { endsWith: '@legacy.invalid' } } },
      orderBy: { createdAt: 'desc' },
      take: 12,
      select: { id: true, name: true, nickname: true, image: true, createdAt: true },
    }),
    prisma.user.findMany({
      where: { role: { in: ['REPORTER', 'COLUMNIST'] } },
      orderBy: { createdAt: 'desc' },
      take: 12,
      select: { id: true, name: true, nickname: true, image: true, createdAt: true, email: true },
    }),
    prisma.donation.findMany({
      where: PAID,
      orderBy: { startedAt: 'desc' },
      take: 8,
      select: { id: true, donorName: true, amount: true, startedAt: true, reporter: { select: { name: true } } },
    }),
  ]);

  const [
    publishedToday,
    totalMembers,
    newMembersToday,
    pendingCount,
    totalArticles,
    activeDonors,
    newDonorsToday,
    pendingReporterCount,
    currentReporterCount,
    donationAmountTodayAgg,
    donationAmountMonthAgg,
  ] = await Promise.all([
    prisma.article.count({ where: { status: 'PUBLISHED', publishedAt: { gte: todayStart } } }),
    prisma.user.count(),
    prisma.user.count({ where: { createdAt: { gte: todayStart } } }),
    prisma.article.count({ where: { status: 'DRAFT' } }),
    prisma.article.count({ where: { status: 'PUBLISHED' } }),
    prisma.donation.count({ where: PAID }),
    prisma.donation.count({ where: { ...PAID, startedAt: { gte: todayStart } } }),
    prisma.user.count({ where: { reporterApplicationStatus: 'PENDING' } }),
    prisma.user.count({ where: { role: 'REPORTER' } }),
    prisma.donation.aggregate({ _sum: { amount: true }, where: { ...PAID, startedAt: { gte: todayStart } } }),
    prisma.donation.aggregate({ _sum: { amount: true }, where: PAID }), // 누적 총액
  ]);

  return NextResponse.json({
    publishedToday,
    totalMembers,
    newMembersToday,
    pendingCount,
    totalArticles,
    activeDonors,
    newDonorsToday,
    pendingReporterCount,
    currentReporterCount,
    donationAmountToday: donationAmountTodayAgg._sum.amount ?? 0,
    donationAmountMonth: donationAmountMonthAgg._sum.amount ?? 0,
    recentArticles,
    pendingArticles,
    recentMembers,
    recentReporters: recentReporters.map(({ email, ...r }) => ({ ...r, legacy: email.endsWith('@legacy.invalid') })),
    recentDonations,
  });
}
