import { GoogleGenAI, Type } from "@google/genai";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "4mb",
    },
  },
};

const IELTS_EXAMINER_SYSTEM_INSTRUCTION = `You are an expert IELTS Speaking Examiner and coach having a real-time voice conversation with a student.

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

function buildTopicInstruction(topic: string): string {
  return `

Topic focus rules (STRICT):
- The student has selected the topic "${topic}" for this practice session.
- Every question and follow-up you ask MUST stay strictly within this topic. Do not drift into unrelated subjects.
- Mirror natural IELTS Part 1/Part 3 style questioning for this topic: start broad, then ask progressively deeper follow-up questions about it.
- If the student's answer drifts off-topic, gently steer the conversation back to "${topic}" in your reply.`;
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
      required: ["fluency", "lexicalResource", "grammaticalRange", "pronunciation", "overall"],
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

const FALLBACK_BAND_SCORES = {
  fluency: 6, lexicalResource: 6, grammaticalRange: 6, pronunciation: 6, overall: 6,
};

function parseExaminerResponse(text: string) {
  let parsed: any;
  try {
    parsed = JSON.parse(text.trim());
  } catch {
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
    vocabularyUpgrades: Array.isArray(parsed.vocabularyUpgrades) ? parsed.vocabularyUpgrades : [],
  };
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "GEMINI_API_KEY not configured on this deployment" });
    return;
  }

  const { messages, topic } = req.body as {
    messages: Array<{ role: string; content: string }>;
    topic?: string;
  };

  if (!Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: "messages array is required" });
    return;
  }

  const contents = messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const systemInstruction = topic
    ? IELTS_EXAMINER_SYSTEM_INSTRUCTION + buildTopicInstruction(topic)
    : IELTS_EXAMINER_SYSTEM_INSTRUCTION;

  try {
    const genAI = new GoogleGenAI({ apiKey });
    const response = await genAI.models.generateContent({
      model: "gemini-flash-lite-latest",
      contents,
      config: {
        systemInstruction,
        maxOutputTokens: 1024,
        thinkingConfig: { thinkingBudget: 0 },
        responseMimeType: "application/json",
        responseSchema: EXAMINER_RESPONSE_SCHEMA,
      },
    });

    const text = response.text;
    if (!text) {
      res.status(502).json({ error: "Gemini returned an empty response" });
      return;
    }

    res.json(parseExaminerResponse(text));
  } catch (err: any) {
    console.error("Gemini chat error:", err);
    res.status(502).json({ error: "Failed to get examiner reply" });
  }
}
