'use client';

import { useEffect, useState } from 'react';

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: '후원중',
  CANCELLED: '해지',
};

// 전체 후원리스트 — 대시보드 "후원" 숫자에서 진입 (기자별 정산·집계 화면인 /admin/settlement 와는 별개, 2026-09-11 신설)
export default function DonationsAdminPage() {
  const [me, setMe] = useState<any>('loading');
  const [donations, setDonations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const meRes = await fetch('/api/me');
      const meData = meRes.ok ? await meRes.json() : null;
      setMe(meData);
      if (meData?.role === 'CHIEF_EDITOR') {
        const res = await fetch('/api/admin/donations');
        if (res.ok) setDonations(await res.json());
      }
      setLoading(false);
    })();
  }, []);

  if (me === 'loading') return <main className="max-w-3xl mx-auto px-4 py-10 text-gray-500">불러오는 중…</main>;
  if (!me || me.role !== 'CHIEF_EDITOR') {
    return (
      <main className="max-w-3xl mx-auto px-4 py-10">
        <p className="text-gray-600">편집장만 접근할 수 있습니다.</p>
      </main>
    );
  }

  return (
    <main className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-xl font-bold text-gray-900 mb-6">전체 후원리스트 ({donations.length})</h1>
      {loading ? (
        <p className="text-sm text-gray-400">불러오는 중…</p>
      ) : donations.length === 0 ? (
        <p className="text-sm text-gray-400">후원 내역이 없습니다.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-left text-gray-400 border-b border-gray-200">
                <th className="py-2 pr-4">후원자</th>
                <th className="py-2 pr-4">연락처</th>
                <th className="py-2 pr-4">지정 기자</th>
                <th className="py-2 pr-4">금액</th>
                <th className="py-2 pr-4">상태</th>
                <th className="py-2 pr-4">정산여부</th>
                <th className="py-2">시작일</th>
              </tr>
            </thead>
            <tbody>
              {donations.map((d) => (
                <tr key={d.id} className="border-b border-gray-100">
                  <td className="py-2 pr-4 text-gray-900 font-medium">
                    <div className="flex items-center gap-2">
                      {d.user?.image ? (
                        <img src={d.user.image} alt="" className="w-7 h-7 rounded-full object-cover shrink-0" />
                      ) : (
                        <span className="w-7 h-7 rounded-full bg-gray-200 shrink-0" />
                      )}
                      <span>
                        {d.user?.nickname ?? d.user?.name ?? '-'}
                        <span className="block text-xs text-gray-400 font-normal">{d.user?.email}</span>
                      </span>
                    </div>
                  </td>
                  <td className="py-2 pr-4 text-gray-600">{d.phone ?? '-'}</td>
                  <td className="py-2 pr-4 text-gray-600">{d.reporter?.name ?? '미지정'}</td>
                  <td className="py-2 pr-4 font-semibold text-gray-900">{d.amount.toLocaleString()}원</td>
                  <td className="py-2 pr-4 text-gray-600">{STATUS_LABELS[d.status] ?? d.status}</td>
                  <td className="py-2 pr-4 text-gray-600">{d.settled ? '정산완료' : '미정산'}</td>
                  <td className="py-2 text-gray-500">{new Date(d.startedAt).toLocaleDateString('ko-KR')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
