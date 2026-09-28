import { prisma } from '@/lib/prisma';
import Masonry from '@/components/Masonry';
import VideoCardGrid from '@/components/VideoCardGrid';
import { getCurrentUser } from '@/lib/session';
import { ROLES } from '@/lib/roles';
import { ensureVideoCardsFresh } from '@/lib/youtube';
import type { ArticleStatus } from '@prisma/client';

export default async function Home({ searchParams }: { searchParams: { category?: string } }) {
  const category = searchParams.category;

  // 정치신세계는 Article이 아니라 유튜브에서 자동 수집된 VideoCard로 구성되는 전용 피드 (기능정의서 4.2.1)
  // 편집장의 수동 새로고침 없이도 '항상' 최신 영상이 보이도록, 탭을 열 때마다 일정 간격이 지났으면 자동 재동기화 (2026-09-11 신설)
  if (category === '정치신세계') {
    await ensureVideoCardsFresh();
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

  // 대표(featured) 슬롯: 편집장이 1면톱으로 수동 지정한 기사가 있으면 그걸 우선, 없으면 최신 기사로 대체
  // (2026-09-22 재도입 — 단, 지정한 걸 잊고 방치하면 오래된 기사가 계속 남는 문제가 있었으므로
  //  "지정된 게 없을 때만" 최신순으로 대체하도록 해서 완전히 빈 자리가 되는 것만 막음)
  const [pinned, restRaw, homepageBanners, videoCards] = await Promise.all([
    prisma.article.findFirst({
      where: { ...where, isFrontpageTop: true },
      include: { author: true, keywords: true, category: true },
    }),
    prisma.article.findMany({
      where,
      include: { author: true, keywords: true, category: true },
      orderBy: { publishedAt: 'desc' },
      take: 61,
    }),
    prisma.banner.findMany({
      where: { active: true, placement: { in: ['HOMEPAGE_3', 'HOMEPAGE_5', 'HOMEPAGE_7'] } },
    }),
    showVideosInFeed
      // '전체' 인덱스 피드에는 '메인노출 빼기' 처리되지 않은 영상만 — 정치신세계 전용 탭(위 분기)은 관리 목적상 전부 노출 (2026-09-11 신설)
      ? prisma.videoCard.findMany({ where: { showOnMain: true }, orderBy: { publishedAt: 'desc' }, take: 60 })
      : Promise.resolve([] as Awaited<ReturnType<typeof prisma.videoCard.findMany>>),
  ]);
  const top = pinned ?? restRaw[0] ?? null;
  const rest = restRaw.filter((a) => a.id !== top?.id).slice(0, 60);
  const SLOT_BY_PLACEMENT: Record<string, 3 | 5 | 7> = { HOMEPAGE_3: 3, HOMEPAGE_5: 5, HOMEPAGE_7: 7 };
  const banners = homepageBanners.map((b) => ({
    slot: SLOT_BY_PLACEMENT[b.placement],
    imageUrl: b.imageUrl,
    linkUrl: b.linkUrl,
  }));

  // 기사와 영상을 발행/게시 시각 기준으로 함께 섞어 최신순으로 정렬 — 영상도 "기사 생성"처럼 취급
  const feedItems = showVideosInFeed
    ? [
        ...rest.map((a) => ({ ...a, _publishedAt: a.publishedAt ? new Date(a.publishedAt).getTime() : 0 })),
        ...videoCards.map((v) => ({
          id: v.id,
          isVideo: true as const,
          youtubeId: v.youtubeId,
          title: v.title,
          thumbnailUrl: v.thumbnailUrl,
          kind: v.kind,
          publishedAt: v.publishedAt,
          _publishedAt: new Date(v.publishedAt).getTime(),
        })),
      ].sort((a, b) => b._publishedAt - a._publishedAt)
    : rest;

  return <Masonry top={top as any} articles={feedItems as any} banners={banners} />;
}
