/**
 * Canned responses when no API keys are set.
 * Used so the app works without tokens; replace with real model when keys are available.
 */

export function getCannedInterventionReply(messageAttempted: string): string {
  const openings = [
    "Hey, are you sure you're going to do this?",
    "Hold on — are you sure you want to send this right now?",
    "Before you hit send: are you sure this is what you need?",
  ];
  const opening = openings[Math.floor(Math.random() * openings.length)];
  const preview =
    messageAttempted.length > 120
      ? messageAttempted.slice(0, 117) + "..."
      : messageAttempted;
  return `${opening}

You were about to send: "${preview}"

Sending it might not give you what you're really looking for. We're here to support you on a journey of self-help — one step at a time. What do you actually need right now that isn't your ex? Take a breath. You've got this.`;
}
