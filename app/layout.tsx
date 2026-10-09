import './globals.css';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import SavedArticlesProvider from '@/components/SavedArticlesProvider';
import { getCurrentUser } from '@/lib/session';
import { ROLES } from '@/lib/roles';
import { prisma } from '@/lib/prisma';
import WelcomeSetup from '@/components/WelcomeSetup';
import { AdminNavProvider } from '@/components/AdminNav';
import SiteAnalytics from '@/components/SiteAnalytics';
import AdSenseLoader from '@/components/AdSenseLoader';
import type { Metadata } from 'next';
import {
  SITE_URL, IS_LIVE_DOMAIN, ADSENSE_CLIENT, GOOGLE_SITE_VERIFICATION, NAVER_SITE_VERIFICATION,
} from '@/lib/siteTags';

const SITE_DESCRIPTION = '팩트파인더는 진영주의를 벗어나 중도주의 관점으로 정치와 사회를 봅니다.';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL), // 공유 이미지 등 상대경로를 절대주소로 바꾸는 기준
  title: '팩트파인더',
  description: SITE_DESCRIPTION,
  openGraph: {
    type: 'website',
    siteName: '팩트파인더',
    locale: 'ko_KR',
    title: '팩트파인더',
    description: SITE_DESCRIPTION,
    images: ['/og-default.png'],
  },
  // 구글 서치콘솔·네이버 서치어드바이저 소유권 인증 — 옛 사이트 값 유지 (빠지면 검색 관리 권한이 끊김)
  verification: {
    google: GOOGLE_SITE_VERIFICATION,
    other: { 'naver-site-verification': NAVER_SITE_VERIFICATION },
  },
  alternates: { types: { 'application/rss+xml': '/rss.xml' } },
  // 애드센스 사이트 소유 확인용 — 광고 스크립트를 끈 화면에서도 계정 연결이 유지되도록
  other: { 'google-adsense-account': ADSENSE_CLIENT },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  // 닉네임을 아직 안 정한 신규 가입자는 어느 페이지든 본문 대신 환영(닉네임·사진 설정) 화면을 보여줌
  const needsSetup = user
    ? !(await prisma.user.findUnique({ where: { id: user.id }, select: { nickname: true } }))?.nickname
    : false;
  const adsense = IS_LIVE_DOMAIN
    ? await prisma.siteConfig.findUnique({ where: { id: 'singleton' } }).catch(() => null)
    : null;
  return (
    <html lang="ko">
      <head>
        <link
          rel="preload"
          href="/fonts/ibm-plex-sans/ibm-plex-sans-latin.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
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
          <AdminNavProvider>
            <Header />
            <SavedArticlesProvider loggedIn={!!user} isChiefEditor={user?.role === ROLES.CHIEF_EDITOR}>
              {needsSetup ? (
                <WelcomeSetup defaultImage={user?.image} name={user?.name} userId={user?.id} />
              ) : (
                children
              )}
            </SavedArticlesProvider>
            <Footer />
          </AdminNavProvider>
        </div>
        <SiteAnalytics />
        {/* 구글 애드센스 자동광고 — 광고 위치·밀도는 애드센스 콘솔이 결정, 켜기/끄기·화면 종류는 관리자 광고 관리 → 애드센스 탭 (2026-10-09) */}
        {IS_LIVE_DOMAIN && adsense?.adsenseEnabled !== false && (
          <AdSenseLoader
            client={ADSENSE_CLIENT}
            home={adsense?.adsenseOnHome ?? true}
            article={adsense?.adsenseOnArticle ?? true}
            other={adsense?.adsenseOnOther ?? true}
          />
        )}
        {/* 사이트 정보 구조화 데이터 — 언론사명·로고·사이트 내 검색 (2026-10-08 SEO) */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify([
              {
                '@context': 'https://schema.org',
                '@type': 'NewsMediaOrganization',
                name: '팩트파인더',
                url: SITE_URL,
                logo: new URL('/og-default.png', SITE_URL).toString(),
                email: 'polinewworld@gmail.com',
                telephone: '070-8028-2438',
              },
              {
                '@context': 'https://schema.org',
                '@type': 'WebSite',
                name: '팩트파인더',
                url: SITE_URL,
                potentialAction: {
                  '@type': 'SearchAction',
                  target: `${new URL('/search', SITE_URL)}?q={search_term_string}`,
                  'query-input': 'required name=search_term_string',
                },
              },
            ]),
          }}
        />
      </body>
    </html>
  );
}
