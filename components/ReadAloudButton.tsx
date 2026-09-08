'use client';

import { useEffect, useRef, useState } from 'react';

// 기사 읽어주기 — 브라우저 내장 음성합성(Web Speech API) 사용.
// 실제 기자 음성 클로닝 대신, 계정 성별값(gender)으로 남성/여성 음성 중 가까운 걸 자동 매칭.
// 배속조절은 스펙상 불필요하므로 제공하지 않음.
export default function ReadAloudButton({ text, gender }: { text: string; gender?: string | null }) {
  const [supported, setSupported] = useState(true);
  const [speaking, setSpeaking] = useState(false);
  const utterRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      setSupported(false);
    }
    return () => {
      window.speechSynthesis?.cancel();
    };
  }, []);

  function pickVoice(): SpeechSynthesisVoice | undefined {
    const voices = window.speechSynthesis.getVoices();
    const korean = voices.filter((v) => v.lang?.toLowerCase().startsWith('ko'));
    const pool = korean.length > 0 ? korean : voices;
    if (gender === 'FEMALE') {
      return pool.find((v) => /female|여성|여자/i.test(v.name)) ?? pool[0];
    }
    if (gender === 'MALE') {
      return pool.find((v) => /male|남성|남자/i.test(v.name) && !/female/i.test(v.name)) ?? pool[0];
    }
    return pool[0];
  }

  function toggle() {
    if (!supported) return;
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = 'ko-KR';
    const voice = pickVoice();
    if (voice) utter.voice = voice;
    utter.onend = () => setSpeaking(false);
    utter.onerror = () => setSpeaking(false);
    utterRef.current = utter;
    window.speechSynthesis.speak(utter);
    setSpeaking(true);
  }

  if (!supported) return null;

  return (
    <button
      onClick={toggle}
      className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 border border-gray-200 rounded-full px-3 py-1.5 hover:border-brand hover:text-brand"
    >
      {speaking ? '■ 정지' : '🔊 기사 읽어주기'}
    </button>
  );
}
