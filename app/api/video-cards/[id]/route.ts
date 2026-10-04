import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ROLES } from '@/lib/roles';
import { getCurrentUser } from '@/lib/session';
import { toFrenchBrackets } from '@/lib/frenchBrackets';
import { clampFocal } from '@/lib/cardImage';

// 영상 카드 수정 — 메인노출 빼기/복구, 피처 크롭, 편집장이 제목에 넣은 줄바꿈 (편집장 전용)
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });
  if (user.role !== ROLES.CHIEF_EDITOR) {
    return NextResponse.json({ error: '편집장만 변경할 수 있습니다' }, { status: 403 });
  }

  const body = await req.json();
  const data: {
    showOnMain?: boolean;
    title?: string;
    coverFocalX?: number;
    coverFocalY?: number;
  } = {};
  if (typeof body.showOnMain === 'boolean') data.showOnMain = body.showOnMain;
  if (typeof body.title === 'string') data.title = toFrenchBrackets(body.title);
  if (body.coverFocalX !== undefined) data.coverFocalX = clampFocal(body.coverFocalX);
  if (body.coverFocalY !== undefined) data.coverFocalY = clampFocal(body.coverFocalY);
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: '변경할 값이 필요합니다' }, { status: 400 });
  }

  const updated = await prisma.videoCard.update({
    where: { id: params.id },
    data,
  });
  return NextResponse.json(updated);
}
