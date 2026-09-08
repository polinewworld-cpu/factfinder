import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/session';

// 설문 결과 조회 — 옵션별 득표수/비율 + 로그인한 사용자의 기존 투표 여부
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const poll = await prisma.poll.findUnique({
    where: { id: params.id },
    include: { options: { orderBy: { order: 'asc' }, include: { _count: { select: { votes: true } } } } },
  });
  if (!poll) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const user = await getCurrentUser();
  const myVote = user
    ? await prisma.pollVote.findUnique({ where: { pollId_userId: { pollId: poll.id, userId: user.id } } })
    : null;

  const totalVotes = poll.options.reduce((sum, o) => sum + o._count.votes, 0);

  return NextResponse.json({
    id: poll.id,
    question: poll.question,
    totalVotes,
    myVoteOptionId: myVote?.optionId ?? null,
    options: poll.options.map((o) => ({ id: o.id, text: o.text, order: o.order, voteCount: o._count.votes })),
  });
}
