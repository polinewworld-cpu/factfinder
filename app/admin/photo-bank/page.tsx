'use client';

import { useEffect, useState } from 'react';
import PhotoBank, { PhotoBankGuide } from '@/components/PhotoBank';

// 편집실 → 사진 뱅크 (2026-10-09, 기능정의 v0.1) — 편집장은 삭제·인물/상황 태그 관리·수신함까지, 기자·논설위원은 검색·등록·기사에 쓰기.
export default function AdminPhotoBankPage() {
  const [isChief, setIsChief] = useState<boolean | null>(null);
  useEffect(() => {
    fetch('/api/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((me) => setIsChief(me?.role === 'CHIEF_EDITOR'))
      .catch(() => setIsChief(false));
  }, []);

  return (
    <main className="py-8">
      <h1 className="text-xl font-bold text-gray-900 mb-1">사진 뱅크</h1>
      <PhotoBankGuide />
      {isChief === null ? <p className="text-sm text-gray-400">불러오는 중…</p> : <PhotoBank mode="manage" isChief={isChief} />}
    </main>
  );
}
