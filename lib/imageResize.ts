// 서버 이미지 처리(sharp) 공용 — Render 무료 서버(메모리 512MB)를 지키려고 한 번에 한 장씩만, 캐시 없이 (2026-10-09)
type Sharp = typeof import('sharp');
let sharpLib: Promise<Sharp> | null = null;
function loadSharp(): Promise<Sharp> {
  if (!sharpLib) {
    sharpLib = import('sharp').then((m) => {
      const sharp = m.default;
      sharp.cache(false);
      sharp.concurrency(1);
      return sharp;
    });
  }
  return sharpLib;
}

let queue: Promise<unknown> = Promise.resolve();
function oneAtATime<T>(job: () => Promise<T>): Promise<T> {
  const run = queue.then(job, job);
  queue = run.catch(() => {});
  return run;
}

export type ImageOut = { buf: Buffer; type: string; ext: string };

// 큰 사진은 긴 변 maxDim 이내로 줄여 저장 — 원본이 400KB 미만이거나 GIF(움직임)면 그대로
export function shrinkImage(buf: Buffer, type: string, maxDim = 2000): Promise<ImageOut | null> {
  if (type === 'image/gif' || buf.length < 400 * 1024) return Promise.resolve(null);
  return oneAtATime(async () => {
    const sharp = await loadSharp();
    const meta = await sharp(buf).metadata();
    const pipe = sharp(buf, { failOn: 'none' }).rotate().resize({ width: maxDim, height: maxDim, fit: 'inside', withoutEnlargement: true });
    const out =
      type === 'image/png' && meta.hasAlpha
        ? { buf: await pipe.png({ compressionLevel: 9 }).toBuffer(), type: 'image/png', ext: 'png' }
        : { buf: await pipe.jpeg({ quality: 85, mozjpeg: true }).toBuffer(), type: 'image/jpeg', ext: 'jpg' };
    return out.buf.length < buf.length ? out : null;
  });
}

// 카드 썸네일용 축소본 (가로 width px, webp) — GIF는 움직임을 살린 webp로
export function resizeToWidth(buf: Buffer, width: number, animated = false, format: 'webp' | 'jpeg' = 'webp'): Promise<ImageOut> {
  return oneAtATime(async () => {
    const sharp = await loadSharp();
    const pipe = sharp(buf, { failOn: 'none', animated }).rotate().resize({ width, withoutEnlargement: true });
    if (format === 'jpeg') {
      // 메일용 — 투명 배경은 흰색으로
      return { buf: await pipe.flatten({ background: '#ffffff' }).jpeg({ quality: 82, mozjpeg: true }).toBuffer(), type: 'image/jpeg', ext: 'jpg' };
    }
    return { buf: await pipe.webp({ quality: 78 }).toBuffer(), type: 'image/webp', ext: 'webp' };
  });
}
