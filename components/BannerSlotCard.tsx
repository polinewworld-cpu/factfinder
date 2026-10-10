'use client';

import { useState } from 'react';
import CoverHoverImage from './CoverHoverImage';
import BannerVideoModal from './BannerVideoModal';
import { sizedImage } from '@/lib/cardImage';

// 메인화면 그리드의 광고 슬롯(3/5/7번째 카드 자리) 카드 (기능정의서 5)
// 2026-10-10: 영상이 지정된 배너는 누르면 어두운 화면 위로 영상 + 광고주 링크 버튼(BannerVideoModal)
export default function BannerSlotCard({
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
    <article className="pin">
      <a
        className="pin-media"
        href={linkUrl}
        target="_blank"
        rel="noopener noreferrer sponsored"
        onClick={(e) => {
          if (!videoUrl) return;
          e.preventDefault();
          setOpen(true);
        }}
      >
        <CoverHoverImage src={sizedImage(imageUrl, 800)!} fallbackSrc={imageUrl} alt="광고" aspectRatio="1 / 1" />
        <div className="pin-overlay">
          <span className="ghost-chip">광고</span>
        </div>
        {/* 영상 배너 표시 — 마우스를 올리지 않아도(휴대폰) 보이게 항상 */}
        {videoUrl && (
          <span
            aria-hidden="true"
            className="absolute bottom-3 right-3 z-[3] flex h-11 w-11 items-center justify-center rounded-full bg-black/60 text-white text-base pl-0.5"
          >
            ▶
          </span>
        )}
      </a>
      {open && videoUrl && (
        <BannerVideoModal videoUrl={videoUrl} linkUrl={linkUrl} ctaLabel={ctaLabel} poster={sizedImage(imageUrl, 800)} onClose={() => setOpen(false)} />
      )}
    </article>
  );
}
