import CompanyContactForm from '@/components/CompanyContactForm';

// 기사제보 — 실사이트 고객센터 "뉴스제보" 탭과 동일한 항목 구성 (2026-09-12 신설)
export const metadata = { title: '기사제보 - 팩트파인더' };

export default function CompanyReportPage() {
  return (
    <main className="px-4 py-8">
      <div className="max-w-md mx-auto">
        <h1 className="text-xl font-bold text-gray-900 mb-6">기사제보</h1>
        <CompanyContactForm subjectPrefix="기사제보" />
      </div>
    </main>
  );
}
