'use client';

import { useState } from 'react';
import { CreditCardIcon } from './icons';
import DonateModal from './DonateModal';

// 기사 상단 "원고료로 응원하기" 버튼 — 클릭해도 페이지 이동 없이 레이어(모달)로 후원 폼을 띄움 (2026-09-12)
export default function DonateButton({ reporterId }: { reporterId: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 border border-gray-200 rounded-full px-3 py-1.5 hover:border-brand hover:text-brand"
      >
        <CreditCardIcon />
        원고료로 응원하기
      </button>
      {open && <DonateModal reporterId={reporterId} onClose={() => setOpen(false)} />}
    </>
  );
}
