import { prisma } from '@/lib/prisma';
import Masonry from '@/components/Masonry';

export default async function KeywordPage({ params }: { params: { name: string } }) {
  const name = decodeURIComponent(params.name);
  const articles = await prisma.article.findMany({
    where: { status: 'PUBLISHED', keywords: { some: { name } } },
    include: { author: true, keywords: true, category: true },
    orderBy: { publishedAt: 'desc' },
  });

  return (
    <>
      <div className="content" style={{ paddingBottom: 0 }}>
        <h1 style={{ fontFamily: 'var(--title)', fontSize: 22, fontWeight: 700, margin: '4px 0 20px' }}>
          <span className="keyword-badge" style={{ fontSize: 14, verticalAlign: 'middle', marginRight: 8 }}>
            {name}
          </span>
          키워드 기사 모음 ({articles.length})
        </h1>
      </div>
      <Masonry top={null} articles={articles as any} />
      {articles.length === 0 && (
        <div className="content">
          <div className="empty-state">
            <p>해당 키워드의 기사가 없습니다.</p>
          </div>
        </div>
      )}
    </>
  );
}
