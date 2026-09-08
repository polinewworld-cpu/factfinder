const CATEGORIES = ['전체', '정치', '국제', '사회', '문화'];

export default function Header() {
  return (
    <header className="sticky top-0 z-10 bg-bg/95 backdrop-blur border-b border-white/10">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-6">
        <a href="/" className="text-brand font-extrabold text-xl tracking-tight shrink-0">
          팩트파인더
        </a>
        <form action="/search" className="flex-1 max-w-md">
          <input
            name="q"
            placeholder="기사, 인물, 이슈 검색"
            className="w-full bg-white/5 border border-white/10 rounded-full px-4 py-1.5 text-sm placeholder:text-white/40 outline-none focus:border-brand"
          />
        </form>
        <div className="ml-auto flex items-center gap-4 text-sm text-white/70 shrink-0">
          <a href="/" className="hidden sm:inline">전체기사</a>
          <a href="/donate" className="text-brand font-bold bg-brand/10 rounded-full px-4 py-1.5">
            후원하기
          </a>
        </div>
      </div>
      <nav className="max-w-6xl mx-auto px-4 flex gap-5 pb-3 text-sm font-semibold overflow-x-auto">
        {CATEGORIES.map((c) => (
          <a
            key={c}
            href={c === '전체' ? '/' : `/?category=${encodeURIComponent(c)}`}
            className="text-white/80 hover:text-brand whitespace-nowrap"
          >
            {c}
          </a>
        ))}
      </nav>
    </header>
  );
}
