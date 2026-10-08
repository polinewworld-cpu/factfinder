import { prisma } from '@/lib/prisma';
import Masonry from '@/components/Masonry';
import VideoCardGrid from '@/components/VideoCardGrid';
import { getCurrentUser } from '@/lib/session';
import { ROLES } from '@/lib/roles';
import { ensureVideoCardsFresh } from '@/lib/youtube';
import { Prisma, type ArticleStatus } from '@prisma/client';
import type { Metadata } from 'next';
import { SITE_URL } from '@/lib/siteTags';
import Pagination from '@/components/Pagination';
import { permanentRedirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

const SITE_TITLE = '팩트파인더';
const SITE_DESC = '팩트파인더는 진영주의를 벗어나 중도주의 관점으로 정치와 사회를 봅니다.';

// 홈·카테고리·페이지마다 다른 제목과 대표 주소 — 전부 "팩트파인더"로 같던 것 개선 (2026-10-08 SEO)
export async function generateMetadata({ searchParams }: { searchParams: { category?: string; page?: string } }): Promise<Metadata> {
  const category = searchParams.category;
  const page = Math.max(1, Math.floor(Number(searchParams.page)) || 1);
  const params = new URLSearchParams();
  if (category) params.set('category', category);
  if (page > 1) params.set('page', String(page));
  // 상대주소로 주면 Next가 ?category= 부분을 떼어 홈 주소가 돼 버려서 전체 주소로 지정
  const canonical = new URL(params.toString() ? `/?${params}` : '/', SITE_URL).toString();
  const pageSuffix = page > 1 ? ` ${page}페이지` : '';
  const title = category ? `${category} 뉴스${pageSuffix} - ${SITE_TITLE}` : page > 1 ? `최신 뉴스${pageSuffix} - ${SITE_TITLE}` : `${SITE_TITLE} - 중도의 시선으로 보는 정치·사회 뉴스`;
  const description = category ? `팩트파인더 ${category} 기사 모음. ${SITE_DESC}` : SITE_DESC;
  // metadataBase: null — Next 14는 경로가 '/'인 주소에서 ?category= 를 떼어 버림(resolve-url.js). 이 페이지는 전부 절대주소로 직접 지정
  return {
    metadataBase: null,
    title,
    description,
    alternates: { canonical },
    openGraph: {
      type: 'website',
      siteName: SITE_TITLE,
      locale: 'ko_KR',
      title,
      description,
      url: canonical,
      images: [new URL('/og-default.png', SITE_URL).toString()],
    },
  };
}

// 목록 한 페이지 크기 — 하단 페이지 번호로 넘김 (2026-10-08, 옛 기사 3천여 건 이관 대비)
const PAGE_SIZE = 60;

// 옛 사이트 메뉴 코드(list.php?mcode=…) → 새 카테고리. 2026-10-08 확정한 이관 규칙(legacy-import/category-map.json)과 같음
const LEGACY_MCODE: Record<string, string | null> = {
  m84xb1v: null, m85ny3r: null, // 전체기사
  m247tk9: '정치', m322ycu: '정치', m331evx: '정치', m35cu9n: '정치', m750cy4: '정치', // 정치·사회, 대통령실, 정당·국회, 정부, 사법리스크
  m867ykr: '정치', m916pna: '정치', m8359b8: '정치', // 경제, 법률, 뉴스 브리핑
  m730mv1: '국제',
  m69n9ns: '사회', m77aapm: '사회', // 사건사고, 과학-IT
  m37525y: '문화', m72gfuh: '문화', m71efgg: '문화', m78mj32: '문화', m81yw2r: '문화', m82zu84: '문화', m92ouz2: '문화',
  m878ope: '후원하기', m889qdv: '후원하기',
};

export default async function Home({ searchParams }: { searchParams: { category?: string; page?: string; mcode?: string } }) {
  if (searchParams.mcode !== undefined) {
    const mapped = LEGACY_MCODE[searchParams.mcode];
    permanentRedirect(mapped ? `/?category=${encodeURIComponent(mapped)}` : '/');
  }
  const category = searchParams.category;
  const page = Math.max(1, Math.floor(Number(searchParams.page)) || 1);

  // 정치신세계는 Article이 아니라 유튜브에서 자동 수집된 VideoCard로 구성되는 전용 피드 (기능정의서 4.2.1)
  // 브라우저 새로고침마다 유튜브와 동기화한다.
  if (category === '정치신세계') {
    await ensureVideoCardsFresh(true);
    const [cards, user] = await Promise.all([
      prisma.videoCard.findMany({ orderBy: { publishedAt: 'desc' }, take: 60 }),
      getCurrentUser(),
    ]);
    return <VideoCardGrid cards={cards as any} canRefresh={user?.role === ROLES.CHIEF_EDITOR} />;
  }

  // '전체' 탭(카테고리 미지정)에서는 정치신세계 영상도 "기사가 발행된 것"처럼 취급해 특정 카테고리에 가두지 않고
  // 인덱스 피드에 최신 기사들과 함께 섞어서 노출한다 (2026-09-11 사용자 지시). 정치/국제/사회/문화 등 개별 카테고리
  // 탭이나 정치신세계 전용 탭(위 분기)에는 영향 없음.
  const showVideosInFeed = !category;
  if (showVideosInFeed) await ensureVideoCardsFresh();

  const where = {
    status: 'PUBLISHED' as ArticleStatus,
    showOnMain: true, // 편집장이 카드 (-) 버튼으로 뺀 기사는 메인(전체+카테고리 탭)에서만 제외 (2026-09-12 신설)
    ...(category ? { category: { name: category } } : {}),
  };
  const include = { author: true, keywords: true, category: true } as const;

  // 대표(featured) 슬롯: 편집장이 1면톱으로 수동 지정한 기사가 있으면 그걸 우선, 없으면 최신 기사로 대체
  // (2026-09-22 재도입 — 단, 지정한 걸 잊고 방치하면 오래된 기사가 계속 남는 문제가 있었으므로
  //  "지정된 게 없을 때만" 최신순으로 대체하도록 해서 완전히 빈 자리가 되는 것만 막음)
  const [pinned, homepageBanners] = await Promise.all([
    prisma.article.findFirst({ where: { ...where, isFrontpageTop: true }, include }),
    prisma.banner.findMany({
      where: { active: true, placement: { in: ['HOMEPAGE_3', 'HOMEPAGE_5', 'HOMEPAGE_7'] } },
    }),
  ]);
  const top = pinned ?? (await prisma.article.findFirst({ where, include, orderBy: { publishedAt: 'desc' } }));
  // 대표 기사는 1페이지 맨 위에만 — 페이지 나눔은 대표를 뺀 나머지 목록 기준
  const listWhere = top ? { ...where, NOT: { id: top.id } } : where;
  const offset = (page - 1) * PAGE_SIZE;

  const SLOT_BY_PLACEMENT: Record<string, 3 | 5 | 7> = { HOMEPAGE_3: 3, HOMEPAGE_5: 5, HOMEPAGE_7: 7 };
  const banners = homepageBanners.map((b) => ({
    slot: SLOT_BY_PLACEMENT[b.placement],
    imageUrl: b.imageUrl,
    linkUrl: b.linkUrl,
  }));

  let feedItems: unknown[];
  let total: number;
  if (showVideosInFeed) {
    // '전체' 피드: 기사와 영상(라이브)을 게시 시각 기준으로 섞은 하나의 목록을 DB에서 바로 잘라 온다
    const topId = top?.id ?? '';
    const [rows, counts] = await Promise.all([
      prisma.$queryRaw<{ id: string; t: 'A' | 'V' }[]>(Prisma.sql`
        SELECT id, 'A' AS t, "publishedAt" FROM "Article"
          WHERE status = 'PUBLISHED' AND "showOnMain" = true AND id <> ${topId}
        UNION ALL
        SELECT id, 'V' AS t, "publishedAt" FROM "VideoCard" WHERE "showOnMain" = true
        ORDER BY "publishedAt" DESC NULLS LAST
        OFFSET ${offset} LIMIT ${PAGE_SIZE}`),
      Promise.all([prisma.article.count({ where: listWhere }), prisma.videoCard.count({ where: { showOnMain: true } })]),
    ]);
    total = counts[0] + counts[1];
    const [articles, videos] = await Promise.all([
      prisma.article.findMany({ where: { id: { in: rows.filter((r) => r.t === 'A').map((r) => r.id) } }, include }),
      prisma.videoCard.findMany({ where: { id: { in: rows.filter((r) => r.t === 'V').map((r) => r.id) } } }),
    ]);
    const byId = new Map<string, unknown>([
      ...articles.map((a) => [a.id, a] as const),
      // 영상도 "기사 생성"처럼 취급해 같은 카드 그리드에 섞음 (2026-09-11 사용자 지시)
      ...videos.map((v) => [v.id, {
        id: v.id,
        isVideo: true as const,
        youtubeId: v.youtubeId,
        title: v.title,
        thumbnailUrl: v.thumbnailUrl,
        kind: v.kind,
        publishedAt: v.publishedAt,
      }] as const),
    ]);
    feedItems = rows.map((r) => byId.get(r.id)).filter(Boolean);
  } else {
    [feedItems, total] = await Promise.all([
      prisma.article.findMany({ where: listWhere, include, orderBy: { publishedAt: 'desc' }, skip: offset, take: PAGE_SIZE }),
      prisma.article.count({ where: listWhere }),
    ]);
  }
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      {/* 검색엔진용 페이지 제목(h1) — 화면에는 안 보임 */}
      <h1 className="sr-only">{category ? `팩트파인더 ${category} 뉴스` : '팩트파인더 최신 뉴스'}</h1>
      <Masonry top={page === 1 ? (top as any) : null} articles={feedItems as any} banners={banners} />
      <Pagination page={page} totalPages={totalPages} category={category} />
    </>
  );
}
