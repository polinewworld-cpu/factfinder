'use client';

import { useCallback, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import {
  COVER_HOVER_SCALE,
  clampFocal,
  coverDrawnLayout,
  coverHoverPanVars,
  coverObjectPosition,
  coverOverflowAxis,
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
  aspectRatio,
  focalX,
  focalY,
  className,
  fallbackAxis = 'x',
  fill = false,
}: {
  src: string;
  alt?: string;
  aspectRatio?: string;
  focalX?: number | null;
  focalY?: number | null;
  className?: string;
  fallbackAxis?: 'x' | 'y';
  fill?: boolean;
}) {
  const frameRef = useRef<HTMLSpanElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const ox = clampFocal(focalX);
  const oy = clampFocal(focalY);
  const [drawn, setDrawn] = useState<Drawn | null>(null);
  const pan = coverHoverPanVars(fallbackAxis, ox, oy);

  const applyLayout = useCallback(() => {
    const frame = frameRef.current;
    const img = imgRef.current;
    if (!frame || !img?.naturalWidth) return;
    const boxW = frame.clientWidth;
    const boxH = frame.clientHeight;
    if (!boxW || !boxH) return;
    const nextDrawn = coverDrawnLayout(boxW, boxH, img.naturalWidth, img.naturalHeight, ox, oy);
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
    const axis = coverOverflowAxis(img.naturalWidth, img.naturalHeight, boxW, boxH, fallbackAxis);
    const next = coverHoverPanVars(axis, ox, oy, COVER_HOVER_SCALE, boxW, boxH);
    img.style.setProperty('--cover-ox', next.originX);
    img.style.setProperty('--cover-oy', next.originY);
    img.style.setProperty('--cover-pan-x', next.panX);
    img.style.setProperty('--cover-pan-y', next.panY);
  }, [fallbackAxis, ox, oy]);

  useLayoutEffect(() => {
    applyLayout();
    const frame = frameRef.current;
    if (!frame) return;
    const observer = new ResizeObserver(applyLayout);
    observer.observe(frame);
    return () => observer.disconnect();
  }, [applyLayout, src]);

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
      className={`cover-hover-frame${fill ? ' cover-hover-frame--fill' : ''}${className ? ` ${className}` : ''}`}
      style={fill ? undefined : { aspectRatio }}
    >
      <img ref={imgRef} src={src} alt={alt} onLoad={applyLayout} style={imgStyle} />
    </span>
  );
}
