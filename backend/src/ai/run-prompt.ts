#!/usr/bin/env node
/**
 * Run the AI model on a prompt (no UI). Use to test that the model answers prompts
 * using available tokens (ANTHROPIC_API_KEY or OPENAI_API_KEY).
 *
 * Usage: npm run ai:prompt
 *        npm run ai:prompt -- "Hey, are you sure you want to text your ex?"
 * Or:    npx tsx src/ai/run-prompt.ts "Your prompt here"
 */

import { chat, getAIConfig } from "./index.js";

const prompt = process.argv[2] ?? "I was about to send: I miss you. What should I do?";
const config = getAIConfig();

console.log("AI config:", config.provider, config.anthropicApiKey ? "(Anthropic key set)" : "", config.openaiApiKey ? "(OpenAI key set)" : "");
console.log("Prompt:", prompt);
console.log("---");

const { text, provider } = await chat({
  systemPrompt: `You are a calm, non-judgmental AI that intercepts messages people are about to send their ex. Be brief and supportive.`,
  messages: [{ role: "user", content: prompt }],
  messageAttempted: prompt.slice(0, 200),
});

console.log(text);
console.log("---");
console.log("Provider used:", provider);
