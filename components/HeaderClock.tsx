'use client';

import { useEffect, useState } from 'react';

// 편집실 헤더의 현재 시각·날짜(한국시간) — 프로필 사진 왼쪽 (2026-10-10). 예) 21:32  10월 10일 (토)
// 서버·브라우저 시각이 달라 어긋나지 않도록 화면이 뜬 뒤에만 그린다.
export default function HeaderClock() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(t);
  }, []);

  if (!now) return <div className="hidden md:block" style={{ width: 190 }} aria-hidden="true" />;

  const time = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hour12: false }).format(now);
  const date = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: 'long', day: 'numeric', weekday: 'short' }).format(now); // 10월 10일 (토)

  return (
    <div className="hidden md:flex items-baseline gap-3 mr-3 whitespace-nowrap" aria-label={`${date} ${time}`}>
      <span className="text-[32px] font-extrabold leading-none tracking-tight text-gray-900 tabular-nums">{time}</span>
      <span className="text-sm font-semibold text-gray-500">{date}</span>
    </div>
  );
}
