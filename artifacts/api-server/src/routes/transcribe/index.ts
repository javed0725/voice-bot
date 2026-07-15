import { Router, type IRouter } from "express";
import { transcribeAudio } from "../../lib/gemini";

const router: IRouter = Router();

router.post("/transcribe", async (req, res): Promise<void> => {
  const { audio, mimeType } = req.body as {
    audio?: string;
    mimeType?: string;
  };

  if (!audio || typeof audio !== "string") {
    res.status(400).json({ error: "audio (base64) is required" });
    return;
  }

  const mime =
    typeof mimeType === "string" && mimeType.trim()
      ? mimeType.trim()
      : "audio/webm";

  try {
    const transcript = await transcribeAudio(audio, mime);
    res.json({ transcript });
  } catch (err) {
    req.log.error({ err }, "Failed to transcribe audio");
    res.status(502).json({ error: "Failed to transcribe audio" });
  }
});

export default router;
