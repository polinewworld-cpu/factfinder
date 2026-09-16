import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { WRITER_ROLES } from '@/lib/roles';
import { getCurrentUser } from '@/lib/session';

// 관련기사 선택용 — 별도 레이어(RelatedArticlePickerModal)에서 검색+페이지네이션으로 발행된 기사를 탐색 (기능정의서 8.2)
// 기존 /api/search 는 독자용 공개 검색이라 페이지네이션이 없고 이 용도로 그대로 쓰기 어려워 전용 엔드포인트로 분리함.
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !WRITER_ROLES.includes(user.role as any)) {
    return NextResponse.json({ error: '기사 작성 권한이 없습니다' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get('q') ?? '').trim();
  const page = Math.max(1, Number(searchParams.get('page') ?? '1') || 1);
  const pageSize = Math.min(50, Math.max(1, Number(searchParams.get('pageSize') ?? '10') || 10));
  const excludeIds = (searchParams.get('excludeIds') ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const where = {
    status: 'PUBLISHED' as const,
    ...(excludeIds.length ? { NOT: { id: { in: excludeIds } } } : {}),
    ...(q
      ? {
          OR: [
            { title: { contains: q } },
            { author: { name: { contains: q } } },
          ],
        }
      : {}),
  };

  const [articles, total] = await Promise.all([
    prisma.article.findMany({
      where,
      select: { id: true, title: true, updatedAt: true, author: { select: { name: true } } },
      orderBy: { updatedAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.article.count({ where }),
  ]);

  return NextResponse.json({ articles, total, page, pageSize });
}
