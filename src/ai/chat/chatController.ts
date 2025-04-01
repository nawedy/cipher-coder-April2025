/*
 * File: src/ai/chat/chatController.ts
 * Project: Cipher Intelligence Labs VSCode AI CodeGen
 * Description: Manages chat sessions and routes user messages to appropriate handlers.
 * Copyright © 2025 Cipher Intelligence Labs
 */

import * as vscode from 'vscode';
import { v4 as uuidv4 } from 'uuid';
import { ChatService } from './chatService';
import { LLMResponse, ChatLLMResponse } from '../models/llmResponse';
import { CodeGenerator } from '../generator/codeGenerator';
import { Logger } from '../utils/logger';

/**
 * Interface for chat message
 */
export interface ChatMessage {
  /**
   * Unique message ID
   */
  id: string;
  
  /**
   * Role of the sender (user or assistant)
   */
  role: 'user' | 'assistant' | 'system';
  
  /**
   * Message content
   */
  content: string;
  
  /**
   * Timestamp of the message
   */
  timestamp: number;
  
  /**
   * Whether the message contains code
   */
  hasCode?: boolean;
  
  /**
   * Programming language of the code, if any
   */
  codeLanguage?: string;
}

/**
 * Interface for a chat session
 */
export interface ChatSession {
  /**
   * Unique session ID
   */
  id: string;
  
  /**
   * Session title
   */
  title: string;
  
  /**
   * Message history
   */
  messages: ChatMessage[];
  
  /**
   * Creation timestamp
   */
  createdAt: number;
  
  /**
   * Last updated timestamp
   */
  updatedAt: number;
  
  /**
   * System message/instruction for the chat
   */
  systemMessage?: string;
  
  /**
   * Session metadata
   */
  metadata: Record<string, unknown>;
}

/**
 * Class for managing chat sessions and routing messages
 */
export class ChatController {
  private static instance: ChatController | null = null;
  private chatService: ChatService;
  private codeGenerator: CodeGenerator;
  private sessions: Map<string, ChatSession> = new Map();
  private activeSession: string | null = null;
  private extensionContext: vscode.ExtensionContext;

  /**
   * Creates an instance of ChatController
   * @param context - VSCode extension context
   */
  private constructor(context: vscode.ExtensionContext) {
    this.extensionContext = context;
    this.chatService = ChatService.getInstance(context);
    this.codeGenerator = CodeGenerator.getInstance(context);
    this.loadSessions();
  }

  /**
   * Gets the singleton instance of ChatController
   * @param context - VSCode extension context
   * @returns The ChatController instance
   */
  public static getInstance(context: vscode.ExtensionContext): ChatController {
    if (!ChatController.instance) {
      ChatController.instance = new ChatController(context);
    }
    return ChatController.instance;
  }

  /**
   * Loads saved chat sessions from storage
   */
  private async loadSessions(): Promise<void> {
    try {
      const savedSessions = this.extensionContext.globalState.get<Record<string, ChatSession>>('chatSessions');
      
      if (savedSessions) {
        Object.values(savedSessions).forEach(session => {
          this.sessions.set(session.id, session);
        });
        
        Logger.info(`Loaded ${this.sessions.size} chat sessions`);
      }
      
      // Set active session if it exists
      const activeSessionId = this.extensionContext.globalState.get<string>('activeSession');
      if (activeSessionId && this.sessions.has(activeSessionId)) {
        this.activeSession = activeSessionId;
      } else if (this.sessions.size > 0) {
        // Use the most recent session
        const sortedSessions = Array.from(this.sessions.values())
          .sort((a, b) => b.updatedAt - a.updatedAt);
        this.activeSession = sortedSessions[0].id;
      }
    } catch (error) {
      Logger.error(`Failed to load chat sessions: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Saves chat sessions to storage
   */
  private async saveSessions(): Promise<void> {
    try {
      const sessionsObject: Record<string, ChatSession> = {};
      
      this.sessions.forEach((session, id) => {
        sessionsObject[id] = session;
      });
      
      await this.extensionContext.globalState.update('chatSessions', sessionsObject);
      
      if (this.activeSession) {
        await this.extensionContext.globalState.update('activeSession', this.activeSession);
      }
      
      Logger.debug('Chat sessions saved');
    } catch (error) {
      Logger.error(`Failed to save chat sessions: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Creates a new chat session
   * @param title - Session title
   * @param systemMessage - Optional system message/instruction
   * @returns ID of the new session
   */
  public createSession(title?: string, systemMessage?: string): string {
    const sessionId = uuidv4();
    const now = Date.now();
    
    const newSession: ChatSession = {
      id: sessionId,
      title: title || `Chat Session ${this.sessions.size + 1}`,
      messages: [],
      createdAt: now,
      updatedAt: now,
      systemMessage,
      metadata: {}
    };
    
    // Add optional system message
    if (systemMessage) {
      newSession.messages.push({
        id: uuidv4(),
        role: 'system',
        content: systemMessage,
        timestamp: now
      });
    }
    
    this.sessions.set(sessionId, newSession);
    this.activeSession = sessionId;
    
    this.saveSessions();
    
    Logger.info(`Created new chat session: ${newSession.title} (${sessionId})`);
    return sessionId;
  }

  /**
   * Gets a chat session by ID
   * @param sessionId - Session ID
   * @returns Chat session or null if not found
   */
  public getSession(sessionId: string): ChatSession | null {
    return this.sessions.get(sessionId) || null;
  }

  /**
   * Gets all chat sessions
   * @returns Array of all chat sessions
   */
  public getAllSessions(): ChatSession[] {
    return Array.from(this.sessions.values())
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }

  /**
   * Gets the active chat session
   * @returns Active session or null if none
   */
  public getActiveSession(): ChatSession | null {
    if (!this.activeSession) {
      return null;
    }
    
    return this.sessions.get(this.activeSession) || null;
  }

  /**
   * Sets the active chat session
   * @param sessionId - Session ID
   */
  public setActiveSession(sessionId: string): void {
    if (!this.sessions.has(sessionId)) {
      throw new Error(`Chat session not found: ${sessionId}`);
    }
    
    this.activeSession = sessionId;
    this.saveSessions();
  }

  /**
   * Updates a chat session
   * @param sessionId - Session ID
   * @param updates - Fields to update
   */
  public updateSession(
    sessionId: string, 
    updates: Partial<Pick<ChatSession, 'title' | 'systemMessage' | 'metadata'>>
  ): void {
    const session = this.sessions.get(sessionId);
    
    if (!session) {
      throw new Error(`Chat session not found: ${sessionId}`);
    }
    
    if (updates.title) {
      session.title = updates.title;
    }
    
    if (updates.systemMessage !== undefined) {
      session.systemMessage = updates.systemMessage;
      
      // Update or add system message in chat
      const systemMessageIndex = session.messages.findIndex(msg => msg.role === 'system');
      
      if (updates.systemMessage) {
        // Add or update system message
        if (systemMessageIndex >= 0) {
          session.messages[systemMessageIndex].content = updates.systemMessage;
        } else {
          session.messages.unshift({
            id: uuidv4(),
            role: 'system',
            content: updates.systemMessage,
            timestamp: Date.now()
          });
        }
      } else if (systemMessageIndex >= 0) {
        // Remove system message
        session.messages.splice(systemMessageIndex, 1);
      }
    }
    
    if (updates.metadata) {
      session.metadata = {
        ...session.metadata,
        ...updates.metadata
      };
    }
    
    session.updatedAt = Date.now();
    this.saveSessions();
  }

  /**
   * Deletes a chat session
   * @param sessionId - Session ID
   */
  public deleteSession(sessionId: string): void {
    if (!this.sessions.has(sessionId)) {
      throw new Error(`Chat session not found: ${sessionId}`);
    }
    
    this.sessions.delete(sessionId);
    
    // Update active session if deleted
    if (this.activeSession === sessionId) {
      const remainingSessions = this.getAllSessions();
      this.activeSession = remainingSessions.length > 0 ? remainingSessions[0].id : null;
    }
    
    this.saveSessions();
    Logger.info(`Deleted chat session: ${sessionId}`);
  }

  /**
   * Adds a user message to a chat session
   * @param sessionId - Session ID
   * @param content - Message content
   * @returns Created message
   */
  public addUserMessage(sessionId: string, content: string): ChatMessage {
    const session = this.sessions.get(sessionId);
    
    if (!session) {
      throw new Error(`Chat session not found: ${sessionId}`);
    }
    
    const message: ChatMessage = {
      id: uuidv4(),
      role: 'user',
      content,
      timestamp: Date.now()
    };
    
    // Check if message contains code
    const codeBlockRegex = /```(\w+)?\s*[\s\S]*?```/g;
    if (codeBlockRegex.test(content)) {
      message.hasCode = true;
      
      // Try to determine language
      const languageMatch = content.match(/```(\w+)/);
      if (languageMatch && languageMatch[1]) {
        message.codeLanguage = languageMatch[1];
      }
    }
    
    session.messages.push(message);
    session.updatedAt = message.timestamp;
    
    this.saveSessions();
    return message;
  }

  /**
   * Handles a user message and generates a response
   * @param sessionId - Session ID
   * @param content - Message content
   * @param useLocalModel - Whether to use local model
   * @returns Promise resolving to the assistant's response
   */
  public async handleMessage(
    sessionId: string,
    content: string,
    useLocalModel = false
  ): Promise<ChatMessage> {
    // Add user message
    this.addUserMessage(sessionId, content);
    
    const session = this.sessions.get(sessionId);
    
    if (!session) {
      throw new Error(`Chat session not found: ${sessionId}`);
    }
    
    try {
      // Process the message and get a response
      const response = await this.chatService.processMessage(
        session,
        content,
        useLocalModel
      );
      
      // Create assistant message
      const assistantMessage: ChatMessage = {
        id: uuidv4(),
        role: 'assistant',
        content: response.generatedText,
        timestamp: Date.now()
      };
      
      // Check if response contains code
      const codeBlockRegex = /```(\w+)?\s*[\s\S]*?```/g;
      if (codeBlockRegex.test(response.generatedText)) {
        assistantMessage.hasCode = true;
        
        // Try to determine language
        const languageMatch = response.generatedText.match(/```(\w+)/);
        if (languageMatch && languageMatch[1]) {
          assistantMessage.codeLanguage = languageMatch[1];
        }
      }
      
      // Add the message to the session
      session.messages.push(assistantMessage);
      session.updatedAt = assistantMessage.timestamp;
      
      this.saveSessions();
      return assistantMessage;
    } catch (error) {
      Logger.error(`Error processing message: ${error instanceof Error ? error.message : String(error)}`);
      
      // Create error message from assistant
      const errorMessage: ChatMessage = {
        id: uuidv4(),
        role: 'assistant',
        content: `I'm sorry, I encountered an error while processing your message: ${error instanceof Error ? error.message : String(error)}`,
        timestamp: Date.now()
      };
      
      session.messages.push(errorMessage);
      session.updatedAt = errorMessage.timestamp;
      
      this.saveSessions();
      return errorMessage;
    }
  }

  /**
   * Handles a code generation request specifically
   * @param sessionId - Session ID
   * @param prompt - Code generation prompt
   * @param options - Code generation options
   * @returns Generated code
   */
  public async handleCodeGeneration(
    sessionId: string,
    prompt: string,
    options: {
      language?: string;
      useLocalModel?: boolean;
      fileContext?: string;
    } = {}
  ): Promise<LLMResponse> {
    const session = this.sessions.get(sessionId);
    
    if (!session) {
      throw new Error(`Chat session not found: ${sessionId}`);
    }
    
    try {
      // Add user message to session
      this.addUserMessage(sessionId, prompt);
      
      // Generate code
      const response = await this.codeGenerator.generateCode(prompt, {
        useLocalModel: options.useLocalModel,
        language: options.language,
        fileContext: options.fileContext
      });
      
      // Format code for chat display
      let formattedResponse = '';
      if (response.language && response.generatedText) {
        formattedResponse = `\`\`\`${response.language}\n${response.generatedText}\n\`\`\``;
        
        if (response.explanation) {
          formattedResponse += `\n\n${response.explanation}`;
        }
      } else {
        formattedResponse = response.generatedText;
      }
      
      // Add assistant message
      const assistantMessage: ChatMessage = {
        id: uuidv4(),
        role: 'assistant',
        content: formattedResponse,
        timestamp: Date.now(),
        hasCode: true,
        codeLanguage: response.language
      };
      
      session.messages.push(assistantMessage);
      session.updatedAt = assistantMessage.timestamp;
      
      this.saveSessions();
      
      return response;
    } catch (error) {
      Logger.error(`Code generation error: ${error instanceof Error ? error.message : String(error)}`);
      
      // Add error message
      const errorMessage: ChatMessage = {
        id: uuidv4(),
        role: 'assistant',
        content: `I'm sorry, I encountered an error while generating code: ${error instanceof Error ? error.message : String(error)}`,
        timestamp: Date.now()
      };
      
      session.messages.push(errorMessage);
      session.updatedAt = errorMessage.timestamp;
      
      this.saveSessions();
      
      throw error;
    }
  }

  /**
   * Clears the message history for a session
   * @param sessionId - Session ID
   */
  public clearSessionHistory(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    
    if (!session) {
      throw new Error(`Chat session not found: ${sessionId}`);
    }
    
    // Keep system message if present
    const systemMessage = session.messages.find(msg => msg.role === 'system');
    
    session.messages = systemMessage ? [systemMessage] : [];
    session.updatedAt = Date.now();
    
    this.saveSessions();
    Logger.info(`Cleared history for session: ${sessionId}`);
  }
}
