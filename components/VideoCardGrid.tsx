'use client';

import { useEffect, useState } from 'react';
import { toFrenchBrackets } from '@/lib/frenchBrackets';
import { clampFocal, youtubeFullFrameThumb } from '@/lib/cardImage';
import CardHeadline from './CardHeadline';
import CoverHoverImage from './CoverHoverImage';

type VideoCardData = {
  id: string;
  youtubeId: string;
  title: string;
  thumbnailUrl: string;
  kind: 'SHORT' | 'VIDEO' | 'LIVE';
  publishedAt: string;
  showOnMain: boolean;
  coverFocalX?: number | null;
  coverFocalY?: number | null;
};

const KIND_LABEL: Record<VideoCardData['kind'], string> = {
  SHORT: '쇼츠',
  VIDEO: '영상',
  LIVE: '라이브',
};

function videoUrl(card: VideoCardData) {
  if (card.kind === 'SHORT') return `https://www.youtube.com/shorts/${card.youtubeId}`;
  return `https://www.youtube.com/watch?v=${card.youtubeId}`;
}

type CardVariant = 'latest' | 'second' | 'pair' | 'regular';

// 정치신세계 — 유튜브에서 자동 수집된 영상 카드 그리드 (기능정의서 4.2.1)
export default function VideoCardGrid({
  cards,
  canRefresh,
}: {
  cards: VideoCardData[];
  canRefresh: boolean;
}) {
  const [restoreBusyId, setRestoreBusyId] = useState<string | null>(null);
  const latest = cards[0];
  const [featureFocalX, setFeatureFocalX] = useState(clampFocal(latest?.coverFocalX));
  const [featureFocalY, setFeatureFocalY] = useState(clampFocal(latest?.coverFocalY));

  useEffect(() => {
    setFeatureFocalX(clampFocal(latest?.coverFocalX));
    setFeatureFocalY(clampFocal(latest?.coverFocalY));
  }, [latest?.id, latest?.coverFocalX, latest?.coverFocalY]);

  // 메인에서 제외된 영상을 되돌리는 복구 전용 버튼 — 빼는 조작 자체는 메인(전체) 피드 카드로 옮겨감 (2026-09-12)
  async function restoreToMain(card: VideoCardData) {
    setRestoreBusyId(card.id);
    try {
      await fetch(`/api/video-cards/${card.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ showOnMain: true }),
      });
      window.location.reload();
    } finally {
      setRestoreBusyId(null);
    }
  }

  async function saveFeatureFocal(x: number, y: number) {
    if (!latest) return;
    await fetch(`/api/video-cards/${latest.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ coverFocalX: x, coverFocalY: y }),
    });
  }

  function renderCard(card: VideoCardData, variant: CardVariant) {
    const isLatest = variant === 'latest';
    const isSecond = variant === 'second';
    const isPair = variant === 'pair';
    const isShort = variant === 'regular' && card.kind === 'SHORT';
    const href = videoUrl(card);
    const frameAspect = card.kind === 'SHORT' ? 9 / 16 : 16 / 9;
    const bleed = isLatest || isSecond;
    const thumbSrc = bleed ? youtubeFullFrameThumb(card.thumbnailUrl) : card.thumbnailUrl;
    const canCrop = canRefresh && isLatest;
    return (
      <div
        key={card.id}
        className={`group flex h-full min-h-0 flex-col${isLatest ? ' video-card--latest' : ''}${isSecond ? ' video-card--second' : ''}${isPair ? ' video-card--pair' : ''}${isShort ? ' video-card--short' : ''}`}
      >
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          title={toFrenchBrackets(card.title)}
          className={`video-card-thumb relative min-h-0 overflow-hidden rounded-xl border border-gray-200 bg-gray-100 hover:border-brand group-hover:border-brand${canCrop ? ' video-card-thumb--crop' : ''} ${
            isLatest || isSecond || isPair ? '' : isShort ? 'flex-1' : 'aspect-video'
          }`}
        >
          <CoverHoverImage
            src={thumbSrc}
            fallbackSrc={bleed && thumbSrc !== card.thumbnailUrl ? card.thumbnailUrl : undefined}
            alt={toFrenchBrackets(card.title)}
            fill
            fallbackAxis={card.kind === 'SHORT' ? 'y' : 'x'}
            contentAspect={bleed ? frameAspect : undefined}
            focalX={isLatest ? featureFocalX : undefined}
            focalY={isLatest ? featureFocalY : undefined}
            editable={canCrop}
            onFocalChange={
              canCrop
                ? (x, y) => {
                    setFeatureFocalX(x);
                    setFeatureFocalY(y);
                  }
                : undefined
            }
            onFocalCommit={canCrop ? saveFeatureFocal : undefined}
          />
          <span className="absolute top-2 left-2 text-xs font-bold text-white bg-black/60 rounded-lg px-2 py-0.5">
            {KIND_LABEL[card.kind]}
          </span>
          {canCrop ? <span className="video-card-crop-hint">드래그해서 크롭 위치를 맞추세요</span> : null}
          {!card.showOnMain && (
            <>
              <span className="absolute top-2 right-2 text-xs font-bold text-white bg-red-600/90 rounded-lg px-2 py-0.5">
                메인제외
              </span>
              {canRefresh && (
                <button
                  type="button"
                  disabled={restoreBusyId === card.id}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    restoreToMain(card);
                  }}
                  className="absolute bottom-2 right-2 text-xs font-bold text-white bg-black/60 hover:bg-black/80 rounded-lg px-2 py-0.5 disabled:opacity-50"
                >
                  메인노출 켜기
                </button>
              )}
            </>
          )}
        </a>
        <CardHeadline
          title={card.title}
          canEdit={canRefresh}
          patchUrl={`/api/video-cards/${card.id}`}
          href={canRefresh ? undefined : href}
          external
          ariaLabel="영상 제목"
          className={`video-card-title${canRefresh ? '' : ' line-clamp-2'}`}
        />
      </div>
    );
  }

  const hero = cards.slice(0, 4);
  const rest = cards.slice(4);

  return (
    <div className="content">
      {cards.length === 0 ? (
        <div className="empty-state">
          <p>아직 수집된 영상이 없습니다.</p>
        </div>
      ) : (
        <>
          <div className="video-hero">
            {hero[0] ? renderCard(hero[0], 'latest') : null}
            {hero[1] ? (
              <div className="video-hero-right">
                {renderCard(hero[1], 'second')}
                {hero.length > 2 ? (
                  <div className="video-hero-pair">
                    {hero.slice(2, 4).map((card) => renderCard(card, 'pair'))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
          {rest.length > 0 ? (
            <div className="video-card-grid">
              {rest.map((card) => renderCard(card, 'regular'))}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
