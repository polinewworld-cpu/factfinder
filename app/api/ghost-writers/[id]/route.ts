import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ROLES } from '@/lib/roles';
import { getCurrentUser } from '@/lib/session';
import { GHOST_WHERE } from '@/lib/ghostWriter';

// 유령기자 상세·수정·숨김 (2026-10-09) — 편집장 전용. 정산 정보(은행·계좌·예금주) 포함. (주민등록증 사진 기능은 사장님 지시로 삭제)
async function chief() {
  const user = await getCurrentUser();
  return user?.role === ROLES.CHIEF_EDITOR ? user : null;
}
const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await chief())) return NextResponse.json({ error: '편집장만 볼 수 있습니다' }, { status: 403 });
  const u = await prisma.user.findFirst({
    where: { id: params.id, ...GHOST_WHERE },
    select: {
      id: true,
      name: true,
      nickname: true,
      writerTitle: true,
      image: true,
      bankName: true,
      bankAccount: true,
      accountHolder: true,
      _count: { select: { articles: true } },
    },
  });
  if (!u) return NextResponse.json({ error: '유령기자를 찾을 수 없습니다' }, { status: 404 });
  return NextResponse.json({ ...u, displayName: u.nickname || u.name, articleCount: u._count.articles });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await chief())) return NextResponse.json({ error: '편집장만 고칠 수 있습니다' }, { status: 403 });
  const u = await prisma.user.findFirst({ where: { id: params.id, ...GHOST_WHERE }, select: { id: true } });
  if (!u) return NextResponse.json({ error: '유령기자를 찾을 수 없습니다' }, { status: 404 });
  const b = await req.json().catch(() => ({}));
  const has = (k: string) => Object.prototype.hasOwnProperty.call(b, k);

  const data: Record<string, string | null> = {};
  if (has('name')) {
    const name = str(b.name)?.slice(0, 30);
    if (!name) return NextResponse.json({ error: '이름을 입력하세요' }, { status: 400 });
    const dup = await prisma.user.findFirst({ where: { nickname: name, ghost: false, NOT: { id: u.id } }, select: { id: true } });
    if (dup) return NextResponse.json({ error: `"${name}" 이름이 이미 있습니다` }, { status: 400 });
    data.name = name;
    data.nickname = name;
  }
  for (const k of ['writerTitle', 'image', 'bankName', 'bankAccount', 'accountHolder'] as const) {
    if (has(k)) data[k] = str(b[k]);
  }
  await prisma.user.update({ where: { id: u.id }, data });
  return NextResponse.json({ ok: true });
}

// 삭제 = 목록에서 숨김(기존 "유령 계정" 처리와 같음) — 쓴 기사·이름은 그대로 남음
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await chief())) return NextResponse.json({ error: '편집장만 삭제할 수 있습니다' }, { status: 403 });
  const u = await prisma.user.findFirst({ where: { id: params.id, ...GHOST_WHERE }, select: { id: true } });
  if (!u) return NextResponse.json({ error: '유령기자를 찾을 수 없습니다' }, { status: 404 });
  await prisma.user.update({ where: { id: u.id }, data: { ghost: true } });
  return NextResponse.json({ ok: true });
}
