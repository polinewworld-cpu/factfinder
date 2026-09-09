import { prisma } from '@/lib/prisma';
import Masonry from '@/components/Masonry';

export default async function SearchPage({ searchParams }: { searchParams: { q?: string } }) {
  const q = (searchParams.q ?? '').trim();

  const articles = q
    ? await prisma.article.findMany({
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
        take: 60,
      })
    : [];

  return (
    <>
      <div className="content" style={{ paddingBottom: 0 }}>
        <h1 style={{ fontFamily: 'var(--title)', fontSize: 20, fontWeight: 700, margin: '4px 0 20px' }}>
          {q ? (
            <>
              &quot;<span style={{ color: 'var(--accent)' }}>{q}</span>&quot; 검색결과 ({articles.length})
            </>
          ) : (
            '검색어를 입력해주세요'
          )}
        </h1>
      </div>
      <Masonry top={null} articles={articles as any} />
      {q && articles.length === 0 && (
        <div className="content">
          <div className="empty-state">
            <p>검색 결과가 없습니다.</p>
          </div>
        </div>
      )}
    </>
  );
}
