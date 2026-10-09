import { NextRequest, NextResponse } from 'next/server';
import { isGhostWriterEmail } from '@/lib/ghostWriter';
import { prisma } from '@/lib/prisma';
import { ROLES } from '@/lib/roles';
import { getCurrentUser } from '@/lib/session';

// 후원내역 — 옛 사이트 관리자 "운영관리 > 후원내역"(주문번호·기사번호·기자명·후원인·후원액·후원일시, 기간·기자명 검색)을 이식 (2026-10-08)
// 결제창만 열고 끝난 건(PENDING)·실패 건(FAILED)은 제외 — 결제 완료(ACTIVE)·취소(CANCELLED)만.
// ?from=YYYY-MM-DD&to=YYYY-MM-DD (한국시간 기준, 양끝 포함) &reporter=기자 이름 일부
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });
  if (user.role !== ROLES.CHIEF_EDITOR) {
    return NextResponse.json({ error: '편집장만 볼 수 있습니다' }, { status: 403 });
  }

  const sp = req.nextUrl.searchParams;
  const kstDay = (d: string | null, endOfDay: boolean) =>
    d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? new Date(`${d}T${endOfDay ? '23:59:59.999' : '00:00:00'}+09:00`) : undefined;
  const from = kstDay(sp.get('from'), false);
  const to = kstDay(sp.get('to'), true);
  const reporter = sp.get('reporter')?.trim();

  const donations = await prisma.donation.findMany({
    where: {
      status: { in: ['ACTIVE', 'CANCELLED'] },
      ...(from || to ? { startedAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
      ...(reporter
        ? { reporter: { OR: [{ name: { contains: reporter } }, { nickname: { contains: reporter } }] } }
        : {}),
    },
    include: {
      // 후원리스트에 닉네임·프로필사진·이메일·연락처를 함께 노출하기 위해 확장 (2026-09-12)
      user: { select: { id: true, name: true, nickname: true, image: true, email: true } },
      // 정산 탭에서 바로 입금할 수 있게 계좌·유령기자 여부까지 (2026-10-09)
      reporter: { select: { id: true, name: true, nickname: true, email: true, bankName: true, bankAccount: true, accountHolder: true } },
      article: { select: { id: true, title: true, legacyId: true } },
    },
    orderBy: { startedAt: 'desc' },
    take: 1000,
  });

  // 기자 이메일은 내보내지 않고 유령기자 여부만
  return NextResponse.json(
    donations.map((d) => {
      if (!d.reporter) return d;
      const { email, ...reporter } = d.reporter;
      return { ...d, reporter: { ...reporter, isGhostWriter: isGhostWriterEmail(email) } };
    }),
  );
}
