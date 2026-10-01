'use client';

import { useCallback, useLayoutEffect, useRef, type CSSProperties } from 'react';
import { clampFocal, coverHoverPanVars, coverOverflowAxis } from '@/lib/cardImage';

type CoverHoverStyle = CSSProperties & {
  '--cover-ox': string;
  '--cover-oy': string;
  '--cover-pan-x': string;
  '--cover-pan-y': string;
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
    const next = coverHoverPanVars(axis, ox, oy);
    img.style.setProperty('--cover-pan-x', next.panX);
    img.style.setProperty('--cover-pan-y', next.panY);
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
  };

  return (
    <img ref={imgRef} src={src} alt={alt} className={className} onLoad={applyAxis} style={hoverStyle} />
  );
}
