'use client';

import { useEffect, useRef, useState } from 'react';
import { toFrenchBrackets } from '@/lib/frenchBrackets';
import { caretOffsetFromPoint, toggleLineBreak } from '@/lib/titleLineBreak';

export default function VideoHeadline({
  videoId,
  title,
  canEdit,
  className,
}: {
  videoId: string;
  title: string;
  canEdit: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [text, setText] = useState(title);

  useEffect(() => {
    setText(title);
  }, [title]);

  async function handleClick(event: React.MouseEvent<HTMLSpanElement>) {
    if (!canEdit || !ref.current) return;
    event.preventDefault();
    event.stopPropagation();
    const offset = caretOffsetFromPoint(ref.current, event.clientX, event.clientY);
    if (offset == null) return;
    const next = toggleLineBreak(text, offset);
    if (next === text) return;
    setText(next);
    await fetch(`/api/video-cards/${videoId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: next }),
    });
  }

  return (
    <span
      ref={ref}
      className={`video-headline${className ? ` ${className}` : ''}${canEdit ? ' is-editable' : ''}`}
      onClick={canEdit ? handleClick : undefined}
      title={canEdit ? '빈 곳을 클릭하면 줄바꿈됩니다' : undefined}
    >
      {toFrenchBrackets(text)}
    </span>
  );
}
