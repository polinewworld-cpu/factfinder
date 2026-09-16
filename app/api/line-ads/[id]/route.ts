import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ROLES } from '@/lib/roles';
import { getCurrentUser } from '@/lib/session';

// 줄광고 수정(문안/링크/순서/노출여부) — 편집장 전용 (2026-09-12 신설)
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });
  if (user.role !== ROLES.CHIEF_EDITOR) {
    return NextResponse.json({ error: '편집장만 줄광고를 수정할 수 있습니다' }, { status: 403 });
  }

  const existing = await prisma.lineAd.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { text, linkUrl, order, active } = await req.json();
  const updated = await prisma.lineAd.update({
    where: { id: params.id },
    data: {
      ...(typeof text === 'string' ? { text: text.trim() } : {}),
      ...(typeof linkUrl === 'string' ? { linkUrl: linkUrl.trim() } : {}),
      ...(order !== undefined ? { order } : {}),
      ...(active !== undefined ? { active } : {}),
    },
  });
  return NextResponse.json(updated);
}

// 줄광고 삭제 — 편집장 전용
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });
  if (user.role !== ROLES.CHIEF_EDITOR) {
    return NextResponse.json({ error: '편집장만 줄광고를 삭제할 수 있습니다' }, { status: 403 });
  }

  await prisma.lineAd.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
