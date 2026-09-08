import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ROLES } from '@/lib/roles';
import { getCurrentUser } from '@/lib/session';

// 편집장이 특정 회원의 등급을 변경 (예: 독자 -> 기자)
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });
  if (user.role !== ROLES.CHIEF_EDITOR) {
    return NextResponse.json({ error: '편집장만 회원 등급을 변경할 수 있습니다' }, { status: 403 });
  }

  const { role } = await req.json();
  if (!Object.values(ROLES).includes(role)) {
    return NextResponse.json({ error: '유효하지 않은 등급입니다' }, { status: 400 });
  }

  const updated = await prisma.user.update({ where: { id: params.id }, data: { role } });
  return NextResponse.json(updated);
}
