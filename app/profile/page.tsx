'use client';

import { useEffect, useState } from 'react';
import { detectSnsPlatform, SNS_PLATFORM_LABELS } from '@/lib/sns';

type SavedArticleItem = { id: string; title: string; author: { name: string } };

export default function ProfilePage() {
  const [me, setMe] = useState<any>('loading');
  const [nickname, setNickname] = useState('');
  const [image, setImage] = useState('');
  const [bio, setBio] = useState('');
  const [snsLinks, setSnsLinks] = useState<string[]>([]);
  const [newsletterOptIn, setNewsletterOptIn] = useState(false);
  const [newSnsUrl, setNewSnsUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [savedArticles, setSavedArticles] = useState<SavedArticleItem[]>([]);
  const [applying, setApplying] = useState(false);
  const [applyMsg, setApplyMsg] = useState('');

  useEffect(() => {
    (async () => {
      const res = await fetch('/api/me');
      if (!res.ok) return setMe(null);
      const data = await res.json();
      setMe(data);
      setNickname(data.nickname ?? '');
      setImage(data.image ?? '');
      setBio(data.bio ?? '');
      setSnsLinks((data.snsLinks ?? []).map((l: { url: string }) => l.url));
      setNewsletterOptIn(!!data.newsletterOptIn);

      const savedRes = await fetch('/api/saved');
      if (savedRes.ok) setSavedArticles(await savedRes.json());
    })();
  }, []);

  function addSnsLink() {
    const url = newSnsUrl.trim();
    if (!url) return;
    setSnsLinks((prev) => [...prev, url]);
    setNewSnsUrl('');
  }

  function removeSnsLink(idx: number) {
    setSnsLinks((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const form = new FormData();
    form.append('file', file);
    const res = await fetch('/api/upload', { method: 'POST', body: form });
    const data = await res.json();
    if (res.ok) setImage(data.url);
    setUploading(false);
  }

  async function save() {
    setSaving(true);
    setSavedMsg('');
    setErrorMsg('');
    if (!nickname.trim()) {
      setErrorMsg('닉네임은 필수 입력입니다.');
      setSaving(false);
      return;
    }
    const res = await fetch('/api/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nickname, image, bio, snsLinks, newsletterOptIn }),
    });
    const data = await res.json().catch(() => null);
    if (res.ok) {
      setSavedMsg('저장되었습니다.');
    } else {
      setErrorMsg(data?.error ?? '저장에 실패했습니다.');
    }
    setSaving(false);
  }

  async function applyReporter() {
    setApplying(true);
    setApplyMsg('');
    setErrorMsg('');
    const res = await fetch('/api/reporter-application', { method: 'POST' });
    const data = await res.json().catch(() => null);
    if (res.ok) {
      setMe(data);
    } else {
      setErrorMsg(data?.error ?? '기자 신청에 실패했습니다.');
    }
    setApplying(false);
  }

  async function cancelApplication() {
    setApplying(true);
    setApplyMsg('');
    const res = await fetch('/api/reporter-application', { method: 'DELETE' });
    const data = await res.json().catch(() => null);
    if (res.ok) {
      setMe(data);
      setApplyMsg('신청을 취소했습니다.');
    }
    setApplying(false);
  }

  if (me === 'loading') return <main className="max-w-md mx-auto px-4 py-10 text-gray-500">불러오는 중…</main>;
  if (!me) {
    return (
      <main className="max-w-md mx-auto px-4 py-10">
        <p className="text-gray-600">
          로그인 후 이용해주세요.{' '}
          <a href="/api/auth/signin/google" className="text-brand font-semibold">
            구글로 로그인
          </a>
        </p>
      </main>
    );
  }

  return (
    <main className="max-w-md mx-auto px-4 py-10">
      <h1 className="text-xl font-bold text-gray-900 mb-6">내 프로필</h1>

      <div className="flex items-center gap-4 mb-6">
        <div className="w-16 h-16 rounded-full bg-gray-100 overflow-hidden flex items-center justify-center text-gray-300 text-xs shrink-0">
          {image ? <img src={image} alt="" className="w-full h-full object-cover" /> : '사진'}
        </div>
        <label className="text-sm text-gray-600 cursor-pointer">
          <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
          <span className="border border-gray-200 rounded-lg px-3 py-1.5 hover:border-brand">
            {uploading ? '업로드 중…' : '프로필사진 변경'}
          </span>
        </label>
      </div>

      <p className="text-xs text-gray-400 mb-1">이메일</p>
      <p className="text-sm text-gray-700 mb-4">{me.email}</p>

      <p className="text-xs text-gray-400 mb-1">닉네임 (필수, 중복 불가 · 댓글에 표시됩니다)</p>
      <input
        value={nickname}
        onChange={(e) => setNickname(e.target.value)}
        placeholder={me.name}
        required
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-4 outline-none focus:border-brand"
      />

      <p className="text-xs text-gray-400 mb-1">자기소개 (기사 하단에 노출됩니다)</p>
      <textarea
        value={bio}
        onChange={(e) => setBio(e.target.value)}
        placeholder="간단한 자기소개를 입력하세요"
        rows={3}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-4 outline-none focus:border-brand resize-none"
      />

      <p className="text-xs text-gray-400 mb-1">SNS 링크 (기사 하단에 아이콘으로 노출됩니다)</p>
      <div className="space-y-2 mb-2">
        {snsLinks.map((url, i) => {
          const platform = detectSnsPlatform(url);
          return (
            <div key={i} className="flex items-center gap-2">
              <span className="text-xs font-semibold text-gray-500 w-16 shrink-0">
                {SNS_PLATFORM_LABELS[platform]}
              </span>
              <span className="flex-1 text-sm text-gray-700 truncate border border-gray-100 rounded-lg px-2 py-1.5 bg-gray-50">
                {url}
              </span>
              <button
                type="button"
                onClick={() => removeSnsLink(i)}
                className="w-6 h-6 shrink-0 rounded-full text-gray-400 hover:text-red-500 hover:bg-red-50"
              >
                ✕
              </button>
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-2 mb-6">
        <input
          value={newSnsUrl}
          onChange={(e) => setNewSnsUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== 'Enter') return;
            e.preventDefault();
            addSnsLink();
          }}
          placeholder="https://instagram.com/..."
          className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-brand"
        />
        <button
          type="button"
          onClick={addSnsLink}
          className="text-xs font-bold text-brand border border-brand/30 rounded-full px-3 py-1.5 hover:bg-brand/5"
        >
          + 추가
        </button>
      </div>

      <label className="flex items-center gap-2 text-sm text-gray-600 mb-6 cursor-pointer">
        <input
          type="checkbox"
          checked={newsletterOptIn}
          onChange={(e) => setNewsletterOptIn(e.target.checked)}
        />
        뉴스레터 구독 (주 1회, 발행된 기사 모음을 이메일로 받아봅니다)
      </label>

      {errorMsg && <p className="text-red-600 text-sm mb-3">{errorMsg}</p>}
      {savedMsg && <p className="text-brand text-sm mb-3">{savedMsg}</p>}
      <button
        onClick={save}
        disabled={saving}
        className="text-sm font-bold text-white bg-brand rounded-full px-6 py-2 disabled:opacity-50"
      >
        저장
      </button>

      {(me.role === 'READER' || me.role === 'DONOR_READER') && (
        <div className="mt-10 pt-6 border-t border-gray-200">
          <h2 className="text-sm font-bold text-gray-900 mb-2">기자 신청</h2>
          {me.reporterApplicationStatus === 'PENDING' && (
            <>
              <p className="text-sm text-gray-600 mb-3">기자 신청중입니다. 편집장 승인을 기다려주세요.</p>
              <button
                onClick={cancelApplication}
                disabled={applying}
                className="text-xs text-gray-500 border border-gray-200 rounded-full px-4 py-1.5 hover:border-gray-400 disabled:opacity-50"
              >
                신청 취소
              </button>
            </>
          )}
          {me.reporterApplicationStatus === 'REJECTED' && (
            <>
              <p className="text-sm text-gray-600 mb-3">기자 신청이 반려되었습니다.</p>
              <button
                onClick={applyReporter}
                disabled={applying}
                className="text-sm font-bold text-white bg-brand rounded-full px-6 py-2 disabled:opacity-50"
              >
                다시 신청하기
              </button>
            </>
          )}
          {!me.reporterApplicationStatus && (
            <>
              <p className="text-sm text-gray-600 mb-3">
                위에 저장하신 닉네임(필명)·프로필사진·자기소개·SNS 링크로 기자 신청을 보냅니다. 편집장 승인 후 기자로
                활동하실 수 있습니다.
              </p>
              <button
                onClick={applyReporter}
                disabled={applying}
                className="text-sm font-bold text-white bg-brand rounded-full px-6 py-2 disabled:opacity-50"
              >
                기자로 신청하기
              </button>
            </>
          )}
          {applyMsg && <p className="text-brand text-sm mt-3">{applyMsg}</p>}
        </div>
      )}

      {savedArticles.length > 0 && (
        <div className="mt-10 pt-6 border-t border-gray-200">
          <h2 className="text-sm font-bold text-gray-900 mb-3">저장한 기사</h2>
          <ul className="space-y-2">
            {savedArticles.map((a) => (
              <li key={a.id}>
                <a href={`/article/${a.id}`} className="text-sm text-gray-700 hover:text-brand">
                  {a.title} <span className="text-gray-400 text-xs">· {a.author.name}</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </main>
  );
}
