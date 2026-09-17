import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="max-w-md mx-auto px-4 py-24 text-center">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">페이지를 찾을 수 없습니다</h1>
      <p className="text-sm text-gray-500 mb-8">주소가 잘못됐거나, 삭제된 기사일 수 있습니다.</p>
      <Link href="/" className="inline-block text-sm font-semibold text-white bg-brand rounded-full px-6 py-3">
        홈으로 가기
      </Link>
    </main>
  );
}
