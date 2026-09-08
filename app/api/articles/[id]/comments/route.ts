import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/session';

// 댓글은 로그인 회원만 작성 가능 (구글 로그인 계정 단일화 방침)
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const comments = await prisma.comment.findMany({
    where: { articleId: params.id },
    include: { user: { select: { id: true, name: true, nickname: true, image: true, isDonor: true } } },
    orderBy: { createdAt: 'asc' },
  });
  return NextResponse.json(comments);
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });

  const { content } = await req.json();
  if (!content?.trim()) return NextResponse.json({ error: '댓글 내용을 입력해주세요' }, { status: 400 });

  const article = await prisma.article.findUnique({ where: { id: params.id } });
  if (!article || article.status !== 'PUBLISHED') {
    return NextResponse.json({ error: '존재하지 않는 기사입니다' }, { status: 404 });
  }

  const comment = await prisma.comment.create({
    data: { articleId: params.id, userId: user.id, content: content.trim() },
    include: { user: { select: { id: true, name: true, nickname: true, image: true, isDonor: true } } },
  });
  return NextResponse.json(comment, { status: 201 });
}
