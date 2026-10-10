import { NextRequest, NextResponse } from 'next/server';
import { getBlob, putBlob } from '@/lib/blobStorage';
import { resizeToWidth } from '@/lib/imageResize';
import { CARD_WIDTHS } from '@/lib/cardImage';

// 업로드된 이미지를 서빙하는 라우트 — 커버이미지/카드뉴스/사진 뱅크 등에서 /api/blob/파일명 형태로 참조됨.
// 2026-10-09: Supabase에서 파일을 통째로 받아 메모리에 담은 뒤 보내던 방식 → 받는 대로 흘려보내기(스트리밍)로 변경.
// 홈 화면처럼 큰 사진(1~2MB)이 한꺼번에 몰리면 Render 무료 서버(메모리 512MB)에서 일부 사진이 깨지던 문제 대응.
// 저장소 버킷은 비공개라 서버가 서비스 키로 받아 전달한다(주소는 그대로).
//
// 2026-10-09: ?w=800|1600 — 카드용 축소본(webp). 홈 사진 60장이 원본 그대로 13MB(한 장 최대 7.8MB)였던 문제.
// 처음 요청 때 한 번 만들어 저장소에 "w800-원본이름.webp"로 저장하고, 이후엔 그 파일을 그대로 보낸다.
const CACHE = 'public, max-age=31536000, immutable';
const RESIZABLE = /\.(jpe?g|png|webp|avif|gif)$/i;
const making = new Map<string, Promise<{ buf: Buffer; type: string } | null>>();

async function streamFromSupabase(name: string): Promise<Response | 'missing' | null> {
  const base = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) return null;
  // 응답 헤더가 올 때까지만 시간 제한 — 본문 전송은 느린 방문자에 맞춰 흘려보냄
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15_000);
  const res = await fetch(`${base}/storage/v1/object/authenticated/uploads/${encodeURIComponent(name)}`, {
    headers: { Authorization: `Bearer ${key}`, apikey: key },
    cache: 'no-store',
    signal: ctrl.signal,
  }).catch(() => null);
  clearTimeout(timer);
  if (res?.ok && res.body) {
    const headers: Record<string, string> = {
      'Content-Type': res.headers.get('content-type') || 'application/octet-stream',
      'Cache-Control': CACHE,
    };
    const len = res.headers.get('content-length');
    if (len) headers['Content-Length'] = len;
    return new Response(res.body, { headers });
  }
  if (res && (res.status === 400 || res.status === 404)) return 'missing';
  return null; // 그 밖의 실패는 기존 방식으로 한 번 더
}

async function serveOriginal(name: string) {
  const streamed = await streamFromSupabase(name);
  if (streamed instanceof Response) return streamed;
  if (streamed === 'missing') return NextResponse.json({ error: '파일을 찾을 수 없습니다' }, { status: 404 });
  const result = await getBlob(name);
  if (!result) return NextResponse.json({ error: '파일을 찾을 수 없습니다' }, { status: 404 });
  return new NextResponse(result.data, { headers: { 'Content-Type': result.contentType, 'Cache-Control': CACHE } });
}

// 축소본 만들기 — 같은 사진을 동시에 여러 번 요청해도 한 번만 만든다
function makeVariant(name: string, variant: string, width: number, jpeg = false) {
  let job = making.get(variant);
  if (!job) {
    job = (async () => {
      const original = await getBlob(name);
      if (!original) return null;
      const src = Buffer.from(original.data);
      const out = await resizeToWidth(src, width, !jpeg && /\.gif$/i.test(name), jpeg ? 'jpeg' : 'webp');
      // 줄인 게 더 크면(이미 작은 사진) 원본을 그대로 축소본 자리에 저장 — 다음부턴 바로 전달
      const pick = out.buf.length < src.length ? out : { buf: src, type: original.contentType };
      await putBlob(variant, pick.buf, pick.type).catch(() => {});
      return pick;
    })().finally(() => making.delete(variant));
    making.set(variant, job);
  }
  return job;
}

export async function GET(req: NextRequest, { params }: { params: { filename: string } }) {
  const name = params.filename;
  if (!name || name.includes('/') || name.includes('..')) {
    return NextResponse.json({ error: '잘못된 파일 이름입니다' }, { status: 400 });
  }

  const width = Number(req.nextUrl.searchParams.get('w'));
  if (!(CARD_WIDTHS as readonly number[]).includes(width) || !RESIZABLE.test(name)) return serveOriginal(name);

  // &f=jpg — 메일용(일부 메일 프로그램이 webp를 못 보여 줌, 2026-10-10 뉴스레터)
  const jpeg = req.nextUrl.searchParams.get('f') === 'jpg';
  const variant = jpeg ? `w${width}j-${name.replace(/\.[^.]+$/, '')}.jpg` : `w${width}-${name.replace(/\.[^.]+$/, '')}.webp`;
  const ready = await streamFromSupabase(variant);
  if (ready instanceof Response) return ready;
  try {
    const made = await makeVariant(name, variant, width, jpeg);
    if (!made) return NextResponse.json({ error: '파일을 찾을 수 없습니다' }, { status: 404 });
    return new NextResponse(made.buf, { headers: { 'Content-Type': made.type, 'Cache-Control': CACHE } });
  } catch {
    return serveOriginal(name); // 축소 실패하면 원본
  }
}
