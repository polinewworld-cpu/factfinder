import { prisma } from '@/lib/prisma';
import { stripHtml } from '@/lib/stripHtml';
import { SITE_URL } from '@/lib/siteTags';

// RSS 2.0 피드 — 최신 발행 기사 50건 (2026-10-08 신설). 옛 주소(/company/rss.php, /rss_view.php)는 next.config.js에서 여기로 이동.
export const revalidate = 600; // 10분 캐시

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
const cdata = (s: string) => `<![CDATA[${s.replace(/]]>/g, ']]]]><![CDATA[>')}]]>`;

export async function GET() {
  const articles = await prisma.article.findMany({
    where: { status: 'PUBLISHED' },
    orderBy: { publishedAt: 'desc' },
    take: 50,
    select: {
      id: true, title: true, subtitle1: true, excerpt: true, content: true, coverImageUrl: true,
      publishedAt: true, createdAt: true,
      author: { select: { nickname: true, name: true } },
      category: { select: { name: true } },
    },
  });

  const abs = (url: string) => new URL(url, SITE_URL).toString();
  const items = articles
    .map((a) => {
      const link = abs(`/article/${a.id}`);
      const description = (a.subtitle1 || a.excerpt || stripHtml(a.content)).trim().slice(0, 300);
      return [
        '<item>',
        `<title>${esc(a.title)}</title>`,
        `<link>${link}</link>`,
        `<guid isPermaLink="true">${link}</guid>`,
        `<description>${cdata(description)}</description>`,
        `<content:encoded>${cdata(a.content)}</content:encoded>`,
        `<dc:creator>${esc(a.author.nickname || a.author.name)}</dc:creator>`,
        a.category ? `<category>${esc(a.category.name)}</category>` : '',
        a.coverImageUrl ? `<enclosure url="${esc(abs(a.coverImageUrl))}" type="image/jpeg" length="0" />` : '',
        `<pubDate>${(a.publishedAt ?? a.createdAt).toUTCString()}</pubDate>`,
        '</item>',
      ].join('');
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
<title>팩트파인더</title>
<link>${abs('/')}</link>
<atom:link href="${abs('/rss.xml')}" rel="self" type="application/rss+xml" />
<description>팩트파인더는 진영주의를 벗어나 중도주의 관점으로 정치와 사회를 봅니다.</description>
<language>ko</language>
<lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${items}
</channel>
</rss>`;

  return new Response(xml, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } });
}
