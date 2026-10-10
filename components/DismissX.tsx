'use client';

// 문장 끝에 다는 작은 × — 관리자가 누르면 그 항목을 지우고 서버가 새 토픽으로 채움 (2026-10-10)
export default function DismissX({ onClick, busy, label = '이 항목 지우고 새 토픽 가져오기' }: { onClick: () => void; busy?: boolean; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      title={label}
      aria-label={label}
      className="ml-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full align-middle text-[11px] leading-none text-gray-400 hover:bg-gray-200 hover:text-gray-700 disabled:opacity-40"
    >
      ×
    </button>
  );
}
