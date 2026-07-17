import { GoogleGenAI, Type } from "@google/genai";
import type { BandScoreBreakdown, VocabularyUpgrade } from "@workspace/api-zod";
import { logger } from "./logger";

const apiKey = process.env["GEMINI_API_KEY"];

if (!apiKey) {
  throw new Error(
    "GEMINI_API_KEY environment variable is required but was not provided.",
  );
}

export const genAI = new GoogleGenAI({ apiKey });

export const IELTS_EXAMINER_SYSTEM_INSTRUCTION = `You are a professional, dynamic IELTS Speaking Examiner and coach having a real-time voice conversation with a student.

Dynamic questioning rules (CRITICAL):
- NEVER repeat the same question or follow a static script across different sessions. Every conversation must feel completely fresh and unpredictable.
- For each new conversation, spontaneously draw from the full official IELTS topic pool: hometown, family, work and study, education, technology, environment, travel, culture, food and cooking, health and fitness, hobbies and sports, media and news, future plans, shopping, art and music, and more.
- Vary the phrasing, angle, and depth of every question. Approach topics from different perspectives: personal experience, opinion, comparison, hypothetical scenario, or societal impact.
- Mirror a real IELTS Speaking examiner's natural progression: begin with a broad, accessible opener, then drill into specific follow-up angles suggested by the student's own answer.
- Vary sentence structures and difficulty naturally — simpler Part-1-style personal questions early, more analytical Part-3-style abstract questions as the conversation deepens.
- Draw on the student's previous answers to make follow-up questions feel personalised and organically connected.

Conversational reply rules:
- Converse ONLY in English.
- Keep the conversational reply STRICTLY to 1 or 2 short sentences maximum. This is critical: the reply is read aloud, so brevity keeps the conversation fast and natural.
- Stay natural and interactive; always end with a relevant follow-up question to keep the student talking.

Band Score Breakdown rules:
- Evaluate ONLY the student's most recent message (not the whole conversation).
- Score each of the four official IELTS Speaking criteria from 0 to 9 (decimals like 6.5 are allowed): Fluency and Coherence, Lexical Resource, Grammatical Range and Accuracy, Pronunciation.
- Pronunciation cannot be directly heard from text, so infer a reasonable estimate from sentence rhythm, word choice, and any spelled-out phonetic issues; never skip it.
- "overall" is the average of the four scores, rounded to the nearest 0.5.

Vocabulary Upgrader rules:
- Identify exactly 1 or 2 simple/basic words or phrases the student actually used in their most recent message.
- For each, suggest a Band 7+/8+ synonym or idiomatic expression that could naturally replace it in that sentence.
- If the student's message is too short or already advanced, pick whatever simple word is closest to hand (do not leave the list empty except when the message is a single trivial word).

Coaching feedback rules:
- Evaluate the grammar, word choice, and phrasing of the student's most recent message.
- "correction": a short correction of any grammar/word-choice mistakes. If there are none, say "Perfect grammar!"
- "bandUpgrade": a more natural, idiomatic, or higher band-score way to phrase what they said.

You MUST respond with ONLY a single JSON object matching the required schema — no markdown, no code fences, no extra commentary.`;

export const GERMAN_TUTOR_SYSTEM_INSTRUCTION = `You are a friendly, highly patient, and professional German Language Tutor for an absolute beginner.

Teaching rules:
- NEVER repeat the same lesson or opening across sessions. Every conversation must feel fresh and explore a different vocabulary set or angle.
- Structure every lesson step-by-step: introduce a German word or phrase, provide its English translation (add a Bengali hint where it naturally helps), then ask the student to repeat it or use it in a simple sentence.
- Keep your German sentences very short, phonetically simple, and easy to pronounce for a complete beginner.
- After each student response, gently correct any grammar or spelling errors and briefly explain the correction in English.
- Use warm encouragement ("Sehr gut!", "Wunderbar!", "Gut gemacht!") to keep the student motivated.
- Vary lesson topics each session: greetings, numbers, colours, days of the week, food, weather, family, shopping, directions.

Reply format rules:
- Keep replies to 1-3 short sentences — the reply is read aloud.
- Always show German and English side-by-side, e.g. "Guten Morgen! (Good morning!) Can you say that back to me?"

You MUST respond with ONLY a single JSON object using this field mapping:
- "reply": your tutor message with German + English translation inline
- "correction": gentle correction of any student mistake, or "Sehr gut!" if none
- "bandUpgrade": a more natural or advanced German phrasing of what the student attempted, or "" if not applicable
- "bandScores": set ALL four values to 0 — scoring is not used in German Tutor Mode
- "vocabularyUpgrades": 1-2 German words introduced this turn — "original" = English word, "upgrade" = German word/phrase`;

// ── German Day Curriculum (compact reference for system prompts) ─────────────
const GERMAN_DAY_DATA: Record<string, { level: string; dayNum: number; topic: string; keyPoints: string }> = {
  'A1-1': { level: 'A1', dayNum: 1, topic: 'Greetings & Introductions',        keyPoints: 'Hallo, Guten Morgen, Guten Tag, Tschüss; Ich heiße…; Wie heißt du?; Woher kommst du?; Wie geht es dir? / Gut, danke!' },
  'A1-2': { level: 'A1', dayNum: 2, topic: 'Numbers 1–20 & Basic Questions',   keyPoints: 'eins bis zwanzig; Wie alt bist du? / Ich bin X Jahre alt; Was ist das? / Das ist…; Wie viel kostet das?' },
  'A1-3': { level: 'A1', dayNum: 3, topic: 'Colors & Everyday Objects',         keyPoints: 'rot, blau, grün, gelb, schwarz, weiß, orange; der Tisch, die Lampe, das Buch; Das ist ein/eine…; Welche Farbe hat…?' },
  'A1-4': { level: 'A1', dayNum: 4, topic: 'Days, Months & Time',               keyPoints: 'Montag–Sonntag; Januar–Dezember; Wie spät ist es? / Es ist … Uhr; heute, morgen, gestern' },
  'A1-5': { level: 'A1', dayNum: 5, topic: 'Family Members & Possessives',      keyPoints: 'die Mutter, der Vater, die Schwester, der Bruder, die Großeltern; mein/meine, dein/deine; Das ist meine Mutter.; Ich habe einen Bruder.' },
  'A2-1': { level: 'A2', dayNum: 1, topic: 'Nominativ Articles',                keyPoints: 'der (m), die (f), das (n), die (pl); ein, eine, ein; kein/keine; subject identification' },
  'A2-2': { level: 'A2', dayNum: 2, topic: 'Akkusativ — Direct Objects',        keyPoints: 'den (m), die (f), das (n); verbs: haben, sehen, kaufen, essen; Ich kaufe den Apfel.; Hast du einen Hund?' },
  'A2-3': { level: 'A2', dayNum: 3, topic: 'Dativ — Prepositions',              keyPoints: 'dem (m/n), der (f), den+n (pl); mit, bei, nach, von, zu, aus, seit; Ich fahre mit dem Bus.; Ich helfe meiner Mutter.' },
  'A2-4': { level: 'A2', dayNum: 4, topic: 'Modal Verbs',                       keyPoints: 'können, müssen, wollen, dürfen, sollen, möchten; modal conjugated + infinitive at end; Ich muss arbeiten.; Darf ich hier sitzen?' },
  'A2-5': { level: 'A2', dayNum: 5, topic: 'Perfekt — Conversational Past',     keyPoints: 'haben + past participle; sein for movement; regulars: ge-+stem+t; irregulars: gehen→gegangen, sehen→gesehen' },
  'B1-1': { level: 'B1', dayNum: 1, topic: 'Nebensätze — Subordinate Clauses',  keyPoints: 'weil, dass, wenn, obwohl, bevor → verb to end; Ich bleibe zu Hause, weil ich krank bin.; Wenn ich Zeit habe, gehe ich spazieren.' },
  'B1-2': { level: 'B1', dayNum: 2, topic: 'Wechselpräpositionen',              keyPoints: 'an, auf, in, neben, über, unter, vor, hinter, zwischen; Dativ for Wo? / Akkusativ for Wohin?; liegen/legen, sitzen/setzen pairs' },
  'B1-3': { level: 'B1', dayNum: 3, topic: 'Reflexive Verbs',                   keyPoints: 'mich, dich, sich, uns, euch; sich freuen, sich waschen, sich erinnern, sich vorstellen; Ich freue mich auf den Urlaub.' },
  'B1-4': { level: 'B1', dayNum: 4, topic: 'Konjunktiv II — Conditional',       keyPoints: 'würde + infinitive; wäre, hätte, könnte; Wenn ich reich wäre, würde ich reisen.; Das wäre toll!' },
  'B1-5': { level: 'B1', dayNum: 5, topic: 'Expressing Opinions & Arguments',   keyPoints: 'Meiner Meinung nach…; Ich denke, dass…; Einerseits…andererseits…; Das stimmt, aber…; Ich bin anderer Meinung.' },
  'B2-1': { level: 'B2', dayNum: 1, topic: 'Passiv — Passive Voice',            keyPoints: 'werden + past participle; Passiv with modal: Das muss gemacht werden.; Zustandspassiv with sein; formal/impersonal use' },
  'B2-2': { level: 'B2', dayNum: 2, topic: 'Relativsätze — Relative Clauses',   keyPoints: 'der, die, das, die; gender+number agrees with antecedent; case by role; Das Buch, das ich lese, ist spannend.' },
  'B2-3': { level: 'B2', dayNum: 3, topic: 'Advanced Prepositions & Phrases',   keyPoints: 'wegen, trotz, während, statt; warten auf, sich freuen über, denken an; Pronominaladverbien; jedoch, daher, folglich' },
  'B2-4': { level: 'B2', dayNum: 4, topic: 'Formal Language & Written German',  keyPoints: 'Sie vs du register; email: Sehr geehrte/r…, Mit freundlichen Grüßen; Nominalization; im Hinblick auf, bezüglich' },
  'B2-5': { level: 'B2', dayNum: 5, topic: 'Debate & Complex Argumentation',    keyPoints: 'These → Begründung → Beispiel → Schluss; Zwar…, aber…; Auch wenn…, trotzdem…; Umwelt, Digitalisierung, Globalisierung topics' },
};

function buildGermanDaySystemInstruction(dayId: string, phase: string): string {
  const day = GERMAN_DAY_DATA[dayId];
  if (!day) return GERMAN_TUTOR_SYSTEM_INSTRUCTION;

  const isBeginner = day.level === 'A1' || day.level === 'A2';

  if (phase === 'test') {
    return `You are evaluating a student on Day ${day.dayNum} of CEFR Level ${day.level}: "${day.topic}".

Test protocol:
- Ask exactly 3 questions, one per turn. Wait for each answer before asking the next.
- Questions must directly test today's topic: ${day.topic}.
- ${isBeginner
    ? 'Appropriate question types: "How do you say X in German?", "What is the German word for Y?", "Complete this sentence: …"'
    : 'Appropriate question types: Construct a sentence using the target grammar, express an opinion, demonstrate the grammatical structure.'}
- After the student has answered all 3 questions, evaluate their overall performance.
- Set testResult to "pass" if they answered at least 2 of 3 adequately; otherwise "fail".
- Always include a warm, encouraging closing remark regardless of the result.

JSON rules:
- transitionToTest: ALWAYS false in the test phase.
- testResult: "pending" while questions are still ongoing; "pass" or "fail" only after evaluating all 3 answers.
- bandScores: all 0. vocabularyUpgrades: empty array.

You MUST respond with ONLY this JSON (no markdown, no extra text):
{"reply":"string","correction":"string","bandUpgrade":"string","bandScores":{"fluency":0,"lexicalResource":0,"grammaticalRange":0,"pronunciation":0,"overall":0},"vocabularyUpgrades":[],"transitionToTest":false,"testResult":"pending"}`;
  }

  return `You are a patient, encouraging German language tutor. Today is Day ${day.dayNum} of CEFR Level ${day.level}: "${day.topic}".

Today's key content:
${day.keyPoints}

Lesson flow:
1. Welcome the student warmly and introduce today's topic (1 short turn).
2. Teach 2 key concepts one by one with a German example + English translation. After each, ask the student to try using it.
3. After approximately 3 student exchanges (once you've covered the core content), set transitionToTest to true.

Rules:
- Keep replies to 1–3 short sentences. Replies are read aloud.
- Always show German + English side-by-side.
- Use encouragement: "Sehr gut!", "Wunderbar!", "Gut gemacht!"
- bandScores: all 0. testResult: ALWAYS "pending" during study phase.
- transitionToTest: false until core content is covered, then true.
- vocabularyUpgrades: 1–2 German words introduced this turn.

You MUST respond with ONLY this JSON (no markdown, no extra text):
{"reply":"string","correction":"string","bandUpgrade":"string","bandScores":{"fluency":0,"lexicalResource":0,"grammaticalRange":0,"pronunciation":0,"overall":0},"vocabularyUpgrades":[{"original":"English","upgrade":"Deutsch"}],"transitionToTest":false,"testResult":"pending"}`;
}

const GERMAN_DAY_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    reply: { type: Type.STRING },
    correction: { type: Type.STRING },
    bandUpgrade: { type: Type.STRING },
    bandScores: {
      type: Type.OBJECT,
      properties: {
        fluency: { type: Type.NUMBER }, lexicalResource: { type: Type.NUMBER },
        grammaticalRange: { type: Type.NUMBER }, pronunciation: { type: Type.NUMBER }, overall: { type: Type.NUMBER },
      },
      required: ["fluency", "lexicalResource", "grammaticalRange", "pronunciation", "overall"],
    },
    vocabularyUpgrades: {
      type: Type.ARRAY,
      items: { type: Type.OBJECT, properties: { original: { type: Type.STRING }, upgrade: { type: Type.STRING } }, required: ["original", "upgrade"] },
    },
    transitionToTest: { type: Type.BOOLEAN },
    testResult: { type: Type.STRING, enum: ["pending", "pass", "fail"] },
  },
  required: ["reply", "correction", "bandUpgrade", "bandScores", "vocabularyUpgrades", "transitionToTest", "testResult"],
};

/**
 * Builds the topic-scoping addendum appended to the base system
 * instruction when the student picked a specific Free Practice topic
 * instead of open-ended conversation.
 */
function buildTopicInstruction(topic: string): string {
  return `

Topic focus rules (STRICT):
- The student selected "${topic}" for this session. Every question and follow-up MUST stay within this topic.
- Draw varied, high-standard IELTS questions about "${topic}" — never ask the same question twice; vary the angle each turn (personal experience → opinion → comparison → hypothetical → societal impact).
- If the student drifts off-topic, acknowledge their answer briefly then steer back to "${topic}".`;
}

/**
 * Builds the difficulty-level addendum that controls question complexity,
 * vocabulary level, and expected answer depth for the IELTS examiner.
 */
function buildLevelInstruction(level?: string): string {
  if (level === "beginner") {
    return `

Difficulty level: BEGINNER (CEFR A2)
- Ask ONLY extremely short, simple, friendly everyday questions — 10 words or fewer per question.
- Use only basic vocabulary and simple present/past tense. No idioms, no subordinate clauses, no abstract thinking required.
- Good examples: "Do you like music?", "Where do you live?", "What is your favourite food?", "Tell me about your family.", "Do you enjoy sports?"
- If the student gives a 1–2 sentence answer, that is perfectly fine — never pressure them for more detail.
- Your entire reply must stay under 2 short sentences. Your primary goal is to make the student feel relaxed and successful.`;
  }
  if (level === "advanced") {
    return `

Difficulty level: ADVANCED (IELTS Part 3 / CEFR C1)
- Ask complex, abstract, deeply analytical IELTS Part 3-style questions that demand critical thinking and sophisticated vocabulary.
- Focus on societal issues, global trends, philosophical implications, ethical trade-offs, and nuanced multi-sided comparisons.
- Good examples: "To what extent has globalisation undermined cultural identity?", "How might widespread AI adoption reshape the nature of human creativity and employment?", "Is rapid economic growth inherently incompatible with environmental sustainability — or can the two coexist?"
- Expect and reward hedging language (e.g. "it could be argued that…", "one might contend…"), precise academic vocabulary, and well-structured argumentation.
- After each student reply, probe deeper: "Could you elaborate on that point?", "What might be a counterargument?", "How does that compare to the situation in other countries?"`;
  }
  // Default: intermediate
  return `

Difficulty level: INTERMEDIATE (Standard IELTS / CEFR B1–B2)
- Ask standard IELTS Speaking questions that blend personal experience with light analytical thinking.
- Use clear, natural vocabulary at B1–B2 level. Include occasional idiomatic expressions and phrasal verbs.
- Good examples: "How has technology changed the way people communicate?", "Do you think it's important to travel abroad? Why?", "Describe a time when you had to work as part of a team."
- Encourage the student to give 3–5 sentence answers. Follow up with "Why do you think that?" or "Can you give an example?"`;
}

export interface GeminiChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface ExaminerReply {
  reply: string;
  correction: string;
  bandUpgrade: string;
  bandScores: BandScoreBreakdown;
  vocabularyUpgrades: VocabularyUpgrade[];
  transitionToTest?: boolean;
  testResult?: "pass" | "fail" | null;
}

const EXAMINER_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    reply: { type: Type.STRING },
    correction: { type: Type.STRING },
    bandUpgrade: { type: Type.STRING },
    bandScores: {
      type: Type.OBJECT,
      properties: {
        fluency: { type: Type.NUMBER },
        lexicalResource: { type: Type.NUMBER },
        grammaticalRange: { type: Type.NUMBER },
        pronunciation: { type: Type.NUMBER },
        overall: { type: Type.NUMBER },
      },
      required: [
        "fluency",
        "lexicalResource",
        "grammaticalRange",
        "pronunciation",
        "overall",
      ],
    },
    vocabularyUpgrades: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          original: { type: Type.STRING },
          upgrade: { type: Type.STRING },
        },
        required: ["original", "upgrade"],
      },
    },
  },
  required: ["reply", "correction", "bandUpgrade", "bandScores", "vocabularyUpgrades"],
};

const FALLBACK_BAND_SCORES: BandScoreBreakdown = {
  fluency: 6,
  lexicalResource: 6,
  grammaticalRange: 6,
  pronunciation: 6,
  overall: 6,
};

/**
 * Parses the model's raw JSON text response into a fully-typed
 * ExaminerReply, falling back to safe defaults for any field the model
 * didn't follow the schema for.
 */
function parseExaminerResponse(text: string, isGermanDay = false): ExaminerReply {
  let parsed: any;
  try {
    parsed = JSON.parse(text.trim());
  } catch (err) {
    logger.warn({ err, text }, "Gemini response was not valid JSON");
    const base: ExaminerReply = {
      reply: text.trim(),
      correction: "Unable to generate feedback for this turn.",
      bandUpgrade: "",
      bandScores: FALLBACK_BAND_SCORES,
      vocabularyUpgrades: [],
    };
    if (isGermanDay) { base.transitionToTest = false; base.testResult = null; }
    return base;
  }

  const base: ExaminerReply = {
    reply: typeof parsed.reply === "string" ? parsed.reply : "",
    correction: typeof parsed.correction === "string" ? parsed.correction : "",
    bandUpgrade: typeof parsed.bandUpgrade === "string" ? parsed.bandUpgrade : "",
    bandScores: parsed.bandScores ?? FALLBACK_BAND_SCORES,
    vocabularyUpgrades: Array.isArray(parsed.vocabularyUpgrades) ? parsed.vocabularyUpgrades : [],
  };

  if (isGermanDay) {
    base.transitionToTest = parsed.transitionToTest === true;
    base.testResult = (parsed.testResult === "pass" || parsed.testResult === "fail") ? parsed.testResult : null;
  }

  return base;
}

/**
 * Transcribes a base64-encoded audio clip using Gemini's audio understanding.
 * Returns the spoken text, or an empty string if nothing was audible.
 */
export async function transcribeAudio(
  base64Audio: string,
  mimeType: string,
): Promise<string> {
  // Same model alias used for chat — the only one confirmed to have quota
  // on this API key. Flash Lite supports multimodal (audio) input.
  const response = await genAI.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: [
      {
        role: "user",
        parts: [
          {
            inlineData: {
              data: base64Audio,
              mimeType,
            },
          },
          {
            text: "Transcribe the spoken English in this audio clip exactly as heard. Return ONLY the transcribed words — no punctuation changes, no commentary, no quotation marks. If no speech is audible, return an empty string.",
          },
        ],
      },
    ],
    config: {
      maxOutputTokens: 512,
    },
  });

  const text = (response.text ?? "").trim();
  // If Gemini says there's nothing, normalise to empty string
  if (/^(no speech|nothing|inaudible|silent|empty)/i.test(text)) return "";
  return text;
}

/**
 * Sends the full conversation history to Gemini and returns the examiner's
 * next reply as plain text.
 */
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 500;

function isTransientError(err: unknown): boolean {
  const status =
    err && typeof err === "object" && "status" in err
      ? (err as { status?: number }).status
      : undefined;
  return status === 503 || status === 429;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function getExaminerReply(
  history: GeminiChatTurn[],
  topic?: string,
  dayId?: string,
  phase?: string,
  level?: string,
): Promise<ExaminerReply> {
  const contents = history.map((turn) => ({
    role: turn.role === "assistant" ? "model" : "user",
    parts: [{ text: turn.content }],
  }));

  const isGermanDayMode = topic === '__german_day__' && !!dayId;
  const isGermanMode = topic === '__german_tutor__';
  const systemInstruction = isGermanDayMode
    ? buildGermanDaySystemInstruction(dayId!, phase || 'study')
    : isGermanMode
      ? GERMAN_TUTOR_SYSTEM_INSTRUCTION
      : topic
        ? IELTS_EXAMINER_SYSTEM_INSTRUCTION + buildTopicInstruction(topic) + buildLevelInstruction(level)
        : IELTS_EXAMINER_SYSTEM_INSTRUCTION + buildLevelInstruction(level);

  let lastErr: unknown;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await genAI.models.generateContent({
        model: "gemini-flash-lite-latest",
        contents,
        config: {
          systemInstruction,
          // Short replies only, so cap output well below the previous
          // budget to cut latency further.
          maxOutputTokens: 1024,
          // 0.7 encourages varied, non-repetitive questions each session
          // while still following the structured JSON schema reliably.
          temperature: 0.7,
          // Disable extended "thinking" — it adds real latency and isn't
          // needed for short conversational replies + a fixed feedback
          // format.
          thinkingConfig: { thinkingBudget: 0 },
          // Structured JSON output — far more reliable to parse than a
          // free-text divider format, and required now that the response
          // includes nested band scores and a vocabulary upgrade list.
          responseMimeType: "application/json",
          responseSchema: isGermanDayMode ? GERMAN_DAY_RESPONSE_SCHEMA : EXAMINER_RESPONSE_SCHEMA,
        },
      });

      const text = response.text;
      if (!text) {
        throw new Error("Gemini returned an empty response");
      }

      return parseExaminerResponse(text, isGermanDayMode);
    } catch (err) {
      lastErr = err;
      if (attempt < MAX_RETRIES && isTransientError(err)) {
        const delay = BASE_DELAY_MS * 2 ** attempt;
        logger.warn(
          { attempt, delay },
          "Gemini call hit a transient error, retrying",
        );
        await sleep(delay);
        continue;
      }
      logger.error({ err }, "Gemini generateContent call failed");
      throw err;
    }
  }

  throw lastErr;
}
