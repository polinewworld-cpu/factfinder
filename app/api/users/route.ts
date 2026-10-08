import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ROLES } from '@/lib/roles';
import { getCurrentUser } from '@/lib/session';

// 회원관리는 편집장 전용
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });
  if (user.role !== ROLES.CHIEF_EDITOR) {
    return NextResponse.json({ error: '편집장만 회원목록을 볼 수 있습니다' }, { status: 403 });
  }

  // 유령 계정(삭제한 옛 기자)은 회원·기자관리 목록에서 숨김 (2026-10-08)
  const users = await prisma.user.findMany({ where: { ghost: false }, orderBy: { createdAt: 'desc' } });
  return NextResponse.json(users);
}
