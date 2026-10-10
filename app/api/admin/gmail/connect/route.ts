import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { getCurrentUser } from '@/lib/session';
import { ROLES } from '@/lib/roles';
import { gmailAuthUrl } from '@/lib/gmail';

// [지메일 연결] — 편집장이 보내는 지메일 계정으로 "메일 보내기" 권한을 허용하는 구글 화면으로 보냄 (2026-10-10)
export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getCurrentUser();
  if (user?.role !== ROLES.CHIEF_EDITOR) return NextResponse.json({ error: '편집장만 연결할 수 있습니다' }, { status: 403 });
  const state = randomBytes(16).toString('hex');
  const res = NextResponse.redirect(gmailAuthUrl(state));
  res.cookies.set('ff_gmail_state', state, { httpOnly: true, sameSite: 'lax', secure: true, maxAge: 600, path: '/api/admin/gmail' });
  return res;
}
