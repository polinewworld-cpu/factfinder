'use client';

import { useEffect, useState } from 'react';

export default function ProfilePage() {
  const [me, setMe] = useState<any>('loading');
  const [nickname, setNickname] = useState('');
  const [image, setImage] = useState('');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');

  useEffect(() => {
    (async () => {
      const res = await fetch('/api/me');
      if (!res.ok) return setMe(null);
      const data = await res.json();
      setMe(data);
      setNickname(data.nickname ?? '');
      setImage(data.image ?? '');
    })();
  }, []);

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
    const res = await fetch('/api/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nickname, image }),
    });
    if (res.ok) setSavedMsg('저장되었습니다.');
    setSaving(false);
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

      <p className="text-xs text-gray-400 mb-1">닉네임 (댓글에 표시됩니다)</p>
      <input
        value={nickname}
        onChange={(e) => setNickname(e.target.value)}
        placeholder={me.name}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-4 outline-none focus:border-brand"
      />

      {savedMsg && <p className="text-brand text-sm mb-3">{savedMsg}</p>}
      <button
        onClick={save}
        disabled={saving}
        className="text-sm font-bold text-white bg-brand rounded-full px-6 py-2 disabled:opacity-50"
      >
        저장
      </button>
    </main>
  );
}
