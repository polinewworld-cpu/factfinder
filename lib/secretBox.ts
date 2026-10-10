import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from 'crypto';

// DB에 넣는 비밀값 암호화 (2026-10-10, 지메일 발송 권한 토큰 등) — 열쇠 = Render 환경변수 NEXTAUTH_SECRET에서 유도.
// NEXTAUTH_SECRET을 바꾸면 저장된 값을 못 읽음 → 편집실에서 [지메일 연결]만 다시 하면 됨.
const key = () => createHash('sha256').update(`factfinder-secretbox:${process.env.NEXTAUTH_SECRET ?? ''}`).digest();

export function seal(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', key(), iv);
  const body = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return [iv, c.getAuthTag(), body].map((b) => b.toString('base64url')).join('.');
}

export function unseal(sealed: string | null | undefined): string | null {
  if (!sealed) return null;
  try {
    const [iv, tag, body] = sealed.split('.').map((s) => Buffer.from(s, 'base64url'));
    const d = createDecipheriv('aes-256-gcm', key(), iv);
    d.setAuthTag(tag);
    return Buffer.concat([d.update(body), d.final()]).toString('utf8');
  } catch {
    return null;
  }
}

// 링크 서명(뉴스레터 수신거부 등) — 위조 방지용 짧은 서명
export function sign(value: string): string {
  return createHmac('sha256', key()).update(value).digest('base64url').slice(0, 32);
}
