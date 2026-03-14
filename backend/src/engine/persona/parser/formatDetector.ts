/**
 * formatDetector — classify raw conversation text into a known format.
 * No LLM calls. Pure string analysis.
 */

import type { FormatType } from "../models/PersonaTypes.js";

// iMessage export: [2024-03-15 10:23] or [3/15/24, 10:23 AM] or similar
const TIMESTAMP_PATTERNS = [
  /\[\d{4}-\d{2}-\d{2}[\s,]+\d{1,2}:\d{2}/,      // [2024-03-15 10:23
  /\[\d{1,2}\/\d{1,2}\/\d{2,4},?\s+\d{1,2}:\d{2}/, // [3/15/24, 10:23
  /^\d{1,2}\/\d{1,2}\/\d{2,4},\s+\d{1,2}:\d{2}/m,  // WhatsApp: 3/15/24, 10:23 -
];

// Structured copy-paste: "Name: message"
const SENDER_LINE_PATTERN = /^([^:\n]{1,40}):\s+\S/;

export function detectFormat(rawText: string): FormatType {
  // Check for timestamp patterns first
  for (const pattern of TIMESTAMP_PATTERNS) {
    if (pattern.test(rawText)) return "IMESSAGE_EXPORT";
  }

  // Check what fraction of non-empty lines look like "Sender: message"
  const lines = rawText.split("\n").filter((l) => l.trim().length > 0);
  if (lines.length === 0) return "UNSTRUCTURED_RAW";

  const matchCount = lines.filter((l) => SENDER_LINE_PATTERN.test(l.trim())).length;
  const matchRatio = matchCount / lines.length;

  if (matchRatio >= 0.4) return "STRUCTURED_COPYPASTE";

  return "UNSTRUCTURED_RAW";
}
