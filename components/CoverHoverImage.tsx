'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import {
  COVER_HOVER_SCALE,
  clampFocal,
  coverDrawnLayout,
  coverHoverPanVars,
  coverObjectPosition,
  coverOverflowAxis,
  coverOverflowPx,
} from '@/lib/cardImage';

type CoverHoverStyle = CSSProperties & {
  '--cover-ox': string;
  '--cover-oy': string;
  '--cover-pan-x': string;
  '--cover-pan-y': string;
};

type Drawn = { width: number; height: number; left: number; top: number };

export default function CoverHoverImage({
  src,
  alt = '',
  lazy = true, // 화면 밖 카드 사진은 나중에 불러옴 (SEO·속도, 2026-10-08)
  aspectRatio,
  focalX,
  focalY,
  className,
  fallbackAxis = 'x',
  fill = false,
  contentAspect,
  fallbackSrc,
  editable = false,
  onFocalChange,
  onFocalCommit,
}: {
  src: string;
  alt?: string;
  lazy?: boolean;
  aspectRatio?: string;
  focalX?: number | null;
  focalY?: number | null;
  className?: string;
  fallbackAxis?: 'x' | 'y';
  fill?: boolean;
  contentAspect?: number | null;
  fallbackSrc?: string;
  editable?: boolean;
  onFocalChange?: (x: number, y: number) => void;
  onFocalCommit?: (x: number, y: number) => void;
}) {
  const frameRef = useRef<HTMLSpanElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const ox = clampFocal(focalX);
  const oy = clampFocal(focalY);
  const [drawn, setDrawn] = useState<Drawn | null>(null);
  const [currentSrc, setCurrentSrc] = useState(src);
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<{
    pointerId: number;
    lastX: number;
    lastY: number;
    focalX: number;
    focalY: number;
    moved: boolean;
  } | null>(null);
  const suppressClickRef = useRef(false);
  const pan = coverHoverPanVars(fallbackAxis, ox, oy);

  useEffect(() => {
    setCurrentSrc(src);
    setDrawn(null);
  }, [src]);

  const applyLayout = useCallback(() => {
    const frame = frameRef.current;
    const img = imgRef.current;
    if (!frame || !img?.naturalWidth) return;
    const boxW = frame.clientWidth;
    const boxH = frame.clientHeight;
    if (!boxW || !boxH) return;
    const nextDrawn = coverDrawnLayout(
      boxW,
      boxH,
      img.naturalWidth,
      img.naturalHeight,
      ox,
      oy,
      contentAspect,
    );
    setDrawn((prev) => {
      if (
        prev &&
        Math.abs(prev.width - nextDrawn.width) < 0.5 &&
        Math.abs(prev.height - nextDrawn.height) < 0.5 &&
        Math.abs(prev.left - nextDrawn.left) < 0.5 &&
        Math.abs(prev.top - nextDrawn.top) < 0.5
      ) {
        return prev;
      }
      return nextDrawn;
    });
    const axis = coverOverflowAxis(
      img.naturalWidth,
      img.naturalHeight,
      boxW,
      boxH,
      fallbackAxis,
      contentAspect,
    );
    const next = coverHoverPanVars(axis, ox, oy, COVER_HOVER_SCALE, boxW, boxH);
    img.style.setProperty('--cover-ox', next.originX);
    img.style.setProperty('--cover-oy', next.originY);
    img.style.setProperty('--cover-pan-x', next.panX);
    img.style.setProperty('--cover-pan-y', next.panY);
  }, [contentAspect, fallbackAxis, ox, oy]);

  useLayoutEffect(() => {
    applyLayout();
    const frame = frameRef.current;
    if (!frame) return;
    const observer = new ResizeObserver(applyLayout);
    observer.observe(frame);
    return () => observer.disconnect();
  }, [applyLayout, currentSrc]);

  function onPointerDown(event: PointerEvent<HTMLSpanElement>) {
    if (!editable || event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      lastX: event.clientX,
      lastY: event.clientY,
      focalX: ox,
      focalY: oy,
      moved: false,
    };
    suppressClickRef.current = false;
    setDragging(true);
  }

  function onPointerMove(event: PointerEvent<HTMLSpanElement>) {
    const drag = dragRef.current;
    if (!drag || event.pointerId !== drag.pointerId) return;
    const dx = event.clientX - drag.lastX;
    const dy = event.clientY - drag.lastY;
    drag.lastX = event.clientX;
    drag.lastY = event.clientY;
    if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
      drag.moved = true;
      suppressClickRef.current = true;
    }
    const frame = frameRef.current;
    const img = imgRef.current;
    if (!frame || !img?.naturalWidth) return;
    const extra = coverOverflowPx(
      frame.clientWidth,
      frame.clientHeight,
      img.naturalWidth,
      img.naturalHeight,
      contentAspect,
    );
    if (extra.x > 0.5) {
      drag.focalX = clampFocal(drag.focalX - (dx / extra.x) * 100);
      onFocalChange?.(drag.focalX, drag.focalY);
    }
    if (extra.y > 0.5) {
      drag.focalY = clampFocal(drag.focalY - (dy / extra.y) * 100);
      onFocalChange?.(drag.focalX, drag.focalY);
    }
  }

  function endDrag(event: PointerEvent<HTMLSpanElement>) {
    const drag = dragRef.current;
    if (!drag || event.pointerId !== drag.pointerId) return;
    dragRef.current = null;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (drag.moved) onFocalCommit?.(drag.focalX, drag.focalY);
  }

  const hoverVars: CoverHoverStyle = {
    '--cover-ox': pan.originX,
    '--cover-oy': pan.originY,
    '--cover-pan-x': pan.panX,
    '--cover-pan-y': pan.panY,
  };

  const imgStyle: CoverHoverStyle = drawn
    ? {
        position: 'absolute',
        width: drawn.width,
        height: drawn.height,
        left: drawn.left,
        top: drawn.top,
        maxWidth: 'none',
        objectFit: 'fill',
        transformOrigin: `${ox}% ${oy}%`,
        ...hoverVars,
      }
    : {
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        objectPosition: coverObjectPosition(ox, oy),
        transformOrigin: `${ox}% ${oy}%`,
        ...hoverVars,
      };

  return (
    <span
      ref={frameRef}
      className={`cover-hover-frame${fill ? ' cover-hover-frame--fill' : ''}${editable ? ' is-editable' : ''}${dragging ? ' is-dragging' : ''}${className ? ` ${className}` : ''}`}
      style={fill ? undefined : { aspectRatio }}
      onPointerDown={editable ? onPointerDown : undefined}
      onPointerMove={editable ? onPointerMove : undefined}
      onPointerUp={editable ? endDrag : undefined}
      onPointerCancel={editable ? endDrag : undefined}
      onClick={
        editable
          ? (event) => {
              if (suppressClickRef.current) {
                event.preventDefault();
                event.stopPropagation();
                suppressClickRef.current = false;
              }
            }
          : undefined
      }
    >
      <img
        ref={imgRef}
        src={currentSrc}
        alt={alt}
        loading={lazy ? 'lazy' : undefined}
        decoding="async"
        draggable={false}
        onLoad={applyLayout}
        onError={() => {
          if (fallbackSrc && currentSrc !== fallbackSrc) setCurrentSrc(fallbackSrc);
        }}
        style={imgStyle}
      />
    </span>
  );
}
