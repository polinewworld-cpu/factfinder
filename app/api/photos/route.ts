import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { WRITER_ROLES } from '@/lib/roles';
import { getCurrentUser } from '@/lib/session';

// 보도사진 라이브러리 — 관리자/기자만 조회·업로드 가능 (기능정의서 8.1)
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });
  if (!(WRITER_ROLES as readonly string[]).includes(user.role)) {
    return NextResponse.json({ error: '기자 이상만 사진 라이브러리를 볼 수 있습니다' }, { status: 403 });
  }

  const q = req.nextUrl.searchParams.get('q')?.trim();
  const tag = req.nextUrl.searchParams.get('tag')?.trim();

  const photos = await prisma.photo.findMany({
    where: {
      // 검색창(q)은 파일명뿐 아니라 캡션(title)·해시태그 이름까지 포함해서 매칭 (2026-09-12 확장 — 파일명만 검색되던 문제 수정)
      ...(q
        ? {
            OR: [
              { filename: { contains: q, mode: 'insensitive' } },
              { title: { contains: q, mode: 'insensitive' } },
              { tags: { some: { name: { contains: q, mode: 'insensitive' } } } },
            ],
          }
        : {}),
      ...(tag ? { tags: { some: { name: tag } } } : {}),
    },
    include: { tags: true },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
  return NextResponse.json(photos);
}

// 사진 등록 — 파일 자체는 /api/upload로 먼저 올린 뒤, 받은 url을 여기 등록 (기능정의서 8.1)
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });
  if (!(WRITER_ROLES as readonly string[]).includes(user.role)) {
    return NextResponse.json({ error: '기자 이상만 사진을 등록할 수 있습니다' }, { status: 403 });
  }

  const { url, filename, title, tags } = await req.json();
  if (!url) return NextResponse.json({ error: 'url이 필요합니다' }, { status: 400 });

  const tagNames: string[] = Array.isArray(tags)
    ? tags.map((t: string) => t.trim()).filter(Boolean)
    : [];

  const photo = await prisma.photo.create({
    data: {
      url,
      filename: filename || null,
      title: title || null,
      uploaderId: user.id,
      tags: {
        connectOrCreate: tagNames.map((name) => ({ where: { name }, create: { name } })),
      },
    },
    include: { tags: true },
  });
  return NextResponse.json(photo, { status: 201 });
}
