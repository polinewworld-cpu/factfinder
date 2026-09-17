'use client';

import { useEffect, useState } from 'react';
import { ThumbsUpIcon } from './icons';

// 기사 "추천" 버튼 — 로그인 불필요. 같은 브라우저에서 중복 추천 방지는 localStorage로만 처리(best-effort) (2026-09-12 신설)
export default function RecommendButton({ articleId, initialCount }: { articleId: string; initialCount: number }) {
  const [count, setCount] = useState(initialCount);
  const [recommended, setRecommended] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    try {
      setRecommended(localStorage.getItem(`ff-recommended-${articleId}`) === '1');
    } catch {
      // 접근 불가 환경 — 매번 추천 가능한 상태로 둠
    }
  }, [articleId]);

  async function recommend() {
    if (recommended || busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/articles/${articleId}/recommend`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setCount(data.recommendCount);
        setRecommended(true);
        try {
          localStorage.setItem(`ff-recommended-${articleId}`, '1');
        } catch {
          // 저장 실패는 무시 — 새로고침 시 다시 추천 가능해질 뿐
        }
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={recommend}
      disabled={recommended || busy}
      title={recommended ? '추천 완료' : '추천'}
      aria-pressed={recommended}
      className="icon-action"
      style={{ opacity: busy ? 0.6 : 1 }}
    >
      <ThumbsUpIcon />
      {count}
    </button>
  );
}
