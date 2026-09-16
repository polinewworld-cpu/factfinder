'use client';

import { useEffect, useState } from 'react';
import { compressImageFile } from '@/lib/imageCompress';

type Photo = {
  id: string;
  url: string;
  filename: string | null;
  title: string | null;
  uploaderId: string;
  tags: { id: string; name: string }[];
};

const WRITER_ROLES = ['REPORTER', 'COLUMNIST', 'CHIEF_EDITOR'];

// 보도사진 관리 화면 — 관리자/기자용 범용 사진 라이브러리 (기능정의서 8.1)
export default function PhotosLibraryPage() {
  const [me, setMe] = useState<any>('loading');
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [tags, setTags] = useState<{ id: string; name: string }[]>([]);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newTags, setNewTags] = useState('');
  const [uploading, setUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  async function loadTags() {
    const res = await fetch('/api/photo-tags');
    if (res.ok) setTags(await res.json());
  }

  async function loadPhotos() {
    const params = new URLSearchParams();
    if (query.trim()) params.set('q', query.trim());
    if (activeTag) params.set('tag', activeTag);
    const res = await fetch(`/api/photos?${params.toString()}`);
    if (res.ok) setPhotos(await res.json());
  }

  useEffect(() => {
    (async () => {
      const meRes = await fetch('/api/me');
      const meData = meRes.ok ? await meRes.json() : null;
      setMe(meData);
      if (meData && WRITER_ROLES.includes(meData.role)) {
        await Promise.all([loadPhotos(), loadTags()]);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (me && WRITER_ROLES.includes(me.role)) loadPhotos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, activeTag]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    setUploading(true);
    setErrorMsg('');
    const tagNames = newTags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    try {
      for (const rawFile of files) {
        const file = await compressImageFile(rawFile); // 10MB 넘으면 브라우저에서 자동으로 줄여서 보냄
        const form = new FormData();
        form.append('file', file);
        const uploadRes = await fetch('/api/upload', { method: 'POST', body: form });
        const uploadData = await uploadRes.json();
        if (!uploadRes.ok) {
          setErrorMsg(uploadData.error ?? '업로드 실패');
          continue;
        }
        await fetch('/api/photos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: uploadData.url, filename: rawFile.name, title: newTitle.trim() || undefined, tags: tagNames }),
        });
      }
      await Promise.all([loadPhotos(), loadTags()]);
      setNewTitle('');
      setNewTags('');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  async function deletePhoto(id: string) {
    if (!confirm('이 사진을 삭제할까요?')) return;
    await fetch(`/api/photos/${id}`, { method: 'DELETE' });
    setPhotos((prev) => prev.filter((p) => p.id !== id));
  }

  if (me === 'loading') return <main className="max-w-5xl mx-auto px-4 py-10 text-gray-500">불러오는 중…</main>;
  if (!me || !WRITER_ROLES.includes(me.role)) {
    return (
      <main className="max-w-5xl mx-auto px-4 py-10">
        <p className="text-gray-600">기자 이상만 접근할 수 있는 화면입니다.</p>
      </main>
    );
  }

  return (
    <main className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-xl font-bold text-gray-900 mb-6">보도사진 관리</h1>

      <div className="border border-gray-200 rounded-xl p-4 mb-6">
        <p className="text-xs text-gray-400 mb-2">사진 업로드 (여러 장 선택 가능 · 태그는 쉼표로 구분)</p>
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="제목 (선택)"
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-brand"
          />
          <input
            value={newTags}
            onChange={(e) => setNewTags(e.target.value)}
            placeholder="태그1, 태그2"
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-brand"
          />
          <label className="text-sm text-gray-600 cursor-pointer">
            <input type="file" accept="image/*" multiple className="hidden" onChange={handleUpload} />
            <span className="border border-gray-200 rounded-lg px-3 py-1.5 hover:border-brand inline-block">
              {uploading ? '업로드 중…' : '사진 업로드'}
            </span>
          </label>
        </div>
        {errorMsg && <p className="text-red-600 text-xs mt-2">{errorMsg}</p>}
      </div>

      <div className="mb-4 space-y-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="파일명으로 검색"
          className="w-full sm:w-80 border border-gray-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-brand"
        />
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setActiveTag(null)}
              className={`text-xs font-bold rounded-full px-3 py-1 border ${
                !activeTag ? 'bg-brand text-white border-brand' : 'bg-white text-gray-500 border-gray-200'
              }`}
            >
              전체
            </button>
            {tags.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTag(t.name === activeTag ? null : t.name)}
                className={`text-xs font-bold rounded-full px-3 py-1 border ${
                  activeTag === t.name ? 'bg-brand text-white border-brand' : 'bg-white text-gray-500 border-gray-200'
                }`}
              >
                #{t.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {photos.length === 0 && <p className="text-sm text-gray-400">등록된 사진이 없습니다.</p>}
      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
        {photos.map((p) => (
          <div key={p.id} className="group relative">
            <div className="aspect-square rounded-lg overflow-hidden bg-gray-100">
              <img src={p.url} alt={p.title ?? p.filename ?? ''} className="w-full h-full object-cover" />
            </div>
            {p.title && <p className="text-[11px] text-gray-700 font-semibold mt-1 truncate">{p.title}</p>}
            {p.tags.length > 0 && (
              <p className="text-[11px] text-gray-400 mt-1 truncate">{p.tags.map((t) => `#${t.name}`).join(' ')}</p>
            )}
            {(p.uploaderId === me.id || me.role === 'CHIEF_EDITOR') && (
              <button
                type="button"
                onClick={() => deletePhoto(p.id)}
                className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/50 text-white text-xs opacity-0 group-hover:opacity-100"
              >
                ✕
              </button>
            )}
          </div>
        ))}
      </div>
    </main>
  );
}
