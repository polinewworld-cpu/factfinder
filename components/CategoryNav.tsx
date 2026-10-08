'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import AccountMenu from './AccountMenu';
import HeaderSearch from './HeaderSearch';

// 정치신세계 탭은 2026-10-08 사장님 지시로 제거 — 라이브 방송 카드는 '전체' 피드에만 섞여 나옴
const CATEGORIES = ['전체', '정치', '국제', '사회', '문화'];

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
  const donateActive = pathname === '/donate';

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
      {/* 저장한 기사는 우측 계정 메뉴에 있으므로 이 자리는 후원하기로 — 로그인 여부와 무관하게 노출 (2026-10-08) */}
      <a className={`chip category-aux${donateActive ? ' is-active' : ''}`} href="/donate">
        후원하기
      </a>
      {!account && (
        <a className="chip category-aux" href="/api/auth/signin">
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
