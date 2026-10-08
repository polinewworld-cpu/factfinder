import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXTAUTH_URL || 'http://localhost:3411';
  return {
    rules: [
      // 기사 사진(/api/blob)은 구글 이미지 검색에 잡히도록 허용 — 나머지 /api는 차단 (2026-10-08)
      { userAgent: '*', allow: ['/', '/api/blob/'], disallow: ['/admin', '/api/'] },
    ],
    sitemap: [`${base}/sitemap.xml`, `${base}/news-sitemap.xml`], // news-sitemap = 구글 뉴스용 최근 2일 기사 (2026-10-08)
  };
}
