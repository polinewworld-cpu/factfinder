'use client';

import { useEffect, useRef, useState } from 'react';

// 기사 읽어주기 — Google Cloud TTS(신경망 한국어 음성)로 서버에서 미리 만들어둔 오디오 파일을 재생.
// 기사당 최초 1회만 생성되고(app/api/articles/[id]/audio) 이후엔 캐시된 파일을 그대로 재생함.
// 만약 서버 쪽 생성이 실패하면(GOOGLE_TTS_API_KEY 미설정, 무료 한도 초과 등) 예전 방식이던
// 브라우저 내장 음성합성(Web Speech API)으로 자동 대체되어 기능 자체는 항상 동작함 (2026-09-12 개편).
// 기본 목소리는 기사 작성 기자의 성별을 따르되, 옆의 토글 버튼으로 방문자가 직접 바꿔 들을 수 있음
// (기본 성별과 같을 때만 서버에 캐싱되고, 일부러 바꾼 목소리는 그때그때 새로 생성됨) (2026-09-12 신설)
//
// 버튼 2개(여성/남성) → 토글 버튼 1개로 축소 + 재생버튼 너비 고정: "읽어주기"/"정지"/"생성 중…" 상태에 따라
// 텍스트 길이가 달라지면서 액션바 줄바꿈이 널뛰던 문제를 해결 (2026-09-12).
// 성별을 바꾸거나 정지를 누르는 순간 이전 재생/생성 요청을 확실히 무효화해서, 목소리를 바꿨을 때
// 이전 목소리와 새 목소리가 겹쳐 들리던 문제도 함께 해결 (playTokenRef로 오래된 요청의 결과를 무시함).
export default function ReadAloudButton({
  articleId,
  text,
  gender,
}: {
  articleId: string;
  text: string;
  gender?: string | null;
}) {
  const defaultGender: 'MALE' | 'FEMALE' = gender === 'MALE' ? 'MALE' : 'FEMALE';
  const [voiceGender, setVoiceGender] = useState<'MALE' | 'FEMALE'>(defaultGender);
  const [status, setStatus] = useState<'idle' | 'loading' | 'playing'>('idle');
  const audioRef = useRef<HTMLAudioElement | null>(null);
  // 재생 시도마다 1씩 증가하는 토큰 — 정지/성별변경/재요청이 일어나면 이전 토큰은 더 이상 유효하지 않은 것으로 취급해서
  // 뒤늦게 도착한 응답이 소리를 내지 못하게 막음(겹쳐 들리는 문제의 원인이었음)
  const playTokenRef = useRef(0);

  useEffect(() => {
    return () => {
      playTokenRef.current += 1;
      audioRef.current?.pause();
      audioRef.current = null;
      window.speechSynthesis?.cancel();
    };
  }, []);

  function stopAll() {
    playTokenRef.current += 1;
    audioRef.current?.pause();
    audioRef.current = null;
    window.speechSynthesis?.cancel();
    setStatus('idle');
  }

  function pickFallbackVoice(): SpeechSynthesisVoice | undefined {
    const voices = window.speechSynthesis.getVoices();
    const korean = voices.filter((v) => v.lang?.toLowerCase().startsWith('ko'));
    const pool = korean.length > 0 ? korean : voices;
    if (voiceGender === 'FEMALE') return pool.find((v) => /female|여성|여자/i.test(v.name)) ?? pool[0];
    return pool.find((v) => /male|남성|남자/i.test(v.name) && !/female/i.test(v.name)) ?? pool[0];
  }

  // Google TTS 오디오를 못 쓸 때만 쓰는 예전 방식(브라우저 내장 음성합성) — 품질은 방문자 기기에 따라 다름
  function playFallback(myToken: number) {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      if (myToken === playTokenRef.current) setStatus('idle');
      return;
    }
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = 'ko-KR';
    const voice = pickFallbackVoice();
    if (voice) utter.voice = voice;
    utter.onend = () => {
      if (myToken === playTokenRef.current) setStatus('idle');
    };
    utter.onerror = () => {
      if (myToken === playTokenRef.current) setStatus('idle');
    };
    window.speechSynthesis.speak(utter);
    if (myToken === playTokenRef.current) setStatus('playing');
  }

  async function play() {
    const myToken = ++playTokenRef.current; // 새 시도 시작 — 이전에 진행 중이던 요청은 이 시점부터 무효화됨
    setStatus('loading');
    try {
      const res = await fetch(`/api/articles/${articleId}/audio?gender=${voiceGender}`);
      if (myToken !== playTokenRef.current) return; // 그 사이 정지/성별변경/재요청이 있었으면 이 결과는 버림
      if (!res.ok) throw new Error('tts generation failed');
      const data: { url: string } = await res.json();
      if (myToken !== playTokenRef.current) return;

      const audio = new Audio(data.url);
      audio.onended = () => {
        if (myToken === playTokenRef.current) setStatus('idle');
      };
      audio.onerror = () => {
        if (myToken === playTokenRef.current) setStatus('idle');
      };
      audioRef.current = audio;
      await audio.play();
      if (myToken !== playTokenRef.current) {
        audio.pause(); // await 도중에 무효화됐으면 재생을 시작하자마자 바로 멈춤
        return;
      }
      setStatus('playing');
    } catch {
      if (myToken === playTokenRef.current) playFallback(myToken);
    }
  }

  function toggle() {
    if (status === 'loading') return;
    if (status === 'playing') {
      stopAll();
      return;
    }
    play();
  }

  function toggleVoiceGender() {
    stopAll(); // 목소리를 바꾸는 순간 재생/생성 중이던 이전 목소리를 확실히 멈춤
    setVoiceGender((g) => (g === 'FEMALE' ? 'MALE' : 'FEMALE'));
  }

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={toggleVoiceGender}
        title="읽어주는 목소리 성별 전환"
        className="text-xs font-semibold rounded-full px-2.5 py-1.5 border text-gray-500 border-gray-200 hover:border-brand hover:text-brand whitespace-nowrap"
      >
        {voiceGender === 'FEMALE' ? '👩 여성' : '👨 남성'}
      </button>
      <button
        type="button"
        onClick={toggle}
        disabled={status === 'loading'}
        className="flex items-center justify-center gap-1.5 text-xs font-semibold text-gray-600 border border-gray-200 rounded-full px-3 py-1.5 hover:border-brand hover:text-brand disabled:opacity-60 whitespace-nowrap"
        style={{ minWidth: 108 }}
      >
        {status === 'playing' ? '■ 정지' : status === 'loading' ? '⏳ 생성 중…' : '🔊 읽어주기'}
      </button>
    </div>
  );
}
