'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { toFrenchBrackets } from '@/lib/frenchBrackets';

export default function VideoHeadline({
  videoId,
  title,
  canEdit,
  href,
  className,
}: {
  videoId: string;
  title: string;
  canEdit: boolean;
  href?: string;
  className?: string;
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

  function queueSave(next: string) {
    pending.current = next;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveTimer.current = null;
      void persist(next);
    }, 400);
  }

  async function persist(next: string) {
    await fetch(`/api/video-cards/${videoId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: next }),
    });
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
    if (href) {
      return (
        <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
          <span className="video-headline">{copy}</span>
        </a>
      );
    }
    return <span className={`video-headline${className ? ` ${className}` : ''}`}>{copy}</span>;
  }

  return (
    <textarea
      ref={areaRef}
      className={`video-headline is-editable${className ? ` ${className}` : ''}`}
      value={text}
      rows={1}
      aria-label="영상 제목"
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
}
