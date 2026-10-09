'use client';

import { useEffect, useState } from 'react';
import PhotoBank from '@/components/PhotoBank';

const WRITER_ROLES = ['REPORTER', 'COLUMNIST', 'CHIEF_EDITOR'];

// 사진 뱅크 — 기자·논설위원·편집장 (기능정의서 8.1 보도사진 라이브러리 → 2026-10-09 사진 뱅크로 교체)
// 편집장 전용 기능(인물·상황 태그 관리, 삭제)은 관리자 → 사진 뱅크에서.
export default function PhotosLibraryPage() {
  const [me, setMe] = useState<any>('loading');

  useEffect(() => {
    fetch('/api/me')
      .then((r) => (r.ok ? r.json() : null))
      .then(setMe)
      .catch(() => setMe(null));
  }, []);

  if (me === 'loading') return <main className="max-w-6xl mx-auto px-4 py-10 text-gray-500">불러오는 중…</main>;
  if (!me || !WRITER_ROLES.includes(me.role)) {
    return (
      <main className="max-w-6xl mx-auto px-4 py-10">
        <p className="text-gray-600">기자·논설위원·편집장만 쓸 수 있습니다.</p>
      </main>
    );
  }
  return (
    <main className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-xl font-bold text-gray-900 mb-1">사진 뱅크</h1>
      <p className="text-sm text-gray-500 mb-5">출처가 확인된 사진만 들어옵니다. 통신사·게티 사진은 등록할 수 없습니다.</p>
      <PhotoBank mode="manage" isChief={me.role === 'CHIEF_EDITOR'} />
    </main>
  );
}
