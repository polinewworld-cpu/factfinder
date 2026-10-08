'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { AnalyticsReport } from '@/lib/gaReport';

// 관리자 "방문 분석" (2026-10-08) — 구글 애널리틱스를 열지 않아도 핵심 지표·인기 기사·유입·시간대와 자동 인사이트를 한 화면에.
// 보고서는 매일 아침 자동 생성(lib/analyticsSnapshot.ts), [지금 새로 분석]으로 즉시 갱신.

const MARK = '#0d4f55'; // Z-Board 진청록 — 단일 계열 차트 색
const WEEKDAY = ['일', '월', '화', '수', '목', '금', '토'];
const n = (v: number) => v.toLocaleString('ko-KR');

function Change({ now, prev }: { now: number; prev: number }) {
  if (!prev) return <span className="text-xs text-gray-400">지난주 자료 없음</span>;
  const p = Math.round(((now - prev) / prev) * 100);
  const up = p >= 0;
  return (
    <span className="text-xs text-gray-500">
      <span aria-hidden="true">{up ? '▲' : '▼'}</span> {Math.abs(p)}% <span className="text-gray-400">지난주 대비</span>
    </span>
  );
}

function Card({ title, children, className = '' }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`border rounded-xl p-4 ${className}`}>
      <h2 className="text-xs font-semibold text-gray-500 mb-3 tracking-wide">{title}</h2>
      {children}
    </section>
  );
}

// 28일 방문자 추이 — 선 1개, 세로 기준선이 가장 가까운 날짜에 붙는 툴팁
function DailyChart({ data }: { data: AnalyticsReport['daily'] }) {
  const ref = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const W = 640;
  const H = 180;
  const pad = { l: 36, r: 8, t: 10, b: 22 };
  const max = Math.max(1, ...data.map((d) => d.users));
  const x = (i: number) => pad.l + (i * (W - pad.l - pad.r)) / Math.max(1, data.length - 1);
  const y = (v: number) => pad.t + (1 - v / max) * (H - pad.t - pad.b);
  const path = data.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(d.users).toFixed(1)}`).join('');
  const ticks = [0, Math.round(max / 2), max];

  // 방문 기록이 하나도 없을 때(도메인 전환 전) — 빈 그래프 위로 마우스가 지나가면 화면이 죽던 문제 (2026-10-09)
  if (data.length === 0) return <p className="text-sm text-gray-400 py-10 text-center">아직 방문 기록이 없습니다.</p>;

  function onMove(e: React.PointerEvent) {
    const rect = ref.current!.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const i = Math.round(((px - pad.l) / (W - pad.l - pad.r)) * (data.length - 1));
    setHover(Math.max(0, Math.min(data.length - 1, i)));
  }

  const h = hover !== null ? data[hover] ?? null : null;
  return (
    <div className="relative">
      <svg
        ref={ref}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto"
        role="img"
        aria-label="최근 28일 하루 방문자 추이"
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="#d8cebb" strokeWidth="1" />
            <text x={pad.l - 6} y={y(t) + 4} textAnchor="end" fontSize="10" fill="#6d7a78">
              {n(t)}
            </text>
          </g>
        ))}
        {data.map((d, i) =>
          i % 7 === 0 || i === data.length - 1 ? (
            <text key={d.date} x={x(i)} y={H - 6} textAnchor="middle" fontSize="10" fill="#6d7a78">
              {d.date.slice(5).replace('-', '/')}
            </text>
          ) : null,
        )}
        <path d={path} fill="none" stroke={MARK} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {h && (
          <>
            <line x1={x(hover!)} x2={x(hover!)} y1={pad.t} y2={H - pad.b} stroke="#6d7a78" strokeWidth="1" />
            <circle cx={x(hover!)} cy={y(h.users)} r="4" fill={MARK} stroke="#efe8dc" strokeWidth="2" />
          </>
        )}
      </svg>
      {h && (
        <div
          className="absolute pointer-events-none rounded px-2 py-1 text-xs shadow"
          style={{ left: `${(x(hover!) / W) * 100}%`, top: 0, transform: 'translateX(-50%)', background: '#1f3033', color: '#fff' }}
        >
          <b>{n(h.users)}명</b> <span style={{ opacity: 0.75 }}>· 조회 {n(h.views)} · {h.date.slice(5).replace('-', '/')}</span>
        </div>
      )}
    </div>
  );
}

// 가로 막대 — 값은 항상 글자로 보임(툴팁 없이도 읽힘)
function Bars({ rows }: { rows: { label: string; value: number; note?: string; href?: string | null }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="space-y-1.5">
      {rows.map((r) => (
        <li key={r.label} className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-2 text-sm">
          <span className="truncate" title={r.label}>
            {r.href ? (
              <a href={r.href} target="_blank" rel="noopener noreferrer" className="hover:underline">
                {r.label}
              </a>
            ) : (
              r.label
            )}
          </span>
          <span className="h-2.5 rounded-sm" style={{ background: '#d8cebb' }}>
            <span className="block h-full rounded-sm" style={{ width: `${(r.value / max) * 100}%`, background: MARK }} />
          </span>
          <span className="text-xs tabular-nums whitespace-nowrap">
            {n(r.value)}
            {r.note && <span className="text-gray-400"> {r.note}</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}

// 세로 막대(시간대·요일) — 막대에 마우스를 올리면 값
function Columns({ rows, highlightMax = true }: { rows: { label: string; value: number }[]; highlightMax?: boolean }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  const [hover, setHover] = useState<number | null>(null);
  return (
    <div>
      <div className="flex items-end gap-[2px] h-28" onPointerLeave={() => setHover(null)}>
        {rows.map((r, i) => (
          <div
            key={r.label}
            className="flex-1 h-full flex items-end cursor-default"
            onPointerEnter={() => setHover(i)}
            title={`${r.label} · 조회 ${n(r.value)}`}
          >
            <div
              className="w-full rounded-t-sm"
              style={{
                height: `${Math.max(2, (r.value / max) * 100)}%`,
                background: MARK,
                opacity: hover === null ? (highlightMax && r.value === max ? 1 : 0.55) : hover === i ? 1 : 0.4,
              }}
            />
          </div>
        ))}
      </div>
      <div className="flex gap-[2px] mt-1">
        {rows.map((r, i) => (
          <span key={r.label} className="flex-1 text-center text-[10px] text-gray-400">
            {rows.length > 12 ? (i % 3 === 0 ? r.label : '') : r.label}
          </span>
        ))}
      </div>
      <p className="text-xs text-gray-500 mt-1 h-4">{hover !== null ? `${rows[hover].label} · 조회 ${n(rows[hover].value)}` : ''}</p>
    </div>
  );
}

// ── 매체 동향·기사 아이디어 (2026-10-09) ──

function Ideas({ ideas }: { ideas: NonNullable<NonNullable<AnalyticsReport['ai']>['ideas']> }) {
  return (
    <div className="grid lg:grid-cols-2 gap-3">
      {ideas.map((it, i) => (
        <article key={i} className="border rounded-lg p-3 text-sm">
          <p className="flex flex-wrap items-center gap-1.5 mb-1.5">
            <span className="rounded px-1.5 py-0.5 text-[11px] font-bold text-white" style={{ background: it.priority === 1 ? MARK : it.priority === 2 ? '#4f7f83' : '#8a9a98' }}>
              {it.priority}순위
            </span>
            <span className="rounded border px-1.5 py-0.5 text-[11px] font-semibold">{it.keyword}</span>
          </p>
          <p className="font-bold text-[15px] leading-snug mb-1">{it.headline}</p>
          <p className="text-gray-600 mb-2">{it.issue}</p>
          <p className="mb-1"><b className="text-xs text-gray-500 mr-1">각도</b>{it.angle}</p>
          <p className="mb-1"><b className="text-xs text-gray-500 mr-1">근거</b>{it.evidence}</p>
          {it.related.length > 0 && (
            <p className="text-xs text-gray-500 mt-2">
              연결할 우리 기사:{' '}
              {it.related.map((a, j) => (
                <span key={a.id}>
                  {j ? ' · ' : ''}
                  <a href={`/article/${a.id}`} target="_blank" rel="noopener noreferrer" className="underline">
                    {a.title}
                  </a>
                  {a.date && <span className="text-gray-400"> ({a.date})</span>}
                </span>
              ))}
            </p>
          )}
        </article>
      ))}
    </div>
  );
}

// 오늘의 키워드 — 순서대로 단어만 (사장님 지시 2026-10-09: 매체 수·순위 등 숫자는 빼고 단순하게)
function KeywordList({ rows }: { rows: NonNullable<AnalyticsReport['media']>['keywords'] }) {
  return (
    <ol className="flex flex-wrap gap-x-4 gap-y-2">
      {rows.map((k, i) => (
        <li key={k.word} className="text-[15px]">
          <span className="text-xs text-gray-400 tabular-nums mr-1">{i + 1}</span>
          <b>{k.word}</b>
        </li>
      ))}
    </ol>
  );
}

// 매체 지면 — 5개 매체 탭
function OutletTabs({ outlets }: { outlets: NonNullable<AnalyticsReport['media']>['outlets'] }) {
  const [tab, setTab] = useState(0);
  const o = outlets[Math.min(tab, outlets.length - 1)];
  if (!o) return null;
  return (
    <div>
      <div className="flex flex-wrap gap-1 border-b mb-3" role="tablist">
        {outlets.map((x, i) => (
          <button
            key={x.oid}
            type="button"
            role="tab"
            aria-selected={i === tab}
            onClick={() => setTab(i)}
            className={`px-3 py-1.5 text-sm -mb-px border-b-2 ${i === tab ? 'font-bold' : 'text-gray-500 border-transparent'}`}
            style={i === tab ? { borderColor: MARK, color: MARK } : undefined}
          >
            {x.name}
          </button>
        ))}
      </div>
      {o.paperDate && <p className="text-xs text-gray-500 mb-2">{o.paperDate.slice(5).replace('-', '/')} 지면</p>}
      <div className="grid md:grid-cols-3 gap-4">
        <OutletList title="1면" items={o.newspaper.filter((i) => /^A?1면$/.test(i.page ?? ''))} />
        <OutletList title="많이 본 뉴스" items={o.popular.slice(0, 10)} />
        <OutletList title="댓글 많은 뉴스" items={o.commented.slice(0, 10)} />
      </div>
      {o.error && <p className="text-[11px] text-gray-400 mt-2">일부 못 받음: {o.error}</p>}
    </div>
  );
}

function OutletList({ title, items }: { title: string; items: { title: string; url: string; rank?: number; page?: string }[] }) {
  if (!items.length) return null;
  return (
    <div className="mb-2">
      <p className="text-[11px] font-semibold text-gray-500 mb-0.5">{title}</p>
      <ol className="space-y-0.5">
        {items.map((it, i) => (
          <li key={i} className="flex gap-1.5 text-[13px] leading-snug">
            <span className="shrink-0 w-4 text-right text-gray-400 tabular-nums">{it.rank ?? '·'}</span>
            <a href={it.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
              {it.title}
            </a>
          </li>
        ))}
      </ol>
    </div>
  );
}

export default function AnalyticsPage() {
  const [state, setState] = useState<{ configured?: boolean; report?: AnalyticsReport; error?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [mediaBusy, setMediaBusy] = useState(false);

  // 오늘의 키워드·지면·기사 아이디어만 지금 새로 받기 (자동은 3시간마다)
  async function reloadMedia() {
    setMediaBusy(true);
    const res = await fetch('/api/admin/analytics?media=1');
    const data = await res.json().catch(() => null);
    if (data?.report) setState(data);
    setMediaBusy(false);
  }

  async function load(refresh = false) {
    setBusy(true);
    const res = await fetch(`/api/admin/analytics${refresh ? '?refresh=1' : ''}`);
    setState(await res.json().catch(() => ({ error: '불러오지 못했습니다' })));
    setBusy(false);
  }
  useEffect(() => {
    load();
  }, []);

  const r = state?.report;
  const devTotal = useMemo(() => (r ? r.devices.reduce((s, d) => s + d.users, 0) : 0), [r]);

  if (!state) return <main className="py-8 text-gray-500">불러오는 중…</main>;

  if (state.configured === false) {
    return (
      <main className="max-w-2xl py-8">
        <h1 className="text-xl font-bold text-gray-900 mb-3">방문 분석</h1>
        <p className="text-sm text-gray-600">
          구글 애널리틱스 연결이 아직 설정되지 않았습니다. Render 환경변수 <code>GA_PROPERTY_ID</code>와{' '}
          <code>GA_SERVICE_ACCOUNT_JSON</code>을 넣으면 이 화면이 자동으로 채워지고, 매일 아침 분석이 새로 만들어집니다.
        </p>
      </main>
    );
  }

  return (
    <main className="py-8 space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-gray-900">방문 분석</h1>
          {r && (
            <p className="text-xs text-gray-500 mt-1">
              최근 7일 {r.period.from} ~ {r.period.to} · 분석 시각{' '}
              {new Date(r.generatedAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}{' '}
              · 매일 아침 자동 갱신
            </p>
          )}
        </div>
        <button type="button" onClick={() => load(true)} disabled={busy} className="border rounded-lg px-3 py-1.5 text-sm disabled:opacity-40">
          {busy ? '분석 중…' : '지금 새로 분석'}
        </button>
      </div>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}

      {r && (
        <>
          {r.ai?.ideas && r.ai.ideas.length > 0 && (
            <Card title="오늘의 기사 아이디어">
              <p className="text-base font-semibold mb-3">{r.ai.headline}</p>
              <Ideas ideas={r.ai.ideas} />
            </Card>
          )}

          <section className="border rounded-xl p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <h2 className="text-xs font-semibold text-gray-500 tracking-wide">
                오늘의 키워드
                {r.media && (
                  <span className="font-normal text-gray-400">
                    {' '}
                    · {new Date(r.media.generatedAt).toLocaleTimeString('ko-KR', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit' })} 기준 · 3시간마다 자동 갱신
                  </span>
                )}
              </h2>
              <button type="button" onClick={reloadMedia} disabled={mediaBusy} className="border rounded-lg px-3 py-1 text-xs disabled:opacity-40">
                {mediaBusy ? '새로 받는 중… (1분쯤)' : '새로고침'}
              </button>
            </div>
            {r.media ? (
              <KeywordList rows={r.media.keywords} />
            ) : (
              <p className="text-sm text-gray-500">키워드를 받지 못했습니다{r.mediaError ? `: ${r.mediaError}` : ''}</p>
            )}
          </section>

          {r.ai?.outletComparison && r.ai.outletComparison.length > 0 && (
            <Card title="주요 언론 보도 동향">
              <ul className="list-disc pl-4 space-y-1 text-sm">
                {r.ai.outletComparison.map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ul>
            </Card>
          )}

          {r.media && (
            <Card title="주요 언론 지면">
              <OutletTabs outlets={r.media.outlets} />
            </Card>
          )}

          <Card title="이번 주 인사이트">
            <ul className="space-y-2 text-sm">
              {r.insights.map((it, i) => (
                <li key={i} className="flex gap-2">
                  <span aria-hidden="true" className="shrink-0 w-4 text-center text-gray-500">
                    {it.tone === 'up' ? '▲' : it.tone === 'down' ? '▼' : '•'}
                  </span>
                  <span>{it.text}</span>
                </li>
              ))}
            </ul>
          </Card>

          {r.ai ? (
            <Card title="분석 메모">
              {!r.ai.ideas?.length && <p className="text-base font-semibold mb-3">{r.ai.headline}</p>}
              <div className="grid md:grid-cols-2 gap-x-6 gap-y-4 text-sm">
                {(
                  [
                    ['잘 된 것', r.ai.whatWorked],
                    ['아쉬운 것', r.ai.whatDidnt],
                    ['주제·후속기사 전략', r.ai.topicStrategy ?? []],
                    ['발행 시간 전략', r.ai.scheduleStrategy],
                    ['유입 전략', r.ai.channelStrategy],
                    ['기자별 메모', r.ai.reporterNotes],
                  ] as const
                ).map(([title, items]) =>
                  items.length ? (
                    <div key={title}>
                      <p className="text-xs font-semibold text-gray-500 mb-1">{title}</p>
                      <ul className="list-disc pl-4 space-y-1">
                        {items.map((t, i) => (
                          <li key={i}>{t}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null,
                )}
              </div>
              {r.ai.nextWeekActions.length > 0 && (
                <div className="mt-4 pt-3 border-t">
                  <p className="text-xs font-semibold text-gray-500 mb-1">할 일</p>
                  <ul className="space-y-1 text-sm">
                    {r.ai.nextWeekActions.map((t, i) => (
                      <li key={i}>☐ {t}</li>
                    ))}
                  </ul>
                </div>
              )}
            </Card>
          ) : r.aiError ? (
            <p className="text-xs text-gray-500">기사 아이디어를 만들지 못했습니다: {r.aiError}</p>
          ) : null}

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {(
              [
                ['방문자', r.summary.users, r.summary.prev.users, '명'],
                ['페이지 조회', r.summary.views, r.summary.prev.views, '회'],
                ['방문 횟수', r.summary.sessions, r.summary.prev.sessions, '회'],
                ['1인당 체류', r.summary.engagementSec, r.summary.prev.engagementSec, '초'],
              ] as const
            ).map(([label, now, prev, unit]) => (
              <Card key={label} title={`${label} (7일)`}>
                <p className="text-3xl font-bold leading-none mb-2">
                  {label === '1인당 체류' ? `${Math.floor(now / 60)}분 ${now % 60}초` : `${n(now)}${unit}`}
                </p>
                <Change now={now} prev={prev} />
              </Card>
            ))}
          </div>

          <Card title="하루 방문자 (최근 28일)">
            <DailyChart data={r.daily} />
          </Card>

          <div className="grid lg:grid-cols-2 gap-4">
            <Card title="많이 읽힌 기사 (7일, 조회수)">
              {r.topArticles.length ? (
                <Bars
                  rows={r.topArticles.slice(0, 12).map((a) => ({
                    label: a.title,
                    value: a.views,
                    note: a.author ?? undefined,
                    href: a.href,
                  }))}
                />
              ) : (
                <p className="text-sm text-gray-400">자료 없음</p>
              )}
            </Card>
            <Card title="기자별 조회 (7일)">
              {r.reporters.length ? (
                <Bars rows={r.reporters.map((x) => ({ label: x.name, value: x.views, note: `· ${x.articles}건` }))} />
              ) : (
                <p className="text-sm text-gray-400">자료 없음</p>
              )}
            </Card>
            <Card title="유입 경로 (7일, 방문 횟수)">
              <Bars
                rows={r.channels.map((c) => ({
                  label: c.label,
                  value: c.sessions,
                  note: c.prevSessions ? `(지난주 ${n(c.prevSessions)})` : undefined,
                }))}
              />
            </Card>
            <Card title="카테고리별 조회 (7일)">
              <Bars rows={r.categories.map((c) => ({ label: c.name, value: c.views }))} />
              {devTotal > 0 && (
                <p className="text-sm mt-4">
                  기기:{' '}
                  {r.devices.map((d, i) => (
                    <span key={d.label}>
                      {i ? ' · ' : ''}
                      {d.label} <b>{Math.round((d.users / devTotal) * 100)}%</b>
                    </span>
                  ))}
                </p>
              )}
            </Card>
            <Card title="시간대별 조회 (최근 28일)">
              <Columns rows={r.hours.map((h) => ({ label: `${h.hour}시`, value: h.views }))} />
            </Card>
            <Card title="요일별 조회 (최근 28일)">
              <Columns rows={r.weekdays.map((d) => ({ label: WEEKDAY[d.day], value: d.views }))} />
            </Card>
          </div>
        </>
      )}
    </main>
  );
}
