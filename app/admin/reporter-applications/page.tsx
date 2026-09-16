'use client';

import { useEffect, useState } from 'react';
import { detectSnsPlatform, SNS_PLATFORM_LABELS } from '@/lib/sns';

type Applicant = {
  id: string;
  name: string;
  email: string;
  nickname: string | null;
  bio: string | null;
  image: string | null;
  snsLinks: { url: string }[];
};

export default function ReporterApplicationsPage() {
  const [me, setMe] = useState<any>('loading');
  const [items, setItems] = useState<Applicant[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    const res = await fetch('/api/reporter-applications');
    if (res.ok) setItems(await res.json());
  }

  useEffect(() => {
    (async () => {
      const meRes = await fetch('/api/me');
      const meData = meRes.ok ? await meRes.json() : null;
      setMe(meData);
      if (meData?.role === 'CHIEF_EDITOR') await load();
    })();
  }, []);

  async function act(id: string, action: 'approve' | 'reject') {
    setBusyId(id);
    await fetch(`/api/reporter-applications/${id}/${action}`, { method: 'POST' });
    setItems((prev) => prev.filter((a) => a.id !== id));
    setBusyId(null);
  }

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
      <h1 className="text-xl font-bold text-gray-900 mb-6">기자 신청 대기함 ({items.length})</h1>
      {items.length === 0 && <p className="text-gray-400 text-sm">기자 신청 대기 중인 회원이 없습니다.</p>}
      <ul className="space-y-3">
        {items.map((a) => (
          <li key={a.id} className="border border-gray-200 rounded-xl p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-gray-100 overflow-hidden flex items-center justify-center text-gray-300 text-xs shrink-0">
                  {a.image ? <img src={a.image} alt="" className="w-full h-full object-cover" /> : '사진'}
                </div>
                <div>
                  <p className="font-semibold text-gray-900">
                    {a.nickname ?? a.name} <span className="text-gray-400 text-xs font-normal">({a.email})</span>
                  </p>
                  {a.bio && <p className="text-xs text-gray-500 mt-1 max-w-md">{a.bio}</p>}
                  {a.snsLinks.length > 0 && (
                    <p className="text-xs text-gray-400 mt-1">
                      {a.snsLinks
                        .map((l) => SNS_PLATFORM_LABELS[detectSnsPlatform(l.url)])
                        .join(', ')}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  disabled={busyId === a.id}
                  onClick={() => act(a.id, 'reject')}
                  className="text-sm text-gray-500 border border-gray-200 rounded-full px-4 py-1.5 hover:border-gray-400"
                >
                  반려
                </button>
                <button
                  disabled={busyId === a.id}
                  onClick={() => act(a.id, 'approve')}
                  className="text-sm font-bold text-white bg-brand rounded-full px-4 py-1.5 hover:bg-brand-dark"
                >
                  승인
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
