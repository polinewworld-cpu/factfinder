import { prisma } from '@/lib/prisma';
import Masonry from '@/components/Masonry';
import Pagination from '@/components/Pagination';
import { CARD_ARTICLE_SELECT, toCardArticle } from '@/lib/publicFields';

// 한 페이지 60건 — 예전엔 키워드 기사 전부를 본문째 한 번에 내보내 기사가 쌓일수록 느려졌음 (2026-10-09)
const PAGE_SIZE = 60;

export default async function KeywordPage({ params, searchParams }: { params: { name: string }; searchParams: { page?: string } }) {
  const name = decodeURIComponent(params.name);
  const page = Math.max(1, Math.floor(Number(searchParams.page)) || 1);
  const where = { status: 'PUBLISHED' as const, keywords: { some: { name } } };
  const [rows, total] = await Promise.all([
    prisma.article.findMany({
      where,
      select: CARD_ARTICLE_SELECT,
      orderBy: { publishedAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.article.count({ where }),
  ]);
  const articles = rows.map(toCardArticle);

  return (
    <>
      <div className="content" style={{ paddingBottom: 0 }}>
        <h1 style={{ fontFamily: 'var(--title)', fontSize: 20, fontWeight: 700, margin: '4px 0 20px' }}>
          <span className="keyword-badge" style={{ fontSize: 14, verticalAlign: 'middle', marginRight: 8 }}>
            {name}
          </span>
          키워드 기사 모음 ({total})
        </h1>
      </div>
      <Masonry top={null} articles={articles as any} />
      {total === 0 && (
        <div className="content">
          <div className="empty-state">
            <p>해당 키워드의 기사가 없습니다.</p>
          </div>
        </div>
      )}
      <Pagination page={page} totalPages={Math.max(1, Math.ceil(total / PAGE_SIZE))} basePath={`/keyword/${encodeURIComponent(name)}`} />
    </>
  );
}
