'use client';

import { useState } from 'react';

type VideoCardData = {
  id: string;
  youtubeId: string;
  title: string;
  thumbnailUrl: string;
  kind: 'SHORT' | 'VIDEO' | 'LIVE';
  publishedAt: string;
  showOnMain: boolean;
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

// 정치신세계 — 유튜브에서 자동 수집된 영상 카드 그리드 (기능정의서 4.2.1)
export default function VideoCardGrid({
  cards,
  canRefresh,
}: {
  cards: VideoCardData[];
  canRefresh: boolean;
}) {
  const [refreshing, setRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [restoreBusyId, setRestoreBusyId] = useState<string | null>(null);

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

  async function refresh() {
    setRefreshing(true);
    setErrorMsg('');
    const res = await fetch('/api/video-cards/sync', { method: 'POST' });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      setErrorMsg(data?.error ?? '새로고침에 실패했습니다.');
      setRefreshing(false);
      return;
    }
    setRefreshing(false);
    window.location.reload();
  }

  return (
    <div className="content">
      {canRefresh && (
        <div className="flex items-center gap-3 mb-4">
          <button
            type="button"
            onClick={refresh}
            disabled={refreshing}
            className="text-xs font-bold text-white bg-brand rounded-full px-4 py-1.5 disabled:opacity-50"
          >
            {refreshing ? '새로고침 중…' : '정치신세계 새로고침'}
          </button>
          {errorMsg && <p className="text-red-600 text-xs">{errorMsg}</p>}
        </div>
      )}

      {cards.length === 0 ? (
        <div className="empty-state">
          <p>아직 수집된 영상이 없습니다.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {cards.map((card) => (
            <a
              key={card.id}
              href={videoUrl(card)}
              target="_blank"
              rel="noopener noreferrer"
              className="block rounded-xl overflow-hidden border border-gray-200 hover:border-brand"
            >
              <div className="relative aspect-video bg-gray-100">
                <img src={card.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                <span className="absolute top-2 left-2 text-[11px] font-bold text-white bg-black/60 rounded-full px-2 py-0.5">
                  {KIND_LABEL[card.kind]}
                </span>
                {/* '메인에서 제외'는 이제 메인(전체) 피드의 영상 카드에서 하도록 옮겨감 — 여기서는 상태 표시 + 되돌리기(복구)만 가능 (2026-09-12) */}
                {!card.showOnMain && (
                  <>
                    <span className="absolute top-2 right-2 text-[11px] font-bold text-white bg-red-600/90 rounded-full px-2 py-0.5">
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
                        className="absolute bottom-2 right-2 text-[11px] font-bold text-white bg-black/60 hover:bg-black/80 rounded-full px-2 py-0.5 disabled:opacity-50"
                      >
                        메인노출 켜기
                      </button>
                    )}
                  </>
                )}
              </div>
              <p className="text-sm font-semibold text-gray-900 p-2 line-clamp-2">{card.title}</p>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
