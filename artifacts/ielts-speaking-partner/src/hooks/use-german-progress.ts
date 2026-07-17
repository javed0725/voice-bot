import { useState, useCallback } from 'react';
import { ALL_DAY_IDS } from '@/data/german-curriculum';

const STORAGE_KEY = 'german_course_v1';

interface ProgressData {
  completedDays: string[];
}

function loadProgress(): ProgressData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as ProgressData;
  } catch {}
  return { completedDays: [] };
}

function saveProgress(data: ProgressData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {}
}

export function useGermanProgress() {
  const [progress, setProgress] = useState<ProgressData>(loadProgress);

  const isCompleted = useCallback(
    (dayId: string) => progress.completedDays.includes(dayId),
    [progress],
  );

  // A day is unlocked if it is the first day, or the preceding day is completed.
  const isUnlocked = useCallback(
    (dayId: string) => {
      if (dayId === ALL_DAY_IDS[0]) return true;
      const idx = ALL_DAY_IDS.indexOf(dayId);
      if (idx <= 0) return false;
      return progress.completedDays.includes(ALL_DAY_IDS[idx - 1]);
    },
    [progress],
  );

  const markDayComplete = useCallback((dayId: string) => {
    setProgress(prev => {
      if (prev.completedDays.includes(dayId)) return prev;
      const next: ProgressData = { completedDays: [...prev.completedDays, dayId] };
      saveProgress(next);
      return next;
    });
  }, []);

  const resetProgress = useCallback(() => {
    const fresh: ProgressData = { completedDays: [] };
    saveProgress(fresh);
    setProgress(fresh);
  }, []);

  return { progress, isCompleted, isUnlocked, markDayComplete, resetProgress };
}
