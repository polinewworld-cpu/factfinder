import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ROLES } from '@/lib/roles';
import { getCurrentUser } from '@/lib/session';

export const dynamic = 'force-dynamic';

// 관리자 "전체 기사" 목록 (2026-09-11 신설) — 상태 무관 전체 기사를 검색+정렬+페이지네이션으로 조회.
// 편집장이 어떤 기사든 찾아서 /write?id=... 로 들어가 수정할 수 있게 하는 용도.
const DB_SORTABLE = new Set(['title', 'status', 'viewCount', 'createdAt', 'updatedAt', 'publishedAt']);

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== ROLES.CHIEF_EDITOR) {
    return NextResponse.json({ error: '편집장만 접근할 수 있습니다' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get('q') ?? '').trim();
  const status = searchParams.get('status'); // ALL(기본) | PUBLISHED | DRAFT | AUTOSAVE
  const categoryId = searchParams.get('categoryId');
  const sortByParam = searchParams.get('sortBy') ?? 'updatedAt';
  const sortBy = DB_SORTABLE.has(sortByParam) || sortByParam === 'commentCount' ? sortByParam : 'updatedAt';
  const sortDir: 'asc' | 'desc' = searchParams.get('sortDir') === 'asc' ? 'asc' : 'desc';
  const page = Math.max(1, Number(searchParams.get('page') ?? '1') || 1);
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get('pageSize') ?? '20') || 20));

  const where: any = {};
  if (status && status !== 'ALL') where.status = status;
  if (categoryId) where.categoryId = categoryId;
  if (q) {
    where.OR = [{ title: { contains: q } }, { author: { name: { contains: q } } }];
  }

  const selectShape = {
    id: true,
    title: true,
    status: true,
    viewCount: true,
    showOnMain: true,
    createdAt: true,
    updatedAt: true,
    publishedAt: true,
    author: { select: { id: true, name: true } },
    category: { select: { id: true, name: true } },
    _count: { select: { comments: true } },
  } as const;

  let rawRows;
  let total;

  if (sortBy === 'commentCount') {
    // 댓글수는 관계 카운트라 DB에서 바로 orderBy 할 수 없어 — 조건에 맞는 것 전부 가져와 메모리에서 정렬 후 페이지 자름
    // (이 사이트 규모에서는 무리 없음 — 수만 건 단위로 커지면 별도 집계 테이블 고려)
    [rawRows, total] = await Promise.all([
      prisma.article.findMany({ where, select: selectShape, take: 5000 }),
      prisma.article.count({ where }),
    ]);
  } else {
    [rawRows, total] = await Promise.all([
      prisma.article.findMany({
        where,
        select: selectShape,
        orderBy: { [sortBy]: sortDir },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.article.count({ where }),
    ]);
  }

  let rows = rawRows.map((a) => ({
    id: a.id,
    title: a.title,
    status: a.status,
    viewCount: a.viewCount,
    showOnMain: a.showOnMain,
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
    publishedAt: a.publishedAt,
    author: a.author,
    category: a.category,
    commentCount: a._count.comments,
  }));

  if (sortBy === 'commentCount') {
    rows.sort((a, b) => (sortDir === 'asc' ? a.commentCount - b.commentCount : b.commentCount - a.commentCount));
    const start = (page - 1) * pageSize;
    rows = rows.slice(start, start + pageSize);
  }

  return NextResponse.json({ articles: rows, total, page, pageSize });
}
