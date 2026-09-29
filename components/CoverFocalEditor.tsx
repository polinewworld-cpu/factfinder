'use client';

import { useRef, useState, type PointerEvent } from 'react';
import { cardImageRatio, clampFocal, coverObjectPosition } from '@/lib/cardImage';

export default function CoverFocalEditor({
  imageUrl,
  articleId,
  x,
  y,
  onChangeX,
  onChangeY,
}: {
  imageUrl: string;
  articleId?: string | null;
  x: number;
  y: number;
  onChangeX: (value: number) => void;
  onChangeY: (value: number) => void;
}) {
  const ratio = cardImageRatio(articleId);
  const frameRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const dragRef = useRef<{
    pointerId: number;
    lastX: number;
    lastY: number;
    focalX: number;
    focalY: number;
  } | null>(null);
  const [dragging, setDragging] = useState(false);

  function overflow() {
    const frame = frameRef.current;
    const img = imgRef.current;
    if (!frame || !img || !img.naturalWidth || !img.naturalHeight) {
      return { x: 0, y: 0 };
    }
    const boxW = frame.clientWidth;
    const boxH = frame.clientHeight;
    const scale = Math.max(boxW / img.naturalWidth, boxH / img.naturalHeight);
    return {
      x: Math.max(0, img.naturalWidth * scale - boxW),
      y: Math.max(0, img.naturalHeight * scale - boxH),
    };
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      lastX: event.clientX,
      lastY: event.clientY,
      focalX: x,
      focalY: y,
    };
    setDragging(true);
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || event.pointerId !== drag.pointerId) return;
    const dx = event.clientX - drag.lastX;
    const dy = event.clientY - drag.lastY;
    drag.lastX = event.clientX;
    drag.lastY = event.clientY;
    const extra = overflow();
    if (extra.x > 0.5) {
      drag.focalX = clampFocal(drag.focalX - (dx / extra.x) * 100);
      onChangeX(drag.focalX);
    }
    if (extra.y > 0.5) {
      drag.focalY = clampFocal(drag.focalY - (dy / extra.y) * 100);
      onChangeY(drag.focalY);
    }
  }

  function endDrag(event: PointerEvent<HTMLDivElement>) {
    if (!dragRef.current || event.pointerId !== dragRef.current.pointerId) return;
    dragRef.current = null;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  return (
    <div className="cover-focal">
      <div
        ref={frameRef}
        className={`cover-focal-preview${dragging ? ' is-dragging' : ''}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <img
          ref={imgRef}
          src={imageUrl}
          alt=""
          draggable={false}
          style={{
            aspectRatio: `1 / ${ratio}`,
            objectPosition: coverObjectPosition(x, y),
          }}
        />
      </div>
      <div className="cover-focal-side">
        <p className="cover-focal-hint">사진을 끌어 카드에 보이는 위치를 맞춥니다. 미리보기가 홈·카테고리 카드와 같습니다.</p>
        <button
          type="button"
          className="cover-focal-reset"
          onClick={() => {
            onChangeX(50);
            onChangeY(50);
          }}
        >
          가운데로
        </button>
      </div>
    </div>
  );
}
