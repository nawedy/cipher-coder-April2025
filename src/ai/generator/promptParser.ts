/*
 * File: src/ai/generator/promptParser.ts
 * Project: Cipher Intelligence Labs VSCode AI CodeGen
 * Description: Converts natural language prompts into structured queries for LLM processing.
 * Copyright © 2025 Cipher Intelligence Labs
 */

import { LLMRequest } from '../models/llmRequest';
import { Logger } from '../utils/logger';

/**
 * Language detection regexes and identifiers
 */
interface LanguagePattern {
  regex: RegExp;
  language: string;
}

/**
 * Interface for prompt parsing options
 */
interface PromptParsingOptions {
  /**
   * Programming language for the code
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
   * Request ID to use
   */
  requestId?: string;
}

/**
 * Handles parsing and structuring of prompts for LLM processing
 */
export class PromptParser {
  /**
   * Language detection patterns
   */
  private languagePatterns: LanguagePattern[] = [
    { regex: /javascript|nodejs|js/i, language: 'javascript' },
    { regex: /typescript|ts/i, language: 'typescript' },
    { regex: /python|py/i, language: 'python' },
    { regex: /java/i, language: 'java' },
    { regex: /c\+\+|cpp/i, language: 'cpp' },
    { regex: /c#|csharp/i, language: 'csharp' },
    { regex: /golang|go/i, language: 'go' },
    { regex: /ruby/i, language: 'ruby' },
    { regex: /php/i, language: 'php' },
    { regex: /swift/i, language: 'swift' },
    { regex: /rust/i, language: 'rust' },
    { regex: /kotlin/i, language: 'kotlin' },
    { regex: /scala/i, language: 'scala' },
    { regex: /html/i, language: 'html' },
    { regex: /css/i, language: 'css' },
    { regex: /sql/i, language: 'sql' },
    { regex: /json/i, language: 'json' },
    { regex: /yaml|yml/i, language: 'yaml' },
    { regex: /markdown|md/i, language: 'markdown' },
    { regex: /shell|bash|sh/i, language: 'shell' }
  ];

  /**
   * Detects programming language from prompt
   * @param prompt - The input prompt
   * @returns Detected language or null if none detected
   */
  public detectLanguage(prompt: string): string | null {
    // Try to detect language from prompt
    for (const pattern of this.languagePatterns) {
      if (pattern.regex.test(prompt)) {
        return pattern.language;
      }
    }
    
    // Can also try to detect by looking for language keywords and patterns
    if (/function\s*\(|const|let|var|=>/.test(prompt)) {
      return 'javascript';
    }
    if (/def\s+\w+\s*\(|import\s+\w+|from\s+\w+\s+import/.test(prompt)) {
      return 'python';
    }
    if (/public\s+(static\s+)?(void|class)/.test(prompt)) {
      return 'java';
    }
    if (/<[^>]+>|<\/\w+>/.test(prompt)) {
      return 'html';
    }
    
    return null;
  }

  /**
   * Parses a natural language prompt into a structured LLM request
   * @param prompt - Natural language prompt
   * @param options - Parsing options
   * @returns Structured LLM request
   */
  public parsePrompt(prompt: string, options: PromptParsingOptions = {}): LLMRequest {
    // Sanitize the prompt
    const sanitizedPrompt = this.sanitizePrompt(prompt);
    
    // Detect the language if not provided
    const language = options.language || this.detectLanguage(sanitizedPrompt) || 'plaintext';
    
    // Extract key information from the prompt
    const keyInfo = this.extractKeyInformation(sanitizedPrompt);
    
    // Enhance the prompt with context if available
    const enhancedPrompt = this.enhancePromptWithContext(
      sanitizedPrompt,
      language,
      options.fileContext,
      options.filePath,
      options.projectContext
    );
    
    // Build the request object
    const request: LLMRequest = {
      prompt: enhancedPrompt,
      requestId: options.requestId,
      timestamp: Date.now(),
      codeContext: {
        language,
        surroundingCode: options.fileContext,
        filePath: options.filePath,
        projectMetadata: options.projectContext
      },
      params: {
        // Set appropriate parameters based on the task
        maxTokens: this.estimateRequiredTokens(sanitizedPrompt, language),
        temperature: this.determineTemperature(sanitizedPrompt),
        topP: 1.0
      }
    };
    
    return request;
  }

  /**
   * Sanitizes a prompt by removing sensitive information and normalizing
   * @param prompt - The raw input prompt
   * @returns Sanitized prompt
   */
  private sanitizePrompt(prompt: string): string {
    let sanitized = prompt.trim();
    
    // Remove API keys, tokens, and other sensitive information
    sanitized = sanitized.replace(/api[-_]?key\s*[=:]\s*[\w\d_\-.]+/gi, 'API_KEY=REDACTED');
    sanitized = sanitized.replace(/token\s*[=:]\s*[\w\d_\-.]+/gi, 'TOKEN=REDACTED');
    sanitized = sanitized.replace(/password\s*[=:]\s*[\w\d_\-.]+/gi, 'PASSWORD=REDACTED');
    sanitized = sanitized.replace(/secret\s*[=:]\s*[\w\d_\-.]+/gi, 'SECRET=REDACTED');
    
    // Normalize whitespace
    sanitized = sanitized.replace(/\s+/g, ' ');
    
    return sanitized;
  }

  /**
   * Extracts key information from the prompt
   * @param prompt - The input prompt
   * @returns Object with key information
   */
  private extractKeyInformation(prompt: string): Record<string, unknown> {
    const info: Record<string, unknown> = {};
    
    // Extract programming language mentions
    const languageMentions = this.languagePatterns
      .filter(pattern => pattern.regex.test(prompt))
      .map(pattern => pattern.language);
    
    if (languageMentions.length > 0) {
      info.languageMentions = languageMentions;
    }
    
    // Extract frameworks or libraries mentioned
    const frameworkPatterns = [
      { regex: /react|reactjs/i, framework: 'react' },
      { regex: /angular/i, framework: 'angular' },
      { regex: /vue|vuejs/i, framework: 'vue' },
      { regex: /django/i, framework: 'django' },
      { regex: /flask/i, framework: 'flask' },
      { regex: /express|expressjs/i, framework: 'express' },
      { regex: /spring|spring boot/i, framework: 'spring' },
      { regex: /laravel/i, framework: 'laravel' },
      { regex: /tensorflow|tf/i, framework: 'tensorflow' },
      { regex: /pytorch/i, framework: 'pytorch' }
    ];
    
    const frameworkMentions = frameworkPatterns
      .filter(pattern => pattern.regex.test(prompt))
      .map(pattern => pattern.framework);
    
    if (frameworkMentions.length > 0) {
      info.frameworkMentions = frameworkMentions;
    }
    
    return info;
  }

  /**
   * Enhances a prompt with additional context
   * @param prompt - The original prompt
   * @param language - The programming language
   * @param fileContext - Current file context
   * @param filePath - Path of the file being edited
   * @param projectContext - Current project context
   * @returns Enhanced prompt
   */
  private enhancePromptWithContext(
    prompt: string,
    language: string,
    fileContext?: string,
    filePath?: string,
    projectContext?: Record<string, unknown>
  ): string {
    let enhancedPrompt = prompt;
    
    // Add language instruction if detected
    if (language && language !== 'plaintext') {
      enhancedPrompt = `Using ${language}, ${enhancedPrompt}`;
    }
    
    // Add file context if available
    if (fileContext) {
      enhancedPrompt += `\n\nHere is the relevant code context:\n\`\`\`${language}\n${fileContext}\n\`\`\``;
    }
    
    // Add file path context if available
    if (filePath) {
      const fileExtension = filePath.split('.').pop();
      enhancedPrompt += `\n\nThis code is for a file with path: ${filePath}`;
      
      if (fileExtension) {
        enhancedPrompt += ` (${fileExtension} file)`;
      }
    }
    
    // Add project context if available
    if (projectContext) {
      if (projectContext.dependencies) {
        enhancedPrompt += `\n\nProject dependencies: ${JSON.stringify(projectContext.dependencies)}`;
      }
      
      if (projectContext.frameworks) {
        enhancedPrompt += `\n\nFrameworks used: ${JSON.stringify(projectContext.frameworks)}`;
      }
    }
    
    return enhancedPrompt;
  }

  /**
   * Estimates required tokens based on prompt length and complexity
   * @param prompt - The input prompt
   * @param language - The programming language
   * @returns Estimated tokens needed
   */
  private estimateRequiredTokens(prompt: string, language: string): number {
    // Simple heuristic: base tokens + prompt length factor
    const baseTokens = 100;
    const promptLengthFactor = Math.ceil(prompt.length / 4); // Rough estimate: 1 token ≈ 4 chars
    
    // Language complexity factors
    const complexLanguages = ['cpp', 'java', 'csharp'];
    const languageComplexityFactor = complexLanguages.includes(language) ? 1.5 : 1;
    
    return Math.min(2048, Math.round((baseTokens + promptLengthFactor) * languageComplexityFactor));
  }

  /**
   * Determines appropriate temperature based on prompt content
   * @param prompt - The input prompt
   * @returns Temperature value
   */
  private determineTemperature(prompt: string): number {
    // Lower temperature for more precise tasks
    if (prompt.includes('fix') || 
        prompt.includes('debug') || 
        prompt.includes('correct') ||
        prompt.includes('error')) {
      return 0.3; // More deterministic for debugging/fixing
    }
    
    // Higher temperature for creative tasks
    if (prompt.includes('creative') || 
        prompt.includes('generate ideas') || 
        prompt.includes('alternative approaches')) {
      return 0.8; // More creative
    }
    
    // Default balanced temperature
    return 0.7;
  }

  /**
   * Creates a prompt for code explanation
   * @param code - The code to explain
   * @param language - The programming language
   * @returns Formatted explanation prompt
   */
  public createExplanationPrompt(code: string, language?: string): string {
    const detectedLanguage = language || this.detectLanguage(code) || 'code';
    
    return `Please explain the following ${detectedLanguage} code in detail, breaking down what each part does:

\`\`\`${detectedLanguage}
${code}
\`\`\`

Provide a clear explanation of:
1. What the code does overall
2. How it works step by step
3. Key functions or components
4. Any notable patterns or techniques used`;
  }

  /**
   * Creates a prompt for code improvement
   * @param existingCode - Existing code to improve
   * @param improvementDescription - Description of desired improvements
   * @param language - The programming language
   * @returns Formatted improvement prompt
   */
  public createImprovementPrompt(
    existingCode: string,
    improvementDescription: string,
    language: string
  ): string {
    return `I need to improve this ${language} code. Here's the existing code:

\`\`\`${language}
${existingCode}
\`\`\`

I want to improve it by: ${improvementDescription}

Please provide the improved code with the requested changes. Your response should include only the complete improved code.`;
  }

  /**
   * Creates a prompt for code completion
   * @param partialCode - Partial code to complete
   * @param language - The programming language
   * @param fileContext - Additional file context
   * @returns Formatted completion prompt
   */
  public createCompletionPrompt(
    partialCode: string,
    language: string,
    fileContext?: string
  ): string {
    let prompt = `Complete the following ${language} code:

\`\`\`${language}
${partialCode}
\`\`\``;

    if (fileContext) {
      prompt += `\n\nHere is additional context from the file:\n\`\`\`${language}\n${fileContext}\n\`\`\``;
    }

    prompt += `\n\nComplete the code above starting from where it cuts off. Make sure your completion is syntactically correct and follows best practices for ${language}.`;
    
    return prompt;
  }
}
