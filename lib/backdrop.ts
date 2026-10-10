import type { MouseEvent } from 'react';

// 팝업·편집창 바깥(어두운 배경)을 눌러 닫기 — 누르기와 떼기가 "둘 다" 배경에서 일어났을 때만 닫는다 (2026-10-10).
// 그냥 onClick={onClose}로 두면, 입력칸 글자를 드래그로 선택하다가 마우스를 창 밖에서 떼는 순간 브라우저가
// 그걸 배경 클릭으로 처리해 창이 닫혔음(기자관리 [편집]에서 닉네임 고치다 창이 닫히던 문제).
// 사용: <div className="… overlay" {...closeOnBackdrop(onClose)}>
export function closeOnBackdrop(onClose: () => void) {
  return {
    onMouseDown: (e: MouseEvent<HTMLElement>) => {
      e.currentTarget.dataset.pressedOnBackdrop = e.target === e.currentTarget ? '1' : '';
    },
    onClick: (e: MouseEvent<HTMLElement>) => {
      const pressedHere = e.currentTarget.dataset.pressedOnBackdrop === '1';
      e.currentTarget.dataset.pressedOnBackdrop = '';
      if (pressedHere && e.target === e.currentTarget) onClose();
    },
  };
}
