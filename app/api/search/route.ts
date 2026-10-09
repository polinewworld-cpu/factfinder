import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { CARD_ARTICLE_SELECT } from '@/lib/publicFields';

// 독자 검색 — 제목/본문/기자이름을 모두 대상으로 함 (발행된 기사만)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get('q') ?? '').trim();
  if (!q) return NextResponse.json([]);

  const articles = await prisma.article.findMany({
    where: {
      status: 'PUBLISHED',
      OR: [
        { title: { contains: q, mode: 'insensitive' } },
        { content: { contains: q, mode: 'insensitive' } },
        { author: { name: { contains: q, mode: 'insensitive' } } },
      ],
    },
    select: { ...CARD_ARTICLE_SELECT, content: false }, // 공개 필드만 (2026-10-09)
    orderBy: { publishedAt: 'desc' },
    take: 40,
  });

  return NextResponse.json(articles);
}
