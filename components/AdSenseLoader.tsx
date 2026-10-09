'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

// 구글 애드센스 자동광고 스크립트 (2026-10-09) — 관리자 "광고 관리 → 애드센스" 설정에 따라 화면 종류별로 넣는다.
// 자동광고는 한 번 들어오면 같은 창에서 계속 동작하므로, "처음 들어온 화면"이 허용된 종류일 때만 넣는다.
// 관리자·글쓰기 화면에는 넣지 않음.
export default function AdSenseLoader({ client, home, article, other }: { client: string; home: boolean; article: boolean; other: boolean }) {
  const pathname = usePathname() ?? '/';

  useEffect(() => {
    if (document.getElementById('adsense-auto')) return;
    if (pathname.startsWith('/admin') || pathname.startsWith('/write')) return;
    const kind = pathname === '/' ? 'home' : pathname.startsWith('/article/') ? 'article' : 'other';
    if (!{ home, article, other }[kind]) return;
    const s = document.createElement('script');
    s.id = 'adsense-auto';
    s.async = true;
    s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${client}`;
    s.crossOrigin = 'anonymous';
    document.head.appendChild(s);
  }, [pathname, client, home, article, other]);

  return null;
}
