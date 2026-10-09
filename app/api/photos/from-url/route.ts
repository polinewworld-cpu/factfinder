import { NextRequest, NextResponse } from 'next/server';
import { lookup } from 'dns/promises';
import { isIP } from 'net';
import { randomUUID } from 'crypto';
import { WRITER_ROLES } from '@/lib/roles';
import { getCurrentUser } from '@/lib/session';
import { putBlob } from '@/lib/blobStorage';

// 사진 뱅크 "이미지 URL로 등록" (2026-10-09) — 서버가 그 이미지를 받아 우리 저장소에 올리고 /api/blob 주소를 돌려준다.
// 내부망 주소로 요청을 보내는 악용을 막으려고 공인 IP로 풀리는 http(s) 주소만, 리다이렉트도 매번 같은 검사.
const TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'image/avif': 'avif' };
const MAX = 10 * 1024 * 1024;

function privateIp(ip: string) {
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

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !(WRITER_ROLES as readonly string[]).includes(user.role)) {
    return NextResponse.json({ error: '기자 이상만 사진을 등록할 수 있습니다' }, { status: 403 });
  }
  const { url } = await req.json().catch(() => ({}));

  let target = await safeUrl(String(url ?? ''));
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
  if (!target) return NextResponse.json({ error: '가져올 수 없는 주소입니다 (http/https 공개 주소만)' }, { status: 400 });
  if (!res || !res.ok) return NextResponse.json({ error: `이미지를 받지 못했습니다${res ? ` (HTTP ${res.status})` : ''}` }, { status: 400 });

  const type = (res.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
  const ext = TYPES[type];
  if (!ext) return NextResponse.json({ error: '이미지 주소가 아닙니다 (jpg·png·webp·gif·avif 직접 주소를 넣어 주세요)' }, { status: 400 });
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > MAX) return NextResponse.json({ error: '10MB가 넘는 이미지입니다' }, { status: 400 });

  const filename = `${randomUUID()}.${ext}`;
  await putBlob(filename, buf, type);
  return NextResponse.json({ url: `/api/blob/${filename}`, filename: decodeURIComponent(target.pathname.split('/').pop() || filename) }, { status: 201 });
}
