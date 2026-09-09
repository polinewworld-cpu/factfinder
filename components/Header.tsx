import { getCurrentUser } from '@/lib/session';
import { ROLES, WRITER_ROLES } from '@/lib/roles';
import { BellIcon, LogoMark, SearchIcon } from './icons';

const CATEGORIES = ['전체', '정치', '국제', '사회', '문화'];

export default async function Header() {
  const user = await getCurrentUser();

  return (
    <>
      <header className="site-header">
        <a className="brand" href="/" aria-label="팩트파인더 홈">
          <LogoMark />
          <span className="brand-name">팩트파인더</span>
        </a>

        <form className="search" action="/search" role="search">
          <SearchIcon />
          <input name="q" placeholder="기사, 인물, 이슈 검색" aria-label="기사 검색" />
        </form>

        <nav className="header-actions" aria-label="주요 메뉴">
          <a className="text-link" href="/">
            전체기사
          </a>
          <button className="icon-button" type="button" aria-label="알림">
            <BellIcon />
          </button>
          <a className="cta" href="/donate">
            후원하기
          </a>
          {user ? (
            <>
              {WRITER_ROLES.includes(user.role as any) && (
                <a className="text-link" href="/write">
                  글쓰기
                </a>
              )}
              {user.role === ROLES.CHIEF_EDITOR && (
                <a className="text-link" href="/admin">
                  관리자
                </a>
              )}
              <a className="text-link" href="/profile">
                {user.name ?? '내 정보'}
              </a>
              <a className="icon-button" href="/api/auth/signout" aria-label="로그아웃" title="로그아웃">
                <span aria-hidden="true" style={{ fontSize: 13, fontWeight: 700 }}>
                  ⏻
                </span>
              </a>
            </>
          ) : (
            <a className="cta" href="/api/auth/signin">
              로그인
            </a>
          )}
        </nav>
      </header>

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
    </>
  );
}
