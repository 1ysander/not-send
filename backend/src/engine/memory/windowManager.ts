/**
 * Agent 1A: Window Manager
 * Model: pure code (deterministic array management — no LLM needed)
 *
 * Maintains a sliding window of the 15 most recent messages.
 * Returns the active window + any messages displaced this turn.
 */

import type { WindowMessage, WindowManagerOutput } from "./types.js";

const WINDOW_SIZE = 15;

export function runWindowManager(
  fullHistory: WindowMessage[],
  newMessage: WindowMessage
): WindowManagerOutput {
  // Append the new message to the full history view
  const all = [...fullHistory, newMessage];

  const previousWindowStart = Math.max(0, (fullHistory.length) - WINDOW_SIZE);
  const currentWindowStart = Math.max(0, all.length - WINDOW_SIZE);

  const active_window = all.slice(currentWindowStart);
  const overflow_messages = all.slice(previousWindowStart, currentWindowStart);

  return {
    active_window,
    overflow_messages,
    window_full: all.length >= WINDOW_SIZE,
  };
}
