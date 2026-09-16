import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ROLES } from '@/lib/roles';
import { getCurrentUser } from '@/lib/session';

// 편집장이 기자 신청을 승인 -> role을 REPORTER로 전환 (기능정의서 3.2.1)
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });
  if (user.role !== ROLES.CHIEF_EDITOR) {
    return NextResponse.json({ error: '편집장만 승인할 수 있습니다' }, { status: 403 });
  }

  const target = await prisma.user.findUnique({ where: { id: params.id } });
  if (!target) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (target.reporterApplicationStatus !== 'PENDING') {
    return NextResponse.json({ error: '승인대기 상태의 신청이 아닙니다' }, { status: 400 });
  }

  const updated = await prisma.user.update({
    where: { id: params.id },
    data: { role: 'REPORTER', reporterApplicationStatus: null },
  });
  return NextResponse.json(updated);
}
