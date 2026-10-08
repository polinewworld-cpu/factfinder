import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ROLES } from '@/lib/roles';
import { getCurrentUser } from '@/lib/session';

// 기자별 정산내역 — 기간 안의 결제 완료 후원을 기자별로 묶어 합계·정산완료·미정산 금액 표시 (기능정의서 7.1)
// 기자가 지정되지 않은 후원("사이트 전체 후원")은 별도 묶음. 정산 완료 처리 대상은 미정산 건(unsettledIds)만.
// 2026-10-08: 관리자 "후원내역" 화면의 두 번째 탭으로 이동, 정산완료 건도 함께 집계, 날짜는 한국시간 기준.
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });
  if (user.role !== ROLES.CHIEF_EDITOR) {
    return NextResponse.json({ error: '편집장만 정산할 수 있습니다' }, { status: 403 });
  }

  const start = req.nextUrl.searchParams.get('start');
  const end = req.nextUrl.searchParams.get('end');
  const isDay = (d: string | null) => !!d && /^\d{4}-\d{2}-\d{2}$/.test(d);
  if (!isDay(start) || !isDay(end)) {
    return NextResponse.json({ error: '시작일, 종료일을 선택해주세요' }, { status: 400 });
  }
  const startDate = new Date(`${start}T00:00:00+09:00`);
  const endDate = new Date(`${end}T23:59:59.999+09:00`);

  const donations = await prisma.donation.findMany({
    where: { status: 'ACTIVE', startedAt: { gte: startDate, lte: endDate } }, // 결제 완료 건만 (2026-10-08)
    include: { reporter: true },
    orderBy: { startedAt: 'asc' },
  });

  type Group = {
    reporterId: string | null;
    reporterName: string;
    count: number;
    totalAmount: number;
    settledAmount: number;
    unsettledAmount: number;
    unsettledIds: string[];
  };
  const groups = new Map<string, Group>();
  for (const d of donations) {
    const key = d.reporterId ?? '__none__';
    if (!groups.has(key)) {
      groups.set(key, {
        reporterId: d.reporterId,
        reporterName: d.reporter ? d.reporter.nickname ?? d.reporter.name : '미지정 (사이트 전체 후원)',
        count: 0,
        totalAmount: 0,
        settledAmount: 0,
        unsettledAmount: 0,
        unsettledIds: [],
      });
    }
    const g = groups.get(key)!;
    g.count += 1;
    g.totalAmount += d.amount;
    if (d.settled) g.settledAmount += d.amount;
    else {
      g.unsettledAmount += d.amount;
      g.unsettledIds.push(d.id);
    }
  }

  return NextResponse.json(Array.from(groups.values()).sort((a, b) => b.totalAmount - a.totalAmount));
}
