import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ROLES } from '@/lib/roles';
import { getCurrentUser } from '@/lib/session';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });
  if (user.role !== ROLES.CHIEF_EDITOR) {
    return NextResponse.json({ error: '편집장만 볼 수 있습니다' }, { status: 403 });
  }

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

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
    prisma.donation.count({ where: { status: 'ACTIVE' } }),
    prisma.donation.count({ where: { startedAt: { gte: todayStart } } }),
    prisma.user.count({ where: { reporterApplicationStatus: 'PENDING' } }),
    prisma.user.count({ where: { role: 'REPORTER' } }),
    prisma.donation.aggregate({ _sum: { amount: true }, where: { startedAt: { gte: todayStart } } }),
    prisma.donation.aggregate({ _sum: { amount: true }, where: { status: 'ACTIVE' } }),
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
  });
}
