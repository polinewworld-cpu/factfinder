'use client';

import { useEffect, useRef, useState } from 'react';

// 옛 기사 사진 옮기기 (2026-10-08) — 버튼 하나로 서버가 옛 다다미디어 서버의 사진을 우리 저장소로 옮기고 기사 주소를 바꿈.
// 도메인 전환 전에 한 번만 실행. 중간에 창을 닫아도 다시 누르면 남은 것부터 이어서 함.
export default function LegacyImagesPage() {
  const [me, setMe] = useState<any>('loading');
  const [status, setStatus] = useState<{ remaining: number; total: number } | null>(null);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ articles: 0, moved: 0, failed: 0 });
  const [error, setError] = useState('');
  const stopRef = useRef(false);

  async function refresh() {
    const res = await fetch('/api/admin/legacy-images');
    if (res.ok) setStatus(await res.json());
  }

  useEffect(() => {
    fetch('/api/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((m) => {
        setMe(m);
        if (m?.role === 'CHIEF_EDITOR') refresh();
      })
      .catch(() => setMe(null));
  }, []);

  async function start() {
    setRunning(true);
    setError('');
    stopRef.current = false;
    let after = 0;
    let fails = 0;
    while (!stopRef.current) {
      const res = await fetch('/api/admin/legacy-images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ after }),
      }).catch(() => null);
      if (!res || !res.ok) {
        // 일시적인 끊김은 몇 번 재시도
        if (++fails >= 5) {
          setError('서버 응답이 계속 실패해 멈췄습니다. 잠시 후 다시 눌러주세요(이어서 진행됩니다).');
          break;
        }
        await new Promise((r) => setTimeout(r, 3000));
        continue;
      }
      fails = 0;
      const r = await res.json();
      setProgress((p) => ({ articles: p.articles + r.processed, moved: p.moved + r.moved, failed: p.failed + r.failed }));
      if (r.done || r.next == null) break;
      after = r.next;
    }
    await refresh();
    setRunning(false);
  }

  if (me === 'loading') return <main className="max-w-xl mx-auto px-4 py-10 text-gray-500">불러오는 중…</main>;
  if (!me || me.role !== 'CHIEF_EDITOR') {
    return (
      <main className="max-w-xl mx-auto px-4 py-10">
        <p className="text-gray-600">편집장만 접근할 수 있습니다.</p>
      </main>
    );
  }

  const done = status && status.remaining === 0;
  const totalWithOld = status ? status.remaining + progress.articles : 0;
  const pct = running && totalWithOld ? Math.min(100, Math.round((progress.articles / Math.max(totalWithOld, 1)) * 100)) : done ? 100 : 0;

  return (
    <main className="max-w-xl mx-auto px-4 py-10">
      <h1 className="text-xl font-bold text-gray-900 mb-2">옛 기사 사진 옮기기</h1>
      <p className="text-sm text-gray-500 mb-6">
        옛 기사 사진을 다다미디어 서버에서 팩트파인더 저장소로 옮깁니다. <b>도메인 전환 전에 한 번만</b> 누르면 됩니다.
        창을 닫거나 끊겨도 다시 누르면 남은 것부터 이어서 합니다.
      </p>

      <div className="border border-gray-200 rounded-xl p-5 mb-4">
        <p className="text-sm text-gray-500 mb-1">사진을 아직 옛 서버에 둔 기사</p>
        <p className="text-3xl font-bold text-gray-900 mb-3">
          {status ? `${status.remaining.toLocaleString()}건` : '…'}
          {status && <span className="text-base font-normal text-gray-400"> / 옛 기사 {status.total.toLocaleString()}건</span>}
        </p>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-3">
          <div className="h-full bg-brand transition-all" style={{ width: `${pct}%` }} />
        </div>
        {(running || progress.articles > 0) && (
          <p className="text-sm text-gray-600">
            이번에 처리한 기사 {progress.articles.toLocaleString()}건 · 옮긴 사진 {progress.moved.toLocaleString()}장
            {progress.failed > 0 && <span className="text-gray-400"> · 옛 서버에도 없는 사진 {progress.failed}장</span>}
          </p>
        )}
      </div>

      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
      {done && !running ? (
        <p className="text-sm font-semibold text-brand">✅ 모든 옛 기사 사진을 옮겼습니다.</p>
      ) : running ? (
        <button
          type="button"
          onClick={() => (stopRef.current = true)}
          className="w-full border border-gray-300 rounded-lg py-3 text-sm font-semibold text-gray-700"
        >
          옮기는 중… (멈추기)
        </button>
      ) : (
        <button type="button" onClick={start} className="w-full rounded-lg py-3 text-sm font-bold text-white bg-brand">
          옛 사진 옮기기 시작
        </button>
      )}
    </main>
  );
}
