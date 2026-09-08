import { prisma } from '@/lib/prisma';
import ArticleCard from '@/components/ArticleCard';

export default async function KeywordPage({ params }: { params: { name: string } }) {
  const name = decodeURIComponent(params.name);
  const articles = await prisma.article.findMany({
    where: { status: 'PUBLISHED', keywords: { some: { name } } },
    include: { author: true, keywords: true, category: true },
    orderBy: { publishedAt: 'desc' },
  });

  return (
    <main className="max-w-6xl mx-auto px-4 py-6">
      <h1 className="text-xl font-bold mb-4 text-gray-900">
        <span className="keyword-badge text-sm align-middle mr-2">{name}</span>
        키워드 기사 모음 ({articles.length})
      </h1>
      <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-4">
        {articles.map((a) => (
          <ArticleCard key={a.id} article={a as any} />
        ))}
      </div>
      {articles.length === 0 && <p className="text-gray-400 text-sm py-20 text-center">해당 키워드의 기사가 없습니다.</p>}
    </main>
  );
}
