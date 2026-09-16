// 메일수집거부 — factfinder.tv 실사이트(company/deny.php) 문구 그대로 이식 (2026-09-12 신설)
export const metadata = { title: '메일수집거부 - 팩트파인더' };

export default function CompanyMailRefusalPage() {
  return (
    <main className="px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-xl font-bold text-gray-900 mb-6">메일수집거부</h1>
        <div className="space-y-4 text-sm text-gray-700 leading-relaxed">
          <p>팩트파인더의 메일수집을 거부합니다. 무단으로 메일을 수집한 경우 형사처벌 될 수 있습니다.</p>
          <p className="pt-4 border-t border-gray-100 text-gray-500">
            팩트파인더
            <br />
            서울 마포구 와우산로32길 41 명인빌딩 B1
            <br />
            대표전화 : 070-8028-2438
          </p>
        </div>
      </div>
    </main>
  );
}
