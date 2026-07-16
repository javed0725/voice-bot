// No npm imports — uses built-in fetch so Vercel doesn't need to bundle
// @google/genai or any other package.

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "4mb",
    },
  },
};

const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent";

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
- If the student's message is too short or already advanced, pick whatever simple word is closest to hand.

Coaching feedback rules:
- "correction": a short correction of any grammar/word-choice mistakes. If there are none, say "Perfect grammar!"
- "bandUpgrade": a more natural, idiomatic, or higher band-score way to phrase what they said.

You MUST respond with ONLY a single JSON object matching this schema:
{"reply":"string","correction":"string","bandUpgrade":"string","bandScores":{"fluency":number,"lexicalResource":number,"grammaticalRange":number,"pronunciation":number,"overall":number},"vocabularyUpgrades":[{"original":"string","upgrade":"string"}]}`;

function buildTopicInstruction(topic: string): string {
  return `\n\nTopic focus: The student selected "${topic}". Keep ALL questions strictly on this topic. Gently redirect if they drift.`;
}

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    reply: { type: "STRING" },
    correction: { type: "STRING" },
    bandUpgrade: { type: "STRING" },
    bandScores: {
      type: "OBJECT",
      properties: {
        fluency: { type: "NUMBER" },
        lexicalResource: { type: "NUMBER" },
        grammaticalRange: { type: "NUMBER" },
        pronunciation: { type: "NUMBER" },
        overall: { type: "NUMBER" },
      },
      required: ["fluency", "lexicalResource", "grammaticalRange", "pronunciation", "overall"],
    },
    vocabularyUpgrades: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          original: { type: "STRING" },
          upgrade: { type: "STRING" },
        },
        required: ["original", "upgrade"],
      },
    },
  },
  required: ["reply", "correction", "bandUpgrade", "bandScores", "vocabularyUpgrades"],
};

const FALLBACK = {
  fluency: 6, lexicalResource: 6, grammaticalRange: 6, pronunciation: 6, overall: 6,
};

function safeParseReply(text: string) {
  try {
    const p = JSON.parse(text.trim());
    return {
      reply: typeof p.reply === "string" ? p.reply : text.trim(),
      correction: typeof p.correction === "string" ? p.correction : "",
      bandUpgrade: typeof p.bandUpgrade === "string" ? p.bandUpgrade : "",
      bandScores: p.bandScores ?? FALLBACK,
      vocabularyUpgrades: Array.isArray(p.vocabularyUpgrades) ? p.vocabularyUpgrades : [],
    };
  } catch {
    return {
      reply: text.trim(),
      correction: "",
      bandUpgrade: "",
      bandScores: FALLBACK,
      vocabularyUpgrades: [],
    };
  }
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "GEMINI_API_KEY not configured" });
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
    const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: systemInstruction }],
        },
        contents,
        generationConfig: {
          maxOutputTokens: 1024,
          responseMimeType: "application/json",
          responseSchema: RESPONSE_SCHEMA,
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("Gemini chat API error:", err);
      res.status(502).json({ error: "Gemini API error" });
      return;
    }

    const data: any = await response.json();
    const text: string =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

    if (!text) {
      res.status(502).json({ error: "Empty response from Gemini" });
      return;
    }

    res.json(safeParseReply(text));
  } catch (err) {
    console.error("Gemini chat error:", err);
    res.status(500).json({ error: "Failed to get examiner reply" });
  }
}
