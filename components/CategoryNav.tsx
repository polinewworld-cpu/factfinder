'use client';

import { usePathname } from 'next/navigation';

const CATEGORIES = ['전체', '정치', '국제', '사회', '문화', '정치신세계'];

// 공개 사이트 상단 카테고리 탭 — 관리자 화면(/admin/*)에서는 사용자 화면과 혼동되지 않도록 숨김 (2026-09-11 사용자 지시)
export default function CategoryNav() {
  const pathname = usePathname();
  if (pathname?.startsWith('/admin')) return null;

  return (
    <div className="content" style={{ paddingBottom: 0 }}>
      <div className="chips" role="tablist" aria-label="기사 분류">
        {CATEGORIES.map((c) => (
          <a
            key={c}
            role="tab"
            className="chip"
            href={c === '전체' ? '/' : `/?category=${encodeURIComponent(c)}`}
          >
            {c}
          </a>
        ))}
      </div>
    </div>
  );
}
