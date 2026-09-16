import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ROLES } from '@/lib/roles';
import { getCurrentUser } from '@/lib/session';

// 영상 카드 '메인노출 빼기' — 정치신세계 탭에는 계속 남기되 인덱스(전체) 피드에서만 사후적으로 제외 (편집장 전용, 2026-09-11 신설)
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });
  if (user.role !== ROLES.CHIEF_EDITOR) {
    return NextResponse.json({ error: '편집장만 변경할 수 있습니다' }, { status: 403 });
  }

  const body = await req.json();
  if (typeof body.showOnMain !== 'boolean') {
    return NextResponse.json({ error: 'showOnMain 값이 필요합니다' }, { status: 400 });
  }

  const updated = await prisma.videoCard.update({
    where: { id: params.id },
    data: { showOnMain: body.showOnMain },
  });

  return NextResponse.json(updated);
}
