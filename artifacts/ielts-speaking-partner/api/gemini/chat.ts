// @ts-nocheck
// No npm imports — uses built-in fetch so Vercel doesn't need to bundle any packages.

// Vercel serverless function config (plain functions, not Next.js API routes)
export const config = {
  maxDuration: 60, // seconds — overrides Vercel's default 10 s limit
};

const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent";

// 55 s — gives the fetch a hard deadline just under Vercel's 60 s max-duration
const FETCH_TIMEOUT_MS = 55_000;

const IELTS_EXAMINER_SYSTEM_INSTRUCTION = `You are a professional, dynamic IELTS Speaking Examiner and coach having a real-time voice conversation with a student.

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
- If the student's message is too short or already advanced, pick whatever simple word is closest to hand.

Coaching feedback rules:
- "correction": a short correction of any grammar/word-choice mistakes. If there are none, say "Perfect grammar!"
- "bandUpgrade": a more natural, idiomatic, or higher band-score way to phrase what they said.

You MUST respond with ONLY a single JSON object matching this schema:
{"reply":"string","correction":"string","bandUpgrade":"string","bandScores":{"fluency":number,"lexicalResource":number,"grammaticalRange":number,"pronunciation":number,"overall":number},"vocabularyUpgrades":[{"original":"string","upgrade":"string"}]}`;

const GERMAN_TUTOR_SYSTEM_INSTRUCTION = `You are a friendly, highly patient, and professional German Language Tutor for an absolute beginner.

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

function buildTopicInstruction(topic: string): string {
  return `\n\nTopic focus rules (STRICT):
- The student selected "${topic}" for this session. Every question and follow-up MUST stay within this topic.
- Draw varied, high-standard IELTS questions about "${topic}" — never ask the same question twice, vary the angle each turn (personal experience → opinion → comparison → hypothetical → societal impact).
- If the student drifts off-topic, acknowledge their answer briefly then steer back to "${topic}".`;
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

  console.log(`[chat] messages=${messages.length} topic=${topic ?? "none"}`);

  const contents = messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const isGermanMode = topic === '__german_tutor__';
  const systemInstruction = isGermanMode
    ? GERMAN_TUTOR_SYSTEM_INSTRUCTION
    : topic
      ? IELTS_EXAMINER_SYSTEM_INSTRUCTION + buildTopicInstruction(topic)
      : IELTS_EXAMINER_SYSTEM_INSTRUCTION;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: systemInstruction }],
        },
        contents,
        generationConfig: {
          maxOutputTokens: 1024,
          temperature: 0.7,
          responseMimeType: "application/json",
          responseSchema: RESPONSE_SCHEMA,
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
    });

    clearTimeout(timer);

    if (!response.ok) {
      const err = await response.text();
      console.error("[chat] Gemini API error:", response.status, err);
      res.status(502).json({ error: `Gemini API error ${response.status}` });
      return;
    }

    const data: any = await response.json();
    const text: string =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

    if (!text) {
      res.status(502).json({ error: "Empty response from Gemini" });
      return;
    }

    console.log(`[chat] success, reply length=${text.length}`);
    res.json(safeParseReply(text));
  } catch (err: any) {
    clearTimeout(timer);
    if (err?.name === "AbortError") {
      console.error("[chat] Gemini fetch timed out after", FETCH_TIMEOUT_MS, "ms");
      res.status(504).json({ error: "Gemini API timed out" });
    } else {
      console.error("[chat] Unexpected error:", err);
      res.status(500).json({ error: "Failed to get examiner reply" });
    }
  }
}
