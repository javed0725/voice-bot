import { Mic, Square } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ConversationState } from '@/hooks/use-ielts-conversation';

interface MicButtonProps {
  state: ConversationState;
  onClick: () => void;
  disabled: boolean;
}

export function MicButton({ state, onClick, disabled }: MicButtonProps) {
  return (
    <div className="flex flex-col items-center">
      <div className="relative flex items-center justify-center w-32 h-32">
        {state === 'listening' && (
          <>
            <div className="absolute inset-0 rounded-full bg-[#E86A4C] animate-pulse-ring" />
            <div className="absolute inset-0 rounded-full bg-[#E86A4C] animate-pulse-ring" style={{ animationDelay: '1s' }} />
          </>
        )}

        <button
          onClick={onClick}
          disabled={disabled}
          className={cn(
            "relative z-10 w-24 h-24 rounded-full flex items-center justify-center transition-all duration-500 shadow-xl border-4",
            state === 'idle' ? "bg-white text-[#E86A4C] hover:scale-105 border-transparent hover:shadow-2xl" : "",
            state === 'listening' ? "bg-[#E86A4C] text-white scale-110 border-[#E86A4C]" : "",
            state === 'thinking' ? "bg-white text-[#E86A4C] border-gray-100 scale-95" : "",
            state === 'speaking' ? "bg-[#2A3B4C] text-white border-[#2A3B4C] scale-105 shadow-2xl" : "",
            disabled && state !== 'thinking' ? "opacity-50 cursor-not-allowed" : ""
          )}
        >
          {state === 'idle' && <Mic size={36} />}
          {state === 'listening' && <Square size={28} className="fill-current animate-in zoom-in" />}
          
          {state === 'thinking' && (
            <>
              <div className="absolute inset-[-4px] rounded-full border-4 border-transparent border-t-[#E86A4C] animate-spin duration-1000" />
              <Mic size={36} className="opacity-30" />
            </>
          )}
          
          {state === 'speaking' && (
            <div className="flex gap-1.5 items-center justify-center h-8">
              <div className="w-1.5 h-6 bg-[#E86A4C] rounded-full wave-bar animate-wave" />
              <div className="w-1.5 h-8 bg-[#E86A4C] rounded-full wave-bar animate-wave" />
              <div className="w-1.5 h-4 bg-[#E86A4C] rounded-full wave-bar animate-wave" />
              <div className="w-1.5 h-7 bg-[#E86A4C] rounded-full wave-bar animate-wave" />
            </div>
          )}
        </button>
      </div>

      <div className="h-6 mt-2 text-sm font-medium tracking-wide text-gray-500 uppercase text-center">
        {state === 'idle' && "Tap to Speak"}
        {state === 'listening' && "Listening… tap when you're done"}
        {state === 'thinking' && "Examiner is thinking"}
        {state === 'speaking' && "Examiner is speaking"}
      </div>
    </div>
  );
}
