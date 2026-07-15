/**
 * Static content bank for Mock Test Mode. Kept fully client-side and
 * deterministic (no AI round-trip) so Part 1/2/3 structure and timing are
 * always reliable — the AI is still used for every actual coaching reply,
 * just not for generating the test structure itself.
 */
export interface CueCard {
  topic: string;
  bulletPoints: string[];
  part3Questions: string[];
}

export const PART1_INTRO =
  "This is a Mock IELTS Speaking Test. We'll begin with Part 1 — introduction and interview about yourself.";

export const PART1_OPENING_QUESTION = "To start, can you tell me a little about yourself and where you're from?";

export const CUE_CARDS: CueCard[] = [
  {
    topic: 'Describe a book you recently read.',
    bulletPoints: [
      'what the book was',
      'why you chose to read it',
      'what it was about',
      'and explain why you liked or disliked it',
    ],
    part3Questions: [
      'Do you think reading habits have changed in recent years?',
      'What are the benefits of reading fiction compared to non-fiction?',
      'Do you think children should be encouraged to read more? Why?',
    ],
  },
  {
    topic: 'Describe a memorable trip you have taken.',
    bulletPoints: [
      'where you went',
      'who you went with',
      'what you did there',
      'and explain why it was memorable',
    ],
    part3Questions: [
      'How has tourism changed in your country over the years?',
      'Do you think it is important for young people to travel? Why?',
      'What are the environmental impacts of tourism?',
    ],
  },
  {
    topic: 'Describe a skill you would like to learn.',
    bulletPoints: [
      'what the skill is',
      'why you want to learn it',
      'how you would learn it',
      'and explain how it would benefit you',
    ],
    part3Questions: [
      'Do you think it is easier to learn new skills now than in the past?',
      'Should schools teach practical life skills? Why or why not?',
      'What skills do you think will be important in the future?',
    ],
  },
  {
    topic: 'Describe a piece of technology you find useful.',
    bulletPoints: [
      'what it is',
      'how often you use it',
      'what you use it for',
      'and explain why you find it useful',
    ],
    part3Questions: [
      'How has technology changed the way people communicate?',
      'Do you think people rely too much on technology today?',
      'What technology do you think will be common in 20 years?',
    ],
  },
  {
    topic: 'Describe a person who has influenced you.',
    bulletPoints: [
      'who this person is',
      'how you know them',
      'what they have done',
      'and explain how they have influenced you',
    ],
    part3Questions: [
      'Do you think celebrities have a responsibility to be good role models?',
      'Who tends to have more influence on young people: family or friends?',
      'Can a stranger influence someone as much as a family member?',
    ],
  },
];

export function pickRandomCueCard(): CueCard {
  return CUE_CARDS[Math.floor(Math.random() * CUE_CARDS.length)]!;
}

export function formatCueCardMessage(cueCard: CueCard): string {
  const bullets = cueCard.bulletPoints.map((point) => `• ${point}`).join('\n');
  return `Let's move to Part 2 — the Cue Card. You have 1 minute to prepare, then speak for up to 2 minutes.\n\n${cueCard.topic}\nYou should say:\n${bullets}`;
}

export function formatPart3Message(cueCard: CueCard): string {
  const questions = cueCard.part3Questions.map((q, i) => `${i + 1}. ${q}`).join('\n');
  return `Now let's move to Part 3 — a discussion related to that topic.\n\n${questions}`;
}

export const PART2_PREP_SECONDS = 60;
export const PART2_SPEAKING_SECONDS = 120;
