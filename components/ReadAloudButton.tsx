'use client';

import { useEffect, useRef, useState } from 'react';
import { VolumeIcon, VolumeOffIcon } from './icons';

// 기사 읽어주기 — Google Cloud TTS(신경망 한국어 음성)로 서버에서 미리 만들어둔 오디오 파일을 재생.
// 기사당 최초 1회만 생성되고(app/api/articles/[id]/audio) 이후엔 캐시된 파일을 그대로 재생함.
// 만약 서버 쪽 생성이 실패하면(GOOGLE_TTS_API_KEY 미설정, 무료 한도 초과 등) 예전 방식이던
// 브라우저 내장 음성합성(Web Speech API)으로 자동 대체되어 기능 자체는 항상 동작함 (2026-09-12 개편).
// 재생 버튼을 누를 때마다 남성/여성 목소리를 무작위로 고른다.
export default function ReadAloudButton({
  articleId,
  text,
}: {
  articleId: string;
  text: string;
}) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'playing'>('idle');
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const voiceGenderRef = useRef<'MALE' | 'FEMALE'>('FEMALE');
  // 재생 시도마다 1씩 증가하는 토큰 — 정지/재요청이 일어나면 이전 토큰은 더 이상 유효하지 않은 것으로 취급해서
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
    if (voiceGenderRef.current === 'FEMALE') return pool.find((v) => /female|여성|여자/i.test(v.name)) ?? pool[0];
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
    const myToken = ++playTokenRef.current;
    voiceGenderRef.current = Math.random() < 0.5 ? 'MALE' : 'FEMALE';
    setStatus('loading');
    try {
      const res = await fetch(`/api/articles/${articleId}/audio?gender=${voiceGenderRef.current}`);
      if (myToken !== playTokenRef.current) return;
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
        audio.pause();
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

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={status === 'loading'}
      title={status === 'playing' ? '정지' : '읽어주기'}
      className="icon-action"
    >
      {status === 'playing' ? <VolumeOffIcon /> : <VolumeIcon />}
    </button>
  );
}
