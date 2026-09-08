import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/session';
import { getStore } from '@netlify/blobs';
import { randomUUID } from 'crypto';

// 커버이미지 등 파일 업로드 — Netlify Blobs에 저장 (Netlify 서버리스 환경은 로컬 디스크에 영구 저장 불가).
// 업로드된 파일은 /api/blob/[filename] 라우트로 서빙됨.
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_SIZE = 10 * 1024 * 1024; // 10MB

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });
  // 로그인한 회원이면 누구나 업로드 가능 (프로필사진 등 커버이미지 외 용도도 공용) — 무엇에 쓸지는 호출부 책임

  const form = await req.formData();
  const file = form.get('file');
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: '파일이 없습니다' }, { status: 400 });
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: '이미지 파일만 업로드 가능합니다 (jpg/png/webp/gif)' }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: '파일 크기는 10MB를 넘을 수 없습니다' }, { status: 400 });
  }

  const ext = file.name.includes('.') ? file.name.split('.').pop() : 'jpg';
  const filename = `${randomUUID()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const store = getStore('uploads');
  await store.set(filename, buffer, { metadata: { contentType: file.type } });

  return NextResponse.json({ url: `/api/blob/${filename}` }, { status: 201 });
}
