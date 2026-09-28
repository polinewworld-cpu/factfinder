'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import HeaderSearch from './HeaderSearch';

const CATEGORIES = ['전체', '정치', '국제', '사회', '문화', '정치신세계'];

// 공개 사이트 상단 카테고리 탭 — 관리자 화면(/admin/*)과 작성 화면에서는 숨김
export default function CategoryNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  if (pathname?.startsWith('/admin') || pathname === '/write') return null;

  const currentCategory = pathname === '/' ? searchParams.get('category') ?? '전체' : null;

  return (
    <div className="category-bar">
      <div className="chips" role="tablist" aria-label="기사 분류">
        {CATEGORIES.map((c) => {
          const active = currentCategory === c;
          return (
            <a
              key={c}
              role="tab"
              aria-selected={active}
              className={`chip${active ? ' is-active' : ''}`}
              href={c === '전체' ? '/' : `/?category=${encodeURIComponent(c)}`}
            >
              {c}
            </a>
          );
        })}
      </div>
      <div className="search-wrap">
        <HeaderSearch />
      </div>
    </div>
  );
}
