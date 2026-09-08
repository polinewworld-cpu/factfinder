'use client';

import { useEffect, useRef, useState } from 'react';
import { parseEmbedUrl } from '@/lib/embeds';

type Me = { id: string; role: string; name?: string; email?: string };
type Category = { id: string; name: string; slug: string };
type Keyword = { id: string; name: string };
type SpecialChar = { id: string; char: string; label?: string | null };

const WRITER_ROLES = ['REPORTER', 'COLUMNIST', 'CHIEF_EDITOR'];

export default function WritePage() {
  const [me, setMe] = useState<Me | null | 'loading'>('loading');
  const [categories, setCategories] = useState<Category[]>([]);
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [specialChars, setSpecialChars] = useState<SpecialChar[]>([]);

  const [title, setTitle] = useState('');
  const [excerpt, setExcerpt] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [keywordIds, setKeywordIds] = useState<string[]>([]);
  const [coverImageUrl, setCoverImageUrl] = useState('');
  const [isFrontpageTop, setIsFrontpageTop] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [cardImages, setCardImages] = useState<{ url: string }[]>([]);
  const [cardUploading, setCardUploading] = useState(false);

  const [pollEnabled, setPollEnabled] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState<string[]>(['', '']);

  const [articleId, setArticleId] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [resultMsg, setResultMsg] = useState<{ text: string; href?: string } | null>(null);

  const editorRef = useRef<HTMLDivElement>(null);
  const dirtyRef = useRef(false);
  const articleIdRef = useRef<string | null>(null);
  const submittedRef = useRef(false); // 제출 완료 후엔 자동저장 중단

  const stateRef = useRef({
    title, excerpt, categoryId, keywordIds, coverImageUrl, isFrontpageTop, cardImages,
    pollEnabled, pollQuestion, pollOptions,
  });
  useEffect(() => {
    stateRef.current = {
      title, excerpt, categoryId, keywordIds, coverImageUrl, isFrontpageTop, cardImages,
      pollEnabled, pollQuestion, pollOptions,
    };
  }, [title, excerpt, categoryId, keywordIds, coverImageUrl, isFrontpageTop, cardImages, pollEnabled, pollQuestion, pollOptions]);

  function pollPayload(s: typeof stateRef.current) {
    return s.pollEnabled ? { question: s.pollQuestion, options: s.pollOptions } : null;
  }

  function togglePoll(on: boolean) {
    setPollEnabled(on);
    markDirty();
  }
  function updatePollOption(i: number, val: string) {
    setPollOptions((prev) => prev.map((o, idx) => (idx === i ? val : o)));
    markDirty();
  }
  function addPollOption() {
    setPollOptions((prev) => (prev.length >= 6 ? prev : [...prev, '']));
    markDirty();
  }
  function removePollOption(i: number) {
    setPollOptions((prev) => (prev.length <= 2 ? prev : prev.filter((_, idx) => idx !== i)));
    markDirty();
  }

  useEffect(() => {
    (async () => {
      const meRes = await fetch('/api/me');
      setMe(meRes.ok ? await meRes.json() : null);
      const [catRes, kwRes, scRes] = await Promise.all([
        fetch('/api/categories'),
        fetch('/api/keywords'),
        fetch('/api/special-characters'),
      ]);
      setCategories(await catRes.json());
      setKeywords(await kwRes.json());
      setSpecialChars(await scRes.json());
    })();
  }, []);

  // 15초 주기 자동저장 — 변경사항(dirty)이 있을 때만, 제출 완료 전까지만 동작
  useEffect(() => {
    const timer = setInterval(() => {
      if (dirtyRef.current && !submittedRef.current) doAutosave();
    }, 15000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function markDirty() {
    dirtyRef.current = true;
  }

  async function doAutosave() {
    if (submittedRef.current) return;
    setSaving(true);
    const s = stateRef.current;
    const payload: any = {
      title: s.title,
      excerpt: s.excerpt,
      coverImageUrl: s.coverImageUrl || null,
      content: editorRef.current?.innerHTML ?? '',
      keywordIds: s.keywordIds,
      images: s.cardImages,
      poll: pollPayload(s),
      intent: 'autosave',
    };
    if (s.categoryId) payload.categoryId = s.categoryId;

    try {
      let res: Response;
      if (!articleIdRef.current) {
        res = await fetch('/api/articles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch(`/api/articles/${articleIdRef.current}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      if (!res.ok) {
        // 실패 시 저장된 것처럼 표시하지 않고, dirty 상태를 유지해 다음 주기에 재시도
        const data = await res.json().catch(() => null);
        setErrorMsg(data?.error ?? '자동저장에 실패했습니다. 다음 저장 때 다시 시도합니다.');
        return;
      }

      if (!articleIdRef.current) {
        const created = await res.json();
        articleIdRef.current = created.id;
        setArticleId(created.id);
      }
      dirtyRef.current = false;
      setLastSavedAt(new Date());
      setErrorMsg('');
    } catch (e) {
      setErrorMsg('자동저장 중 오류가 발생했습니다. 다음 저장 때 다시 시도합니다.');
    } finally {
      setSaving(false);
    }
  }

  async function handleCoverUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setErrorMsg('');
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/upload', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error ?? '업로드 실패');
        return;
      }
      setCoverImageUrl(data.url);
      markDirty();
    } finally {
      setUploading(false);
    }
  }

  async function handleCardImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    setCardUploading(true);
    for (const file of files) {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/upload', { method: 'POST', body: form });
      const data = await res.json();
      if (res.ok) setCardImages((prev) => [...prev, { url: data.url }]);
    }
    markDirty();
    setCardUploading(false);
  }

  function removeCardImage(url: string) {
    setCardImages((prev) => prev.filter((img) => img.url !== url));
    markDirty();
  }

  function toggleKeyword(id: string) {
    setKeywordIds((prev) => (prev.includes(id) ? prev.filter((k) => k !== id) : [...prev, id]));
    markDirty();
  }

  function applyHighlight() {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;
    const range = sel.getRangeAt(0);
    if (!editorRef.current?.contains(range.commonAncestorContainer)) return;
    const mark = document.createElement('mark');
    mark.className = 'hl-mark';
    try {
      range.surroundContents(mark);
    } catch {
      const content = range.extractContents();
      mark.appendChild(content);
      range.insertNode(mark);
    }
    sel.removeAllRanges();
    markDirty();
  }

  function exec(cmd: string) {
    document.execCommand(cmd);
    markDirty();
  }

  function insertSpecialChar(char: string) {
    document.execCommand('insertText', false, char);
    markDirty();
  }

  function insertEmbed() {
    const url = window.prompt('유튜브 / X(트위터) / 인스타그램 게시물 링크를 붙여넣으세요');
    if (!url) return;
    const embed = parseEmbedUrl(url);
    if (!embed) {
      setErrorMsg('지원하지 않는 링크입니다 (유튜브 · X · 인스타그램만 지원)');
      return;
    }
    editorRef.current?.focus();
    document.execCommand('insertHTML', false, embed.html + '<p><br></p>');
    markDirty();
  }

  async function handleSubmit() {
    setErrorMsg('');
    const s = stateRef.current;
    const content = editorRef.current?.innerHTML ?? '';
    const plainText = editorRef.current?.innerText?.trim() ?? '';

    if (!s.title.trim()) return setErrorMsg('제목을 입력해주세요.');
    if (!s.categoryId) return setErrorMsg('카테고리를 선택해주세요.');
    if (!plainText) return setErrorMsg('본문을 입력해주세요.');
    if (s.pollEnabled) {
      if (!s.pollQuestion.trim()) return setErrorMsg('설문 질문을 입력해주세요.');
      if (s.pollOptions.map((o) => o.trim()).filter(Boolean).length < 2) {
        return setErrorMsg('설문 항목을 2개 이상 입력해주세요.');
      }
    }

    setSubmitting(true);
    const payload: any = {
      title: s.title,
      excerpt: s.excerpt,
      coverImageUrl: s.coverImageUrl || null,
      categoryId: s.categoryId,
      content,
      keywordIds: s.keywordIds,
      images: s.cardImages,
      poll: pollPayload(s),
      isFrontpageTop: s.isFrontpageTop,
      intent: 'submit',
    };

    try {
      let res;
      if (!articleIdRef.current) {
        res = await fetch('/api/articles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch(`/api/articles/${articleIdRef.current}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error ?? '제출 실패');
        return;
      }
      submittedRef.current = true;
      if (data.status === 'PUBLISHED') {
        setResultMsg({ text: '발행되었습니다.', href: `/article/${data.id}` });
      } else {
        setResultMsg({ text: '편집장 승인 대기 중입니다. 승인되면 발행됩니다.' });
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (me === 'loading') return <main className="max-w-3xl mx-auto px-4 py-10 text-gray-500">불러오는 중…</main>;
  if (!me || !WRITER_ROLES.includes(me.role)) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-10">
        <p className="text-gray-600">기사 작성 권한이 없습니다 (기자/논설위원/편집장만 접근 가능합니다).</p>
      </main>
    );
  }

  const submitLabel = me.role === 'REPORTER' ? '승인 요청' : '발행하기';

  if (resultMsg) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-10 text-center">
        <p className="text-lg font-bold mb-3">{resultMsg.text}</p>
        {resultMsg.href && (
          <a href={resultMsg.href} className="text-brand font-semibold">
            기사 보러가기 →
          </a>
        )}
      </main>
    );
  }

  return (
    <main className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900">기사 작성</h1>
        <span className="text-xs text-gray-400">
          {saving ? '저장 중…' : lastSavedAt ? `자동저장됨 ${lastSavedAt.toLocaleTimeString('ko-KR')}` : ''}
        </span>
      </div>

      {errorMsg && <p className="text-red-600 text-sm mb-4">{errorMsg}</p>}

      <input
        value={title}
        onChange={(e) => {
          setTitle(e.target.value);
          markDirty();
        }}
        placeholder="제목을 입력하세요"
        className="w-full text-2xl font-bold border-b border-gray-200 pb-3 mb-4 outline-none focus:border-brand"
      />

      <input
        value={excerpt}
        onChange={(e) => {
          setExcerpt(e.target.value);
          markDirty();
        }}
        placeholder="요약(카드에 노출될 짧은 설명, 선택)"
        className="w-full text-sm text-gray-600 border-b border-gray-100 pb-2 mb-4 outline-none focus:border-brand"
      />

      <div className="flex flex-wrap gap-4 mb-4">
        <select
          value={categoryId}
          onChange={(e) => {
            setCategoryId(e.target.value);
            markDirty();
          }}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm"
        >
          <option value="">카테고리 선택</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <label className="text-sm text-gray-600 flex items-center gap-2 cursor-pointer">
          <input type="file" accept="image/*" className="hidden" onChange={handleCoverUpload} />
          <span className="border border-gray-200 rounded-lg px-3 py-1.5 hover:border-brand">
            {uploading ? '업로드 중…' : '커버이미지 업로드'}
          </span>
        </label>

        {me.role !== 'REPORTER' ? (
          <label className="text-sm text-gray-600 flex items-center gap-2">
            <input
              type="checkbox"
              checked={isFrontpageTop}
              onChange={(e) => {
                setIsFrontpageTop(e.target.checked);
                markDirty();
              }}
            />
            1면톱으로 지정
          </label>
        ) : (
          <span className="text-xs text-gray-400 self-center">1면톱 지정은 발행 즉시 권한자만 가능합니다.</span>
        )}
      </div>

      {coverImageUrl && (
        <img src={coverImageUrl} alt="" className="w-full max-h-64 object-cover rounded-lg mb-4 border border-gray-200" />
      )}

      <div className="mb-4">
        <p className="text-xs font-semibold text-gray-500 mb-2">키워드</p>
        <div className="flex flex-wrap gap-2">
          {keywords.map((k) => (
            <button
              key={k.id}
              type="button"
              onClick={() => toggleKeyword(k.id)}
              className={`text-xs font-bold rounded-full px-3 py-1 border ${
                keywordIds.includes(k.id)
                  ? 'bg-brand text-white border-brand'
                  : 'bg-white text-gray-500 border-gray-200'
              }`}
            >
              {k.name}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-6">
        <p className="text-xs font-semibold text-gray-500 mb-2">
          카드뉴스 이미지 (외부에서 제작한 이미지를 순서대로 올리면 독자 화면에 캐러셀+전체 다운로드로 노출됩니다)
        </p>
        <label className="inline-block text-sm text-gray-600 cursor-pointer mb-2">
          <input type="file" accept="image/*" multiple className="hidden" onChange={handleCardImageUpload} />
          <span className="border border-gray-200 rounded-lg px-3 py-1.5 hover:border-brand">
            {cardUploading ? '업로드 중…' : '이미지 추가'}
          </span>
        </label>
        {cardImages.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {cardImages.map((img, i) => (
              <div key={img.url} className="relative w-20 h-20 rounded-lg overflow-hidden border border-gray-200">
                <img src={img.url} alt="" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => removeCardImage(img.url)}
                  className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/60 text-white text-xs leading-5"
                >
                  ✕
                </button>
                <span className="absolute bottom-0.5 left-0.5 text-[10px] text-white bg-black/60 rounded px-1">
                  {i + 1}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 에디터 툴바 */}
      <div
        className="flex flex-wrap items-center gap-1 border border-gray-200 border-b-0 rounded-t-lg bg-gray-50 px-2 py-1.5"
        onMouseDown={(e) => e.preventDefault()}
      >
        <button type="button" onClick={() => exec('bold')} className="toolbar-btn font-bold" title="굵게">
          B
        </button>
        <button type="button" onClick={() => exec('italic')} className="toolbar-btn italic" title="기울임">
          I
        </button>
        <button type="button" onClick={() => exec('underline')} className="toolbar-btn underline" title="밑줄">
          U
        </button>
        <button
          type="button"
          onClick={applyHighlight}
          className="toolbar-btn"
          style={{ background: 'rgba(250,204,21,.35)' }}
          title="형광펜 마킹 (문장을 드래그로 선택 후 클릭)"
        >
          형광펜
        </button>
        <button
          type="button"
          onClick={insertEmbed}
          className="toolbar-btn"
          title="유튜브/X/인스타그램 링크 임베드"
        >
          🔗임베드
        </button>
        <span className="w-px h-5 bg-gray-300 mx-1" />
        {specialChars.map((sc) => (
          <button
            key={sc.id}
            type="button"
            onClick={() => insertSpecialChar(sc.char)}
            className="toolbar-btn"
            title={sc.label ?? sc.char}
          >
            {sc.char}
          </button>
        ))}
      </div>
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={markDirty}
        className="min-h-[300px] border border-gray-200 rounded-b-lg p-4 leading-relaxed outline-none focus:border-brand text-gray-900"
        data-placeholder="본문을 입력하세요"
      />

      {/* 설문(투표) — 기사 본문 작성을 마친 뒤 별도로 추가하는 선택 항목 */}
      <div className="mt-8 pt-6 border-t border-gray-200">
        <div className="border border-gray-200 rounded-lg p-4">
          <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 cursor-pointer">
            <input type="checkbox" checked={pollEnabled} onChange={(e) => togglePoll(e.target.checked)} />
            설문(투표) 추가
          </label>
          {pollEnabled && (
            <div className="mt-3 space-y-2">
              <input
                value={pollQuestion}
                onChange={(e) => {
                  setPollQuestion(e.target.value);
                  markDirty();
                }}
                placeholder="질문을 입력하세요 (예: 이번 정책에 찬성하시나요?)"
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-brand"
              />
              {pollOptions.map((opt, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    value={opt}
                    onChange={(e) => updatePollOption(i, e.target.value)}
                    placeholder={`항목 ${i + 1}`}
                    className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-brand"
                  />
                  {pollOptions.length > 2 && (
                    <button
                      type="button"
                      onClick={() => removePollOption(i)}
                      className="w-7 h-7 shrink-0 rounded-full text-gray-400 hover:text-red-500 hover:bg-red-50"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
              {pollOptions.length < 6 && (
                <button
                  type="button"
                  onClick={addPollOption}
                  className="text-xs font-semibold text-brand border border-brand/30 rounded-full px-3 py-1 hover:bg-brand/5"
                >
                  + 항목 추가
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-end gap-3 mt-6">
        <button
          type="button"
          onClick={doAutosave}
          className="text-sm text-gray-500 border border-gray-200 rounded-full px-4 py-2 hover:border-brand"
        >
          임시저장
        </button>
        <button
          type="button"
          disabled={submitting}
          onClick={handleSubmit}
          className="text-sm font-bold text-white bg-brand rounded-full px-6 py-2 hover:bg-brand-dark disabled:opacity-50"
        >
          {submitting ? '처리 중…' : submitLabel}
        </button>
      </div>

      <style jsx>{`
        .toolbar-btn {
          min-width: 28px;
          height: 28px;
          padding: 0 6px;
          border-radius: 6px;
          font-size: 13px;
          color: #374151;
        }
        .toolbar-btn:hover {
          background: rgba(0, 0, 0, 0.06);
        }
        [contenteditable][data-placeholder]:empty:before {
          content: attr(data-placeholder);
          color: #9ca3af;
        }
      `}</style>
    </main>
  );
}
