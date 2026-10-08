import { prisma } from '@/lib/prisma';
import { SITE_URL } from '@/lib/siteTags';

// 구글 뉴스 사이트맵 — 최근 2일(48시간) 발행 기사만, 구글 규격(news:news) (2026-10-08 SEO)
export const revalidate = 600;

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

export async function GET() {
  const since = new Date(Date.now() - 48 * 3600_000);
  const articles = await prisma.article.findMany({
    where: { status: 'PUBLISHED', publishedAt: { gte: since } },
    orderBy: { publishedAt: 'desc' },
    take: 1000,
    select: { id: true, title: true, publishedAt: true },
  });
  const urls = articles
    .map(
      (a) =>
        `<url><loc>${new URL(`/article/${a.id}`, SITE_URL)}</loc><news:news><news:publication><news:name>팩트파인더</news:name><news:language>ko</news:language></news:publication><news:publication_date>${a.publishedAt!.toISOString()}</news:publication_date><news:title>${esc(a.title)}</news:title></news:news></url>`,
    )
    .join('\n');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
${urls}
</urlset>`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
}
