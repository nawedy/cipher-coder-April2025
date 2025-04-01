/*
 * File: src/ai/apiConnector/externalLLMConnector.ts
 * Project: Cipher Intelligence Labs VSCode AI CodeGen
 * Description: Handles communication with external LLM APIs such as OpenAI.
 * Copyright © 2025 Cipher Intelligence Labs
 */

import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { LLMRequest, ChatLLMRequest, validateLLMRequest, validateChatLLMRequest } from '../models/llmRequest';
import { LLMResponse, ChatLLMResponse, TokenUsage, FinishReason, validateLLMResponse, validateChatLLMResponse } from '../models/llmResponse';
import { EnvConfig, EnvManager } from '../config/env';
import { APIErrorHandler } from './apiErrorHandler';
import { v4 as uuidv4 } from 'uuid';
import * as vscode from 'vscode';
import { z } from 'zod';

/**
 * Schema for OpenAI API response
 */
const OpenAIResponseSchema = z.object({
  id: z.string(),
  object: z.string(),
  created: z.number(),
  model: z.string(),
  choices: z.array(z.object({
    text: z.string().optional(),
    message: z.object({
      role: z.string(),
      content: z.string()
    }).optional(),
    finish_reason: z.string(),
    index: z.number()
  })),
  usage: z.object({
    prompt_tokens: z.number(),
    completion_tokens: z.number(),
    total_tokens: z.number()
  })
});

/**
 * Type for OpenAI API response
 */
type OpenAIResponse = z.infer<typeof OpenAIResponseSchema>;

/**
 * Schema for OpenAI request data
 */
const OpenAIRequestDataSchema = z.object({
  model: z.string(),
  prompt: z.string().optional(),
  messages: z.array(z.object({
    role: z.string(),
    content: z.string()
  })).optional(),
  max_tokens: z.number().optional(),
  temperature: z.number().optional(),
  top_p: z.number().optional(),
  frequency_penalty: z.number().optional(),
  presence_penalty: z.number().optional(),
  stop: z.array(z.string()).optional()
});

/**
 * Type for OpenAI request data
 */
type OpenAIRequestData = z.infer<typeof OpenAIRequestDataSchema>;

/**
 * Class for connecting to external LLM APIs
 */
export class ExternalLLMConnector {
  private httpClient: AxiosInstance;
  private config: EnvConfig | null = null;
  private readonly envManager: EnvManager;

  /**
   * Creates an instance of ExternalLLMConnector
   * @param context - VSCode extension context
   */
  constructor(context: vscode.ExtensionContext) {
    this.envManager = EnvManager.getInstance(context);
    
    // Initialize with default axios instance
    this.httpClient = axios.create({
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Initialize the connector by loading configuration
   */
  public async initialize(): Promise<void> {
    try {
      this.config = await this.envManager.loadConfig();
      
      if (!this.config) {
        throw new Error('Failed to load configuration');
      }
      
      // Set up HTTP client with the loaded configuration
      this.httpClient = axios.create({
        baseURL: this.config.externalLLM.endpoint,
        timeout: this.config.inference.timeout,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.externalLLM.apiKey}`
        }
      });
    } catch (error) {
      throw new Error(`Failed to initialize ExternalLLMConnector: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Maps OpenAI finish reason to our FinishReason type
   * @param openaiReason - The finish reason from OpenAI
   * @returns Mapped finish reason
   */
  private mapFinishReason(openaiReason: string): FinishReason {
    const finishReasonMap: Record<string, FinishReason> = {
      'stop': 'stop',
      'length': 'length',
      'content_filter': 'content_filter',
      'null': 'error'
    };

    return finishReasonMap[openaiReason] || 'error';
  }

  /**
   * Maps OpenAI token usage to our TokenUsage type
   * @param usage - The usage data from OpenAI
   * @returns Mapped token usage
   */
  private mapTokenUsage(usage: OpenAIResponse['usage']): TokenUsage {
    return {
      promptTokens: usage.prompt_tokens,
      completionTokens: usage.completion_tokens,
      totalTokens: usage.total_tokens
    };
  }

  /**
   * Send a text completion request to the LLM API
   * @param request - The LLM request to send
   * @returns Promise resolving to an LLM response
   */
  public async sendCompletionRequest(request: LLMRequest): Promise<LLMResponse> {
    if (!this.config) {
      await this.initialize();
    }

    if (!this.config) {
      throw new Error('Failed to initialize configuration');
    }

    const startTime = Date.now();
    const requestId = request.requestId || uuidv4();

    try {
      const requestData: OpenAIRequestData = {
        model: request.model || this.config.externalLLM.defaultModel,
        prompt: request.prompt,
        max_tokens: request.params?.maxTokens || this.config.inference.maxTokens,
        temperature: request.params?.temperature || this.config.inference.temperature,
        top_p: request.params?.topP || this.config.inference.topP,
        frequency_penalty: request.params?.frequencyPenalty || this.config.inference.frequencyPenalty,
        presence_penalty: request.params?.presencePenalty || this.config.inference.presencePenalty,
        stop: request.params?.stopSequences
      };

      // Validate request data
      OpenAIRequestDataSchema.parse(requestData);

      // Use APIErrorHandler to automatically retry the request if it fails
      const response = await APIErrorHandler.retry<AxiosResponse<OpenAIResponse>>(
        () => this.httpClient.post('/completions', requestData)
      );

      // Validate response data
      const validatedResponse = OpenAIResponseSchema.parse(response.data);

      const latency = Date.now() - startTime;
      
      const result: LLMResponse = {
        generatedText: validatedResponse.choices[0]?.text || '',
        model: validatedResponse.model,
        tokenUsage: this.mapTokenUsage(validatedResponse.usage),
        finishReason: this.mapFinishReason(validatedResponse.choices[0]?.finish_reason),
        timestamp: Date.now(),
        requestId,
        latency
      };

      return validateLLMResponse(result);
    } catch (error) {
      // Create an error response
      const errorResponse: LLMResponse = {
        generatedText: '',
        error: `API request failed: ${error instanceof Error ? error.message : String(error)}`,
        timestamp: Date.now(),
        requestId,
        finishReason: 'error',
        latency: Date.now() - startTime
      };

      return validateLLMResponse(errorResponse);
    }
  }

  /**
   * Send a chat request to the LLM API
   * @param request - The chat LLM request to send
   * @returns Promise resolving to a chat LLM response
   */
  public async sendChatRequest(request: ChatLLMRequest): Promise<ChatLLMResponse> {
    if (!this.config) {
      await this.initialize();
    }

    if (!this.config) {
      throw new Error('Failed to initialize configuration');
    }

    const startTime = Date.now();
    const requestId = request.requestId || uuidv4();

    try {
      // Convert our conversation history format to OpenAI's format
      const messages = request.conversationHistory.map(msg => ({
        role: msg.role,
        content: msg.content
      }));

      // Add system message if provided
      if (request.systemMessage) {
        messages.unshift({
          role: 'system',
          content: request.systemMessage
        });
      }

      const requestData: OpenAIRequestData = {
        model: request.model || this.config.externalLLM.defaultModel,
        messages,
        max_tokens: request.params?.maxTokens || this.config.inference.maxTokens,
        temperature: request.params?.temperature || this.config.inference.temperature,
        top_p: request.params?.topP || this.config.inference.topP,
        frequency_penalty: request.params?.frequencyPenalty || this.config.inference.frequencyPenalty,
        presence_penalty: request.params?.presencePenalty || this.config.inference.presencePenalty,
        stop: request.params?.stopSequences
      };

      // Validate request data
      OpenAIRequestDataSchema.parse(requestData);

      // Use APIErrorHandler to automatically retry the request if it fails
      const response = await APIErrorHandler.retry<AxiosResponse<OpenAIResponse>>(
        () => this.httpClient.post('/chat/completions', requestData)
      );

      // Validate response data
      const validatedResponse = OpenAIResponseSchema.parse(response.data);

      const latency = Date.now() - startTime;
      const assistantMessage = validatedResponse.choices[0]?.message?.content || '';
      
      // Create updated conversation with the new assistant message
      const updatedConversation = [
        ...request.conversationHistory,
        {
          role: 'assistant' as const,
          content: assistantMessage,
          timestamp: Date.now()
        }
      ];

      const result: ChatLLMResponse = {
        generatedText: assistantMessage,
        model: validatedResponse.model,
        tokenUsage: this.mapTokenUsage(validatedResponse.usage),
        finishReason: this.mapFinishReason(validatedResponse.choices[0]?.finish_reason),
        timestamp: Date.now(),
        requestId,
        latency,
        updatedConversation,
        sourceType: 'api'
      };

      return validateChatLLMResponse(result);
    } catch (error) {
      // Create an error response
      const errorResponse: ChatLLMResponse = {
        generatedText: '',
        error: `Chat API request failed: ${error instanceof Error ? error.message : String(error)}`,
        timestamp: Date.now(),
        requestId,
        finishReason: 'error',
        latency: Date.now() - startTime,
        updatedConversation: request.conversationHistory,
        sourceType: 'api'
      };

      return validateChatLLMResponse(errorResponse);
    }
  }
}
