/**
 * Common IELTS Speaking filler words/phrases. Detected on the final
 * transcript of each user turn to give the student real-time feedback on
 * how much they lean on hesitation fillers, which hurts the Fluency and
 * Coherence band score.
 */
const FILLER_WORDS = [
  'um',
  'uhm',
  'uh',
  'ah',
  'er',
  'like',
  'actually',
  'basically',
  'literally',
  'you know',
  'sort of',
  'kind of',
];

export interface FillerWordHit {
  word: string;
  count: number;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Scans `text` for filler words/phrases and returns each one found along
 * with how many times it appeared. Matching is case-insensitive and uses
 * word boundaries so e.g. "like" doesn't match inside "likely".
 */
export function detectFillerWords(text: string): FillerWordHit[] {
  const lower = text.toLowerCase();
  const hits: FillerWordHit[] = [];

  for (const word of FILLER_WORDS) {
    const pattern = new RegExp(`\\b${escapeRegExp(word)}\\b`, 'g');
    const matches = lower.match(pattern);
    if (matches && matches.length > 0) {
      hits.push({ word, count: matches.length });
    }
  }

  return hits;
}

export function totalFillerCount(hits: FillerWordHit[]): number {
  return hits.reduce((sum, hit) => sum + hit.count, 0);
}
