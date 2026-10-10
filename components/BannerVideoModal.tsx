'use client';

import { useEffect, useRef } from 'react';
import { closeOnBackdrop } from '@/lib/backdrop';

// 배너 영상 팝업 (2026-10-10 사장님 요청) — 배너를 누르면 화면을 어둡게 깔고 영상 재생,
// 아래에 광고주 링크 버튼([웰컴퓨터 블로그 구경가기] 등), 오른쪽 위·아래에 닫기. Esc·바깥 누르기로도 닫힘.
// 영상 주소: 사이트 안 mp4(/ads/...) 또는 유튜브 링크

function youtubeId(url: string) {
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|shorts\/|embed\/|live\/))([\w-]{11})/);
  return m?.[1] ?? null;
}

export default function BannerVideoModal({
  videoUrl,
  linkUrl,
  ctaLabel,
  poster,
  onClose,
}: {
  videoUrl: string;
  linkUrl: string;
  ctaLabel?: string | null;
  poster?: string;
  onClose: () => void;
}) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeRef.current();
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden'; // 뒤 화면 스크롤 막기
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  const yt = youtubeId(videoUrl);

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(3px)' }}
      role="dialog"
      aria-modal="true"
      aria-label="광고 영상"
      {...closeOnBackdrop(onClose)}
    >
      <div className="relative w-full max-w-[860px]">
        <button
          type="button"
          onClick={onClose}
          aria-label="닫기"
          className="absolute -top-11 right-0 flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white text-xl leading-none hover:bg-white/30"
        >
          ✕
        </button>
        <div className="overflow-hidden rounded-xl bg-black shadow-2xl" style={{ aspectRatio: '16 / 9' }}>
          {yt ? (
            <iframe
              src={`https://www.youtube.com/embed/${yt}?autoplay=1&rel=0&playsinline=1`}
              title="광고 영상"
              allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
              allowFullScreen
              className="h-full w-full"
            />
          ) : (
            <video src={videoUrl} poster={poster} controls autoPlay playsInline className="h-full w-full object-contain" />
          )}
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
          <a
            href={linkUrl}
            target="_blank"
            rel="noopener noreferrer sponsored"
            className="rounded-full px-7 py-3 text-[15px] font-bold text-white shadow-lg hover:brightness-110"
            style={{ background: '#ff247d' }}
          >
            {ctaLabel?.trim() || '자세히 보기'}
          </a>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-white/40 px-6 py-3 text-[15px] font-semibold text-white hover:bg-white/10"
          >
            닫기
          </button>
        </div>
        <p className="mt-3 text-center text-[11px] text-white/50">광고</p>
      </div>
    </div>
  );
}
