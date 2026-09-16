'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ArticleCard, { CardArticle } from './ArticleCard';
import BannerSlotCard from './BannerSlotCard';
import VideoMasonryCard, { MasonryVideo } from './VideoMasonryCard';

export type HomepageBanner = { slot: 3 | 5 | 7; imageUrl: string; linkUrl: string };
type BannerGridItem = { id: string; isBanner: true; imageUrl: string; linkUrl: string };
// 정치신세계 영상을 "기사 생성"처럼 취급해 전체(인덱스) 피드에 섞어 보여주기 위한 항목 타입 (2026-09-11 신설)
export type VideoGridItem = MasonryVideo & { isVideo: true };
type GridItem = CardArticle | BannerGridItem | VideoGridItem;

function isBannerItem(item: GridItem): item is BannerGridItem {
  return (item as BannerGridItem).isBanner === true;
}

function isVideoItem(item: GridItem): item is VideoGridItem {
  return (item as VideoGridItem).isVideo === true;
}

// 메인화면 그리드의 3/5/7번째 카드 자리를 광고 슬롯으로 고정 (기능정의서 5) — 해당 순번의 기사 카드를 배너로 교체
function withBanners(items: CardArticle[], banners: HomepageBanner[] = []): GridItem[] {
  if (banners.length === 0) return items;
  const bySlot = new Map(banners.map((b) => [b.slot, b]));
  return items.map((item, index): GridItem => {
    const banner = bySlot.get((index + 1) as 3 | 5 | 7);
    if (!banner) return item;
    return {
      id: `banner-slot-${banner.slot}`,
      isBanner: true as const,
      imageUrl: banner.imageUrl,
      linkUrl: banner.linkUrl,
    };
  });
}

function columnsForWidth(width: number) {
  if (width < 520) return 2;
  if (width < 820) return 3;
  if (width < 1100) return 4;
  if (width < 1480) return 5;
  return 6;
}

function useColumnCount() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [columnCount, setColumnCount] = useState(5);
  const [width, setWidth] = useState(1200);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return undefined;

    const update = () => {
      setWidth(node.clientWidth);
      setColumnCount(columnsForWidth(node.clientWidth));
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return { containerRef, columnCount, width };
}

function packColumns(
  items: GridItem[],
  columnCount: number,
  hasFeatured: boolean,
  hasSecond: boolean
) {
  const columns: GridItem[][] = Array.from({ length: columnCount }, () => []);
  const heights = Array(columnCount).fill(0);

  if (hasFeatured && columnCount >= 2) {
    const featuredHeight = 2.08 * 1.12 + 0.38;
    heights[0] = featuredHeight;
    heights[1] = featuredHeight;
  }

  if (hasSecond && columnCount >= 4) {
    const secondHeight = 2.08 * 0.46 + 0.38;
    heights[2] += secondHeight;
    heights[3] += secondHeight;
  }

  items.forEach((item) => {
    const shortest = heights.indexOf(Math.min(...heights));
    columns[shortest].push(item);
    const hasImage = isBannerItem(item) || isVideoItem(item) || !!(item as CardArticle).coverImageUrl;
    const imageWeight = hasImage ? 0.9 : 0.55;
    heights[shortest] += imageWeight + 0.42;
  });

  return columns;
}

const PAGE_SIZE = 12;

function useInfiniteReveal(total: number, onLoadMore: () => void, enabled: boolean) {
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!enabled) return undefined;
    const node = sentinelRef.current;
    if (!node) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) onLoadMore();
      },
      { root: null, rootMargin: '720px 0px', threshold: 0 }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [enabled, onLoadMore, total]);

  return sentinelRef;
}

export default function Masonry({
  articles,
  top,
  banners = [],
}: {
  articles: (CardArticle | VideoGridItem)[];
  top?: CardArticle | null;
  banners?: HomepageBanner[];
}) {
  const { containerRef, columnCount, width } = useColumnCount();
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // 상단 2번째(second) 슬롯은 ArticleCard 전용이라, 맨 앞 항목이 영상이면 그 슬롯은 건너뛰고 일반 그리드로 흘려보냄
  const showFeatured = !!top && columnCount >= 2;
  const showSecond =
    showFeatured && articles.length > 0 && columnCount >= 4 && !isVideoItem(articles[0]);
  const second = showSecond ? (articles[0] as CardArticle) : null;
  const rest = showSecond ? articles.slice(1) : articles;

  const visible = useMemo(() => withBanners(rest.slice(0, visibleCount), banners), [rest, visibleCount, banners]);
  const columns = useMemo(
    () => packColumns(visible, columnCount, showFeatured, !!second),
    [visible, columnCount, showFeatured, second]
  );

  const featuredRef = useRef<HTMLDivElement | null>(null);
  const secondRef = useRef<HTMLDivElement | null>(null);
  const [featuredHeight, setFeaturedHeight] = useState(0);
  const [secondHeight, setSecondHeight] = useState(0);

  useEffect(() => {
    if (!showFeatured) {
      setFeaturedHeight(0);
      return undefined;
    }
    const node = featuredRef.current;
    if (!node) return undefined;
    const update = () => setFeaturedHeight(node.getBoundingClientRect().height);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, [showFeatured, columnCount]);

  useEffect(() => {
    if (!second) {
      setSecondHeight(0);
      return undefined;
    }
    const node = secondRef.current;
    if (!node) return undefined;
    const update = () => setSecondHeight(node.getBoundingClientRect().height);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, [second, columnCount]);

  const estimatedFeaturedHeight = useMemo(() => {
    if (columnCount < 2) return 0;
    const columnWidth = (width - 16 * (columnCount - 1)) / columnCount;
    return 2 * (columnWidth * 1.02 + 90) + 22;
  }, [width, columnCount]);

  const estimatedSecondHeight = useMemo(() => {
    if (columnCount < 4) return 0;
    const columnWidth = (width - 16 * (columnCount - 1)) / columnCount;
    return (2 * columnWidth + 16) * 0.46 + 110;
  }, [width, columnCount]);

  const hasMore = visibleCount < rest.length;
  const loadMore = useCallback(() => {
    if (!hasMore) return;
    setVisibleCount((count) => Math.min(count + PAGE_SIZE, rest.length));
  }, [hasMore, rest.length]);
  const sentinelRef = useInfiniteReveal(rest.length, loadMore, hasMore);

  if (!top && articles.length === 0) {
    return (
      <div className="content">
        <div className="empty-state">
          <p>아직 발행된 기사가 없습니다.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="content">
      <div className="masonry" ref={containerRef} style={{ '--cols': columnCount } as React.CSSProperties}>
        {showFeatured && top && (
          <div className="featured-slot" ref={featuredRef}>
            <ArticleCard article={top} featured />
          </div>
        )}

        {second && (
          <div className="second-slot" ref={secondRef}>
            <ArticleCard article={second} wide />
          </div>
        )}

        {columns.map((column, index) => (
          <div className="masonry-column" key={index}>
            {showFeatured && index < 2 && (
              <div
                className="featured-spacer"
                style={{ height: featuredHeight || estimatedFeaturedHeight }}
                aria-hidden="true"
              />
            )}
            {second && index >= 2 && index < 4 && (
              <div
                className="featured-spacer"
                style={{ height: secondHeight || estimatedSecondHeight }}
                aria-hidden="true"
              />
            )}
            {column.map((item) =>
              isBannerItem(item) ? (
                <BannerSlotCard key={item.id} imageUrl={item.imageUrl} linkUrl={item.linkUrl} />
              ) : isVideoItem(item) ? (
                <VideoMasonryCard key={item.id} video={item} />
              ) : (
                <ArticleCard key={item.id} article={item} />
              )
            )}
          </div>
        ))}
      </div>

      <div className="infinite-footer">
        {hasMore && <div ref={sentinelRef} className="infinite-sentinel" style={{ height: 1 }} />}
      </div>
    </div>
  );
}
