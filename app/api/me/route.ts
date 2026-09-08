import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/session';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });
  const full = await prisma.user.findUnique({ where: { id: user.id } });
  return NextResponse.json(full ?? user);
}

// 회원 본인이 닉네임/프로필사진을 직접 설정 (등급 변경은 편집장 전용 /api/users/[id]에서만 가능)
export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });

  const { nickname, image } = await req.json();
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      ...(nickname !== undefined ? { nickname: nickname?.trim() || null } : {}),
      ...(image !== undefined ? { image: image || null } : {}),
    },
  });
  return NextResponse.json(updated);
}
