import { Router } from "express";
import {
  analyzeMessage,
  getCreditUsageInfo,
  getGlobalCreditUsage,
} from "../engine/conversationEngine.js";

export const engineRoutes = Router();

/** POST /api/engine/analyze — analyze a draft message; uses local credit when deviceId provided. */
engineRoutes.post("/analyze", (req, res) => {
  const { message, deviceId, consumeCredit } = req.body ?? {};
  if (typeof message !== "string") {
    res.status(400).json({ error: "message (string) is required" });
    return;
  }
  try {
    const result = analyzeMessage(message, {
      deviceId: typeof deviceId === "string" ? deviceId : undefined,
      consumeCredit: consumeCredit !== false,
    });
    res.json(result);
  } catch (err) {
    const message = (err as Error).message;
    if (message.includes("credit limit")) {
      res.status(429).json({ error: message });
      return;
    }
    res.status(500).json({ error: message });
  }
});

/** GET /api/engine/credits?deviceId= — return credit usage for device (and optional global). */
engineRoutes.get("/credits", (req, res) => {
  const deviceId = typeof req.query.deviceId === "string" ? req.query.deviceId : undefined;
  const deviceInfo = getCreditUsageInfo(deviceId);
  res.json({
    device: deviceInfo,
    global: { used: getGlobalCreditUsage() },
  });
});
