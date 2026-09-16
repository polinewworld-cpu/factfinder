import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ROLES } from '@/lib/roles';
import { getCurrentUser } from '@/lib/session';

// 사진 해시태그 이름 수정 — 갤러리 모달 안에서 편집장만 (2026-09-11 신설)
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });
  if (user.role !== ROLES.CHIEF_EDITOR) {
    return NextResponse.json({ error: '편집장만 태그를 관리할 수 있습니다' }, { status: 403 });
  }

  const { name } = await req.json();
  const trimmed = (name ?? '').trim();
  if (!trimmed) return NextResponse.json({ error: '태그 이름을 입력하세요' }, { status: 400 });

  const tag = await prisma.photoTag.update({ where: { id: params.id }, data: { name: trimmed } });
  return NextResponse.json(tag);
}

// 사진 해시태그 삭제 — 사진에서도 함께 제거됨(암시적 다대다 관계라 연결 테이블만 정리됨) (2026-09-11 신설)
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });
  if (user.role !== ROLES.CHIEF_EDITOR) {
    return NextResponse.json({ error: '편집장만 태그를 관리할 수 있습니다' }, { status: 403 });
  }

  await prisma.photoTag.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
