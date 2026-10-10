import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/session';
import { WRITER_ROLES } from '@/lib/roles';
import { PERSONA_KEYS, getPersonaAvatar, type PersonaKey } from '@/lib/persona';

// 편집실 페르소나 프로필 사진 보기 (2026-10-10) — 기자 이상. 사진은 올려 둔 것으로 고정되어 바꾸는 API는 없음
export const dynamic = 'force-dynamic';

const asKey = (v: unknown): PersonaKey | null => ((PERSONA_KEYS as readonly string[]).includes(String(v)) ? (v as PersonaKey) : null);

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !(WRITER_ROLES as readonly string[]).includes(user.role)) return NextResponse.json({ error: '권한이 없습니다' }, { status: 403 });
  const key = asKey(req.nextUrl.searchParams.get('key'));
  if (!key) return NextResponse.json({ error: '알 수 없는 인물입니다' }, { status: 400 });
  return NextResponse.json({ avatarUrl: await getPersonaAvatar(key) });
}
