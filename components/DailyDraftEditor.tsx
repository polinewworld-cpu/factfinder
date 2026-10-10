'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { DailyDraft, PersonaDraft } from '@/lib/dailyNewsletter';

// 일간 아침 브리핑 초안 편집기 (2026-10-10) — 초안 만들기 → 문장 고치기 → 미리보기 → 나에게 테스트 발송.
// 글 속 링크는 [구절](주소) 모양으로 들어 있다 — 링크를 살리려면 이 모양을 그대로 두고 문장만 고치면 된다.
type Loaded = { date: string; draft: DailyDraft | null; articles: { id: string; title: string }[]; job: { state: string; skipped?: boolean; note?: string; message?: string } | null };

const SOURCE_LABEL: Record<string, string> = { video: '영상 분석', description: '설명란', none: '요약 없음' };
const today = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);

function Area({ label, value, onChange, rows = 3 }: { label: string; value: string; onChange: (v: string) => void; rows?: number }) {
  return (
    <label className="block mb-3">
      <span className="block text-xs font-semibold text-gray-500 mb-1">{label}</span>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={rows} className="w-full border rounded-lg px-3 py-2 text-sm leading-relaxed" />
    </label>
  );
}

export default function DailyDraftEditor({ gmailConnected }: { gmailConnected: boolean }) {
  const [date, setDate] = useState(today());
  const [data, setData] = useState<Loaded | null>(null);
  const [draft, setDraft] = useState<DailyDraft | null>(null);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<{ subject: string; html: string } | null>(null);
  const alive = useRef(true);

  useEffect(() => () => void (alive.current = false), []);

  const load = useCallback(async (d: string) => {
    const r: Loaded | null = await fetch(`/api/newsletter/daily-draft?date=${d}`).then((x) => (x.ok ? x.json() : null)).catch(() => null);
    if (!alive.current || !r) return null;
    setData(r);
    setDraft(r.draft);
    return r;
  }, []);

  useEffect(() => {
    setPreview(null);
    setMsg('');
    load(date);
  }, [date, load]);

  async function build() {
    setBusy(true);
    setPreview(null);
    setMsg('초안을 만들고 있어요. 방송 내용을 요약하느라 몇 분 걸릴 수 있습니다. 이 화면을 열어 두세요…');
    try {
      const start = await fetch('/api/newsletter/daily-draft', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ date }) });
      if (!start.ok) throw new Error((await start.json().catch(() => ({}))).error ?? '시작하지 못했습니다');
      for (let i = 0; i < 180 && alive.current; i++) {
        await new Promise((r) => setTimeout(r, 4000));
        const r = await load(date);
        const j = r?.job;
        if (!j || j.state === 'running') continue;
        if (j.state === 'error') setMsg(`실패: ${j.message ?? '알 수 없는 오류'}`);
        else if (j.skipped) setMsg(`${j.note} (방송이 있던 날의 다음 날짜를 골라 다시 만들어 보세요)`);
        else setMsg('초안이 만들어졌어요. 아래에서 문장을 고쳐 보세요.');
        setBusy(false);
        return;
      }
      setMsg('아직 끝나지 않았어요. 잠시 뒤 이 화면을 다시 열어 보세요.');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : '초안을 만들지 못했습니다');
    }
    setBusy(false);
  }

  async function post(path: string, method = 'POST') {
    const res = await fetch(path, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ draft }) });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(d.error ?? '요청에 실패했습니다');
    return d;
  }

  async function save() {
    setBusy(true);
    try {
      const d = await post('/api/newsletter/daily-draft', 'PUT');
      setDraft(d.draft);
      setMsg('저장했습니다.');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : '저장 실패');
    }
    setBusy(false);
  }

  async function showPreview() {
    setBusy(true);
    try {
      setPreview(await post('/api/newsletter/daily-draft/preview'));
      setMsg('');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : '미리보기 실패');
    }
    setBusy(false);
  }

  async function sendTest() {
    setBusy(true);
    setMsg('보내는 중…');
    try {
      const d = await post('/api/newsletter/daily-draft/test');
      setMsg(`${d.to}로 테스트 메일을 보냈습니다. 받은편지함(또는 스팸함)을 확인하세요. (초안도 저장됐어요)`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : '테스트 발송 실패');
    }
    setBusy(false);
  }

  const setPersona = (k: 'oh' | 'kim', patch: Partial<PersonaDraft>) => setDraft((d) => (d && d[k] ? { ...d, [k]: { ...d[k]!, ...patch } } : d));
  const linesOf = (t: string) => t.split('\n');

  const persona = (k: 'oh' | 'kim', title: string) => {
    const p = draft?.[k];
    if (!draft || !p) return null;
    return (
      <div className="border rounded-lg p-3 mb-3">
        <h3 className="text-sm font-bold mb-2">{title}</h3>
        <Area label="인사 문단" value={p.intro} onChange={(v) => setPersona(k, { intro: v })} />
        {draft.full && (
          <>
            <Area label="이슈 줄들 (한 줄에 하나)" value={p.lines.join('\n')} onChange={(v) => setPersona(k, { lines: linesOf(v) })} rows={6} />
            <Area label="마무리 인사" value={p.closing} onChange={(v) => setPersona(k, { closing: v })} rows={2} />
          </>
        )}
      </div>
    );
  };

  return (
    <section className="border rounded-xl p-4 mb-6">
      <h2 className="text-sm font-semibold mb-1">일간 아침 브리핑 초안 (정치신세계 어제 방송)</h2>
      <p className="text-xs text-gray-500 mb-3">
        평일 아침 8시 기준 · 오진실 기자·김정신 특파원 → 정치신세계 어제 방송 → 어제 기사 순서입니다. 방송이 없던 날은 건너뜁니다. 초안을 만든 뒤 문장을 고치고 테스트로 받아 보세요. 아직 구독자에게는 나가지 않습니다.
      </p>
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <label className="text-xs text-gray-500">
          기준 날짜
          <input type="date" value={date} onChange={(e) => setDate(e.target.value || today())} className="ml-1 border rounded px-2 py-1 text-sm" />
        </label>
        <button type="button" disabled={busy} onClick={build} className="text-sm border rounded-lg px-4 py-2 disabled:opacity-40">
          {draft ? '초안 다시 만들기' : '초안 만들기'}
        </button>
        {draft && <span className="text-xs text-gray-400">{new Date(draft.createdAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })} 만듦{!draft.full ? ' · 어제 기사가 있어 기자 인사만 넣었어요' : ' · 어제 기사가 없어 기자 브리핑 전체를 넣었어요'}</span>}
      </div>
      {msg && <p className="text-sm text-brand mb-3">{msg}</p>}

      {draft && (
        <div className="mt-3">
          <p className="text-xs text-gray-400 mb-3">링크는 <code>[구절](주소)</code> 모양으로 들어 있어요. 그 모양을 그대로 두고 문장만 고치면 링크가 살아 있습니다.</p>
          <Area label="맨 위 인사" value={draft.greeting} onChange={(v) => setDraft({ ...draft, greeting: v })} rows={2} />
          {persona('oh', '오진실 기자의 아침 한마디')}
          {persona('kim', '김정신 특파원의 해외 소식')}

          {draft.casts.map((c, i) => (
            <div key={c.youtubeId} className="border rounded-lg p-3 mb-3">
              <label className="flex items-center gap-2 text-sm font-bold mb-2">
                <input type="checkbox" checked={c.include} onChange={(e) => setDraft({ ...draft, casts: draft.casts.map((x, j) => (j === i ? { ...x, include: e.target.checked } : x)) })} />
                정치신세계 · {c.title} <span className="text-xs font-normal text-gray-400">({c.time} · 요약: {SOURCE_LABEL[c.source]})</span>
              </label>
              <Area label="방송 요약 (한 줄에 하나)" value={c.bullets.join('\n')} onChange={(v) => setDraft({ ...draft, casts: draft.casts.map((x, j) => (j === i ? { ...x, bullets: linesOf(v) } : x)) })} rows={4} />
            </div>
          ))}

          <div className="border rounded-lg p-3 mb-3">
            <h3 className="text-sm font-bold mb-2">어제의 기사 ({draft.articleIds.length}건)</h3>
            {draft.articleIds.length === 0 && <p className="text-xs text-gray-400">어제 발행된 기사가 없어서 기자 브리핑 전체가 들어갑니다.</p>}
            {draft.articleIds.map((id) => (
              <label key={id} className="flex items-center gap-2 text-sm mb-1">
                <input type="checkbox" defaultChecked onChange={(e) => setDraft({ ...draft, articleIds: e.target.checked ? [...draft.articleIds, id] : draft.articleIds.filter((x) => x !== id) })} />
                {data?.articles.find((a) => a.id === id)?.title ?? id}
              </label>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={busy} onClick={save} className="text-sm border rounded-lg px-4 py-2 disabled:opacity-40">저장</button>
            <button type="button" disabled={busy} onClick={showPreview} className="text-sm border rounded-lg px-4 py-2 disabled:opacity-40">미리보기</button>
            <button type="button" disabled={busy || !gmailConnected} onClick={sendTest} className="text-sm border rounded-lg px-4 py-2 bg-white disabled:opacity-40">나에게 테스트 발송</button>
          </div>
        </div>
      )}

      {preview && (
        <div className="mt-4">
          <p className="text-xs text-gray-500 mb-1">제목: {preview.subject}</p>
          <iframe title="메일 미리보기" srcDoc={preview.html} className="w-full border rounded-lg bg-white" style={{ height: 720 }} />
        </div>
      )}
    </section>
  );
}
