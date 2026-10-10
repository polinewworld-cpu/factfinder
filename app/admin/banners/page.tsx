'use client';

import AdminTabs, { AD_TABS } from '@/components/AdminTabs';
import { useEffect, useState } from 'react';

type Banner = {
  id: string;
  placement: string;
  imageUrl: string;
  linkUrl: string;
  videoUrl?: string | null;
  ctaLabel?: string | null;
  order: number;
  active: boolean;
};

// 배너 영상 설정 (2026-10-10) — 영상 주소가 있으면 배너를 누를 때 어두운 화면 위로 영상 + 아래 버튼(링크 = 배너 링크)
function VideoFields({ banner, onSaved }: { banner: Banner; onSaved: () => void }) {
  const [videoUrl, setVideoUrl] = useState(banner.videoUrl ?? '');
  const [ctaLabel, setCtaLabel] = useState(banner.ctaLabel ?? '');
  const [msg, setMsg] = useState('');
  const changed = videoUrl !== (banner.videoUrl ?? '') || ctaLabel !== (banner.ctaLabel ?? '');
  async function save() {
    const res = await fetch(`/api/banners/${banner.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoUrl, ctaLabel }),
    });
    setMsg(res.ok ? '저장했습니다' : '저장 실패');
    if (res.ok) onSaved();
  }
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <input
        value={videoUrl}
        onChange={(e) => setVideoUrl(e.target.value)}
        placeholder="누르면 재생할 영상 — 유튜브 주소 또는 /ads/…mp4 (비우면 바로 링크로)"
        className="flex-1 min-w-[220px] border border-gray-200 rounded-lg px-3 py-1.5 text-xs outline-none focus:border-brand"
      />
      <input
        value={ctaLabel}
        onChange={(e) => setCtaLabel(e.target.value)}
        placeholder="영상 아래 버튼 문구"
        maxLength={40}
        className="w-48 border border-gray-200 rounded-lg px-3 py-1.5 text-xs outline-none focus:border-brand"
      />
      <button type="button" disabled={!changed} onClick={save} className="text-xs border border-gray-300 rounded-lg px-3 py-1.5 disabled:opacity-40">
        영상 저장
      </button>
      {msg && <span className="text-xs text-brand">{msg}</span>}
    </div>
  );
}

const HOMEPAGE_SLOTS: { placement: string; label: string }[] = [
  { placement: 'HOMEPAGE_3', label: '메인화면 3번째 카드' },
  { placement: 'HOMEPAGE_5', label: '메인화면 5번째 카드' },
  { placement: 'HOMEPAGE_7', label: '메인화면 7번째 카드' },
];

// 배너(광고) 관리 — 메인화면 3/5/7번째 카드 슬롯 + 기사 본문 삽입 광고 개수 (기능정의서 5)
export default function BannersAdminPage() {
  const [me, setMe] = useState<any>('loading');
  const [banners, setBanners] = useState<Banner[]>([]);
  const [articleBannerCount, setArticleBannerCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // 슬롯별 편집 중인 입력값
  const [drafts, setDrafts] = useState<Record<string, { imageUrl: string; linkUrl: string }>>({});
  const [newArticleBanner, setNewArticleBanner] = useState({ imageUrl: '', linkUrl: '' });

  async function load() {
    const [bannersRes, configRes] = await Promise.all([fetch('/api/banners'), fetch('/api/site-config')]);
    if (bannersRes.ok) setBanners(await bannersRes.json());
    if (configRes.ok) setArticleBannerCount((await configRes.json()).articleBannerCount);
  }

  useEffect(() => {
    (async () => {
      const meRes = await fetch('/api/me');
      const meData = meRes.ok ? await meRes.json() : null;
      setMe(meData);
      if (meData?.role === 'CHIEF_EDITOR') await load();
    })();
  }, []);

  function draftFor(placement: string) {
    return drafts[placement] ?? { imageUrl: '', linkUrl: '' };
  }

  async function uploadFile(file: File): Promise<string | null> {
    const form = new FormData();
    form.append('file', file);
    const res = await fetch('/api/upload', { method: 'POST', body: form });
    const data = await res.json();
    if (!res.ok) {
      setErrorMsg(data.error ?? '업로드 실패');
      return null;
    }
    return data.url as string;
  }

  async function handleSlotImage(placement: string, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = await uploadFile(file);
    if (url) setDrafts((prev) => ({ ...prev, [placement]: { ...draftFor(placement), imageUrl: url } }));
  }

  async function saveSlot(placement: string) {
    const draft = draftFor(placement);
    if (!draft.imageUrl || !draft.linkUrl.trim()) {
      setErrorMsg('이미지와 링크를 모두 입력해주세요.');
      return;
    }
    setBusy(true);
    setErrorMsg('');
    await fetch('/api/banners', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ placement, imageUrl: draft.imageUrl, linkUrl: draft.linkUrl.trim(), active: true }),
    });
    setDrafts((prev) => ({ ...prev, [placement]: { imageUrl: '', linkUrl: '' } }));
    await load();
    setBusy(false);
  }

  async function toggleActive(banner: Banner) {
    setBusy(true);
    await fetch(`/api/banners/${banner.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !banner.active }),
    });
    await load();
    setBusy(false);
  }

  async function deleteBanner(id: string) {
    if (!confirm('이 배너를 삭제할까요?')) return;
    setBusy(true);
    await fetch(`/api/banners/${id}`, { method: 'DELETE' });
    await load();
    setBusy(false);
  }

  async function addArticleBanner() {
    if (!newArticleBanner.imageUrl || !newArticleBanner.linkUrl.trim()) {
      setErrorMsg('이미지와 링크를 모두 입력해주세요.');
      return;
    }
    setBusy(true);
    setErrorMsg('');
    await fetch('/api/banners', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        placement: 'ARTICLE_BODY',
        imageUrl: newArticleBanner.imageUrl,
        linkUrl: newArticleBanner.linkUrl.trim(),
        active: true,
      }),
    });
    setNewArticleBanner({ imageUrl: '', linkUrl: '' });
    await load();
    setBusy(false);
  }

  async function saveArticleBannerCount(count: number) {
    setArticleBannerCount(count);
    await fetch('/api/site-config', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ articleBannerCount: count }),
    });
  }

  if (me === 'loading') return <main className="max-w-3xl mx-auto px-4 py-10 text-gray-500">불러오는 중…</main>;
  if (!me || me.role !== 'CHIEF_EDITOR') {
    return (
      <main className="max-w-3xl mx-auto px-4 py-10">
        <p className="text-gray-600">편집장만 접근할 수 있습니다.</p>
      </main>
    );
  }

  const articleBanners = banners.filter((b) => b.placement === 'ARTICLE_BODY');

  return (
    <main className="max-w-3xl mx-auto px-4 py-8">
      <AdminTabs title="광고 관리" tabs={AD_TABS} />
      <p className="text-sm text-gray-500 mb-6">메인화면 그리드의 3번째·5번째·7번째 카드 자리가 광고 슬롯입니다.</p>
      {errorMsg && <p className="text-red-600 text-sm mb-4">{errorMsg}</p>}

      <div className="space-y-4 mb-10">
        {HOMEPAGE_SLOTS.map((slot) => {
          const current = banners.find((b) => b.placement === slot.placement && b.active);
          const draft = draftFor(slot.placement);
          return (
            <div key={slot.placement} className="border border-gray-200 rounded-xl p-4">
              <p className="text-sm font-bold text-gray-900 mb-2">{slot.label}</p>
              {current ? (
                <div className="flex items-center gap-3 mb-3">
                  <img src={current.imageUrl} alt="" className="w-24 h-16 object-cover rounded-lg border border-gray-200" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-500 truncate">{current.linkUrl}</p>
                  </div>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => toggleActive(current)}
                    className="text-xs text-gray-500 border border-gray-200 rounded-lg px-3 py-1 hover:border-gray-400"
                  >
                    끄기
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => deleteBanner(current.id)}
                    className="text-xs text-red-500 border border-red-200 rounded-lg px-3 py-1 hover:bg-red-50"
                  >
                    삭제
                  </button>
                </div>
              ) : (
                <p className="text-xs text-gray-400 mb-3">현재 등록된 배너가 없습니다 (일반 기사 카드가 노출됩니다).</p>
              )}
              {current && <div className="mb-3 -mt-1"><VideoFields key={current.id} banner={current} onSaved={load} /></div>}

              <div className="flex flex-wrap items-center gap-2">
                <label className="text-xs text-gray-600 cursor-pointer">
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => handleSlotImage(slot.placement, e)} />
                  <span className="border border-gray-200 rounded-lg px-3 py-1.5 hover:border-brand inline-block">
                    {draft.imageUrl ? '이미지 선택됨 ✓' : '새 이미지 업로드'}
                  </span>
                </label>
                <input
                  value={draft.linkUrl}
                  onChange={(e) => setDrafts((prev) => ({ ...prev, [slot.placement]: { ...draft, linkUrl: e.target.value } }))}
                  placeholder="https://..."
                  className="flex-1 min-w-[160px] border border-gray-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-brand"
                />
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => saveSlot(slot.placement)}
                  className="text-xs font-bold text-white bg-brand rounded-lg px-4 py-1.5 disabled:opacity-50"
                >
                  등록
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="border-t border-gray-200 pt-6">
        <h2 className="text-sm font-bold text-gray-900 mb-2">기사 본문 삽입 광고</h2>
        <p className="text-xs text-gray-500 mb-3">
          기사 상세 페이지 본문 사이사이에 노출할 광고 개수를 정하고, 노출할 배너를 등록합니다. (최대 3개)
        </p>

        <div className="flex items-center gap-2 mb-4">
          <span className="text-xs text-gray-500">노출 개수</span>
          <select
            value={articleBannerCount}
            onChange={(e) => saveArticleBannerCount(Number(e.target.value))}
            className="border border-gray-200 rounded-lg px-2 py-1 text-xs"
          >
            {[0, 1, 2, 3].map((n) => (
              <option key={n} value={n}>
                {n}개
              </option>
            ))}
          </select>
        </div>

        <ul className="space-y-2 mb-4">
          {articleBanners.map((b) => (
            <li key={b.id} className="border border-gray-200 rounded-xl p-3">
              <div className="flex items-center gap-3">
              <img src={b.imageUrl} alt="" className="w-20 h-14 object-cover rounded-lg border border-gray-200" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-500 truncate">{b.linkUrl}</p>
                <p className="text-xs text-gray-400">{b.active ? '노출중' : '꺼짐'}</p>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => toggleActive(b)}
                className="text-xs text-gray-500 border border-gray-200 rounded-lg px-3 py-1 hover:border-gray-400"
              >
                {b.active ? '끄기' : '켜기'}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => deleteBanner(b.id)}
                className="text-xs text-red-500 border border-red-200 rounded-lg px-3 py-1 hover:bg-red-50"
              >
                삭제
              </button>
              </div>
              <VideoFields key={b.id} banner={b} onSaved={load} />
            </li>
          ))}
          {articleBanners.length === 0 && <p className="text-xs text-gray-400">등록된 본문 광고가 없습니다.</p>}
        </ul>

        <div className="flex flex-wrap items-center gap-2">
          <label className="text-xs text-gray-600 cursor-pointer">
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const url = await uploadFile(file);
                if (url) setNewArticleBanner((prev) => ({ ...prev, imageUrl: url }));
              }}
            />
            <span className="border border-gray-200 rounded-lg px-3 py-1.5 hover:border-brand inline-block">
              {newArticleBanner.imageUrl ? '이미지 선택됨 ✓' : '새 이미지 업로드'}
            </span>
          </label>
          <input
            value={newArticleBanner.linkUrl}
            onChange={(e) => setNewArticleBanner((prev) => ({ ...prev, linkUrl: e.target.value }))}
            placeholder="https://..."
            className="flex-1 min-w-[160px] border border-gray-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-brand"
          />
          <button
            type="button"
            disabled={busy}
            onClick={addArticleBanner}
            className="text-xs font-bold text-white bg-brand rounded-lg px-4 py-1.5 disabled:opacity-50"
          >
            추가
          </button>
        </div>
      </div>
    </main>
  );
}
