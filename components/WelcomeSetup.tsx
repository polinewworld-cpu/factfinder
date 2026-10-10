'use client';

import { useState } from 'react';
import { compressImageFile } from '@/lib/imageCompress';
import InitialAvatar from '@/components/InitialAvatar';
import { usableAvatarUrl } from '@/lib/avatarGradient';

// 첫 가입 직후(닉네임 미설정 회원) 사이트 어느 페이지로 들어오든 본문 대신 이 화면을 보여줌.
// 닉네임(필수, 10-10부터 중복 허용) + 프로필사진(구글 사진 기본값) 설정 → 저장하면 새로고침되어 원래 보던 페이지로 복귀.
// 이후 수정은 /profile(내 프로필)에서.
// 2026-10-08: 마지막 단계에서 [독자회원가입] / [기자회원가입] 선택 —
//   독자 = 매일 아침 뉴스레터 수신(newsletterOptIn) / 기자 = 기자 신청(편집장 승인 대기, 기존 /api/reporter-application)
export default function WelcomeSetup({
  defaultImage,
  name,
  userId,
}: {
  defaultImage?: string | null;
  name?: string | null;
  userId?: string | null;
}) {
  const [nickname, setNickname] = useState('');
  const [image, setImage] = useState(usableAvatarUrl(defaultImage) ?? '');
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

  async function submit(e: React.FormEvent, kind: 'reader' | 'reporter' = 'reader') {
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
      body: JSON.stringify({ nickname, image, ...(kind === 'reader' ? { newsletterOptIn: true } : {}) }),
    });
    const data = await res.json().catch(() => null);
    if (res.ok) {
      if (kind === 'reporter') {
        const apply = await fetch('/api/reporter-application', { method: 'POST' });
        if (!apply.ok) {
          const err = await apply.json().catch(() => null);
          // 프로필은 저장됐으니 가입은 진행 — 기자 신청만 실패한 경우 알리고 넘어감
          alert(err?.error ?? '기자 신청에 실패했습니다. 내 프로필에서 다시 신청할 수 있습니다.');
        }
      }
      window.location.reload();
      return;
    }
    setErrorMsg(data?.error ?? '저장에 실패했습니다.');
    setSaving(false);
  }

  const photo = usableAvatarUrl(image);

  return (
    <main className="max-w-md mx-auto px-4 py-12">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">팩트파인더에 오신 것을 환영합니다</h1>
      <p className="text-sm text-gray-500 mb-8">
        활동에 사용할 닉네임과 프로필 사진을 정해주세요. 나중에 &lsquo;내 프로필&rsquo;에서 언제든 바꿀 수 있습니다.
      </p>

      <form onSubmit={submit}>
        <div className="flex items-center gap-4 mb-6">
          <div className="w-20 h-20 rounded-full overflow-hidden flex items-center justify-center shrink-0">
            {photo ? (
              <img src={photo} alt="" className="w-full h-full object-cover" />
            ) : (
              <InitialAvatar seed={userId || name || 'welcome'} name={nickname || name} className="w-20 h-20 text-2xl" />
            )}
          </div>
          <div className="flex flex-col gap-2 text-sm">
            <label className="text-gray-600 cursor-pointer">
              <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
              <span className="border border-gray-200 rounded-lg px-3 py-1.5 hover:border-brand inline-block">
                {uploading ? '업로드 중…' : '사진 변경'}
              </span>
            </label>
            {photo && (
              <button type="button" onClick={() => setImage('')} className="text-xs text-gray-400 text-left hover:text-gray-600">
                사진 없이 시작
              </button>
            )}
          </div>
        </div>

        <p className="text-xs text-gray-400 mb-1">닉네임 (필수 · 댓글과 기사에 표시됩니다)</p>
        <input
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          placeholder="닉네임 입력"
          maxLength={20}
          autoFocus
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-2 outline-none focus:border-brand"
        />
        {errorMsg && <p className="text-sm text-red-500 mb-2">{errorMsg}</p>}

        <div className="grid grid-cols-2 gap-2 mt-4">
          <button
            type="submit"
            disabled={saving || uploading}
            className="bg-brand text-white font-semibold rounded-lg py-2.5 disabled:opacity-50"
          >
            {saving ? '저장 중…' : '독자회원가입'}
          </button>
          <button
            type="button"
            disabled={saving || uploading}
            onClick={(e) => submit(e, 'reporter')}
            className="border border-brand text-brand font-semibold rounded-lg py-2.5 disabled:opacity-50"
          >
            기자회원가입
          </button>
        </div>
        <ul className="mt-4 space-y-1.5 text-sm text-gray-600 list-disc pl-5">
          <li>독자회원으로 가입하면 매일 아침 가입한 이메일로 뉴스레터를 보내드립니다.</li>
          <li>로그인해서 보시면 맘에 드는 기사를 저장하실 수 있습니다.</li>
        </ul>
        <p className="mt-3 text-xs text-gray-400">
          기자회원은 편집장 승인 후 기사를 쓸 수 있습니다. 승인 전까지는 독자회원과 같이 이용하실 수 있습니다.
        </p>
      </form>

      <a href="/api/auth/signout" className="block text-center text-xs text-gray-400 mt-6 hover:text-gray-600">
        로그아웃
      </a>
    </main>
  );
}
