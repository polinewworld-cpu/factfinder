import './globals.css';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import SavedArticlesProvider from '@/components/SavedArticlesProvider';
import { getCurrentUser } from '@/lib/session';
import { ROLES } from '@/lib/roles';
import { prisma } from '@/lib/prisma';
import WelcomeSetup from '@/components/WelcomeSetup';

export const metadata = {
  title: '팩트파인더',
  description: '팩트파인더는 진영주의를 벗어나 중도주의 관점으로 정치와 사회를 봅니다.',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  // 닉네임을 아직 안 정한 신규 가입자는 어느 페이지든 본문 대신 환영(닉네임·사진 설정) 화면을 보여줌
  const needsSetup = user
    ? !(await prisma.user.findUnique({ where: { id: user.id }, select: { nickname: true } }))?.nickname
    : false;
  return (
    <html lang="ko">
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Gowun+Batang:wght@700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen">
        <div className="page">
          <Header />
          <SavedArticlesProvider loggedIn={!!user} isChiefEditor={user?.role === ROLES.CHIEF_EDITOR}>
            {needsSetup ? <WelcomeSetup defaultImage={user?.image} /> : children}
          </SavedArticlesProvider>
          <Footer />
        </div>
      </body>
    </html>
  );
}
