import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ROLES } from '@/lib/roles';
import { getCurrentUser } from '@/lib/session';

// 편집장 전용 — 기자 신청 승인대기 목록 (기능정의서 3.2.1)
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });
  if (user.role !== ROLES.CHIEF_EDITOR) {
    return NextResponse.json({ error: '편집장만 볼 수 있습니다' }, { status: 403 });
  }

  const applicants = await prisma.user.findMany({
    where: { reporterApplicationStatus: 'PENDING' },
    include: { snsLinks: { orderBy: { order: 'asc' } } },
    orderBy: { createdAt: 'asc' },
  });
  return NextResponse.json(applicants);
}
