import type { MetadataRoute } from 'next';
import { prisma } from '@/lib/prisma';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXTAUTH_URL || 'http://localhost:3411';

  const articles = await prisma.article.findMany({
    where: { status: 'PUBLISHED' },
    select: { id: true, publishedAt: true },
    orderBy: { publishedAt: 'desc' },
    take: 5000, // 사이트맵 단일 파일 상한선 안전마진 (표준 상한 5만)
  });

  return [
    { url: base, changeFrequency: 'hourly', priority: 1 },
    ...articles.map((a) => ({
      url: `${base}/article/${a.id}`,
      lastModified: a.publishedAt ?? undefined,
      changeFrequency: 'never' as const,
      priority: 0.7,
    })),
  ];
}
