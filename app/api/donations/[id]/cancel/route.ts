import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/session';
import { ROLES } from '@/lib/roles';

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });

  const donation = await prisma.donation.findUnique({ where: { id: params.id } });
  if (!donation) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (donation.userId !== user.id) {
    return NextResponse.json({ error: '본인 후원만 해지할 수 있습니다' }, { status: 403 });
  }
  if (donation.status !== 'ACTIVE') {
    return NextResponse.json({ error: '이미 해지된 후원입니다' }, { status: 400 });
  }

  const currentUser = await prisma.user.findUnique({ where: { id: user.id } });

  const [cancelled] = await prisma.$transaction([
    prisma.donation.update({ where: { id: params.id }, data: { status: 'CANCELLED', cancelledAt: new Date() } }),
    prisma.user.update({
      where: { id: user.id },
      data: {
        isDonor: false,
        role: currentUser?.role === ROLES.DONOR_READER ? ROLES.READER : undefined,
      },
    }),
  ]);

  return NextResponse.json(cancelled);
}
