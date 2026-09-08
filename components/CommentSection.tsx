'use client';

import { useEffect, useState } from 'react';
import { timeAgo } from '@/lib/time';

type CommentItem = {
  id: string;
  content: string;
  createdAt: string;
  user: { id: string; name: string; nickname?: string | null; image?: string | null; isDonor: boolean };
};

export default function CommentSection({ articleId }: { articleId: string }) {
  const [me, setMe] = useState<any>(null);
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [text, setText] = useState('');
  const [posting, setPosting] = useState(false);

  async function load() {
    const res = await fetch(`/api/articles/${articleId}/comments`);
    if (res.ok) setComments(await res.json());
  }

  useEffect(() => {
    (async () => {
      const meRes = await fetch('/api/me');
      setMe(meRes.ok ? await meRes.json() : null);
      await load();
    })();
  }, [articleId]);

  async function submit() {
    if (!text.trim()) return;
    setPosting(true);
    const res = await fetch(`/api/articles/${articleId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: text.trim() }),
    });
    if (res.ok) {
      setText('');
      await load();
    }
    setPosting(false);
  }

  async function remove(id: string) {
    await fetch(`/api/comments/${id}`, { method: 'DELETE' });
    await load();
  }

  return (
    <section className="mt-10 pt-8 border-t border-gray-200">
      <h3 className="font-bold text-gray-900 mb-4">댓글 {comments.length}</h3>

      {me ? (
        <div className="mb-6">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="댓글을 입력하세요"
            rows={3}
            className="w-full border border-gray-200 rounded-lg p-3 text-sm outline-none focus:border-brand"
          />
          <div className="flex justify-end mt-2">
            <button
              disabled={posting}
              onClick={submit}
              className="text-sm font-bold text-white bg-brand rounded-full px-5 py-1.5 disabled:opacity-50"
            >
              등록
            </button>
          </div>
        </div>
      ) : (
        <div className="mb-6 flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg p-4">
          <p className="text-sm text-gray-500">댓글을 작성하려면 로그인해주세요.</p>
          <button
            onClick={() => (window.location.href = '/api/auth/signin/google')}
            className="text-sm font-bold text-white bg-gray-900 rounded-full px-4 py-1.5"
          >
            구글로 로그인
          </button>
        </div>
      )}

      <ul className="space-y-4">
        {comments.map((c) => (
          <li key={c.id} className="flex justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-gray-900">
                {c.user.isDonor && <span className="mr-1">👑</span>}
                {c.user.nickname || c.user.name}
                <span className="text-gray-400 font-normal ml-2">{timeAgo(c.createdAt)}</span>
              </p>
              <p className="text-sm text-gray-700 mt-1 whitespace-pre-wrap">{c.content}</p>
            </div>
            {me && (me.id === c.user.id || me.role === 'CHIEF_EDITOR') && (
              <button onClick={() => remove(c.id)} className="text-xs text-gray-300 hover:text-red-500 shrink-0">
                삭제
              </button>
            )}
          </li>
        ))}
        {comments.length === 0 && <p className="text-gray-400 text-sm">첫 댓글을 남겨보세요.</p>}
      </ul>
    </section>
  );
}
