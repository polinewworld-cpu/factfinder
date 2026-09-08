import { NextRequest, NextResponse } from 'next/server';
import { getStore } from '@netlify/blobs';

// 업로드된 이미지(Netlify Blobs)를 서빙하는 라우트.
// 커버이미지/카드뉴스 등에서 /api/blob/파일명 형태의 URL로 참조됨.
export async function GET(_req: NextRequest, { params }: { params: { filename: string } }) {
  const store = getStore('uploads');
  const result = await store.getWithMetadata(params.filename, { type: 'arrayBuffer' });

  if (!result) {
    return NextResponse.json({ error: '파일을 찾을 수 없습니다' }, { status: 404 });
  }

  const contentType = (result.metadata as { contentType?: string } | undefined)?.contentType ?? 'application/octet-stream';

  return new NextResponse(result.data, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
