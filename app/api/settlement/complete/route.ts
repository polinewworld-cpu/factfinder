import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ROLES } from '@/lib/roles';
import { getCurrentUser } from '@/lib/session';

// 정산 완료 처리 — 대상 후원 건들을 비활성화(settled)해서 이후 다시 선택되지 않도록 함 (기능정의서 7.1)
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });
  if (user.role !== ROLES.CHIEF_EDITOR) {
    return NextResponse.json({ error: '편집장만 정산 완료 처리를 할 수 있습니다' }, { status: 403 });
  }

  const { donationIds } = await req.json();
  if (!Array.isArray(donationIds) || donationIds.length === 0) {
    return NextResponse.json({ error: 'donationIds가 필요합니다' }, { status: 400 });
  }

  const result = await prisma.donation.updateMany({
    where: { id: { in: donationIds }, settled: false },
    data: { settled: true, settledAt: new Date() },
  });

  return NextResponse.json({ updated: result.count });
}
