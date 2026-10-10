import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ROLES } from '@/lib/roles';
import { getCurrentUser } from '@/lib/session';
import { WRITER_KINDS, createNonMemberWriter, kindWhere } from '@/lib/ghostWriter';
import type { WriterKind } from '@prisma/client';

// 로그인 없는 필자 목록·등록 (2026-10-09, 10-10) — 편집장 전용. ?kind=NONMEMBER(기본)|RETURNING|GHOST.
// 글쓰기 화면 [비회원 기자] 고르기 창과 관리자 비회원 기자·유령기자 탭이 씀. 새로 등록은 비회원 기자만.
async function chief() {
  const user = await getCurrentUser();
  return user?.role === ROLES.CHIEF_EDITOR ? user : null;
}

export async function GET(req: NextRequest) {
  if (!(await chief())) return NextResponse.json({ error: '편집장만 볼 수 있습니다' }, { status: 403 });
  const q = req.nextUrl.searchParams.get('kind') as WriterKind | null;
  const kind: WriterKind = q && WRITER_KINDS.includes(q) ? q : 'NONMEMBER';
  const list = await prisma.user.findMany({
    where: kindWhere(kind),
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      nickname: true,
      writerTitle: true,
      writerMemo: true,
      image: true,
      bankAccount: true,
      _count: { select: { articles: true } },
    },
  });
  return NextResponse.json(
    list.map(({ bankAccount, _count, ...u }) => ({
      ...u,
      displayName: u.nickname || u.name,
      articleCount: _count.articles,
      hasBank: !!bankAccount,
    })),
  );
}

export async function POST(req: NextRequest) {
  if (!(await chief())) return NextResponse.json({ error: '편집장만 등록할 수 있습니다' }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  try {
    const u = await createNonMemberWriter(String(b.name ?? ''), b.writerTitle, b.image, b.writerMemo);
    return NextResponse.json({ id: u.id, displayName: u.nickname || u.name, writerTitle: u.writerTitle, writerMemo: u.writerMemo, image: u.image, articleCount: 0 }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : '등록 실패' }, { status: 400 });
  }
}
