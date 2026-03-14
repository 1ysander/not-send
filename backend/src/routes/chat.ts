import { Router } from "express";
import {
  streamIntervention,
  streamClosure,
  streamSupport,
  streamContactChat,
  getHistory,
} from "../engine/conversationEngine.js";
import { getIO } from "../socket.js";

export const chatRoutes = Router();

/** Intervention chat: talk user out of sending. Uses engine (AI model or canned). */
chatRoutes.post("/", async (req, res) => {
  const {
    sessionId,
    messageAttempted,
    messages,
    conversationHistory,
    userContext: bodyUserContext,
    deviceId,
  } = req.body ?? {};

  if (typeof messageAttempted !== "string" || !Array.isArray(messages)) {
    res.status(400).json({
      error: "messageAttempted (string) and messages (array) are required",
    });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  try {
    await streamIntervention(
      {
        sessionId,
        messageAttempted,
        messages,
        conversationHistory,
        userContext: bodyUserContext,
        deviceId,
      },
      (text) => res.write(`data: ${JSON.stringify({ text })}\n\n`)
    );
    if (sessionId && typeof sessionId === "string") {
      const updated = getHistory(sessionId);
      getIO()?.emit("conversation_update", { sessionId, messages: updated });
    }
  } catch (err) {
    console.error("Intervention chat error:", err);
    res.write(`data: ${JSON.stringify({ error: (err as Error).message })}\n\n`);
  }
  res.write("data: [DONE]\n\n");
  res.end();
});

/** Closure chat: simulate texting the ex for closure (no real send). */
chatRoutes.post("/closure", async (req, res) => {
  const { messages, userContext: bodyUserContext, partnerContext: bodyPartnerContext, deviceId } =
    req.body ?? {};

  if (!Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: "messages (array) is required" });
    return;
  }

  let partnerContext = bodyPartnerContext;
  if (!partnerContext?.partnerName && typeof deviceId === "string") {
    const { getPartnerContextByDevice } = await import("../engine/conversationEngine.js");
    partnerContext = getPartnerContextByDevice(deviceId);
  }
  if (!partnerContext?.partnerName) {
    res.status(400).json({
      error: "partnerContext.partnerName is required (or set partnerContext via deviceId)",
    });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  try {
    await streamClosure(
      {
        messages,
        userContext: bodyUserContext,
        partnerContext,
        deviceId,
      },
      (text) => res.write(`data: ${JSON.stringify({ text })}\n\n`)
    );
  } catch (err) {
    console.error("Closure chat error:", err);
    res.write(`data: ${JSON.stringify({ error: (err as Error).message })}\n\n`);
  }
  res.write("data: [DONE]\n\n");
  res.end();
});

/** Support / general AI chat: no "message attempted", just conversation. */
chatRoutes.post("/support", async (req, res) => {
  const { messages, userContext: bodyUserContext, partnerContext: bodyPartnerContext, deviceId } = req.body ?? {};

  if (!Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: "messages (array) is required" });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  try {
    await streamSupport(
      { messages, userContext: bodyUserContext, partnerContext: bodyPartnerContext, deviceId },
      (text) => res.write(`data: ${JSON.stringify({ text })}\n\n`)
    );
  } catch (err) {
    console.error("Support chat error:", err);
    res.write(`data: ${JSON.stringify({ error: (err as Error).message })}\n\n`);
  }
  res.write("data: [DONE]\n\n");
  res.end();
});

/** Contact chat: AI fully adopts the contact's texting style (learned from uploaded conversation). */
chatRoutes.post("/contact", async (req, res) => {
  const { messages, partnerContext: bodyPartnerContext, userContext: bodyUserContext, deviceId } = req.body ?? {};

  if (!Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: "messages (array) is required" });
    return;
  }

  let partnerContext = bodyPartnerContext;
  if (!partnerContext?.partnerName && typeof deviceId === "string") {
    const { getPartnerContextByDevice } = await import("../engine/conversationEngine.js");
    partnerContext = getPartnerContextByDevice(deviceId);
  }
  if (!partnerContext?.partnerName) {
    res.status(400).json({ error: "partnerContext.partnerName is required" });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  try {
    await streamContactChat(
      { messages, partnerContext, userContext: bodyUserContext, deviceId },
      (text) => res.write(`data: ${JSON.stringify({ text })}\n\n`)
    );
  } catch (err) {
    console.error("Contact chat error:", err);
    res.write(`data: ${JSON.stringify({ error: (err as Error).message })}\n\n`);
  }
  res.write("data: [DONE]\n\n");
  res.end();
});
