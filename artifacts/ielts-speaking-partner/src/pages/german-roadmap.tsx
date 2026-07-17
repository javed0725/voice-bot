import { useState } from 'react';
import { Lock, Check, ArrowLeft, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { GERMAN_CURRICULUM, getDayById, getLevelById, type GermanDay, type GermanLevel } from '@/data/german-curriculum';
import { useGermanProgress } from '@/hooks/use-german-progress';
import { GermanSession } from '@/pages/german-session';

interface GermanRoadmapProps {
  onBack: () => void;
}

type RoadmapView = 'map' | 'session';

export function GermanRoadmap({ onBack }: GermanRoadmapProps) {
  const { isCompleted, isUnlocked, markDayComplete, resetProgress } = useGermanProgress();
  const [view, setView] = useState<RoadmapView>('map');
  const [activeDayId, setActiveDayId] = useState<string | null>(null);
  const [showReset, setShowReset] = useState(false);

  const handleSelectDay = (dayId: string) => {
    setActiveDayId(dayId);
    setView('session');
  };

  const handleSessionPass = (dayId: string) => {
    markDayComplete(dayId);
    setTimeout(() => setView('map'), 500);
  };

  const handleSessionBack = () => {
    setView('map');
    setActiveDayId(null);
  };

  // Render session
  if (view === 'session' && activeDayId) {
    const day = getDayById(activeDayId);
    const level = day ? getLevelById(day.level) : undefined;
    if (!day || !level) return null;
    return (
      <GermanSession
        day={day}
        level={level}
        onBack={handleSessionBack}
        onPass={handleSessionPass}
      />
    );
  }

  // Render roadmap
  return (
    <div className="min-h-screen bg-[#FDFBF7] flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <button
          onClick={onBack}
          className="w-9 h-9 rounded-full hover:bg-gray-100 flex items-center justify-center transition-colors"
        >
          <ArrowLeft size={20} className="text-gray-600" />
        </button>
        <div className="flex-1">
          <h1 className="font-bold text-[#2A3B4C] text-base">🇩🇪 German Course Map</h1>
          <p className="text-xs text-gray-400">A1 → B2 · 20 Days</p>
        </div>
        <button
          onClick={() => setShowReset(v => !v)}
          className="w-9 h-9 rounded-full hover:bg-gray-100 flex items-center justify-center transition-colors text-gray-400 hover:text-gray-600"
          title="Reset progress"
        >
          <RotateCcw size={16} />
        </button>
      </div>

      {showReset && (
        <div className="mx-4 mt-3 bg-red-50 border border-red-200 rounded-2xl px-4 py-3 flex items-center gap-3">
          <p className="text-sm text-red-700 flex-1">Reset all progress? This cannot be undone.</p>
          <button
            onClick={() => { resetProgress(); setShowReset(false); }}
            className="text-xs font-semibold bg-red-600 text-white px-3 py-1.5 rounded-lg hover:bg-red-700 transition-colors"
          >
            Reset
          </button>
          <button
            onClick={() => setShowReset(false)}
            className="text-xs font-semibold text-gray-500 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Level sections */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-10 max-w-2xl mx-auto w-full">
        {GERMAN_CURRICULUM.map((lvl, lvlIdx) => (
          <LevelSection
            key={lvl.level}
            level={lvl}
            levelIndex={lvlIdx}
            isCompleted={isCompleted}
            isUnlocked={isUnlocked}
            onSelectDay={handleSelectDay}
          />
        ))}

        {/* Footer */}
        <div className="text-center pb-8">
          <p className="text-xs text-gray-400">Complete each day's test to unlock the next</p>
        </div>
      </div>
    </div>
  );
}

// ── Level section ─────────────────────────────────────────────────────────────

interface LevelSectionProps {
  level: GermanLevel;
  levelIndex: number;
  isCompleted: (id: string) => boolean;
  isUnlocked: (id: string) => boolean;
  onSelectDay: (id: string) => void;
}

function LevelSection({ level, levelIndex, isCompleted, isUnlocked, onSelectDay }: LevelSectionProps) {
  const allComplete = level.days.every(d => isCompleted(d.id));
  const anyUnlocked = level.days.some(d => isUnlocked(d.id));

  return (
    <div className="space-y-4">
      {/* Level header */}
      <div className={cn(
        'flex items-center gap-3 px-4 py-3 rounded-2xl border',
        allComplete ? 'border-green-200 bg-green-50' : anyUnlocked ? 'border-gray-200 bg-white' : 'border-gray-100 bg-gray-50 opacity-60',
      )}>
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm shrink-0"
          style={{ backgroundColor: anyUnlocked ? level.color : '#D1D5DB' }}
        >
          {level.level}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-[#2A3B4C] text-sm">{level.label}</div>
          <div className="text-xs text-gray-500">{level.description}</div>
        </div>
        {allComplete && <Check size={18} className="text-green-500 shrink-0" strokeWidth={2.5} />}
      </div>

      {/* Day nodes — path layout */}
      <div className="relative pl-6">
        {/* Vertical connector line */}
        <div
          className="absolute left-[1.375rem] top-6 bottom-6 w-0.5 rounded-full"
          style={{ backgroundColor: anyUnlocked ? `${level.color}40` : '#E5E7EB' }}
        />

        <div className="space-y-3">
          {level.days.map((day, dayIdx) => (
            <DayNode
              key={day.id}
              day={day}
              level={level}
              dayIndex={dayIdx}
              completed={isCompleted(day.id)}
              unlocked={isUnlocked(day.id)}
              onClick={() => isUnlocked(day.id) && onSelectDay(day.id)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Day node ──────────────────────────────────────────────────────────────────

interface DayNodeProps {
  day: GermanDay;
  level: GermanLevel;
  dayIndex: number;
  completed: boolean;
  unlocked: boolean;
  onClick: () => void;
}

function DayNode({ day, level, completed, unlocked, onClick }: DayNodeProps) {
  const isActive = unlocked && !completed;

  return (
    <button
      onClick={onClick}
      disabled={!unlocked}
      className={cn(
        'relative flex items-center gap-4 w-full text-left rounded-2xl px-4 py-3.5 border transition-all duration-200',
        completed
          ? 'bg-green-50 border-green-200 hover:bg-green-100'
          : isActive
            ? 'bg-white border-gray-200 hover:border-blue-300 hover:shadow-md cursor-pointer'
            : 'bg-gray-50 border-gray-100 cursor-not-allowed opacity-60',
      )}
    >
      {/* Circle node */}
      <div
        className={cn(
          'w-11 h-11 rounded-full flex items-center justify-center shrink-0 font-bold text-sm border-2 transition-all',
          completed
            ? 'bg-green-500 border-green-500 text-white'
            : isActive
              ? 'bg-white text-[#2A3B4C] shadow-sm'
              : 'bg-gray-200 border-gray-200 text-gray-400',
        )}
        style={isActive ? { borderColor: level.color, color: level.textColor } : undefined}
      >
        {completed
          ? <Check size={18} strokeWidth={2.5} />
          : !unlocked
            ? <Lock size={14} />
            : day.dayNumber}
      </div>

      {/* Active pulse ring */}
      {isActive && (
        <div
          className="absolute left-4 w-11 h-11 rounded-full animate-ping opacity-20"
          style={{ backgroundColor: level.color }}
        />
      )}

      {/* Label */}
      <div className="flex-1 min-w-0">
        <div className={cn(
          'font-semibold text-sm',
          completed ? 'text-green-800' : isActive ? 'text-[#2A3B4C]' : 'text-gray-400',
        )}>
          Day {day.dayNumber} · {day.topic}
        </div>
        <div className={cn(
          'text-xs mt-0.5',
          completed ? 'text-green-600' : isActive ? 'text-gray-400' : 'text-gray-300',
        )}>
          {completed ? 'Completed ✓' : isActive ? 'Tap to start' : 'Locked'}
        </div>
      </div>

      {/* Status badge */}
      {completed && (
        <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center shrink-0">
          <Check size={13} className="text-white" strokeWidth={2.5} />
        </div>
      )}
      {isActive && (
        <div
          className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-white text-xs font-bold"
          style={{ backgroundColor: level.color }}
        >
          →
        </div>
      )}
    </button>
  );
}
