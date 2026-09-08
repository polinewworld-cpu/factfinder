import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ROLES } from '@/lib/roles';
import { getCurrentUser } from '@/lib/session';

// 편집장이 기자의 승인대기(DRAFT) 기사를 발행 승인
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });
  if (user.role !== ROLES.CHIEF_EDITOR) {
    return NextResponse.json({ error: '편집장만 승인할 수 있습니다' }, { status: 403 });
  }

  const article = await prisma.article.findUnique({ where: { id: params.id } });
  if (!article) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (article.status !== 'DRAFT') {
    return NextResponse.json({ error: '승인대기 상태의 기사가 아닙니다' }, { status: 400 });
  }

  const approved = await prisma.article.update({
    where: { id: params.id },
    data: { status: 'PUBLISHED', publishedAt: new Date() },
  });

  return NextResponse.json(approved);
}
