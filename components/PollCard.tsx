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
    <section className="article-poll">
      <p className="article-poll-kicker">설문조사</p>
      <h3 className="article-poll-question">{poll.question}</h3>

      <ul className="article-poll-options">
        {poll.options.map((opt) => {
          const pct = poll.totalVotes > 0 ? Math.round((opt.voteCount / poll.totalVotes) * 100) : 0;
          const isMine = poll.myVoteOptionId === opt.id;
          return (
            <li key={opt.id}>
              <button
                type="button"
                onClick={() => vote(opt.id)}
                disabled={voting}
                aria-pressed={isMine}
                className={`article-poll-option${voted ? ' is-result' : ''}${isMine ? ' is-mine' : ''}`}
              >
                <span className="article-poll-head">
                  <span className="article-poll-label">{opt.text}</span>
                  {voted && <span className="article-poll-pct">{pct}%</span>}
                </span>
                <span className="article-poll-track">
                  {voted && <span className="article-poll-fill" style={{ width: `${pct}%` }} />}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <p className="article-poll-meta">
        {poll.totalVotes.toLocaleString()}명 참여{!voted && ' · 항목을 선택하면 결과가 공개됩니다'}
      </p>
      {errorMsg && <p className="article-poll-error">{errorMsg}</p>}
    </section>
  );
}
