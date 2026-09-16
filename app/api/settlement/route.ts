import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ROLES } from '@/lib/roles';
import { getCurrentUser } from '@/lib/session';

// 기간별 후원 정산 집계 — 기자별로 묶어서 합계 표시 (기능정의서 7.1)
// 리포터가 지정되지 않은 후원("사이트 전체 후원")은 별도 묶음으로 표시.
// 이미 정산 완료 처리된 건은 대상에서 제외 — 다시 선택할 수 없음.
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });
  if (user.role !== ROLES.CHIEF_EDITOR) {
    return NextResponse.json({ error: '편집장만 정산할 수 있습니다' }, { status: 403 });
  }

  const start = req.nextUrl.searchParams.get('start');
  const end = req.nextUrl.searchParams.get('end');
  if (!start || !end) {
    return NextResponse.json({ error: '시작일, 종료일이 필요합니다' }, { status: 400 });
  }
  const startDate = new Date(start);
  const endDate = new Date(end);
  endDate.setHours(23, 59, 59, 999);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return NextResponse.json({ error: '날짜 형식이 올바르지 않습니다' }, { status: 400 });
  }

  const donations = await prisma.donation.findMany({
    where: { settled: false, startedAt: { gte: startDate, lte: endDate } },
    include: { reporter: true },
    orderBy: { startedAt: 'asc' },
  });

  const groups = new Map<
    string,
    { reporterId: string | null; reporterName: string; totalAmount: number; count: number; donationIds: string[] }
  >();
  for (const d of donations) {
    const key = d.reporterId ?? '__none__';
    if (!groups.has(key)) {
      groups.set(key, {
        reporterId: d.reporterId,
        reporterName: d.reporter ? d.reporter.nickname ?? d.reporter.name : '미지정 (사이트 전체 후원)',
        totalAmount: 0,
        count: 0,
        donationIds: [],
      });
    }
    const g = groups.get(key)!;
    g.totalAmount += d.amount;
    g.count += 1;
    g.donationIds.push(d.id);
  }

  return NextResponse.json(Array.from(groups.values()));
}
