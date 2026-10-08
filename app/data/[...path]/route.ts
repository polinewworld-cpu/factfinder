import { NextResponse } from 'next/server';
import { legacyImageFilename } from '@/lib/legacyImage';
import { SITE_URL } from '@/lib/siteTags';

// 옛 사이트 사진 주소 연결 (2026-10-08) — 도메인 전환 후 www.factfinder.tv/data/… 로 들어오는 사진 요청
// (다른 사이트에 퍼간 링크, 구글 이미지 검색 등)을 우리 저장소로 옮긴 같은 사진으로 영구 이동
export function GET(_req: Request, { params }: { params: { path: string[] } }) {
  const filename = legacyImageFilename(`/data/${params.path.join('/')}`);
  return NextResponse.redirect(new URL(`/api/blob/${filename}`, SITE_URL), 301);
}
