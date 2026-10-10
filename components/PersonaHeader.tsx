'use client';

import { useEffect, useState } from 'react';
import { compressImageFile } from '@/lib/imageCompress';

// 편집실 AI 페르소나 머리글 — 동그란 프로필 사진 + 이름. 편집장은 [프로필 사진 바꾸기]로 올림 (2026-10-10, 오진실 기자)
export default function PersonaHeader({ personaKey, name, alt }: { personaKey: string; name: string; alt: string }) {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`/api/admin/persona-avatar?key=${personaKey}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        setAvatarUrl(d.avatarUrl ?? null);
        setCanEdit(!!d.canEdit);
      })
      .catch(() => {});
  }, [personaKey]);

  async function change(file: File) {
    setBusy(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('file', await compressImageFile(file));
      const up = await fetch('/api/upload', { method: 'POST', body: fd });
      const upData = await up.json().catch(() => ({}));
      if (!up.ok) throw new Error(upData.error ?? '사진 올리기에 실패했습니다');
      const res = await fetch('/api/admin/persona-avatar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: personaKey, avatarUrl: upData.url }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? '사진을 저장하지 못했습니다');
      setAvatarUrl(data.avatarUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : '사진 올리기에 실패했습니다');
    }
    setBusy(false);
  }

  return (
    <div className="flex items-center gap-4">
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`${avatarUrl}?w=800`} alt={alt} className="rounded-full object-cover object-top border border-gray-200 shrink-0" style={{ width: 88, height: 88 }} />
      ) : (
        <div className="rounded-full bg-gray-200 text-gray-500 font-bold flex items-center justify-center shrink-0" style={{ width: 88, height: 88, fontSize: 34 }}>
          {name.slice(0, 1)}
        </div>
      )}
      <div>
        <h1 className="text-xl font-bold text-gray-900">{name}</h1>
        {canEdit && (
          <label className={`inline-block mt-1 text-xs font-semibold text-gray-600 border border-gray-200 rounded-lg px-3 py-1.5 hover:border-gray-400 cursor-pointer ${busy ? 'opacity-50 pointer-events-none' : ''}`}>
            {busy ? '올리는 중…' : '프로필 사진 바꾸기'}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (f) change(f);
              }}
            />
          </label>
        )}
        {error && <p className="text-red-600 text-xs mt-1">{error}</p>}
      </div>
    </div>
  );
}
