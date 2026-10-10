'use client';

import { useEffect, useState } from 'react';

// 편집실 AI 페르소나 머리글 — 동그란 프로필 사진 + 이름 (2026-10-10, 오진실 기자). 사진은 이미 올려 둔 것으로 고정 — 바꾸는 버튼 없음
export default function PersonaHeader({ personaKey, name, alt }: { personaKey: string; name: string; alt: string }) {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/admin/persona-avatar?key=${personaKey}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setAvatarUrl(d?.avatarUrl ?? null))
      .catch(() => {});
  }, [personaKey]);

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
      <h1 className="text-xl font-bold text-gray-900">{name}</h1>
    </div>
  );
}
