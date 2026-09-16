'use client';

import { useEffect, useRef, useState } from 'react';

type Photo = { id: string; url: string; filename: string | null; title: string | null; tags: { id: string; name: string }[] };

// 워터마크 제거 편집기 — 갤러리에서 사진을 "복제 도장(clone stamp)" 방식으로 직접 편집.
// 워터마크가 놓인 자리 위에, 사진의 다른(깨끗한) 부분을 복사해서 덮어씌우는 방식으로 지운다.
// 저장하면 같은 Photo 레코드의 url만 편집본으로 교체되므로(2026-09-12 API 확장) 캡션·해시태그는 그대로 유지되고,
// 원본 파일은 더 이상 어디서도 참조되지 않아 화면상에는 사라진다 (2026-09-12 신설).
export default function PhotoWatermarkEditor({
  photo,
  onClose,
  onSaved,
}: {
  photo: Photo;
  onClose: () => void;
  onSaved: (updated: Photo) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const historyRef = useRef<ImageData[]>([]); // 실행취소용 — 획을 시작하기 전 상태를 스택에 저장
  const strokeSourceCanvasRef = useRef<HTMLCanvasElement | null>(null); // 한 획을 긋는 동안엔 이 스냅샷에서만 복제해 얼룩짐 방지
  const sourcePointRef = useRef<{ x: number; y: number } | null>(null); // 복제 원본 위치(이미지 픽셀 좌표)
  const offsetRef = useRef<{ dx: number; dy: number } | null>(null); // 붓 시작점과 원본 사이의 고정 오프셋
  const pickingSourceRef = useRef(false);
  const paintingRef = useRef(false);

  const [pickMode, setPickMode] = useState(false); // "복제할 부분 선택" 모드 on/off
  const [hasSource, setHasSource] = useState(false);
  const [brushSize, setBrushSize] = useState(40);
  const [canUndo, setCanUndo] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [scale, setScale] = useState(1); // 화면표시크기 / 실제(원본) 픽셀 크기

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0);
      const MAX_W = 820;
      setScale(img.naturalWidth > MAX_W ? MAX_W / img.naturalWidth : 1);
      setLoaded(true);
    };
    img.onerror = () => setErrorMsg('이미지를 불러오지 못했습니다.');
    img.src = photo.url;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photo.url]);

  function toImageCoords(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * canvas.width;
    const y = ((e.clientY - rect.top) / rect.height) * canvas.height;
    return { x, y };
  }

  function pushHistory() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    historyRef.current.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
    if (historyRef.current.length > 15) historyRef.current.shift();
    setCanUndo(true);
  }

  function undo() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    const prev = historyRef.current.pop();
    if (!canvas || !ctx || !prev) return;
    ctx.putImageData(prev, 0, 0);
    setCanUndo(historyRef.current.length > 0);
  }

  function resetToOriginal() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      pushHistory();
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
      ctx?.drawImage(img, 0, 0);
    };
    img.src = photo.url;
  }

  function handleCanvasMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
    const { x, y } = toImageCoords(e);
    if (pickMode) {
      sourcePointRef.current = { x, y };
      setHasSource(true);
      setPickMode(false);
      return;
    }
    if (!sourcePointRef.current) {
      setErrorMsg('먼저 "복제할 부분 선택"을 눌러 깨끗한 부분을 한 번 클릭해주세요.');
      return;
    }
    setErrorMsg('');
    const canvas = canvasRef.current!;
    // 획을 시작할 때 원본 스냅샷을 떠서, 같은 획 안에서 방금 칠한 부분을 또 복제해 얼룩지는 것을 방지
    const snap = document.createElement('canvas');
    snap.width = canvas.width;
    snap.height = canvas.height;
    snap.getContext('2d')?.drawImage(canvas, 0, 0);
    strokeSourceCanvasRef.current = snap;
    offsetRef.current = { dx: x - sourcePointRef.current.x, dy: y - sourcePointRef.current.y };
    pushHistory();
    paintingRef.current = true;
    paintAt(x, y);
  }

  function handleCanvasMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!paintingRef.current) return;
    const { x, y } = toImageCoords(e);
    paintAt(x, y);
  }

  function stopPainting() {
    paintingRef.current = false;
    offsetRef.current = null;
  }

  function paintAt(x: number, y: number) {
    const canvas = canvasRef.current;
    const src = strokeSourceCanvasRef.current;
    const offset = offsetRef.current;
    if (!canvas || !src || !offset) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const sx = x - offset.dx;
    const sy = y - offset.dy;
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, brushSize / 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(
      src,
      sx - brushSize / 2,
      sy - brushSize / 2,
      brushSize,
      brushSize,
      x - brushSize / 2,
      y - brushSize / 2,
      brushSize,
      brushSize
    );
    ctx.restore();
  }

  async function save() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setSaving(true);
    setErrorMsg('');
    try {
      const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
      if (!blob) {
        setErrorMsg('이미지 저장에 실패했습니다.');
        return;
      }
      const file = new File([blob], (photo.filename ?? 'photo') + '-edited.jpg', { type: 'image/jpeg' });
      const form = new FormData();
      form.append('file', file);
      const uploadRes = await fetch('/api/upload', { method: 'POST', body: form });
      const uploadData = await uploadRes.json();
      if (!uploadRes.ok) {
        setErrorMsg(uploadData.error ?? '업로드에 실패했습니다.');
        return;
      }
      // 같은 Photo 레코드의 url만 편집본으로 교체 — 캡션·해시태그는 그대로 유지됨 (2026-09-12)
      const patchRes = await fetch(`/api/photos/${photo.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: uploadData.url }),
      });
      const patchData = await patchRes.json();
      if (!patchRes.ok) {
        setErrorMsg(patchData.error ?? '사진 정보 갱신에 실패했습니다.');
        return;
      }
      onSaved(patchData);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60] p-4"
      onClick={(e) => {
        e.stopPropagation(); // 갤러리 모달 배경 클릭(onClose)까지 겹쳐 닫히지 않도록 여기서 전파를 막음
        onClose();
      }}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-bold text-gray-900">워터마크·불필요한 부분 지우기</h3>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">
            ✕
          </button>
        </div>

        <div className="p-4 border-b border-gray-100 bg-gray-50 space-y-2">
          <p className="text-xs text-gray-500 leading-relaxed">
            ① &quot;복제할 부분 선택&quot;을 누른 뒤 사진에서 깨끗한 부분을 한 번 클릭하세요. ② 그다음 워터마크가 있는
            곳을 드래그해서 칠하면, 방금 선택한 부분이 복사되어 덮입니다.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setPickMode((v) => !v)}
              className={`text-xs font-bold rounded-full px-3 py-1.5 border ${
                pickMode ? 'bg-brand text-white border-brand' : 'bg-white text-gray-600 border-gray-200 hover:border-brand'
              }`}
            >
              {pickMode ? '사진에서 클릭해 지정…' : hasSource ? '① 복제할 부분 다시 선택' : '① 복제할 부분 선택'}
            </button>
            <label className="flex items-center gap-1.5 text-xs text-gray-500">
              붓 크기
              <input
                type="range"
                min={10}
                max={120}
                value={brushSize}
                onChange={(e) => setBrushSize(Number(e.target.value))}
                className="align-middle"
              />
            </label>
            <button
              type="button"
              disabled={!canUndo}
              onClick={undo}
              className="text-xs font-bold text-gray-500 border border-gray-200 rounded-full px-3 py-1.5 disabled:opacity-40"
            >
              ↩ 실행취소
            </button>
            <button
              type="button"
              onClick={resetToOriginal}
              className="text-xs font-bold text-gray-500 border border-gray-200 rounded-full px-3 py-1.5"
            >
              처음으로 초기화
            </button>
          </div>
          {errorMsg && <p className="text-red-600 text-xs">{errorMsg}</p>}
        </div>

        <div className="p-4 overflow-auto flex-1 flex items-center justify-center bg-gray-100">
          {!loaded && <p className="text-sm text-gray-400">불러오는 중…</p>}
          <canvas
            ref={canvasRef}
            style={{
              width: canvasRef.current ? canvasRef.current.width * scale : undefined,
              height: canvasRef.current ? canvasRef.current.height * scale : undefined,
              cursor: pickMode ? 'crosshair' : 'cell',
            }}
            className="rounded-lg shadow-sm bg-white"
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={stopPainting}
            onMouseLeave={stopPainting}
          />
        </div>

        <div className="p-4 border-t border-gray-100 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="text-sm font-bold text-gray-500 border border-gray-200 rounded-full px-4 py-2"
          >
            취소
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={save}
            className="text-sm font-bold text-white bg-brand rounded-full px-5 py-2 disabled:opacity-50"
          >
            {saving ? '저장 중…' : '편집본으로 저장'}
          </button>
        </div>
      </div>
    </div>
  );
}
