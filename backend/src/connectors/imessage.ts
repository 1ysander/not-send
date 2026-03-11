/**
 * iMessage connector — reads recent messages from macOS Messages (chat.db).
 * Only works on macOS. Run every few seconds to get real conversation data.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const sqlite3 = require("sqlite3");

const dbPath =
  process.env.HOME + "/Library/Messages/chat.db";

export interface IMessageRow {
  text: string | null;
  date: number;
  is_from_me: number;
}

let db: import("sqlite3").Database | null = null;

function getDb(): import("sqlite3").Database {
  if (!db) db = new sqlite3.Database(dbPath);
  return db as import("sqlite3").Database;
}

/**
 * Fetch the 20 most recent messages across all chats.
 * Resolves with rows of { text, date, is_from_me } (date is Apple epoch).
 */
export function fetchMessages(): Promise<IMessageRow[]> {
  return new Promise((resolve, reject) => {
    try {
      const database = getDb();
      database.all<IMessageRow>(
        `SELECT text, date, is_from_me
         FROM message
         WHERE text IS NOT NULL AND text != ''
         ORDER BY date DESC
         LIMIT 20`,
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows ?? []);
        }
      );
    } catch (e) {
      reject(e);
    }
  });
}

const POLL_INTERVAL_MS = 3000;
let pollTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Start polling Messages every few seconds. Call stopPolling() to clear.
 */
export function startPolling(): void {
  if (pollTimer != null) return;
  pollTimer = setInterval(() => {
    fetchMessages().catch((err) => {
      console.error("[imessage] poll error:", err);
    });
  }, POLL_INTERVAL_MS);
}

/**
 * Stop the polling interval.
 */
export function stopPolling(): void {
  if (pollTimer != null) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

// Run fetch every few seconds when this module is loaded (optional)
startPolling();
