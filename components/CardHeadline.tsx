'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { toFrenchBrackets } from '@/lib/frenchBrackets';

export default function CardHeadline({
  title,
  canEdit,
  href,
  patchUrl,
  className,
  ariaLabel = '제목',
  external = false,
}: {
  title: string;
  canEdit: boolean;
  href?: string;
  patchUrl: string;
  className?: string;
  ariaLabel?: string;
  external?: boolean;
}) {
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const [text, setText] = useState(title);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef(title);

  useEffect(() => {
    setText(title);
    pending.current = title;
  }, [title]);

  useLayoutEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [text, canEdit]);

  async function persist(next: string) {
    await fetch(patchUrl, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: next }),
    });
  }

  function queueSave(next: string) {
    pending.current = next;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveTimer.current = null;
      void persist(next);
    }, 400);
  }

  function flushSave() {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    if (pending.current !== title) void persist(pending.current);
  }

  useEffect(() => () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
  }, []);

  if (!canEdit) {
    const copy = toFrenchBrackets(title);
    const body = <span className="card-headline">{copy}</span>;
    if (href) {
      return (
        <a
          href={href}
          target={external ? '_blank' : undefined}
          rel={external ? 'noopener noreferrer' : undefined}
          className={className}
        >
          {body}
        </a>
      );
    }
    return <span className={`card-headline${className ? ` ${className}` : ''}`}>{copy}</span>;
  }

  const editor = (
    <textarea
      ref={areaRef}
      className="card-headline is-editable"
      value={text}
      rows={1}
      aria-label={ariaLabel}
      title="엔터로 줄바꿈, 삭제로 줄바꿈 취소"
      onClick={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
      onChange={(event) => {
        const next = toFrenchBrackets(event.target.value);
        setText(next);
        queueSave(next);
      }}
      onBlur={flushSave}
    />
  );

  if (className) return <div className={className}>{editor}</div>;
  return editor;
}
