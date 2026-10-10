import { splitLinked } from '@/lib/linkMarkup';

// [[구절|주소]] 표시가 든 글을 밑줄 친 기사 링크로 그린다 (오진실 기자·김정신 특파원)
export default function LinkedText({ text }: { text: string }) {
  return (
    <>
      {splitLinked(text).map((p, i) =>
        p.url ? (
          <a key={i} href={p.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 decoration-1 font-semibold" style={{ color: '#0d4f55' }}>
            {p.text}
          </a>
        ) : (
          <span key={i}>{p.text}</span>
        )
      )}
    </>
  );
}
