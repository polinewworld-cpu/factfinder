'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { compressImageFile } from '@/lib/imageCompress';
import PhotoWatermarkEditor from './PhotoWatermarkEditor';
import {
  LICENSE_OPTIONS,
  PHOTOGRAPHER_HINT,
  SOURCE_LABEL,
  SOURCE_TYPES,
  autoCredit,
  blockedAgency,
  checkPhotoInput,
  type SourceType,
} from '@/lib/photoBankRules';
import { closeOnBackdrop } from '@/lib/backdrop';

// 사진 뱅크 (2026-10-09, 기능정의 v0.1) — 관리자 "사진 뱅크" 화면과 기사 작성 화면의 "사진 뱅크에서 고르기" 창이 함께 쓴다.
// 기존 갤러리(사진·해시태그·워터마크 지우기)를 확장: 출처 유형·라이선스·크레디트·인물·상황 태그·사용 이력. (AI 재구성 기능은 10-09 삭제)
// mode="pick": 기사에 넣을 사진 고르기 / mode="manage": 관리

export type Person = { id: string; name: string; aliases: string | null; affiliation: string | null; title: string | null; _count?: { photos: number } };
type Tag = { id: string; name: string };
export type BankPhoto = {
  id: string;
  url: string;
  filename: string | null;
  title: string | null;
  uploaderId: string;
  createdAt: string;
  sourceType: SourceType | null;
  license: string | null;
  sourceUrl: string | null;
  viaArticleUrl: string | null;
  takenAt: string | null;
  photographer: string | null;
  credit: string | null;
  tags: Tag[];
  people: Person[];
  uploader?: { name: string | null; nickname: string | null };
  _count?: { usages: number };
};
type Detail = BankPhoto & { usages: { id: string; firstUsedAt: string; article: { id: string; title: string; status: string; publishedAt: string | null } }[] };
export type PickedPhoto = { url: string; title: string | null; credit: string | null; sourceType: string | null };

const ymd = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' }) : '');
const BADGE: Record<string, string> = {
  KOGL: '#1f6f8b',
  PARTY: '#6b4fa0',
  PUBLIC_DOMAIN: '#3b7d4f',
  CC: '#a0662a',
  OWN: '#0d4f55',
};

// ── 출처 정보 입력 폼 (등록·수정 공용) ──
type Meta = {
  sourceType: SourceType | '';
  license: string;
  sourceUrl: string;
  viaArticleUrl: string;
  takenAt: string;
  photographer: string;
  credit: string;
  creditTouched: boolean;
  title: string;
  peopleIds: string[];
  tagNames: string[];
};
const emptyMeta = (): Meta => ({ sourceType: '', license: '', sourceUrl: '', viaArticleUrl: '', takenAt: '', photographer: '', credit: '', creditTouched: false, title: '', peopleIds: [], tagNames: [] });
const metaOf = (p: BankPhoto): Meta => ({
  sourceType: p.sourceType ?? '',
  license: p.license ?? '',
  sourceUrl: p.sourceUrl ?? '',
  viaArticleUrl: p.viaArticleUrl ?? '',
  takenAt: ymd(p.takenAt),
  photographer: p.photographer ?? '',
  credit: p.credit ?? '',
  creditTouched: !!p.credit,
  title: p.title ?? '',
  peopleIds: p.people.map((x) => x.id),
  tagNames: p.tags.map((t) => t.name),
});
const metaBody = (m: Meta) => ({
  sourceType: m.sourceType || null,
  license: m.license,
  sourceUrl: m.sourceUrl,
  viaArticleUrl: m.viaArticleUrl,
  takenAt: m.takenAt,
  photographer: m.photographer,
  credit: m.credit,
  title: m.title,
  peopleIds: m.peopleIds,
  tagNames: m.tagNames,
});

const input = 'w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-brand bg-white';

function Chips({ items, selected, onToggle }: { items: { key: string; label: string }[]; selected: string[]; onToggle: (k: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((it) => {
        const on = selected.includes(it.key);
        return (
          <button
            key={it.key}
            type="button"
            onClick={() => onToggle(it.key)}
            className={`text-xs rounded-lg px-2.5 py-1 border ${on ? 'bg-brand text-white border-brand font-bold' : 'bg-white text-gray-600 border-gray-200'}`}
          >
            {it.label}
          </button>
        );
      })}
    </div>
  );
}

function MetaForm({ meta, setMeta, people, tags }: { meta: Meta; setMeta: (m: Meta) => void; people: Person[]; tags: Tag[] }) {
  const set = (patch: Partial<Meta>) => {
    const next = { ...meta, ...patch };
    // 크레디트는 직접 고치기 전까지 출처 유형·촬영자·라이선스로 자동
    if (!next.creditTouched) next.credit = autoCredit(next.sourceType, next.photographer, next.license);
    setMeta(next);
  };
  const toggle = (arr: string[], k: string) => (arr.includes(k) ? arr.filter((x) => x !== k) : [...arr, k]);
  const licenses = meta.sourceType ? LICENSE_OPTIONS[meta.sourceType] : undefined;
  const blocked = blockedAgency(meta.credit, meta.title, meta.photographer);
  const [peopleQuery, setPeopleQuery] = useState('');
  const shownPeople = people.filter(
    (p) => meta.peopleIds.includes(p.id) || !peopleQuery.trim() || `${p.name} ${p.aliases ?? ''} ${p.affiliation ?? ''}`.includes(peopleQuery.trim()),
  );

  return (
    <div className="space-y-3 text-sm">
      <div>
        <p className="text-xs font-semibold text-gray-600 mb-1">
          출처 유형 <span className="text-red-600">*</span>
        </p>
        <Chips
          items={SOURCE_TYPES.map((t) => ({ key: t, label: SOURCE_LABEL[t] }))}
          selected={meta.sourceType ? [meta.sourceType] : []}
          onToggle={(k) => set({ sourceType: k as SourceType, license: '' })}
        />
      </div>
      <div className="grid sm:grid-cols-2 gap-2">
        <label className="block">
          <span className="text-xs text-gray-500">라이선스 세부</span>
          {licenses ? (
            <select value={meta.license} onChange={(e) => set({ license: e.target.value })} className={input}>
              <option value="">선택</option>
              {licenses.map((l) => (
                <option key={l}>{l}</option>
              ))}
            </select>
          ) : (
            <input value={meta.license} onChange={(e) => set({ license: e.target.value })} className={input} placeholder="(해당 시)" />
          )}
        </label>
        <label className="block">
          <span className="text-xs text-gray-500">촬영자·기관</span>
          <input
            value={meta.photographer}
            onChange={(e) => set({ photographer: e.target.value })}
            className={input}
            placeholder={meta.sourceType ? PHOTOGRAPHER_HINT[meta.sourceType] : ''}
          />
        </label>
        <label className="block">
          <span className="text-xs text-gray-500">촬영일</span>
          <input type="date" value={meta.takenAt} onChange={(e) => set({ takenAt: e.target.value })} className={input} />
        </label>
        <label className="block">
          <span className="text-xs text-gray-500">크레디트 (자동 · 고칠 수 있음)</span>
          <input value={meta.credit} onChange={(e) => setMeta({ ...meta, credit: e.target.value, creditTouched: true })} className={input} placeholder="사진=○○" />
        </label>
        <label className="block">
          <span className="text-xs text-gray-500">원본 URL (가져온 페이지)</span>
          <input value={meta.sourceUrl} onChange={(e) => set({ sourceUrl: e.target.value })} className={input} placeholder="https://" />
        </label>
        <label className="block">
          <span className="text-xs text-gray-500">경유 기사 (타 언론 &quot;제공&quot; 사진이면)</span>
          <input value={meta.viaArticleUrl} onChange={(e) => set({ viaArticleUrl: e.target.value })} className={input} placeholder="https://" />
        </label>
      </div>
      <label className="block">
        <span className="text-xs text-gray-500">캡션 초안</span>
        <input value={meta.title} onChange={(e) => set({ title: e.target.value })} className={input} placeholder="예) 홍길동 의원이 9일 국회에서 기자회견을 하고 있다" />
      </label>
      <div>
        <p className="text-xs text-gray-500 mb-1">인물 (여러 명)</p>
        {people.length > 8 && <input value={peopleQuery} onChange={(e) => setPeopleQuery(e.target.value)} className={`${input} mb-1.5`} placeholder="인물 찾기" />}
        {people.length ? (
          <Chips
            items={shownPeople.map((p) => ({ key: p.id, label: p.name }))}
            selected={meta.peopleIds}
            onToggle={(k) => set({ peopleIds: toggle(meta.peopleIds, k) })}
          />
        ) : (
          <p className="text-xs text-gray-400">등록된 인물이 없습니다 (편집장이 인물 목록에 추가)</p>
        )}
      </div>
      <div>
        <p className="text-xs text-gray-500 mb-1">상황 태그</p>
        <Chips items={tags.map((t) => ({ key: t.name, label: t.name }))} selected={meta.tagNames} onToggle={(k) => set({ tagNames: toggle(meta.tagNames, k) })} />
      </div>
      {blocked && <p className="text-xs font-semibold text-red-600">{blocked} 사진은 사진 뱅크에 넣을 수 없습니다.</p>}
    </div>
  );
}

// ── 등록 (파일·끌어다 놓기·이미지 URL) ──
type Staged = { key: string; preview: string; file?: File; url?: string; name: string };

function RegisterPanel({ people, tags, onDone }: { people: Person[]; tags: Tag[]; onDone: () => void }) {
  const [staged, setStaged] = useState<Staged[]>([]);
  const [meta, setMeta] = useState<Meta>(emptyMeta());
  const [urlInput, setUrlInput] = useState('');
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  function addFiles(files: FileList | File[]) {
    const list = Array.from(files).filter((f) => f.type.startsWith('image/'));
    setStaged((s) => [...s, ...list.map((f) => ({ key: `${f.name}-${f.size}-${Math.random()}`, preview: URL.createObjectURL(f), file: f, name: f.name }))]);
  }
  function addUrl() {
    const u = urlInput.trim();
    if (!/^https?:\/\//.test(u)) return setMsg('http(s)로 시작하는 이미지 주소를 넣으세요.');
    setStaged((s) => [...s, { key: u + Math.random(), preview: u, url: u, name: u.split('/').pop() || u }]);
    setUrlInput('');
    setMsg('');
    if (!meta.sourceUrl) setMeta({ ...meta, sourceUrl: u });
  }

  async function register() {
    const bad = checkPhotoInput(meta);
    if (bad) return setMsg(bad);
    if (!staged.length) return setMsg('사진을 먼저 넣으세요.');
    setBusy(true);
    setMsg('');
    let ok = 0;
    const failed: Staged[] = [];
    for (const it of staged) {
      try {
        let stored: { url: string; filename?: string; hash?: string };
        if (it.file) {
          const form = new FormData();
          form.append('file', await compressImageFile(it.file));
          const r = await fetch('/api/upload', { method: 'POST', body: form });
          const d = await r.json();
          if (!r.ok) throw new Error(d.error);
          stored = { url: d.url, filename: it.name };
        } else {
          const r = await fetch('/api/photos/from-url', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: it.url }) });
          const d = await r.json();
          if (!r.ok) throw new Error(d.error);
          stored = d;
        }
        const { tagNames, ...rest } = metaBody(meta);
        const r = await fetch('/api/photos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...rest, tags: tagNames, url: stored.url, filename: stored.filename ?? it.name, hash: stored.hash }),
        });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        ok++;
      } catch (e) {
        failed.push(it);
        setMsg(e instanceof Error && e.message ? e.message : '등록 실패');
      }
    }
    setBusy(false);
    setStaged(failed);
    if (ok) {
      if (!failed.length) setMeta(emptyMeta());
      onDone();
    }
  }

  return (
    <div className="border rounded-xl p-4 bg-gray-50 space-y-3">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
        }}
        onClick={() => fileRef.current?.click()}
        className={`rounded-xl border-2 border-dashed px-4 py-5 text-center text-sm cursor-pointer ${drag ? 'border-brand bg-brand/5 text-brand' : 'border-gray-300 text-gray-500 bg-white'}`}
      >
        사진을 여기로 끌어다 놓거나 클릭해서 고르세요 (여러 장)
        <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => e.target.files && addFiles(e.target.files)} />
      </div>
      <div className="flex gap-2">
        <input value={urlInput} onChange={(e) => setUrlInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addUrl()} className={input} placeholder="또는 이미지 URL 붙여넣기 (jpg·png 직접 주소)" />
        <button type="button" onClick={addUrl} className="text-xs border rounded-lg px-3 shrink-0 bg-white">
          추가
        </button>
      </div>
      {staged.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {staged.map((s) => (
            <div key={s.key} className="relative w-20 h-20">
              <img src={s.preview} alt="" className="w-full h-full object-cover rounded-lg border" />
              <button
                type="button"
                onClick={() => setStaged((x) => x.filter((y) => y.key !== s.key))}
                className="absolute top-0.5 right-0.5 w-5 h-5 rounded bg-black/60 text-white text-xs"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
      <p className="text-xs text-gray-500">아래 정보는 이번에 넣는 사진 {staged.length || ''}장 모두에 똑같이 들어갑니다.</p>
      <MetaForm meta={meta} setMeta={setMeta} people={people} tags={tags} />
      {msg && <p className="text-xs text-red-600">{msg}</p>}
      <button type="button" disabled={busy || !staged.length} onClick={register} className="text-sm font-bold text-white bg-brand rounded-lg px-5 py-2 disabled:opacity-40">
        {busy ? '등록 중…' : `사진 뱅크에 등록${staged.length ? ` (${staged.length}장)` : ''}`}
      </button>
    </div>
  );
}

// ── 인물·상황 태그 관리 (편집장) ──
function ManagePanel({ people, tags, reload }: { people: Person[]; tags: Tag[]; reload: () => void }) {
  const blank = { id: '', name: '', aliases: '', affiliation: '', title: '' };
  const [form, setForm] = useState(blank);
  const [newTag, setNewTag] = useState('');
  const [msg, setMsg] = useState('');

  async function savePerson() {
    setMsg('');
    const res = await fetch('/api/people', { method: form.id ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    if (!res.ok) return setMsg((await res.json().catch(() => ({}))).error ?? '저장 실패');
    setForm(blank);
    reload();
  }
  async function delPerson(p: Person) {
    if (!confirm(`인물 "${p.name}"을(를) 목록에서 지울까요? 사진은 남고 이 인물 태그만 빠집니다.`)) return;
    await fetch(`/api/people?id=${p.id}`, { method: 'DELETE' });
    reload();
  }
  async function addTag() {
    if (!newTag.trim()) return;
    await fetch('/api/photo-tags', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: newTag.trim() }) });
    setNewTag('');
    reload();
  }
  async function renameTag(t: Tag) {
    const next = prompt('새 이름', t.name)?.trim();
    if (!next || next === t.name) return;
    await fetch(`/api/photo-tags/${t.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: next }) });
    reload();
  }
  async function delTag(t: Tag) {
    if (!confirm(`상황 태그 "${t.name}"을(를) 지울까요? 사진에서도 빠집니다.`)) return;
    await fetch(`/api/photo-tags/${t.id}`, { method: 'DELETE' });
    reload();
  }

  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <section className="border rounded-xl p-4">
        <h3 className="text-sm font-bold mb-2">인물 목록 ({people.length})</h3>
        <div className="grid grid-cols-2 gap-2 mb-2">
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={input} placeholder="이름 *" />
          <input value={form.aliases} onChange={(e) => setForm({ ...form, aliases: e.target.value })} className={input} placeholder="별칭 (쉼표로)" />
          <input value={form.affiliation} onChange={(e) => setForm({ ...form, affiliation: e.target.value })} className={input} placeholder="소속" />
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={input} placeholder="직함" />
        </div>
        <div className="flex gap-2 mb-3">
          <button type="button" onClick={savePerson} className="text-xs font-bold text-white bg-brand rounded-lg px-3 py-1.5">
            {form.id ? '수정 저장' : '인물 추가'}
          </button>
          {form.id && (
            <button type="button" onClick={() => setForm(blank)} className="text-xs border rounded-lg px-3 py-1.5">
              취소
            </button>
          )}
          {msg && <span className="text-xs text-red-600 self-center">{msg}</span>}
        </div>
        <ul className="divide-y max-h-80 overflow-y-auto text-sm">
          {people.map((p) => (
            <li key={p.id} className="py-1.5 flex items-center gap-2">
              <span className="flex-1 min-w-0 truncate">
                <b>{p.name}</b>
                <span className="text-xs text-gray-500">
                  {[p.affiliation, p.title].filter(Boolean).length ? ` · ${[p.affiliation, p.title].filter(Boolean).join(' ')}` : ''}
                  {p.aliases ? ` · 별칭 ${p.aliases}` : ''} · 사진 {p._count?.photos ?? 0}
                </span>
              </span>
              <button type="button" onClick={() => setForm({ id: p.id, name: p.name, aliases: p.aliases ?? '', affiliation: p.affiliation ?? '', title: p.title ?? '' })} className="text-xs text-gray-500">
                수정
              </button>
              <button type="button" onClick={() => delPerson(p)} className="text-xs text-red-600">
                삭제
              </button>
            </li>
          ))}
        </ul>
      </section>
      <section className="border rounded-xl p-4">
        <h3 className="text-sm font-bold mb-2">상황 태그 ({tags.length})</h3>
        <div className="flex gap-2 mb-3">
          <input value={newTag} onChange={(e) => setNewTag(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addTag()} className={input} placeholder="새 상황 태그" />
          <button type="button" onClick={addTag} className="text-xs font-bold text-white bg-brand rounded-lg px-3 shrink-0">
            추가
          </button>
        </div>
        <ul className="flex flex-wrap gap-1.5">
          {tags.map((t) => (
            <li key={t.id} className="inline-flex items-center gap-1 border rounded-lg pl-2.5 pr-1 py-1 text-xs">
              {t.name}
              <button type="button" onClick={() => renameTag(t)} title="이름 수정" className="px-1 text-gray-500">
                ✎
              </button>
              <button type="button" onClick={() => delTag(t)} title="삭제" className="px-1 text-gray-500">
                ✕
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

// ── 상세 (정보·수정·사용 이력·크레디트 복사·워터마크·삭제) ──
function DetailPanel({
  id,
  people,
  tags,
  isChief,
  pickLabel,
  onPick,
  onClose,
  onChanged,
}: {
  id: string;
  people: Person[];
  tags: Tag[];
  isChief: boolean;
  pickLabel?: string;
  onPick?: (p: BankPhoto) => void;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [d, setD] = useState<Detail | null>(null);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [editing, setEditing] = useState(false);
  const [msg, setMsg] = useState('');
  const [copied, setCopied] = useState(false);
  const [watermark, setWatermark] = useState(false);

  async function load() {
    const res = await fetch(`/api/photos/${id}`);
    if (res.ok) {
      const data = await res.json();
      setD(data);
      setMeta(metaOf(data));
    }
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function save() {
    if (!meta) return;
    const bad = checkPhotoInput(meta);
    if (bad) return setMsg(bad);
    const res = await fetch(`/api/photos/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(metaBody(meta)) });
    if (!res.ok) return setMsg((await res.json().catch(() => ({}))).error ?? '저장 실패');
    setMsg('');
    setEditing(false);
    await load();
    onChanged();
  }
  async function remove() {
    if (!confirm('이 사진을 사진 뱅크에서 삭제할까요? 되돌릴 수 없습니다. (이미 기사에 들어간 사진은 기사에 그대로 남습니다)')) return;
    const res = await fetch(`/api/photos/${id}`, { method: 'DELETE' });
    if (res.ok) {
      onChanged();
      onClose();
    } else setMsg((await res.json().catch(() => ({}))).error ?? '삭제 실패');
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-[55] flex justify-end" {...closeOnBackdrop(onClose)}>
      <div className="bg-white w-full max-w-xl h-full overflow-y-auto p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-bold">사진 정보</h3>
          <button type="button" onClick={onClose} className="text-gray-400 text-lg">
            ✕
          </button>
        </div>
        {!d || !meta ? (
          <p className="text-sm text-gray-400">불러오는 중…</p>
        ) : (
          <>
            <img src={d.url} alt={d.title ?? ''} className="w-full rounded-lg border" />
            {onPick &&
              (d.sourceType ? (
                <button type="button" onClick={() => onPick(d)} className="w-full text-sm font-bold text-white bg-brand rounded-lg py-2.5">
                  {pickLabel ?? '이 사진 넣기'}
                </button>
              ) : (
                <p className="text-sm font-semibold text-amber-700 border border-amber-200 bg-amber-50 rounded-lg p-2.5">
                  출처가 확인되지 않은 사진이라 기사에 넣을 수 없습니다. [정보 수정]에서 출처 유형을 넣으면 넣을 수 있습니다.
                </p>
              ))}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={!d.credit}
                onClick={() => navigator.clipboard.writeText(d.credit ?? '').then(() => (setCopied(true), setTimeout(() => setCopied(false), 1500)))}
                className="text-xs border rounded-lg px-3 py-1.5 disabled:opacity-40"
              >
                {copied ? '복사됨' : '크레디트 복사'}
              </button>
              <button type="button" onClick={() => setEditing((v) => !v)} className="text-xs border rounded-lg px-3 py-1.5">
                {editing ? '수정 닫기' : '정보 수정'}
              </button>
              <button type="button" onClick={() => setWatermark(true)} className="text-xs border rounded-lg px-3 py-1.5">
                워터마크 지우기
              </button>
              {isChief && (
                <button type="button" onClick={remove} className="text-xs border border-red-200 text-red-600 rounded-lg px-3 py-1.5">
                  삭제
                </button>
              )}
            </div>
            {msg && <p className="text-xs text-red-600">{msg}</p>}

            {editing ? (
              <div className="space-y-3">
                <MetaForm meta={meta} setMeta={setMeta} people={people} tags={tags} />
                <button type="button" onClick={save} className="text-sm font-bold text-white bg-brand rounded-lg px-5 py-2">
                  저장
                </button>
              </div>
            ) : (
              <dl className="grid grid-cols-[88px_1fr] gap-x-3 gap-y-1.5 text-sm">
                <dt className="text-gray-500">출처 유형</dt>
                <dd>{d.sourceType ? SOURCE_LABEL[d.sourceType] : <span className="text-red-600">출처 미입력 — 정보 수정에서 입력하세요</span>}</dd>
                <dt className="text-gray-500">라이선스</dt>
                <dd>{d.license || '-'}</dd>
                <dt className="text-gray-500">크레디트</dt>
                <dd>{d.credit || '-'}</dd>
                <dt className="text-gray-500">캡션</dt>
                <dd>{d.title || '-'}</dd>
                <dt className="text-gray-500">촬영일</dt>
                <dd>{ymd(d.takenAt) || '-'}</dd>
                <dt className="text-gray-500">촬영자·기관</dt>
                <dd>{d.photographer || '-'}</dd>
                <dt className="text-gray-500">인물</dt>
                <dd>{d.people.map((p) => p.name).join(', ') || '-'}</dd>
                <dt className="text-gray-500">상황 태그</dt>
                <dd>{d.tags.map((t) => t.name).join(', ') || '-'}</dd>
                <dt className="text-gray-500">원본 URL</dt>
                <dd className="break-all">
                  {d.sourceUrl ? (
                    <a href={d.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline">
                      {d.sourceUrl}
                    </a>
                  ) : (
                    '-'
                  )}
                </dd>
                <dt className="text-gray-500">경유 기사</dt>
                <dd className="break-all">
                  {d.viaArticleUrl ? (
                    <a href={d.viaArticleUrl} target="_blank" rel="noopener noreferrer" className="underline">
                      {d.viaArticleUrl}
                    </a>
                  ) : (
                    '-'
                  )}
                </dd>
                <dt className="text-gray-500">등록</dt>
                <dd>
                  {d.uploader?.nickname || d.uploader?.name || '-'} · {ymd(d.createdAt)}
                </dd>
              </dl>
            )}

            <div>
              <p className="text-xs font-semibold text-gray-600 mb-1">사용된 기사 ({d.usages.length})</p>
              {d.usages.length ? (
                <ul className="text-sm space-y-1">
                  {d.usages.map((u) => (
                    <li key={u.id} className="flex gap-2">
                      <span className="text-xs text-gray-400 shrink-0 w-20">{ymd(u.firstUsedAt)}</span>
                      <a href={u.article.status === 'PUBLISHED' ? `/article/${u.article.id}` : `/write?id=${u.article.id}`} target="_blank" rel="noopener noreferrer" className="underline truncate">
                        {u.article.title || '(제목 없음)'}
                      </a>
                      {u.article.status !== 'PUBLISHED' && <span className="text-xs text-gray-400 shrink-0">미발행</span>}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-gray-400">아직 기사에 쓰이지 않았습니다.</p>
              )}
            </div>
          </>
        )}
      </div>
      {watermark && d && (
        <PhotoWatermarkEditor
          photo={{ id: d.id, url: d.url, filename: d.filename, title: d.title, tags: d.tags }}
          onClose={() => setWatermark(false)}
          onSaved={() => {
            setWatermark(false);
            load();
            onChanged();
          }}
        />
      )}
    </div>
  );
}

// ── 외부 검색 (2단계, 2026-10-09) — 위키미디어·플리커·DVIDS·네이버 "제공" 사진. 통과 기준을 만족한 사진만 나온다 ──
type ExtSource = 'wikimedia' | 'flickr' | 'dvids' | 'naver';
type ExtItem = {
  key: string;
  source: ExtSource;
  thumb: string;
  image: string;
  pageUrl: string;
  viaArticleUrl?: string;
  title: string;
  caption: string;
  author: string;
  license: string;
  takenAt: string | null;
  sourceType: SourceType;
  credit: string;
  note?: string;
  inBank?: boolean;
};
const EXT_LABEL: Record<ExtSource, string> = { wikimedia: '위키미디어 커먼즈', flickr: '플리커', dvids: '미 국방부 DVIDS', naver: '네이버 뉴스 "제공" 사진' };
const EXT_HELP: Record<ExtSource, string> = {
  wikimedia: '퍼블릭 도메인·CC0·CC BY·CC BY-SA(·공공누리 0/1유형)만',
  flickr: '미국 정부 저작물·퍼블릭 도메인 마크·CC0·CC BY·CC BY-SA만',
  dvids: '미 국방부 공개(퍼블릭 도메인) 사진',
  naver: '기사 사진 캡션에 의원실·정당·정부기관 "제공"이 적힌 것만 (언론사·기자 크레디트 제외)',
};

function ImportPanel({ item, people, tags, onClose, onDone, pickLabel }: { item: ExtItem; people: Person[]; tags: Tag[]; onClose: () => void; onDone: (photo: BankPhoto) => void; pickLabel?: string }) {
  const [meta, setMeta] = useState<Meta>({
    ...emptyMeta(),
    sourceType: item.sourceType,
    license: item.license,
    sourceUrl: item.pageUrl,
    viaArticleUrl: item.viaArticleUrl ?? '',
    takenAt: item.takenAt ?? '',
    photographer: item.author,
    credit: item.credit,
    creditTouched: true,
    title: item.caption,
    // 캡션·제목에 이름이 나오는 등록 인물은 미리 체크 (확인만 하면 되게)
    peopleIds: people.filter((p) => [p.name, ...(p.aliases ?? '').split(',').map((a) => a.trim())].some((n) => n && `${item.caption} ${item.title}`.includes(n))).map((p) => p.id),
  });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  async function save() {
    const bad = checkPhotoInput(meta);
    if (bad) return setMsg(bad);
    setBusy(true);
    setMsg('');
    try {
      const r1 = await fetch('/api/photos/from-url', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: item.image }) });
      const d1 = await r1.json();
      if (!r1.ok) throw new Error(d1.error);
      const { tagNames, ...rest } = metaBody(meta);
      const r2 = await fetch('/api/photos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...rest, tags: tagNames, url: d1.url, filename: d1.filename, hash: d1.hash }),
      });
      const d2 = await r2.json();
      if (!r2.ok) throw new Error(d2.error);
      onDone(d2);
    } catch (e) {
      setMsg(e instanceof Error && e.message ? e.message : '가져오기 실패');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4" {...closeOnBackdrop(onClose)}>
      <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[92vh] overflow-y-auto p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-bold">사진 뱅크로 가져오기</h3>
          <button type="button" onClick={onClose} className="text-gray-400 text-lg">
            ✕
          </button>
        </div>
        <div className="grid sm:grid-cols-[220px_1fr] gap-4">
          <div className="space-y-2">
            <img src={item.thumb} alt="" className="w-full rounded-lg border" />
            <p className="text-xs text-gray-500 break-all">
              {EXT_LABEL[item.source]} ·{' '}
              <a href={item.viaArticleUrl ?? item.pageUrl} target="_blank" rel="noopener noreferrer" className="underline">
                원본 보기
              </a>
            </p>
            {item.note && <p className="text-xs font-semibold text-amber-700">확인: {item.note}</p>}
          </div>
          <div>
            <p className="text-xs font-semibold text-brand mb-2">출처·크레디트는 자동으로 채웠습니다. 인물 태그만 확인하세요.</p>
            <MetaForm meta={meta} setMeta={setMeta} people={people} tags={tags} />
          </div>
        </div>
        {msg && <p className="text-xs text-red-600">{msg}</p>}
        <button type="button" disabled={busy} onClick={save} className="text-sm font-bold text-white bg-brand rounded-lg px-5 py-2 disabled:opacity-40">
          {busy ? '가져오는 중…' : pickLabel ?? '뱅크에 저장'}
        </button>
      </div>
    </div>
  );
}

const EXT_ORDER: ExtSource[] = ['wikimedia', 'naver', 'flickr', 'dvids'];
type ExtState = { loading: boolean; available: boolean; items: ExtItem[]; error?: string };

// 검색어를 넣으면 내 뱅크 결과 아래에 외부 결과가 함께 나온다 (사장님 지시 2026-10-09: "내 뱅크 안의 사진만 검색되면 안 돼")
// 외부도 통과 기준을 만족한 안전한 사진만.
function ExternalResults({
  q,
  people,
  tags,
  onImported,
  onPickImported,
}: {
  q: string;
  people: Person[];
  tags: Tag[];
  onImported: () => void;
  onPickImported?: (p: BankPhoto) => void;
}) {
  const [state, setState] = useState<Partial<Record<ExtSource, ExtState>>>({});
  const [open, setOpen] = useState<Partial<Record<ExtSource, boolean>>>({});
  const [importing, setImporting] = useState<ExtItem | null>(null);

  useEffect(() => {
    setState({});
    if (q.trim().length < 2) return;
    const ctrl = new AbortController();
    // 네이버는 기사 여러 건을 읽어 느리므로 입력이 멈춘 뒤에만
    const t = setTimeout(() => {
      for (const src of EXT_ORDER) {
        setState((st) => ({ ...st, [src]: { loading: true, available: true, items: [] } }));
        fetch(`/api/photos/external?source=${src}&q=${encodeURIComponent(q.trim())}`, { signal: ctrl.signal })
          .then((r) => r.json())
          .then((d) => setState((st) => ({ ...st, [src]: { loading: false, available: d.available !== false, items: d.items ?? [], error: d.error } })))
          .catch(() => {});
      }
    }, 900);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  if (q.trim().length < 2) return null;
  const off = EXT_ORDER.filter((s0) => state[s0] && !state[s0]!.available);

  return (
    <div className="space-y-4 pt-2">
      <div className="border-t pt-4">
        <h3 className="text-sm font-bold">사진 뱅크 밖에서 찾은 사진</h3>
        <p className="text-xs text-gray-500">통과 기준을 만족한 안전한 사진만 나옵니다. [가져오기]를 누르면 출처·크레디트가 자동으로 채워집니다.</p>
      </div>
      {EXT_ORDER.filter((src) => state[src]?.available !== false).map((src) => {
        const st = state[src];
        const items = st?.items ?? [];
        const shown = open[src] ? items : items.slice(0, 10);
        return (
          <section key={src}>
            <p className="text-xs font-semibold text-gray-700 mb-1.5">
              {EXT_LABEL[src]}{' '}
              <span className="font-normal text-gray-500">
                {!st || st.loading ? (src === 'naver' ? '찾는 중… (20초쯤)' : '찾는 중…') : st.error ? `· 오류: ${st.error}` : `· ${items.length}장`} · {EXT_HELP[src]}
              </span>
            </p>
            {items.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3">
                {shown.map((it) => (
                  <div key={it.key} className="rounded-lg border overflow-hidden bg-white flex flex-col">
                    <a href={it.viaArticleUrl ?? it.pageUrl} target="_blank" rel="noopener noreferrer" title="원본 보기">
                      <img src={it.thumb} alt="" loading="lazy" referrerPolicy="no-referrer" className="w-full aspect-[4/3] object-cover" />
                    </a>
                    <div className="p-2 space-y-1 text-[11px] flex-1">
                      <p className="flex flex-wrap gap-1">
                        <span className="font-bold text-white rounded px-1.5 py-0.5" style={{ background: BADGE[it.sourceType] }}>
                          {SOURCE_LABEL[it.sourceType]}
                        </span>
                        {it.license && <span className="border rounded px-1.5 py-0.5">{it.license}</span>}
                      </p>
                      <p className="text-gray-700 line-clamp-2">{it.caption || it.title}</p>
                      <p className="text-gray-500 truncate">
                        {it.credit}
                        {it.takenAt ? ` · ${it.takenAt}` : ''}
                      </p>
                      {it.note && <p className="text-amber-700">⚠ {it.note}</p>}
                    </div>
                    <button
                      type="button"
                      disabled={it.inBank}
                      onClick={() => setImporting(it)}
                      className="m-2 mt-0 text-xs font-bold rounded-lg py-1.5 border border-brand text-brand disabled:border-gray-200 disabled:text-gray-400"
                    >
                      {it.inBank ? '이미 뱅크에 있음' : onPickImported ? '가져와서 넣기' : '뱅크로 가져오기'}
                    </button>
                  </div>
                ))}
              </div>
            )}
            {items.length > 10 && (
              <button type="button" onClick={() => setOpen((o) => ({ ...o, [src]: !o[src] }))} className="mt-2 text-xs underline text-gray-500">
                {open[src] ? '접기' : `${items.length - 10}장 더 보기`}
              </button>
            )}
          </section>
        );
      })}
      {off.length > 0 && (
        <p className="text-xs text-gray-400">{off.map((x) => EXT_LABEL[x]).join('·')}는 무료 API 키를 넣으면 같이 검색됩니다.</p>
      )}

      {importing && (
        <ImportPanel
          item={importing}
          people={people}
          tags={tags}
          pickLabel={onPickImported ? '뱅크에 저장하고 기사에 넣기' : undefined}
          onClose={() => setImporting(null)}
          onDone={(photo) => {
            const key = importing.key;
            setState((st) => {
              const next = { ...st };
              for (const k of EXT_ORDER) if (next[k]) next[k] = { ...next[k]!, items: next[k]!.items.map((x) => (x.key === key ? { ...x, inBank: true } : x)) };
              return next;
            });
            setImporting(null);
            onImported();
            onPickImported?.(photo);
          }}
        />
      )}
    </div>
  );
}

// ── 수신함 (3단계, 2026-10-09) — 자동 수집기가 가져온 후보. 승인해야 사진 뱅크에 들어간다 (편집장) ──
type InboxItem = {
  id: string;
  origin: string;
  imageUrl: string;
  thumbUrl: string;
  pageUrl: string | null;
  viaArticleUrl: string | null;
  title: string | null;
  caption: string | null;
  provider: string | null;
  sourceType: SourceType;
  license: string | null;
  credit: string | null;
  takenAt: string | null;
  peopleIds: string | null;
  createdAt: string;
};
const INTERVALS: [number, string][] = [
  [0, '끄기'],
  [30, '30분'],
  [60, '1시간'],
  [180, '3시간'],
  [360, '6시간'],
  [720, '12시간'],
  [1440, '하루'],
];

function InboxApprove({ item, people, tags, onClose, onDone }: { item: InboxItem; people: Person[]; tags: Tag[]; onClose: () => void; onDone: () => void }) {
  const [meta, setMeta] = useState<Meta>({
    ...emptyMeta(),
    sourceType: item.sourceType,
    license: item.license ?? '',
    sourceUrl: item.imageUrl,
    viaArticleUrl: item.viaArticleUrl ?? '',
    takenAt: ymd(item.takenAt),
    photographer: item.provider ?? '',
    credit: item.credit ?? '',
    creditTouched: true,
    title: item.caption ?? '',
    peopleIds: (item.peopleIds ?? '').split(',').filter(Boolean),
  });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  async function approve() {
    const bad = checkPhotoInput(meta);
    if (bad) return setMsg(bad);
    setBusy(true);
    const res = await fetch('/api/photo-inbox', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'approve',
        ids: [item.id],
        peopleIds: meta.peopleIds,
        tagNames: meta.tagNames,
        title: meta.title,
        credit: meta.credit,
        sourceType: meta.sourceType,
        license: meta.license,
      }),
    });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok || d.errors?.length) return setMsg(d.error ?? d.errors?.[0] ?? '승인 실패');
    onDone();
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4" {...closeOnBackdrop(onClose)}>
      <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[92vh] overflow-y-auto p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-bold">확인 후 승인</h3>
          <button type="button" onClick={onClose} className="text-gray-400 text-lg">
            ✕
          </button>
        </div>
        <div className="grid sm:grid-cols-[220px_1fr] gap-4">
          <div className="space-y-2">
            <img src={item.thumbUrl} alt="" referrerPolicy="no-referrer" className="w-full rounded-lg border" />
            {item.viaArticleUrl && (
              <a href={item.viaArticleUrl} target="_blank" rel="noopener noreferrer" className="block text-xs underline text-gray-600">
                경유 기사: {item.title ?? item.viaArticleUrl}
              </a>
            )}
            <p className="text-xs font-semibold text-amber-700">언론사 로고가 박혀 있지 않은지 확인하세요.</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-brand mb-2">인물·상황 태그를 확인하세요.</p>
            <MetaForm meta={meta} setMeta={setMeta} people={people} tags={tags} />
          </div>
        </div>
        {msg && <p className="text-xs text-red-600">{msg}</p>}
        <button type="button" disabled={busy} onClick={approve} className="text-sm font-bold text-white bg-brand rounded-lg px-5 py-2 disabled:opacity-40">
          {busy ? '승인 중…' : '승인 — 사진 뱅크에 등록'}
        </button>
      </div>
    </div>
  );
}

function InboxPanel({ people, tags, onApproved, onCount }: { people: Person[]; tags: Tag[]; onApproved: () => void; onCount: (n: number) => void }) {
  const [data, setData] = useState<{ items: InboxItem[]; minutes: number; lastAt: string | null } | null>(null);
  const [checked, setChecked] = useState<string[]>([]);
  const [bulkTags, setBulkTags] = useState<string[]>([]);
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');
  const [approving, setApproving] = useState<InboxItem | null>(null);
  const personName = useMemo(() => new Map(people.map((p) => [p.id, p.name])), [people]);

  async function load() {
    const res = await fetch('/api/photo-inbox');
    if (res.ok) {
      const d = await res.json();
      setData(d);
      onCount(d.items.length);
      setChecked((c) => c.filter((id) => d.items.some((x: InboxItem) => x.id === id)));
    }
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function act(action: 'approve' | 'reject', ids: string[]) {
    if (!ids.length) return;
    if (action === 'reject' && !confirm(`${ids.length}장을 반려할까요?`)) return;
    setBusy(action);
    setMsg('');
    const res = await fetch('/api/photo-inbox', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, ids, tagNames: action === 'approve' ? bulkTags : undefined }) });
    const d = await res.json().catch(() => ({}));
    setBusy('');
    setMsg(action === 'approve' ? `승인 ${d.approved ?? 0}장${d.errors?.length ? ` · 실패 ${d.errors.length}장 (${d.errors[0]})` : ''}` : `반려 ${d.rejected ?? 0}장`);
    await load();
    if (action === 'approve') onApproved();
  }
  async function collectNow() {
    setBusy('collect');
    setMsg('');
    const res = await fetch('/api/photo-inbox', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'collect' }) });
    const d = await res.json().catch(() => ({}));
    setBusy('');
    setMsg(d.error ? `수집 실패: ${d.error}` : `${d.people?.length ? `${d.people.join('·')} 확인 · ` : ''}후보 ${d.found}장 중 새로 ${d.added}장${d.party ? ` (정당 홈페이지 ${d.party}장)` : ''} · 중복 ${d.skipped}장`);
    await load();
  }
  async function setMinutes(m: number) {
    await fetch('/api/photo-inbox', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ minutes: m }) });
    await load();
  }

  if (!data) return <p className="text-sm text-gray-400">불러오는 중…</p>;
  const allIds = data.items.map((x) => x.id);

  return (
    <div className="space-y-3">
      <div className="border rounded-xl p-3 flex flex-wrap items-center gap-3 text-sm">
        <span className="font-semibold">자동 수집</span>
        <select value={data.minutes} onChange={(e) => setMinutes(Number(e.target.value))} className="border border-gray-200 rounded-lg px-2 py-1 text-sm bg-white">
          {INTERVALS.map(([m, label]) => (
            <option key={m} value={m}>
              {m ? `${label}마다` : label}
            </option>
          ))}
        </select>
        <span className="text-xs text-gray-500">
          마지막 수집 {data.lastAt ? new Date(data.lastAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '없음'}
        </span>
        <button type="button" disabled={!!busy} onClick={collectNow} className="ml-auto text-xs border rounded-lg px-3 py-1.5 disabled:opacity-40">
          {busy === 'collect' ? '수집 중… (1~2분)' : '지금 수집'}
        </button>
        <p className="basis-full text-xs text-gray-500">
          ① 민주당 포토갤러리·개혁신당 사진자료의 새 사진 ② 네이버 뉴스에서 &quot;등록 인물 이름 + 제공&quot; 캡션 사진(인물 5명씩 돌아가며)을 가져옵니다. 국민의힘은 홈페이지에 사진 게시판이 없어 네이버로만 찾습니다.
        </p>
      </div>

      {msg && <p className="text-sm text-gray-700">{msg}</p>}

      {data.items.length === 0 ? (
        <p className="text-sm text-gray-400">승인을 기다리는 사진이 없습니다.</p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <label className="flex items-center gap-1">
              <input type="checkbox" checked={checked.length === allIds.length} onChange={(e) => setChecked(e.target.checked ? allIds : [])} /> 전체 선택 ({checked.length}/{allIds.length})
            </label>
            <button type="button" disabled={!checked.length || !!busy} onClick={() => act('approve', checked)} className="font-bold text-white bg-brand rounded-lg px-3 py-1.5 disabled:opacity-40">
              {busy === 'approve' ? '승인 중…' : '선택 승인'}
            </button>
            <button type="button" disabled={!checked.length || !!busy} onClick={() => act('reject', checked)} className="border rounded-lg px-3 py-1.5 disabled:opacity-40">
              선택 반려
            </button>
            <span className="text-gray-500 ml-2">여러 장 승인 때 붙일 상황 태그:</span>
            <Chips items={tags.map((t) => ({ key: t.name, label: t.name }))} selected={bulkTags} onToggle={(k) => setBulkTags((b) => (b.includes(k) ? b.filter((x) => x !== k) : [...b, k]))} />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3">
            {data.items.map((it) => {
              const on = checked.includes(it.id);
              const names = (it.peopleIds ?? '').split(',').map((id) => personName.get(id)).filter(Boolean);
              return (
                <div key={it.id} className={`rounded-lg border-2 overflow-hidden bg-white flex flex-col ${on ? 'border-brand' : 'border-gray-100'}`}>
                  <button type="button" onClick={() => setChecked(on ? checked.filter((x) => x !== it.id) : [...checked, it.id])} className="relative block">
                    <img src={it.thumbUrl} alt="" loading="lazy" referrerPolicy="no-referrer" className="w-full aspect-[4/3] object-cover" />
                    <span className={`absolute top-1.5 right-1.5 w-6 h-6 rounded text-xs flex items-center justify-center ${on ? 'bg-brand text-white' : 'bg-white/80 border'}`}>{on ? '✓' : ''}</span>
                  </button>
                  <div className="p-2 space-y-1 text-[11px] flex-1">
                    <p className="flex flex-wrap gap-1 items-center">
                      <span className="font-bold text-white rounded px-1.5 py-0.5" style={{ background: BADGE[it.sourceType] }}>
                        {SOURCE_LABEL[it.sourceType]}
                      </span>
                      <span className="text-gray-600 truncate">{it.credit}</span>
                    </p>
                    {names.length > 0 && <p className="font-semibold">{names.join(', ')}</p>}
                    <p className="text-gray-700 line-clamp-3">{it.caption}</p>
                    {it.viaArticleUrl && (
                      <a href={it.viaArticleUrl} target="_blank" rel="noopener noreferrer" className="block text-gray-500 underline truncate">
                        {ymd(it.takenAt)} {it.title ?? '원래 기사'}
                      </a>
                    )}
                  </div>
                  <div className="flex gap-1 m-2 mt-0">
                    <button type="button" onClick={() => setApproving(it)} className="flex-1 text-xs font-bold rounded-lg py-1.5 border border-brand text-brand">
                      확인 후 승인
                    </button>
                    <button type="button" onClick={() => act('reject', [it.id])} className="text-xs rounded-lg px-2 py-1.5 border text-gray-500">
                      반려
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {approving && (
        <InboxApprove
          item={approving}
          people={people}
          tags={tags}
          onClose={() => setApproving(null)}
          onDone={() => {
            setApproving(null);
            load();
            onApproved();
          }}
        />
      )}
    </div>
  );
}

// 사진 뱅크 머리말 — 출처 유형 용어 풀이 (2026-10-09 사장님 요청: 통신사 문구 대신 용어 설명)
export function PhotoBankGuide() {
  const rows: [string, string][] = [
    ['공공누리', '정부·공공기관 사진. 1유형은 출처만 밝히면 자유롭게, 0유형은 출처 표시도 필요 없음'],
    ['정당·의원실 배포', '정당·의원실이 보도용으로 나눠 준 사진. "사진=○○ 의원실"로 표시'],
    ['퍼블릭 도메인', '저작권이 없는 사진(미국 정부 사진, 기간이 끝난 옛 사진 등). 조건 없이 사용'],
    ['CC', '찍은 사람이 조건부로 허락한 사진. BY=출처 표시, SA=고친 사진도 같은 조건으로 공개. 상업 금지(NC)·변경 금지(ND)는 받지 않음'],
  ];
  return (
    <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-1 text-xs text-gray-600 mb-5">
      {rows.map(([k, v]) => (
        <div key={k} className="flex gap-2">
          <dt className="shrink-0 w-24 font-semibold text-gray-800">{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

// ── 본체 ──
export default function PhotoBank({
  mode = 'manage',
  multiple = false,
  isChief = false,
  onPick,
}: {
  mode?: 'manage' | 'pick';
  multiple?: boolean;
  isChief?: boolean;
  onPick?: (items: PickedPhoto[]) => void;
}) {
  const [photos, setPhotos] = useState<BankPhoto[]>([]);
  const [unverified, setUnverified] = useState(0);
  const [people, setPeople] = useState<Person[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [panel, setPanel] = useState<'' | 'register' | 'manage'>('');
  const [tab, setTab] = useState<'bank' | 'inbox'>('bank');
  const [inboxCount, setInboxCount] = useState<number | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [checked, setChecked] = useState<string[]>([]);

  // 관리 화면: 사진 바깥 빈 곳에서 드래그한 범위 안 사진 선택 → 일괄 캡션·출처·삭제 (2026-10-09 사장님 요청)
  const [sel, setSel] = useState<string[]>([]);
  const [box, setBox] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const [bulkCaption, setBulkCaption] = useState('');
  const [bulkSource, setBulkSource] = useState<SourceType | ''>('');
  const [bulkWho, setBulkWho] = useState('');
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkMsg, setBulkMsg] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  // 검색·필터·정렬
  const [q, setQ] = useState('');
  const [sources, setSources] = useState<string[]>([]);
  const [tag, setTag] = useState('');
  const [peopleSel, setPeopleSel] = useState<string[]>([]);
  const [peopleMode, setPeopleMode] = useState<'all' | 'any'>('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [usage, setUsage] = useState<'' | 'unused' | 'not7d'>('');
  const [sort, setSort] = useState<'created' | 'taken' | 'leastUsed'>('created');
  const [showFilters, setShowFilters] = useState(false);

  const params = useMemo(() => {
    const p = new URLSearchParams();
    if (q.trim()) p.set('q', q.trim());
    if (sources.length) p.set('sources', sources.join(','));
    if (tag) p.set('tag', tag);
    if (peopleSel.length) {
      p.set('people', peopleSel.join(','));
      p.set('peopleMode', peopleMode);
    }
    if (from) p.set('from', from);
    if (to) p.set('to', to);
    if (usage) p.set('usage', usage);
    p.set('sort', sort);
    return p.toString();
  }, [q, sources, tag, peopleSel, peopleMode, from, to, usage, sort]);

  async function loadLists() {
    const [pr, tr] = await Promise.all([fetch('/api/people'), fetch('/api/photo-tags')]);
    if (pr.ok) setPeople(await pr.json());
    if (tr.ok) setTags(await tr.json());
  }
  async function loadPhotos() {
    setLoading(true);
    const res = await fetch(`/api/photos?${params}`);
    setPhotos(res.ok ? await res.json() : []);
    setUnverified(Number(res.headers.get('X-Unverified-Count') ?? 0));
    setLoading(false);
  }
  useEffect(() => {
    loadLists();
    if (isChief && mode === 'manage') {
      fetch('/api/photo-inbox')
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => d && setInboxCount(d.items.length))
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    const t = setTimeout(loadPhotos, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  const toggle = (arr: string[], k: string) => (arr.includes(k) ? arr.filter((x) => x !== k) : [...arr, k]);
  const pickOne = (p: BankPhoto) => onPick?.([{ url: p.url, title: p.title, credit: p.credit, sourceType: p.sourceType }]);

  // 드래그 선택 — 사진 위가 아닌 곳(빈 곳·양옆 여백)에서 누르고 끌면 사각형 안 사진이 선택됨. Shift/Ctrl은 기존 선택에 더함
  useEffect(() => {
    if (mode !== 'manage' || tab !== 'bank') return;
    function down(e: PointerEvent) {
      if (e.button !== 0 || !rootRef.current || !gridRef.current) return;
      const t = e.target as HTMLElement;
      if (t.closest('input,textarea,select,button,a,label,[data-photo-id],[data-no-marquee],nav,header,[role="dialog"],.fixed')) return;
      const r = rootRef.current.getBoundingClientRect();
      if (e.clientY < r.top || e.clientY > r.bottom) return; // 사진 뱅크 높이 안에서만(양옆 여백 포함)
      const additive = e.shiftKey || e.ctrlKey || e.metaKey;
      const base = additive ? sel : [];
      const x0 = e.clientX;
      const y0 = e.clientY;
      let moved = false;
      e.preventDefault();
      function move(ev: PointerEvent) {
        if (!moved && Math.hypot(ev.clientX - x0, ev.clientY - y0) < 5) return;
        moved = true;
        const b = { x0, y0, x1: ev.clientX, y1: ev.clientY };
        setBox(b);
        const L = Math.min(b.x0, b.x1), R = Math.max(b.x0, b.x1), T = Math.min(b.y0, b.y1), B = Math.max(b.y0, b.y1);
        const hit: string[] = [];
        gridRef.current?.querySelectorAll<HTMLElement>('[data-photo-id]').forEach((el) => {
          const c = el.getBoundingClientRect();
          if (c.right >= L && c.left <= R && c.bottom >= T && c.top <= B) hit.push(el.dataset.photoId!);
        });
        setSel(Array.from(new Set([...base, ...hit])));
      }
      function up() {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        setBox(null);
        if (!moved && !additive) setSel([]); // 빈 곳 클릭 = 선택 해제
      }
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    }
    function key(e: KeyboardEvent) {
      // 입력칸에서 누른 Esc(한글 조합 취소 포함)는 무시 — 일괄 캡션 입력 중 Esc에 선택이 풀려 입력 막대가 통째로 사라졌음 (2026-10-10)
      const t = e.target as HTMLElement | null;
      if (e.isComposing || t?.closest('input,textarea,select,[contenteditable="true"]')) return;
      if (e.key === 'Escape') setSel([]);
    }
    document.addEventListener('pointerdown', down);
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('pointerdown', down);
      document.removeEventListener('keydown', key);
    };
  }, [mode, tab, sel]);

  // 목록이 바뀌면 보이지 않는 사진은 선택에서 뺌
  useEffect(() => {
    setSel((cur) => cur.filter((id) => photos.some((p) => p.id === id)));
  }, [photos]);

  async function bulk(body: Record<string, unknown>, method: 'PATCH' | 'DELETE' = 'PATCH') {
    setBulkBusy(true);
    setBulkMsg('');
    const res = await fetch('/api/photos/bulk', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ photoIds: sel, ...body }) });
    const d = await res.json().catch(() => ({}));
    setBulkBusy(false);
    if (!res.ok) return setBulkMsg(d.error ?? '실패했습니다');
    setBulkMsg(method === 'DELETE' ? `${d.deleted}장 삭제했습니다` : `${d.updated}장 고쳤습니다${d.updated < sel.length ? ` (본인이 올린 사진만 고칠 수 있어 ${sel.length - d.updated}장은 그대로)` : ''}`);
    if (method === 'DELETE') setSel([]);
    loadPhotos();
  }
  const filterCount = sources.length + (tag ? 1 : 0) + peopleSel.length + (from || to ? 1 : 0) + (usage ? 1 : 0);

  const tabs = (
    <div className="flex gap-1 border-b">
      {(
        [
          ['bank', '사진 뱅크'],
          ...(isChief && mode === 'manage' ? ([['inbox', `수신함${inboxCount ? ` (${inboxCount})` : ''}`]] as const) : []),
        ] as const
      ).map(([k, label]) => (
        <button
          key={k}
          type="button"
          onClick={() => setTab(k)}
          className={`px-4 py-2 text-sm -mb-px border-b-2 ${tab === k ? 'border-brand text-brand font-bold' : 'border-transparent text-gray-500'}`}
        >
          {label}
        </button>
      ))}
    </div>
  );

  if (tab === 'inbox') {
    return (
      <div className="space-y-3">
        {tabs}
        <InboxPanel
          people={people}
          tags={tags}
          onCount={setInboxCount}
          onApproved={() => {
            loadPhotos();
            loadLists();
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-3" ref={rootRef}>
      {tabs}
      <div className="flex flex-wrap gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} className={`${input} flex-1 min-w-[200px]`} placeholder="인물·주제로 검색 — 내 뱅크와 외부에서 안전한 사진만" />
        <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className="border border-gray-200 rounded-lg px-2 text-sm bg-white">
          <option value="created">최근 등록순</option>
          <option value="taken">최근 촬영순</option>
          <option value="leastUsed">덜 쓴 순</option>
        </select>
        <button type="button" onClick={() => setShowFilters((v) => !v)} className={`text-xs rounded-lg px-3 border ${filterCount ? 'border-brand text-brand font-bold' : 'border-gray-200'}`}>
          필터{filterCount ? ` ${filterCount}` : ''}
        </button>
        <button type="button" onClick={() => setPanel(panel === 'register' ? '' : 'register')} className={`text-xs font-bold rounded-lg px-3 border ${panel === 'register' ? 'bg-brand text-white border-brand' : 'border-gray-200'}`}>
          ＋ 사진 등록
        </button>
        {isChief && mode === 'manage' && (
          <button type="button" onClick={() => setPanel(panel === 'manage' ? '' : 'manage')} className={`text-xs rounded-lg px-3 border ${panel === 'manage' ? 'bg-brand text-white border-brand' : 'border-gray-200'}`}>
            인물·상황 태그 관리
          </button>
        )}
      </div>

      {showFilters && (
        <div className="border rounded-xl p-3 space-y-3 text-sm">
          <div>
            <p className="text-xs text-gray-500 mb-1">출처 유형 (여러 개)</p>
            <Chips
              items={[...SOURCE_TYPES.map((t) => ({ key: t, label: SOURCE_LABEL[t] })), ...(mode === 'manage' ? [{ key: 'NONE', label: '출처 미입력' }] : [])]}
              selected={sources}
              onToggle={(k) => setSources(toggle(sources, k))}
            />
          </div>
          <div className="grid sm:grid-cols-3 gap-2">
            <label className="block">
              <span className="text-xs text-gray-500">상황 태그</span>
              <select value={tag} onChange={(e) => setTag(e.target.value)} className={input}>
                <option value="">전체</option>
                {tags.map((t) => (
                  <option key={t.id}>{t.name}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs text-gray-500">촬영일 부터</span>
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={input} />
            </label>
            <label className="block">
              <span className="text-xs text-gray-500">까지</span>
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={input} />
            </label>
          </div>
          <div>
            <div className="flex items-center gap-3 mb-1">
              <p className="text-xs text-gray-500">인물</p>
              {peopleSel.length > 1 && (
                <div className="flex gap-2 text-xs">
                  <label className="flex items-center gap-1">
                    <input type="radio" checked={peopleMode === 'all'} onChange={() => setPeopleMode('all')} /> 모두 나온 사진
                  </label>
                  <label className="flex items-center gap-1">
                    <input type="radio" checked={peopleMode === 'any'} onChange={() => setPeopleMode('any')} /> 한 명이라도 나온 사진
                  </label>
                </div>
              )}
            </div>
            <Chips items={people.map((p) => ({ key: p.id, label: p.name }))} selected={peopleSel} onToggle={(k) => setPeopleSel(toggle(peopleSel, k))} />
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <span className="text-gray-500">사용 여부</span>
            {(
              [
                ['', '전체'],
                ['unused', '미사용만'],
                ['not7d', '최근 7일 사용분 제외'],
              ] as const
            ).map(([k, label]) => (
              <label key={k} className="flex items-center gap-1">
                <input type="radio" checked={usage === k} onChange={() => setUsage(k)} /> {label}
              </label>
            ))}
            {filterCount > 0 && (
              <button
                type="button"
                onClick={() => {
                  setSources([]);
                  setTag('');
                  setPeopleSel([]);
                  setFrom('');
                  setTo('');
                  setUsage('');
                }}
                className="ml-auto underline text-gray-500"
              >
                필터 모두 해제
              </button>
            )}
          </div>
        </div>
      )}

      {panel === 'register' && (
        <RegisterPanel
          people={people}
          tags={tags}
          onDone={() => {
            loadPhotos();
            loadLists();
          }}
        />
      )}
      {panel === 'manage' && (
        <ManagePanel
          people={people}
          tags={tags}
          reload={() => {
            loadLists();
            loadPhotos();
          }}
        />
      )}

      <p className="text-xs text-gray-500">
        {loading ? '불러오는 중…' : `내 사진 뱅크 ${photos.length}장${photos.length >= 200 ? ' (최대 200장까지 표시 — 검색어·필터로 좁혀 주세요)' : ''}`}
        {!loading && unverified > 0 && (
          <span className="text-amber-700"> · 출처 미입력 {unverified}장은 출처를 넣기 전에는 기사에 넣을 수 없습니다</span>
        )}
      </p>
      {mode === 'manage' && (
        <p className="text-[11px] text-gray-400">사진 바깥 빈 곳에서 끌어 범위를 그리면 여러 장이 선택됩니다 · Ctrl/Shift+클릭으로 한 장씩 더하기 · Esc로 해제</p>
      )}
      {mode === 'manage' && sel.length > 0 && (
        <div data-no-marquee className="sticky top-0 z-20 border rounded-xl p-3 bg-white shadow-sm flex flex-wrap items-center gap-2 text-xs">
          <b className="text-sm">선택 {sel.length}장</b>
          <span className="flex items-center gap-1">
            <input value={bulkCaption} onChange={(e) => setBulkCaption(e.target.value)} className="border border-gray-200 rounded-lg px-2 py-1 w-56" placeholder="캡션 일괄 입력" />
            <button type="button" disabled={bulkBusy || !bulkCaption.trim()} onClick={() => bulk({ title: bulkCaption.trim() })} className="border rounded-lg px-2 py-1 disabled:opacity-40">
              캡션 일괄 수정
            </button>
          </span>
          <span className="flex items-center gap-1">
            <select value={bulkSource} onChange={(e) => setBulkSource(e.target.value as SourceType | '')} className="border border-gray-200 rounded-lg px-1 py-1">
              <option value="">출처 유형…</option>
              {SOURCE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {SOURCE_LABEL[t]}
                </option>
              ))}
            </select>
            <input value={bulkWho} onChange={(e) => setBulkWho(e.target.value)} className="border border-gray-200 rounded-lg px-2 py-1 w-36" placeholder={bulkSource ? PHOTOGRAPHER_HINT[bulkSource] : '촬영자·기관'} />
            <button
              type="button"
              disabled={bulkBusy || !bulkSource}
              onClick={() => bulk({ sourceType: bulkSource, photographer: bulkWho })}
              className="border rounded-lg px-2 py-1 disabled:opacity-40"
              title={bulkSource ? `크레디트: ${autoCredit(bulkSource, bulkWho) || '(촬영자·기관을 넣으면 자동)'}` : ''}
            >
              출처 일괄 지정
            </button>
          </span>
          {isChief && (
            <button
              type="button"
              disabled={bulkBusy}
              onClick={() => confirm(`선택한 ${sel.length}장을 사진 뱅크에서 삭제할까요? 되돌릴 수 없습니다. (이미 기사에 들어간 사진은 기사에 그대로 남습니다)`) && bulk({}, 'DELETE')}
              className="border border-red-200 text-red-600 rounded-lg px-2 py-1 disabled:opacity-40"
            >
              선택 삭제
            </button>
          )}
          <button type="button" onClick={() => setSel([])} className="ml-auto underline text-gray-500">
            선택 해제
          </button>
          {bulkMsg && <span className="basis-full text-gray-700">{bulkMsg}</span>}
        </div>
      )}
      <div ref={gridRef} className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-3">
        {photos.map((p) => {
          const on = checked.includes(p.id) || sel.includes(p.id);
          return (
            <div key={p.id} data-photo-id={p.id} className={`group relative rounded-lg overflow-hidden border-2 bg-white ${on ? 'border-brand' : 'border-transparent'}`}>
              <button
                type="button"
                onClick={(e) =>
                  mode === 'pick' && multiple
                    ? p.sourceType
                      ? setChecked(toggle(checked, p.id))
                      : setDetailId(p.id)
                    : mode === 'manage' && (e.ctrlKey || e.metaKey || e.shiftKey || sel.length > 0)
                      ? setSel(toggle(sel, p.id))
                      : setDetailId(p.id)
                }
                className="block w-full text-left"
                title={[p.title, p.credit].filter(Boolean).join(' · ')}
              >
                <img src={p.url} alt={p.title ?? ''} loading="lazy" className="w-full aspect-[4/3] object-cover" />
                <div className="px-1.5 py-1 flex items-center gap-1.5">
                  <span
                    className="text-[10px] font-bold text-white rounded px-1.5 py-0.5 shrink-0"
                    style={{ background: p.sourceType ? BADGE[p.sourceType] : '#9a9a9a' }}
                  >
                    {p.sourceType ? SOURCE_LABEL[p.sourceType] : '출처 미입력'}
                  </span>
                  <span className="text-[11px] text-gray-500 truncate">{ymd(p.takenAt) || ymd(p.createdAt)}</span>
                  {!!p._count?.usages && <span className="ml-auto text-[10px] text-gray-400 shrink-0">사용 {p._count.usages}</span>}
                </div>
                {p.people.length > 0 && <p className="px-1.5 pb-1 text-[11px] text-gray-600 truncate">{p.people.map((x) => x.name).join(', ')}</p>}
              </button>
              {mode === 'pick' && !multiple && p.sourceType && (
                <button
                  type="button"
                  onClick={() => pickOne(p)}
                  className="absolute top-1.5 right-1.5 text-[11px] font-bold text-white bg-brand rounded px-2 py-1 opacity-0 group-hover:opacity-100"
                >
                  넣기
                </button>
              )}
              {mode === 'pick' && multiple && (
                <button type="button" onClick={() => setDetailId(p.id)} title="사진 정보" className="absolute top-1.5 left-1.5 w-6 h-6 rounded bg-black/55 text-white text-xs">
                  i
                </button>
              )}
              {on && <span className="absolute top-1.5 right-1.5 w-6 h-6 rounded bg-brand text-white text-xs flex items-center justify-center">✓</span>}
            </div>
          );
        })}
      </div>

      {box && (
        <div
          className="fixed z-30 border-2 border-brand bg-brand/10 pointer-events-none"
          style={{ left: Math.min(box.x0, box.x1), top: Math.min(box.y0, box.y1), width: Math.abs(box.x1 - box.x0), height: Math.abs(box.y1 - box.y0) }}
        />
      )}

      <ExternalResults
        q={q}
        people={people}
        tags={tags}
        onImported={() => {
          loadPhotos();
          loadLists();
        }}
        onPickImported={mode === 'pick' && !multiple ? (p) => pickOne(p) : undefined}
      />

      {mode === 'pick' && multiple && (
        <div className="sticky bottom-0 bg-white border-t pt-3 flex justify-end">
          <button
            type="button"
            disabled={!checked.length}
            onClick={() => onPick?.(photos.filter((p) => checked.includes(p.id)).map((p) => ({ url: p.url, title: p.title, credit: p.credit, sourceType: p.sourceType })))}
            className="text-sm font-bold text-white bg-brand rounded-lg px-5 py-2 disabled:opacity-40"
          >
            선택 완료 ({checked.length})
          </button>
        </div>
      )}

      {detailId && (
        <DetailPanel
          id={detailId}
          people={people}
          tags={tags}
          isChief={isChief}
          pickLabel={multiple ? '이 사진 선택' : '이 사진 기사에 넣기'}
          onPick={
            mode === 'pick'
              ? (p) => {
                  if (multiple) {
                    if (!checked.includes(p.id)) setChecked([...checked, p.id]);
                    setDetailId(null);
                  } else {
                    pickOne(p);
                  }
                }
              : undefined
          }
          onClose={() => setDetailId(null)}
          onChanged={loadPhotos}
        />
      )}
    </div>
  );
}
