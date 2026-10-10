'use client';

import { useEffect } from 'react';

// 대시보드 배경 사진: 한국시간 06~18시는 낮 사진, 18~06시는 밤 사진 (html[data-admin-time]을 CSS가 읽음)
export default function AdminTimeBg() {
  useEffect(() => {
    const apply = () => {
      const h = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Seoul', hour: '2-digit', hour12: false }).format(new Date()));
      document.documentElement.dataset.adminTime = h >= 6 && h < 18 ? 'day' : 'night';
    };
    apply();
    const t = setInterval(apply, 60_000);
    return () => {
      clearInterval(t);
      delete document.documentElement.dataset.adminTime;
    };
  }, []);
  return null;
}
