'use client';

import PhotoBank from './PhotoBank';
import { figureCaption } from '@/lib/photoBankRules';

// 기사 작성 화면의 "사진 뱅크에서 고르기" 창 (기능정의서 8.1 갤러리 픽커 → 2026-10-09 사진 뱅크로 교체)
// multiple=false: 본문 이미지 1장 / multiple=true: 카드뉴스 여러 장
// 고른 사진의 캡션은 "캡션 (크레디트)"로 넘김 — AI 사진은 "AI 재구성 이미지" 표시가 항상 붙음.
// 사용 이력은 기사를 저장할 때 서버가 본문·카드뉴스의 사진을 보고 기록한다(lib/photoBank.ts syncPhotoUsage).
export type GalleryPickedPhoto = { url: string; title?: string | null };

export default function PhotoGalleryModal({
  open,
  onClose,
  onSelect,
  multiple = false,
  canManage = false,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (items: GalleryPickedPhoto[]) => void;
  multiple?: boolean;
  canManage?: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-bold text-gray-900">사진 뱅크에서 고르기{multiple ? ' (여러 장)' : ''}</h3>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">
            ✕
          </button>
        </div>
        <div className="p-4 overflow-y-auto flex-1">
          <PhotoBank
            mode="pick"
            multiple={multiple}
            isChief={canManage}
            onPick={(items) => {
              onSelect(items.map((p) => ({ url: p.url, title: figureCaption(p.title, p.credit, p.sourceType) })));
              onClose();
            }}
          />
        </div>
      </div>
    </div>
  );
}
