// No npm imports — uses built-in fetch so Vercel doesn't need to bundle any packages.

// Vercel serverless function config (plain functions, not Next.js API routes)
export const config = {
  maxDuration: 60, // seconds — overrides Vercel's default 10 s limit
};

const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent";

// 55 s — gives the fetch a hard deadline just under Vercel's 60 s max-duration
const FETCH_TIMEOUT_MS = 55_000;

// Gemini only accepts base MIME types without codec parameters.
// e.g. "audio/webm;codecs=opus" → "audio/webm"
function normaliseAudioMime(raw: string): string {
  const base = raw.split(";")[0].trim().toLowerCase();
  if (base === "audio/ogg") return "audio/ogg";
  if (base === "audio/webm") return "audio/webm";
  if (base === "audio/mp4" || base === "audio/x-m4a") return "audio/mp4";
  if (base === "audio/wav" || base === "audio/wave") return "audio/wav";
  return base; // aac, flac, mp3, etc — return as-is
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { audio, mimeType: rawMimeType } = req.body as { audio: string; mimeType: string };
  if (!audio || !rawMimeType) {
    res.status(400).json({ error: "audio and mimeType are required" });
    return;
  }

  // Strip codec parameters — Gemini only accepts bare MIME types
  const mimeType = normaliseAudioMime(rawMimeType);

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "GEMINI_API_KEY not configured" });
    return;
  }

  // Estimate payload size for logging
  const estimatedBytes = Math.round((audio.length * 3) / 4);
  console.log(
    `[transcribe] rawMime=${rawMimeType} → mime=${mimeType} payloadBytes≈${estimatedBytes}`
  );

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              {
                inlineData: {
                  mimeType,
                  data: audio,
                },
              },
              {
                text: "Transcribe the spoken English in this audio clip exactly as heard. Return ONLY the transcribed words — no punctuation changes, no commentary, no quotation marks. If no speech is audible, return an empty string.",
              },
            ],
          },
        ],
        generationConfig: {
          maxOutputTokens: 512,
        },
      }),
    });

    clearTimeout(timer);

    if (!response.ok) {
      const err = await response.text();
      console.error("[transcribe] Gemini API error:", response.status, err);
      res.status(502).json({ error: `Gemini API error ${response.status}` });
      return;
    }

    const data: any = await response.json();
    const text: string =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    const trimmed = text.trim();

    console.log(
      `[transcribe] success, transcript length=${trimmed.length}`
    );

    if (/^(no speech|nothing|inaudible|silent|empty)/i.test(trimmed)) {
      res.json({ transcript: "" });
      return;
    }

    res.json({ transcript: trimmed });
  } catch (err: any) {
    clearTimeout(timer);
    if (err?.name === "AbortError") {
      console.error("[transcribe] Gemini fetch timed out after", FETCH_TIMEOUT_MS, "ms");
      res.status(504).json({ error: "Gemini API timed out" });
    } else {
      console.error("[transcribe] Unexpected error:", err);
      res.status(500).json({ error: "Failed to transcribe audio" });
    }
  }
}
