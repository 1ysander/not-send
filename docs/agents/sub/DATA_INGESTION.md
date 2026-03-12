# DATA_INGESTION Sub-Agent — NOTSENT Conversation Import Layer

> **Parent agent:** BACKEND
> **Scope:** `backend/src/engine/imessageParser.ts` + `backend/src/routes/parse.ts` + future connectors
> **Load order:** CLAUDE.md → BACKEND.md → this file

---

## Role

You own everything related to getting external conversation data into NOTSENT. Your output is always a normalized `ConversationMessage[]` that the AI prompt layer consumes. You do **not** write prompts, touch routes other than `parse.ts`, or modify frontend code.

---

## Directory ownership

```
backend/src/
  engine/
    imessageParser.ts       ← LIVE — Phase 1 parser (iMessage .txt export)
  routes/
    parse.ts                ← LIVE — POST /api/parse-imessage
  [future]
    services/
      ingestion/
        types.ts            ← common ConversationMessage interface (create when adding second source)
        gmailConnector.ts   ← Phase 3 stub
        slackConnector.ts   ← Phase 3 stub
```

For Phase 1, all work lives in `engine/imessageParser.ts` and `routes/parse.ts`.

---

## Canonical output type (`ParsedConversation`)

Every parser/connector — regardless of source — must produce this shape:

```ts
// backend/src/engine/imessageParser.ts (or future ingestion/types.ts)
export interface ConversationMessage {
  fromPartner: boolean;      // true = ex sent it, false = user sent it
  text: string;
  timestamp: string;         // ISO 8601 or raw string from source
}

export interface ParsedConversation {
  partnerName: string;
  messageCount: number;
  sampleMessages: ConversationMessage[];    // up to 50, partner messages only
  conversationHistory: Array<{
    role: "user" | "assistant";             // "user" = the app user, "assistant" = partner
    content: string;
  }>;
}
```

`sampleMessages` feeds the closure prompt (AI learns the ex's voice).
`conversationHistory` feeds the intervention prompt (AI understands relationship dynamic).

---

## iMessage .txt parser — exact spec

iMessage exports from iPhone look like this:

```
[Jan 5, 2024, 11:42 PM] Alex: hey are you awake
[Jan 5, 2024, 11:45 PM] Me: yeah what's up
[Jan 5, 2024, 11:46 PM] Alex: nothing just wanted to talk
[Jan 6, 2024, 9:02 AM] Me: let's talk tomorrow
```

Format variants to handle:
- `[MMM D, YYYY, h:mm AM/PM] Name: text` — standard
- `[MMM D, YYYY, h:mm:ss AM/PM] Name: text` — with seconds
- Multi-line messages: lines that don't start with `[` belong to the previous message
- Attachments: `Attachment: <filename>` — keep text, skip attachment metadata line
- Reactions: `[reacted ... to "..."]` — skip these lines

```ts
export function parseIMExport(fileContent: string): ParsedConversation {
  // 1. Split into raw message blocks (each starts with "[")
  // 2. For each block: extract timestamp, sender name, message text
  // 3. Identify partnerName: the non-"Me" sender that appears most frequently
  // 4. Build ConversationMessage[] for all messages
  // 5. sampleMessages: filter fromPartner=true, take last 50
  // 6. conversationHistory: map all to {role, content} — "Me" → "user", partner → "assistant"
  // 7. Return ParsedConversation
}
```

Edge cases to handle without throwing:
- Empty file → return `{ partnerName: "Unknown", messageCount: 0, sampleMessages: [], conversationHistory: [] }`
- Only one speaker → `partnerName` inferred from non-"Me" sender if present; else "Unknown"
- File encoding issues → `buffer.toString("utf-8")` with `replace(/\uFFFD/g, "")` to strip bad chars
- Very large files (>10MB) → truncate to last 2000 messages before parsing

---

## Upload route (`routes/parse.ts`) — exact implementation

```ts
import multer from "multer";
import { Router } from "express";
import { parseIMExport } from "../engine/imessageParser.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },  // 10MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === "text/plain" || file.originalname.endsWith(".txt")) {
      cb(null, true);
    } else {
      cb(new Error("Only .txt files are accepted"));
    }
  },
});

export const parseRoutes = Router();

parseRoutes.post("/parse-imessage", upload.single("file"), (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: "No file uploaded. Send a .txt iMessage export as 'file' field." });
    return;
  }

  try {
    const result = parseIMExport(req.file.buffer.toString("utf-8"));
    res.json(result);
  } catch (err) {
    console.error("[parse error]", err);
    res.status(422).json({ error: "Could not parse this file. Make sure it's an iMessage export (.txt)." });
  }
});
```

Mount in `index.ts`: `app.use("/api", parseRoutes)`

---

## Future connectors — interface contract

When Phase 2/3 adds new sources, each connector must implement the same async interface:

```ts
// Pattern for any future connector
export interface IngestionConnector {
  // Returns normalized messages from an external source
  fetchMessages(
    credentials: Record<string, string>,
    options?: { sinceTimestamp?: string; limit?: number }
  ): Promise<ConversationMessage[]>;
}
```

The `conversationEngine.ts` should never need to know what source the messages came from.

---

## Testing the parser (manual curl)

```bash
# Test with a real export file
curl -X POST http://localhost:3001/api/parse-imessage \
  -F "file=@/path/to/export.txt" \
  | jq '{partnerName, messageCount, sampleCount: (.sampleMessages | length)}'
```

Expected response shape:
```json
{
  "partnerName": "Alex",
  "messageCount": 847,
  "sampleMessages": [...],    // up to 50 partner messages
  "conversationHistory": [...] // all messages as {role, content}
}
```

---

## Dependencies to install

```bash
cd backend && npm install multer @types/multer
```

`multer` is the only new dependency needed for Phase 1.

---

## What to build (priority order)

1. **`parseIMExport()` in `engine/imessageParser.ts`** (P0 — app entry point)
2. **`POST /api/parse-imessage` in `routes/parse.ts`** (P0 — ties to frontend upload flow)
3. **Install `multer`** (P0 — needed for multipart upload)
4. **Large file truncation** (P1 — files >10MB should still work)
5. **Ingestion types module** `services/ingestion/types.ts` (P2 — only when second source is added)
