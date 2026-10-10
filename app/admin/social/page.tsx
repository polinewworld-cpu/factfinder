'use client';

import { useEffect, useState } from 'react';

type Ch = { key: string; label: string; ready: boolean; enabled: boolean; env: string[] };
type Res = { ok: boolean; id?: string; error?: string; tries: number };
type Kit = { id: string; title: string; text: string; image: string | null };
type Log = { articleId: string; title: string; result: Record<string, Res>; at: string };

// 관리자 "SNS 자동 게시" — 기사가 발행되면 켜 둔 채널에 제목·요약·링크가 자동으로 올라감 (lib/socialPost.ts)
export default function SocialAdminPage() {
  const [chs, setChs] = useState<Ch[]>([]);
  const [log, setLog] = useState<Log[]>([]);
  const [kits, setKits] = useState<Kit[]>([]);
  const [copied, setCopied] = useState('');
  const [err, setErr] = useState('');

  async function load() {
    const res = await fetch('/api/admin/social');
    const d = await res.json().catch(() => ({}));
    if (!res.ok) return setErr(d.error ?? '불러오지 못했습니다');
    setChs(d.channels);
    setLog(d.log);
    setKits(d.youtube ?? []);
  }
  useEffect(() => {
    load();
  }, []);

  async function toggle(c: Ch) {
    await fetch('/api/admin/social', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ [c.key]: !c.enabled }) });
    load();
  }

  async function copy(k: Kit) {
    try {
      await navigator.clipboard.writeText(k.text);
      setCopied(k.id);
      setTimeout(() => setCopied(''), 2000);
    } catch {
      setErr('복사하지 못했습니다. 글을 직접 선택해 복사해 주세요');
    }
  }

  return (
    <main className="py-8 space-y-4">
      <h1 className="text-xl font-bold">SNS 자동 게시</h1>
      <p className="text-sm text-gray-900/70">기사가 발행되면 켜 둔 곳에 제목·요약·링크가 자동으로 올라갑니다(발행 후 최대 10분 안). 켜기 전에 나간 기사는 올리지 않아요.</p>
      {err && <p className="text-sm text-red-600">{err}</p>}
      <div className="grid gap-3 md:grid-cols-3">
        {chs.map((c) => (
          <section key={c.key} className="border rounded-xl p-4">
            <h2 className="font-bold text-base mb-1">{c.label}</h2>
            {c.ready ? (
              <p className="text-sm mb-3">연결됨</p>
            ) : (
              <p className="text-sm mb-3 text-amber-700">아직 연결 안 됨 — Render 환경변수 필요:<br />{c.env.join(', ')}</p>
            )}
            <button type="button" onClick={() => toggle(c)} disabled={!c.ready} className="border rounded-lg px-3 py-1.5 text-sm font-semibold disabled:opacity-40">
              {c.enabled ? '자동 게시 끄기' : '자동 게시 켜기'}
            </button>
            <span className="ml-2 text-sm">{c.enabled ? '켜짐' : '꺼짐'}</span>
          </section>
        ))}
      </div>
      <section className="border rounded-xl p-4">
        <h2 className="font-bold text-base mb-1">유튜브 게시물 복사 도우미</h2>
        <p className="text-sm text-gray-900/70 mb-3">유튜브 커뮤니티 글은 자동 게시가 안 돼요. 문구를 복사해 유튜브 스튜디오 → 만들기 → 게시물에 붙여 넣고, 사진은 "사진 열기"로 받아 올리세요.</p>
        {kits.length === 0 && <p className="text-sm text-gray-900/60">발행된 기사가 아직 없습니다.</p>}
        <ul className="space-y-3">
          {kits.map((k) => (
            <li key={k.id} className="border rounded-lg p-3">
              <p className="font-semibold text-sm mb-1">{k.title}</p>
              <pre className="whitespace-pre-wrap text-xs text-gray-900/80 mb-2 font-sans">{k.text}</pre>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => copy(k)} className="border rounded-lg px-3 py-1 text-sm font-semibold">
                  {copied === k.id ? '✓ 복사됨' : '문구 복사'}
                </button>
                {k.image ? (
                  <a href={k.image} target="_blank" rel="noopener noreferrer" className="border rounded-lg px-3 py-1 text-sm font-semibold">
                    사진 열기 ↗
                  </a>
                ) : (
                  <span className="text-xs text-gray-900/50 self-center">대표 사진 없음</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>
      <section className="border rounded-xl p-4">
        <h2 className="font-bold text-base mb-2">최근 게시 기록</h2>
        {log.length === 0 && <p className="text-sm text-gray-900/60">아직 없습니다.</p>}
        <ul className="space-y-2">
          {log.map((l) => (
            <li key={l.articleId} className="text-sm">
              <a href={`/article/${l.articleId}`} className="font-semibold underline">{l.title}</a>
              <div className="text-xs text-gray-900/70">
                {Object.entries(l.result).map(([k, r]) => (
                  <span key={k} className="mr-3">{k}: {r.ok ? '✓ 올림' : `✗ ${r.error ?? '실패'} (${r.tries}회)`}</span>
                ))}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
