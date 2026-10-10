import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/session';
import { ROLES, WRITER_ROLES } from '@/lib/roles';
import { PERSONA_KEYS, getPersonaAvatar, setPersonaAvatar, type PersonaKey } from '@/lib/persona';

// 편집실 페르소나 프로필 사진 (2026-10-10) — 보기는 기자 이상, 바꾸기는 편집장만. 사진은 /api/upload로 먼저 올리고 그 주소(/api/blob/…)만 받음
export const dynamic = 'force-dynamic';

const asKey = (v: unknown): PersonaKey | null => ((PERSONA_KEYS as readonly string[]).includes(String(v)) ? (v as PersonaKey) : null);

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !(WRITER_ROLES as readonly string[]).includes(user.role)) return NextResponse.json({ error: '권한이 없습니다' }, { status: 403 });
  const key = asKey(req.nextUrl.searchParams.get('key'));
  if (!key) return NextResponse.json({ error: '알 수 없는 인물입니다' }, { status: 400 });
  return NextResponse.json({ avatarUrl: await getPersonaAvatar(key), canEdit: user.role === ROLES.CHIEF_EDITOR });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== ROLES.CHIEF_EDITOR) return NextResponse.json({ error: '편집장만 바꿀 수 있습니다' }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const key = asKey(body.key);
  const url = typeof body.avatarUrl === 'string' ? body.avatarUrl : '';
  if (!key) return NextResponse.json({ error: '알 수 없는 인물입니다' }, { status: 400 });
  if (!/^\/api\/blob\/[A-Za-z0-9._-]+$/.test(url)) return NextResponse.json({ error: '올바른 사진 주소가 아닙니다' }, { status: 400 });
  await setPersonaAvatar(key, url);
  return NextResponse.json({ ok: true, avatarUrl: url });
}
