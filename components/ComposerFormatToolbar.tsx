'use client';

import { useEffect, useLayoutEffect, useRef, useState, type ChangeEvent, type ReactNode, type RefObject } from 'react';

export type FormatToolbarHandlers = {
  exec: (cmd: string) => void;
  applyHighlight: (mark: string) => void;
  insertLink: () => void;
  captureSelection: () => void;
  onPhotoChange: (event: ChangeEvent<HTMLInputElement>) => void;
  photoUploading: boolean;
  openGallery: () => void;
  openSpecialChars: () => void;
};

export const COMPOSER_HIGHLIGHTS = [{ key: 'cyan', swatch: '#7FD7F5', mark: 'rgba(127,215,245,0.55)' }] as const;

type FormatToolbarItem =
  | { id: string; kind: 'button'; title: string; label: ReactNode | ((h: FormatToolbarHandlers) => ReactNode); className?: string; run: (h: FormatToolbarHandlers) => void }
  | { id: string; kind: 'highlight'; title: string; swatch: string; mark: string }
  | { id: string; kind: 'file'; title: string; label: string; accept: string }
  | { id: string; kind: 'rule' };

// Add tools here. The top composer bar and the selection bubble both render this list.
export const COMPOSER_FORMAT_ITEMS: FormatToolbarItem[] = [
  { id: 'bold', kind: 'button', title: '굵게', label: 'B', className: 'font-bold', run: (h) => h.exec('bold') },
  { id: 'italic', kind: 'button', title: '기울임', label: 'I', className: 'italic', run: (h) => h.exec('italic') },
  { id: 'underline', kind: 'button', title: '밑줄', label: 'U', className: 'underline', run: (h) => h.exec('underline') },
  ...COMPOSER_HIGHLIGHTS.map((c) => ({
    id: `hl-${c.key}`,
    kind: 'highlight' as const,
    title: '형광펜',
    swatch: c.swatch,
    mark: c.mark,
  })),
  {
    id: 'link',
    kind: 'button',
    title: '선택한 문장을 드래그한 뒤 누르면 URL 링크로 연결됩니다',
    label: '링크',
    run: (h) => h.insertLink(),
  },
  { id: 'rule-media', kind: 'rule' },
  {
    id: 'photo',
    kind: 'file',
    title: '사진을 업로드해서 커서 위치에 삽입',
    label: '사진',
    accept: 'image/jpeg,image/png,image/webp,image/gif,image/avif,.avif',
  },
  {
    id: 'gallery',
    kind: 'button',
    title: '사진 뱅크에서 골라 커서 위치에 삽입 (캡션·크레디트 자동)',
    label: '사진 뱅크',
    run: (h) => h.openGallery(),
  },
  { id: 'rule-special', kind: 'rule' },
  {
    id: 'special',
    kind: 'button',
    title: '특수문자 삽입 (누르면 문자 레이어가 열립니다)',
    label: '특수문자',
    run: (h) => h.openSpecialChars(),
  },
];

export function ComposerFormatTools({
  handlers,
  idPrefix,
}: {
  handlers: FormatToolbarHandlers;
  idPrefix: string;
}) {
  return (
    <>
      {COMPOSER_FORMAT_ITEMS.map((item) => {
        if (item.kind === 'rule') {
          return <span key={item.id} className="composer-rule" />;
        }
        if (item.kind === 'highlight') {
          return (
            <button
              key={item.id}
              type="button"
              className="toolbar-hl"
              style={{ background: item.swatch, boxShadow: `0 0 8px ${item.swatch}` }}
              title={item.title}
              onClick={() => handlers.applyHighlight(item.mark)}
            />
          );
        }
        if (item.kind === 'file') {
          return (
            <label key={item.id} className="toolbar-btn cursor-pointer" title={item.title}>
              <input
                id={`${idPrefix}-${item.id}`}
                type="file"
                accept={item.accept}
                className="hidden"
                aria-label={item.label}
                onClick={handlers.captureSelection}
                onChange={handlers.onPhotoChange}
              />
              {handlers.photoUploading ? '업로드 중…' : item.label}
            </label>
          );
        }
        return (
          <button
            key={item.id}
            type="button"
            className={`toolbar-btn${item.className ? ` ${item.className}` : ''}`}
            title={item.title}
            onClick={() => item.run(handlers)}
          >
            {typeof item.label === 'function' ? item.label(handlers) : item.label}
          </button>
        );
      })}
    </>
  );
}

type BubblePos = { x: number; y: number; bottom: number };

function nodeInEditor(editor: HTMLElement, node: Node | null) {
  if (!node) return false;
  return node === editor || editor.contains(node);
}

function selectionAnchor(editor: HTMLElement): BubblePos | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null;
  if (!nodeInEditor(editor, sel.anchorNode) || !nodeInEditor(editor, sel.focusNode)) return null;
  const range = sel.getRangeAt(0);
  const rects = range.getClientRects();
  const rect = (rects.length ? rects[0] : range.getBoundingClientRect()) as DOMRect;
  if (!rect || (rect.width === 0 && rect.height === 0)) return null;
  return { x: rect.left + rect.width / 2, y: rect.top, bottom: rect.bottom };
}

export function ComposerSelectionToolbar({
  editorRef,
  handlers,
}: {
  editorRef: RefObject<HTMLDivElement>;
  handlers: FormatToolbarHandlers;
}) {
  const barRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<BubblePos | null>(null);

  useEffect(() => {
    let frame = 0;
    function refresh() {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const editor = editorRef.current;
        if (!editor) {
          setPos(null);
          return;
        }
        setPos(selectionAnchor(editor));
      });
    }

    document.addEventListener('selectionchange', refresh);
    document.addEventListener('mouseup', refresh);
    document.addEventListener('keyup', refresh);
    window.addEventListener('resize', refresh);
    window.addEventListener('scroll', refresh, true);
    refresh();
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('selectionchange', refresh);
      document.removeEventListener('mouseup', refresh);
      document.removeEventListener('keyup', refresh);
      window.removeEventListener('resize', refresh);
      window.removeEventListener('scroll', refresh, true);
    };
  }, [editorRef]);

  useLayoutEffect(() => {
    const el = barRef.current;
    if (!el || !pos) return;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    let left = pos.x - w / 2;
    left = Math.min(window.innerWidth - w - 8, Math.max(8, left));
    let top = pos.y - h - 8;
    if (top < 8) top = pos.bottom + 8;
    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
  }, [pos]);

  if (!pos) return null;

  return (
    <div
      ref={barRef}
      className="composer-bubble composer-format-bar"
      role="toolbar"
      aria-label="본문 서식"
      onMouseDown={(event) => event.preventDefault()}
    >
      <ComposerFormatTools handlers={handlers} idPrefix="composer-bubble" />
    </div>
  );
}
