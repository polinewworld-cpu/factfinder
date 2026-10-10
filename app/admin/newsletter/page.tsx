'use client';

import { useEffect, useRef, useState } from 'react';
import DailyDraftEditor from '@/components/DailyDraftEditor';
import { toFrenchBrackets } from '@/lib/frenchBrackets';

type Item = { id: string; title: string; publishedAt: string | null; category: string | null; author: string | null };
type History = { id: string; sentAt: string; status: string; auto: boolean; recipientCount: number; failedCount: number; subject: string | null; note: string | null };
type Info = {
  articles: Item[];
  defaultIds: string[];
  subscriberCount: number;
  emailConfigured: boolean;
  lastSentAt: string | null;
  gmail: { connected: boolean; sender: string | null };
  auto: { enabled: boolean; week: string; weekLabel: string; skipped: boolean; alreadySent: boolean; ids: string[] };
  history: History[];
};
const STATUS_LABEL: Record<string, string> = { SENT: '발송', SENDING: '발송 중', SKIPPED: '건너뜀', FAILED: '실패' };

const day = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', weekday: 'short' }) : '';

// 뉴스레터 관리 (기능정의서 6 → 2026-10-09 개편) — 최근 30일 기사 중 보낼 기사를 고르고, 인사말을 넣어(자동 작성 가능) 구독자에게 발송
export default function NewsletterAdminPage() {
  const [info, setInfo] = useState<Info | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [greeting, setGreeting] = useState('');
  const [preview, setPreview] = useState<{ subject: string; html: string } | null>(null);
  const [writing, setWriting] = useState(false);
  const [sending, setSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [resultMsg, setResultMsg] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [autoMsg, setAutoMsg] = useState('');
  const [busy, setBusy] = useState(false);

  async function load(resetSelection = false) {
    const d: Info = await fetch('/api/newsletter').then((r) => r.json());
    setInfo(d);
    if (resetSelection) setSelected(new Set(d.defaultIds));
  }
  useEffect(() => {
    load(true);
    // 구글 [지메일 연결] 화면에서 돌아왔을 때 결과 안내
    const q = new URLSearchParams(window.location.search);
    if (q.get('gmail') === 'ok') setAutoMsg(`지메일 연결 완료 — ${q.get('sender') ?? ''} 주소로 보냅니다.`);
    if (q.get('gmail') === 'fail') setAutoMsg(`지메일 연결 실패: ${q.get('msg') ?? ''}`);
    if (q.get('gmail')) window.history.replaceState(null, '', '/admin/newsletter');
  }, []);

  async function settings(body: { auto?: boolean; skipThisWeek?: boolean }) {
    setBusy(true);
    await fetch('/api/newsletter/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    await load();
    setBusy(false);
  }
  async function testSend(useSelection: boolean) {
    setBusy(true);
    setAutoMsg('');
    const res = await fetch('/api/newsletter/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(useSelection ? { ids, greeting } : {}),
    });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    const msg = res.ok ? `테스트 메일을 ${d.to}로 보냈습니다. 받은편지함(또는 스팸함)을 확인하세요.` : d.error ?? '테스트 발송 실패';
    if (useSelection) {
      if (res.ok) setResultMsg(msg);
      else setErrorMsg(msg);
    } else setAutoMsg(msg);
  }
  async function disconnect() {
    if (!confirm('뉴스레터 발송 지메일 연결을 끊을까요? 끊으면 토요일 자동 발송도 멈춥니다.')) return;
    await fetch('/api/admin/gmail', { method: 'DELETE' });
    await load();
  }

  // 고른 기사·인사말이 바뀌면 잠깐 뒤 미리보기 갱신
  const ids = info ? info.articles.filter((a) => selected.has(a.id)).map((a) => a.id) : [];
  const idsKey = ids.join(',');
  useEffect(() => {
    if (!info) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const res = await fetch('/api/newsletter', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids, greeting }) });
      if (res.ok) setPreview(await res.json());
    }, 500);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey, greeting, info]);

  function toggle(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function writeGreeting() {
    if (!ids.length) return setErrorMsg('기사를 먼저 고르세요.');
    if (greeting.trim() && !confirm('지금 쓴 인사말을 새로 작성한 내용으로 바꿀까요?')) return;
    setWriting(true);
    setErrorMsg('');
    const res = await fetch('/api/newsletter/greeting', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids }) });
    const data = await res.json().catch(() => ({}));
    setWriting(false);
    if (res.ok) setGreeting(data.greeting);
    else setErrorMsg(data.error ?? '인사말 작성에 실패했습니다.');
  }

  async function send() {
    if (!info) return;
    if (!confirm(`고른 기사 ${ids.length}건으로 구독자 ${info.subscriberCount}명에게 뉴스레터를 보낼까요?`)) return;
    setSending(true);
    setErrorMsg('');
    setResultMsg('');
    const res = await fetch('/api/newsletter/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids, greeting }) });
    const data = await res.json().catch(() => ({}));
    setSending(false);
    if (!res.ok) setErrorMsg(data.error ?? '발송에 실패했습니다.');
    else setResultMsg(`발송 완료: 성공 ${data.sent}건 / 실패 ${data.failed}건 (전체 ${data.total}명)${data.firstError ? ` — ${data.firstError}` : ''}`);
    load();
  }

  if (!info) return <main className="py-8 text-gray-500">불러오는 중…</main>;

  return (
    <main className="py-8">
      <h1 className="text-xl font-bold text-gray-900 mb-1">뉴스레터 관리</h1>
      <p className="text-sm text-gray-500 mb-6">
        구독자 <b>{info.subscriberCount}명</b>
        {info.lastSentAt && <> · 마지막 발송 {new Date(info.lastSentAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</>}
      </p>

      {/* 일간 아침 브리핑 초안 (2026-10-10) — 구독자 발송은 아직 연결 전, 편집장 본인에게만 */}
      <DailyDraftEditor gmailConnected={info.gmail.connected} />

      {/* 토요일 자동 발송 (2026-10-10) */}
      <section className="border rounded-xl p-4 mb-6 space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-sm font-semibold">토요일 아침 7시 자동 발송</h2>
          <label className="inline-flex items-center gap-1.5 text-sm">
            <input type="checkbox" className="w-4 h-4" checked={info.auto.enabled} disabled={busy} onChange={(e) => settings({ auto: e.target.checked })} />
            {info.auto.enabled ? '켜짐' : '꺼짐'}
          </label>
          <span className="text-xs text-gray-500">지난 한 주(토~금) 기사 중 1면톱 + 많이 본 기사를 카테고리가 섞이게 최대 8개, 인사말은 AI가 씁니다.</span>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-semibold">보내는 지메일</span>
          {info.gmail.connected ? (
            <>
              <span>{info.gmail.sender}</span>
              <button type="button" onClick={disconnect} className="text-xs border rounded-lg px-2 py-1 text-gray-500">
                연결 끊기
              </button>
            </>
          ) : (
            <>
              <span className="text-amber-700">연결 안 됨 — 연결해야 발송됩니다</span>
              <a href="/api/admin/gmail/connect" className="text-xs font-bold text-white bg-brand rounded-lg px-3 py-1.5">
                지메일 연결
              </a>
            </>
          )}
        </div>
        {autoMsg && <p className="text-sm text-brand">{autoMsg}</p>}

        <div className="bg-gray-50 rounded-lg p-3">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <b className="text-sm">
              이번 발송: {info.auto.week} (토) · {info.auto.weekLabel}
            </b>
            <span className="text-xs text-gray-500">
              {info.auto.alreadySent
                ? '이번 주 처리 끝남(아래 이력)'
                : !info.auto.enabled
                  ? '자동 발송 꺼짐'
                  : info.auto.skipped
                    ? '이번 주 건너뜀'
                    : !info.gmail.connected
                      ? '지메일 연결 필요'
                      : `구독자 ${info.subscriberCount}명에게 발송 예정`}
            </span>
            <span className="ml-auto flex flex-wrap gap-1">
              {!info.auto.alreadySent && (
                <button type="button" disabled={busy} onClick={() => settings({ skipThisWeek: !info.auto.skipped })} className="text-xs border rounded-lg px-2 py-1 bg-white">
                  {info.auto.skipped ? '건너뛰기 취소' : '이번 주 건너뛰기'}
                </button>
              )}
              <button type="button" disabled={busy || !info.gmail.connected || !info.auto.ids.length} onClick={() => testSend(false)} className="text-xs border rounded-lg px-2 py-1 bg-white disabled:opacity-40">
                나에게 테스트 발송
              </button>
              <button type="button" disabled={!info.auto.ids.length} onClick={() => setSelected(new Set(info.auto.ids))} className="text-xs border rounded-lg px-2 py-1 bg-white disabled:opacity-40">
                아래 미리보기에 불러오기
              </button>
            </span>
          </div>
          {info.auto.ids.length ? (
            <ol className="list-decimal pl-5 text-sm space-y-0.5">
              {info.auto.ids.map((id) => {
                const a = info.articles.find((x) => x.id === id);
                return <li key={id}>{a ? toFrenchBrackets(a.title) : id}</li>;
              })}
            </ol>
          ) : (
            <p className="text-sm text-gray-400">아직 이번 주에 고를 기사가 없습니다(지난 토요일 이후 발행 기사 없음).</p>
          )}
        </div>

        {info.history.length > 0 && (
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="py-1 pr-2">날짜</th>
                <th className="py-1 pr-2">구분</th>
                <th className="py-1 pr-2">결과</th>
                <th className="py-1 pr-2 text-right">받은 사람</th>
                <th className="py-1">제목·비고</th>
              </tr>
            </thead>
            <tbody>
              {info.history.map((h) => (
                <tr key={h.id} className="border-b last:border-0">
                  <td className="py-1 pr-2 whitespace-nowrap">{new Date(h.sentAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                  <td className="py-1 pr-2">{h.auto ? '자동' : '직접'}</td>
                  <td className="py-1 pr-2">{STATUS_LABEL[h.status] ?? h.status}</td>
                  <td className="py-1 pr-2 text-right tabular-nums">
                    {h.recipientCount}
                    {h.failedCount ? ` (실패 ${h.failedCount})` : ''}
                  </td>
                  <td className="py-1 text-gray-600">{[h.subject, h.note].filter(Boolean).join(' · ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <h2 className="text-sm font-semibold mb-3 text-gray-700">직접 골라 지금 보내기</h2>

      <div className="grid lg:grid-cols-2 gap-6 items-start">
        {/* 1. 기사 고르기 */}
        <section className="border rounded-xl p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <h2 className="text-sm font-semibold">
              1. 보낼 기사 고르기 <span className="text-gray-500 font-normal">({ids.length}건 선택 · 최근 30일)</span>
            </h2>
            <div className="flex gap-1">
              <button type="button" onClick={() => setSelected(new Set(info.defaultIds))} className="border rounded-lg px-2 py-1 text-xs">
                이번 주 기사
              </button>
              <button type="button" onClick={() => setSelected(new Set())} className="border rounded-lg px-2 py-1 text-xs">
                모두 해제
              </button>
            </div>
          </div>
          <ul className="max-h-[560px] overflow-y-auto divide-y">
            {info.articles.map((a) => (
              <li key={a.id}>
                <label className="flex items-start gap-2 py-2 cursor-pointer">
                  <input type="checkbox" className="mt-1 w-4 h-4 shrink-0" checked={selected.has(a.id)} onChange={() => toggle(a.id)} />
                  <span className="min-w-0">
                    <span className="block text-sm leading-snug">{toFrenchBrackets(a.title)}</span>
                    <span className="block text-[11px] text-gray-500">
                      {day(a.publishedAt)}
                      {a.category ? ` · ${a.category}` : ''}
                      {a.author ? ` · ${a.author}` : ''}
                    </span>
                  </span>
                </label>
              </li>
            ))}
            {info.articles.length === 0 && <li className="py-4 text-sm text-gray-400">최근 30일 발행 기사가 없습니다.</li>}
          </ul>
        </section>

        <div className="space-y-6">
          {/* 2. 인사말 */}
          <section className="border rounded-xl p-4">
            <div className="flex items-center justify-between gap-2 mb-2">
              <h2 className="text-sm font-semibold">2. 인사말</h2>
              <button
                type="button"
                onClick={writeGreeting}
                disabled={writing || !ids.length}
                className="text-xs font-bold text-white bg-brand rounded-lg px-3 py-1.5 disabled:opacity-40"
              >
                {writing ? '작성 중… (20초쯤)' : '인사말 작성'}
              </button>
            </div>
            <p className="text-xs text-gray-500 mb-2">[인사말 작성]을 누르면 고른 기사들의 내용을 간략히 정리한 인사말이 들어갑니다. 자유롭게 고쳐 쓰세요.</p>
            <textarea
              value={greeting}
              onChange={(e) => setGreeting(e.target.value)}
              rows={10}
              placeholder="구독자 여러분, 안녕하세요. 팩트파인더입니다."
              className="w-full border rounded-lg p-3 text-sm leading-relaxed"
            />
          </section>

          {/* 3. 발송 */}
          <section className="border rounded-xl p-4">
            <h2 className="text-sm font-semibold mb-2">3. 미리보기 · 발송</h2>
            {errorMsg && <p className="text-red-600 text-sm mb-2">{errorMsg}</p>}
            {resultMsg && <p className="text-brand text-sm mb-2">{resultMsg}</p>}
            <button
              type="button"
              disabled={sending || !info.emailConfigured || info.subscriberCount === 0 || ids.length === 0}
              onClick={send}
              className="text-sm font-bold text-white bg-brand rounded-lg px-6 py-2 disabled:opacity-40 mb-4"
            >
              {sending ? '발송 중…' : '구독자에게 발송'}
            </button>
            <button type="button" disabled={busy || !info.gmail.connected || ids.length === 0} onClick={() => testSend(true)} className="ml-2 text-sm border rounded-lg px-4 py-2 disabled:opacity-40 mb-4">
              나에게 테스트
            </button>
            {preview && (
              <>
                <p className="text-xs text-gray-500 mb-1">제목: {preview.subject}</p>
                <div className="border border-gray-200 rounded-xl p-4 overflow-auto bg-white" dangerouslySetInnerHTML={{ __html: preview.html }} />
              </>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
