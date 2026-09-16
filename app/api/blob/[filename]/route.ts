import { NextRequest, NextResponse } from 'next/server';
import { getBlob } from '@/lib/blobStorage';

// 업로드된 이미지를 서빙하는 라우트 (Netlify 배포 환경에선 Netlify Blobs, 로컬 개발 환경에선 프로젝트 폴더).
// 커버이미지/카드뉴스 등에서 /api/blob/파일명 형태의 URL로 참조됨.
export async function GET(_req: NextRequest, { params }: { params: { filename: string } }) {
  const result = await getBlob(params.filename);

  if (!result) {
    return NextResponse.json({ error: '파일을 찾을 수 없습니다' }, { status: 404 });
  }

  return new NextResponse(result.data, {
    headers: {
      'Content-Type': result.contentType,
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
