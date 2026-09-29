import { getCurrentUser } from '@/lib/session';
import { ROLES, WRITER_ROLES } from '@/lib/roles';
import { LogoMark } from './icons';
import AccountMenu from './AccountMenu';
import BackstageAccount from './BackstageAccount';
import MarketTicker from './MarketTicker';
import CategoryNav from './CategoryNav';

export default async function Header() {
  const user = await getCurrentUser();
  const account = user
    ? {
        name: user.name ?? '내 정보',
        image: user.image,
        userId: user.id,
        isWriter: WRITER_ROLES.includes(user.role as any),
        isChiefEditor: user.role === ROLES.CHIEF_EDITOR,
      }
    : null;

  return (
    <>
      <header className="site-header">
        <a className="brand" href="/" aria-label="팩트파인더 홈">
          <LogoMark />
        </a>

        <nav className="header-actions" aria-label="주요 메뉴">
          <MarketTicker />
          {account && (
            <BackstageAccount>
              <AccountMenu
                name={account.name}
                image={account.image}
                userId={account.userId}
                isWriter={account.isWriter}
                isChiefEditor={account.isChiefEditor}
              />
            </BackstageAccount>
          )}
        </nav>
      </header>

      <CategoryNav account={account} />
    </>
  );
}
