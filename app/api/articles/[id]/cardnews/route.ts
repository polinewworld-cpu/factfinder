import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getStore } from '@netlify/blobs';
import JSZip from 'jszip';

// 카드뉴스 이미지 전체를 zip으로 묶어 다운로드 (독자용)
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const article = await prisma.article.findUnique({
    where: { id: params.id },
    include: { images: { orderBy: { order: 'asc' } } },
  });
  if (!article || article.status !== 'PUBLISHED' || article.images.length === 0) {
    return NextResponse.json({ error: '다운로드할 카드뉴스 이미지가 없습니다' }, { status: 404 });
  }

  const store = getStore('uploads');
  const zip = new JSZip();
  for (let i = 0; i < article.images.length; i++) {
    const img = article.images[i];
    if (!img.url.startsWith('/api/blob/')) continue; // 외부 URL(스톡이미지 등)은 zip에서 제외
    try {
      const filename = img.url.replace('/api/blob/', '');
      const buffer = await store.get(filename, { type: 'arrayBuffer' });
      if (!buffer) continue;
      const ext = filename.includes('.') ? `.${filename.split('.').pop()}` : '.jpg';
      zip.file(`card-${String(i + 1).padStart(2, '0')}${ext}`, buffer);
    } catch {
      // 파일을 찾을 수 없으면 건너뜀
    }
  }

  const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
  return new NextResponse(zipBuffer, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="cardnews-${article.id}.zip"`,
    },
  });
}
