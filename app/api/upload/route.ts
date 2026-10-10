import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/session';
import { putBlob } from '@/lib/blobStorage';
import { shrinkImage } from '@/lib/imageResize';
import { randomUUID } from 'crypto';

// 커버이미지 등 파일 업로드 — 운영은 Supabase 저장소, 로컬 개발 환경에선 프로젝트 폴더에 저장 (lib/blobStorage 참고).
// 업로드된 파일은 /api/blob/[filename] 라우트로 서빙됨.
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'];
const MAX_SIZE = 5 * 1024 * 1024; // 5MB (2026-10-10: 10MB → 5MB, 카카오톡 공유 이미지 한도에 맞춤)
const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'image/avif': 'avif' };

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
    return NextResponse.json({ error: '이미지 파일만 업로드 가능합니다 (jpg/png/webp/gif/avif)' }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    // 브라우저 쪽(lib/imageCompress.ts)에서 업로드 전에 5MB 이내로 자동 압축을 시도하므로
    // 정상적인 경우 이 분기는 거의 타지 않음 — 압축이 실패했거나 이미지가 아닌 경우의 최종 안전장치 (2026-09-11)
    return NextResponse.json({ error: '자동 압축 후에도 파일이 너무 큽니다. 더 작은 사진으로 다시 시도해주세요.' }, { status: 400 });
  }

  // 확장자는 실제 파일 형식으로 (파일 이름의 확장자는 아무 값이나 올 수 있음), 큰 사진은 긴 변 2000px로 줄여 저장 (2026-10-09)
  const original = Buffer.from(await file.arrayBuffer());
  const small = await shrinkImage(original, file.type).catch(() => null);
  const buffer = small?.buf ?? original;
  const type = small?.type ?? file.type;
  const filename = `${randomUUID()}.${EXT[type] ?? 'jpg'}`;

  await putBlob(filename, buffer, type);

  return NextResponse.json({ url: `/api/blob/${filename}` }, { status: 201 });
}
