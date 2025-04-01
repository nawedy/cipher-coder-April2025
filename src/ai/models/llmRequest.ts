/*
 * File: src/ai/models/llmRequest.ts
 * Project: Cipher Intelligence Labs VSCode AI CodeGen
 * Description: Defines the data structure for requests to LLM APIs or local models.
 * Copyright © 2025 Cipher Intelligence Labs
 */

import { z } from 'zod';

/**
 * Schema for generation parameters
 */
export const GenerationParamsSchema = z.object({
  maxTokens: z.number().min(1).max(4096).optional(),
  temperature: z.number().min(0).max(2).optional(),
  topP: z.number().min(0).max(1).optional(),
  frequencyPenalty: z.number().min(-2).max(2).optional(),
  presencePenalty: z.number().min(-2).max(2).optional(),
  stopSequences: z.array(z.string()).max(4).optional(),
});

/**
 * Type for generation parameters
 */
export type GenerationParams = z.infer<typeof GenerationParamsSchema>;

/**
 * Schema for code context
 */
export const CodeContextSchema = z.object({
  language: z.string(),
  surroundingCode: z.string().optional(),
  filePath: z.string().optional(),
  projectMetadata: z.record(z.unknown()).optional(),
});

/**
 * Type for code context
 */
export type CodeContext = z.infer<typeof CodeContextSchema>;

/**
 * Schema for conversation message
 */
export const ConversationMessageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string(),
  timestamp: z.number().optional(),
});

/**
 * Type for conversation message
 */
export type ConversationMessage = z.infer<typeof ConversationMessageSchema>;

/**
 * Schema for LLM request
 */
export const LLMRequestSchema = z.object({
  prompt: z.string(),
  model: z.string().optional(),
  params: GenerationParamsSchema.optional(),
  codeContext: CodeContextSchema.optional(),
  timestamp: z.number().optional(),
  requestId: z.string().uuid().optional(),
});

/**
 * Type for LLM request
 */
export type LLMRequest = z.infer<typeof LLMRequestSchema>;

/**
 * Schema for chat-specific LLM request
 */
export const ChatLLMRequestSchema = LLMRequestSchema.extend({
  conversationHistory: z.array(ConversationMessageSchema),
  systemMessage: z.string().optional(),
});

/**
 * Type for chat-specific LLM request
 */
export type ChatLLMRequest = z.infer<typeof ChatLLMRequestSchema>;

/**
 * Validates a generation parameters object
 */
export function validateGenerationParams(params: unknown): GenerationParams {
  return GenerationParamsSchema.parse(params);
}

/**
 * Validates a code context object
 */
export function validateCodeContext(context: unknown): CodeContext {
  return CodeContextSchema.parse(context);
}

/**
 * Validates a conversation message object
 */
export function validateConversationMessage(message: unknown): ConversationMessage {
  return ConversationMessageSchema.parse(message);
}

/**
 * Validates an LLM request object
 */
export function validateLLMRequest(request: unknown): LLMRequest {
  return LLMRequestSchema.parse(request);
}

/**
 * Validates a chat LLM request object
 */
export function validateChatLLMRequest(request: unknown): ChatLLMRequest {
  return ChatLLMRequestSchema.parse(request);
}
