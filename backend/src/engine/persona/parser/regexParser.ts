/**
 * regexParser — parse structured conversation formats into ParsedMessage[].
 * No LLM calls. Handles iMessage export and structured copy-paste.
 */

import type { ParsedMessage, FormatType } from "../models/PersonaTypes.js";

// iMessage: [2024-03-15 10:23:45] Name: text
// Also: [3/15/24, 10:23 AM] Name: text
const IMESSAGE_PATTERN =
  /\[?([\d\/\-]+[,\s]+[\d:]+(?:\s*[AaPp][Mm])?)\]?\s+([^:\n]{1,40}):\s*(.+)/;

// Structured copy-paste: Name: text
const COPYPASTE_PATTERN = /^([^:\n]{1,40}):\s+(.+)/;

export function parseStructured(rawText: string, format: FormatType): ParsedMessage[] {
  if (format === "UNSTRUCTURED_RAW") return [];

  const lines = rawText.split("\n");
  const messages: ParsedMessage[] = [];
  let current: ParsedMessage | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    // Skip common iMessage UI artifacts
    if (/^(Delivered|Read|Sent|Tapback|Loved|Liked|Disliked|Laughed at|Emphasized|Questioned)/.test(line)) continue;

    const match = format === "IMESSAGE_EXPORT"
      ? line.match(IMESSAGE_PATTERN)
      : line.match(COPYPASTE_PATTERN);

    if (match) {
      // Save previous message
      if (current) messages.push(current);

      if (format === "IMESSAGE_EXPORT") {
        current = {
          sender: match[2].trim(),
          text: match[3].trim(),
          timestamp: match[1].trim(),
        };
      } else {
        current = {
          sender: match[1].trim(),
          text: match[2].trim(),
        };
      }
    } else if (current) {
      // Continuation line — append to previous message
      current.text += "\n" + line;
    }
  }

  if (current) messages.push(current);

  return messages;
}
