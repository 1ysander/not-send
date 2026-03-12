/**
 * POST /api/parse-imessage
 * Accepts a multipart upload of an iMessage .txt export.
 * Returns parsed conversation + RelationshipMemory for AI context.
 */

import { Router } from "express";
import multer from "multer";
import { parseIMExport } from "../engine/imessageParser.js";
import { buildRelationshipMemory } from "../engine/memoryBuilder.js";
import { setPartnerContext } from "../store.js";

export const parseRoutes = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === "text/plain" || file.originalname.endsWith(".txt")) {
      cb(null, true);
    } else {
      cb(new Error("Only .txt files are accepted"));
    }
  },
});

parseRoutes.post("/", upload.single("file"), (req, res) => {
  const file = req.file;
  if (!file) {
    res.status(400).json({ error: "No file uploaded. Send a .txt iMessage export." });
    return;
  }

  // Optional: caller can hint which name is "me" to improve sender detection
  const userIdentifier =
    typeof req.body.userName === "string" ? req.body.userName : undefined;
  const deviceId =
    typeof req.body.deviceId === "string" ? req.body.deviceId : undefined;

  try {
    const parsed = parseIMExport(file.buffer, userIdentifier);

    if (parsed.messageCount === 0) {
      res.status(422).json({
        error:
          "Could not parse the conversation. Make sure this is an iMessage .txt export from a supported tool.",
      });
      return;
    }

    // Build relationship memory from parsed messages
    const relationshipMemory = buildRelationshipMemory(parsed.sampleMessages);

    const partnerContext = {
      partnerName: parsed.partnerName,
      sampleMessages: parsed.sampleMessages,
      relationshipMemory,
    };

    // Store in backend memory keyed by deviceId so subsequent chat requests can use it
    if (deviceId) {
      setPartnerContext(deviceId, partnerContext);
    }

    res.json({
      partnerName: parsed.partnerName,
      messageCount: parsed.messageCount,
      sampleMessages: parsed.sampleMessages,
      conversationHistory: parsed.conversationHistory,
      relationshipMemory,
    });
  } catch (err) {
    console.error("Parse error:", err);
    res.status(500).json({ error: "Failed to parse conversation file." });
  }
});
