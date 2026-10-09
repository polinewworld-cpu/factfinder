'use client';

import PhotoBank, { PhotoBankGuide } from '@/components/PhotoBank';

// 관리자 → 사진 뱅크 (2026-10-09, 기능정의 v0.1 1단계) — 편집장 화면. 기자는 /photos 와 기사 작성 화면의 "사진 뱅크" 버튼으로 같은 기능을 쓴다.
export default function AdminPhotoBankPage() {
  return (
    <main className="py-8">
      <h1 className="text-xl font-bold text-gray-900 mb-1">사진 뱅크</h1>
      <PhotoBankGuide />
      <PhotoBank mode="manage" isChief />
    </main>
  );
}
