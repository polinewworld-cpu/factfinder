'use client';

import { usePathname, useSearchParams } from 'next/navigation';

const CATEGORIES = ['전체', '정치', '국제', '사회', '문화', '정치신세계'];

// 공개 사이트 상단 카테고리 탭 — 관리자 화면(/admin/*)에서는 사용자 화면과 혼동되지 않도록 숨김 (2026-09-11 사용자 지시)
export default function CategoryNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  if (pathname?.startsWith('/admin')) return null;

  // 카테고리는 쿼리스트링(?category=)으로 구분되고 전부 '/'로 오므로, pathname만으론 현재 탭을 알 수 없었음
  // — 그래서 지금까지 활성 탭 표시가 아예 안 되던 문제 (2026-09-22)
  const currentCategory = pathname === '/' ? searchParams.get('category') ?? '전체' : null;

  return (
    <div className="content" style={{ paddingBottom: 0 }}>
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
    </div>
  );
}
