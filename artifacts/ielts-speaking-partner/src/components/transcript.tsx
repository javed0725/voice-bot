import { useEffect, useRef, useState } from 'react';
import type { DisplayMessage, AppMode } from '@/hooks/use-ielts-conversation';
import { cn } from '@/lib/utils';
import { SendHorizontal, AlertTriangle } from 'lucide-react';
import { BandScoreBreakdown } from '@/components/band-score-breakdown';

interface TranscriptProps {
  messages: DisplayMessage[];
  isThinking: boolean;
  onSendText: (text: string) => void;
  showFallbackInput: boolean;
  appMode?: AppMode;
}

export function Transcript({ messages, isThinking, onSendText, showFallbackInput, appMode = 'ielts' }: TranscriptProps) {
  const isGerman = appMode === 'german';
  const endRef = useRef<HTMLDivElement>(null);
  const [textInput, setTextInput] = useState('');

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isThinking]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (textInput.trim()) {
      onSendText(textInput.trim());
      setTextInput('');
    }
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={cn(
              "max-w-[85%] rounded-2xl px-5 py-4 text-[1.05rem] leading-relaxed",
              msg.role === 'assistant'
                ? msg.isMockTransition
                  ? "bg-[#FDEDE7] text-[#2A3B4C] rounded-tl-sm self-start border border-[#F3D4C6]"
                  : "bg-gray-50 text-gray-800 rounded-tl-sm self-start"
                : "bg-[#2A3B4C] text-white rounded-tr-sm self-end ml-auto"
            )}
          >
            {msg.role === 'assistant' && (
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                {isGerman ? 'Tutor' : msg.isMockTransition ? 'Examiner · Test Update' : 'Examiner'}
              </div>
            )}
            <div className="whitespace-pre-line">{msg.content}</div>

            {msg.role === 'user' && msg.audioUrl && (
              <audio controls src={msg.audioUrl} className="mt-3 h-8 w-full max-w-[240px]" />
            )}

            {msg.role === 'user' && msg.fillerWords && msg.fillerWords.length > 0 && (
              <div className="mt-2 flex items-center gap-1.5 text-xs text-amber-200 bg-white/10 rounded-lg px-2 py-1 w-fit">
                <AlertTriangle size={12} />
                <span>
                  Filler words detected: {msg.fillerWords.reduce((sum: number, f: { word: string; count: number }) => sum + f.count, 0)}
                  {' '}
                  ({msg.fillerWords.map((f: { word: string; count: number }) => `${f.word} ×${f.count}`).join(', ')})
                </span>
              </div>
            )}

            {msg.role === 'assistant' && msg.bandScores && (
              <>
                <div className="mt-4 pt-3 border-t border-gray-200 text-sm text-gray-600 space-y-1.5">
                  <div className="flex items-center gap-1.5 font-semibold text-[#E86A4C] text-xs uppercase tracking-wider">
                    {isGerman ? 'Tutor Feedback' : 'Coach Feedback'}
                  </div>
                  <p><span className="font-medium text-gray-700">Correction:</span> {msg.correction}</p>
                  {msg.bandUpgrade && (
                    <p>
                      <span className="font-medium text-gray-700">
                        {isGerman ? 'German Upgrade:' : 'Band Upgrade:'}
                      </span>{' '}
                      {msg.bandUpgrade}
                    </p>
                  )}
                </div>
                {!isGerman && (
                  <BandScoreBreakdown bandScores={msg.bandScores} vocabularyUpgrades={msg.vocabularyUpgrades ?? []} />
                )}
                {isGerman && (msg.vocabularyUpgrades?.length ?? 0) > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-200 space-y-1">
                    <div className="text-xs font-semibold text-[#E86A4C] uppercase tracking-wider mb-1.5">
                      🇩🇪 New German Words
                    </div>
                    {msg.vocabularyUpgrades!.map((v, i) => (
                      <div key={i} className="text-sm text-gray-700">
                        <span className="font-medium">{v.original}</span>
                        <span className="text-gray-400 mx-1.5">→</span>
                        <span className="font-semibold text-[#2A3B4C]">{v.upgrade}</span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        ))}
        {isThinking && (
          <div className="max-w-[85%] rounded-2xl px-5 py-4 bg-gray-50 text-gray-500 rounded-tl-sm self-start w-fit">
            <div className="flex gap-1.5 pt-1">
              <div className="w-2 h-2 rounded-full bg-gray-300 animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-2 h-2 rounded-full bg-gray-300 animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-2 h-2 rounded-full bg-gray-300 animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        )}
        <div ref={endRef} className="h-4" />
      </div>

      {showFallbackInput && (
        <div className="p-4 bg-gray-50 border-t border-gray-100">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              type="text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="Type your response instead..."
              className="flex-1 px-4 py-3 rounded-full border border-gray-200 focus:outline-none focus:border-[#E86A4C] focus:ring-1 focus:ring-[#E86A4C] bg-white text-gray-800 transition-all"
              disabled={isThinking}
            />
            <button
              type="submit"
              disabled={!textInput.trim() || isThinking}
              className="w-12 h-12 rounded-full bg-[#E86A4C] text-white flex items-center justify-center disabled:opacity-50 hover:bg-[#d65f42] transition-colors shrink-0"
            >
              <SendHorizontal size={20} />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
