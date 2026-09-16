'use client';

import { useEffect, useState } from 'react';

// 기사 본문만 확대/축소 — 브라우저에 마지막 선택값 저장, .article-content에 CSS 변수로 반영 (2026-09-12 신설)
const SCALES = [0.9, 1, 1.15, 1.3];
const STORAGE_KEY = 'ff-article-font-scale';

export default function TextSizeControl() {
  const [index, setIndex] = useState(1);

  useEffect(() => {
    let initial = 1;
    try {
      const saved = Number(localStorage.getItem(STORAGE_KEY));
      const savedIndex = SCALES.indexOf(saved);
      if (savedIndex >= 0) initial = savedIndex;
    } catch {
      // 접근 불가 환경 — 기본값 사용
    }
    setIndex(initial);
    document.documentElement.style.setProperty('--article-font-scale', String(SCALES[initial]));
  }, []);

  function apply(nextIndex: number) {
    const clamped = Math.max(0, Math.min(SCALES.length - 1, nextIndex));
    setIndex(clamped);
    document.documentElement.style.setProperty('--article-font-scale', String(SCALES[clamped]));
    try {
      localStorage.setItem(STORAGE_KEY, String(SCALES[clamped]));
    } catch {
      // 접근 불가 환경 — 저장만 생략
    }
  }

  return (
    <span className="flex items-center gap-1 text-xs font-semibold text-gray-600 border border-gray-200 rounded-full px-2 py-1.5">
      <button
        type="button"
        onClick={() => apply(index - 1)}
        disabled={index === 0}
        aria-label="본문 글자 작게"
        title="본문 글자 작게"
        className="px-1 disabled:opacity-30 hover:text-brand"
        style={{ fontSize: 11 }}
      >
        가
      </button>
      <span className="w-px h-3 bg-gray-200" />
      <button
        type="button"
        onClick={() => apply(index + 1)}
        disabled={index === SCALES.length - 1}
        aria-label="본문 글자 크게"
        title="본문 글자 크게"
        className="px-1 disabled:opacity-30 hover:text-brand"
        style={{ fontSize: 16 }}
      >
        가
      </button>
    </span>
  );
}
