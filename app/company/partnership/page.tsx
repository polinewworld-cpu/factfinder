import CompanyContactForm from '@/components/CompanyContactForm';

// 광고 및 제휴문의 — 실사이트 고객센터 "제휴제안" 탭과 동일한 항목 구성 (2026-09-12 신설)
export const metadata = { title: '광고 및 제휴문의 - 팩트파인더' };

export default function CompanyPartnershipPage() {
  return (
    <main className="px-4 py-8">
      <div className="max-w-md mx-auto">
        <h1 className="text-xl font-bold text-gray-900 mb-6">광고 및 제휴문의</h1>
        <CompanyContactForm subjectPrefix="광고 및 제휴문의" />
      </div>
    </main>
  );
}
