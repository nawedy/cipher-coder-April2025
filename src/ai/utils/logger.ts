/*
 * File: src/ai/utils/logger.ts
 * Project: Cipher Intelligence Labs VSCode AI CodeGen
 * Description: Centralized logging utility for the application.
 * Copyright © 2025 Cipher Intelligence Labs
 */

import * as vscode from 'vscode';
import { z } from 'zod';

/**
 * Schema for log level
 */
const LogLevelSchema = z.enum(['DEBUG', 'INFO', 'WARN', 'ERROR']);

/**
 * Type for log level
 */
type LogLevel = z.infer<typeof LogLevelSchema>;

/**
 * Schema for log parameters
 */
const LogParamsSchema = z.array(z.unknown());

/**
 * Type for log parameters
 */
type LogParams = z.infer<typeof LogParamsSchema>;

/**
 * Schema for log message
 */
const LogMessageSchema = z.object({
  level: LogLevelSchema,
  levelName: z.string(),
  message: z.string(),
  params: LogParamsSchema.optional()
});

/**
 * Type for log message
 */
type LogMessage = z.infer<typeof LogMessageSchema>;

/**
 * Static class for centralized logging
 */
export class Logger {
  /**
   * Output channel for logs
   */
  private static outputChannel: vscode.OutputChannel | null = null;
  
  /**
   * Current logging level
   */
  private static logLevel: LogLevel = 'INFO';
  
  /**
   * Whether to log to console in addition to output channel
   */
  private static consoleOutput: boolean = false;
  
  /**
   * Whether to include timestamps in logs
   */
  private static includeTimestamps: boolean = true;

  /**
   * Initializes the logger
   * @param context - VSCode extension context
   * @param level - Initial log level
   * @param console - Whether to log to console
   */
  public static initialize(
    context: vscode.ExtensionContext,
    level: LogLevel = 'INFO',
    console: boolean = false
  ): void {
    if (!this.outputChannel) {
      this.outputChannel = vscode.window.createOutputChannel('AI Code Generator');
      context.subscriptions.push(this.outputChannel);
    }
    
    this.logLevel = LogLevelSchema.parse(level);
    this.consoleOutput = console;
    
    this.info('Logger initialized');
  }

  /**
   * Sets the logging level
   * @param level - New log level
   */
  public static setLogLevel(level: LogLevel): void {
    this.logLevel = LogLevelSchema.parse(level);
    this.info(`Log level set to ${level}`);
  }

  /**
   * Formats a log message with optional timestamp
   * @param level - Log level
   * @param message - Log message
   * @returns Formatted log message
   */
  private static formatMessage(level: string, message: string): string {
    const timestamp = this.includeTimestamps ? `[${new Date().toISOString()}] ` : '';
    return `${timestamp}[${level}] ${message}`;
  }

  /**
   * Writes a message to the log
   * @param level - Log level
   * @param levelName - Log level name
   * @param message - Log message
   * @param optionalParams - Additional parameters to log
   */
  private static log(
    level: LogLevel,
    levelName: string,
    message: string,
    ...optionalParams: unknown[]
  ): void {
    // Validate log message
    const logMessage = LogMessageSchema.parse({
      level,
      levelName,
      message,
      params: optionalParams.length > 0 ? optionalParams : undefined
    });

    // Check if we should log at this level
    if (this.shouldLog(level)) {
      const formattedMessage = this.formatMessage(levelName, message);
      
      // Log to output channel
      if (this.outputChannel) {
        if (optionalParams.length > 0) {
          // Format optional parameters as string
          let paramsString = '';
          try {
            paramsString = optionalParams.map(param => 
              typeof param === 'object' ? JSON.stringify(param, null, 2) : String(param)
            ).join(' ');
          } catch (error) {
            paramsString = 'Error formatting parameters';
          }
          
          this.outputChannel.appendLine(`${formattedMessage} ${paramsString}`);
        } else {
          this.outputChannel.appendLine(formattedMessage);
        }
      }
      
      // Also log to console if enabled
      if (this.consoleOutput) {
        switch (level) {
          case 'DEBUG':
            console.debug(formattedMessage, ...optionalParams);
            break;
          case 'INFO':
            console.info(formattedMessage, ...optionalParams);
            break;
          case 'WARN':
            console.warn(formattedMessage, ...optionalParams);
            break;
          case 'ERROR':
            console.error(formattedMessage, ...optionalParams);
            break;
        }
      }
    }
  }

  /**
   * Checks if we should log at the given level
   * @param level - Log level to check
   * @returns Whether we should log at this level
   */
  private static shouldLog(level: LogLevel): boolean {
    const levelOrder: Record<LogLevel, number> = {
      'DEBUG': 0,
      'INFO': 1,
      'WARN': 2,
      'ERROR': 3
    };
    return levelOrder[level] >= levelOrder[this.logLevel];
  }

  /**
   * Logs a debug message
   * @param message - Log message
   * @param optionalParams - Additional parameters to log
   */
  public static debug(message: string, ...optionalParams: unknown[]): void {
    this.log('DEBUG', 'DEBUG', message, ...optionalParams);
  }

  /**
   * Logs an info message
   * @param message - Log message
   * @param optionalParams - Additional parameters to log
   */
  public static info(message: string, ...optionalParams: unknown[]): void {
    this.log('INFO', 'INFO', message, ...optionalParams);
  }

  /**
   * Logs a warning message
   * @param message - Log message
   * @param optionalParams - Additional parameters to log
   */
  public static warn(message: string, ...optionalParams: unknown[]): void {
    this.log('WARN', 'WARN', message, ...optionalParams);
  }

  /**
   * Logs an error message
   * @param message - Log message
   * @param optionalParams - Additional parameters to log
   */
  public static error(message: string, ...optionalParams: unknown[]): void {
    this.log('ERROR', 'ERROR', message, ...optionalParams);
  }

  /**
   * Shows an information message to the user and logs it
   * @param message - Message to show
   */
  public static showInfo(message: string): void {
    this.info(`Showing info: ${message}`);
    vscode.window.showInformationMessage(message);
  }

  /**
   * Shows a warning message to the user and logs it
   * @param message - Message to show
   */
  public static showWarning(message: string): void {
    this.warn(`Showing warning: ${message}`);
    vscode.window.showWarningMessage(message);
  }

  /**
   * Shows an error message to the user and logs it
   * @param message - Message to show
   */
  public static showError(message: string): void {
    this.error(`Showing error: ${message}`);
    vscode.window.showErrorMessage(message);
  }

  /**
   * Clears the log
   */
  public static clear(): void {
    if (this.outputChannel) {
      this.outputChannel.clear();
    }
  }

  /**
   * Shows the log output panel
   */
  public static show(): void {
    if (this.outputChannel) {
      this.outputChannel.show();
    }
  }
}
