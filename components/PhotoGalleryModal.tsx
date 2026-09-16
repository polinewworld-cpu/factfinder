'use client';

import { useEffect, useRef, useState } from 'react';
import { compressImageFile } from '@/lib/imageCompress';
import PhotoWatermarkEditor from './PhotoWatermarkEditor';

type Photo = { id: string; url: string; filename: string | null; title: string | null; tags: { id: string; name: string }[] };
type Tag = { id: string; name: string };

// 기사 작성 화면의 "갤러리에서 선택" 모달 (기능정의서 8.1 갤러리 픽커 모달)
// multiple=false: 썸네일 클릭 즉시 선택 후 닫힘 (커버이미지용)
// multiple=true: 여러 장 체크 후 "선택 완료"로 한번에 반환 (카드뉴스 이미지용)
// 업로드(드래그앤드롭)는 아무나 가능, 해시태그 생성/수정/삭제는 canManage(편집장)만 가능 — SpecialCharacterModal과 동일한 권한 구조 (2026-09-11 확장)
//
// 2026-09-12 갤러리 기능 개편:
// - 업로드 시 여러 장에 해시태그를 "복수 선택"해서 한 번에 지정 (기존 쉼표 텍스트 입력 → 태그 칩 다중선택으로 교체)
// - 사진 캡션(제목)을 업로드 이후에도 개별로(펜 아이콘), 또는 여러 장을 선택해 한 번에 수정 가능
// - 사진을 여러 장 선택한 뒤 해시태그 칩 위로 드래그하면 그 태그가 일괄로 붙음 (선택 안 한 사진 1장만 드래그해도 그 1장만 적용)
// - 해시태그 칩을 클릭하면 그 태그가 붙은 사진만 보여주는 필터는 기존부터 있던 기능 그대로 유지
//
// 2026-09-12 (후속) 3건 추가 수정:
// - 사진 삭제 버튼 추가 (기존엔 API만 있고 이 모달에는 삭제 진입점이 없었음)
// - 펜 아이콘(캡션 수정)을 window.prompt 방식에서, 캡션+해시태그를 함께 고치는 인라인 편집 패널로 교체
//   → 드래그로 잘못 붙은 태그를 "그 사진 하나에서만" 빼거나 바꿀 방법이 없던 문제 해결(태그 이름수정/삭제는 태그 전체에 영향을 주므로 별개 문제였음)
// - 검색창이 파일명만 매칭하던 것을, 캡션(제목)·해시태그 이름까지 포함해서 검색되도록 서버 쿼리 확장
export type GalleryPickedPhoto = { url: string; title?: string | null };

export default function PhotoGalleryModal({
  open,
  onClose,
  onSelect,
  multiple = false,
  canManage = false,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (items: GalleryPickedPhoto[]) => void;
  multiple?: boolean;
  canManage?: boolean;
}) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [checked, setChecked] = useState<string[]>([]);

  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadSelectedTags, setUploadSelectedTags] = useState<string[]>([]);
  const [newUploadTagName, setNewUploadTagName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [newTagName, setNewTagName] = useState('');
  const [tagBusy, setTagBusy] = useState(false);

  const [bulkCaption, setBulkCaption] = useState('');
  const [bulkBusy, setBulkBusy] = useState(false);
  const [dragOverTagId, setDragOverTagId] = useState<string | null>(null);

  // 개별 사진 캡션+태그 편집 패널 (2026-09-12 — window.prompt 방식에서 교체)
  const [editingPhoto, setEditingPhoto] = useState<Photo | null>(null);
  // 워터마크 제거 편집기 — 갤러리에서 바로 열어 복제 도장으로 편집 후 같은 사진 레코드의 url만 교체 (2026-09-12 신설)
  const [watermarkPhoto, setWatermarkPhoto] = useState<Photo | null>(null);
  const [editCaption, setEditCaption] = useState('');
  const [editTags, setEditTags] = useState<string[]>([]);
  const [editNewTagName, setEditNewTagName] = useState('');
  const [editBusy, setEditBusy] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragPayloadRef = useRef<string[]>([]);

  async function loadTags() {
    const res = await fetch('/api/photo-tags');
    if (res.ok) setTags(await res.json());
  }

  async function loadPhotos() {
    setLoading(true);
    const params = new URLSearchParams();
    if (query.trim()) params.set('q', query.trim());
    if (activeTag) params.set('tag', activeTag);
    try {
      const res = await fetch(`/api/photos?${params.toString()}`);
      setPhotos(res.ok ? await res.json() : []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!open) return;
    setChecked([]);
    setUploadOpen(false);
    setErrorMsg('');
    setBulkCaption('');
    setUploadSelectedTags([]);
    loadTags();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    loadPhotos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, query, activeTag]);

  if (!open) return null;

  function toggleChecked(url: string) {
    setChecked((prev) => (prev.includes(url) ? prev.filter((u) => u !== url) : [...prev, url]));
  }

  function pick(photo: Photo) {
    if (multiple) {
      toggleChecked(photo.url);
      return;
    }
    // 캡션(제목)을 함께 넘겨야 본문/카드뉴스 삽입 시 캡션이 비어있지 않게 채워짐 (2026-09-12 수정)
    onSelect([{ url: photo.url, title: photo.title }]);
    onClose();
  }

  function idsFor(photo: Photo): string[] {
    // 드래그한 사진이 현재 선택(체크) 목록에 포함돼 있으면 선택된 것 전체를, 아니면 이 사진 1장만 대상으로 함
    if (checked.includes(photo.url) && checked.length > 0) {
      return photos.filter((p) => checked.includes(p.url)).map((p) => p.id);
    }
    return [photo.id];
  }

  async function uploadFiles(files: FileList | File[]) {
    const list = Array.from(files).filter((f) => f.type.startsWith('image/'));
    if (list.length === 0) return;
    setUploading(true);
    setErrorMsg('');
    try {
      for (const rawFile of list) {
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
          body: JSON.stringify({
            url: uploadData.url,
            filename: rawFile.name,
            title: uploadTitle.trim() || undefined,
            tags: uploadSelectedTags,
          }),
        });
      }
      await Promise.all([loadPhotos(), loadTags()]);
      setUploadTitle('');
      setUploadSelectedTags([]);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  function toggleUploadTag(name: string) {
    setUploadSelectedTags((prev) => (prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]));
  }

  function addNewUploadTag() {
    const name = newUploadTagName.trim();
    if (!name) return;
    if (!uploadSelectedTags.includes(name)) setUploadSelectedTags((prev) => [...prev, name]);
    setNewUploadTagName('');
  }

  function openEdit(photo: Photo) {
    setEditingPhoto(photo);
    setEditCaption(photo.title ?? '');
    setEditTags(photo.tags.map((t) => t.name));
    setEditNewTagName('');
  }

  function closeEdit() {
    setEditingPhoto(null);
    setEditNewTagName('');
  }

  function toggleEditTag(name: string) {
    setEditTags((prev) => (prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]));
  }

  function addNewEditTag() {
    const name = editNewTagName.trim();
    if (!name) return;
    if (!editTags.includes(name)) setEditTags((prev) => [...prev, name]);
    setEditNewTagName('');
  }

  async function saveEdit() {
    if (!editingPhoto) return;
    setEditBusy(true);
    try {
      await fetch(`/api/photos/${editingPhoto.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: editCaption.trim(), tagNames: editTags }),
      });
      closeEdit();
      await Promise.all([loadPhotos(), loadTags()]);
    } finally {
      setEditBusy(false);
    }
  }

  async function deletePhoto(photo: Photo) {
    if (!window.confirm('이 사진을 삭제할까요? 삭제하면 되돌릴 수 없습니다.')) return;
    const res = await fetch(`/api/photos/${photo.id}`, { method: 'DELETE' });
    if (res.ok) {
      setPhotos((prev) => prev.filter((p) => p.id !== photo.id));
      setChecked((prev) => prev.filter((u) => u !== photo.url));
      if (editingPhoto?.id === photo.id) closeEdit();
    } else {
      const data = await res.json().catch(() => ({}));
      window.alert(data.error ?? '삭제에 실패했습니다');
    }
  }

  async function applyBulkCaption() {
    const trimmed = bulkCaption.trim();
    if (!trimmed || checked.length === 0) return;
    setBulkBusy(true);
    try {
      const ids = photos.filter((p) => checked.includes(p.url)).map((p) => p.id);
      await fetch('/api/photos/bulk', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photoIds: ids, title: trimmed }),
      });
      setBulkCaption('');
      await loadPhotos();
    } finally {
      setBulkBusy(false);
    }
  }

  async function applyTagToIds(ids: string[], tagName: string) {
    if (ids.length === 0) return;
    await fetch('/api/photos/bulk', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ photoIds: ids, addTagNames: [tagName] }),
    });
    await Promise.all([loadPhotos(), loadTags()]);
  }

  async function addTag() {
    const name = newTagName.trim();
    if (!name) return;
    setTagBusy(true);
    try {
      const res = await fetch('/api/photo-tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (res.ok) {
        setNewTagName('');
        await loadTags();
      }
    } finally {
      setTagBusy(false);
    }
  }

  async function renameTag(tag: Tag) {
    const next = window.prompt('새 태그 이름', tag.name);
    if (!next || !next.trim() || next.trim() === tag.name) return;
    setTagBusy(true);
    try {
      const res = await fetch(`/api/photo-tags/${tag.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: next.trim() }),
      });
      if (res.ok) {
        if (activeTag === tag.name) setActiveTag(next.trim());
        await Promise.all([loadTags(), loadPhotos()]);
      }
    } finally {
      setTagBusy(false);
    }
  }

  async function deleteTag(tag: Tag) {
    if (!window.confirm(`"#${tag.name}" 태그를 삭제할까요? 사진에서도 함께 제거됩니다.`)) return;
    setTagBusy(true);
    try {
      const res = await fetch(`/api/photo-tags/${tag.id}`, { method: 'DELETE' });
      if (res.ok) {
        if (activeTag === tag.name) setActiveTag(null);
        await Promise.all([loadTags(), loadPhotos()]);
      }
    } finally {
      setTagBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl w-full max-w-5xl max-h-[85vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-bold text-gray-900">사진 갤러리에서 선택</h3>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setUploadOpen((v) => !v)}
              className={`text-xs font-bold rounded-full px-3 py-1.5 border ${
                uploadOpen ? 'bg-brand text-white border-brand' : 'bg-white text-gray-600 border-gray-200 hover:border-brand'
              }`}
            >
              📤 업로드
            </button>
            <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">
              ✕
            </button>
          </div>
        </div>

        {uploadOpen && (
          <div className="p-4 border-b border-gray-100 bg-gray-50 space-y-2">
            <input
              value={uploadTitle}
              onChange={(e) => setUploadTitle(e.target.value)}
              placeholder="캡션 설명 (선택 · 업로드하는 모든 사진에 동일하게 적용됩니다)"
              className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-brand"
            />
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-gray-400 shrink-0">해시태그(복수 선택 가능):</span>
              {tags.map((t) => {
                const active = uploadSelectedTags.includes(t.name);
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => toggleUploadTag(t.name)}
                    className={`text-xs font-bold rounded-full px-2.5 py-1 border ${
                      active ? 'bg-brand text-white border-brand' : 'bg-white text-gray-500 border-gray-200'
                    }`}
                  >
                    #{t.name}
                  </button>
                );
              })}
              <input
                value={newUploadTagName}
                onChange={(e) => setNewUploadTagName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addNewUploadTag();
                  }
                }}
                placeholder="+ 새 태그 입력 후 Enter"
                className="w-32 text-xs border border-dashed border-gray-300 rounded-full px-2.5 py-1 outline-none focus:border-brand"
              />
            </div>
            {uploadSelectedTags.length > 0 && (
              <p className="text-[11px] text-gray-400">
                이번 업로드에 적용될 태그: {uploadSelectedTags.map((n) => `#${n}`).join(' ')}
              </p>
            )}
            <div
              onDragOver={(e: React.DragEvent<HTMLDivElement>) => {
                e.preventDefault();
                setDragActive(true);
              }}
              onDragLeave={() => setDragActive(false)}
              onDrop={(e: React.DragEvent<HTMLDivElement>) => {
                e.preventDefault();
                setDragActive(false);
                if (e.dataTransfer.files?.length) uploadFiles(e.dataTransfer.files);
              }}
              onClick={() => fileInputRef.current?.click()}
              className={`rounded-xl border-2 border-dashed px-4 py-6 text-center text-sm cursor-pointer transition-colors ${
                dragActive ? 'border-brand bg-brand/5 text-brand' : 'border-gray-300 text-gray-400 hover:border-brand'
              }`}
            >
              {uploading ? '업로드 중…' : '여기로 사진을 드래그하거나 클릭해서 선택하세요 (여러 장 가능)'}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => e.target.files && uploadFiles(e.target.files)}
              />
            </div>
            {errorMsg && <p className="text-red-600 text-xs">{errorMsg}</p>}
          </div>
        )}

        <div className="p-4 border-b border-gray-100 space-y-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="파일명·캡션·해시태그로 검색"
            className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-brand"
          />
          <div className="flex flex-wrap items-center gap-1.5">
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
              <span
                key={t.id}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOverTagId(t.id);
                }}
                onDragLeave={() => setDragOverTagId((cur) => (cur === t.id ? null : cur))}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOverTagId(null);
                  if (dragPayloadRef.current.length > 0) applyTagToIds(dragPayloadRef.current, t.name);
                }}
                title="사진을 이 태그 위로 드래그하면 일괄로 태그가 붙습니다"
                className={`inline-flex items-center gap-0.5 text-xs font-bold rounded-full pl-3 pr-1 py-1 border transition-shadow ${
                  activeTag === t.name ? 'bg-brand text-white border-brand' : 'bg-white text-gray-500 border-gray-200'
                } ${dragOverTagId === t.id ? 'ring-2 ring-brand ring-offset-1' : ''}`}
              >
                <button type="button" onClick={() => setActiveTag(t.name === activeTag ? null : t.name)}>
                  #{t.name}
                </button>
                {canManage && (
                  <>
                    <button
                      type="button"
                      title="이름 수정"
                      disabled={tagBusy}
                      onClick={() => renameTag(t)}
                      className="w-4 h-4 rounded-full hover:bg-black/10 text-[10px] leading-4"
                    >
                      ✎
                    </button>
                    <button
                      type="button"
                      title="삭제"
                      disabled={tagBusy}
                      onClick={() => deleteTag(t)}
                      className="w-4 h-4 rounded-full hover:bg-black/10 text-[10px] leading-4"
                    >
                      ✕
                    </button>
                  </>
                )}
              </span>
            ))}
            {canManage && (
              <input
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addTag()}
                placeholder="+ 새 태그"
                className="w-24 text-xs border border-dashed border-gray-300 rounded-full px-2.5 py-1 outline-none focus:border-brand"
              />
            )}
          </div>
        </div>

        {editingPhoto && (
          <div className="p-4 border-b border-gray-100 bg-gray-50 space-y-2">
            <div className="flex items-start gap-3">
              <img
                src={editingPhoto.url}
                alt={editingPhoto.title ?? ''}
                className="w-16 h-16 rounded-lg object-cover border border-gray-200 shrink-0"
              />
              <div className="flex-1 space-y-2">
                <input
                  value={editCaption}
                  onChange={(e) => setEditCaption(e.target.value)}
                  placeholder="캡션 설명"
                  className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-brand"
                />
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs text-gray-400 shrink-0">해시태그(복수 선택 가능):</span>
                  {tags.map((t) => {
                    const active = editTags.includes(t.name);
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => toggleEditTag(t.name)}
                        className={`text-xs font-bold rounded-full px-2.5 py-1 border ${
                          active ? 'bg-brand text-white border-brand' : 'bg-white text-gray-500 border-gray-200'
                        }`}
                      >
                        #{t.name}
                      </button>
                    );
                  })}
                  <input
                    value={editNewTagName}
                    onChange={(e) => setEditNewTagName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addNewEditTag();
                      }
                    }}
                    placeholder="+ 새 태그 입력 후 Enter"
                    className="w-32 text-xs border border-dashed border-gray-300 rounded-full px-2.5 py-1 outline-none focus:border-brand"
                  />
                </div>
                <p className="text-[11px] text-gray-400">
                  체크를 해제하면 그 사진에서만 태그가 빠집니다(태그 자체는 삭제되지 않음).
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={closeEdit}
                className="text-xs font-bold text-gray-500 rounded-full px-3 py-1.5 border border-gray-200"
              >
                취소
              </button>
              <button
                type="button"
                disabled={editBusy}
                onClick={saveEdit}
                className="text-xs font-bold text-white bg-brand rounded-full px-4 py-1.5 disabled:opacity-50"
              >
                저장
              </button>
            </div>
          </div>
        )}

        {multiple && checked.length > 0 && (
          <div className="px-4 py-2.5 border-b border-gray-100 bg-brand/5 flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-gray-700 shrink-0">선택 {checked.length}장</span>
            <input
              value={bulkCaption}
              onChange={(e) => setBulkCaption(e.target.value)}
              placeholder="선택한 사진에 캡션 일괄 적용"
              className="flex-1 min-w-[160px] border border-gray-200 rounded-lg px-3 py-1.5 text-xs outline-none focus:border-brand"
            />
            <button
              type="button"
              disabled={bulkBusy || !bulkCaption.trim()}
              onClick={applyBulkCaption}
              className="text-xs font-bold text-white bg-brand rounded-full px-3 py-1.5 disabled:opacity-50 shrink-0"
            >
              캡션 일괄 적용
            </button>
            <span className="text-[11px] text-gray-400 shrink-0">태그는 위 해시태그 위로 드래그하면 일괄로 붙습니다</span>
          </div>
        )}

        <div className="p-4 overflow-y-auto flex-1">
          {loading && <p className="text-sm text-gray-400">불러오는 중…</p>}
          {!loading && photos.length === 0 && (
            <p className="text-sm text-gray-400">등록된 사진이 없습니다.</p>
          )}
          <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-2">
            {photos.map((p) => {
              const isChecked = checked.includes(p.url);
              const category = p.tags[0]?.name;
              return (
                <div
                  key={p.id}
                  role="button"
                  tabIndex={0}
                  draggable
                  onDragStart={() => {
                    dragPayloadRef.current = idsFor(p);
                  }}
                  onDragEnd={() => {
                    dragPayloadRef.current = [];
                  }}
                  onClick={() => pick(p)}
                  onKeyDown={(e) => e.key === 'Enter' && pick(p)}
                  className={`group relative aspect-square rounded-lg overflow-hidden border-2 cursor-pointer ${
                    isChecked ? 'border-brand' : 'border-transparent'
                  }`}
                  title={[p.title, p.tags.map((t) => `#${t.name}`).join(' ')].filter(Boolean).join(' · ')}
                >
                  <img src={p.url} alt={p.title ?? p.filename ?? ''} className="w-full h-full object-cover" draggable={false} />
                  {category && (
                    <span className="absolute bottom-0 left-0 right-0 bg-black/55 text-white text-[10px] font-bold px-1.5 py-0.5 truncate text-left">
                      #{category}
                    </span>
                  )}
                  <button
                    type="button"
                    title="캡션·태그 수정"
                    onClick={(e) => {
                      e.stopPropagation();
                      openEdit(p);
                    }}
                    className="absolute top-1 left-1 w-5 h-5 rounded-full bg-black/50 text-white text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    ✎
                  </button>
                  <button
                    type="button"
                    title="워터마크·불필요한 부분 지우기"
                    onClick={(e) => {
                      e.stopPropagation();
                      setWatermarkPhoto(p);
                    }}
                    className="absolute top-1 left-7 w-5 h-5 rounded-full bg-black/50 text-white text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    🩹
                  </button>
                  <button
                    type="button"
                    title="사진 삭제"
                    onClick={(e) => {
                      e.stopPropagation();
                      deletePhoto(p);
                    }}
                    className="absolute bottom-1 right-1 w-5 h-5 rounded-full bg-black/50 text-white text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    🗑
                  </button>
                  {isChecked && (
                    <span className="absolute top-1 right-1 w-5 h-5 rounded-full bg-brand text-white text-xs flex items-center justify-center">
                      ✓
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {multiple && (
          <div className="p-4 border-t border-gray-100 flex justify-end">
            <button
              type="button"
              disabled={checked.length === 0}
              onClick={() => {
                const items = photos.filter((p) => checked.includes(p.url)).map((p) => ({ url: p.url, title: p.title }));
                onSelect(items);
                onClose();
              }}
              className="text-sm font-bold text-white bg-brand rounded-full px-5 py-2 disabled:opacity-50"
            >
              선택 완료 ({checked.length})
            </button>
          </div>
        )}
      </div>

      {watermarkPhoto && (
        <PhotoWatermarkEditor
          photo={watermarkPhoto}
          onClose={() => setWatermarkPhoto(null)}
          onSaved={(updated) => {
            setPhotos((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
            setWatermarkPhoto(null);
          }}
        />
      )}
    </div>
  );
}
