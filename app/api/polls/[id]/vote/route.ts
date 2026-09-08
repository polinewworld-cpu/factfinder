import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/session';

// 설문 투표 — 로그인 필요, 1인 1표(재투표 시 기존 표를 다른 항목으로 변경)
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });

  const { optionId } = await req.json();
  if (!optionId) return NextResponse.json({ error: '항목을 선택해주세요' }, { status: 400 });

  const option = await prisma.pollOption.findUnique({ where: { id: optionId } });
  if (!option || option.pollId !== params.id) {
    return NextResponse.json({ error: '잘못된 항목입니다' }, { status: 400 });
  }

  await prisma.pollVote.upsert({
    where: { pollId_userId: { pollId: params.id, userId: user.id } },
    update: { optionId },
    create: { pollId: params.id, optionId, userId: user.id },
  });

  const poll = await prisma.poll.findUnique({
    where: { id: params.id },
    include: { options: { orderBy: { order: 'asc' }, include: { _count: { select: { votes: true } } } } },
  });
  const totalVotes = poll!.options.reduce((sum, o) => sum + o._count.votes, 0);

  return NextResponse.json({
    id: poll!.id,
    question: poll!.question,
    totalVotes,
    myVoteOptionId: optionId,
    options: poll!.options.map((o) => ({ id: o.id, text: o.text, order: o.order, voteCount: o._count.votes })),
  });
}
