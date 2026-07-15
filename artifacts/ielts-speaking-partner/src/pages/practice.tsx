import { useState } from 'react';
import { AlertCircle, RefreshCw, TrendingUp, ArrowRight, Check } from 'lucide-react';
import { useIeltsConversation, type ConversationMode } from '@/hooks/use-ielts-conversation';
import { MicButton } from '@/components/mic-button';
import { Transcript } from '@/components/transcript';
import { MockTimer } from '@/components/mock-timer';
import { ProgressDashboard } from '@/components/progress-dashboard';
import { FREE_PRACTICE_TOPICS } from '@/lib/free-practice-topics';
import { cn } from '@/lib/utils';

export function PracticeSession() {
  const {
    state,
    messages,
    error,
    hasSpeechSupport,
    mode,
    mockStage,
    currentCueCard,
    timer,
    startPractice,
    toggleListening,
    resetConversation,
    submitText,
    clearError,
    retryLastUserMessage,
    advanceToPart2,
    advanceToPart3,
  } = useIeltsConversation();

  const [selectedMode, setSelectedMode] = useState<ConversationMode>('practice');
  const [selectedTopicId, setSelectedTopicId] = useState<string>('general');
  const [showProgress, setShowProgress] = useState(false);

  if (state === 'gate') {
    return (
      <div className="min-h-screen bg-[#FDFBF7] flex flex-col items-center justify-center p-6 text-center">
        <div className="max-w-md w-full space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="w-24 h-24 bg-[#E86A4C] rounded-[2rem] rotate-3 mx-auto shadow-xl flex items-center justify-center">
            <div className="w-12 h-12 border-4 border-white rounded-full opacity-80"></div>
          </div>

          <div className="space-y-3">
            <h1 className="text-4xl font-bold text-[#2A3B4C] tracking-tight">IELTS Speaking Partner</h1>
            <p className="text-[#5A6C7D] text-lg">Practice your conversational English with an AI examiner. Speak naturally, make mistakes, and get comfortable.</p>
          </div>

          <div className="flex rounded-2xl bg-gray-100 p-1.5 gap-1">
            <button
              onClick={() => setSelectedMode('practice')}
              className={cn(
                'flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all',
                selectedMode === 'practice' ? 'bg-white text-[#2A3B4C] shadow-sm' : 'text-gray-500'
              )}
            >
              Free Practice
            </button>
            <button
              onClick={() => setSelectedMode('mock')}
              className={cn(
                'flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all',
                selectedMode === 'mock' ? 'bg-white text-[#2A3B4C] shadow-sm' : 'text-gray-500'
              )}
            >
              Mock Test Mode
            </button>
          </div>
          <p className="text-xs text-gray-400 -mt-6">
            {selectedMode === 'practice'
              ? 'Pick a topic to focus on, or keep it open-ended.'
              : 'A structured Part 1 → Part 2 (Cue Card) → Part 3 mock exam with timers.'}
          </p>

          {selectedMode === 'practice' && (
            <div className="text-left space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-500">
              <p className="text-xs font-semibold text-[#5A6C7D] uppercase tracking-wide">Choose a topic</p>
              <div className="grid grid-cols-2 gap-2">
                {FREE_PRACTICE_TOPICS.map((topic) => {
                  const isSelected = selectedTopicId === topic.id;
                  return (
                    <button
                      key={topic.id}
                      onClick={() => setSelectedTopicId(topic.id)}
                      aria-pressed={isSelected}
                      className={cn(
                        'relative flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-sm font-medium text-center transition-all',
                        isSelected
                          ? 'bg-[#E86A4C] border-[#E86A4C] text-white shadow-md'
                          : 'bg-white border-gray-200 text-[#2A3B4C] hover:border-[#E86A4C] hover:text-[#E86A4C]'
                      )}
                    >
                      {isSelected && <Check size={14} className="shrink-0" />}
                      <span className="leading-tight">{topic.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="pt-2">
            <button
              onClick={() => startPractice(selectedMode, selectedTopicId)}
              className="w-full py-4 px-8 rounded-full bg-[#2A3B4C] text-white text-lg font-semibold hover:-translate-y-1 hover:shadow-xl transition-all duration-300"
            >
              Start Practice Session
            </button>
            <p className="mt-4 text-sm text-gray-400">Requires microphone access</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    // Fixed-height app shell: header and controls never scroll, only the
    // transcript panel in the middle does. This keeps the mic button
    // permanently on-screen no matter how long the conversation gets.
    <div className="h-[100dvh] bg-[#FDFBF7] flex flex-col items-center overflow-hidden">
      <div className="w-full max-w-4xl flex justify-between items-center px-4 py-4 md:px-8 md:py-6 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#E86A4C] rounded-xl flex items-center justify-center">
            <div className="w-4 h-4 border-2 border-white rounded-full opacity-80"></div>
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-[#2A3B4C] tracking-wide text-lg leading-tight">IELTS Partner</span>
            {mode === 'mock' && mockStage && (
              <span className="text-[11px] font-semibold text-[#E86A4C] uppercase tracking-wider">
                {mockStage === 'part1' && 'Mock Test · Part 1'}
                {(mockStage === 'part2-prep' || mockStage === 'part2-speaking') && 'Mock Test · Part 2'}
                {mockStage === 'part3' && 'Mock Test · Part 3'}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowProgress(true)}
            className="text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100"
          >
            <TrendingUp size={16} />
            My Progress
          </button>
          <button
            onClick={resetConversation}
            className="text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100"
          >
            <RefreshCw size={16} />
            End Session
          </button>
        </div>
      </div>

      <div className="w-full max-w-4xl flex-1 min-h-0 flex flex-col lg:flex-row gap-4 md:gap-8 px-4 md:px-8 pb-4 md:pb-8">

        {/* Transcript: the only scrollable region */}
        <div className="flex-1 min-h-0 overflow-hidden order-1">
          <Transcript
            messages={messages}
            isThinking={state === 'thinking'}
            onSendText={submitText}
            showFallbackInput={!hasSpeechSupport || state === 'idle'}
          />
        </div>

        {/* Controls: pinned, never part of the scrolling area. Bottom on
            mobile (order-2, shrink-0), right-hand sidebar on desktop. */}
        <div className="shrink-0 lg:w-[320px] flex flex-col justify-center items-center gap-4 lg:gap-8 order-2 pt-2 lg:pt-0">
          {timer && <MockTimer timer={timer} />}

          {mode === 'mock' && mockStage === 'part1' && state === 'idle' && !timer && (
            <button
              onClick={advanceToPart2}
              className="w-full flex items-center justify-center gap-2 py-3 px-6 rounded-full bg-white border-2 border-[#E86A4C] text-[#E86A4C] text-sm font-semibold hover:bg-[#FDEDE7] transition-colors"
            >
              Move to Part 2 (Cue Card)
              <ArrowRight size={16} />
            </button>
          )}

          {mode === 'mock' && mockStage === 'part2-speaking' && !timer && state === 'idle' && (
            <button
              onClick={advanceToPart3}
              className="w-full flex items-center justify-center gap-2 py-3 px-6 rounded-full bg-white border-2 border-[#E86A4C] text-[#E86A4C] text-sm font-semibold hover:bg-[#FDEDE7] transition-colors"
            >
              Move to Part 3 (Discussion)
              <ArrowRight size={16} />
            </button>
          )}

          {!timer && (
            <MicButton
              state={state}
              onClick={toggleListening}
              disabled={state === 'thinking'}
            />
          )}

          {error && (
            <div className="w-full p-4 bg-red-50 text-red-600 rounded-2xl flex flex-col items-start gap-3 border border-red-100 animate-in slide-in-from-top-2">
              <div className="flex gap-3">
                <AlertCircle size={20} className="shrink-0 mt-0.5" />
                <p className="text-sm font-medium">{error}</p>
              </div>
              <div className="flex gap-2 ml-8">
                <button
                  onClick={retryLastUserMessage}
                  className="px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 text-xs font-bold rounded-lg transition-colors"
                >
                  Retry Request
                </button>
                <button
                  onClick={clearError}
                  className="px-3 py-1.5 bg-transparent hover:bg-red-100 text-red-700 text-xs font-bold rounded-lg transition-colors"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}

          {!hasSpeechSupport && !error && (
            <div className="w-full p-4 bg-orange-50 text-orange-800 rounded-2xl flex gap-3 text-sm">
              <AlertCircle size={18} className="shrink-0 mt-0.5" />
              <p>Speech recognition is not supported in this browser. Please use the text input below.</p>
            </div>
          )}
        </div>

      </div>

      <ProgressDashboard open={showProgress} onOpenChange={setShowProgress} messages={messages} />
    </div>
  );
}
