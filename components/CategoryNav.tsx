'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import AccountMenu from './AccountMenu';
import HeaderSearch from './HeaderSearch';

// 정치신세계 탭은 2026-10-08 사장님 지시로 제거 — 라이브 방송 카드는 '전체' 피드에만 섞여 나옴
// '후원하기'도 기사 카테고리(옛 사이트와 동일, 후원 안내 기사 모음) — 2026-10-08
const CATEGORIES = ['전체', '정치', '국제', '사회', '문화', '후원하기'];

export type CategoryAccount = {
  name: string;
  image?: string | null;
  userId?: string;
  isWriter: boolean;
  isChiefEditor: boolean;
} | null;

// 공개 사이트 상단 카테고리 탭 — 관리자 화면(/admin/*)과 작성 화면에서는 숨김
export default function CategoryNav({ account = null }: { account?: CategoryAccount }) {
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
      {!account && (
        <a className="chip category-aux" href="/login">
          로그인
        </a>
      )}
      <div className="search-wrap">
        <HeaderSearch />
      </div>
      {account && (
        <div className="category-account">
          <AccountMenu
            name={account.name}
            image={account.image}
            userId={account.userId}
            isWriter={account.isWriter}
            isChiefEditor={account.isChiefEditor}
          />
        </div>
      )}
    </div>
  );
}
