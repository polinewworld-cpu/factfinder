import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ROLES } from '@/lib/roles';
import { getCurrentUser } from '@/lib/session';

// 사진 캡션(제목)·해시태그 개별 수정 — 업로더 본인 또는 편집장만 (2026-09-12 신설)
// tagNames를 넘기면 그 사진의 태그를 "완전히 교체"함(기존 태그 전부 해제 후 새 목록으로 재연결) —
// 드래그로 잘못 지정한 태그를 개별 사진에서 뺄 방법이 없던 문제 해결용 (2026-09-12)
// url을 넘기면 사진 파일 자체를 교체함 — 워터마크 제거 편집기(PhotoWatermarkEditor)에서 편집본을 새로 업로드한 뒤
// 같은 Photo 레코드의 url만 바꿔치기하는 용도(2026-09-12 신설). id가 그대로라 캡션·태그는 그대로 유지됨.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });

  const photo = await prisma.photo.findUnique({ where: { id: params.id } });
  if (!photo) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (photo.uploaderId !== user.id && user.role !== ROLES.CHIEF_EDITOR) {
    return NextResponse.json({ error: '수정 권한이 없습니다' }, { status: 403 });
  }

  const { title, tagNames, url } = await req.json();
  const hasTitle = typeof title === 'string';
  const hasTags = Array.isArray(tagNames);
  const hasUrl = typeof url === 'string' && url.trim().length > 0;
  const cleanTagNames: string[] = hasTags
    ? Array.from(new Set(tagNames.map((t: string) => (t ?? '').trim()).filter(Boolean)))
    : [];

  const updated = await prisma.photo.update({
    where: { id: params.id },
    data: {
      ...(hasTitle ? { title: title.trim() || null } : {}),
      ...(hasUrl ? { url: url.trim() } : {}),
      ...(hasTags
        ? {
            tags: {
              set: [], // 기존 연결을 전부 끊고
              connectOrCreate: cleanTagNames.map((name) => ({ where: { name }, create: { name } })), // 새 목록으로 재연결
            },
          }
        : {}),
    },
    include: { tags: true },
  });
  return NextResponse.json(updated);
}

// 사진 삭제 — 업로더 본인 또는 편집장만 (기능정의서 8.1)
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });

  const photo = await prisma.photo.findUnique({ where: { id: params.id } });
  if (!photo) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (photo.uploaderId !== user.id && user.role !== ROLES.CHIEF_EDITOR) {
    return NextResponse.json({ error: '삭제 권한이 없습니다' }, { status: 403 });
  }

  await prisma.photo.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
