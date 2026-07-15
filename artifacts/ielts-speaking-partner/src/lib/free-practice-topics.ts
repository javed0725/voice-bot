/**
 * Topic bank for Free Practice mode. Selecting a topic scopes the AI
 * examiner's questioning (via the `topic` field sent with every chat
 * request) instead of leaving the conversation fully open-ended.
 *
 * The `openingQuestion` is used locally to greet the student instantly
 * without an extra AI round-trip, mirroring the same instant-greeting
 * pattern used by Mock Test Mode.
 */
export interface FreePracticeTopic {
  id: string;
  label: string;
  /** Sent to the backend as the `topic` field. Undefined for "General". */
  topicForApi?: string;
  openingQuestion: string;
}

export const FREE_PRACTICE_TOPICS: FreePracticeTopic[] = [
  {
    id: 'general',
    label: 'General / Any Topic',
    openingQuestion:
      "Hello! I am your IELTS speaking partner. Let's practice. What would you like to talk about today?",
  },
  {
    id: 'hometown',
    label: 'Hometown',
    topicForApi: 'Hometown',
    openingQuestion:
      "Let's talk about your hometown. Can you tell me where you're from and what it's like there?",
  },
  {
    id: 'work-study',
    label: 'Work & Study',
    topicForApi: 'Work & Study',
    openingQuestion:
      'Are you currently working or studying? Tell me a bit about what you do.',
  },
  {
    id: 'friends-family',
    label: 'Friends & Family',
    topicForApi: 'Friends & Family',
    openingQuestion:
      "Let's talk about friends and family. Who are you closest to, and why?",
  },
  {
    id: 'hobbies',
    label: 'Hobbies & Free Time',
    topicForApi: 'Hobbies & Free Time',
    openingQuestion:
      "What do you usually like to do in your free time, and how did you get into it?",
  },
  {
    id: 'technology',
    label: 'Technology',
    topicForApi: 'Technology',
    openingQuestion:
      'Which piece of technology do you use most often, and why is it useful to you?',
  },
  {
    id: 'transport-travel',
    label: 'Transport & Travel',
    topicForApi: 'Transport & Travel',
    openingQuestion:
      'How do you usually get around day to day, and do you enjoy traveling?',
  },
  {
    id: 'environment-weather',
    label: 'Environment & Weather',
    topicForApi: 'Environment & Weather',
    openingQuestion:
      "What's the weather usually like where you live, and how does it affect your daily routine?",
  },
];

export function getFreePracticeTopic(id: string): FreePracticeTopic {
  return FREE_PRACTICE_TOPICS.find((t) => t.id === id) ?? FREE_PRACTICE_TOPICS[0]!;
}
