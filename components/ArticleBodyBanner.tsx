'use client';

import { useState } from 'react';
import { sizedImage } from '@/lib/cardImage';
import BannerVideoModal from './BannerVideoModal';

// 기사 본문 삽입 광고 — 관리자가 설정한 개수만큼, 정해진 위치에 노출 (기능정의서 5)
// 2026-10-10: 영상이 지정되면 누를 때 영상 팝업(BannerVideoModal)
export default function ArticleBodyBanner({
  imageUrl,
  linkUrl,
  videoUrl,
  ctaLabel,
}: {
  imageUrl: string;
  linkUrl: string;
  videoUrl?: string | null;
  ctaLabel?: string | null;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <a
        href={linkUrl}
        target="_blank"
        rel="noopener noreferrer sponsored"
        style={{ display: 'block', margin: '20px 0', position: 'relative' }}
        onClick={(e) => {
          if (!videoUrl) return;
          e.preventDefault();
          setOpen(true);
        }}
      >
        <span style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--ash)', marginBottom: 4 }}>광고</span>
        <img src={sizedImage(imageUrl, 1600)} alt="광고" loading="lazy" decoding="async" style={{ width: '100%', borderRadius: 8 }} />
        {videoUrl && (
          <span
            aria-hidden="true"
            className="absolute bottom-3 right-3 flex h-11 w-11 items-center justify-center rounded-full bg-black/60 text-white text-base pl-0.5"
          >
            ▶
          </span>
        )}
      </a>
      {open && videoUrl && (
        <BannerVideoModal videoUrl={videoUrl} linkUrl={linkUrl} ctaLabel={ctaLabel} poster={sizedImage(imageUrl, 1600)} onClose={() => setOpen(false)} />
      )}
    </>
  );
}
