// 이니시스 결제 후 도착하는 결과 화면 (PC·모바일 공통, 2026-10-08)
export const metadata = { title: '후원 결과 - 팩트파인더', robots: { index: false } };

export default function DonateResultPage({
  searchParams,
}: {
  searchParams: { status?: string; amount?: string; message?: string };
}) {
  const ok = searchParams.status === 'ok';
  const amount = Number(searchParams.amount) || 0;

  return (
    <main className="max-w-md mx-auto px-4 py-16 text-center">
      {ok ? (
        <>
          <p className="text-2xl font-bold text-gray-900 mb-2">{amount ? `${amount.toLocaleString()}원` : '후원 완료'}</p>
          <p className="text-gray-600 mb-8">후원해주셔서 감사합니다. 팩트파인더가 더 좋은 기사로 보답하겠습니다.</p>
        </>
      ) : (
        <>
          <p className="text-xl font-bold text-gray-900 mb-2">후원이 완료되지 않았습니다</p>
          <p className="text-gray-500 text-sm mb-8">{searchParams.message || '결제가 취소되었거나 처리 중 문제가 발생했습니다.'}</p>
        </>
      )}
      <div className="flex justify-center gap-2">
        <a href="/" className="text-sm border border-gray-200 rounded-lg px-4 py-2 text-gray-700">
          홈으로
        </a>
        {!ok && (
          <a href="/donate" className="text-sm rounded-lg px-4 py-2 text-white bg-brand font-semibold">
            다시 후원하기
          </a>
        )}
      </div>
    </main>
  );
}
