import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXTAUTH_URL || 'http://localhost:3411';
  return {
    rules: [
      { userAgent: '*', allow: '/', disallow: ['/admin', '/api/'] },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
