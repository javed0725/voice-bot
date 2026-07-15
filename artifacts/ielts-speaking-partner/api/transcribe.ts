import { GoogleGenAI } from "@google/genai";

// Raise Vercel's default 4.5 MB JSON body limit — a 30-second audio clip
// encoded as base64 can easily be 10-20 MB.
export const config = {
  api: {
    bodyParser: {
      sizeLimit: "50mb",
    },
  },
};

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
    res.status(500).json({ error: "GEMINI_API_KEY not configured on this deployment" });
    return;
  }

  try {
    const genAI = new GoogleGenAI({ apiKey });
    const response = await genAI.models.generateContent({
      model: "gemini-flash-lite-latest",
      contents: [
        {
          role: "user",
          parts: [
            { inlineData: { data: audio, mimeType } },
            {
              text: "Transcribe the spoken English in this audio clip exactly as heard. Return ONLY the transcribed words — no punctuation changes, no commentary, no quotation marks. If no speech is audible, return an empty string.",
            },
          ],
        },
      ],
      config: { maxOutputTokens: 512 },
    });

    const text = (response.text ?? "").trim();
    if (/^(no speech|nothing|inaudible|silent|empty)/i.test(text)) {
      res.json({ transcript: "" });
      return;
    }
    res.json({ transcript: text });
  } catch (err) {
    console.error("Transcription error:", err);
    res.status(500).json({ error: "Failed to transcribe audio" });
  }
}
