'use client';

import { useState } from 'react';
import { timeAgo } from '@/lib/time';
import { useSavedArticles } from './SavedArticlesProvider';
import CardHeadline from './CardHeadline';
import CoverHoverImage from './CoverHoverImage';

export type MasonryVideo = {
  id: string;
  youtubeId: string;
  title: string;
  thumbnailUrl: string;
  kind: 'SHORT' | 'VIDEO' | 'LIVE';
  publishedAt: string | Date;
};

const KIND_LABEL: Record<MasonryVideo['kind'], string> = {
  SHORT: '쇼츠',
  VIDEO: '영상',
  LIVE: '라이브',
};

function videoUrl(video: MasonryVideo) {
  if (video.kind === 'SHORT') return `https://www.youtube.com/shorts/${video.youtubeId}`;
  return `https://www.youtube.com/watch?v=${video.youtubeId}`;
}

function youtubeFullFrameThumb(url: string) {
  return url.replace(/\/(hqdefault|sddefault|default|0)\.(jpg|webp)(\?.*)?$/i, '/maxresdefault.$2$3');
}

// 정치신세계 영상을 "기사 생성"처럼 취급해 인덱스(전체) 피드의 일반 기사 카드와 같은 메이슨리 레이아웃에 섞어 보여주는 카드 (2026-09-11 신설)
// 클릭하면 사이트 내 상세페이지가 아니라 유튜브로 바로 이동함.
// '메인에서 제외' 기능은 정치신세계 서브페이지가 아니라 이 메인 피드 카드에서 하도록 위치를 옮김 (2026-09-12 사용자 지시)
export default function VideoMasonryCard({
  video,
  wide = false,
  square = false,
}: {
  video: MasonryVideo;
  wide?: boolean;
  square?: boolean;
}) {
  const href = videoUrl(video);
  const { isChiefEditor } = useSavedArticles();
  const [hiddenFromMain, setHiddenFromMain] = useState(false);
  const [removeBusy, setRemoveBusy] = useState(false);

  async function removeFromMain(event: React.MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    if (!window.confirm('이 영상을 메인 화면에서만 제외할까요? (정치신세계 탭에서는 계속 노출됩니다)')) return;
    setRemoveBusy(true);
    try {
      const res = await fetch(`/api/video-cards/${video.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ showOnMain: false }),
      });
      if (res.ok) setHiddenFromMain(true);
    } finally {
      setRemoveBusy(false);
    }
  }

  if (hiddenFromMain) return null;

  const frameAspect = video.kind === 'SHORT' ? 9 / 16 : 16 / 9;
  const thumbSrc = square ? youtubeFullFrameThumb(video.thumbnailUrl) : video.thumbnailUrl;

  return (
    <article className={wide ? 'pin is-wide' : 'pin'}>
      <a className="pin-media" href={href} target="_blank" rel="noopener noreferrer">
        <CoverHoverImage
          src={thumbSrc}
          fallbackSrc={square && thumbSrc !== video.thumbnailUrl ? video.thumbnailUrl : undefined}
          aspectRatio={wide ? '1 / 0.484' : square ? '1 / 1' : video.kind === 'SHORT' ? '9 / 16' : '16 / 9'}
          fallbackAxis={video.kind === 'SHORT' ? 'y' : 'x'}
          contentAspect={square ? frameAspect : undefined}
        />
        <div className="pin-badges">
          <span className="pin-badge-chip">정치신세계</span>
        </div>
        <div className="pin-overlay">
          {isChiefEditor && (
            <button
              type="button"
              className="pin-remove-main-btn"
              onClick={removeFromMain}
              disabled={removeBusy}
              aria-label="메인에서 제외"
              title="메인에서 제외"
            >
              −
            </button>
          )}
        </div>
      </a>

      <div className="pin-copy">
        <h2>
          <CardHeadline
            title={video.title}
            canEdit={isChiefEditor}
            patchUrl={`/api/video-cards/${video.id}`}
            href={isChiefEditor ? undefined : href}
            external
            ariaLabel="영상 제목"
          />
        </h2>
        <div className="pin-meta">
          <span>{KIND_LABEL[video.kind]}</span>
          <span className="dot" />
          <time>{timeAgo(video.publishedAt)}</time>
        </div>
      </div>
    </article>
  );
}
