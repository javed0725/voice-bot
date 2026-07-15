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

export const IELTS_EXAMINER_SYSTEM_INSTRUCTION = `You are an expert IELTS Speaking Examiner and coach having a real-time voice conversation with a student.

Conversational reply rules:
- Converse ONLY in English.
- Keep the conversational reply STRICTLY to 1 or 2 short sentences maximum. This is critical: the reply is read aloud, so brevity keeps the conversation fast and natural.
- Stay natural and interactive, and include a relevant follow-up question when it fits, to keep the student talking.

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

/**
 * Builds the topic-scoping addendum appended to the base system
 * instruction when the student picked a specific Free Practice topic
 * instead of open-ended conversation.
 */
function buildTopicInstruction(topic: string): string {
  return `

Topic focus rules (STRICT):
- The student has selected the topic "${topic}" for this practice session.
- Every question and follow-up you ask MUST stay strictly within this topic. Do not drift into unrelated subjects.
- Mirror natural IELTS Part 1/Part 3 style questioning for this topic: start broad, then ask progressively deeper follow-up questions about it.
- If the student's answer drifts off-topic, gently steer the conversation back to "${topic}" in your reply.`;
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
function parseExaminerResponse(text: string): ExaminerReply {
  let parsed: Partial<ExaminerReply>;
  try {
    parsed = JSON.parse(text.trim());
  } catch (err) {
    logger.warn({ err, text }, "Gemini response was not valid JSON");
    return {
      reply: text.trim(),
      correction: "Unable to generate feedback for this turn.",
      bandUpgrade: "",
      bandScores: FALLBACK_BAND_SCORES,
      vocabularyUpgrades: [],
    };
  }

  return {
    reply: typeof parsed.reply === "string" ? parsed.reply : "",
    correction: typeof parsed.correction === "string" ? parsed.correction : "",
    bandUpgrade: typeof parsed.bandUpgrade === "string" ? parsed.bandUpgrade : "",
    bandScores: parsed.bandScores ?? FALLBACK_BAND_SCORES,
    vocabularyUpgrades: Array.isArray(parsed.vocabularyUpgrades)
      ? parsed.vocabularyUpgrades
      : [],
  };
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
): Promise<ExaminerReply> {
  const contents = history.map((turn) => ({
    role: turn.role === "assistant" ? "model" : "user",
    parts: [{ text: turn.content }],
  }));

  const systemInstruction = topic
    ? IELTS_EXAMINER_SYSTEM_INSTRUCTION + buildTopicInstruction(topic)
    : IELTS_EXAMINER_SYSTEM_INSTRUCTION;

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
          // Disable extended "thinking" — it adds real latency and isn't
          // needed for short conversational replies + a fixed feedback
          // format.
          thinkingConfig: { thinkingBudget: 0 },
          // Structured JSON output — far more reliable to parse than a
          // free-text divider format, and required now that the response
          // includes nested band scores and a vocabulary upgrade list.
          responseMimeType: "application/json",
          responseSchema: EXAMINER_RESPONSE_SCHEMA,
        },
      });

      const text = response.text;
      if (!text) {
        throw new Error("Gemini returned an empty response");
      }

      return parseExaminerResponse(text);
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
