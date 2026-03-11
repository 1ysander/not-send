import type { ConversationContextType } from "../types";

export interface ParsedMessage {
  fromPartner: boolean;
  text: string;
}

export interface ImportResult {
  messages: ParsedMessage[];
  partnerName?: string;
  format: ConversationContextType | "unknown";
  error?: string;
}

/** WhatsApp: "24/12/2023, 14:30 - Name: message" or "12/24/23, 2:30 PM - Name: message" */
const WHATSAPP_LINE =
  /^(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}),?\s*(\d{1,2}:\d{2}(?:\s*[AP]M)?)\s*[-–—]\s*([^:]+):\s*(.*)$/i;

/** Generic / SMS: "Dec 24, 2023 2:30 PM - Name: message" or "[2023-12-24] Name: message" or "Name: message" */
const GENERIC_PREFIX = /^(\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{2,4}|[A-Za-z]+\s+\d{1,2},?\s*\d{4})?\s*[\[\]\-]*\s*([^:]+):\s*(.*)$/;
const SIMPLE_LINE = /^([^:]+):\s*(.*)$/;

function parseWhatsApp(text: string, myName: string): ParsedMessage[] {
  const lines = text.split(/\r?\n/);
  const out: ParsedMessage[] = [];
  const myLower = myName.trim().toLowerCase();
  for (const line of lines) {
    const m = line.match(WHATSAPP_LINE);
    if (!m) continue;
    const sender = m[3].trim();
    const content = m[4].trim();
    if (!content) continue;
    out.push({
      fromPartner: sender.toLowerCase() !== myLower,
      text: content,
    });
  }
  return out;
}

function parseGeneric(text: string, myName: string): ParsedMessage[] {
  const lines = text.split(/\r?\n/);
  const out: ParsedMessage[] = [];
  const myLower = myName.trim().toLowerCase();
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const genericMatch = trimmed.match(GENERIC_PREFIX);
    const simpleMatch = trimmed.match(SIMPLE_LINE);
    const match = genericMatch ?? simpleMatch;
    if (!match) continue;
    const sender = genericMatch ? (match[2] ?? "").trim() : (match[1] ?? "").trim();
    const content = genericMatch ? (match[3] ?? "").trim() : (match[2] ?? "").trim();
    if (!content || !sender) continue;
    out.push({
      fromPartner: sender.toLowerCase() !== myLower,
      text: content,
    });
  }
  return out;
}

/** Instagram: JSON from "Download Your Information" – messages folder, conversation files. */
function parseInstagramJson(text: string, myName: string): ParsedMessage[] {
  const myLower = myName.trim().toLowerCase();
  try {
    const data = JSON.parse(text) as unknown;
    const messages: Array<{ sender_name?: string; content?: string; text?: string; from?: string }> = [];

    if (Array.isArray(data)) {
      messages.push(...data);
    } else if (data && typeof data === "object" && "messages" in data && Array.isArray((data as { messages: unknown }).messages)) {
      messages.push(...((data as { messages: unknown[] }).messages as typeof messages));
    } else if (data && typeof data === "object" && "participants" in data) {
      const conv = data as { messages?: unknown[]; participants?: unknown[] };
      if (Array.isArray(conv.messages)) messages.push(...(conv.messages as typeof messages));
    }

    return messages
      .filter((m) => (m.content ?? m.text ?? "").trim())
      .map((m) => {
        const raw = (m.content ?? m.text ?? "").trim();
        const sender = (m.sender_name ?? m.from ?? "").toString().trim().toLowerCase();
        const fromPartner = sender !== myLower && sender.length > 0;
        return { fromPartner, text: raw };
      });
  } catch {
    return [];
  }
}

/** Detect format from content. */
export function detectFormat(text: string): ConversationContextType | "unknown" {
  const trimmed = text.trim();
  if (trimmed.startsWith("{")) {
    try {
      const data = JSON.parse(trimmed) as unknown;
      if (data && typeof data === "object" && ("messages" in data || Array.isArray(data))) return "instagram";
    } catch {
      // not valid json
    }
  }
  if (WHATSAPP_LINE.test(trimmed.split("\n")[0] ?? "")) return "whatsapp";
  if (GENERIC_PREFIX.test(trimmed) || SIMPLE_LINE.test(trimmed.split("\n")[0] ?? "")) return "generic";
  return "unknown";
}

/**
 * Parse pasted or uploaded conversation into messages + format.
 * myName: the user's name (so we can mark fromPartner correctly).
 * partnerName: optional; if provided and we detect one sender, we use it for partner.
 */
export function parseConversationExport(
  text: string,
  options: { myName?: string; partnerName?: string; forceFormat?: ConversationContextType }
): ImportResult {
  const myName = (options.myName ?? "Me").trim();
  const partnerName = options.partnerName?.trim();
  const forceFormat = options.forceFormat;

  let format: ConversationContextType | "unknown" = forceFormat ?? detectFormat(text);
  let messages: ParsedMessage[] = [];

  if (format === "instagram" || (format === "unknown" && text.trim().startsWith("{"))) {
    messages = parseInstagramJson(text, myName);
    if (messages.length > 0) format = "instagram";
  }
  if (messages.length === 0 && (format === "whatsapp" || format === "unknown")) {
    messages = parseWhatsApp(text, myName);
    if (messages.length > 0) format = "whatsapp";
  }
  if (messages.length === 0 && (format === "generic" || format === "sms" || format === "unknown")) {
    messages = parseGeneric(text, myName);
    if (messages.length > 0 && format === "unknown") format = "generic";
  }

  return {
    messages,
    partnerName: partnerName || undefined,
    format: format === "unknown" ? "generic" : format,
    ...(messages.length === 0 && { error: "No messages detected. Try pasting a chat export (WhatsApp, SMS, or Instagram JSON)." }),
  };
}

/** Read file as text. */
export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result ?? ""));
    r.onerror = () => reject(new Error("Could not read file"));
    r.readAsText(file, "UTF-8");
  });
}
