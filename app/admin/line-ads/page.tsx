'use client';

import { useEffect, useState } from 'react';

type LineAd = { id: string; text: string; linkUrl: string; order: number; active: boolean };

// 줄광고 관리 — 기사 본문 맨 마지막에 핫핑크 화살표 + 굵은 한 줄 문안으로 노출되는 텍스트형 광고.
// 배너 관리와 달리 이미지 없이 문안(text)+링크만 등록. 화면에는 활성 상태인 것 중 순서(order)대로 최대 10개까지만 노출됨 (2026-09-12 신설)
export default function LineAdsAdminPage() {
  const [me, setMe] = useState<any>('loading');
  const [lineAds, setLineAds] = useState<LineAd[]>([]);
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [newText, setNewText] = useState('');
  const [newLinkUrl, setNewLinkUrl] = useState('');

  async function load() {
    const res = await fetch('/api/line-ads');
    if (res.ok) setLineAds(await res.json());
  }

  useEffect(() => {
    (async () => {
      const meRes = await fetch('/api/me');
      const meData = meRes.ok ? await meRes.json() : null;
      setMe(meData);
      if (meData?.role === 'CHIEF_EDITOR') await load();
    })();
  }, []);

  async function addLineAd() {
    if (!newText.trim() || !newLinkUrl.trim()) {
      setErrorMsg('문안과 링크를 모두 입력해주세요.');
      return;
    }
    setBusy(true);
    setErrorMsg('');
    await fetch('/api/line-ads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: newText.trim(), linkUrl: newLinkUrl.trim(), order: lineAds.length }),
    });
    setNewText('');
    setNewLinkUrl('');
    await load();
    setBusy(false);
  }

  async function updateField(id: string, data: Partial<LineAd>) {
    setBusy(true);
    await fetch(`/api/line-ads/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    await load();
    setBusy(false);
  }

  async function removeLineAd(id: string) {
    if (!confirm('이 줄광고를 삭제할까요?')) return;
    setBusy(true);
    await fetch(`/api/line-ads/${id}`, { method: 'DELETE' });
    await load();
    setBusy(false);
  }

  if (me === 'loading') return <main className="max-w-3xl mx-auto px-4 py-10 text-gray-500">불러오는 중…</main>;
  if (!me || me.role !== 'CHIEF_EDITOR') {
    return (
      <main className="max-w-3xl mx-auto px-4 py-10">
        <p className="text-gray-600">편집장만 접근할 수 있습니다.</p>
      </main>
    );
  }

  const activeCount = lineAds.filter((a) => a.active).length;

  return (
    <main className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-xl font-bold text-gray-900 mb-2">줄광고 관리</h1>
      <p className="text-sm text-gray-500 mb-1">
        기사 본문 맨 마지막에 핫핑크 화살표와 함께 기사제목처럼 굵은 한 줄로 노출되는 텍스트 광고입니다.
      </p>
      <p className="text-xs text-gray-400 mb-6">
        노출중 {activeCount}개 / 최대 10개까지 화면에 노출됩니다(순서가 빠른 것부터). 나머지는 꺼둔 채 대기시켜두세요.
      </p>
      {errorMsg && <p className="text-red-600 text-sm mb-4">{errorMsg}</p>}

      <ul className="space-y-2 mb-6">
        {lineAds.map((ad, i) => (
          <li key={ad.id} className="flex items-center gap-2 border border-gray-200 rounded-xl p-3">
            <input
              type="number"
              value={ad.order}
              onChange={(e) => updateField(ad.id, { order: Number(e.target.value) })}
              className="w-14 border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-center outline-none focus:border-brand"
              title="순서(작을수록 먼저 노출)"
            />
            <div className="flex-1 min-w-0">
              <input
                defaultValue={ad.text}
                onBlur={(e) => e.target.value.trim() !== ad.text && updateField(ad.id, { text: e.target.value.trim() })}
                className="w-full font-semibold text-sm text-gray-900 border-b border-transparent hover:border-gray-200 focus:border-brand outline-none py-0.5"
                placeholder="줄광고 문안"
              />
              <input
                defaultValue={ad.linkUrl}
                onBlur={(e) => e.target.value.trim() !== ad.linkUrl && updateField(ad.id, { linkUrl: e.target.value.trim() })}
                className="w-full text-xs text-gray-400 border-b border-transparent hover:border-gray-200 focus:border-brand outline-none py-0.5"
                placeholder="https://..."
              />
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={() => updateField(ad.id, { active: !ad.active })}
              className="text-xs text-gray-500 border border-gray-200 rounded-full px-3 py-1 hover:border-gray-400 shrink-0"
            >
              {ad.active ? '끄기' : '켜기'}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => removeLineAd(ad.id)}
              className="text-xs text-red-500 border border-red-200 rounded-full px-3 py-1 hover:bg-red-50 shrink-0"
            >
              삭제
            </button>
          </li>
        ))}
        {lineAds.length === 0 && <p className="text-xs text-gray-400">등록된 줄광고가 없습니다.</p>}
      </ul>

      <div className="border-t border-gray-200 pt-4">
        <p className="text-sm font-bold text-gray-900 mb-2">새 줄광고 추가</p>
        <div className="space-y-2">
          <input
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            placeholder="줄광고 문안 (기사제목처럼 노출됩니다)"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-brand"
          />
          <div className="flex gap-2">
            <input
              value={newLinkUrl}
              onChange={(e) => setNewLinkUrl(e.target.value)}
              placeholder="https://..."
              className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-brand"
            />
            <button
              type="button"
              disabled={busy}
              onClick={addLineAd}
              className="text-sm font-bold text-white bg-brand rounded-full px-5 py-2 disabled:opacity-50 shrink-0"
            >
              추가
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
