'use client';

import { CloseIcon } from './icons';
import DonateForm from './DonateForm';
import { closeOnBackdrop } from '@/lib/backdrop';

// "원고료로 응원하기" 클릭 시 페이지 이동 없이 레이어(모달)로 후원 폼을 띄움 (2026-09-12 신설)
export default function DonateModal({
  reporterId,
  articleId,
  onClose,
}: {
  reporterId: string;
  articleId?: string;
  onClose: () => void;
}) {
  return (
    <div className="share-modal-overlay" {...closeOnBackdrop(onClose)}>
      <div className="share-modal" onClick={(e) => e.stopPropagation()}>
        <div className="share-modal-header">
          <h3 className="share-modal-title">원고료로 응원하기</h3>
          <button type="button" onClick={onClose} aria-label="닫기" className="share-modal-close">
            <CloseIcon />
          </button>
        </div>
        <div style={{ marginTop: 16 }}>
          <DonateForm initialReporterId={reporterId} articleId={articleId} />
        </div>
      </div>
    </div>
  );
}
