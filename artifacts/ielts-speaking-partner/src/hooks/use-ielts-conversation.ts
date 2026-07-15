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
export type MockStage = 'part1' | 'part2-prep' | 'part2-speaking' | 'part3' | null;

export type DisplayMessage = GeminiChatMessage & {
  /** Grammar/word-choice correction for this turn (assistant messages only). Display-only, never spoken aloud. */
  correction?: string;
  /** Higher band-score phrasing suggestion for this turn (assistant messages only). Display-only, never spoken aloud. */
  bandUpgrade?: string;
  /** Estimated IELTS band scores for the student's turn that preceded this assistant reply. */
  bandScores?: BandScoreBreakdown;
  /** Vocabulary upgrade suggestions for the student's turn that preceded this assistant reply. */
  vocabularyUpgrades?: VocabularyUpgrade[];
  /** Filler words detected in this user message's transcript. */
  fillerWords?: FillerWordHit[];
  /** Object URL for this user message's recorded audio, for self-playback. */
  audioUrl?: string;
  /** True for locally-injected mock-test stage messages (cue card/part transitions) that never go through the AI. */
  isMockTransition?: boolean;
};

export interface MockTimerInfo {
  label: string;
  secondsRemaining: number;
  totalSeconds: number;
}

export function useIeltsConversation() {
  const [state, setState] = useState<ConversationState>('gate');
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [hasSpeechSupport, setHasSpeechSupport] = useState<boolean>(true);
  const [mode, setMode] = useState<ConversationMode>('practice');
  const [freePracticeTopic, setFreePracticeTopic] = useState<string | undefined>(undefined);
  const [mockStage, setMockStage] = useState<MockStage>(null);
  const [currentCueCard, setCurrentCueCard] = useState<CueCard | null>(null);
  const [timer, setTimer] = useState<MockTimerInfo | null>(null);

  const recognitionRef = useRef<any>(null);
  // Accumulates every "final" result the recognizer emits while continuous
  // listening is active, so a brief pause/breath never cuts the user off —
  // the message is only sent once they explicitly stop (or the browser
  // eventually ends the session), whichever comes first.
  //
  // Stored as an array keyed by the SpeechRecognition result index (not a
  // concatenated string) because some browsers re-fire `onresult` for
  // result indices that were already marked final (e.g. after an internal
  // network hiccup/restart in continuous mode). Concatenating on every
  // event caused words to be appended again each time the same index was
  // re-emitted, producing duplicated text like "I I want I want to...".
  // Writing into a fixed slot per index makes re-emission an overwrite
  // instead of a duplicate append.
  const finalResultsRef = useRef<string[]>([]);
  const isListeningRef = useRef(false);
  // Set to true only when the USER explicitly taps the stop button (or a
  // mock-test timer expires). Stays false when the browser auto-stops
  // continuous recognition after a brief silence. onend checks this flag
  // to decide whether to restart (browser stop) or submit (user stop).
  const userStoppedRef = useRef(false);

  const sendGeminiChatMessage = useSendGeminiChatMessage();

  // Keep a live ref to the latest sendGeminiChatMessage so the onend
  // closure (set once in useEffect) always calls the up-to-date mutation.
  const sendGeminiChatMessageRef = useRef(sendGeminiChatMessage);
  sendGeminiChatMessageRef.current = sendGeminiChatMessage;

  // Keep a live ref to the latest freePracticeTopic for the same reason.
  const freePracticeTopicRef = useRef(freePracticeTopic);
  freePracticeTopicRef.current = freePracticeTopic;

  // Keep a live ref to the latest messages for setMessages-in-mutate calls.
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  // --- Audio recording (self-playback) ---------------------------------
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // --- Mock test timer ---------------------------------------------------
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearMockTimer = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    setTimer(null);
  };

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setHasSpeechSupport(false);
    } else {
      const recognition = new SpeechRecognition();
      // continuous=true stops the browser from auto-ending the session on
      // the first short pause, giving the user ample time to complete full
      // sentences — it now only submits when they explicitly tap "done".
      recognition.continuous = true;
      // Interim (in-progress, not-yet-final) results are disabled entirely.
      // Android Chrome in particular is known to re-fire "final" results for
      // words it already reported as interim, which produced doubled text
      // like "hello hello" even though our onresult handler only recorded
      // isFinal results. Turning interim results off avoids that class of
      // duplicate finalization altogether.
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onresult = (event: any) => {
        // Only iterate from resultIndex onward (results before it were
        // already handled by a previous event), but write each final
        // transcript into its own index slot rather than appending — if
        // the browser re-emits an index we've already stored, this simply
        // replaces that slot's text instead of duplicating it.
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) {
            finalResultsRef.current[i] = result[0].transcript;
          }
        }
      };

      recognition.onerror = (event: any) => {
        if (event.error === 'not-allowed') {
          isListeningRef.current = false;
          userStoppedRef.current = false;
          finalResultsRef.current = [];
          discardAudioRecording();
          setError('Microphone access was denied. Please allow it in your browser settings and reload the page.');
          setState('idle');
        } else if (event.error === 'audio-capture') {
          // audio-capture is a transient OS-level failure (screen lock, another
          // app grabbing the mic, Android permission timing glitch). It is NOT
          // a permanent denial, so we don't show the blocking red error card.
          // Instead: reset state so the UI unlocks, release the cached
          // MediaStream after 1 s (gives the OS time to free the hardware),
          // and show a non-blocking toast so the user can just tap again.
          isListeningRef.current = false;
          userStoppedRef.current = false;
          finalResultsRef.current = [];
          discardAudioRecording();
          setState('idle');
          setTimeout(() => {
            mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
            mediaStreamRef.current = null;
          }, 1000);
          toast.warning(
            'Microphone temporarily unavailable. Tap the mic to try again.',
            { duration: 4000 }
          );
        } else if (event.error !== 'aborted' && event.error !== 'no-speech') {
          // 'no-speech' and 'aborted' are common during natural pauses in
          // continuous mode — let onend decide whether to restart or submit
          // instead of surfacing a scary error.
          isListeningRef.current = false;
          userStoppedRef.current = false;
          finalResultsRef.current = [];
          discardAudioRecording();
          setError(`Microphone error: ${event.error}`);
          setState('idle');
        }
        // For no-speech / aborted: do nothing here — onend will handle it.
      };

      recognition.onend = () => {
        // Ignore if we're not supposed to be listening (e.g. already handled
        // by an error callback, or recognition was aborted externally).
        if (!isListeningRef.current) return;

        // If the browser auto-stopped continuous recognition (a brief silence
        // or an internal network hiccup) and the USER has NOT explicitly
        // tapped "done", restart immediately so the user keeps speaking
        // without noticing any interruption.
        if (!userStoppedRef.current) {
          try {
            recognition.start();
            // Resumed — don't submit yet; keep accumulating speech.
            return;
          } catch {
            // Can't restart (e.g. permission revoked mid-session).
            // Fall through and submit whatever was already captured.
          }
        }

        // User explicitly stopped (or restart failed). Submit the transcript.
        userStoppedRef.current = false;
        isListeningRef.current = false;
        // Join in index order, skipping any empty (non-final/never-set)
        // slots, so the final transcript reflects each spoken segment once.
        const transcript = finalResultsRef.current.filter(Boolean).join(' ').trim();
        finalResultsRef.current = [];
        stopAudioRecording().then((audioUrl) => {
          if (transcript) {
            handleUserMessageViaRef(transcript, audioUrl);
          } else {
            discardAudioUrl(audioUrl);
            setState('idle');
            toast.info("Didn't catch that — please tap the mic and try again.", { duration: 3000 });
          }
        });
      };

      recognitionRef.current = recognition;
    }

    const loadVoices = () => {
      window.speechSynthesis.getVoices();
    };
    window.speechSynthesis.onvoiceschanged = loadVoices;
    loadVoices();

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
      window.speechSynthesis.cancel();
      clearMockTimer();
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  // Ranked by how natural/human they tend to sound, best first. Cloud-backed
  // voices (Google's, and non-"local" voices in general) are consistently
  // less robotic than default OS/local TTS voices.
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

  const pickVoice = (voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | undefined => {
    const englishVoices = voices.filter(v => v.lang.toLowerCase().startsWith('en'));
    if (englishVoices.length === 0) return undefined;

    for (const name of PREFERRED_VOICE_NAMES) {
      const match = englishVoices.find(v => v.name.includes(name));
      if (match) return match;
    }
    // Fall back to any non-local (cloud/network) English voice — these are
    // almost always higher quality than the default local synthesizer.
    const networkVoice = englishVoices.find(v => v.localService === false);
    return networkVoice || englishVoices[0];
  };

  const speak = (text: string, onEnd: () => void) => {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    // Slightly below natural pace and a neutral pitch reads as a calm human
    // examiner rather than a robotic synthesizer.
    utterance.rate = 0.95;
    utterance.pitch = 1.0;
    const voice = pickVoice(window.speechSynthesis.getVoices());
    if (voice) utterance.voice = voice;
    utterance.onend = onEnd;
    utterance.onerror = onEnd;
    window.speechSynthesis.speak(utterance);
  };

  // --- Audio recording helpers -------------------------------------------

  async function ensureMediaStream(): Promise<MediaStream | null> {
    if (mediaStreamRef.current) return mediaStreamRef.current;
    if (!navigator.mediaDevices?.getUserMedia) return null;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      return stream;
    } catch {
      return null;
    }
  }

  async function startAudioRecording() {
    const stream = await ensureMediaStream();
    if (!stream || typeof MediaRecorder === 'undefined') return;
    try {
      audioChunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
    } catch {
      mediaRecorderRef.current = null;
    }
  }

  function stopAudioRecording(): Promise<string | undefined> {
    return new Promise((resolve) => {
      const recorder = mediaRecorderRef.current;
      if (!recorder || recorder.state === 'inactive') {
        resolve(undefined);
        return;
      }
      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        audioChunksRef.current = [];
        mediaRecorderRef.current = null;
        resolve(blob.size > 0 ? URL.createObjectURL(blob) : undefined);
      };
      recorder.stop();
    });
  }

  function discardAudioUrl(url: string | undefined) {
    if (url) URL.revokeObjectURL(url);
  }

  function discardAudioRecording() {
    stopAudioRecording().then(discardAudioUrl);
  }

  const handleUserMessage = (text: string, audioUrl?: string) => {
    window.speechSynthesis.cancel();
    if (recognitionRef.current) recognitionRef.current.abort();

    const fillerWords = detectFillerWords(text);
    // Read topic from ref so this always uses the latest value even when
    // called from the stale onend closure.
    const topic = freePracticeTopicRef.current;

    setMessages(prev => {
      const newMessages: DisplayMessage[] = [
        ...prev,
        { role: 'user', content: text, fillerWords: fillerWords.length > 0 ? fillerWords : undefined, audioUrl },
      ];

      // Only send role/content history to the API — coaching fields are
      // display-only and shouldn't be replayed back into the conversation
      // context, and neither should locally-injected mock-stage messages.
      const history: GeminiChatMessage[] = newMessages
        .filter((m) => !m.isMockTransition)
        .map(({ role, content }) => ({ role, content }));

      setState('thinking');
      // Use the ref to always call the latest mutation object, not the
      // stale one captured when the onend closure was first created.
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
            // Only the short conversational reply is spoken aloud; the
            // coaching feedback is shown in the transcript instead.
            speak(res.reply, () => {
              setState('idle');
            });
          },
          onError: () => {
            setError('Failed to get response from the examiner. Please try again.');
            setState('idle');
          }
        }
      );
      return newMessages;
    });
  };

  // Stable indirection so that the onend closure (set once in useEffect)
  // always calls the latest version of handleUserMessage.
  const handleUserMessageRef = useRef(handleUserMessage);
  handleUserMessageRef.current = handleUserMessage;

  const handleUserMessageViaRef = (text: string, audioUrl?: string) => {
    handleUserMessageRef.current(text, audioUrl);
  };

  const startPractice = (selectedMode: ConversationMode = 'practice', topicId?: string) => {
    setError(null);
    setMode(selectedMode);

    if (selectedMode === 'mock') {
      setFreePracticeTopic(undefined);
      freePracticeTopicRef.current = undefined;
      setMockStage('part1');
      setCurrentCueCard(null);
      const openingLine = `${PART1_INTRO} ${PART1_OPENING_QUESTION}`;
      setMessages([{ role: 'assistant', content: openingLine }]);
      setState('speaking');
      speak(openingLine, () => setState('idle'));
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
      // Mark as user-initiated stop so onend submits instead of restarting.
      userStoppedRef.current = true;
      // stop() lets the recognizer flush its final result, then onend
      // submits whatever was accumulated.
      recognitionRef.current?.stop();
    } else if (state === 'speaking' || state === 'idle') {
      if (state === 'speaking') {
        window.speechSynthesis.cancel();
      }
      setError(null);
      finalResultsRef.current = [];
      userStoppedRef.current = false;
      isListeningRef.current = true;
      setState('listening');
      startAudioRecording();
      try {
        recognitionRef.current?.start();
      } catch (e) {
        isListeningRef.current = false;
        setState('idle');
        toast.error('Could not start microphone. Please check your browser permissions.', { duration: 4000 });
      }
    }
  };

  const resetConversation = () => {
    window.speechSynthesis.cancel();
    isListeningRef.current = false;
    userStoppedRef.current = false;
    finalResultsRef.current = [];
    if (recognitionRef.current) recognitionRef.current.abort();
    clearMockTimer();
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;
    setMessages([]);
    setState('gate');
    setMockStage(null);
    setCurrentCueCard(null);
    setFreePracticeTopic(undefined);
    freePracticeTopicRef.current = undefined;
    setError(null);
  };

  const submitText = (text: string) => {
    handleUserMessage(text);
  };

  const retryLastUserMessage = () => {
    if (messages.length > 0 && messages[messages.length - 1].role === 'user') {
      const lastMsg = messages[messages.length - 1];
      setMessages(prev => prev.slice(0, -1));
      handleUserMessage(lastMsg.content, lastMsg.audioUrl);
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
    window.speechSynthesis.cancel();
    const cueCard = pickRandomCueCard();
    setCurrentCueCard(cueCard);
    setMockStage('part2-prep');
    const message = formatCueCardMessage(cueCard);
    setMessages(prev => [...prev, { role: 'assistant', content: message, isMockTransition: true }]);
    setState('speaking');
    speak(message, () => {
      setState('idle');
      runCountdown(PART2_PREP_SECONDS, 'Preparation time', () => {
        beginPart2Speaking();
      });
    });
  };

  const beginPart2Speaking = () => {
    setMockStage('part2-speaking');
    setError(null);
    finalResultsRef.current = [];
    userStoppedRef.current = false;
    isListeningRef.current = true;
    setState('listening');
    startAudioRecording();
    try {
      recognitionRef.current?.start();
    } catch {
      isListeningRef.current = false;
      setState('idle');
    }
    runCountdown(PART2_SPEAKING_SECONDS, 'Speaking time', () => {
      // Timer-initiated stop — treat the same as a user stop so onend submits.
      userStoppedRef.current = true;
      recognitionRef.current?.stop();
    });
  };

  const advanceToPart3 = () => {
    if (!currentCueCard) return;
    window.speechSynthesis.cancel();
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
    hasSpeechSupport,
    mode,
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
