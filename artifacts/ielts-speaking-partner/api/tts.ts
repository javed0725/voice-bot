// @ts-nocheck
// No npm imports — uses built-in fetch so Vercel doesn't need to bundle any packages.

// Vercel serverless function config
export const config = {
  maxDuration: 30,
};

const ELEVENLABS_BASE = "https://api.elevenlabs.io/v1/text-to-speech";

// Rachel voice — warm, clear, professional.
// Popular alternatives:
//   Adam  (pNInz6obpgmq52GQEwqc) — authoritative American male
//   Bella (EXAVITQu4vr4xnSDxMaL) — warm American female
const DEFAULT_VOICE_ID = "21m00Tcm4TlvDq8ikWAM"; // Rachel

// eleven_turbo_v2 is available on all ElevenLabs plans including free tier.
// eleven_turbo_v2_5 / eleven_flash_v2_5 require a paid plan — avoid for now.
const MODEL_ID = "eleven_turbo_v2";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    console.error("[tts] ELEVENLABS_API_KEY is not set in environment");
    res.status(500).json({ error: "ELEVENLABS_API_KEY not configured" });
    return;
  }

  const { text, voiceId = DEFAULT_VOICE_ID } = req.body ?? {};
  if (!text || typeof text !== "string" || text.trim().length === 0) {
    res.status(400).json({ error: "text is required and must be a non-empty string" });
    return;
  }

  const trimmedText = text.trim();
  console.log(`[tts] voiceId=${voiceId} model=${MODEL_ID} textLength=${trimmedText.length}`);

  // mp3_44100_128 is the default output format; explicit avoids any plan-gating
  // on higher-quality formats (mp3_44100_192, pcm_*, etc.).
  const url = `${ELEVENLABS_BASE}/${voiceId}?output_format=mp3_44100_128`;

  const requestBody = {
    text: trimmedText,
    model_id: MODEL_ID,
    voice_settings: {
      stability: 0.5,
      similarity_boost: 0.75,
    },
  };

  let response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify(requestBody),
    });
  } catch (fetchErr) {
    // Network-level failure (DNS, timeout, connection refused, etc.)
    console.error("[tts] Network error calling ElevenLabs:", fetchErr?.message ?? fetchErr);
    res.status(500).json({ error: "Network error reaching ElevenLabs", detail: String(fetchErr) });
    return;
  }

  if (!response.ok) {
    // Read the full body so we can log and surface the exact ElevenLabs error message.
    let errBody = "";
    try {
      errBody = await response.text();
    } catch (_) {
      errBody = "(could not read response body)";
    }
    // Log the complete error so it appears in Vercel function logs.
    console.error(
      `[tts] ElevenLabs returned HTTP ${response.status}.\n` +
      `  voiceId: ${voiceId}\n` +
      `  model:   ${MODEL_ID}\n` +
      `  url:     ${url}\n` +
      `  body:    ${errBody}`
    );
    const clientStatus = response.status === 401 || response.status === 403 ? 401 : 502;
    res.status(clientStatus).json({
      error: `ElevenLabs API error ${response.status}`,
      detail: errBody,
    });
    return;
  }

  let audioBuffer;
  try {
    audioBuffer = await response.arrayBuffer();
  } catch (bufErr) {
    console.error("[tts] Failed to read audio buffer from ElevenLabs response:", bufErr);
    res.status(502).json({ error: "Failed to read audio from ElevenLabs" });
    return;
  }

  console.log(`[tts] success — audioBytes=${audioBuffer.byteLength}`);
  res.setHeader("Content-Type", "audio/mpeg");
  res.setHeader("Content-Length", String(audioBuffer.byteLength));
  res.setHeader("Cache-Control", "no-store");
  res.status(200).send(Buffer.from(audioBuffer));
}
