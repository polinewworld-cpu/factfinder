import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ROLES } from '@/lib/roles';
import { getCurrentUser } from '@/lib/session';
import { GHOST_WHERE } from '@/lib/ghostWriter';
import { nicknameHolder } from '@/lib/nicknameHolder';
import { deleteOrRetire } from '@/lib/retireUser';

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
    // 숨긴 계정이 쓰는 이름도 걸러야 함 — 예전엔 ghost:false만 봐서 통과한 뒤 DB 중복 오류(500)가 났음 (2026-10-10)
    const holder = await nicknameHolder(name, u.id);
    if (holder) return NextResponse.json({ error: holder.message, conflict: holder.conflict }, { status: 409 });
    data.name = name;
    data.nickname = name;
  }
  for (const k of ['writerTitle', 'image', 'bankName', 'bankAccount', 'accountHolder'] as const) {
    if (has(k)) data[k] = str(b[k]);
  }
  await prisma.user.update({ where: { id: u.id }, data });
  return NextResponse.json({ ok: true });
}

// 삭제 = 영구 삭제 (2026-10-10 사장님: "삭제하면 영원히, 필요하면 나중에 새로 등록") — 되살리기 없음.
// 쓴 기사가 있으면 기사엔 기자 이름만 그대로 남고(바이라인 유지), 이름(닉네임)은 비워져 같은 이름으로 새로 등록 가능.
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await chief())) return NextResponse.json({ error: '편집장만 삭제할 수 있습니다' }, { status: 403 });
  const u = await prisma.user.findFirst({ where: { id: params.id, ...GHOST_WHERE }, select: { id: true } });
  if (!u) return NextResponse.json({ error: '유령기자를 찾을 수 없습니다' }, { status: 404 });
  return NextResponse.json({ ok: true, ...(await deleteOrRetire(u.id)) });
}
