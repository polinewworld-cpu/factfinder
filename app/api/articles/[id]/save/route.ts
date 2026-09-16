import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/session';

// 기사 저장(북마크) — 모든 회원(독자 포함) 사용 가능 (기능정의서 3.1: "댓글 작성과 기사 저장")
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });

  const article = await prisma.article.findUnique({ where: { id: params.id } });
  if (!article) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await prisma.savedArticle.upsert({
    where: { userId_articleId: { userId: user.id, articleId: params.id } },
    update: {},
    create: { userId: user.id, articleId: params.id },
  });

  return NextResponse.json({ saved: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });

  await prisma.savedArticle.deleteMany({ where: { userId: user.id, articleId: params.id } });
  return NextResponse.json({ saved: false });
}
