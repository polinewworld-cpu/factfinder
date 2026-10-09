import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { prisma } from '@/lib/prisma';
import { ROLES } from '@/lib/roles';
import { getCurrentUser } from '@/lib/session';
import { GHOST_WHERE } from '@/lib/ghostWriter';
import { encryptBytes, piiReady } from '@/lib/pii';
import { putBlob } from '@/lib/blobStorage';

// 유령기자 주민등록증 사진 올리기 (2026-10-09) — 편집장 전용. 암호화(AES-256-GCM)해서 pii-<uuid>.enc로 저장.
const TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf'];
const MAX = 10 * 1024 * 1024;

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (user?.role !== ROLES.CHIEF_EDITOR) return NextResponse.json({ error: '편집장만 올릴 수 있습니다' }, { status: 403 });
  if (!piiReady()) return NextResponse.json({ error: '암호화 열쇠(PII_ENCRYPTION_KEY)를 Render에 먼저 넣어야 합니다' }, { status: 503 });
  const writer = await prisma.user.findFirst({ where: { id: params.id, ...GHOST_WHERE }, select: { id: true } });
  if (!writer) return NextResponse.json({ error: '유령기자를 찾을 수 없습니다' }, { status: 404 });

  const form = await req.formData();
  const file = form.get('file');
  if (!(file instanceof File)) return NextResponse.json({ error: '파일이 없습니다' }, { status: 400 });
  if (!TYPES.includes(file.type)) return NextResponse.json({ error: '사진(jpg·png·webp·heic) 또는 PDF만 올릴 수 있습니다' }, { status: 400 });
  if (file.size > MAX) return NextResponse.json({ error: '10MB가 넘는 파일입니다' }, { status: 400 });

  const blobName = `pii-${randomUUID()}.enc`;
  await putBlob(blobName, encryptBytes(Buffer.from(await file.arrayBuffer())), 'application/octet-stream');
  const img = await prisma.writerIdImage.create({ data: { userId: writer.id, blobName, mime: file.type }, select: { id: true, createdAt: true } });
  return NextResponse.json(img, { status: 201 });
}
