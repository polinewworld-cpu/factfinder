import { prisma } from '@/lib/prisma';
import { seal, unseal } from '@/lib/secretBox';
import { SITE_URL } from '@/lib/siteTags';

// 뉴스레터 메일 발송 = 지메일 API (2026-10-10 사장님: "그냥 지메일로")
// Render 무료 서버는 메일 포트(SMTP 25·465·587)를 막아 두어 일반 지메일 발송은 안 됨 → 지메일 API(HTTPS)로 보냄.
// 편집실 뉴스레터 관리 → [지메일 연결]에서 보내는 계정으로 한 번 허용하면 갱신 토큰을 암호화해 SiteConfig에 저장.
// 로그인용 구글 앱(GOOGLE_CLIENT_ID/SECRET)을 그대로 쓰고, 구글 클라우드에서 Gmail API 사용 설정 + 아래 돌아오는 주소 등록이 필요.
// 보내는 한도: 일반 지메일 하루 약 500명.

export const GMAIL_SCOPE = 'https://www.googleapis.com/auth/gmail.send';
export const gmailRedirectUri = () => `${SITE_URL}/api/admin/gmail/callback`;

export function gmailAuthUrl(state: string) {
  const q = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID ?? '',
    redirect_uri: gmailRedirectUri(),
    response_type: 'code',
    scope: `openid email ${GMAIL_SCOPE}`,
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${q}`;
}

async function tokenRequest(params: Record<string, string>) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    body: new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID ?? '', client_secret: process.env.GOOGLE_CLIENT_SECRET ?? '', ...params }),
    signal: AbortSignal.timeout(20_000),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`구글 인증 실패: ${body.error_description || body.error || res.status}`);
  return body as { access_token: string; expires_in: number; refresh_token?: string; id_token?: string; scope?: string };
}

// [지메일 연결] 돌아온 코드 → 갱신 토큰 저장
export async function connectGmail(code: string) {
  const t = await tokenRequest({ code, grant_type: 'authorization_code', redirect_uri: gmailRedirectUri() });
  if (!t.refresh_token) throw new Error('구글이 발송 권한(갱신 토큰)을 주지 않았습니다. 다시 연결해 주세요');
  if (!t.scope?.includes(GMAIL_SCOPE)) throw new Error('메일 보내기 권한에 체크하지 않았습니다. 다시 연결하면서 "메일 보내기"를 허용해 주세요');
  // id_token은 구글 토큰 서버에서 HTTPS로 직접 받은 값이라 이메일만 꺼내 씀
  const payload = JSON.parse(Buffer.from((t.id_token ?? '').split('.')[1] ?? '', 'base64url').toString('utf8') || '{}');
  const sender = String(payload.email ?? '');
  if (!sender) throw new Error('보내는 계정의 이메일을 알 수 없습니다');
  await prisma.siteConfig.upsert({
    where: { id: 'singleton' },
    update: { gmailSender: sender, gmailToken: seal(t.refresh_token) },
    create: { id: 'singleton', gmailSender: sender, gmailToken: seal(t.refresh_token) },
  });
  cached = null;
  return sender;
}

export async function disconnectGmail() {
  await prisma.siteConfig.update({ where: { id: 'singleton' }, data: { gmailSender: null, gmailToken: null } }).catch(() => {});
  cached = null;
}

export async function gmailStatus() {
  const c = await prisma.siteConfig.findUnique({ where: { id: 'singleton' }, select: { gmailSender: true, gmailToken: true } });
  return { connected: !!(c?.gmailSender && unseal(c.gmailToken)), sender: c?.gmailSender ?? null };
}

let cached: { token: string; until: number; sender: string } | null = null;
async function access() {
  if (cached && Date.now() < cached.until) return cached;
  const c = await prisma.siteConfig.findUnique({ where: { id: 'singleton' }, select: { gmailSender: true, gmailToken: true } });
  const refresh = unseal(c?.gmailToken);
  if (!c?.gmailSender || !refresh) throw new Error('지메일이 연결되지 않았습니다 (뉴스레터 관리 → 지메일 연결)');
  const t = await tokenRequest({ refresh_token: refresh, grant_type: 'refresh_token' });
  cached = { token: t.access_token, until: Date.now() + (t.expires_in - 120) * 1000, sender: c.gmailSender };
  return cached;
}

const b64 = (s: string) => Buffer.from(s, 'utf8').toString('base64');
const encWord = (s: string) => `=?UTF-8?B?${b64(s)}?=`;

export async function sendGmail({ to, subject, html, unsubscribeUrl }: { to: string; subject: string; html: string; unsubscribeUrl?: string }) {
  const { token, sender } = await access();
  const headers = [
    `From: ${encWord('팩트파인더')} <${sender}>`,
    `To: <${to}>`,
    `Subject: ${encWord(subject)}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    // 지메일·네이버 메일의 [구독 취소] 버튼 — 한 번 누르면 바로 해지
    ...(unsubscribeUrl ? [`List-Unsubscribe: <${unsubscribeUrl}>`, 'List-Unsubscribe-Post: List-Unsubscribe=One-Click'] : []),
  ];
  const body = b64(html).replace(/.{76}/g, '$&\r\n');
  const raw = Buffer.from(`${headers.join('\r\n')}\r\n\r\n${body}`, 'utf8').toString('base64url');
  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    if (res.status === 401) cached = null;
    throw new Error(`지메일 발송 실패 (HTTP ${res.status}): ${text.slice(0, 200)}`);
  }
}

// 여러 명에게 한 명씩 따로 발송(서로 주소가 안 보이게) — 지메일 한도를 고려해 동시 3통씩
export async function sendGmailBatch(
  recipients: { email: string; unsubscribeUrl?: string }[],
  build: (r: { email: string; unsubscribeUrl?: string }) => { subject: string; html: string },
) {
  let sent = 0;
  const errors: string[] = [];
  for (let i = 0; i < recipients.length; i += 3) {
    const chunk = recipients.slice(i, i + 3);
    const results = await Promise.allSettled(chunk.map((r) => sendGmail({ to: r.email, unsubscribeUrl: r.unsubscribeUrl, ...build(r) })));
    for (const r of results) {
      if (r.status === 'fulfilled') sent++;
      else errors.push(r.reason instanceof Error ? r.reason.message : String(r.reason));
    }
  }
  return { sent, failed: errors.length, firstError: errors[0] ?? null };
}
