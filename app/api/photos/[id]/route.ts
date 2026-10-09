import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ROLES, WRITER_ROLES } from '@/lib/roles';
import { getCurrentUser } from '@/lib/session';
import { PHOTO_INCLUDE } from '@/lib/photoBank';
import { checkPhotoInput } from '@/lib/photoBankRules';

// 사진 상세 — 전체 정보 + 사용된 기사 목록 (사진 뱅크, 2026-10-09)
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user || !(WRITER_ROLES as readonly string[]).includes(user.role)) {
    return NextResponse.json({ error: '기자 이상만 볼 수 있습니다' }, { status: 403 });
  }
  const photo = await prisma.photo.findUnique({
    where: { id: params.id },
    include: {
      ...PHOTO_INCLUDE,
      usages: {
        orderBy: { firstUsedAt: 'desc' },
        include: { article: { select: { id: true, title: true, status: true, publishedAt: true } } },
      },
    },
  });
  if (!photo) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(photo);
}

const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);

// 사진 정보 수정 — 업로더 본인 또는 편집장 (2026-09-12 신설, 2026-10-09 사진 뱅크 항목 추가)
// tagNames(상황 태그)·peopleIds(인물)는 넘기면 "완전히 교체". url은 워터마크 지우기 편집본으로 파일만 교체할 때.
// 출처 정보(sourceType 등)를 보낼 때는 출처 유형 필수·통신사 차단 검사.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });

  const photo = await prisma.photo.findUnique({ where: { id: params.id } });
  if (!photo) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (photo.uploaderId !== user.id && user.role !== ROLES.CHIEF_EDITOR) {
    return NextResponse.json({ error: '수정 권한이 없습니다' }, { status: 403 });
  }

  const b = await req.json();
  const has = (k: string) => Object.prototype.hasOwnProperty.call(b, k);
  if (has('sourceType')) {
    const bad = checkPhotoInput({ ...b, title: has('title') ? b.title : photo.title });
    if (bad) return NextResponse.json({ error: bad }, { status: 400 });
  } else if (has('title') || has('credit')) {
    const bad = checkPhotoInput({ sourceType: photo.sourceType ?? 'OWN', credit: has('credit') ? b.credit : photo.credit, title: has('title') ? b.title : photo.title });
    if (bad) return NextResponse.json({ error: bad }, { status: 400 });
  }

  let cleanTagNames: string[] = Array.isArray(b.tagNames)
    ? Array.from(new Set(b.tagNames.map((t: string) => (t ?? '').trim()).filter(Boolean)))
    : [];
  // 상황 태그는 편집장만 새로 만들 수 있음 — 기자는 있는 태그만 붙임
  if (user.role !== ROLES.CHIEF_EDITOR && cleanTagNames.length) {
    const existing = await prisma.photoTag.findMany({ where: { name: { in: cleanTagNames } }, select: { name: true } });
    cleanTagNames = existing.map((t) => t.name);
  }

  const updated = await prisma.photo.update({
    where: { id: params.id },
    data: {
      ...(has('title') ? { title: str(b.title) } : {}),
      ...(typeof b.url === 'string' && b.url.trim() ? { url: b.url.trim() } : {}),
      ...(has('sourceType') ? { sourceType: b.sourceType } : {}),
      ...(has('license') ? { license: str(b.license) } : {}),
      ...(has('sourceUrl') ? { sourceUrl: str(b.sourceUrl) } : {}),
      ...(has('viaArticleUrl') ? { viaArticleUrl: str(b.viaArticleUrl) } : {}),
      ...(has('takenAt') ? { takenAt: str(b.takenAt) ? new Date(`${b.takenAt}T12:00:00+09:00`) : null } : {}),
      ...(has('photographer') ? { photographer: str(b.photographer) } : {}),
      ...(has('credit') ? { credit: str(b.credit) } : {}),
      ...(Array.isArray(b.tagNames)
        ? { tags: { set: [], connectOrCreate: cleanTagNames.map((name) => ({ where: { name }, create: { name } })) } }
        : {}),
      ...(Array.isArray(b.peopleIds) ? { people: { set: b.peopleIds.map((id: string) => ({ id: String(id) })) } } : {}),
    },
    include: PHOTO_INCLUDE,
  });
  return NextResponse.json(updated);
}

// 사진 삭제 — 편집장 전용 (사진 뱅크 v0.1 권한 — 2026-10-09 변경, 전에는 업로더 본인도 가능)
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });
  if (user.role !== ROLES.CHIEF_EDITOR) return NextResponse.json({ error: '사진 삭제는 편집장만 할 수 있습니다' }, { status: 403 });

  const photo = await prisma.photo.findUnique({ where: { id: params.id } });
  if (!photo) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  await prisma.photo.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
