import type { MockTimerInfo } from '@/hooks/use-ielts-conversation';

interface MockTimerProps {
  timer: MockTimerInfo;
}

export function MockTimer({ timer }: MockTimerProps) {
  const minutes = Math.floor(timer.secondsRemaining / 60);
  const seconds = timer.secondsRemaining % 60;
  const progress = (timer.secondsRemaining / timer.totalSeconds) * 100;

  return (
    <div className="w-full rounded-2xl border border-[#F3D4C6] bg-[#FDEDE7] p-4 space-y-2">
      <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-[#E86A4C]">
        <span>{timer.label}</span>
        <span className="font-mono text-sm text-[#2A3B4C]">
          {minutes}:{seconds.toString().padStart(2, '0')}
        </span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-white overflow-hidden">
        <div
          className="h-full rounded-full bg-[#E86A4C] transition-all duration-1000 ease-linear"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
