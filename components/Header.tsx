import { getCurrentUser } from '@/lib/session';
import { ROLES, WRITER_ROLES } from '@/lib/roles';
import { LogoMark, SearchIcon } from './icons';
import AccountMenu from './AccountMenu';
import MarketTicker from './MarketTicker';
import CategoryNav from './CategoryNav';

export default async function Header() {
  const user = await getCurrentUser();

  return (
    <>
      <header className="site-header">
        <a className="brand" href="/" aria-label="팩트파인더 홈">
          <LogoMark />
        </a>

        <form className="search" action="/search" role="search">
          <SearchIcon />
          <input name="q" placeholder="기사, 인물, 이슈 검색" aria-label="기사 검색" />
        </form>

        <nav className="header-actions" aria-label="주요 메뉴">
          <MarketTicker />
          {user ? (
            <AccountMenu
              name={user.name ?? '내 정보'}
              image={user.image}
              isWriter={WRITER_ROLES.includes(user.role as any)}
              isChiefEditor={user.role === ROLES.CHIEF_EDITOR}
            />
          ) : (
            <a className="cta" href="/api/auth/signin">
              로그인
            </a>
          )}
        </nav>
      </header>

      <CategoryNav />
    </>
  );
}
