'use client';

import { useEffect, useRef } from 'react';

// 관리자 대시보드 카드 — 핫핑크 면 위에 연한 핑크 점 격자를 깔고, 마우스가 지나가면 근처 점들이 물결처럼 커짐 (2026-09-24)
export default function RippleDotCard({
  href,
  className = '',
  children,
}: {
  href?: string;
  className?: string;
  children: React.ReactNode;
}) {
  const wrapRef = useRef<HTMLElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const spacing = 30;
    const baseRadius = 1.5;
    const maxDist = 120;
    const mouse = { x: -1000, y: -1000 };
    let dots: { x: number; y: number; r: number }[] = [];
    let width = 0;
    let height = 0;

    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      width = rect.width;
      height = rect.height;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      dots = [];
      const cols = Math.floor(width / spacing) + 2;
      const rows = Math.floor(height / spacing) + 2;
      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) dots.push({ x: i * spacing, y: j * spacing, r: baseRadius });
      }
    };

    const onMove = (e: MouseEvent) => {
      const rect = wrap.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
    };
    const onLeave = () => {
      mouse.x = -1000;
      mouse.y = -1000;
    };

    let raf = 0;
    const render = () => {
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.28)';
      for (const dot of dots) {
        const dist = Math.hypot(mouse.x - dot.x, mouse.y - dot.y);
        const target = dist < maxDist ? baseRadius + (1 - dist / maxDist) * 4 : baseRadius;
        dot.r += (target - dot.r) * 0.15;
        ctx.beginPath();
        ctx.arc(dot.x, dot.y, dot.r, 0, Math.PI * 2);
        ctx.fill();
      }
      raf = requestAnimationFrame(render);
    };

    resize();
    render();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    wrap.addEventListener('mousemove', onMove);
    wrap.addEventListener('mouseleave', onLeave);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      wrap.removeEventListener('mousemove', onMove);
      wrap.removeEventListener('mouseleave', onLeave);
    };
  }, []);

  const cls = `relative block overflow-hidden rounded-xl bg-brand text-white ${className}`;
  const inner = (
    <>
      <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true" />
      <div className="relative flex h-full flex-col p-4">{children}</div>
    </>
  );

  return href ? (
    <a ref={(el) => { wrapRef.current = el; }} href={href} className={cls}>
      {inner}
    </a>
  ) : (
    <div ref={(el) => { wrapRef.current = el; }} className={cls}>
      {inner}
    </div>
  );
}
