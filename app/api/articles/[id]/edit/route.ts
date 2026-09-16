import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ROLES } from '@/lib/roles';
import { getCurrentUser } from '@/lib/session';

// 기사 수정 화면(/write?id=...) 전용 조회 — 기존 GET /api/articles/[id]와 달리 조회수를 올리지 않고,
// 본인 글이 아니어도 편집장이면 볼 수 있음 (2026-09-11 신설, "관리자가 어떤 글이든 수정할 수 있어야" 요청 대응)
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });

  const article = await prisma.article.findUnique({
    where: { id: params.id },
    include: {
      author: { select: { id: true, name: true } },
      category: true,
      images: { orderBy: { order: 'asc' } },
      keywords: true,
      relatedArticles: { select: { id: true, title: true, updatedAt: true, author: { select: { name: true } } } },
      poll: { include: { options: { orderBy: { order: 'asc' } } } },
    },
  });
  if (!article) return NextResponse.json({ error: '기사를 찾을 수 없습니다' }, { status: 404 });

  const isOwner = article.authorId === user.id;
  const isChief = user.role === ROLES.CHIEF_EDITOR;
  if (!isOwner && !isChief) {
    return NextResponse.json({ error: '본인이 작성했거나 편집장인 경우에만 수정할 수 있습니다' }, { status: 403 });
  }

  return NextResponse.json(article);
}
