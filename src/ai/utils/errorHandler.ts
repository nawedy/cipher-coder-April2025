/*
 * File: src/ai/utils/errorHandler.ts
 * Project: Cipher Intelligence Labs VSCode AI CodeGen
 * Description: Centralized error handling utilities.
 * Copyright © 2025 Cipher Intelligence Labs
 */

import * as vscode from 'vscode';
import { Logger } from './logger';
import { z } from 'zod';

/**
 * Schema for error details
 */
const ErrorDetailsSchema = z.record(z.unknown());

/**
 * Type for error details
 */
type ErrorDetails = z.infer<typeof ErrorDetailsSchema>;

/**
 * Schema for error context
 */
const ErrorContextSchema = z.record(z.unknown());

/**
 * Type for error context
 */
type ErrorContext = z.infer<typeof ErrorContextSchema>;

/**
 * Schema for error category
 */
const ErrorCategorySchema = z.enum([
  'NETWORK',
  'VALIDATION',
  'BUSINESS',
  'TECHNICAL',
  'AUTH',
  'RESOURCE',
  'UNKNOWN'
]);

/**
 * Type for error category
 */
type ErrorCategory = z.infer<typeof ErrorCategorySchema>;

/**
 * Schema for error info
 */
const ErrorInfoSchema = z.object({
  message: z.string(),
  code: z.string().optional(),
  category: ErrorCategorySchema,
  stack: z.string().optional(),
  details: ErrorDetailsSchema
});

/**
 * Type for error info
 */
type ErrorInfo = z.infer<typeof ErrorInfoSchema>;

/**
 * Custom application error class
 */
export class AppError extends Error {
  /**
   * Error code
   */
  public readonly code: string;
  
  /**
   * Original error (if this wraps another error)
   */
  public readonly originalError?: Error;
  
  /**
   * Additional error details
   */
  public readonly details?: ErrorDetails;
  
  /**
   * Whether the error was user-facing (displayed to the user)
   */
  public userFacing: boolean = false;

  /**
   * Creates an instance of AppError
   * @param message - Error message
   * @param code - Error code
   * @param originalError - Original error if wrapping another error
   * @param details - Additional error details
   */
  constructor(
    message: string,
    code: string = 'UNKNOWN_ERROR',
    originalError?: Error,
    details?: ErrorDetails
  ) {
    super(message);
    
    // Set prototype explicitly for instanceof to work
    Object.setPrototypeOf(this, AppError.prototype);
    
    this.name = 'AppError';
    this.code = code;
    this.originalError = originalError;
    this.details = details ? ErrorDetailsSchema.parse(details) : undefined;
  }

  /**
   * Gets a string representation of the error
   * @returns Error as a string
   */
  public toString(): string {
    return `${this.name}[${this.code}]: ${this.message}`;
  }
}

/**
 * Central error handling utilities
 */
export class ErrorHandler {
  /**
   * Extension telemetry reporter for error tracking
   */
  private static telemetryReporter: {
    sendTelemetryErrorEvent: (eventName: string, properties: Record<string, unknown>) => void;
  } | null = null;

  /**
   * Sets the telemetry reporter for error tracking
   * @param reporter - Telemetry reporter with error event capability
   */
  public static setTelemetryReporter(reporter: {
    sendTelemetryErrorEvent: (eventName: string, properties: Record<string, unknown>) => void;
  }): void {
    this.telemetryReporter = reporter;
  }

  /**
   * Handles an error, logging it and optionally showing to the user
   * @param error - Error to handle
   * @param showToUser - Whether to show the error to the user
   * @param context - Additional context information
   * @returns The handled error (useful for chaining)
   */
  public static handleError(
    error: Error | AppError | unknown,
    showToUser: boolean = false,
    context: ErrorContext = {}
  ): Error | AppError {
    // Convert unknown errors to Error objects
    let processedError: Error | AppError;
    
    if (!(error instanceof Error)) {
      processedError = new Error(String(error));
    } else {
      processedError = error;
    }

    // Validate context
    const validatedContext = ErrorContextSchema.parse(context);

    // Extract error details
    const errorInfo = this.extractErrorInfo(processedError, validatedContext);
    
    // Log the error
    Logger.error(
      `${errorInfo.category}${errorInfo.code ? `[${errorInfo.code}]` : ''}: ${errorInfo.message}`,
      { stack: errorInfo.stack, details: errorInfo.details }
    );
    
    // Report the error to telemetry if available
    if (this.telemetryReporter) {
      this.telemetryReporter.sendTelemetryErrorEvent(
        errorInfo.code || 'UNCATEGORIZED_ERROR',
        {
          errorName: processedError.name,
          errorMessage: errorInfo.message,
          errorCategory: errorInfo.category,
          ...errorInfo.details
        }
      );
    }
    
    // Show error to user if requested
    if (showToUser) {
      const userMessage = this.getUserFriendlyMessage(processedError);
      vscode.window.showErrorMessage(userMessage);
      
      if (processedError instanceof AppError) {
        processedError.userFacing = true;
      }
    }
    
    return processedError;
  }

  /**
   * Extracts detailed information from an error
   * @param error - Error to extract info from
   * @param context - Additional context information
   * @returns Structured error information
   */
  private static extractErrorInfo(
    error: Error | AppError,
    context: ErrorContext
  ): ErrorInfo {
    const message = error.message || 'Unknown error occurred';
    const stack = error.stack;
    let code: string | undefined;
    let category: ErrorCategory = 'UNKNOWN';
    let details: ErrorDetails = { ...context };
    
    // Extract additional info for AppError
    if (error instanceof AppError) {
      code = error.code;
      details = { ...details, ...error.details };
      
      // Categorize based on error code
      if (code.startsWith('NET')) {
        category = 'NETWORK';
      } else if (code.startsWith('VAL')) {
        category = 'VALIDATION';
      } else if (code.startsWith('BUS')) {
        category = 'BUSINESS';
      } else if (code.startsWith('TECH')) {
        category = 'TECHNICAL';
      } else if (code.startsWith('AUTH')) {
        category = 'AUTH';
      } else if (code.startsWith('RES')) {
        category = 'RESOURCE';
      }
    } else {
      // Categorize standard errors
      if (error.name === 'TypeError' || error.name === 'RangeError' || error.name === 'SyntaxError') {
        category = 'TECHNICAL';
      } else if (error.name === 'URIError' || message.includes('network') || message.includes('connection')) {
        category = 'NETWORK';
      } else if (message.includes('permission') || message.includes('access') || message.includes('auth')) {
        category = 'AUTH';
      } else if (message.includes('not found') || message.includes('missing')) {
        category = 'RESOURCE';
      }
    }

    return ErrorInfoSchema.parse({
      message,
      code,
      category,
      stack,
      details
    });
  }

  /**
   * Creates a user-friendly error message
   * @param error - Original error
   * @returns User-friendly error message
   */
  private static getUserFriendlyMessage(error: Error | AppError): string {
    if (error instanceof AppError) {
      // Use the error message directly for AppErrors (should already be user-friendly)
      return error.message;
    }
    
    // Create a user-friendly message for standard errors
    const errorName = error.name || 'Error';
    const errorMessage = error.message || 'An unknown error occurred';
    
    // Remove technical details from message
    let userMessage = errorMessage
      .replace(/Error: /g, '')
      .replace(/\[.*?\]/g, '')
      .trim();
    
    // Add context based on error type
    if (errorName === 'TypeError' || errorName === 'SyntaxError') {
      return `Something went wrong with the application. ${userMessage}`;
    } else if (errorName === 'RangeError') {
      return `A value is outside the acceptable range. ${userMessage}`;
    } else if (errorMessage.includes('network') || errorMessage.includes('connection')) {
      return `There was a network issue. Please check your connection and try again.`;
    } else if (errorMessage.includes('permission') || errorMessage.includes('access')) {
      return `You don't have permission to perform this action. ${userMessage}`;
    } else if (errorMessage.includes('not found')) {
      return `The requested resource could not be found. ${userMessage}`;
    }
    
    // Default message
    return `An error occurred: ${userMessage}`;
  }

  /**
   * Creates a network error
   * @param message - Error message
   * @param originalError - Original error
   * @param details - Additional details
   * @returns Network AppError
   */
  public static createNetworkError(
    message: string,
    originalError?: Error,
    details?: ErrorDetails
  ): AppError {
    return new AppError(
      message,
      'NET_ERROR',
      originalError,
      details
    );
  }

  /**
   * Creates a validation error
   * @param message - Error message
   * @param originalError - Original error
   * @param details - Additional details
   * @returns Validation AppError
   */
  public static createValidationError(
    message: string,
    originalError?: Error,
    details?: ErrorDetails
  ): AppError {
    return new AppError(
      message,
      'VAL_ERROR',
      originalError,
      details
    );
  }

  /**
   * Creates an authentication error
   * @param message - Error message
   * @param originalError - Original error
   * @param details - Additional details
   * @returns Authentication AppError
   */
  public static createAuthError(
    message: string,
    originalError?: Error,
    details?: ErrorDetails
  ): AppError {
    return new AppError(
      message,
      'AUTH_ERROR',
      originalError,
      details
    );
  }

  /**
   * Creates a resource error
   * @param message - Error message
   * @param originalError - Original error
   * @param details - Additional details
   * @returns Resource AppError
   */
  public static createResourceError(
    message: string,
    originalError?: Error,
    details?: ErrorDetails
  ): AppError {
    return new AppError(
      message,
      'RES_ERROR',
      originalError,
      details
    );
  }

  /**
   * Wraps an async function with error handling
   * @param fn - Async function to wrap
   * @param showToUser - Whether to show errors to the user
   * @param context - Additional context information
   * @returns Wrapped async function
   */
  public static wrapAsync<T>(
    fn: (...args: unknown[]) => Promise<T>,
    showToUser: boolean = false,
    context: ErrorContext = {}
  ): (...args: unknown[]) => Promise<T> {
    return async (...args: unknown[]): Promise<T> => {
      try {
        return await fn(...args);
      } catch (error) {
        throw this.handleError(error, showToUser, context);
      }
    };
  }
}
    