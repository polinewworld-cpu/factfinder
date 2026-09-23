'use client';

import { useState } from 'react';
import { compressImageFile } from '@/lib/imageCompress';

// 첫 가입 직후(닉네임 미설정 회원) 사이트 어느 페이지로 들어오든 본문 대신 이 화면을 보여줌.
// 닉네임(필수·중복불가) + 프로필사진(구글 사진 기본값) 설정 → 저장하면 새로고침되어 원래 보던 페이지로 복귀.
// 이후 수정은 /profile(내 프로필)에서.
export default function WelcomeSetup({ defaultImage }: { defaultImage?: string | null }) {
  const [nickname, setNickname] = useState('');
  const [image, setImage] = useState(defaultImage ?? '');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setErrorMsg('');
    const form = new FormData();
    form.append('file', await compressImageFile(file));
    const res = await fetch('/api/upload', { method: 'POST', body: form });
    const data = await res.json().catch(() => null);
    if (res.ok) setImage(data.url);
    else setErrorMsg(data?.error ?? '사진 업로드에 실패했습니다.');
    setUploading(false);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg('');
    if (!nickname.trim()) {
      setErrorMsg('닉네임을 입력해주세요.');
      return;
    }
    setSaving(true);
    const res = await fetch('/api/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nickname, image }),
    });
    const data = await res.json().catch(() => null);
    if (res.ok) {
      window.location.reload();
      return;
    }
    setErrorMsg(data?.error ?? '저장에 실패했습니다.');
    setSaving(false);
  }

  return (
    <main className="max-w-md mx-auto px-4 py-12">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">팩트파인더에 오신 것을 환영합니다</h1>
      <p className="text-sm text-gray-500 mb-8">
        활동에 사용할 닉네임과 프로필 사진을 정해주세요. 나중에 &lsquo;내 프로필&rsquo;에서 언제든 바꿀 수 있습니다.
      </p>

      <form onSubmit={submit}>
        <div className="flex items-center gap-4 mb-6">
          <div className="w-20 h-20 rounded-full bg-gray-100 overflow-hidden flex items-center justify-center text-gray-300 text-xs shrink-0">
            {image ? <img src={image} alt="" className="w-full h-full object-cover" /> : '사진'}
          </div>
          <div className="flex flex-col gap-2 text-sm">
            <label className="text-gray-600 cursor-pointer">
              <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
              <span className="border border-gray-200 rounded-lg px-3 py-1.5 hover:border-brand inline-block">
                {uploading ? '업로드 중…' : '사진 변경'}
              </span>
            </label>
            {image && (
              <button type="button" onClick={() => setImage('')} className="text-xs text-gray-400 text-left hover:text-gray-600">
                사진 없이 시작
              </button>
            )}
          </div>
        </div>

        <p className="text-xs text-gray-400 mb-1">닉네임 (필수, 중복 불가 · 댓글에 표시됩니다)</p>
        <input
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          placeholder="닉네임 입력"
          maxLength={20}
          autoFocus
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-2 outline-none focus:border-brand"
        />
        {errorMsg && <p className="text-sm text-red-500 mb-2">{errorMsg}</p>}

        <button
          type="submit"
          disabled={saving || uploading}
          className="w-full mt-4 bg-brand text-white font-semibold rounded-lg py-2.5 disabled:opacity-50"
        >
          {saving ? '저장 중…' : '시작하기'}
        </button>
      </form>

      <a href="/api/auth/signout" className="block text-center text-xs text-gray-400 mt-6 hover:text-gray-600">
        로그아웃
      </a>
    </main>
  );
}
