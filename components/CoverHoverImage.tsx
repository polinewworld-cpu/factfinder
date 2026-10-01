'use client';

import { useCallback, useLayoutEffect, useRef, type CSSProperties } from 'react';
import {
  clampFocal,
  coverHoverPanVars,
  coverOverflowAmount,
  coverOverflowAxis,
} from '@/lib/cardImage';

type CoverHoverStyle = CSSProperties & {
  '--cover-ox': string;
  '--cover-oy': string;
  '--cover-pan-x': string;
  '--cover-pan-y': string;
  '--cover-pan-ox': string;
  '--cover-pan-oy': string;
};

export default function CoverHoverImage({
  src,
  alt = '',
  aspectRatio,
  focalX,
  focalY,
  className,
  style,
  fallbackAxis = 'x',
}: {
  src: string;
  alt?: string;
  aspectRatio?: string;
  focalX?: number | null;
  focalY?: number | null;
  className?: string;
  style?: CSSProperties;
  fallbackAxis?: 'x' | 'y';
}) {
  const imgRef = useRef<HTMLImageElement>(null);
  const ox = clampFocal(focalX);
  const oy = clampFocal(focalY);
  const pan = coverHoverPanVars(fallbackAxis, ox, oy);

  const applyAxis = useCallback(() => {
    const img = imgRef.current;
    if (!img?.naturalWidth || !img.clientWidth) return;
    const axis = coverOverflowAxis(
      img.naturalWidth,
      img.naturalHeight,
      img.clientWidth,
      img.clientHeight,
      fallbackAxis,
    );
    const overflowPx = coverOverflowAmount(
      img.naturalWidth,
      img.naturalHeight,
      img.clientWidth,
      img.clientHeight,
      axis,
    );
    const next = coverHoverPanVars(axis, ox, oy, undefined, overflowPx);
    img.style.setProperty('--cover-pan-x', next.panX);
    img.style.setProperty('--cover-pan-y', next.panY);
    img.style.setProperty('--cover-pan-ox', next.panOx);
    img.style.setProperty('--cover-pan-oy', next.panOy);
  }, [fallbackAxis, ox, oy]);

  useLayoutEffect(() => {
    applyAxis();
    const img = imgRef.current;
    if (!img) return;
    const observer = new ResizeObserver(applyAxis);
    observer.observe(img);
    return () => observer.disconnect();
  }, [applyAxis, src]);

  const hoverStyle: CoverHoverStyle = {
    ...style,
    ...(aspectRatio ? { aspectRatio } : null),
    '--cover-ox': pan.originX,
    '--cover-oy': pan.originY,
    '--cover-pan-x': pan.panX,
    '--cover-pan-y': pan.panY,
    '--cover-pan-ox': pan.panOx,
    '--cover-pan-oy': pan.panOy,
  };

  return (
    <img ref={imgRef} src={src} alt={alt} className={className} onLoad={applyAxis} style={hoverStyle} />
  );
}
