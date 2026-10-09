import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ROLES } from '@/lib/roles';
import { getCurrentUser } from '@/lib/session';
import { decryptBytes } from '@/lib/pii';
import { deleteBlob, getBlob } from '@/lib/blobStorage';

// 유령기자 주민등록증 사진 열람·삭제 (2026-10-09) — 편집장 전용. 열람 때만 복호화해서 보내고, 브라우저·중간 캐시에 남지 않게 no-store.
async function find(params: { id: string; imageId: string }) {
  const user = await getCurrentUser();
  if (user?.role !== ROLES.CHIEF_EDITOR) return { error: NextResponse.json({ error: '편집장만 볼 수 있습니다' }, { status: 403 }) };
  const img = await prisma.writerIdImage.findFirst({ where: { id: params.imageId, userId: params.id } });
  if (!img) return { error: NextResponse.json({ error: '파일을 찾을 수 없습니다' }, { status: 404 }) };
  return { img };
}

export async function GET(_req: NextRequest, { params }: { params: { id: string; imageId: string } }) {
  const { img, error } = await find(params);
  if (error) return error;
  const blob = await getBlob(img!.blobName);
  if (!blob) return NextResponse.json({ error: '파일을 찾을 수 없습니다' }, { status: 404 });
  try {
    const plain = decryptBytes(Buffer.from(blob.data));
    return new NextResponse(plain, {
      headers: { 'Content-Type': img!.mime, 'Cache-Control': 'no-store, private', 'X-Robots-Tag': 'noindex' },
    });
  } catch {
    return NextResponse.json({ error: '복호화 실패 — 암호화 열쇠가 바뀌었을 수 있습니다' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string; imageId: string } }) {
  const { img, error } = await find(params);
  if (error) return error;
  await deleteBlob(img!.blobName).catch(() => {});
  await prisma.writerIdImage.delete({ where: { id: img!.id } });
  return NextResponse.json({ ok: true });
}
