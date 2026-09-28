'use client';

import { useState } from 'react';
import { CreditCardIcon } from './icons';
import DonateModal from './DonateModal';

// 기사 하단 "원고료로 응원하기" — 액센트 메인 버튼 (2026-09-18: 상단 액션바에서 분리해 여기로 이동)
export default function DonateButtonLarge({ reporterId }: { reporterId: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="donate-cta donate-cta--primary">
        <CreditCardIcon />
        원고료로 응원하기
      </button>
      {open && <DonateModal reporterId={reporterId} onClose={() => setOpen(false)} />}
    </>
  );
}
