'use client';

import { useSearchParams } from 'next/navigation';
import DonateForm from '@/components/DonateForm';

export default function DonatePage() {
  const searchParams = useSearchParams();
  const reporterId = searchParams.get('reporter') || '';

  return (
    <main className="max-w-md mx-auto px-4 py-10">
      <h1 className="text-xl font-bold text-gray-900 mb-2">팩트파인더 정기후원</h1>
      <DonateForm initialReporterId={reporterId} />
    </main>
  );
}
