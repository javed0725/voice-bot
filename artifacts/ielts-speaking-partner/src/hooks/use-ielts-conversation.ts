import { useState, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import { useSendGeminiChatMessage } from '@workspace/api-client-react';
import type { GeminiChatMessage, GeminiChatOutput, BandScoreBreakdown, VocabularyUpgrade } from '@workspace/api-client-react';
import { detectFillerWords, type FillerWordHit } from '@/lib/filler-words';
import {
  CueCard,
  PART1_INTRO,
  PART1_OPENING_QUESTION,
  PART2_PREP_SECONDS,
  PART2_SPEAKING_SECONDS,
  formatCueCardMessage,
  formatPart3Message,
  pickRandomCueCard,
} from '@/lib/mock-test-bank';
import { getFreePracticeTopic } from '@/lib/free-practice-topics';

export type ConversationState = 'gate' | 'idle' | 'listening' | 'thinking' | 'speaking';
export type ConversationMode = 'practice' | 'mock';
export type AppMode = 'ielts' | 'german';
export type MockStage = 'part1' | 'part2-prep' | 'part2-speaking' | 'part3' | null;

export type DisplayMessage = GeminiChatMessage & {
  correction?: string;
  bandUpgrade?: string;
  bandScores?: BandScoreBreakdown;
  vocabularyUpgrades?: VocabularyUpgrade[];
  fillerWords?: FillerWordHit[];
  audioUrl?: string;
  isMockTransition?: boolean;
};

export interface MockTimerInfo {
  label: string;
  secondsRemaining: number;
  totalSeconds: number;
}

// ---------------------------------------------------------------------------
// Gemini-based audio transcription
// ---------------------------------------------------------------------------

// Strip codec parameters before sending to Gemini.
// e.g. "audio/webm;codecs=opus" → "audio/webm"
// Gemini only accepts the base MIME type without parameters.
function normaliseAudioMime(raw: string): string {
  const base = raw.split(';')[0].trim().toLowerCase();
  // Map any ogg variant to audio/ogg (Gemini-accepted)
  if (base === 'audio/ogg') return 'audio/ogg';
  if (base === 'audio/webm') return 'audio/webm';
  if (base === 'audio/mp4' || base === 'audio/x-m4a') return 'audio/mp4';
  if (base === 'audio/wav' || base === 'audio/wave') return 'audio/wav';
  // Return base as-is for anything else (aac, flac, mp3…)
  return base;
}

async function transcribeWithGemini(blob: Blob): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const dataUrl = reader.result as string;
        // dataUrl = "data:<mime>;base64,<data>"
        // Split only on the first comma — base64 payload never contains commas.
        const commaIdx = dataUrl.indexOf(',');
        if (commaIdx === -1) { reject(new Error('FileReader returned invalid data URL')); return; }
        const meta   = dataUrl.slice(0, commaIdx);          // "data:audio/webm;codecs=opus;base64"
        const base64 = dataUrl.slice(commaIdx + 1);         // actual base64 payload
        const rawMime = meta.replace('data:', '').replace(/;base64$/, '');
        const mimeType = normaliseAudioMime(rawMime);

        console.debug(`[transcribe] blob size=${blob.size}B rawMime=${rawMime} → geminiMime=${mimeType}`);

        // 58-second client-side deadline — just inside Vercel's 60 s max-duration.
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 58_000);

        let res: Response;
        try {
          res = await fetch('/api/transcribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal,
            body: JSON.stringify({ audio: base64, mimeType }),
          });
        } finally {
          clearTimeout(timer);
        }

        if (!res.ok) {
          const body = await res.text().catch(() => '');
          console.error(`[transcribe] HTTP ${res.status}:`, body);
          reject(new Error(`Transcription HTTP ${res.status}: ${body.slice(0, 120)}`));
          return;
        }
        const data = await res.json();
        resolve((data.transcript ?? '').trim());
      } catch (err: any) {
        if (err?.name === 'AbortError') {
          reject(new Error('Transcription timed out — please try a shorter recording'));
        } else {
          reject(err);
        }
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

// ---------------------------------------------------------------------------

export function useIeltsConversation() {
  const [state, setState] = useState<ConversationState>('gate');
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [hasMicSupport, setHasMicSupport] = useState<boolean>(true);
  const [mode, setMode] = useState<ConversationMode>('practice');
  const [freePracticeTopic, setFreePracticeTopic] = useState<string | undefined>(undefined);
  const [mockStage, setMockStage] = useState<MockStage>(null);
  const [currentCueCard, setCurrentCueCard] = useState<CueCard | null>(null);
  const [timer, setTimer] = useState<MockTimerInfo | null>(null);
  const [appMode, setAppMode] = useState<AppMode>('ielts');
  const appModeRef = useRef<AppMode>('ielts');

  // Keep a live ref to freePracticeTopic so stale closures always read latest
  const freePracticeTopicRef = useRef(freePracticeTopic);
  freePracticeTopicRef.current = freePracticeTopic;

  const isListeningRef = useRef(false);
  const sendGeminiChatMessage = useSendGeminiChatMessage();
  const sendGeminiChatMessageRef = useRef(sendGeminiChatMessage);
  sendGeminiChatMessageRef.current = sendGeminiChatMessage;

  // --- Audio recording ---------------------------------------------------
  const mediaStreamRef   = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef   = useRef<Blob[]>([]);
  const currentAudioRef  = useRef<HTMLAudioElement | null>(null);

  // --- Mock test timer ---------------------------------------------------
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearMockTimer = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    setTimer(null);
  };

  // Check mic support on mount
  useEffect(() => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setHasMicSupport(false);
    }
    // Pre-warm Web Speech voices for the fallback path
    const loadVoices = () => window.speechSynthesis.getVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
    loadVoices();
    return () => {
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current.src = '';
        currentAudioRef.current = null;
      }
      window.speechSynthesis.cancel();
      clearMockTimer();
      mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // --- Voice synthesis ---------------------------------------------------

  /** Stop any in-progress ElevenLabs audio (or Web Speech fallback). */
  const stopSpeaking = () => {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current.src = '';
      currentAudioRef.current = null;
    }
    window.speechSynthesis.cancel();
  };

  /** Web Speech API fallback — used when ElevenLabs is unavailable. */
  const PREFERRED_VOICE_NAMES = [
    'Google US English',
    'Google UK English Female',
    'Google UK English Male',
    'Microsoft David',
    'Microsoft Zira',
    'Microsoft Mark',
    'Samantha',
    'Daniel',
  ];
  const pickVoice = (voices: SpeechSynthesisVoice[]) => {
    const eng = voices.filter(v => v.lang.toLowerCase().startsWith('en'));
    if (!eng.length) return undefined;
    for (const name of PREFERRED_VOICE_NAMES) {
      const m = eng.find(v => v.name.includes(name));
      if (m) return m;
    }
    return eng.find(v => !v.localService) ?? eng[0];
  };
  const speakFallback = (text: string, onEnd: () => void) => {
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    utt.rate = 0.95;
    utt.pitch = 1.0;
    const voice = pickVoice(window.speechSynthesis.getVoices());
    if (voice) utt.voice = voice;
    utt.onend = onEnd;
    utt.onerror = onEnd;
    window.speechSynthesis.speak(utt);
  };

  /**
   * Speak text via ElevenLabs TTS (Rachel voice).
   * Falls back to the browser Web Speech API if the API call fails
   * (e.g. key not configured, quota exceeded, network error).
   */
  const speak = (text: string, onEnd: () => void) => {
    stopSpeaking();

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);

    fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({ text }),
    })
      .then(async (res) => {
        clearTimeout(timeout);
        if (!res.ok) {
          const detail = await res.text().catch(() => '');
          throw new Error(`TTS HTTP ${res.status}: ${detail.slice(0, 120)}`);
        }
        return res.blob();
      })
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        currentAudioRef.current = audio;
        const cleanup = () => {
          URL.revokeObjectURL(url);
          if (currentAudioRef.current === audio) currentAudioRef.current = null;
        };
        audio.onended = () => { cleanup(); onEnd(); };
        audio.onerror = () => {
          cleanup();
          console.error('[speak] ElevenLabs audio playback error — falling back to Web Speech API');
          speakFallback(text, onEnd);
        };
        audio.play().catch((err) => {
          cleanup();
          console.error('[speak] Audio.play() rejected — falling back to Web Speech API:', err);
          speakFallback(text, onEnd);
        });
      })
      .catch((err: unknown) => {
        clearTimeout(timeout);
        console.error('[speak] ElevenLabs TTS failed — falling back to Web Speech API:', err);
        speakFallback(text, onEnd);
      });
  };

  // --- Audio recording helpers -------------------------------------------

  async function ensureMediaStream(): Promise<MediaStream | null> {
    if (mediaStreamRef.current) return mediaStreamRef.current;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      return stream;
    } catch {
      return null;
    }
  }

  // Pick the most compressed MIME type supported by this browser.
  // audio/webm;codecs=opus is ~16–24 kbps for speech — much smaller than
  // the default which can be 128 kbps+ and causes slow uploads on mobile.
  function pickAudioMimeType(): string {
    const candidates = [
      'audio/webm;codecs=opus',
      'audio/ogg;codecs=opus',
      'audio/webm',
      'audio/ogg',
      'audio/mp4',
    ];
    for (const m of candidates) {
      if (MediaRecorder.isTypeSupported(m)) return m;
    }
    return ''; // let browser decide
  }

  async function startAudioRecording() {
    const stream = await ensureMediaStream();
    if (!stream) return;
    try {
      audioChunksRef.current = [];
      const mimeType = pickAudioMimeType();
      const options: MediaRecorderOptions = {
        // ~24 kbps is plenty for speech recognition; keeps blobs small
        audioBitsPerSecond: 24_000,
        ...(mimeType ? { mimeType } : {}),
      };
      const recorder = new MediaRecorder(stream, options);
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
    } catch {
      mediaRecorderRef.current = null;
    }
  }

  function stopAudioRecording(): Promise<{ blob: Blob | null; url: string | undefined }> {
    return new Promise((resolve) => {
      const recorder = mediaRecorderRef.current;
      if (!recorder || recorder.state === 'inactive') {
        resolve({ blob: null, url: undefined });
        return;
      }
      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, {
          type: recorder.mimeType || 'audio/webm',
        });
        audioChunksRef.current = [];
        mediaRecorderRef.current = null;
        const url = blob.size > 0 ? URL.createObjectURL(blob) : undefined;
        resolve({ blob: blob.size > 0 ? blob : null, url });
      };
      recorder.stop();
    });
  }

  // --- Core conversation logic -------------------------------------------

  const handleUserMessage = (text: string, audioUrl?: string) => {
    stopSpeaking();
    const fillerWords = detectFillerWords(text);
    const topic = freePracticeTopicRef.current;

    setMessages(prev => {
      const newMessages: DisplayMessage[] = [
        ...prev,
        {
          role: 'user',
          content: text,
          fillerWords: fillerWords.length > 0 ? fillerWords : undefined,
          audioUrl,
        },
      ];
      const history: GeminiChatMessage[] = newMessages
        .filter(m => !m.isMockTransition)
        .map(({ role, content }) => ({ role, content }));

      setState('thinking');
      sendGeminiChatMessageRef.current.mutate(
        { data: { messages: history, topic } },
        {
          onSuccess: (res: GeminiChatOutput) => {
            setMessages(current => [
              ...current,
              {
                role: 'assistant',
                content: res.reply,
                correction: res.correction,
                bandUpgrade: res.bandUpgrade,
                bandScores: res.bandScores,
                vocabularyUpgrades: res.vocabularyUpgrades,
              },
            ]);
            setState('speaking');
            speak(res.reply, () => setState('idle'));
          },
          onError: () => {
            setError('Failed to get a response from the examiner. Please try again.');
            setState('idle');
          },
        },
      );
      return newMessages;
    });
  };

  const handleUserMessageRef = useRef(handleUserMessage);
  handleUserMessageRef.current = handleUserMessage;

  // Called when user taps "done" or a mock timer expires.
  // Stops recording, transcribes with Gemini, submits.
  async function finishListening() {
    if (!isListeningRef.current) return;
    isListeningRef.current = false;

    const { blob, url: audioUrl } = await stopAudioRecording();

    if (!blob || blob.size < 1000) {
      // Too short to contain real speech
      setState('idle');
      toast.info("Didn't catch that — please tap the mic and try again.", { duration: 3000 });
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      return;
    }

    setState('thinking');

    try {
      const transcript = await transcribeWithGemini(blob);
      if (!transcript) {
        setState('idle');
        toast.info("Couldn't make out any words — please try again.", { duration: 3000 });
        if (audioUrl) URL.revokeObjectURL(audioUrl);
        return;
      }
      handleUserMessageRef.current(transcript, audioUrl);
    } catch {
      setState('idle');
      setError('Transcription failed. Please check your connection and try again.');
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    }
  }

  // Ref so mock-timer callback always calls the current version
  const finishListeningRef = useRef(finishListening);
  finishListeningRef.current = finishListening;

  // --- Public actions ----------------------------------------------------

  const startPractice = (selectedMode: ConversationMode = 'practice', topicId?: string, newAppMode: AppMode = 'ielts') => {
    setError(null);
    setMode(selectedMode);
    setAppMode(newAppMode);
    appModeRef.current = newAppMode;

    if (newAppMode === 'german') {
      const openingLine = "Hallo! Ich bin dein Deutschlehrer. (Hello! I'm your German Tutor!) 🇩🇪 Let's start with the very basics. Do you know how to say 'thank you' in German?";
      setFreePracticeTopic('__german_tutor__');
      freePracticeTopicRef.current = '__german_tutor__';
      setMockStage(null);
      setCurrentCueCard(null);
      setMessages([{ role: 'assistant', content: openingLine }]);
      setState('speaking');
      speak(openingLine, () => setState('idle'));
      return;
    }

    if (selectedMode === 'mock') {
      setFreePracticeTopic(undefined);
      freePracticeTopicRef.current = undefined;
      setMockStage('part1');
      setCurrentCueCard(null);
      const line = `${PART1_INTRO} ${PART1_OPENING_QUESTION}`;
      setMessages([{ role: 'assistant', content: line }]);
      setState('speaking');
      speak(line, () => setState('idle'));
      return;
    }

    const topic = getFreePracticeTopic(topicId ?? 'general');
    setFreePracticeTopic(topic.topicForApi);
    freePracticeTopicRef.current = topic.topicForApi;
    setMockStage(null);
    setCurrentCueCard(null);
    setMessages([{ role: 'assistant', content: topic.openingQuestion }]);
    setState('speaking');
    speak(topic.openingQuestion, () => setState('idle'));
  };

  const toggleListening = () => {
    if (state === 'listening') {
      // User tapped "done" — stop recording and transcribe
      finishListeningRef.current();
    } else if (state === 'speaking' || state === 'idle') {
      if (state === 'speaking') stopSpeaking();
      setError(null);
      isListeningRef.current = true;
      setState('listening');
      startAudioRecording().catch(() => {
        isListeningRef.current = false;
        setState('idle');
        setHasMicSupport(false);
        toast.error('Could not access microphone. Please use the text input below.', { duration: 5000 });
      });
    }
  };

  const resetConversation = () => {
    stopSpeaking();
    isListeningRef.current = false;
    if (mediaRecorderRef.current?.state !== 'inactive') {
      mediaRecorderRef.current?.stop();
    }
    clearMockTimer();
    mediaStreamRef.current?.getTracks().forEach(t => t.stop());
    mediaStreamRef.current = null;
    setMessages([]);
    setState('gate');
    setMockStage(null);
    setCurrentCueCard(null);
    setFreePracticeTopic(undefined);
    freePracticeTopicRef.current = undefined;
    setAppMode('ielts');
    appModeRef.current = 'ielts';
    setError(null);
  };

  const submitText = (text: string) => handleUserMessage(text);

  const retryLastUserMessage = () => {
    const last = messages[messages.length - 1];
    if (last?.role === 'user') {
      setMessages(prev => prev.slice(0, -1));
      handleUserMessage(last.content, last.audioUrl);
      setError(null);
    }
  };

  // --- Mock test stage transitions ---------------------------------------

  const runCountdown = (totalSeconds: number, label: string, onDone: () => void) => {
    clearMockTimer();
    let remaining = totalSeconds;
    setTimer({ label, secondsRemaining: remaining, totalSeconds });
    timerIntervalRef.current = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        clearMockTimer();
        onDone();
      } else {
        setTimer({ label, secondsRemaining: remaining, totalSeconds });
      }
    }, 1000);
  };

  const advanceToPart2 = () => {
    stopSpeaking();
    const cueCard = pickRandomCueCard();
    setCurrentCueCard(cueCard);
    setMockStage('part2-prep');
    const message = formatCueCardMessage(cueCard);
    setMessages(prev => [...prev, { role: 'assistant', content: message, isMockTransition: true }]);
    setState('speaking');
    speak(message, () => {
      setState('idle');
      runCountdown(PART2_PREP_SECONDS, 'Preparation time', () => beginPart2Speaking());
    });
  };

  const beginPart2Speaking = () => {
    setMockStage('part2-speaking');
    setError(null);
    isListeningRef.current = true;
    setState('listening');
    startAudioRecording();
    runCountdown(PART2_SPEAKING_SECONDS, 'Speaking time', () => {
      finishListeningRef.current();
    });
  };

  const advanceToPart3 = () => {
    if (!currentCueCard) return;
    stopSpeaking();
    setMockStage('part3');
    const message = formatPart3Message(currentCueCard);
    setMessages(prev => [...prev, { role: 'assistant', content: message, isMockTransition: true }]);
    setState('speaking');
    speak(message, () => setState('idle'));
  };

  return {
    state,
    messages,
    error,
    hasSpeechSupport: hasMicSupport,
    mode,
    appMode,
    freePracticeTopic,
    mockStage,
    currentCueCard,
    timer,
    startPractice,
    toggleListening,
    resetConversation,
    submitText,
    clearError: () => setError(null),
    retryLastUserMessage,
    advanceToPart2,
    advanceToPart3,
  };
}
