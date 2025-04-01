/*
 * File: src/ai/models/llmResponse.ts
 * Project: Cipher Intelligence Labs VSCode AI CodeGen
 * Description: Defines the data structure for responses from LLM APIs or local models.
 * Copyright © 2025 Cipher Intelligence Labs
 */

import { z } from 'zod';
import { ConversationMessageSchema } from './llmRequest';

/**
 * Schema for token usage statistics
 */
export const TokenUsageSchema = z.object({
  promptTokens: z.number().min(0),
  completionTokens: z.number().min(0),
  totalTokens: z.number().min(0),
});

/**
 * Type for token usage statistics
 */
export type TokenUsage = z.infer<typeof TokenUsageSchema>;

/**
 * Schema for finish reasons
 */
export const FinishReasonSchema = z.enum([
  'stop',           // Generation completed normally
  'length',         // Maximum token limit reached
  'content_filter', // Content filter triggered
  'timeout',        // Request timed out
  'error',          // An error occurred
]);

/**
 * Type for finish reasons
 */
export type FinishReason = z.infer<typeof FinishReasonSchema>;

/**
 * Schema for base LLM response
 */
export const LLMResponseSchema = z.object({
  generatedText: z.string(),
  tokenUsage: TokenUsageSchema.optional(),
  finishReason: FinishReasonSchema.optional(),
  model: z.string().optional(),
  error: z.string().optional(),
  timestamp: z.number().optional(),
  requestId: z.string().uuid().optional(),
  latency: z.number().min(0).optional(),
});

/**
 * Type for base LLM response
 */
export type LLMResponse = z.infer<typeof LLMResponseSchema>;

/**
 * Schema for code-specific LLM response
 */
export const CodeLLMResponseSchema = LLMResponseSchema.extend({
  language: z.string(),
  explanation: z.string().optional(),
  references: z.array(z.string()).optional(),
  suggestedImports: z.array(z.string()).optional(),
  confidenceScore: z.number().min(0).max(1).optional(),
});

/**
 * Type for code-specific LLM response
 */
export type CodeLLMResponse = z.infer<typeof CodeLLMResponseSchema>;

/**
 * Schema for chat-specific LLM response
 */
export const ChatLLMResponseSchema = LLMResponseSchema.extend({
  updatedConversation: z.array(ConversationMessageSchema),
  sourceType: z.enum(['local', 'api']),
});

/**
 * Type for chat-specific LLM response
 */
export type ChatLLMResponse = z.infer<typeof ChatLLMResponseSchema>;

/**
 * Validates token usage statistics
 */
export function validateTokenUsage(usage: unknown): TokenUsage {
  return TokenUsageSchema.parse(usage);
}

/**
 * Validates a finish reason
 */
export function validateFinishReason(reason: unknown): FinishReason {
  return FinishReasonSchema.parse(reason);
}

/**
 * Validates a base LLM response
 */
export function validateLLMResponse(response: unknown): LLMResponse {
  return LLMResponseSchema.parse(response);
}

/**
 * Validates a code-specific LLM response
 */
export function validateCodeLLMResponse(response: unknown): CodeLLMResponse {
  return CodeLLMResponseSchema.parse(response);
}

/**
 * Validates a chat-specific LLM response
 */
export function validateChatLLMResponse(response: unknown): ChatLLMResponse {
  return ChatLLMResponseSchema.parse(response);
}
