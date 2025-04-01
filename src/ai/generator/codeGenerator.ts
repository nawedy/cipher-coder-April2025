/*
 * File: src/ai/generator/codeGenerator.ts
 * Project: Cipher Intelligence Labs VSCode AI CodeGen
 * Description: Core orchestrator for generating code, managing both external and local LLM processing.
 * Copyright © 2025 Cipher Intelligence Labs
 */

import * as vscode from 'vscode';
import { LLMRequest, ChatLLMRequest } from '../models/llmRequest';
import { LLMResponse, CodeLLMResponse } from '../models/llmResponse';
import { ExternalLLMConnector } from '../apiConnector/externalLLMConnector';
import { LocalInference } from '../localLLM/localInference';
import { PromptParser } from './promptParser';
import { ResponsePostProcessor } from './responsePostProcessor';
import { EnvManager } from '../config/env';
import { Logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

/**
 * Interface for code generation options
 */
export interface CodeGenerationOptions {
  /**
   * Whether to use local model inference
   */
  useLocalModel?: boolean;
  
  /**
   * Programming language for the generated code
   */
  language?: string;
  
  /**
   * Current file context (surrounding code)
   */
  fileContext?: string;
  
  /**
   * Path of the file being edited
   */
  filePath?: string;
  
  /**
   * Current project context (relevant files, dependencies)
   */
  projectContext?: Record<string, unknown>;
  
  /**
   * Whether to explain the generated code
   */
  explainCode?: boolean;
  
  /**
   * Whether to format the generated code
   */
  formatCode?: boolean;
}

/**
 * Class that orchestrates the code generation process
 */
export class CodeGenerator {
  private static instance: CodeGenerator | null = null;
  private externalConnector: ExternalLLMConnector;
  private localInference: LocalInference;
  private promptParser: PromptParser;
  private postProcessor: ResponsePostProcessor;
  private envManager: EnvManager;
  static createForTesting: any;
  
  /**
   * Creates an instance of CodeGenerator
   * @param context - VSCode extension context
   */
  private constructor(context: vscode.ExtensionContext) {
    this.externalConnector = new ExternalLLMConnector(context);
    this.localInference = LocalInference.getInstance(context);
    this.promptParser = new PromptParser();
    this.postProcessor = new ResponsePostProcessor();
    this.envManager = EnvManager.getInstance(context);
  }

  /**
   * Gets the singleton instance of CodeGenerator
   * @param context - VSCode extension context
   * @returns The CodeGenerator instance
   */
  public static getInstance(context: vscode.ExtensionContext): CodeGenerator {
    if (!CodeGenerator.instance) {
      CodeGenerator.instance = new CodeGenerator(context);
    }
    return CodeGenerator.instance;
  }

  /**
   * Initializes the code generator
   * @returns Promise that resolves when initialization is complete
   */
  public async initialize(): Promise<void> {
    await this.externalConnector.initialize();
    // Load configuration
    await this.envManager.loadConfig();
  }

  /**
   * Generates code based on a natural language prompt
   * @param prompt - Natural language prompt
   * @param options - Code generation options
   * @returns Promise resolving to the code generation response
   */
  public async generateCode(
    prompt: string,
    options: CodeGenerationOptions = {}
  ): Promise<CodeLLMResponse> {
    const requestId = uuidv4();
    const startTime = Date.now();
    
    try {
      Logger.info(`Generating code for prompt: "${prompt.substring(0, 50)}..."`);
      
      // Parse the prompt into a structured LLM request
      const request = this.promptParser.parsePrompt(prompt, {
        language: options.language,
        fileContext: options.fileContext,
        filePath: options.filePath,
        projectContext: options.projectContext,
        requestId
      });
      
      // Determine whether to use local or external model
      const useLocalModel = options.useLocalModel ?? false;
      
      // Generate the code using the appropriate model
      let response: LLMResponse;
      if (useLocalModel) {
        Logger.debug('Using local model for code generation');
        response = await this.localInference.runInference(request);
      } else {
        Logger.debug('Using external API for code generation');
        response = await this.externalConnector.sendCompletionRequest(request);
      }
      
      // Post-process the response
      const processedResponse = await this.postProcessor.processResponse(response, {
        prompt,
        language: options.language,
        formatCode: options.formatCode ?? true,
        explainCode: options.explainCode ?? false
      });
      
      const latency = Date.now() - startTime;
      
      // Create code-specific response
      const codeResponse: CodeLLMResponse = {
        ...processedResponse,
        language: options.language || this.promptParser.detectLanguage(prompt) || 'plaintext',
        latency
      };
      
      Logger.info(`Code generation completed in ${latency}ms`);
      
      return codeResponse;
    } catch (error) {
      Logger.error(`Code generation failed: ${error instanceof Error ? error.message : String(error)}`);
      
      // Return error response
      return {
        generatedText: '',
        language: options.language || 'plaintext',
        error: `Code generation failed: ${error instanceof Error ? error.message : String(error)}`,
        timestamp: Date.now(),
        finishReason: 'error',
        requestId,
        latency: Date.now() - startTime
      };
    }
  }

  /**
   * Generates an explanation for a code snippet
   * @param code - Code to explain
   * @param language - Programming language of the code
   * @returns Promise resolving to the explanation
   */
  public async explainCode(code: string, language?: string): Promise<string> {
    try {
      const prompt = this.promptParser.createExplanationPrompt(code, language);
      
      const request: LLMRequest = {
        prompt,
        requestId: uuidv4()
      };
      
      // Use external API for explanations as they're usually better at this task
      const response = await this.externalConnector.sendCompletionRequest(request);
      
      if (response.error) {
        throw new Error(response.error);
      }
      
      return response.generatedText;
    } catch (error) {
      Logger.error(`Code explanation failed: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Improves existing code based on a description or improvement request
   * @param existingCode - The existing code to improve
   * @param improvementDescription - Description of desired improvements
   * @param options - Code generation options
   * @returns Promise resolving to the improved code
   */
  public async improveCode(
    existingCode: string,
    improvementDescription: string,
    options: CodeGenerationOptions = {}
  ): Promise<CodeLLMResponse> {
    const language = options.language || this.promptParser.detectLanguage(existingCode) || 'plaintext';
    
    // Create a prompt for code improvement
    const prompt = this.promptParser.createImprovementPrompt(
      existingCode,
      improvementDescription,
      language
    );
    
    // Use the standard code generation flow with the specialized prompt
    return this.generateCode(prompt, {
      ...options,
      language
    });
  }

  /**
   * Completes partial code based on the existing code and context
   * @param partialCode - Partial code to complete
   * @param options - Code generation options
   * @returns Promise resolving to the completed code
   */
  public async completeCode(
    partialCode: string,
    options: CodeGenerationOptions = {}
  ): Promise<CodeLLMResponse> {
    const language = options.language || this.promptParser.detectLanguage(partialCode) || 'plaintext';
    
    // Create a prompt for code completion
    const prompt = this.promptParser.createCompletionPrompt(
      partialCode,
      language,
      options.fileContext
    );
    
    // Generate code with the completion prompt
    return this.generateCode(prompt, {
      ...options,
      language
    });
  }
}
