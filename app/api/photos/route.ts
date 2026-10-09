import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ROLES, WRITER_ROLES } from '@/lib/roles';
import { getCurrentUser } from '@/lib/session';
import { PHOTO_INCLUDE, searchFromParams, searchPhotos } from '@/lib/photoBank';
import { autoCredit, checkPhotoInput } from '@/lib/photoBankRules';

// 사진 뱅크 (기능정의서 8.1 보도사진 라이브러리 → 2026-10-09 사진 뱅크 v0.1로 확장) — 기자·논설위원·편집장
async function writer() {
  const user = await getCurrentUser();
  if (!user) return { error: NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 }) };
  if (!(WRITER_ROLES as readonly string[]).includes(user.role)) {
    return { error: NextResponse.json({ error: '기자 이상만 사진 뱅크를 쓸 수 있습니다' }, { status: 403 }) };
  }
  return { user };
}

// 통합 검색 — q(인물·별칭·캡션·크레디트·촬영자), sources, tag, people+peopleMode, from/to(촬영일), usage, sort
export async function GET(req: NextRequest) {
  const { error } = await writer();
  if (error) return error;
  return NextResponse.json(await searchPhotos(searchFromParams(req.nextUrl.searchParams)));
}

const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);

// 사진 등록 — 파일은 /api/upload(또는 /api/photos/from-url)로 먼저 올린 뒤 받은 url을 여기 등록
export async function POST(req: NextRequest) {
  const { user, error } = await writer();
  if (error) return error;

  const b = await req.json();
  if (!b.url) return NextResponse.json({ error: 'url이 필요합니다' }, { status: 400 });
  const credit = str(b.credit) ?? autoCredit(b.sourceType, b.photographer, b.license);
  const bad = checkPhotoInput({ ...b, credit });
  if (bad) return NextResponse.json({ error: bad }, { status: 400 });

  // 상황 태그는 편집장만 새로 만들 수 있음 — 기자는 있는 태그만 붙임
  let tagNames: string[] = Array.isArray(b.tags) ? b.tags.map((t: string) => String(t).trim()).filter(Boolean) : [];
  if (user!.role !== ROLES.CHIEF_EDITOR && tagNames.length) {
    const existing = await prisma.photoTag.findMany({ where: { name: { in: tagNames } }, select: { name: true } });
    tagNames = existing.map((t) => t.name);
  }
  const peopleIds: string[] = Array.isArray(b.peopleIds) ? b.peopleIds.map(String) : [];

  // 같은 이미지(내용 해시)가 이미 있으면 막음 — URL 등록·외부 가져오기는 해시를 같이 보냄
  const hash = str(b.hash);
  if (hash && (await prisma.photo.findUnique({ where: { hash }, select: { id: true } }))) {
    return NextResponse.json({ error: '이미 사진 뱅크에 있는 사진입니다' }, { status: 400 });
  }

  const photo = await prisma.photo.create({
    data: {
      url: b.url,
      filename: str(b.filename),
      title: str(b.title),
      uploaderId: user!.id,
      sourceType: b.sourceType,
      license: str(b.license),
      sourceUrl: str(b.sourceUrl),
      viaArticleUrl: str(b.viaArticleUrl),
      takenAt: str(b.takenAt) ? new Date(`${b.takenAt}T12:00:00+09:00`) : null,
      photographer: str(b.photographer),
      credit: credit || null,
      hash,
      tags: { connectOrCreate: tagNames.map((name) => ({ where: { name }, create: { name } })) },
      people: { connect: peopleIds.map((id) => ({ id })) },
    },
    include: PHOTO_INCLUDE,
  });
  return NextResponse.json(photo, { status: 201 });
}
