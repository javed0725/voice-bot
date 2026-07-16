// @ts-nocheck
// No npm imports — uses built-in fetch so Vercel doesn't need to bundle any packages.

// Vercel serverless function config
export const config = {
  maxDuration: 30,
};

const ELEVENLABS_API_URL = "https://api.elevenlabs.io/v1/text-to-speech";

// Rachel voice — warm, clear, professional British-English accent.
// Override by passing voiceId in the request body, or swap the default here.
// Popular alternatives:
//   Adam  (pNInz6obpgmq52GQEwqc) — authoritative American male
//   Bella (EXAVITQu4vr4xnSDxMaL) — warm American female
const DEFAULT_VOICE_ID = "21m00Tcm4TlvDq8ikWAM"; // Rachel

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "ELEVENLABS_API_KEY not configured" });
    return;
  }

  const { text, voiceId = DEFAULT_VOICE_ID } = req.body ?? {};
  if (!text || typeof text !== "string" || text.trim().length === 0) {
    res.status(400).json({ error: "text is required and must be a non-empty string" });
    return;
  }

  console.log(`[tts] voiceId=${voiceId} textLength=${text.length}`);

  try {
    const response = await fetch(`${ELEVENLABS_API_URL}/${voiceId}`, {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text: text.trim(),
        model_id: "eleven_turbo_v2_5",
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
        },
      }),
    });

    if (!response.ok) {
      const err = await response.text().catch(() => "");
      console.error("[tts] ElevenLabs API error:", response.status, err.slice(0, 300));
      // Surface quota/auth errors distinctly so callers can handle them
      res.status(response.status === 401 || response.status === 403 ? 401 : 502).json({
        error: `ElevenLabs API error ${response.status}`,
        detail: err.slice(0, 200),
      });
      return;
    }

    const audioBuffer = await response.arrayBuffer();
    console.log(`[tts] success, audioBytes=${audioBuffer.byteLength}`);

    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Content-Length", String(audioBuffer.byteLength));
    res.setHeader("Cache-Control", "no-store");
    res.status(200).send(Buffer.from(audioBuffer));
  } catch (err) {
    console.error("[tts] Unexpected error:", err);
    res.status(500).json({ error: "Failed to generate speech" });
  }
}
