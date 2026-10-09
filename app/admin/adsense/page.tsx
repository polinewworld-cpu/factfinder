'use client';

import { useEffect, useState } from 'react';
import AdminTabs, { AD_TABS } from '@/components/AdminTabs';

// 광고 관리 → 애드센스 탭 (2026-10-09) — 자동광고 켜기/끄기, 화면 종류별 노출.
// 광고 개수·밀도(광고 로드)는 애드센스 사이트에서만 바꿀 수 있어 바로가기만 둔다.
const PUB_ID = 'pub-1922059581667762';
const AUTO_ADS_URL = `https://adsense.google.com/adsense/u/0/${PUB_ID}/myads/auto-ads`;

type Config = { adsenseEnabled: boolean; adsenseOnHome: boolean; adsenseOnArticle: boolean; adsenseOnOther: boolean };

export default function AdSenseAdminPage() {
  const [config, setConfig] = useState<Config | null>(null);
  const [saved, setSaved] = useState<Config | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetch('/api/site-config')
      .then((r) => r.json())
      .then((c) => {
        const v = { adsenseEnabled: c.adsenseEnabled, adsenseOnHome: c.adsenseOnHome, adsenseOnArticle: c.adsenseOnArticle, adsenseOnOther: c.adsenseOnOther };
        setConfig(v);
        setSaved(v);
      });
  }, []);

  async function save() {
    if (!config) return;
    setBusy(true);
    setMessage('');
    const res = await fetch('/api/site-config', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(config) });
    setBusy(false);
    if (res.ok) {
      setSaved(config);
      setMessage('저장했습니다. 새로 들어오는 방문자부터 적용됩니다.');
    } else {
      setMessage((await res.json().catch(() => ({}))).error ?? '저장에 실패했습니다.');
    }
  }

  const dirty = JSON.stringify(config) !== JSON.stringify(saved);
  const set = (k: keyof Config, v: boolean) => setConfig((c) => (c ? { ...c, [k]: v } : c));

  return (
    <main className="max-w-3xl mx-auto px-4 py-8">
      <AdminTabs title="광고 관리" tabs={AD_TABS} />

      {!config ? (
        <p className="text-sm text-gray-400">불러오는 중…</p>
      ) : (
        <div className="space-y-6">
          <section className="border rounded-xl p-4">
            <label className="flex items-center gap-3 text-base font-semibold">
              <input type="checkbox" className="w-5 h-5" checked={config.adsenseEnabled} onChange={(e) => set('adsenseEnabled', e.target.checked)} />
              애드센스 자동광고 켜기
            </label>
            <p className="text-xs text-gray-500 mt-2 ml-8">끄면 사이트 어디에도 애드센스 광고가 나오지 않습니다. (배너·줄광고는 그대로)</p>
          </section>

          <section className={`border rounded-xl p-4 ${config.adsenseEnabled ? '' : 'opacity-40 pointer-events-none'}`}>
            <p className="text-sm font-semibold mb-3">광고가 나올 화면</p>
            <div className="space-y-2 text-sm">
              {(
                [
                  ['adsenseOnHome', '홈·카테고리 목록'],
                  ['adsenseOnArticle', '기사 화면'],
                  ['adsenseOnOther', '그 밖의 화면 (검색·회사소개·후원 등)'],
                ] as const
              ).map(([k, label]) => (
                <label key={k} className="flex items-center gap-3">
                  <input type="checkbox" className="w-4 h-4" checked={config[k]} onChange={(e) => set(k, e.target.checked)} />
                  {label}
                </label>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-3">관리자·기사 작성 화면에는 원래 나오지 않습니다.</p>
          </section>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={save}
              disabled={busy || !dirty}
              className="text-sm font-bold text-white bg-brand rounded-lg px-6 py-2 disabled:opacity-40"
            >
              {busy ? '저장 중…' : '저장'}
            </button>
            {message && <p className="text-sm text-gray-600">{message}</p>}
          </div>

          <section className="border rounded-xl p-4 text-sm space-y-2">
            <p className="font-semibold">광고 개수(밀도) 줄이기</p>
            <p className="text-gray-600">
              광고가 몇 개 나올지는 애드센스 사이트에서 정합니다. 아래 링크 → 사이트 factfinder.tv 오른쪽 연필(수정) →
              <b> 광고 로드</b> 막대를 왼쪽으로 옮기면 광고가 줄어듭니다. 특정 광고 형식(앵커·전면 광고 등)도 거기서 끌 수 있습니다.
            </p>
            <a href={AUTO_ADS_URL} target="_blank" rel="noopener noreferrer" className="inline-block underline text-brand">
              애드센스 자동광고 설정 열기 ↗
            </a>
            <p className="text-xs text-gray-500">
              &quot;액세스가 거부되었습니다&quot;가 뜨면 브라우저에 로그인된 다른 구글 계정으로 열린 것입니다. 오른쪽 위 프로필에서 <b>polinewworld@gmail.com</b>으로 바꾸세요 (관리 권한 있음).
            </p>
            <p className="text-xs text-gray-400">게시자 ID: ca-{PUB_ID} · 광고는 factfinder.tv 주소에서만 나오고, 지금 테스트 주소(onrender.com)에서는 나오지 않습니다.</p>
          </section>
        </div>
      )}
    </main>
  );
}
