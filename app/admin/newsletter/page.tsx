'use client';

import { useEffect, useRef, useState } from 'react';
import { toFrenchBrackets } from '@/lib/frenchBrackets';

type Item = { id: string; title: string; publishedAt: string | null; category: string | null; author: string | null };
type Info = { articles: Item[]; defaultIds: string[]; subscriberCount: number; emailConfigured: boolean; lastSentAt: string | null };

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

  useEffect(() => {
    fetch('/api/newsletter')
      .then((r) => r.json())
      .then((d: Info) => {
        setInfo(d);
        setSelected(new Set(d.defaultIds));
      });
  }, []);

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
    else setResultMsg(`발송 완료: 성공 ${data.sent}건 / 실패 ${data.failed}건 (전체 ${data.total}명)`);
  }

  if (!info) return <main className="py-8 text-gray-500">불러오는 중…</main>;

  return (
    <main className="py-8">
      <h1 className="text-xl font-bold text-gray-900 mb-1">뉴스레터 관리</h1>
      <p className="text-sm text-gray-500 mb-6">
        구독자 <b>{info.subscriberCount}명</b>
        {info.lastSentAt && <> · 마지막 발송 {new Date(info.lastSentAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</>}
      </p>

      {!info.emailConfigured && (
        <div className="border border-amber-200 bg-amber-50 rounded-xl p-4 mb-6 text-sm text-amber-800">
          메일 발송 서비스가 아직 연결되지 않아 지금은 미리보기만 됩니다. (Render 환경변수 RESEND_API_KEY · NEWSLETTER_FROM_EMAIL 필요)
        </div>
      )}

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
