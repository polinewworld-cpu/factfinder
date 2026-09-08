import { prisma } from '@/lib/prisma';
import ArticleCard from '@/components/ArticleCard';
import type { ArticleStatus } from '@prisma/client';

export default async function Home({ searchParams }: { searchParams: { category?: string } }) {
  const category = searchParams.category;

  const where = {
    status: 'PUBLISHED' as ArticleStatus,
    ...(category ? { category: { name: category } } : {}),
  };

  const top = await prisma.article.findFirst({
    where: { ...where, isFrontpageTop: true },
    include: { author: true, keywords: true, category: true },
  });

  const rest = await prisma.article.findMany({
    where: { ...where, NOT: top ? { id: top.id } : undefined },
    include: { author: true, keywords: true, category: true },
    orderBy: { publishedAt: 'desc' },
    take: 40,
  });

  return (
    <main className="max-w-6xl mx-auto px-4 py-6">
      {top && (
        <div className="mb-6">
          <ArticleCard article={top as any} big />
        </div>
      )}
      {rest.length === 0 && !top && (
        <p className="text-gray-400 text-sm py-20 text-center">아직 발행된 기사가 없습니다.</p>
      )}
      <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-4">
        {rest.map((a) => (
          <ArticleCard key={a.id} article={a as any} />
        ))}
      </div>
    </main>
  );
}
