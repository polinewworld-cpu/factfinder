import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ROLES } from '@/lib/roles';
import { getCurrentUser } from '@/lib/session';

const HOMEPAGE_PLACEMENTS = ['HOMEPAGE_3', 'HOMEPAGE_5', 'HOMEPAGE_7'];

// 배너 수정 — 편집장 전용 (기능정의서 5)
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });
  if (user.role !== ROLES.CHIEF_EDITOR) {
    return NextResponse.json({ error: '편집장만 배너를 수정할 수 있습니다' }, { status: 403 });
  }

  const existing = await prisma.banner.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { imageUrl, linkUrl, order, active } = await req.json();

  const updated = await prisma.$transaction(async (tx) => {
    if (active === true && HOMEPAGE_PLACEMENTS.includes(existing.placement)) {
      await tx.banner.updateMany({
        where: { placement: existing.placement, active: true, id: { not: existing.id } },
        data: { active: false },
      });
    }
    return tx.banner.update({
      where: { id: params.id },
      data: {
        ...(imageUrl !== undefined ? { imageUrl } : {}),
        ...(linkUrl !== undefined ? { linkUrl } : {}),
        ...(order !== undefined ? { order } : {}),
        ...(active !== undefined ? { active } : {}),
      },
    });
  });
  return NextResponse.json(updated);
}

// 배너 삭제 — 편집장 전용
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });
  if (user.role !== ROLES.CHIEF_EDITOR) {
    return NextResponse.json({ error: '편집장만 배너를 삭제할 수 있습니다' }, { status: 403 });
  }

  await prisma.banner.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
