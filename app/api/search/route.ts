import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// 독자 검색 — 제목/본문/기자이름을 모두 대상으로 함 (발행된 기사만)
// 데모는 SQLite라 대소문자 구분 검색(contains)만 사용. 운영 Postgres에서는 mode:'insensitive' 추가 권장.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get('q') ?? '').trim();
  if (!q) return NextResponse.json([]);

  const articles = await prisma.article.findMany({
    where: {
      status: 'PUBLISHED',
      OR: [
        { title: { contains: q } },
        { content: { contains: q } },
        { author: { name: { contains: q } } },
      ],
    },
    include: { author: true, category: true, keywords: true },
    orderBy: { publishedAt: 'desc' },
    take: 40,
  });

  return NextResponse.json(articles);
}
