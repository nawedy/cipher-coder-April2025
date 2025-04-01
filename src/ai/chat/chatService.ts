/*
 * File: src/ai/chat/chatService.ts
 * Project: Cipher Intelligence Labs VSCode AI CodeGen
 * Description: Handles processing of chat messages and orchestrates LLM interactions.
 * Copyright © 2025 Cipher Intelligence Labs
 */

import * as vscode from 'vscode';
import { ExternalLLMConnector } from '../apiConnector/externalLLMConnector';
import { LocalInference } from '../localLLM/localInference';
import { LLMResponse, ChatLLMResponse } from '../models/llmResponse';
import { ChatLLMRequest } from '../models/llmRequest';
import { EnvManager } from '../config/env';
import { Logger } from '../utils/logger';
import { ChatSession } from './chatController';
import { PromptParser } from '../generator/promptParser';
import { ResponsePostProcessor } from '../generator/responsePostProcessor';
import { v4 as uuidv4 } from 'uuid';

/**
 * Handles chat message processing and conversation flow
 */
export class ChatService {
  private static instance: ChatService | null = null;
  private externalConnector: ExternalLLMConnector;
  private localInference: LocalInference;
  private envManager: EnvManager;
  private promptParser: PromptParser;
  private responseProcessor: ResponsePostProcessor;
  
  /**
   * Creates an instance of ChatService
   * @param context - VSCode extension context
   */
  private constructor(context: vscode.ExtensionContext) {
    this.externalConnector = new ExternalLLMConnector(context);
    this.localInference = LocalInference.getInstance(context);
    this.envManager = EnvManager.getInstance(context);
    this.promptParser = new PromptParser();
    this.responseProcessor = new ResponsePostProcessor();
  }

  /**
   * Gets the singleton instance of ChatService
   * @param context - VSCode extension context
   * @returns The ChatService instance
   */
  public static getInstance(context: vscode.ExtensionContext): ChatService {
    if (!ChatService.instance) {
      ChatService.instance = new ChatService(context);
    }
    return ChatService.instance;
  }

  /**
   * Initializes the chat service
   * @returns Promise that resolves when initialization is complete
   */
  public async initialize(): Promise<void> {
    await this.externalConnector.initialize();
    await this.envManager.loadConfig();
  }

  /**
   * Converts a chat session to the format expected by the LLM
   * @param session - The chat session
   * @param newMessage - The new message to process
   * @returns A structured chat LLM request
   */
  private createChatRequest(session: ChatSession, newMessage: string): ChatLLMRequest {
    // Format conversation history, excluding system messages
    const conversationHistory = session.messages
      .filter(msg => msg.role !== 'system')
      .map(msg => ({
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp
      }));
    
    // Get system message if present
    const systemMessage = session.messages.find(msg => msg.role === 'system')?.content;
    
    return {
      prompt: newMessage,
      conversationHistory,
      systemMessage,
      requestId: uuidv4(),
      timestamp: Date.now()
    };
  }

  /**
   * Determines if a message is a code-related request
   * @param message - The message to check
   * @returns True if the message is likely a code request
   */
  private isCodeRequest(message: string): boolean {
    const codeKeywords = [
      'code', 'function', 'class', 'method',
      'write a', 'create a', 'implement', 'generate',
      'script', 'program', 'algorithm'
    ];
    
    const lowercaseMsg = message.toLowerCase();
    
    // Check for code keywords
    for (const keyword of codeKeywords) {
      if (lowercaseMsg.includes(keyword)) {
        return true;
      }
    }
    
    // Check if message has code patterns
    if (/function\s*\(|class\s+\w+|def\s+\w+\s*\(|import\s+/.test(message)) {
      return true;
    }
    
    return false;
  }

  /**
   * Processes a chat message and generates a response
   * @param session - The chat session
   * @param message - The new message to process
   * @param useLocalModel - Whether to use the local model
   * @returns Promise resolving to the chat response
   */
  public async processMessage(
    session: ChatSession,
    message: string,
    useLocalModel = false
  ): Promise<ChatLLMResponse> {
    try {
      Logger.info(`Processing message in session ${session.id}`);
      
      // Create chat request from session
      const chatRequest = this.createChatRequest(session, message);
      
      // Check if this is a code-related request
      const isCodeRequest = this.isCodeRequest(message);
      
      // Load configuration
      const config = await this.envManager.loadConfig();
      
      // Set appropriate parameters based on the type of request
      if (isCodeRequest) {
        chatRequest.params = {
          temperature: 0.3, // Lower temperature for code generation
          maxTokens: 1024  // More tokens for code responses
        };
      } else {
        chatRequest.params = {
          temperature: 0.7, // Higher temperature for conversational responses
          maxTokens: config.inference.maxTokens
        };
      }
      
      // Process using local or external model
      let response: ChatLLMResponse;
      if (useLocalModel) {
        Logger.debug('Using local model for chat');
        response = await this.localInference.runChatInference(chatRequest);
      } else {
        Logger.debug('Using external API for chat');
        response = await this.externalConnector.sendChatRequest(chatRequest);
      }
      
      // Handle errors
      if (response.error) {
        Logger.error(`Error in LLM response: ${response.error}`);
        throw new Error(response.error);
      }
      
      return response;
    } catch (error) {
      Logger.error(`Failed to process message: ${error instanceof Error ? error.message : String(error)}`);
      
      // Create an error response
      return {
        generatedText: `I'm sorry, I encountered an error while processing your message: ${error instanceof Error ? error.message : String(error)}`,
        finishReason: 'error',
        timestamp: Date.now(),
        requestId: uuidv4(),
        updatedConversation: session.messages.map(msg => ({
          role: msg.role,
          content: msg.content,
          timestamp: msg.timestamp
        })),
        sourceType: useLocalModel ? 'local' : 'api'
      };
    }
  }

  /**
   * Gets suggested responses for a given conversation context
   * @param session - The chat session
   * @returns Promise resolving to an array of suggested responses
   */
  public async getSuggestedResponses(session: ChatSession): Promise<string[]> {
    try {
      // Only generate suggestions if there are at least 2 messages in the conversation
      if (session.messages.length < 2) {
        return [];
      }
      
      // Get the last message in the conversation, ensuring it's from the user
      const lastMessage = session.messages[session.messages.length - 1];
      if (lastMessage.role !== 'user') {
        return [];
      }
      
      // Create a prompt for generating suggestions
      const promptText = `Based on the conversation, suggest 3 brief follow-up messages the user might want to send. Only output the suggestions, one per line, without numbering or extra text. Each suggestion should be short and to the point.`;
      
      // Create a modified chat request
      const chatRequest = this.createChatRequest(session, promptText);
      
      // Configure for concise outputs
      chatRequest.params = {
        temperature: 0.7,
        maxTokens: 150
      };
      
      // Always use the external API for suggestions (typically better at this)
      const response = await this.externalConnector.sendChatRequest(chatRequest);
      
      if (response.error || !response.generatedText) {
        return [];
      }
      
      // Parse the response into individual suggestions
      const suggestions = response.generatedText
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .slice(0, 3); // Take at most 3 suggestions
      
      return suggestions;
    } catch (error) {
      Logger.warn(`Failed to generate suggested responses: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  }

  /**
   * Analyzes code from a message
   * @param message - Message containing code
   * @returns Extracted code and language
   */
  public extractCodeFromMessage(message: string): { code: string; language: string | null } {
    const codeBlockRegex = /```(\w+)?\s*\n([\s\S]*?)```/g;
    let match;
    
    // Reset regex to start from the beginning
    codeBlockRegex.lastIndex = 0;
    match = codeBlockRegex.exec(message);
    
    if (match) {
      return {
        language: match[1] || null,
        code: match[2].trim()
      };
    }
    
    return { code: '', language: null };
  }

  /**
   * Modifies a response to focus on code generation
   * @param message - Original message requesting code
   * @param response - Original response
   * @returns Enhanced code-focused response
   */
  public async enhanceCodeResponse(message: string, response: string): Promise<string> {
    try {
      // Extract code from the response
      const { code, language } = this.extractCodeFromMessage(response);
      
      // If no code was found, return the original response
      if (!code) {
        return response;
      }
      
      // Create a prompt for formatting and improving code
      const promptText = `Improve the following ${language || ''} code to be more efficient, readable, and include helpful comments:

\`\`\`${language || ''}
${code}
\`\`\`

Original request was: "${message}"

Return only the improved code with comments explaining key parts.`;
      
      // Create a new request
      const enhancementRequest = {
        prompt: promptText,
        requestId: uuidv4(),
        timestamp: Date.now()
      };
      
      // Get enhanced code
      const enhancedResponse = await this.externalConnector.sendCompletionRequest(enhancementRequest);
      
      if (enhancedResponse.error || !enhancedResponse.generatedText) {
        return response;
      }
      
      // Extract code from the enhanced response
      const { code: enhancedCode } = this.extractCodeFromMessage(enhancedResponse.generatedText);
      
      // If enhanced code extraction failed, return original
      if (!enhancedCode) {
        return response;
      }
      
      // Format the final response
      return `Here's the code for your request:

\`\`\`${language || ''}
${enhancedCode}
\`\`\``;
    } catch (error) {
      Logger.warn(`Failed to enhance code response: ${error instanceof Error ? error.message : String(error)}`);
      return response;
    }
  }
}