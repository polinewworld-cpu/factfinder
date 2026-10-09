import { lookup } from 'dns/promises';
import { isIP } from 'net';
import { createHash, randomUUID } from 'crypto';
import { putBlob } from '@/lib/blobStorage';

// 외부 이미지 받아오기 (2026-10-09, 사진 뱅크) — URL 등록·외부 검색 가져오기·수신함 승인·수집기 중복 확인이 같이 쓴다.
// 내부망 주소로 요청을 보내는 악용을 막으려고 공인 IP로 풀리는 http(s) 주소만, 리다이렉트도 매번 같은 검사.
const TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'image/avif': 'avif' };
const MAX = 10 * 1024 * 1024;

function privateIp(ip: string): boolean {
  if (isIP(ip) === 6) {
    const v = ip.toLowerCase();
    if (v.startsWith('::ffff:')) return privateIp(v.slice(7));
    return v === '::1' || v === '::' || v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe80');
  }
  const [a, b] = ip.split('.').map(Number);
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
}

async function safeUrl(raw: string) {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
  const addrs = isIP(u.hostname) ? [{ address: u.hostname }] : await lookup(u.hostname, { all: true }).catch(() => []);
  if (!addrs.length || addrs.some((a) => privateIp(a.address))) return null;
  return u;
}

export type RemoteImage = { buf: Buffer; type: string; ext: string; filename: string; hash: string };

export async function fetchRemoteImage(url: string): Promise<RemoteImage> {
  let target = await safeUrl(url);
  let res: Response | null = null;
  for (let hop = 0; target && hop < 4; hop++) {
    res = await fetch(target, {
      redirect: 'manual',
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; FactFinderPhotoBank/1.0)', Accept: 'image/*' },
      signal: AbortSignal.timeout(20_000),
    }).catch(() => null);
    if (!res || res.status < 300 || res.status >= 400) break;
    const next = res.headers.get('location');
    target = next ? await safeUrl(new URL(next, target).toString()) : null;
    res = null;
  }
  if (!target) throw new Error('가져올 수 없는 주소입니다 (http/https 공개 주소만)');
  if (!res || !res.ok) throw new Error(`이미지를 받지 못했습니다${res ? ` (HTTP ${res.status})` : ''}`);
  const type = (res.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
  const ext = TYPES[type];
  if (!ext) throw new Error('이미지 주소가 아닙니다 (jpg·png·webp·gif·avif 직접 주소를 넣어 주세요)');
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > MAX) throw new Error('10MB가 넘는 이미지입니다');
  return { buf, type, ext, filename: decodeURIComponent(target.pathname.split('/').pop() || `image.${ext}`), hash: createHash('sha1').update(buf).digest('hex') };
}

// 저장 용량 절약 — 가로세로 최대 2000px로 줄이고 JPEG(투명 PNG는 PNG) 85% 품질로 (정당 원본은 장당 5MB까지 있음, 2026-10-09)
// 움직이는 GIF와 이미 작은 사진은 그대로. 해시는 원본 기준(중복 판정 일관성)
async function shrink(img: RemoteImage): Promise<{ buf: Buffer; type: string; ext: string }> {
  if (img.type === 'image/gif' || img.buf.length < 400 * 1024) return img;
  try {
    const sharp = (await import('sharp')).default;
    const pipe = sharp(img.buf, { failOn: 'none' }).rotate().resize({ width: 2000, height: 2000, fit: 'inside', withoutEnlargement: true });
    const meta = await sharp(img.buf).metadata();
    if (img.type === 'image/png' && meta.hasAlpha) {
      const buf = await pipe.png({ compressionLevel: 9 }).toBuffer();
      return buf.length < img.buf.length ? { buf, type: 'image/png', ext: 'png' } : img;
    }
    const buf = await pipe.jpeg({ quality: 85, mozjpeg: true }).toBuffer();
    return buf.length < img.buf.length ? { buf, type: 'image/jpeg', ext: 'jpg' } : img;
  } catch {
    return img; // 줄이기 실패하면 원본 그대로
  }
}

// 받아서 (줄인 뒤) 우리 저장소(/api/blob)에 올림
export async function storeRemoteImage(url: string) {
  const img = await fetchRemoteImage(url);
  const small = await shrink(img);
  const name = `${randomUUID()}.${small.ext}`;
  await putBlob(name, small.buf, small.type);
  return { url: `/api/blob/${name}`, filename: img.filename, hash: img.hash };
}
