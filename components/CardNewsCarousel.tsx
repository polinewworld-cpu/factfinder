'use client';

import { useEffect, useRef, useState } from 'react';

type Img = { id: string; url: string; caption?: string | null };

// 인스타그램 피드 캐러셀과 최대한 유사하게: 한 장씩 스냅 넘김 + 상단 점 인디케이터 +
// 우상단 "N/M" 카운터 배지 + 좌우 화살표(데스크톱 hover 시 노출) + 좌우 스와이프(모바일)
export default function CardNewsCarousel({ articleId, images }: { articleId: string; images: Img[] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [hover, setHover] = useState(false);

  if (images.length === 0) return null;

  function scrollToIndex(i: number) {
    const track = trackRef.current;
    if (!track) return;
    const clamped = Math.max(0, Math.min(images.length - 1, i));
    track.scrollTo({ left: clamped * track.clientWidth, behavior: 'smooth' });
  }

  function handleScroll() {
    const track = trackRef.current;
    if (!track || track.clientWidth === 0) return;
    const i = Math.round(track.scrollLeft / track.clientWidth);
    setIndex(Math.max(0, Math.min(images.length - 1, i)));
  }

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const onResize = () => track.scrollTo({ left: index * track.clientWidth });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section className="my-8">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-bold text-gray-900 text-sm">카드뉴스</h3>
        <a
          href={`/api/articles/${articleId}/cardnews`}
          className="text-xs font-semibold text-brand border border-brand/30 rounded-full px-3 py-1 hover:bg-brand/5"
        >
          전체 다운로드
        </a>
      </div>

      <div
        className="relative max-w-md mx-auto select-none"
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
      >
        {/* 우상단 N/M 카운터 배지 — 인스타그램 스타일 */}
        {images.length > 1 && (
          <span className="absolute top-3 right-3 z-10 text-[11px] font-semibold text-white bg-black/50 rounded-full px-2 py-0.5 backdrop-blur-sm">
            {index + 1}/{images.length}
          </span>
        )}

        <div
          ref={trackRef}
          onScroll={handleScroll}
          className="flex overflow-x-auto snap-x snap-mandatory scroll-smooth rounded-xl border border-gray-200 bg-black"
          style={{ scrollbarWidth: 'none', scrollSnapType: 'x mandatory' }}
        >
          {images.map((img) => (
            <div
              key={img.id}
              className="shrink-0 w-full snap-start"
              style={{ scrollSnapAlign: 'start', scrollSnapStop: 'always' }}
            >
              <img src={img.url} alt={img.caption ?? ''} className="w-full aspect-square object-cover" draggable={false} />
            </div>
          ))}
        </div>

        {/* 좌우 화살표 — 데스크톱에서 마우스 올렸을 때만, 인스타그램과 동일하게 흰 원형 버튼 */}
        {images.length > 1 && (
          <>
            {index > 0 && (
              <button
                type="button"
                aria-label="이전 카드"
                onClick={() => scrollToIndex(index - 1)}
                className={`hidden sm:flex absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-white shadow items-center justify-center text-gray-700 text-sm transition-opacity ${
                  hover ? 'opacity-90' : 'opacity-0'
                }`}
              >
                ‹
              </button>
            )}
            {index < images.length - 1 && (
              <button
                type="button"
                aria-label="다음 카드"
                onClick={() => scrollToIndex(index + 1)}
                className={`hidden sm:flex absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-white shadow items-center justify-center text-gray-700 text-sm transition-opacity ${
                  hover ? 'opacity-90' : 'opacity-0'
                }`}
              >
                ›
              </button>
            )}
          </>
        )}

        {/* 하단 점 인디케이터 — 인스타그램 스타일 */}
        {images.length > 1 && (
          <div className="flex items-center justify-center gap-1.5 mt-2.5">
            {images.map((img, i) => (
              <button
                key={img.id}
                type="button"
                aria-label={`${i + 1}번째 카드로 이동`}
                onClick={() => scrollToIndex(i)}
                className={`rounded-full transition-all ${
                  i === index ? 'w-1.5 h-1.5 bg-brand' : 'w-1.5 h-1.5 bg-gray-300'
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
