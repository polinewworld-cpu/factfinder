// 배너 영상(2026-10-10): 사이트 안 주소(/ads/…) 또는 http(s) 주소만, 버튼 문구는 40자까지
export const cleanVideo = (v: unknown) => (typeof v === 'string' && /^(\/(?!\/)|https?:\/\/)/.test(v.trim()) ? v.trim().slice(0, 500) : null);
export const cleanLabel = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, 40) : null);
