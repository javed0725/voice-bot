import type { BandScoreBreakdown as BandScores, VocabularyUpgrade } from '@workspace/api-client-react';
import { ArrowRight } from 'lucide-react';

interface BandScoreBreakdownProps {
  bandScores: BandScores;
  vocabularyUpgrades: VocabularyUpgrade[];
}

const CRITERIA: { key: keyof BandScores; label: string }[] = [
  { key: 'fluency', label: 'Fluency' },
  { key: 'lexicalResource', label: 'Lexical Resource' },
  { key: 'grammaticalRange', label: 'Grammar' },
  { key: 'pronunciation', label: 'Pronunciation' },
];

function scoreColor(score: number): string {
  if (score >= 7) return 'bg-emerald-500';
  if (score >= 5.5) return 'bg-amber-500';
  return 'bg-red-500';
}

export function BandScoreBreakdown({ bandScores, vocabularyUpgrades }: BandScoreBreakdownProps) {
  return (
    <div className="mt-4 pt-3 border-t border-gray-200 text-sm text-gray-600 space-y-3">
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="font-semibold text-[#E86A4C] text-xs uppercase tracking-wider">Band Score Breakdown</span>
          <span className="text-xs font-bold text-[#2A3B4C]">Overall {bandScores.overall.toFixed(1)}</span>
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-2">
          {CRITERIA.map(({ key, label }) => {
            const score = bandScores[key];
            return (
              <div key={key as string} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500">{label}</span>
                  <span className="font-semibold text-gray-700">{score.toFixed(1)}</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${scoreColor(score)}`}
                    style={{ width: `${Math.min(100, (score / 9) * 100)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {vocabularyUpgrades.length > 0 && (
        <div>
          <div className="font-semibold text-[#E86A4C] text-xs uppercase tracking-wider mb-1.5">Vocabulary Upgrader</div>
          <ul className="space-y-1">
            {vocabularyUpgrades.map((v, i) => (
              <li key={i} className="flex items-center gap-1.5 text-sm">
                <span className="text-gray-500 line-through">{v.original}</span>
                <ArrowRight size={12} className="text-gray-400 shrink-0" />
                <span className="font-medium text-[#2A3B4C]">{v.upgrade}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
