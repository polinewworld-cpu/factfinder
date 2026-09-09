import { prisma } from '@/lib/prisma';
import Masonry from '@/components/Masonry';
import type { ArticleStatus } from '@prisma/client';

export default async function Home({ searchParams }: { searchParams: { category?: string } }) {
  const category = searchParams.category;

  const where = {
    status: 'PUBLISHED' as ArticleStatus,
    ...(category ? { category: { name: category } } : {}),
  };

  const [top, restRaw] = await Promise.all([
    prisma.article.findFirst({
      where: { ...where, isFrontpageTop: true },
      include: { author: true, keywords: true, category: true },
    }),
    prisma.article.findMany({
      where,
      include: { author: true, keywords: true, category: true },
      orderBy: { publishedAt: 'desc' },
      take: 61,
    }),
  ]);
  const rest = restRaw.filter((a) => a.id !== top?.id).slice(0, 60);

  return <Masonry top={top as any} articles={rest as any} />;
}
