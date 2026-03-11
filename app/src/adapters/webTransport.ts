/**
 * Web implementation of IReviewTransport using the existing backend API.
 * Use this in the website; extension/mobile can implement their own transport.
 */

import {
  createSession,
  streamChat,
  updateSessionOutcome,
} from "../api";
import type { IReviewTransport } from "../core/transport";
import type { CreateSessionOptions } from "../core/types";

const INTERVENTION_MESSAGE_ROLE = "user";

function toApiUserContext(options?: CreateSessionOptions) {
  if (!options?.userContext) return undefined;
  const { userContext } = options;
  return {
    breakupSummary: userContext.breakupSummary,
    partnerName: userContext.partnerName,
    conversationContext: userContext.conversationContext,
  };
}

export const webReviewTransport: IReviewTransport = {
  async createSession(message, options) {
    return createSession(message, {
      userContext: toApiUserContext(options),
      deviceId: options?.deviceId,
    });
  },

  async streamReview(sessionId, message, onChunk, options) {
    await streamChat(
      sessionId,
      message,
      [
        {
          role: INTERVENTION_MESSAGE_ROLE,
          content: `I was about to send: ${message}`,
        },
      ],
      onChunk,
      {
        userContext: toApiUserContext(options),
        deviceId: options?.deviceId,
      }
    );
  },

  async recordOutcome(sessionId, outcome) {
    await updateSessionOutcome(sessionId, outcome);
  },
};
