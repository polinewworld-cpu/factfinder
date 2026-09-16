import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ROLES, WRITER_ROLES } from '@/lib/roles';
import { getCurrentUser } from '@/lib/session';

// 갤러리 픽커 모달의 해시태그 필터 바용 — 전체 태그 목록 (기능정의서 8.1)
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });
  if (!(WRITER_ROLES as readonly string[]).includes(user.role)) {
    return NextResponse.json({ error: '기자 이상만 볼 수 있습니다' }, { status: 403 });
  }

  const tags = await prisma.photoTag.findMany({ orderBy: { name: 'asc' } });
  return NextResponse.json(tags);
}

// 태그를 사진 없이 미리 생성 — 갤러리 모달 안에서 편집장만 (2026-09-11 신설)
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });
  if (user.role !== ROLES.CHIEF_EDITOR) {
    return NextResponse.json({ error: '편집장만 태그를 관리할 수 있습니다' }, { status: 403 });
  }

  const { name } = await req.json();
  const trimmed = (name ?? '').trim();
  if (!trimmed) return NextResponse.json({ error: '태그 이름을 입력하세요' }, { status: 400 });

  const tag = await prisma.photoTag.upsert({
    where: { name: trimmed },
    update: {},
    create: { name: trimmed },
  });
  return NextResponse.json(tag, { status: 201 });
}
