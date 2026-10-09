import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

// 민감 파일 암호화 (2026-10-09) — 유령기자 주민등록증 사진. AES-256-GCM.
// 열쇠: Render 환경변수 PII_ENCRYPTION_KEY (32바이트를 base64로). 열쇠를 잃으면 올린 사진을 다시 열 수 없음 → 따로 보관.
// 저장 형식: [12바이트 IV][16바이트 인증 태그][암호문]

function key(): Buffer {
  const raw = process.env.PII_ENCRYPTION_KEY;
  if (!raw) throw new Error('암호화 열쇠(PII_ENCRYPTION_KEY)가 설정되지 않았습니다');
  const k = Buffer.from(raw, 'base64');
  if (k.length !== 32) throw new Error('암호화 열쇠 형식이 올바르지 않습니다 (32바이트 base64)');
  return k;
}

export const piiReady = () => {
  try {
    key();
    return true;
  } catch {
    return false;
  }
};

export function encryptBytes(plain: Buffer): Buffer {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', key(), iv);
  const body = Buffer.concat([c.update(plain), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), body]);
}

export function decryptBytes(blob: Buffer): Buffer {
  const iv = blob.subarray(0, 12);
  const tag = blob.subarray(12, 28);
  const d = createDecipheriv('aes-256-gcm', key(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(blob.subarray(28)), d.final()]);
}
