/*
 * File: src/ai/apiConnector/apiErrorHandler.ts
 * Project: Cipher Intelligence Labs VSCode AI CodeGen
 * Description: Provides error handling and retry logic for API calls.
 * Copyright © 2025 Cipher Intelligence Labs
 */

import axios, { AxiosError, AxiosResponse } from 'axios';
import { Logger } from '../utils/logger';
import { z } from 'zod';

/**
 * Schema for API error type
 */
export const APIErrorTypeSchema = z.enum([
  'network',
  'timeout',
  'rate_limit',
  'authentication',
  'bad_request',
  'server',
  'unknown'
]);

/**
 * Type for API error type
 */
export type APIErrorType = z.infer<typeof APIErrorTypeSchema>;

/**
 * Schema for API error details
 */
export const APIErrorDetailsSchema = z.object({
  type: APIErrorTypeSchema,
  status: z.number().optional(),
  message: z.string(),
  retryable: z.boolean(),
  errorData: z.unknown().optional(),
});

/**
 * Type for API error details
 */
export type APIErrorDetails = z.infer<typeof APIErrorDetailsSchema>;

/**
 * Schema for Axios error response
 */
const AxiosErrorResponseSchema = z.object({
  data: z.unknown(),
  status: z.number(),
  statusText: z.string(),
  headers: z.record(z.string()),
});

/**
 * Class for handling API errors and implementing retry strategies
 */
export class APIErrorHandler {
  /**
   * Maximum number of retry attempts
   */
  private static readonly MAX_RETRIES = 3;
  
  /**
   * Base delay for exponential backoff (in milliseconds)
   */
  private static readonly BASE_DELAY = 1000;
  
  /**
   * Maximum delay for exponential backoff (in milliseconds)
   */
  private static readonly MAX_DELAY = 10000;

  /**
   * Categorizes an error by analyzing its details
   * @param error - The error to categorize
   * @returns Categorized error details
   */
  public static categorizeError(error: unknown): APIErrorDetails {
    if (axios.isAxiosError(error)) {
      // Network errors (no response)
      if (!error.response) {
        return APIErrorDetailsSchema.parse({
          type: 'network',
          message: 'Network error occurred',
          retryable: true,
          errorData: error.toJSON()
        });
      }
      
      // Response errors
      const status = error.response.status;
      
      // Handle different HTTP status codes
      if (status === 408 || error.code === 'ECONNABORTED') {
        return APIErrorDetailsSchema.parse({
          type: 'timeout',
          status,
          message: 'Request timed out',
          retryable: true,
          errorData: error.response.data
        });
      } else if (status === 429) {
        return APIErrorDetailsSchema.parse({
          type: 'rate_limit',
          status,
          message: 'Rate limit exceeded',
          retryable: true,
          errorData: error.response.data
        });
      } else if (status === 401 || status === 403) {
        return APIErrorDetailsSchema.parse({
          type: 'authentication',
          status,
          message: 'Authentication failed',
          retryable: false, // Don't retry auth errors
          errorData: error.response.data
        });
      } else if (status >= 400 && status < 500) {
        return APIErrorDetailsSchema.parse({
          type: 'bad_request',
          status,
          message: `Bad request: ${error.message}`,
          retryable: false, // Don't retry client errors
          errorData: error.response.data
        });
      } else if (status >= 500) {
        return APIErrorDetailsSchema.parse({
          type: 'server',
          status,
          message: `Server error: ${error.message}`,
          retryable: true, // Retry server errors
          errorData: error.response.data
        });
      }
    }
    
    // Default for non-Axios errors
    return APIErrorDetailsSchema.parse({
      type: 'unknown',
      message: error instanceof Error ? error.message : String(error),
      retryable: false,
      errorData: error
    });
  }

  /**
   * Calculates exponential backoff delay with jitter
   * @param attempt - Current retry attempt (0-indexed)
   * @returns Delay in milliseconds for the next retry
   */
  private static calculateBackoff(attempt: number): number {
    // Exponential backoff with base of 2: 1s, 2s, 4s, 8s...
    const exponentialDelay = Math.min(
      this.MAX_DELAY,
      this.BASE_DELAY * Math.pow(2, attempt)
    );
    
    // Add random jitter (±30%) to avoid thundering herd problem
    const jitter = (Math.random() * 0.6) - 0.3; // -0.3 to +0.3
    const delay = exponentialDelay * (1 + jitter);
    
    return Math.min(this.MAX_DELAY, Math.max(this.BASE_DELAY, delay));
  }

  /**
   * Returns promise that resolves after specified delay
   * @param ms - Milliseconds to delay
   * @returns A promise that resolves after the delay
   */
  private static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Executes a function with automatic retries
   * @param fn - Async function to execute
   * @param maxRetries - Maximum number of retry attempts (optional)
   * @returns A promise resolving to the function's result
   * @throws If all retry attempts fail
   */
  public static async retry<T>(
    fn: () => Promise<T>,
    maxRetries: number = this.MAX_RETRIES
  ): Promise<T> {
    let lastError: unknown;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        const errorDetails = this.categorizeError(error);

        // Log the error
        Logger.warn(`API call failed (attempt ${attempt + 1}/${maxRetries + 1}): ${errorDetails.message}`);
        
        // If error is not retryable or we've exhausted retries, throw
        if (!errorDetails.retryable || attempt >= maxRetries) {
          break;
        }
        
        // For rate limit errors, use the Retry-After header if available
        let delayMs = this.calculateBackoff(attempt);
        if (errorDetails.type === 'rate_limit' && axios.isAxiosError(error) && error.response) {
          const retryAfter = error.response.headers['retry-after'];
          if (retryAfter) {
            delayMs = parseInt(retryAfter, 10) * 1000;
          }
        }
        
        Logger.info(`Retrying in ${Math.round(delayMs / 1000)} seconds...`);
        await this.delay(delayMs);
      }
    }
    
    // If we reach here, we've exhausted all retries
    const finalError = this.categorizeError(lastError);
    Logger.error(`All retry attempts failed: ${finalError.message}`);
    throw new Error(`API request failed after ${maxRetries + 1} attempts: ${finalError.message}`);
  }

  /**
   * Handles a specific error by determining if it should be retried
   * @param error - The error to handle
   * @returns True if the error should be retried, false otherwise
   */
  public static shouldRetry(error: unknown): boolean {
    const errorDetails = this.categorizeError(error);
    return errorDetails.retryable;
  }
}