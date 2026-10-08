import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ROLES } from '@/lib/roles';
import { getCurrentUser } from '@/lib/session';
import { mergeLegacyReporter } from '@/lib/legacyReporter';

// 옛 기자 계정 연결 (2026-10-08) — 옛 사이트 기사를 옮길 때 만든 "로그인 불가 임시 기자 계정"(…@legacy.invalid)을
// 실제로 구글 가입한 기자 계정에 합침: 기사·후원 지정을 실제 계정으로 옮기고 빈 임시 계정은 정리.
const LEGACY = { endsWith: '@legacy.invalid' };

async function requireChief() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });
  if (user.role !== ROLES.CHIEF_EDITOR) return NextResponse.json({ error: '편집장만 할 수 있습니다' }, { status: 403 });
  return null;
}

// 임시 기자 목록(기사 수 많은 순) + 연결 대상이 될 실제 회원 목록
export async function GET() {
  const denied = await requireChief();
  if (denied) return denied;
  const [legacy, members] = await Promise.all([
    prisma.user.findMany({
      where: { email: LEGACY },
      select: { id: true, name: true, legacyClaimEmail: true, _count: { select: { articles: true } } },
      orderBy: { articles: { _count: 'desc' } },
    }),
    prisma.user.findMany({
      where: { NOT: { email: LEGACY } },
      select: { id: true, name: true, nickname: true, email: true, role: true },
      orderBy: { name: 'asc' },
    }),
  ]);
  return NextResponse.json({
    legacy: legacy.map((u) => ({ id: u.id, name: u.name, claimEmail: u.legacyClaimEmail, articleCount: u._count.articles })),
    members,
  });
}

// body: { legacyId, targetId }
export async function POST(req: NextRequest) {
  const denied = await requireChief();
  if (denied) return denied;
  const { legacyId, targetId } = await req.json().catch(() => ({}));
  const [legacy, target] = await Promise.all([
    prisma.user.findUnique({ where: { id: String(legacyId) } }),
    prisma.user.findUnique({ where: { id: String(targetId) } }),
  ]);
  if (!legacy || !legacy.email.endsWith('@legacy.invalid')) {
    return NextResponse.json({ error: '옛 기자 임시 계정이 아닙니다' }, { status: 400 });
  }
  if (!target || target.email.endsWith('@legacy.invalid')) {
    return NextResponse.json({ error: '연결할 실제 회원을 골라주세요' }, { status: 400 });
  }

  const moved = await mergeLegacyReporter(legacy.id, target.id); // 독자 등급이면 기자로 승계
  return NextResponse.json({ ok: true, moved });
}

// 옛 기자 임시 계정 삭제 — 쓴 기사가 0건일 때만 (기사가 있으면 연결하거나 기사부터 정리) (2026-10-08)
export async function DELETE(req: NextRequest) {
  const denied = await requireChief();
  if (denied) return denied;
  const id = req.nextUrl.searchParams.get('id') ?? '';
  const legacy = await prisma.user.findUnique({ where: { id }, select: { email: true, _count: { select: { articles: true } } } });
  if (!legacy || !legacy.email.endsWith('@legacy.invalid')) {
    return NextResponse.json({ error: '옛 기자 임시 계정이 아닙니다' }, { status: 400 });
  }
  if (legacy._count.articles > 0) {
    return NextResponse.json({ error: `쓴 기사가 ${legacy._count.articles}건 있어 삭제할 수 없습니다` }, { status: 409 });
  }
  await prisma.$transaction([
    prisma.donation.updateMany({ where: { reporterId: id }, data: { reporterId: null } }),
    prisma.user.delete({ where: { id } }),
  ]);
  return NextResponse.json({ ok: true });
}

// 구글 이메일 미리 등록 — body: { id, claimEmail } (빈 값이면 해제).
// 그 이메일로 이미 가입한 회원이 있으면 바로 연결, 없으면 나중에 그 이메일로 처음 로그인할 때 자동 연결 (2026-10-08)
export async function PATCH(req: NextRequest) {
  const denied = await requireChief();
  if (denied) return denied;
  const { id, claimEmail } = await req.json().catch(() => ({}));
  const legacy = await prisma.user.findUnique({ where: { id: String(id) }, select: { id: true, email: true } });
  if (!legacy || !legacy.email.endsWith('@legacy.invalid')) {
    return NextResponse.json({ error: '옛 기자 임시 계정이 아닙니다' }, { status: 400 });
  }
  const email = typeof claimEmail === 'string' ? claimEmail.trim().toLowerCase() : '';
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: '이메일 형식이 올바르지 않습니다' }, { status: 400 });
  }
  const existing = email ? await prisma.user.findUnique({ where: { email }, select: { id: true } }) : null;
  if (existing) {
    const moved = await mergeLegacyReporter(legacy.id, existing.id);
    return NextResponse.json({ ok: true, linkedNow: true, moved });
  }
  try {
    await prisma.user.update({ where: { id: legacy.id }, data: { legacyClaimEmail: email || null } });
  } catch {
    return NextResponse.json({ error: '이미 다른 옛 기자에게 등록된 이메일입니다' }, { status: 409 });
  }
  return NextResponse.json({ ok: true, linkedNow: false });
}
