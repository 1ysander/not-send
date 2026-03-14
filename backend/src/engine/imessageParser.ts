/**
 * iMessage .txt export parser.
 * Handles multiple common export formats from third-party tools and manual copies.
 *
 * Returns structured data ready for the memory bank and AI prompts.
 */

export interface ParsedMessage {
  fromPartner: boolean;
  text: string;
  timestamp?: number;
}

export interface ParseIMExportResult {
  partnerName: string;
  messageCount: number;
  sampleMessages: ParsedMessage[];
  conversationHistory: Array<{ role: "user" | "assistant"; content: string }>;
  /** Earliest and latest message timestamps as ISO strings. Null if no timestamps available. */
  dateRange: { from: string; to: string } | null;
  /** How many messages the user sent */
  userMessageCount: number;
  /** How many messages the partner sent */
  partnerMessageCount: number;
}

// ---- Format detectors & parsers ----

/**
 * Format 1: [MM/DD/YY, HH:MM AM/PM] Sender: text
 * Common in iExporter, AnyTrans, iPhone Backup Extractor
 */
const FORMAT1_LINE = /^\[(\d{1,2}\/\d{1,2}\/\d{2,4}),?\s+(\d{1,2}:\d{2}(?::\d{2})?)\s*(AM|PM)?\]\s+(.+?):\s+(.*)/i;

/**
 * Format 2: Sender | MM/DD/YYYY HH:MM\n<text on next line>
 * Some Mac Messages.app copy-paste formats
 */
const FORMAT2_HEADER = /^(.+?)\s*\|\s*\d{1,2}\/\d{1,2}\/\d{4}\s+\d{1,2}:\d{2}/;

/**
 * Format 3: [HH:MM] Sender: text   (no date, just time)
 */
const FORMAT3_LINE = /^\[\d{1,2}:\d{2}(?::\d{2})?\]\s+(.+?):\s+(.*)/;

/**
 * Format 4: Sender: text  (plain, no timestamps)
 * Fallback — least reliable
 */
const FORMAT4_LINE = /^([A-Za-z][A-Za-z0-9 ]{0,30}):\s+(.*)/;

/**
 * Format 5: iMessage timestamp-only header lines followed by Sender\ntext
 * e.g. "Jan 15, 2024 at 10:30 AM\nAlex\nhey what's up"
 */
const FORMAT5_DATE = /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},\s+\d{4}\s+at\s+\d{1,2}:\d{2}/i;

interface RawEntry {
  sender: string;
  text: string;
  timestamp?: number;
}

function parseFormat1Timestamp(datePart: string, timePart: string, ampm: string | undefined): number | undefined {
  try {
    // datePart: MM/DD/YY or MM/DD/YYYY, timePart: HH:MM or HH:MM:SS
    const [month, day, year] = datePart.split("/").map(Number);
    const fullYear = year < 100 ? 2000 + year : year;
    const [hours, minutes] = timePart.split(":").map(Number);
    let h = hours;
    if (ampm) {
      const upper = ampm.toUpperCase();
      if (upper === "PM" && h !== 12) h += 12;
      if (upper === "AM" && h === 12) h = 0;
    }
    return new Date(fullYear, month - 1, day, h, minutes).getTime();
  } catch {
    return undefined;
  }
}

function parseFormat1(lines: string[]): RawEntry[] | null {
  const entries: RawEntry[] = [];
  for (const line of lines) {
    const m = line.match(FORMAT1_LINE);
    if (m) {
      // m[1]=date m[2]=time m[3]=ampm m[4]=sender m[5]=text
      const timestamp = parseFormat1Timestamp(m[1], m[2], m[3]);
      entries.push({ sender: m[4].trim(), text: m[5].trim(), timestamp });
    }
  }
  return entries.length > 2 ? entries : null;
}

function parseFormat3(lines: string[]): RawEntry[] | null {
  const entries: RawEntry[] = [];
  for (const line of lines) {
    const m = line.match(FORMAT3_LINE);
    if (m) entries.push({ sender: m[1].trim(), text: m[2].trim() });
  }
  return entries.length > 2 ? entries : null;
}

function parseFormat2(lines: string[]): RawEntry[] | null {
  // Header line: Sender | date, next line(s) are the text
  const entries: RawEntry[] = [];
  let i = 0;
  while (i < lines.length) {
    const hm = lines[i].match(FORMAT2_HEADER);
    if (hm) {
      const sender = hm[1].trim();
      i++;
      const textLines: string[] = [];
      while (i < lines.length && !lines[i].match(FORMAT2_HEADER) && lines[i].trim()) {
        textLines.push(lines[i].trim());
        i++;
      }
      if (textLines.length > 0) {
        entries.push({ sender, text: textLines.join(" ") });
      }
    } else {
      i++;
    }
  }
  return entries.length > 2 ? entries : null;
}

function parseFormat5(lines: string[]): RawEntry[] | null {
  // Pattern: date line, sender line, text line(s)
  const entries: RawEntry[] = [];
  let i = 0;
  while (i < lines.length) {
    if (lines[i].match(FORMAT5_DATE)) {
      i++;
      const sender = lines[i]?.trim();
      if (!sender || !lines[i + 1]) { i++; continue; }
      i++;
      const textLines: string[] = [];
      while (i < lines.length && !lines[i].match(FORMAT5_DATE) && lines[i].trim()) {
        textLines.push(lines[i].trim());
        i++;
      }
      if (sender && textLines.length > 0) {
        entries.push({ sender, text: textLines.join(" ") });
      }
    } else {
      i++;
    }
  }
  return entries.length > 2 ? entries : null;
}

function parseFormat4(lines: string[]): RawEntry[] | null {
  const entries: RawEntry[] = [];
  const knownSenders = new Set<string>();

  // First pass: find repeated "Name:" patterns
  for (const line of lines) {
    const m = line.match(FORMAT4_LINE);
    if (m && !line.startsWith("http")) {
      knownSenders.add(m[1].trim());
    }
  }

  // Need at least 2 distinct senders
  if (knownSenders.size < 2) return null;

  for (const line of lines) {
    const m = line.match(FORMAT4_LINE);
    if (m && knownSenders.has(m[1].trim())) {
      entries.push({ sender: m[1].trim(), text: m[2].trim() });
    }
  }
  return entries.length > 2 ? entries : null;
}

/**
 * Identify who the "user" is vs the "partner".
 * Heuristic: the sender with fewer messages is more likely the partner
 * (users usually upload conversations where they sent fewer messages than they received,
 * or we can ask — but for now we use the minority rule).
 *
 * If `userIdentifier` is provided (e.g. "Me", "Lysander"), use that directly.
 */
function identifySenders(
  entries: RawEntry[],
  userIdentifier?: string
): { userSender: string; partnerSender: string } | null {
  const senderCounts = new Map<string, number>();
  for (const e of entries) {
    senderCounts.set(e.sender, (senderCounts.get(e.sender) ?? 0) + 1);
  }

  const senders = [...senderCounts.keys()];
  if (senders.length < 2) return null;

  // Common "me" identifiers
  const ME_IDENTIFIERS = ["me", "you", "i", "myself", "my", "self"];

  if (userIdentifier) {
    const lower = userIdentifier.toLowerCase();
    const userSender =
      senders.find((s) => s.toLowerCase() === lower) ??
      senders.find((s) => s.toLowerCase().includes(lower));
    if (userSender) {
      const partnerSender = senders.find((s) => s !== userSender) ?? senders[1];
      return { userSender, partnerSender };
    }
  }

  // Check if any sender is a known "me" identifier
  const meSender = senders.find((s) => ME_IDENTIFIERS.includes(s.toLowerCase()));
  if (meSender) {
    const partnerSender = senders.find((s) => s !== meSender) ?? senders[1];
    return { userSender: meSender, partnerSender };
  }

  // Fallback: sender with MORE messages = partner (they texted more)
  const sorted = senders.sort((a, b) => (senderCounts.get(b) ?? 0) - (senderCounts.get(a) ?? 0));
  return { userSender: sorted[1], partnerSender: sorted[0] };
}

/**
 * Parse an iMessage .txt export buffer into structured conversation data.
 *
 * @param buffer - Raw file buffer from uploaded .txt
 * @param userIdentifier - Optional: the user's name/label in the file (e.g. "Me", "Alex")
 */
export function parseIMExport(
  buffer: Buffer,
  userIdentifier?: string
): ParseIMExportResult {
  const text = buffer.toString("utf8");
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);

  // Try each format in order of specificity
  const entries =
    parseFormat1(lines) ??
    parseFormat2(lines) ??
    parseFormat5(lines) ??
    parseFormat3(lines) ??
    parseFormat4(lines) ??
    [];

  if (entries.length === 0) {
    // Return empty result — caller should handle gracefully
    return {
      partnerName: "Unknown",
      messageCount: 0,
      sampleMessages: [],
      conversationHistory: [],
      dateRange: null,
      userMessageCount: 0,
      partnerMessageCount: 0,
    };
  }

  const identified = identifySenders(entries, userIdentifier);
  if (!identified) {
    return {
      partnerName: "Unknown",
      messageCount: 0,
      sampleMessages: [],
      conversationHistory: [],
      dateRange: null,
      userMessageCount: 0,
      partnerMessageCount: 0,
    };
  }

  const { userSender, partnerSender } = identified;

  // Build parsed messages
  const parsedMessages: ParsedMessage[] = entries
    .filter((e) => e.sender === userSender || e.sender === partnerSender)
    .map((e) => ({
      fromPartner: e.sender === partnerSender,
      text: e.text,
      timestamp: e.timestamp,
    }))
    .filter((m) => m.text.length > 0);

  // Sample messages: up to 50 partner messages spread across the conversation
  // (pick evenly to capture full range of their style, not just beginning)
  const partnerMsgs = parsedMessages.filter((m) => m.fromPartner);
  const SAMPLE_LIMIT = 50;
  let sampleMessages: ParsedMessage[];
  if (partnerMsgs.length <= SAMPLE_LIMIT) {
    sampleMessages = partnerMsgs;
  } else {
    const step = Math.floor(partnerMsgs.length / SAMPLE_LIMIT);
    sampleMessages = partnerMsgs.filter((_, i) => i % step === 0).slice(0, SAMPLE_LIMIT);
  }

  // Include some user messages in sampleMessages too
  const userMsgs = parsedMessages.filter((m) => !m.fromPartner).slice(0, 20);
  sampleMessages = [...sampleMessages, ...userMsgs];

  // Conversation history: last 20 turns for AI context (alternating for prompt)
  const conversationHistory = parsedMessages
    .slice(-40)
    .map((m) => ({
      role: (m.fromPartner ? "assistant" : "user") as "user" | "assistant",
      content: m.text,
    }));

  // Compute date range from timestamps (ISO strings)
  const timestamps = parsedMessages
    .map((m) => m.timestamp)
    .filter((t): t is number => t != null);

  const dateRange =
    timestamps.length >= 2
      ? {
          from: new Date(Math.min(...timestamps)).toISOString(),
          to: new Date(Math.max(...timestamps)).toISOString(),
        }
      : null;

  const partnerMessages = parsedMessages.filter((m) => m.fromPartner);
  const userMessages = parsedMessages.filter((m) => !m.fromPartner);

  return {
    partnerName: partnerSender,
    messageCount: parsedMessages.length,
    sampleMessages,
    conversationHistory,
    dateRange,
    userMessageCount: userMessages.length,
    partnerMessageCount: partnerMessages.length,
  };
}
