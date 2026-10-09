import { NextRequest, NextResponse } from 'next/server';
import { getBlob } from '@/lib/blobStorage';

// 업로드된 이미지를 서빙하는 라우트 — 커버이미지/카드뉴스/사진 뱅크 등에서 /api/blob/파일명 형태로 참조됨.
// 2026-10-09: Supabase에서 파일을 통째로 받아 메모리에 담은 뒤 보내던 방식 → 받는 대로 흘려보내기(스트리밍)로 변경.
// 홈 화면처럼 큰 사진(1~2MB)이 한꺼번에 몰리면 Render 무료 서버(메모리 512MB)에서 일부 사진이 깨지던 문제 대응.
// 저장소 버킷은 비공개라 서버가 서비스 키로 받아 전달한다(주소는 그대로).
const CACHE = 'public, max-age=31536000, immutable';

export async function GET(_req: NextRequest, { params }: { params: { filename: string } }) {
  const name = params.filename;
  // pii-… = 암호화된 신분증 사진 — 여기로는 절대 내보내지 않음(편집장 전용 /api/ghost-writers/…/id-images)
  if (!name || name.includes('/') || name.includes('..') || name.startsWith('pii-')) {
    return NextResponse.json({ error: '잘못된 파일 이름입니다' }, { status: 400 });
  }

  const base = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (base && key) {
    const res = await fetch(`${base}/storage/v1/object/authenticated/uploads/${encodeURIComponent(name)}`, {
      headers: { Authorization: `Bearer ${key}`, apikey: key },
      cache: 'no-store',
    }).catch(() => null);
    if (res?.ok && res.body) {
      const headers: Record<string, string> = {
        'Content-Type': res.headers.get('content-type') || 'application/octet-stream',
        'Cache-Control': CACHE,
      };
      const len = res.headers.get('content-length');
      if (len) headers['Content-Length'] = len;
      return new Response(res.body, { headers });
    }
    if (res && (res.status === 400 || res.status === 404)) {
      return NextResponse.json({ error: '파일을 찾을 수 없습니다' }, { status: 404 });
    }
    // 그 밖의 실패는 아래 기존 방식으로 한 번 더
  }

  const result = await getBlob(name);
  if (!result) {
    return NextResponse.json({ error: '파일을 찾을 수 없습니다' }, { status: 404 });
  }
  return new NextResponse(result.data, {
    headers: {
      'Content-Type': result.contentType,
      'Cache-Control': CACHE,
    },
  });
}
