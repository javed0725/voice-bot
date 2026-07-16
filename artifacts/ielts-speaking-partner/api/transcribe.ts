// No npm imports — uses built-in fetch so Vercel doesn't need to bundle
// @google/genai or any other package.

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "50mb",
    },
  },
};

const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent";

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { audio, mimeType } = req.body as { audio: string; mimeType: string };
  if (!audio || !mimeType) {
    res.status(400).json({ error: "audio and mimeType are required" });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "GEMINI_API_KEY not configured" });
    return;
  }

  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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

    if (!response.ok) {
      const err = await response.text();
      console.error("Gemini transcribe API error:", err);
      res.status(502).json({ error: "Gemini API error" });
      return;
    }

    const data: any = await response.json();
    const text: string =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    const trimmed = text.trim();

    if (/^(no speech|nothing|inaudible|silent|empty)/i.test(trimmed)) {
      res.json({ transcript: "" });
      return;
    }

    res.json({ transcript: trimmed });
  } catch (err) {
    console.error("Transcription error:", err);
    res.status(500).json({ error: "Failed to transcribe audio" });
  }
}
