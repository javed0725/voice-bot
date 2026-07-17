import { useState, useRef, useCallback } from 'react';
import type { GermanDay } from '@/data/german-curriculum';
import { toast } from 'sonner';

export type SessionPhase = 'study' | 'test';
export type SessionState = 'idle' | 'listening' | 'thinking' | 'speaking';

export interface GermanMessage {
  role: 'user' | 'assistant';
  content: string;
  audioUrl?: string;
  correction?: string;
  bandUpgrade?: string;
  vocabularyUpgrades?: Array<{ original: string; upgrade: string }>;
  isTransition?: boolean;
}

interface GeminiDayResponse {
  reply: string;
  correction: string;
  bandUpgrade: string;
  bandScores: { fluency: number; lexicalResource: number; grammaticalRange: number; pronunciation: number; overall: number };
  vocabularyUpgrades: Array<{ original: string; upgrade: string }>;
  transitionToTest: boolean;
  testResult: 'pass' | 'fail' | null;
}

const ELEVENLABS_VOICE_ID = 'ErXwobaYiN019PkySvjV'; // Antoni

const BASE = () =>
  (typeof import.meta !== 'undefined' ? (import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '' : '').replace(/\/$/, '');

export function useGermanSession(day: GermanDay) {
  const [state, setState] = useState<SessionState>('idle');
  const [phase, setPhase] = useState<SessionPhase>('study');
  const [messages, setMessages] = useState<GermanMessage[]>([]);
  const [testResult, setTestResult] = useState<'pass' | 'fail' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasMicSupport, setHasMicSupport] = useState(true);
  const [isTransitioningToTest, setIsTransitioningToTest] = useState(false);

  const phaseRef = useRef<SessionPhase>('study');
  const isListeningRef = useRef(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const finishListeningRef = useRef<() => void>(() => {});
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const messagesRef = useRef<GermanMessage[]>([]);

  // Keep messagesRef in sync
  const setMessagesSync = (updater: (prev: GermanMessage[]) => GermanMessage[]) => {
    setMessages(prev => {
      const next = updater(prev);
      messagesRef.current = next;
      return next;
    });
  };

  // ── TTS ─────────────────────────────────────────────────────────────────

  const stopSpeaking = useCallback(() => {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current.src = '';
      currentAudioRef.current = null;
    }
  }, []);

  const speak = useCallback(async (text: string, onDone?: () => void) => {
    stopSpeaking();
    try {
      const res = await fetch(`${BASE()}/api/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voiceId: ELEVENLABS_VOICE_ID }),
      });
      if (!res.ok) throw new Error('TTS failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      currentAudioRef.current = audio;
      audio.onended = () => {
        URL.revokeObjectURL(url);
        currentAudioRef.current = null;
        onDone?.();
      };
      audio.onerror = () => {
        URL.revokeObjectURL(url);
        currentAudioRef.current = null;
        onDone?.();
      };
      await audio.play();
    } catch {
      // Fallback to Web Speech API
      if ('speechSynthesis' in window) {
        const utt = new SpeechSynthesisUtterance(text);
        utt.lang = 'de-DE';
        utt.onend = () => onDone?.();
        window.speechSynthesis.speak(utt);
      } else {
        onDone?.();
      }
    }
  }, [stopSpeaking]);

  // ── Audio recording ──────────────────────────────────────────────────────

  const startAudioRecording = useCallback(async () => {
    audioChunksRef.current = [];
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaStreamRef.current = stream;

    const mr = new MediaRecorder(stream, { mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/ogg' });
    mediaRecorderRef.current = mr;

    mr.ondataavailable = e => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };

    const finish = () => new Promise<{ blob: Blob; url: string }>(resolve => {
      mr.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: mr.mimeType });
        resolve({ blob, url: URL.createObjectURL(blob) });
      };
      if (mr.state !== 'inactive') mr.stop();
      stream.getTracks().forEach(t => t.stop());
    });

    finishListeningRef.current = async () => {
      if (!isListeningRef.current) return;
      isListeningRef.current = false;
      setState('thinking');
      const { blob, url } = await finish();
      await handleAudioComplete(blob, url);
    };

    mr.start();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Transcribe ───────────────────────────────────────────────────────────

  const transcribeAudio = useCallback(async (blob: Blob): Promise<string> => {
    // Convert blob to base64 so the JSON API handler can read it correctly
    // (FormData with raw Blob is not what the Vercel handler expects).
    const arrayBuffer = await blob.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
    const base64 = btoa(binary);

    const rawMime = blob.type || 'audio/webm';
    // Strip codec params: "audio/webm;codecs=opus" → "audio/webm"
    const mimeType = rawMime.split(';')[0].trim();

    const res = await fetch(`${BASE()}/api/transcribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ audio: base64, mimeType, language: 'de' }),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => '(no body)');
      console.error('[german-transcribe] HTTP', res.status, errText);
      throw new Error(`Transcription failed (${res.status})`);
    }
    const data = await res.json() as { transcript?: string };
    return data.transcript ?? '';
  }, []);

  // ── Gemini API call ──────────────────────────────────────────────────────

  const callGemini = useCallback(async (history: GermanMessage[], currentPhase: SessionPhase): Promise<GeminiDayResponse> => {
    // Gemini requires at least one message; bootstrap with a silent kick-off when history is empty
    const apiMessages = history.length === 0
      ? [{ role: 'user', content: 'Begin the lesson.' }]
      : history.map(m => ({ role: m.role, content: m.content }));
    const res = await fetch(`${BASE()}/api/gemini/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: apiMessages,
        topic: '__german_day__',
        dayId: day.id,
        phase: currentPhase,
      }),
    });
    if (!res.ok) throw new Error(`Gemini API error: ${res.status}`);
    return res.json() as Promise<GeminiDayResponse>;
  }, [day.id]);

  // ── Handle a completed response from Gemini ──────────────────────────────

  const handleGeminiResponse = useCallback(async (data: GeminiDayResponse, currentPhase: SessionPhase) => {
    const assistantMsg: GermanMessage = {
      role: 'assistant',
      content: data.reply,
      correction: data.correction,
      bandUpgrade: data.bandUpgrade,
      vocabularyUpgrades: data.vocabularyUpgrades,
    };

    if (data.transitionToTest && currentPhase === 'study') {
      // Animate the transition
      assistantMsg.isTransition = true;
      setMessagesSync(prev => [...prev, assistantMsg]);
      setIsTransitioningToTest(true);
      setState('speaking');

      await new Promise<void>(resolve => speak(data.reply, resolve));

      // Brief pause then switch phase
      await new Promise(r => setTimeout(r, 1200));
      setIsTransitioningToTest(false);
      setPhase('test');
      phaseRef.current = 'test';
      setState('idle');
      return;
    }

    if (data.testResult !== null && currentPhase === 'test') {
      setMessagesSync(prev => [...prev, assistantMsg]);
      setTestResult(data.testResult);
      setState('speaking');
      speak(data.reply, () => setState('idle'));
      return;
    }

    setMessagesSync(prev => [...prev, assistantMsg]);
    setState('speaking');
    speak(data.reply, () => setState('idle'));
  }, [speak]);

  // ── Core message handler ──────────────────────────────────────────────────

  const handleUserMessage = useCallback(async (text: string, audioUrl?: string) => {
    const userMsg: GermanMessage = { role: 'user', content: text, audioUrl };
    const currentPhase = phaseRef.current;
    setMessagesSync(prev => [...prev, userMsg]);
    setState('thinking');
    setError(null);

    try {
      const history = [...messagesRef.current];
      const data = await callGemini(history, currentPhase);
      await handleGeminiResponse(data, currentPhase);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Try again.');
      setState('idle');
    }
  }, [callGemini, handleGeminiResponse]);

  // ── Handle audio complete ─────────────────────────────────────────────────

  const handleAudioComplete = useCallback(async (blob: Blob, audioUrl: string) => {
    try {
      const transcript = await transcribeAudio(blob);
      if (!transcript.trim()) {
        setState('idle');
        toast.error("Couldn't hear that clearly. Try speaking again.");
        return;
      }
      await handleUserMessage(transcript, audioUrl);
    } catch {
      setError('Transcription failed. Try again or use text input.');
      setState('idle');
    }
  }, [transcribeAudio, handleUserMessage]);

  // ── Public controls ───────────────────────────────────────────────────────

  const startSession = useCallback(async () => {
    setError(null);
    setState('thinking');
    phaseRef.current = 'study';
    setPhase('study');
    setTestResult(null);
    setIsTransitioningToTest(false);
    messagesRef.current = [];
    setMessages([]);

    try {
      const data = await callGemini([], 'study');
      const openingMsg: GermanMessage = {
        role: 'assistant',
        content: data.reply,
        vocabularyUpgrades: data.vocabularyUpgrades,
      };
      messagesRef.current = [openingMsg];
      setMessages([openingMsg]);
      setState('speaking');
      speak(data.reply, () => setState('idle'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start session.');
      setState('idle');
    }
  }, [callGemini, speak]);

  const toggleListening = useCallback(() => {
    if (state === 'listening') {
      finishListeningRef.current();
    } else if (state === 'idle' || state === 'speaking') {
      if (state === 'speaking') stopSpeaking();
      setError(null);
      isListeningRef.current = true;
      setState('listening');
      startAudioRecording().catch(() => {
        isListeningRef.current = false;
        setState('idle');
        setHasMicSupport(false);
        toast.error('Could not access microphone. Use the text input below.', { duration: 5000 });
      });
    }
  }, [state, stopSpeaking, startAudioRecording]);

  const submitText = useCallback((text: string) => {
    if (testResult !== null) return; // session over
    handleUserMessage(text);
  }, [handleUserMessage, testResult]);

  const cleanup = useCallback(() => {
    stopSpeaking();
    isListeningRef.current = false;
    if (mediaRecorderRef.current?.state !== 'inactive') mediaRecorderRef.current?.stop();
    mediaStreamRef.current?.getTracks().forEach(t => t.stop());
    mediaStreamRef.current = null;
  }, [stopSpeaking]);

  return {
    state,
    phase,
    messages,
    testResult,
    error,
    hasMicSupport,
    isTransitioningToTest,
    startSession,
    toggleListening,
    submitText,
    stopSpeaking,
    cleanup,
    clearError: () => setError(null),
  };
}
