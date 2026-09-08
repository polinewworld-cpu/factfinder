import { prisma } from '@/lib/prisma';
import ArticleCard from '@/components/ArticleCard';

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
        take: 40,
      })
    : [];

  return (
    <main className="max-w-6xl mx-auto px-4 py-6">
      <h1 className="text-lg font-bold mb-4 text-gray-900">
        {q ? (
          <>
            &quot;<span className="text-brand">{q}</span>&quot; 검색결과 ({articles.length})
          </>
        ) : (
          '검색어를 입력해주세요'
        )}
      </h1>
      <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-4">
        {articles.map((a) => (
          <ArticleCard key={a.id} article={a as any} />
        ))}
      </div>
      {q && articles.length === 0 && (
        <p className="text-gray-400 text-sm py-20 text-center">검색 결과가 없습니다.</p>
      )}
    </main>
  );
}
