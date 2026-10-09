import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ROLES, WRITER_ROLES } from '@/lib/roles';
import { getCurrentUser } from '@/lib/session';

// 사진 뱅크 인물 목록 (2026-10-09) — 보기는 기자 이상, 추가·수정·삭제는 편집장만
const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !(WRITER_ROLES as readonly string[]).includes(user.role)) {
    return NextResponse.json({ error: '기자 이상만 볼 수 있습니다' }, { status: 403 });
  }
  const people = await prisma.person.findMany({ orderBy: { name: 'asc' }, include: { _count: { select: { photos: true } } } });
  return NextResponse.json(people);
}

async function chief() {
  const user = await getCurrentUser();
  return user?.role === ROLES.CHIEF_EDITOR ? null : NextResponse.json({ error: '인물 목록은 편집장만 관리할 수 있습니다' }, { status: 403 });
}

export async function POST(req: NextRequest) {
  const denied = await chief();
  if (denied) return denied;
  const b = await req.json();
  const name = str(b.name);
  if (!name) return NextResponse.json({ error: '이름을 입력하세요' }, { status: 400 });
  if (await prisma.person.findUnique({ where: { name } })) return NextResponse.json({ error: '이미 있는 이름입니다' }, { status: 400 });
  const person = await prisma.person.create({ data: { name, aliases: str(b.aliases), affiliation: str(b.affiliation), title: str(b.title) } });
  return NextResponse.json(person, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const denied = await chief();
  if (denied) return denied;
  const b = await req.json();
  if (!b.id) return NextResponse.json({ error: 'id가 필요합니다' }, { status: 400 });
  const name = str(b.name);
  if (!name) return NextResponse.json({ error: '이름을 입력하세요' }, { status: 400 });
  const dup = await prisma.person.findUnique({ where: { name } });
  if (dup && dup.id !== b.id) return NextResponse.json({ error: '이미 있는 이름입니다' }, { status: 400 });
  const person = await prisma.person.update({
    where: { id: String(b.id) },
    data: { name, aliases: str(b.aliases), affiliation: str(b.affiliation), title: str(b.title) },
  });
  return NextResponse.json(person);
}

// 삭제해도 사진은 남고 그 인물 태그만 빠짐
export async function DELETE(req: NextRequest) {
  const denied = await chief();
  if (denied) return denied;
  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id가 필요합니다' }, { status: 400 });
  await prisma.person.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
