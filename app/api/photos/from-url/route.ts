import { NextRequest, NextResponse } from 'next/server';
import { WRITER_ROLES } from '@/lib/roles';
import { getCurrentUser } from '@/lib/session';
import { storeRemoteImage } from '@/lib/remoteImage';

// 사진 뱅크 "이미지 URL로 등록"·외부 검색 가져오기 (2026-10-09) — 서버가 그 이미지를 받아 우리 저장소에 올리고 /api/blob 주소를 돌려준다.
// 안전 검사(내부망 차단·이미지 형식·10MB)는 lib/remoteImage.ts
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !(WRITER_ROLES as readonly string[]).includes(user.role)) {
    return NextResponse.json({ error: '기자 이상만 사진을 등록할 수 있습니다' }, { status: 403 });
  }
  const { url } = await req.json().catch(() => ({}));
  try {
    return NextResponse.json(await storeRemoteImage(String(url ?? '')), { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : '가져오지 못했습니다' }, { status: 400 });
  }
}
