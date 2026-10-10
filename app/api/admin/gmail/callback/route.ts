import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/session';
import { ROLES } from '@/lib/roles';
import { connectGmail } from '@/lib/gmail';
import { SITE_URL } from '@/lib/siteTags';

// 구글 허용 화면에서 돌아오는 주소 — 발송 권한(갱신 토큰)을 저장하고 뉴스레터 관리 화면으로 (2026-10-10)
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const back = (q: string) => {
    const res = NextResponse.redirect(`${SITE_URL}/admin/newsletter?${q}`);
    res.cookies.delete({ name: 'ff_gmail_state', path: '/api/admin/gmail' });
    return res;
  };
  const user = await getCurrentUser();
  if (user?.role !== ROLES.CHIEF_EDITOR) return back('gmail=fail&msg=' + encodeURIComponent('편집장 계정으로 로그인한 상태에서 연결해 주세요'));
  const p = req.nextUrl.searchParams;
  if (p.get('error')) return back('gmail=fail&msg=' + encodeURIComponent('구글 화면에서 허용하지 않았습니다'));
  if (!p.get('state') || p.get('state') !== req.cookies.get('ff_gmail_state')?.value) {
    return back('gmail=fail&msg=' + encodeURIComponent('연결 시간이 지났습니다. 다시 눌러 주세요'));
  }
  try {
    const sender = await connectGmail(p.get('code') ?? '');
    return back('gmail=ok&sender=' + encodeURIComponent(sender));
  } catch (e) {
    return back('gmail=fail&msg=' + encodeURIComponent(e instanceof Error ? e.message : '연결 실패'));
  }
}
