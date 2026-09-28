'use client';

import { useEffect, useRef, useState } from 'react';
import { parseEmbedUrl } from '@/lib/embeds';
import { compressImageFile } from '@/lib/imageCompress';
import PhotoGalleryModal, { GalleryPickedPhoto } from '@/components/PhotoGalleryModal';
import RelatedArticlePickerModal from '@/components/RelatedArticlePickerModal';
import SpecialCharacterModal from '@/components/SpecialCharacterModal';
import AdminSidebar from '@/components/AdminSidebar';
import { WriteShell } from '@/components/AdminNav';
import TagMultiSelect from '@/components/TagMultiSelect';

type Me = { id: string; role: string; name?: string; email?: string };
type Category = { id: string; name: string; slug: string };
type Keyword = { id: string; name: string };
type ArticleSearchResult = { id: string; title: string; author: { name: string }; updatedAt: string };

const WRITER_ROLES = ['REPORTER', 'COLUMNIST', 'CHIEF_EDITOR'];

// 형광펜 — swatch는 툴바의 동그라미 버튼 색, mark는 본문에 칠해지는 반투명 하이라이트 색
const HL_COLORS = [{ key: 'cyan', swatch: '#7FD7F5', mark: 'rgba(127,215,245,0.55)' }];

// 기사 수정 — /write?id=... 로 들어오면 해당 기사를 불러와 채워넣음 (2026-09-11 신설, 관리자 "전체 기사"에서 진입)
function getEditIdFromUrl(): string | null {
  if (typeof window === 'undefined') return null;
  return new URLSearchParams(window.location.search).get('id');
}

export default function WritePage() {
  const [me, setMe] = useState<Me | null | 'loading'>('loading');
  const [categories, setCategories] = useState<Category[]>([]);
  const [keywords, setKeywords] = useState<Keyword[]>([]);

  const [title, setTitle] = useState('');
  const [subtitle1, setSubtitle1] = useState('');
  const [subtitle2, setSubtitle2] = useState('');
  const [subtitle3, setSubtitle3] = useState('');
  const [hoverText, setHoverText] = useState(''); // 카드 이미지 마우스 오버 시 dimmed 배경 위에 흰색으로 표시되는 문구 (2026-09-11 신설)
  const [categoryId, setCategoryId] = useState('');
  const [keywordIds, setKeywordIds] = useState<string[]>([]);
  // 커버이미지 — 별도 업로드 없이 본문에 삽입된 이미지 중 라디오로 선택 (첫 번째 삽입 이미지가 기본값, 2026-09-11 개편)
  const [coverImageUrl, setCoverImageUrl] = useState('');
  const [bodyImageUrls, setBodyImageUrls] = useState<string[]>([]);
  const [isFrontpageTop, setIsFrontpageTop] = useState(false);
  const [cardImages, setCardImages] = useState<{ url: string; caption?: string }[]>([]);
  const [cardUploading, setCardUploading] = useState(false);
  const [bodyImageUploading, setBodyImageUploading] = useState(false);
  // 보도사진 라이브러리 갤러리 픽커 (기능정의서 8.1) — null | 'card' | 'body'(본문 삽입)
  const [galleryTarget, setGalleryTarget] = useState<null | 'card' | 'body'>(null);

  const [keywordBusy, setKeywordBusy] = useState(false);
  const [keywordErrorMsg, setKeywordErrorMsg] = useState('');

  // 테마 — 메인 카드 마우스 오버 시 상단 중앙 핫핑크 배지로 노출됨 (2026-09-11 필드 신설, 2026-09-12 실제 기능 구현)
  const [themeTags, setThemeTags] = useState<string[]>([]);
  const [allThemes, setAllThemes] = useState<string[]>([]);

  // 특수문자 — 에디터 툴바의 @ 버튼으로 여는 레이어(SpecialCharacterModal)에서 삽입/관리 (2026-09-11: 관리자 메뉴 → 에디터 내장으로 이동)
  const [specialCharModalOpen, setSpecialCharModalOpen] = useState(false);

  // 관련기사 — 발행된 기사 중에서 선택 (기능정의서 8.2). 2026-09-11: 별도 레이어(모달)에서 검색+페이지네이션으로 선택하는 구조로 변경
  const [relatedModalOpen, setRelatedModalOpen] = useState(false);
  const [relatedSelected, setRelatedSelected] = useState<ArticleSearchResult[]>([]);

  const [pollEnabled, setPollEnabled] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState<string[]>(['', '']);

  const [articleId, setArticleId] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [resultMsg, setResultMsg] = useState<{ text: string; href?: string } | null>(null);

  // 기사 수정 모드 (/write?id=...) — 기존 기사를 불러와 폼에 채워넣음
  const [editId] = useState<string | null>(getEditIdFromUrl);
  const [loadingArticle, setLoadingArticle] = useState<boolean>(() => !!getEditIdFromUrl());
  const [loadArticleError, setLoadArticleError] = useState('');
  const [loadedContent, setLoadedContent] = useState<string | null>(null);
  const contentAppliedRef = useRef(false);

  const editorRef = useRef<HTMLDivElement>(null);
  const dirtyRef = useRef(false);
  const articleIdRef = useRef<string | null>(null);
  const submittedRef = useRef(false); // 제출 완료 후엔 자동저장 중단
  const savedRangeRef = useRef<Range | null>(null); // 본문 이미지 삽입 위치 기억용 (갤러리 모달이 뜨는 동안 선택영역이 풀리므로)
  const selectedFigureRef = useRef<HTMLElement | null>(null); // 본문에서 클릭으로 선택된 이미지(figure) — Delete/Backspace로 삭제 가능 (2026-09-12 신설)

  const stateRef = useRef({
    title, subtitle1, subtitle2, subtitle3, hoverText, themeTags, categoryId, keywordIds, coverImageUrl, isFrontpageTop, cardImages,
    pollEnabled, pollQuestion, pollOptions, relatedSelected,
  });
  useEffect(() => {
    stateRef.current = {
      title, subtitle1, subtitle2, subtitle3, hoverText, themeTags, categoryId, keywordIds, coverImageUrl, isFrontpageTop, cardImages,
      pollEnabled, pollQuestion, pollOptions, relatedSelected,
    };
  }, [title, subtitle1, subtitle2, subtitle3, hoverText, themeTags, categoryId, keywordIds, coverImageUrl, isFrontpageTop, cardImages, pollEnabled, pollQuestion, pollOptions, relatedSelected]);

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
      const [catRes, kwRes, themeRes] = await Promise.all([
        fetch('/api/categories'),
        fetch('/api/keywords'),
        fetch('/api/themes'),
      ]);
      const cats: Category[] = await catRes.json();
      setCategories(cats);
      // 카테고리 기본값 — "정치"를 기본 선택으로 (사용자 요청 2026-09-11)
      const defaultCat = cats.find((c) => c.name === '정치');
      if (defaultCat) setCategoryId(defaultCat.id);
      setKeywords(await kwRes.json());
      setAllThemes(themeRes.ok ? await themeRes.json() : []);
    })();
  }, []);

  // 수정 모드 — 기존 기사를 불러와 폼 상태에 채워넣음
  useEffect(() => {
    if (!editId) return;
    (async () => {
      setLoadingArticle(true);
      setLoadArticleError('');
      try {
        const res = await fetch(`/api/articles/${editId}/edit`);
        const data = await res.json().catch(() => null);
        if (!res.ok || !data) {
          setLoadArticleError(data?.error ?? '기사를 불러오지 못했습니다.');
          return;
        }
        articleIdRef.current = data.id;
        submittedRef.current = false;
        setArticleId(data.id);
        setTitle(data.title ?? '');
        setSubtitle1(data.subtitle1 ?? '');
        setSubtitle2(data.subtitle2 ?? '');
        setSubtitle3(data.subtitle3 ?? '');
        setHoverText(data.hoverText ?? '');
        setThemeTags((data.themeTags ?? '').split(',').map((t: string) => t.trim()).filter(Boolean));
        setCategoryId(data.categoryId ?? '');
        setKeywordIds((data.keywords ?? []).map((k: { id: string }) => k.id));
        setCoverImageUrl(data.coverImageUrl ?? '');
        setIsFrontpageTop(!!data.isFrontpageTop);
        setCardImages((data.images ?? []).map((img: { url: string; caption?: string | null }) => ({ url: img.url, caption: img.caption ?? undefined })));
        setRelatedSelected(
          (data.relatedArticles ?? []).map((a: ArticleSearchResult) => ({
            id: a.id,
            title: a.title,
            author: a.author,
            updatedAt: a.updatedAt,
          }))
        );
        if (data.poll) {
          setPollEnabled(true);
          setPollQuestion(data.poll.question ?? '');
          setPollOptions((data.poll.options ?? []).map((o: { text: string }) => o.text));
        }
        setLoadedContent(data.content ?? '');
      } finally {
        setLoadingArticle(false);
      }
    })();
  }, [editId]);

  // 본문 에디터는 contentEditable(비제어)이라 불러온 기사 내용을 직접 DOM에 한 번만 주입함
  // (me 로딩이 끝나 폼이 실제로 렌더링된 뒤에야 editorRef가 잡히므로 me도 의존성에 둠)
  useEffect(() => {
    if (loadedContent !== null && !contentAppliedRef.current && editorRef.current) {
      editorRef.current.innerHTML = loadedContent;
      contentAppliedRef.current = true;
      syncBodyImagesFromDom();
    }
  }, [loadedContent, me]);

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
      subtitle1: s.subtitle1 || null,
      subtitle2: s.subtitle2 || null,
      subtitle3: s.subtitle3 || null,
      hoverText: s.hoverText || null,
      themeTags: s.themeTags,
      coverImageUrl: s.coverImageUrl || null,
      content: editorRef.current?.innerHTML ?? '',
      keywordIds: s.keywordIds,
      relatedArticleIds: s.relatedSelected.map((a) => a.id),
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

  async function handleCardImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    setCardUploading(true);
    for (const rawFile of files) {
      const file = await compressImageFile(rawFile); // 10MB 넘으면 브라우저에서 자동으로 줄여서 보냄
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/upload', { method: 'POST', body: form });
      const data = await res.json();
      if (res.ok) setCardImages((prev) => [...prev, { url: data.url }]);
    }
    markDirty();
    setCardUploading(false);
  }

  function handleGallerySelect(items: GalleryPickedPhoto[]) {
    if (galleryTarget === 'card') {
      // 갤러리에 저장된 캡션(제목)을 카드뉴스 캡션으로 그대로 이어받음 (2026-09-12 수정)
      setCardImages((prev) => [...prev, ...items.map((it) => ({ url: it.url, caption: it.title || undefined }))]);
      markDirty();
    } else if (galleryTarget === 'body') {
      if (items[0]) insertBodyImage(items[0].url, items[0].title);
    }
  }

  // 본문 커서 위치에 이미지를 넣는 기능 — 갤러리 모달을 열거나 파일 선택창을 띄우는 순간
  // 에디터의 포커스/선택영역이 풀릴 수 있으므로, 버튼을 누르는 시점의 커서 위치를 저장해뒀다가
  // 실제 삽입 직전에 그 위치로 선택영역을 복원한다.
  function captureEditorSelection() {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && editorRef.current && editorRef.current.contains(sel.anchorNode)) {
      savedRangeRef.current = sel.getRangeAt(0).cloneRange();
    }
  }

  function restoreEditorSelection() {
    editorRef.current?.focus();
    const sel = window.getSelection();
    if (!sel || !editorRef.current) return;
    sel.removeAllRanges();
    if (savedRangeRef.current) {
      sel.addRange(savedRangeRef.current);
    } else {
      // 저장된 위치가 없으면 본문 맨 끝에 삽입
      const range = document.createRange();
      range.selectNodeContents(editorRef.current);
      range.collapse(false);
      sel.addRange(range);
    }
  }

  // 본문 중간에 이미지 삽입 — 이미지 아래에 캡션(설명 문안)을 바로 입력할 수 있는 figcaption을 함께 넣는다.
  // 갤러리에서 이미 캡션(제목)이 저장된 사진을 고르면 그 캡션을 그대로 채워 넣고, 없으면 빈 채로 두어
  // 발행된 글에서는 자동으로 숨겨지고 작성 화면에서만 "입력하세요" 안내문구가 보이게 한다 (2026-09-12 수정 — 갤러리 캡션 미반영 버그).
  function insertBodyImage(url: string, caption?: string | null) {
    restoreEditorSelection();
    const safeUrl = url.replace(/"/g, '&quot;');
    const safeCaption = (caption ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    const html =
      '<figure class="article-figure">' +
      `<img src="${safeUrl}" alt="" />` +
      `<figcaption data-placeholder="이미지 설명을 입력하세요 (선택)">${safeCaption}</figcaption>` +
      '</figure><p><br></p>';
    document.execCommand('insertHTML', false, html);
    savedRangeRef.current = null;
    markDirty();
    syncBodyImagesFromDom();
  }

  // 커버이미지 — 별도 업로드 없이 본문에 실제로 삽입돼 있는 이미지들을 스캔해 라디오 선택 후보로 삼는다.
  // 사용자가 본문에서 이미지를 직접 지우는 경우까지 반영하기 위해 별도 상태 배열 대신 DOM을 매번 다시 읽는다 (2026-09-11 신설).
  function syncBodyImagesFromDom() {
    if (!editorRef.current) return;
    const imgs = Array.from(editorRef.current.querySelectorAll('img'))
      .map((img) => img.getAttribute('src') || '')
      .filter(Boolean);
    setBodyImageUrls(imgs);
    setCoverImageUrl((prev) => (prev && imgs.includes(prev) ? prev : imgs[0] || ''));
  }

  function handleEditorInput() {
    markDirty();
    syncBodyImagesFromDom();
  }

  // 본문 이미지 클릭 선택 + Delete/Backspace 삭제 — 이미지를 마우스로 클릭하면 테두리로 선택 표시되고,
  // 그 상태에서 Delete(또는 Backspace)를 누르면 이미지와 캡션(figure 전체)이 함께 삭제된다 (2026-09-12 신설)
  function clearImageSelection() {
    if (selectedFigureRef.current) {
      selectedFigureRef.current.classList.remove('is-selected');
      selectedFigureRef.current = null;
    }
  }

  function handleEditorClick(e: React.MouseEvent<HTMLDivElement>) {
    const target = e.target as HTMLElement;
    const figure = target.closest?.('.article-figure') as HTMLElement | null;
    if (target.tagName === 'IMG' && figure) {
      clearImageSelection();
      figure.classList.add('is-selected');
      selectedFigureRef.current = figure;
    } else {
      clearImageSelection();
    }
  }

  function handleEditorKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if ((e.key === 'Delete' || e.key === 'Backspace') && selectedFigureRef.current) {
      e.preventDefault();
      selectedFigureRef.current.remove();
      selectedFigureRef.current = null;
      markDirty();
      syncBodyImagesFromDom();
    }
  }

  function openBodyGallery() {
    captureEditorSelection();
    setGalleryTarget('body');
  }

  async function handleBodyImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const rawFile = e.target.files?.[0];
    if (!rawFile) return;
    setBodyImageUploading(true);
    setErrorMsg('');
    try {
      const file = await compressImageFile(rawFile); // 10MB 넘으면 브라우저에서 자동으로 줄여서 보냄
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/upload', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error ?? '업로드 실패');
        return;
      }
      insertBodyImage(data.url);
    } finally {
      setBodyImageUploading(false);
      e.target.value = '';
    }
  }

  function removeCardImage(url: string) {
    setCardImages((prev) => prev.filter((img) => img.url !== url));
    markDirty();
  }

  function toggleKeyword(id: string) {
    setKeywordIds((prev) => (prev.includes(id) ? prev.filter((k) => k !== id) : [...prev, id]));
    markDirty();
  }

  async function addKeywordInline(name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    const existing = keywords.find((k) => k.name === trimmed);
    if (existing) {
      if (!keywordIds.includes(existing.id)) {
        setKeywordIds((prev) => [...prev, existing.id]);
        markDirty();
      }
      return;
    }
    setKeywordBusy(true);
    setKeywordErrorMsg('');
    try {
      const res = await fetch('/api/keywords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) {
        setKeywordErrorMsg(data.error ?? '키워드 추가에 실패했습니다.');
        return;
      }
      setKeywords((prev) => (prev.some((k) => k.id === data.id) ? prev : [...prev, data].sort((a, b) => a.name.localeCompare(b.name, 'ko'))));
      setKeywordIds((prev) => (prev.includes(data.id) ? prev : [...prev, data.id]));
      markDirty();
    } finally {
      setKeywordBusy(false);
    }
  }

  function toggleTheme(name: string) {
    setThemeTags((prev) => (prev.includes(name) ? prev.filter((t) => t !== name) : [...prev, name]));
    markDirty();
  }

  function addThemeInline(name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    setThemeTags((prev) => (prev.includes(trimmed) ? prev : [...prev, trimmed]));
    setAllThemes((prev) => (prev.includes(trimmed) ? prev : [...prev, trimmed].sort((a, b) => a.localeCompare(b, 'ko'))));
    markDirty();
  }

  // 관련기사 선택 — 별도 레이어(RelatedArticlePickerModal)에서 검색+페이지네이션으로 골라 반환됨 (기능정의서 8.2)
  function handleRelatedArticlesSelected(articles: ArticleSearchResult[]) {
    setRelatedSelected((prev) => {
      const existingIds = new Set(prev.map((a) => a.id));
      const merged = [...prev];
      for (const a of articles) {
        if (!existingIds.has(a.id)) {
          merged.push(a);
          existingIds.add(a.id);
        }
      }
      return merged;
    });
    markDirty();
  }

  function removeRelatedArticle(id: string) {
    setRelatedSelected((prev) => prev.filter((a) => a.id !== id));
    markDirty();
  }

  // 형광펜 — 동그라미 색상 스와치 3종 중 골라서 드래그한 문장에 적용 (2026-09-11 개편, 버튼 글자 "형광펜" 제거)
  function applyHighlight(markColor: string) {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;
    const range = sel.getRangeAt(0);
    if (!editorRef.current?.contains(range.commonAncestorContainer)) return;
    const mark = document.createElement('mark');
    mark.className = 'hl-mark';
    mark.style.background = markColor;
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
    editorRef.current?.focus();
    document.execCommand(cmd, false);
    markDirty();
  }

  // 특수문자 레이어(SpecialCharacterModal) 관련 — 갤러리/관련기사 모달과 동일하게 여는 순간 커서 위치를 저장해뒀다가
  // 문자를 클릭할 때마다 그 위치로 복원 후 삽입하고, 곧바로 다음 삽입을 위해 새 위치를 다시 저장한다(모달은 닫지 않음).
  function openSpecialCharModal() {
    captureEditorSelection();
    setSpecialCharModalOpen(true);
  }

  function insertSpecialChar(char: string) {
    restoreEditorSelection();
    document.execCommand('insertText', false, char);
    captureEditorSelection();
    markDirty();
  }

  // 링크(임베드 버튼) — 원래 텍스트를 드래그해서 선택한 뒤 누르면 주소창(prompt)이 뜨고, 그 URL로 연결되는 링크가 됨.
  // (유튜브/X/인스타그램 게시물을 실제로 카드 형태로 임베드하는 것은 버튼이 아니라 본문에 SNS 주소를 그냥 붙여넣을 때
  // 자동으로 처리되는 기능으로 별도 내장되어 있음 — 아래 handleEditorPaste 참고, 2026-09-11 개편)
  function insertLinkForSelection() {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed || !editorRef.current?.contains(sel.getRangeAt(0).commonAncestorContainer)) {
      setErrorMsg('먼저 링크로 만들 문장을 드래그해서 선택해주세요.');
      return;
    }
    // window.prompt()로 주소창이 뜨는 순간 브라우저가 포커스를 잃으면서 드래그 선택이 풀려버리므로,
    // prompt를 띄우기 전에 선택 범위를 미리 복제해뒀다가 그걸로 링크를 삽입한다 (선택 풀림 버그 수정, 2026-09-11)
    const savedRange = sel.getRangeAt(0).cloneRange();
    const url = window.prompt('연결할 URL을 입력하세요');
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    try {
      savedRange.surroundContents(a);
    } catch {
      const content = savedRange.extractContents();
      a.appendChild(content);
      savedRange.insertNode(a);
    }
    window.getSelection()?.removeAllRanges();
    markDirty();
  }

  // SNS 주소를 복사해서 본문에 그냥 붙여넣으면, 별다른 선택 없이 해당 게시물이 자동으로 임베드되는 기능 (2026-09-11 신설)
  function handleEditorPaste(e: React.ClipboardEvent<HTMLDivElement>) {
    const text = e.clipboardData.getData('text/plain')?.trim();
    if (text && !/\s/.test(text)) {
      const embed = parseEmbedUrl(text);
      if (embed) {
        e.preventDefault();
        document.execCommand('insertHTML', false, embed.html + '<p><br></p>');
        markDirty();
        return;
      }
    }
    // 그 외 일반 붙여넣기는 브라우저 기본 동작 그대로 — 이후 onInput에서 markDirty/이미지 스캔 처리됨
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
      subtitle1: s.subtitle1 || null,
      subtitle2: s.subtitle2 || null,
      subtitle3: s.subtitle3 || null,
      hoverText: s.hoverText || null,
      themeTags: s.themeTags,
      coverImageUrl: s.coverImageUrl || null,
      categoryId: s.categoryId,
      content,
      keywordIds: s.keywordIds,
      relatedArticleIds: s.relatedSelected.map((a) => a.id),
      images: s.cardImages,
      poll: pollPayload(s),
      isFrontpageTop: s.isFrontpageTop,
      intent: 'submit',
    };

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
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setErrorMsg(data?.error ?? `제출 실패 (오류 코드 ${res.status})`);
        return;
      }
      if (!data) {
        setErrorMsg('서버 응답을 처리하지 못했습니다. 잠시 후 다시 시도해주세요.');
        return;
      }
      submittedRef.current = true;
      if (data.status === 'PUBLISHED') {
        setResultMsg({ text: editId ? '수정 내용이 저장되었습니다.' : '발행되었습니다.', href: `/article/${data.id}` });
      } else {
        setResultMsg({ text: editId ? '수정 내용이 저장되었습니다 (승인 대기 상태).' : '편집장 승인 대기 중입니다. 승인되면 발행됩니다.' });
      }
    } catch (e) {
      setErrorMsg('제출 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
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
  if (editId && loadingArticle) {
    return <main className="max-w-3xl mx-auto px-4 py-10 text-gray-500">기사를 불러오는 중…</main>;
  }
  if (editId && loadArticleError) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-10">
        <p className="text-red-600">{loadArticleError}</p>
      </main>
    );
  }

  const submitLabel = editId ? '수정 저장' : me.role === 'REPORTER' ? '승인 요청' : '발행하기';

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

  const formBody = (
    <div className="composer">
      {errorMsg && <p className="text-red-600 text-sm mb-4">{errorMsg}</p>}

      <div className="composer-title-row">
        <input
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            markDirty();
          }}
          placeholder="제목"
          className="composer-title"
        />
      </div>

      <div className="composer-subs">
        {[
          { value: subtitle1, set: setSubtitle1, ph: '부제목 1' },
          { value: subtitle2, set: setSubtitle2, ph: '부제목 2' },
          { value: subtitle3, set: setSubtitle3, ph: '부제목 3' },
        ].map((sub, i) => (
          <input
            key={i}
            value={sub.value}
            onChange={(e) => {
              sub.set(e.target.value);
              markDirty();
            }}
            placeholder={sub.ph}
            className="composer-line"
          />
        ))}
        <input
          value={hoverText}
          onChange={(e) => {
            setHoverText(e.target.value);
            markDirty();
          }}
          placeholder="카드 마우스 오버 문안"
          className="composer-line"
        />
      </div>

      <div className="composer-editor">
        <div className="composer-toolbar" onMouseDown={(e) => e.preventDefault()}>
          <button type="button" onClick={() => exec('bold')} className="toolbar-btn font-bold" title="굵게">
            B
          </button>
          <button type="button" onClick={() => exec('italic')} className="toolbar-btn italic" title="기울임">
            I
          </button>
          <button type="button" onClick={() => exec('underline')} className="toolbar-btn underline" title="밑줄">
            U
          </button>
          <span className="inline-flex items-center gap-1 px-0.5">
            {HL_COLORS.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => applyHighlight(c.mark)}
                className="w-5 h-5 rounded-full border border-black/10 shrink-0"
                style={{ background: c.swatch, boxShadow: `0 0 8px ${c.swatch}` }}
                title="형광펜"
              />
            ))}
          </span>
          <button
            type="button"
            onClick={insertLinkForSelection}
            className="toolbar-btn"
            title="선택한 문장을 드래그한 뒤 누르면 URL 링크로 연결됩니다"
          >
            링크
          </button>
          <span className="composer-rule" />
          <label className="toolbar-btn cursor-pointer" title="사진을 업로드해서 커서 위치에 삽입">
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onClick={captureEditorSelection}
              onChange={handleBodyImageUpload}
            />
            {bodyImageUploading ? '업로드 중…' : '사진'}
          </label>
          <button
            type="button"
            onClick={openBodyGallery}
            className="toolbar-btn"
            title="사진 라이브러리(갤러리)에서 골라 커서 위치에 삽입"
          >
            갤러리
          </button>
          <span className="composer-rule" />
          <button
            type="button"
            onClick={openSpecialCharModal}
            className="toolbar-btn"
            title="특수문자 삽입 (누르면 문자 레이어가 열립니다)"
          >
            특수문자
          </button>
          <span className="composer-save">
            {saving ? '저장 중…' : lastSavedAt ? `저장됨 ${lastSavedAt.toLocaleTimeString('ko-KR')}` : ''}
          </span>
        </div>
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={handleEditorInput}
          onPaste={handleEditorPaste}
          onClick={handleEditorClick}
          onKeyDown={handleEditorKeyDown}
          onBlur={clearImageSelection}
          className="composer-body"
          data-placeholder="본문을 입력하세요"
          tabIndex={0}
        />
      </div>

      <div className="composer-picks">
        <TagMultiSelect
          label="카테고리"
          options={categories.map((c) => ({ id: c.id, name: c.name }))}
          selectedIds={categoryId ? [categoryId] : []}
          onToggle={(id) => {
            setCategoryId(id);
            markDirty();
          }}
          multiple={false}
          canCreate={false}
          searchable={false}
          placeholder="카테고리"
        />
        <TagMultiSelect
          label="키워드"
          options={keywords}
          selectedIds={keywordIds}
          onToggle={toggleKeyword}
          onCreate={addKeywordInline}
          creating={keywordBusy}
          placeholder="키워드 선택"
        />
        <TagMultiSelect
          label="테마"
          options={Array.from(new Set([...allThemes, ...themeTags])).map((t) => ({ id: t, name: t }))}
          selectedIds={themeTags}
          onToggle={toggleTheme}
          onCreate={addThemeInline}
          placeholder="테마 선택"
        />
      </div>
      {keywordErrorMsg && <p className="text-red-600 text-xs mt-1">{keywordErrorMsg}</p>}

      <div className="composer-panel">
        <p className="composer-panel-title">커버 이미지</p>
        {bodyImageUrls.length === 0 ? (
          <p className="composer-hint">본문에 사진을 넣으면 여기서 커버를 고를 수 있습니다.</p>
        ) : (
          <div className="flex flex-wrap gap-3 mt-3">
            {bodyImageUrls.map((url, i) => (
              <label key={`${url}-${i}`} className="flex flex-col items-center gap-1 cursor-pointer">
                <span className="relative">
                  <img
                    src={url}
                    alt=""
                    className={`h-16 w-24 object-cover rounded border-2 ${
                      coverImageUrl === url ? 'border-brand' : 'border-gray-200'
                    }`}
                  />
                </span>
                <span className="flex items-center gap-1 text-[11px] text-gray-500">
                  <input
                    type="radio"
                    name="coverImage"
                    checked={coverImageUrl === url}
                    onChange={() => {
                      setCoverImageUrl(url);
                      markDirty();
                    }}
                  />
                  {i === 0 ? '기본' : `${i + 1}번째`}
                </span>
              </label>
            ))}
          </div>
        )}
      </div>

      <div className="composer-panel">
        <div className="composer-panel-head">
          <p className="composer-panel-title">관련기사</p>
          <button
            type="button"
            onClick={() => setRelatedModalOpen(true)}
            className="text-xs font-bold text-brand border border-brand/30 rounded-full px-3 py-1.5 hover:bg-brand/5"
          >
            추가
          </button>
        </div>
        {relatedSelected.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {relatedSelected.map((a) => (
              <span
                key={a.id}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-700 bg-gray-50 border border-gray-200 rounded-full pl-3 pr-1.5 py-1"
              >
                {a.title}
                <button
                  type="button"
                  onClick={() => removeRelatedArticle(a.id)}
                  className="w-4 h-4 rounded-full text-gray-400 hover:text-red-500"
                >
                  x
                </button>
              </span>
            ))}
          </div>
        ) : (
          <p className="composer-hint">아직 연결된 기사가 없습니다.</p>
        )}
      </div>

      <div className="composer-panel">
        <button
          type="button"
          aria-pressed={pollEnabled}
          onClick={() => togglePoll(!pollEnabled)}
          className={`composer-toggle${pollEnabled ? ' is-on' : ''}`}
        >
          설문 추가
        </button>
        {pollEnabled && (
          <div className="mt-3 space-y-2">
            <input
              value={pollQuestion}
              onChange={(e) => {
                setPollQuestion(e.target.value);
                markDirty();
              }}
              placeholder="질문"
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
                    x
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
                항목 추가
              </button>
            )}
          </div>
        )}
      </div>

      <div className="composer-actions">
        {me.role !== 'REPORTER' ? (
          <button
            type="button"
            aria-pressed={isFrontpageTop}
            onClick={() => {
              setIsFrontpageTop((v) => !v);
              markDirty();
            }}
            className={`composer-toggle${isFrontpageTop ? ' is-on' : ''}`}
          >
            1면톱
          </button>
        ) : null}
        <div className="composer-actions-btns">
          <button type="button" onClick={doAutosave} className="composer-toggle">
            임시저장
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={handleSubmit}
            className="composer-submit"
          >
            {submitting ? '처리 중…' : submitLabel}
          </button>
        </div>
      </div>

      <PhotoGalleryModal
        open={galleryTarget !== null}
        multiple={galleryTarget === 'card'}
        onClose={() => setGalleryTarget(null)}
        onSelect={handleGallerySelect}
        canManage={me.role === 'CHIEF_EDITOR'}
      />

      <RelatedArticlePickerModal
        open={relatedModalOpen}
        onClose={() => setRelatedModalOpen(false)}
        onSelect={handleRelatedArticlesSelected}
        excludeIds={[...relatedSelected.map((a) => a.id), ...(articleId ? [articleId] : [])]}
      />

      <SpecialCharacterModal
        open={specialCharModalOpen}
        onClose={() => setSpecialCharModalOpen(false)}
        onSelect={insertSpecialChar}
        canManage={me.role === 'CHIEF_EDITOR'}
      />
    </div>
  );

  // 편집장은 좌측 관리자 메뉴와 함께, 그 외(기자/논설위원)는 기존처럼 단독 화면으로 노출 (2026-09-11 신설)
  // 작성 폼은 메뉴 오른쪽의 남는 폭 한가운데 — 승인 대기함 등과 같은 패턴
  return me.role === 'CHIEF_EDITOR' ? (
    <WriteShell>
      <AdminSidebar />
      <div className="min-w-0 flex-1">
        <div className="mx-auto max-w-3xl py-8">{formBody}</div>
      </div>
    </WriteShell>
  ) : (
    <main className="max-w-3xl mx-auto px-4 py-8">{formBody}</main>
  );
}
