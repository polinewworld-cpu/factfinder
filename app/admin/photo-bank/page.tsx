'use client';

import PhotoBank from '@/components/PhotoBank';

// 관리자 → 사진 뱅크 (2026-10-09, 기능정의 v0.1 1단계) — 편집장 화면. 기자는 /photos 와 기사 작성 화면의 "사진 뱅크" 버튼으로 같은 기능을 쓴다.
export default function AdminPhotoBankPage() {
  return (
    <main className="py-8">
      <h1 className="text-xl font-bold text-gray-900 mb-1">사진 뱅크</h1>
      <p className="text-sm text-gray-500 mb-5">출처가 확인된 사진만 들어옵니다. 통신사(연합·뉴시스·뉴스1·AP·로이터·AFP·EPA)·게티 사진은 등록할 수 없습니다.</p>
      <PhotoBank mode="manage" isChief />
    </main>
  );
}
