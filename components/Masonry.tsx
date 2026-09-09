'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ArticleCard, { CardArticle } from './ArticleCard';

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
  items: CardArticle[],
  columnCount: number,
  hasFeatured: boolean,
  hasSecond: boolean
) {
  const columns: CardArticle[][] = Array.from({ length: columnCount }, () => []);
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
    const imageWeight = item.coverImageUrl ? 0.9 : 0.55;
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

export default function Masonry({ articles, top }: { articles: CardArticle[]; top?: CardArticle | null }) {
  const { containerRef, columnCount, width } = useColumnCount();
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const showFeatured = !!top && columnCount >= 2;
  const showSecond = showFeatured && articles.length > 0 && columnCount >= 4;
  const second = showSecond ? articles[0] : null;
  const rest = showSecond ? articles.slice(1) : articles;

  const visible = useMemo(() => rest.slice(0, visibleCount), [rest, visibleCount]);
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
            {column.map((article) => (
              <ArticleCard key={article.id} article={article} />
            ))}
          </div>
        ))}
      </div>

      <div className="infinite-footer">
        {hasMore && <div ref={sentinelRef} className="infinite-sentinel" style={{ height: 1 }} />}
      </div>
    </div>
  );
}
