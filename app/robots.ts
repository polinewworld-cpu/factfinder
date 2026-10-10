import type { MetadataRoute } from 'next';
import { headers } from 'next/headers';

// 검색엔진 수집 규칙 — 실제 도메인(factfinder.tv)만 허용 (2026-10-10)
// 테스트 주소(factfinder-85w9.onrender.com)는 같은 기사가 있는 복제본이라 수집 금지 — 구글이 원본으로 착각하지 않게.
// 요청한 주소(host)로 판단하므로 도메인 전환 뒤에도 onrender 주소는 계속 막힘. (next.config.js의 X-Robots-Tag와 짝)
export const dynamic = 'force-dynamic';

export default function robots(): MetadataRoute.Robots {
  const host = headers().get('host') ?? '';
  if (!/(^|\.)factfinder\.tv$/.test(host.split(':')[0])) {
    return { rules: [{ userAgent: '*', disallow: '/' }] };
  }
  const base = `https://${host}`;
  return {
    rules: [
      // 기사 사진(/api/blob)은 구글 이미지 검색에 잡히도록 허용 — 나머지 /api는 차단 (2026-10-08)
      { userAgent: '*', allow: ['/', '/api/blob/'], disallow: ['/admin', '/api/'] },
    ],
    sitemap: [`${base}/sitemap.xml`, `${base}/news-sitemap.xml`], // news-sitemap = 구글 뉴스용 최근 2일 기사 (2026-10-08)
  };
}
