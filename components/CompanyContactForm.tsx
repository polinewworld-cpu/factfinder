'use client';

import { useState } from 'react';

// 기사제보 / 광고 및 제휴문의 공용 문의 폼 — 실사이트(customer.php)의 이름/메일주소/전화번호/내용 항목을 그대로 이식.
// 별도 접수 서버가 없어(뉴스레터 발송용 이메일 연동은 별도 과제로 보류됨) 입력값을 정리해 담당 메일로 보내는
// mailto: 링크를 생성하는 방식으로 구현 — 비밀번호/스팸등록방지 항목은 게시판 기능이 없어 제외 (2026-09-12 신설)
export default function CompanyContactForm({ subjectPrefix }: { subjectPrefix: string }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [content, setContent] = useState('');

  const canSubmit = name.trim() && email.trim() && content.trim();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    const subject = `[${subjectPrefix}] ${name.trim()}`;
    const body = [`이름: ${name.trim()}`, `메일주소: ${email.trim()}`, `전화번호: ${phone.trim() || '-'}`, '', content.trim()].join('\n');
    window.location.href = `mailto:polinewworld@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  return (
    <form onSubmit={submit} className="space-y-3 text-sm">
      <div>
        <label className="block text-gray-600 mb-1">이름</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="w-full border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-brand"
        />
      </div>
      <div>
        <label className="block text-gray-600 mb-1">메일주소</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-brand"
        />
      </div>
      <div>
        <label className="block text-gray-600 mb-1">전화번호</label>
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-brand"
        />
      </div>
      <div>
        <label className="block text-gray-600 mb-1">내용</label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          required
          rows={6}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-brand resize-none"
        />
      </div>
      <button
        type="submit"
        disabled={!canSubmit}
        className="text-sm font-semibold text-white bg-brand rounded-lg px-5 py-2 hover:bg-brand-dark disabled:opacity-40"
      >
        확인
      </button>
      <p className="text-xs text-gray-400">
        확인을 누르면 작성하신 내용을 담아 메일 앱이 열립니다 ({`polinewworld@gmail.com`}로 발송).
      </p>
    </form>
  );
}
