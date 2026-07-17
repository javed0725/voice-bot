import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, SendHorizontal, Check, X, Loader2, BookOpen, ClipboardCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { GermanDay, GermanLevel } from '@/data/german-curriculum';
import { useGermanSession, type GermanMessage } from '@/hooks/use-german-session';
import { MicButton } from '@/components/mic-button';

interface GermanSessionProps {
  day: GermanDay;
  level: GermanLevel;
  onBack: () => void;
  onPass: (dayId: string) => void;
}

export function GermanSession({ day, level, onBack, onPass }: GermanSessionProps) {
  const {
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
    cleanup,
    clearError,
  } = useGermanSession(day);

  const [textInput, setTextInput] = useState('');
  const [hasNotifiedPass, setHasNotifiedPass] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  // Start session on mount
  useEffect(() => {
    startSession();
    return () => cleanup();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-scroll
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, state]);

  // Notify parent on pass (once)
  useEffect(() => {
    if (testResult === 'pass' && !hasNotifiedPass) {
      setHasNotifiedPass(true);
      setTimeout(() => onPass(day.id), 2000);
    }
  }, [testResult, hasNotifiedPass, onPass, day.id]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (textInput.trim() && state !== 'thinking' && testResult === null) {
      submitText(textInput.trim());
      setTextInput('');
    }
  };

  const isSessionOver = testResult !== null;
  const showInput = !isSessionOver && (state === 'idle' || !hasMicSupport);
  const canInteract = !isSessionOver && state !== 'thinking' && !isTransitioningToTest;

  return (
    <div className="min-h-screen bg-[#FDFBF7] flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <button
          onClick={() => { cleanup(); onBack(); }}
          className="w-9 h-9 rounded-full hover:bg-gray-100 flex items-center justify-center transition-colors"
        >
          <ArrowLeft size={20} className="text-gray-600" />
        </button>

        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-sm font-bold"
          style={{ backgroundColor: level.color }}
        >
          {day.level}
        </div>

        <div className="flex-1 min-w-0">
          <div className="font-semibold text-[#2A3B4C] text-sm truncate">
            Day {day.dayNumber} · {day.topic}
          </div>
          <div className="text-xs text-gray-400">{level.label}</div>
        </div>

        {/* Phase pill */}
        <div
          className={cn(
            'flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all duration-500',
            isTransitioningToTest
              ? 'bg-amber-100 text-amber-700 animate-pulse'
              : phase === 'study'
                ? 'bg-green-100 text-green-700'
                : 'bg-blue-100 text-blue-700',
          )}
        >
          {phase === 'study' && !isTransitioningToTest && <BookOpen size={11} />}
          {phase === 'test' && !isTransitioningToTest && <ClipboardCheck size={11} />}
          {isTransitioningToTest && <Loader2 size={11} className="animate-spin" />}
          <span>
            {isTransitioningToTest ? 'Starting Test…' : phase === 'study' ? 'Study' : 'Test'}
          </span>
        </div>
      </div>

      {/* Transcript */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4 max-w-2xl mx-auto w-full">
        {messages.map((msg, idx) => (
          <MessageBubble key={idx} msg={msg} phase={phase} isTransitioningToTest={isTransitioningToTest} />
        ))}

        {/* Transition banner */}
        {isTransitioningToTest && (
          <div className="bg-blue-50 border border-blue-200 rounded-2xl px-5 py-4 text-center animate-in fade-in duration-500">
            <div className="text-blue-700 font-semibold text-sm">📝 Test time!</div>
            <div className="text-blue-600 text-xs mt-1">The tutor will now ask you 3 questions to check your understanding.</div>
          </div>
        )}

        {/* Thinking indicator */}
        {state === 'thinking' && (
          <div className="max-w-[85%] rounded-2xl px-5 py-4 bg-gray-50 text-gray-500 rounded-tl-sm self-start w-fit">
            <div className="flex gap-1.5 pt-1">
              {[0, 150, 300].map(d => (
                <div key={d} className="w-2 h-2 rounded-full bg-gray-300 animate-bounce" style={{ animationDelay: `${d}ms` }} />
              ))}
            </div>
          </div>
        )}

        {/* Result card */}
        {isSessionOver && (
          <ResultCard result={testResult!} dayTopic={day.topic} />
        )}

        <div ref={endRef} className="h-4" />
      </div>

      {/* Error */}
      {error && (
        <div className="mx-4 mb-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center gap-3">
          <span className="text-red-600 text-sm flex-1">{error}</span>
          <button onClick={clearError} className="text-red-400 hover:text-red-600">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Controls */}
      {!isSessionOver && (
        <div className="bg-white border-t border-gray-100 px-4 py-4 max-w-2xl mx-auto w-full">
          {hasMicSupport ? (
            <div className="flex flex-col items-center gap-3">
              <MicButton
                state={canInteract ? (state === 'listening' ? 'listening' : state === 'speaking' ? 'speaking' : 'idle') : 'thinking'}
                onClick={canInteract ? toggleListening : () => {}}
                disabled={!canInteract}
              />
              <p className="text-xs text-gray-400">
                {state === 'listening' ? 'Tap to stop recording' : state === 'thinking' ? 'Processing…' : 'Tap to speak'}
              </p>
              {/* Text fallback */}
              <form onSubmit={handleSubmit} className="flex gap-2 w-full mt-1">
                <input
                  type="text"
                  value={textInput}
                  onChange={e => setTextInput(e.target.value)}
                  placeholder="Or type your answer…"
                  disabled={!canInteract}
                  className="flex-1 px-4 py-2.5 rounded-full border border-gray-200 text-sm focus:outline-none focus:border-[#3A6BC4] focus:ring-1 focus:ring-[#3A6BC4] disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={!textInput.trim() || !canInteract}
                  className="w-10 h-10 rounded-full bg-[#3A6BC4] text-white flex items-center justify-center disabled:opacity-40 hover:bg-[#2d5aad] transition-colors shrink-0"
                >
                  <SendHorizontal size={16} />
                </button>
              </form>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex gap-2">
              <input
                type="text"
                value={textInput}
                onChange={e => setTextInput(e.target.value)}
                placeholder="Type your answer…"
                disabled={!canInteract}
                className="flex-1 px-4 py-3 rounded-full border border-gray-200 focus:outline-none focus:border-[#3A6BC4] focus:ring-1 focus:ring-[#3A6BC4] disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={!textInput.trim() || !canInteract}
                className="w-12 h-12 rounded-full bg-[#3A6BC4] text-white flex items-center justify-center disabled:opacity-40 hover:bg-[#2d5aad] transition-colors shrink-0"
              >
                <SendHorizontal size={20} />
              </button>
            </form>
          )}
        </div>
      )}

      {isSessionOver && (
        <div className="bg-white border-t border-gray-100 px-4 py-4">
          <button
            onClick={() => { cleanup(); onBack(); }}
            className="w-full max-w-sm mx-auto flex items-center justify-center gap-2 py-3 rounded-full bg-[#2A3B4C] text-white font-semibold hover:bg-[#1e2d3d] transition-colors"
          >
            <ArrowLeft size={16} />
            Back to Course Map
          </button>
        </div>
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function MessageBubble({ msg }: { msg: GermanMessage; phase: SessionPhase; isTransitioningToTest: boolean }) {
  if (msg.role === 'assistant') {
    return (
      <div className={cn(
        'max-w-[85%] rounded-2xl px-5 py-4 text-[1rem] leading-relaxed rounded-tl-sm self-start',
        msg.isTransition ? 'bg-blue-50 border border-blue-200 text-blue-900' : 'bg-gray-50 text-gray-800',
      )}>
        <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
          {msg.isTransition ? 'Tutor · Starting Test' : 'Tutor'}
        </div>
        <div className="whitespace-pre-line">{msg.content}</div>

        {msg.correction && msg.correction !== 'Sehr gut!' && (
          <div className="mt-3 pt-3 border-t border-gray-200 text-sm text-gray-600 space-y-1">
            <span className="text-xs font-semibold text-[#3A6BC4] uppercase tracking-wider">Correction</span>
            <p>{msg.correction}</p>
            {msg.bandUpgrade && <p><span className="font-medium text-gray-700">Better phrasing:</span> {msg.bandUpgrade}</p>}
          </div>
        )}

        {(msg.vocabularyUpgrades?.length ?? 0) > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-200 space-y-1">
            <span className="text-xs font-semibold text-[#3A6BC4] uppercase tracking-wider">🇩🇪 New Words</span>
            {msg.vocabularyUpgrades!.map((v, i) => (
              <div key={i} className="text-sm text-gray-700">
                <span className="font-medium">{v.original}</span>
                <span className="text-gray-400 mx-1.5">→</span>
                <span className="font-bold text-[#2A3B4C]">{v.upgrade}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-[85%] rounded-2xl px-5 py-4 text-[1rem] leading-relaxed bg-[#2A3B4C] text-white rounded-tr-sm self-end ml-auto">
      <div className="whitespace-pre-line">{msg.content}</div>
      {msg.audioUrl && (
        <audio controls src={msg.audioUrl} className="mt-3 h-8 w-full max-w-[200px]" />
      )}
    </div>
  );
}

type SessionPhase = 'study' | 'test';

function ResultCard({ result, dayTopic }: { result: 'pass' | 'fail'; dayTopic: string }) {
  const isPass = result === 'pass';
  return (
    <div className={cn(
      'rounded-3xl px-6 py-6 text-center border animate-in fade-in slide-in-from-bottom-4 duration-700',
      isPass ? 'bg-green-50 border-green-200' : 'bg-orange-50 border-orange-200',
    )}>
      <div className={cn(
        'w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4',
        isPass ? 'bg-green-100' : 'bg-orange-100',
      )}>
        {isPass
          ? <Check size={32} className="text-green-600" strokeWidth={2.5} />
          : <X size={32} className="text-orange-600" strokeWidth={2.5} />}
      </div>
      <h3 className={cn('text-xl font-bold mb-1', isPass ? 'text-green-800' : 'text-orange-800')}>
        {isPass ? 'Tag bestanden! 🎉' : 'Noch nicht ganz!'}
      </h3>
      <p className={cn('text-sm', isPass ? 'text-green-700' : 'text-orange-700')}>
        {isPass
          ? `Great work on "${dayTopic}". The next day is now unlocked!`
          : `Keep practising "${dayTopic}" and try again — you've got this!`}
      </p>
    </div>
  );
}
