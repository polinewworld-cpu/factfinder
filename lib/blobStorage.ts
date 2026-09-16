import { getStore } from '@netlify/blobs';
import { promises as fs } from 'fs';
import path from 'path';

// Netlify Blobs는 실제 Netlify 배포 환경(또는 `netlify dev`)에서만 별도 설정 없이 동작함.
// 로컬에서 그냥 `npm run dev`로 띄우면 Netlify Blobs 연결 정보가 없어서 업로드/조회 시 에러가 남
// (커버이미지 업로드, 카드뉴스 zip 다운로드, 프로필사진, 배너 이미지 등 /api/upload를 쓰는 모든 기능이 영향받음).
// 그래서 로컬 개발 환경(process.env.NETLIFY 없음)에서는 프로젝트 폴더 안에 파일로 저장하고,
// 실제 Netlify 배포 환경에서만 Netlify Blobs를 쓰도록 분리함.
const isNetlify = !!process.env.NETLIFY;
const LOCAL_DIR = path.join(process.cwd(), '.local-uploads');

async function ensureLocalDir() {
  await fs.mkdir(LOCAL_DIR, { recursive: true });
}

function metaPath(filename: string) {
  return path.join(LOCAL_DIR, `${filename}.meta.json`);
}

export async function putBlob(filename: string, buffer: Buffer, contentType: string): Promise<void> {
  if (isNetlify) {
    const store = getStore('uploads');
    await store.set(filename, buffer, { metadata: { contentType } });
    return;
  }
  await ensureLocalDir();
  await fs.writeFile(path.join(LOCAL_DIR, filename), buffer);
  await fs.writeFile(metaPath(filename), JSON.stringify({ contentType }));
}

export async function getBlob(filename: string): Promise<{ data: ArrayBuffer; contentType: string } | null> {
  if (isNetlify) {
    const store = getStore('uploads');
    const result = await store.getWithMetadata(filename, { type: 'arrayBuffer' });
    if (!result) return null;
    const contentType =
      (result.metadata as { contentType?: string } | undefined)?.contentType ?? 'application/octet-stream';
    return { data: result.data, contentType };
  }
  try {
    const buf = await fs.readFile(path.join(LOCAL_DIR, filename));
    let contentType = 'application/octet-stream';
    try {
      const meta = JSON.parse(await fs.readFile(metaPath(filename), 'utf-8'));
      contentType = meta.contentType ?? contentType;
    } catch {
      /* 메타 파일이 없으면 기본 content-type 사용 */
    }
    const arrayBuffer = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
    return { data: arrayBuffer, contentType };
  } catch {
    return null;
  }
}
