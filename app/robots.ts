import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXTAUTH_URL || 'http://localhost:3411';
  return {
    rules: [
      { userAgent: '*', allow: '/', disallow: ['/admin', '/api/'] },
    ],
    sitemap: [`${base}/sitemap.xml`, `${base}/news-sitemap.xml`], // news-sitemap = 구글 뉴스용 최근 2일 기사 (2026-10-08)
  };
}
