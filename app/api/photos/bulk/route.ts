import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ROLES, WRITER_ROLES } from '@/lib/roles';
import { getCurrentUser } from '@/lib/session';

// 사진 여러 장 한 번에 캡션(제목) 일괄 수정 / 해시태그 일괄 추가 — 갤러리 모달에서 다중선택 후 일괄 적용,
// 또는 사진을 해시태그 위로 드래그했을 때 사용 (2026-09-12 신설, 갤러리 기능 개편)
// 편집장이 아니면 본인이 올린 사진만 대상에 포함됨(그 외 id는 조용히 제외 — 부분 성공을 허용).
export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });
  if (!(WRITER_ROLES as readonly string[]).includes(user.role)) {
    return NextResponse.json({ error: '기자 이상만 사진을 수정할 수 있습니다' }, { status: 403 });
  }

  const { photoIds, title, addTagNames } = await req.json();
  if (!Array.isArray(photoIds) || photoIds.length === 0) {
    return NextResponse.json({ error: 'photoIds가 필요합니다' }, { status: 400 });
  }

  const targets = await prisma.photo.findMany({
    where: {
      id: { in: photoIds },
      ...(user.role !== ROLES.CHIEF_EDITOR ? { uploaderId: user.id } : {}),
    },
    select: { id: true },
  });
  if (targets.length === 0) return NextResponse.json({ updated: 0 });

  const hasTitle = typeof title === 'string';
  const tagNames: string[] = Array.isArray(addTagNames)
    ? addTagNames.map((t: string) => (t ?? '').trim()).filter(Boolean)
    : [];

  const updated = await prisma.$transaction(
    targets.map((t) =>
      prisma.photo.update({
        where: { id: t.id },
        data: {
          ...(hasTitle ? { title: title.trim() || null } : {}),
          ...(tagNames.length > 0
            ? { tags: { connectOrCreate: tagNames.map((name) => ({ where: { name }, create: { name } })) } }
            : {}),
        },
      })
    )
  );

  return NextResponse.json({ updated: updated.length });
}
