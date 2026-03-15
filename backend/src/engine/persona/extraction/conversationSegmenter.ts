/**
 * conversationSegmenter — splits conversation into temporal segments for
 * the unified psychological extraction. Each segment gets its own stats
 * so the LLM can track how the relationship evolved over time.
 *
 * If timestamps are available: segments by natural conversation gaps.
 * If no timestamps: splits into early / middle / late thirds.
 */

import type { AttributedMessage, StatisticalProfile } from "../models/PersonaTypes.js";
import { computeStatisticalProfile } from "./statisticalAnalyzer.js";

export interface ConversationSegment {
  id: number;
  label: "early" | "middle" | "late" | string;
  timeRange: string;
  messages: AttributedMessage[];
  stats: StatisticalProfile;
  formattedSample: string;   // ready-to-inject text for the extraction prompt
}

const MAX_MESSAGES_PER_SEGMENT = 50;
const MAX_SAMPLE_CHARS = 3000;

function tryParseDate(ts?: string): Date | null {
  if (!ts) return null;
  const d = new Date(ts);
  return isNaN(d.getTime()) ? null : d;
}

function formatMessage(m: AttributedMessage): string {
  const who = m.role === "target" ? "Them" : m.role === "user" ? "User" : "Other";
  return `${who}: ${m.text}`;
}

function buildFormattedSample(messages: AttributedMessage[]): string {
  // Sample up to MAX_SAMPLE_CHARS, taking evenly spaced messages
  const step = Math.max(1, Math.floor(messages.length / MAX_MESSAGES_PER_SEGMENT));
  const sampled = messages.filter((_, i) => i % step === 0).slice(0, MAX_MESSAGES_PER_SEGMENT);
  let output = sampled.map(formatMessage).join("\n");
  if (output.length > MAX_SAMPLE_CHARS) output = output.slice(0, MAX_SAMPLE_CHARS) + "\n[...truncated]";
  return output;
}

function deriveTimeRange(messages: AttributedMessage[]): string {
  const first = messages[0];
  const last = messages[messages.length - 1];
  const firstDate = tryParseDate(first.timestamp);
  const lastDate = tryParseDate(last.timestamp);
  if (firstDate && lastDate) {
    return `${firstDate.toLocaleDateString()} – ${lastDate.toLocaleDateString()}`;
  }
  return "timestamps unavailable";
}

/** Split on timestamp gaps > gapHours hours. Returns index boundaries. */
function gapBasedBoundaries(
  messages: AttributedMessage[],
  gapHours = 24
): number[] {
  const boundaries: number[] = [0];
  for (let i = 1; i < messages.length; i++) {
    const prev = tryParseDate(messages[i - 1].timestamp);
    const curr = tryParseDate(messages[i].timestamp);
    if (prev && curr) {
      const diffHours = (curr.getTime() - prev.getTime()) / (1000 * 60 * 60);
      if (diffHours > gapHours) {
        boundaries.push(i);
      }
    }
  }
  return boundaries;
}

export function segmentConversation(messages: AttributedMessage[]): ConversationSegment[] {
  // Only use non-holdout messages for extraction
  const active = messages.filter((m) => !m.isHoldout);
  if (active.length === 0) return [];

  const hasTimestamps = active.some((m) => tryParseDate(m.timestamp) !== null);

  let segmentBoundaries: Array<{ start: number; end: number; label: string }>;

  if (hasTimestamps && active.length >= 20) {
    // Attempt gap-based segmentation (split at 24h gaps)
    const gaps = gapBasedBoundaries(active, 24);

    if (gaps.length >= 3) {
      // Use up to 5 segments
      const maxSegs = 5;
      const step = Math.max(1, Math.floor(gaps.length / maxSegs));
      const selectedGaps = [
        0,
        ...gaps.filter((_, i) => i > 0 && i % step === 0),
        active.length,
      ];

      segmentBoundaries = selectedGaps.slice(0, -1).map((start, i) => ({
        start,
        end: selectedGaps[i + 1],
        label: i === 0 ? "early" : i === selectedGaps.length - 3 ? "late" : `segment_${i + 1}`,
      }));
    } else {
      // Fallback to thirds
      segmentBoundaries = buildThirdBoundaries(active);
    }
  } else {
    segmentBoundaries = buildThirdBoundaries(active);
  }

  return segmentBoundaries.map(({ start, end, label }, i) => {
    const segMessages = active.slice(start, end);
    const stats = computeStatisticalProfile(segMessages);
    return {
      id: i + 1,
      label,
      timeRange: deriveTimeRange(segMessages),
      messages: segMessages,
      stats,
      formattedSample: buildFormattedSample(segMessages),
    };
  });
}

function buildThirdBoundaries(
  active: AttributedMessage[]
): Array<{ start: number; end: number; label: string }> {
  const third = Math.floor(active.length / 3);
  return [
    { start: 0, end: third, label: "early" },
    { start: third, end: third * 2, label: "middle" },
    { start: third * 2, end: active.length, label: "late" },
  ].filter((s) => s.start < s.end);
}

/** Format all segments into the ready-to-inject text block for the extraction prompt */
export function formatSegmentsForPrompt(segments: ConversationSegment[]): string {
  return segments
    .map((seg) => {
      const s = seg.stats;
      const statsLine = [
        `avg_words=${s.avgWordCount.toFixed(1)}`,
        `emoji_freq=${(s.emojiFrequency * 100).toFixed(0)}%`,
        `double_text=${(s.doubleTextFrequency * 100).toFixed(0)}%`,
        `pct_uppercase=${(s.pctStartsUppercase * 100).toFixed(0)}%`,
        `target_msgs=${s.totalTargetMessages}`,
        `user_msgs=${s.totalUserMessages}`,
      ].join(", ");

      return [
        `--- SEGMENT ${seg.id} [${seg.label}] | ${seg.timeRange} ---`,
        `Stats: ${statsLine}`,
        `Messages (sample of ${seg.messages.length}):`,
        seg.formattedSample,
      ].join("\n");
    })
    .join("\n\n");
}
