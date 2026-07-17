import { Router, type IRouter } from "express";
import {
  SendGeminiChatMessageBody,
  SendGeminiChatMessageResponse,
} from "@workspace/api-zod";
import { getExaminerReply } from "../../lib/gemini";

const router: IRouter = Router();

router.post("/gemini/chat", async (req, res): Promise<void> => {
  const parsed = SendGeminiChatMessageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  if (parsed.data.messages.length === 0) {
    res.status(400).json({ error: "messages must not be empty" });
    return;
  }

  try {
    const examinerReply = await getExaminerReply(
      parsed.data.messages,
      parsed.data.topic,
      undefined, // dayId (German course day)
      undefined, // phase (German course phase)
      parsed.data.level,
    );
    res.json(SendGeminiChatMessageResponse.parse(examinerReply));
  } catch (err) {
    req.log.error({ err }, "Failed to get examiner reply from Gemini");
    res.status(502).json({ error: "Failed to reach the AI examiner" });
  }
});

export default router;
