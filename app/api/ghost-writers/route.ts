import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ROLES } from '@/lib/roles';
import { getCurrentUser } from '@/lib/session';
import { GHOST_WHERE, createGhostWriter } from '@/lib/ghostWriter';

// 유령기자 목록·등록 (2026-10-09) — 편집장 전용. 글쓰기 화면의 "유령기자" 선택과 관리자 [유령기자] 탭이 씀.
async function chief() {
  const user = await getCurrentUser();
  return user?.role === ROLES.CHIEF_EDITOR ? user : null;
}

export async function GET() {
  if (!(await chief())) return NextResponse.json({ error: '편집장만 볼 수 있습니다' }, { status: 403 });
  const list = await prisma.user.findMany({
    where: GHOST_WHERE,
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      nickname: true,
      writerTitle: true,
      image: true,
      bankAccount: true,
      _count: { select: { articles: true, idImages: true } },
    },
  });
  return NextResponse.json(
    list.map(({ bankAccount, _count, ...u }) => ({
      ...u,
      displayName: u.nickname || u.name,
      articleCount: _count.articles,
      idImageCount: _count.idImages,
      hasBank: !!bankAccount,
    })),
  );
}

export async function POST(req: NextRequest) {
  if (!(await chief())) return NextResponse.json({ error: '편집장만 등록할 수 있습니다' }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  try {
    const u = await createGhostWriter(String(b.name ?? ''), b.writerTitle, b.image);
    return NextResponse.json({ id: u.id, displayName: u.nickname || u.name, writerTitle: u.writerTitle, image: u.image }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : '등록 실패' }, { status: 400 });
  }
}
