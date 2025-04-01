/*
 * File: src/ai/generator/responsePostProcessor.ts
 * Project: Cipher Intelligence Labs VSCode AI CodeGen
 * Description: Processes, validates, and enhances LLM responses before presenting to the user.
 * Copyright © 2025 Cipher Intelligence Labs
 */

import * as prettier from 'prettier';
import { LLMResponse } from '../models/llmResponse';
import { Logger } from '../utils/logger';

/**
 * Interface for post-processing options
 */
interface ProcessingOptions {
  /**
   * Original prompt that generated the response
   */
  prompt: string;
  
  /**
   * Programming language of the code
   */
  language?: string;
  
  /**
   * Whether to format the code
   */
  formatCode?: boolean;
  
  /**
   * Whether to add explanations to the code
   */
  explainCode?: boolean;
  
  /**
   * Whether to validate the code
   */
  validateCode?: boolean;
  
  /**
   * Whether to check for security issues
   */
  checkSecurity?: boolean;
}

/**
 * Handles post-processing of LLM responses
 */
export class ResponsePostProcessor {
  /**
   * Mapping of language names to Prettier parser names
   */
  private readonly parserMapping: Record<string, prettier.BuiltInParserName> = {
    'javascript': 'babel',
    'typescript': 'typescript',
    'jsx': 'babel',
    'tsx': 'typescript',
    'html': 'html',
    'css': 'css',
    'json': 'json',
    'markdown': 'markdown',
    'yaml': 'yaml',
    'graphql': 'graphql'
  };
  
  /**
   * Regex pattern to extract code blocks from LLM responses
   */
  private readonly codeBlockRegex = /```(?:(\w+)\n)?([\s\S]*?)```/g;

  /**
   * Processes an LLM response, applying formatting and validation
   * @param response - The LLM response to process
   * @param options - Processing options
   * @returns Processed LLM response
   */
  public async processResponse(
    response: LLMResponse,
    options: ProcessingOptions
  ): Promise<LLMResponse> {
    // Return early if there's an error or empty response
    if (response.error || !response.generatedText) {
      return response;
    }
    
    try {
      // Extract code from response
      const extractedCode = this.extractCodeFromResponse(
        response.generatedText,
        options.language
      );
      
      // If no code was extracted, return the original response
      if (!extractedCode.code) {
        return response;
      }
      
      // Format the code if requested
      let processedCode = extractedCode.code;
      if (options.formatCode !== false) {
        processedCode = await this.formatCode(
          processedCode,
          extractedCode.language || options.language
        );
      }
      
      // Validate the code if requested
      if (options.validateCode) {
        const validationResult = this.validateCode(
          processedCode,
          extractedCode.language || options.language
        );
        
        if (!validationResult.valid) {
          Logger.warn(`Code validation failed: ${validationResult.message}`);
          // We still continue with the processed code
        }
      }
      
      // Check for security issues if requested
      if (options.checkSecurity) {
        const securityIssues = this.checkSecurityIssues(
          processedCode,
          extractedCode.language || options.language
        );
        
        if (securityIssues.length > 0) {
          Logger.warn(`Security issues found: ${securityIssues.join(', ')}`);
          // We still continue with the processed code
        }
      }
      
      // Create the updated response
      return {
        ...response,
        generatedText: processedCode
      };
    } catch (error) {
      Logger.error(`Error post-processing response: ${error instanceof Error ? error.message : String(error)}`);
      
      // Return the original response if processing failed
      return response;
    }
  }

  /**
   * Extracts code blocks from the LLM response
   * @param responseText - The full response text
   * @param defaultLanguage - Default language if none specified in code block
   * @returns Extracted code and language
   */
  private extractCodeFromResponse(
    responseText: string,
    defaultLanguage?: string
  ): { code: string; language?: string } {
    // Reset the regex to start from the beginning
    this.codeBlockRegex.lastIndex = 0;
    
    // Try to find code blocks with the markdown format ```language\ncode```
    let match = this.codeBlockRegex.exec(responseText);
    
    if (match) {
      // Markdown code block found
      const language = match[1] || defaultLanguage;
      let code = match[2].trim();
      
      // Return the first code block found
      return { code, language };
    }
    
    // No code blocks found, check if the entire response looks like code
    if (this.looksLikeCode(responseText)) {
      return { code: responseText.trim(), language: defaultLanguage };
    }
    
    // If we still can't find code, return an empty string
    return { code: responseText.trim(), language: defaultLanguage };
  }

  /**
   * Checks if text appears to be code
   * @param text - Text to check
   * @returns True if the text looks like code
   */
  private looksLikeCode(text: string): boolean {
    // Some heuristics to determine if text is likely code
    const codeIndicators = [
      // Presence of common programming constructs
      /function\s+\w+\s*\(/i,         // function declarations
      /class\s+\w+/i,                 // class declarations
      /if\s*\(.+\)\s*\{/i,            // if statements
      /for\s*\(.+\)\s*\{/i,           // for loops
      /while\s*\(.+\)\s*\{/i,         // while loops
      /import\s+.+\s+from/i,          // ES6 imports
      /export\s+(default\s+)?/i,      // ES6 exports
      /const\s+\w+\s*=/i,             // const declarations
      /let\s+\w+\s*=/i,               // let declarations
      /var\s+\w+\s*=/i,               // var declarations
      /return\s+.+;/i,                // return statements
      /\{\s*[\w'"]+\s*:/i,            // object literals
      /<\w+(\s+\w+=".*?")*\s*>/i      // HTML/XML tags
    ];
    
    // Check for code indicators
    for (const regex of codeIndicators) {
      if (regex.test(text)) {
        return true;
      }
    }
    
    // Check if a significant portion of lines end with semicolons
    const lines = text.split('\n').filter(line => line.trim().length > 0);
    if (lines.length > 3) {
      const semicolonLines = lines.filter(line => line.trim().endsWith(';')).length;
      if (semicolonLines / lines.length > 0.3) {
        return true;
      }
    }
    
    // Check for significant indentation
    const indentedLines = lines.filter(line => line.startsWith('  ') || line.startsWith('\t')).length;
    if (lines.length > 3 && indentedLines / lines.length > 0.3) {
      return true;
    }
    
    return false;
  }

  /**
   * Formats code using Prettier
   * @param code - Code to format
   * @param language - Programming language of the code
   * @returns Formatted code
   */
  private async formatCode(code: string, language?: string): Promise<string> {
    if (!code || !language) {
      return code;
    }
    
    try {
      // Get appropriate parser for the language
      const parser = this.getParserForLanguage(language);
      
      if (!parser) {
        Logger.debug(`No Prettier parser available for language: ${language}`);
        return code;
      }
      
      // Format the code using Prettier
      const formattedCode = await prettier.format(code, {
        parser,
        printWidth: 100,
        tabWidth: 2,
        singleQuote: true,
        trailingComma: 'es5',
        bracketSpacing: true,
        semi: true
      });
      
      return formattedCode;
    } catch (error) {
      Logger.warn(`Formatting failed: ${error instanceof Error ? error.message : String(error)}`);
      // Return original code if formatting fails
      return code;
    }
  }

  /**
   * Gets the appropriate Prettier parser for a language
   * @param language - Programming language
   * @returns Prettier parser name or undefined if not supported
   */
  private getParserForLanguage(language?: string): prettier.BuiltInParserName | undefined {
    if (!language) {
      return undefined;
    }
    
    // Normalize language name
    const normalizedLanguage = language.toLowerCase();
    
    // Direct mapping
    if (normalizedLanguage in this.parserMapping) {
      return this.parserMapping[normalizedLanguage as keyof typeof this.parserMapping];
    }
    
    // Special cases
    if (['js', 'jsx', 'javascript'].includes(normalizedLanguage)) {
      return 'babel';
    }
    
    if (['ts', 'tsx', 'typescript'].includes(normalizedLanguage)) {
      return 'typescript';
    }
    
    if (['md', 'markdown'].includes(normalizedLanguage)) {
      return 'markdown';
    }
    
    if (['yml', 'yaml'].includes(normalizedLanguage)) {
      return 'yaml';
    }
    
    // No matching parser
    return undefined;
  }

  /**
   * Validates code for syntax errors
   * @param code - Code to validate
   * @param language - Programming language of the code
   * @returns Validation result
   */
  private validateCode(
    code: string,
    language?: string
  ): { valid: boolean; message?: string } {
    // This is a placeholder for actual validation logic
    // In a real implementation, you would integrate language-specific validators
    
    // Basic checks for common syntax errors
    try {
      if (['javascript', 'js', 'typescript', 'ts'].includes(language || '')) {
        // Check for unbalanced brackets and braces
        const openBraces = (code.match(/\{/g) || []).length;
        const closeBraces = (code.match(/\}/g) || []).length;
        
        if (openBraces !== closeBraces) {
          return {
            valid: false,
            message: `Unbalanced braces: ${openBraces} opening vs ${closeBraces} closing`
          };
        }
        
        const openParens = (code.match(/\(/g) || []).length;
        const closeParens = (code.match(/\)/g) || []).length;
        
        if (openParens !== closeParens) {
          return {
            valid: false,
            message: `Unbalanced parentheses: ${openParens} opening vs ${closeParens} closing`
          };
        }
        
        const openBrackets = (code.match(/\[/g) || []).length;
        const closeBrackets = (code.match(/\]/g) || []).length;
        
        if (openBrackets !== closeBrackets) {
          return {
            valid: false,
            message: `Unbalanced brackets: ${openBrackets} opening vs ${closeBrackets} closing`
          };
        }
      }
      
      // Check for unclosed string literals
      const singleQuotes = (code.match(/'/g) || []).length;
      const doubleQuotes = (code.match(/"/g) || []).length;
      
      if (singleQuotes % 2 !== 0) {
        return {
          valid: false,
          message: `Odd number of single quotes: ${singleQuotes}`
        };
      }
      
      if (doubleQuotes % 2 !== 0) {
        return {
          valid: false,
          message: `Odd number of double quotes: ${doubleQuotes}`
        };
      }
      
      // More sophisticated validation would use language-specific parsers
      
      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        message: `Validation error: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Checks code for potential security issues
   * @param code - Code to check
   * @param language - Programming language of the code
   * @returns Array of security issue descriptions
   */
  private checkSecurityIssues(code: string, language?: string): string[] {
    const issues: string[] = [];
    
    // This is a placeholder for actual security checking logic
    // In a real implementation, you would integrate security analysis tools
    
    // Basic checks for common security issues
    if (['javascript', 'js', 'typescript', 'ts'].includes(language || '')) {
      // Check for eval usage
      if (/\beval\s*\(/.test(code)) {
        issues.push('Use of eval() which can lead to code injection vulnerabilities');
      }
      
      // Check for innerHTML
      if (/\.innerHTML\s*=/.test(code)) {
        issues.push('Use of innerHTML which can lead to XSS vulnerabilities');
      }
      
      // Check for document.write
      if (/document\.write\s*\(/.test(code)) {
        issues.push('Use of document.write() which can lead to XSS vulnerabilities');
      }
    }
    
    if (['python', 'py'].includes(language || '')) {
      // Check for exec/eval usage in Python
      if (/\bexec\s*\(/.test(code) || /\beval\s*\(/.test(code)) {
        issues.push('Use of exec() or eval() which can lead to code injection vulnerabilities');
      }
      
      // Check for shell=True in subprocess
      if (/subprocess\..*\(.*shell\s*=\s*True/.test(code)) {
        issues.push('Use of shell=True in subprocess which can lead to command injection vulnerabilities');
      }
    }
    
    // Check for hardcoded credentials
    if (/password\s*=\s*['"][^'"]{3,}['"]/.test(code) || 
        /api[-_]?key\s*=\s*['"][^'"]{10,}['"]/.test(code) ||
        /secret\s*=\s*['"][^'"]{10,}['"]/.test(code)) {
      issues.push('Potential hardcoded credentials detected');
    }
    
    return issues;
  }
}