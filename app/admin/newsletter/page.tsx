'use client';

import { useEffect, useState } from 'react';

type Preview = {
  start: string;
  end: string;
  subject: string;
  html: string;
  articleCount: number;
  subscriberCount: number;
  emailConfigured: boolean;
};

// 뉴스레터 — 이번 주 발행 기사 자동 발췌 + 옵트인 구독자 전체 발송 (기능정의서 6)
export default function NewsletterAdminPage() {
  const [me, setMe] = useState<any>('loading');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [resultMsg, setResultMsg] = useState('');

  async function load() {
    const res = await fetch('/api/newsletter');
    if (res.ok) setPreview(await res.json());
  }

  useEffect(() => {
    (async () => {
      const meRes = await fetch('/api/me');
      const meData = meRes.ok ? await meRes.json() : null;
      setMe(meData);
      if (meData?.role === 'CHIEF_EDITOR') await load();
    })();
  }, []);

  async function send() {
    if (!confirm('구독자 전체에게 이번 주 뉴스레터를 발송할까요?')) return;
    setBusy(true);
    setErrorMsg('');
    setResultMsg('');
    const res = await fetch('/api/newsletter/send', { method: 'POST' });
    const data = await res.json();
    if (!res.ok) {
      setErrorMsg(data.error ?? '발송에 실패했습니다.');
    } else {
      setResultMsg(`발송 완료: 성공 ${data.sent}건 / 실패 ${data.failed}건 (전체 ${data.total}명)`);
    }
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

  return (
    <main className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-xl font-bold text-gray-900 mb-6">뉴스레터</h1>

      {!preview ? (
        <p className="text-sm text-gray-400">불러오는 중…</p>
      ) : (
        <>
          {!preview.emailConfigured && (
            <div className="border border-amber-200 bg-amber-50 rounded-xl p-4 mb-6 text-sm text-amber-800">
              이메일 발송 서비스가 아직 연결되지 않았습니다. Resend(resend.com)에서 API 키를 발급받아
              <code className="mx-1 px-1 bg-white rounded">RESEND_API_KEY</code>와
              <code className="mx-1 px-1 bg-white rounded">NEWSLETTER_FROM_EMAIL</code>을 <code>.env.local</code>에
              추가하고 서버를 재시작하면 발송할 수 있습니다. 그 전까지는 미리보기만 가능합니다.
            </div>
          )}

          <div className="flex flex-wrap gap-6 mb-6 text-sm">
            <p>
              기간: <span className="font-semibold">{new Date(preview.start).toLocaleDateString('ko-KR')} ~ {new Date(preview.end).toLocaleDateString('ko-KR')}</span>
            </p>
            <p>
              발행 기사 <span className="font-semibold">{preview.articleCount}건</span>
            </p>
            <p>
              구독자 <span className="font-semibold">{preview.subscriberCount}명</span>
            </p>
          </div>

          {errorMsg && <p className="text-red-600 text-sm mb-4">{errorMsg}</p>}
          {resultMsg && <p className="text-brand text-sm mb-4">{resultMsg}</p>}

          <button
            type="button"
            disabled={busy || !preview.emailConfigured || preview.subscriberCount === 0}
            onClick={send}
            className="text-sm font-bold text-white bg-brand rounded-full px-6 py-2 disabled:opacity-50 mb-6"
          >
            {busy ? '발송 중…' : '지금 발송하기'}
          </button>

          <p className="text-xs text-gray-400 mb-2">미리보기</p>
          <div
            className="border border-gray-200 rounded-xl p-4 overflow-auto"
            dangerouslySetInnerHTML={{ __html: preview.html }}
          />
        </>
      )}
    </main>
  );
}
