'use client';

import { useState } from 'react';
import { BookmarkIcon } from './icons';

// 기사 저장(북마크) 토글 버튼 — 로그인한 모든 회원 사용 가능 (기능정의서 3.1)
export default function SaveButton({
  articleId,
  initialSaved,
  loggedIn,
}: {
  articleId: string;
  initialSaved: boolean;
  loggedIn: boolean;
}) {
  const [saved, setSaved] = useState(initialSaved);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    if (!loggedIn) {
      window.location.href = '/api/auth/signin/google';
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/articles/${articleId}/save`, { method: saved ? 'DELETE' : 'POST' });
      if (res.ok) setSaved(!saved);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      title={saved ? '저장 취소' : '기사 저장'}
      aria-pressed={saved}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        color: saved ? 'var(--accent, #d0342c)' : 'inherit',
        opacity: busy ? 0.6 : 1,
      }}
    >
      <BookmarkIcon filled={saved} />
    </button>
  );
}
