'use client';

import { useEffect, useState } from 'react';

type Option = { id: string; text: string; order: number; voteCount: number };
type PollData = { id: string; question: string; totalVotes: number; myVoteOptionId: string | null; options: Option[] };

export default function PollCard({ pollId }: { pollId: string }) {
  const [me, setMe] = useState<any>(null);
  const [poll, setPoll] = useState<PollData | null>(null);
  const [voting, setVoting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    (async () => {
      const meRes = await fetch('/api/me');
      setMe(meRes.ok ? await meRes.json() : null);
      const res = await fetch(`/api/polls/${pollId}`);
      if (res.ok) setPoll(await res.json());
    })();
  }, [pollId]);

  async function vote(optionId: string) {
    if (!me) {
      setErrorMsg('투표하려면 로그인이 필요합니다.');
      return;
    }
    if (voting) return;
    setVoting(true);
    setErrorMsg('');
    const res = await fetch(`/api/polls/${pollId}/vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ optionId }),
    });
    const data = await res.json();
    if (res.ok) setPoll(data);
    else setErrorMsg(data.error ?? '투표 실패');
    setVoting(false);
  }

  if (!poll) return null;

  const voted = !!poll.myVoteOptionId;

  return (
    <section className="my-8 border border-gray-200 rounded-xl p-5 bg-gray-50">
      <p className="text-[11px] font-bold text-brand mb-1">📊 설문조사</p>
      <h3 className="font-bold text-gray-900 mb-4">{poll.question}</h3>

      <div className="space-y-2">
        {poll.options.map((opt) => {
          const pct = poll.totalVotes > 0 ? Math.round((opt.voteCount / poll.totalVotes) * 100) : 0;
          const isMine = poll.myVoteOptionId === opt.id;
          if (voted) {
            return (
              <div key={opt.id} className="relative rounded-lg border border-gray-200 bg-white overflow-hidden">
                <div
                  className={`absolute inset-y-0 left-0 ${isMine ? 'bg-brand/25' : 'bg-gray-100'}`}
                  style={{ width: `${pct}%` }}
                />
                <button
                  type="button"
                  onClick={() => vote(opt.id)}
                  disabled={voting}
                  className="relative w-full flex items-center justify-between px-4 py-2.5 text-sm text-left"
                >
                  <span className={isMine ? 'font-bold text-brand' : 'text-gray-800'}>
                    {isMine && '✓ '}
                    {opt.text}
                  </span>
                  <span className="text-xs font-semibold text-gray-500">{pct}%</span>
                </button>
              </div>
            );
          }
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => vote(opt.id)}
              disabled={voting}
              className="w-full text-left px-4 py-2.5 text-sm rounded-lg border border-gray-200 bg-white hover:border-brand hover:bg-brand/5 disabled:opacity-50"
            >
              {opt.text}
            </button>
          );
        })}
      </div>

      <p className="text-xs text-gray-400 mt-3">
        {poll.totalVotes.toLocaleString()}명 참여{!voted && ' · 항목을 선택하면 결과가 공개됩니다'}
      </p>
      {errorMsg && <p className="text-xs text-red-500 mt-1">{errorMsg}</p>}
    </section>
  );
}
