/*
 * File: src/ai/utils/dataProcessor.ts
 * Project: Cipher Intelligence Labs VSCode AI CodeGen
 * Description: Utilities for processing and transforming data structures.
 * Copyright © 2025 Cipher Intelligence Labs
 */

import { Logger } from './logger';

/**
 * Provides utility functions for data processing and transformation
 */
export class DataProcessor {
  /**
   * Safely parses JSON with error handling
   * @param jsonString - JSON string to parse
   * @param fallback - Fallback value to return if parsing fails
   * @returns Parsed JSON object or fallback value
   */
  public static safeJsonParse<T>(jsonString: string, fallback: T): T {
    try {
      return JSON.parse(jsonString) as T;
    } catch (error) {
      Logger.warn(`Failed to parse JSON: ${error instanceof Error ? error.message : String(error)}`);
      return fallback;
    }
  }

  /**
   * Safely converts an object to a JSON string
   * @param obj - Object to stringify
   * @param fallback - Fallback string to return if stringification fails
   * @returns JSON string or fallback
   */
  public static safeJsonStringify(obj: unknown, fallback: string = '{}'): string {
    try {
      return JSON.stringify(obj);
    } catch (error) {
      Logger.warn(`Failed to stringify object: ${error instanceof Error ? error.message : String(error)}`);
      return fallback;
    }
  }

  /**
   * Removes sensitive data from an object (recursively)
   * @param obj - Object to sanitize
   * @returns Sanitized object
   */
  public static sanitizeObject<T>(obj: T): T {
    if (!obj || typeof obj !== 'object') {
      return obj;
    }
    
    const sensitiveKeys = [
      'apiKey', 'api_key', 'token', 'secret', 'password', 'key', 
      'auth', 'authorization', 'credential', 'private'
    ];
    
    const result = { ...obj };
    
    Object.keys(result).forEach(key => {
      const value = (result as any)[key];
      
      // If it's a sensitive key, redact the value
      if (sensitiveKeys.some(sensitiveKey => key.toLowerCase().includes(sensitiveKey.toLowerCase()))) {
        (result as any)[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null) {
        // Recursively process nested objects
        (result as any)[key] = this.sanitizeObject(value);
      }
    });
    
    return result;
  }

  /**
   * Removes duplicate items from an array
   * @param array - Array with potential duplicates
   * @param keySelector - Optional function to select key for comparison
   * @returns Array with duplicates removed
   */
  public static removeDuplicates<T, K = T>(
    array: T[],
    keySelector?: (item: T) => K
  ): T[] {
    if (!keySelector) {
      // If no key selector provided, use simple Set-based deduplication
      return [...new Set(array)];
    }
    
    // Use Map for deduplication with a key selector
    const map = new Map<K, T>();
    
    for (const item of array) {
      const key = keySelector(item);
      if (!map.has(key)) {
        map.set(key, item);
      }
    }
    
    return Array.from(map.values());
  }

  /**
   * Groups array items by a key selector
   * @param array - Array to group
   * @param keySelector - Function to select grouping key
   * @returns Record mapping keys to arrays of items
   */
  public static groupBy<T, K extends string | number | symbol>(
    array: T[],
    keySelector: (item: T) => K
  ): Record<K, T[]> {
    return array.reduce((result, item) => {
      const key = keySelector(item);
      result[key] = result[key] || [];
      result[key].push(item);
      return result;
    }, {} as Record<K, T[]>);
  }

  /**
   * Splits an array into chunks of specified size
   * @param array - Array to split
   * @param chunkSize - Size of each chunk
   * @returns Array of chunks
   */
  public static chunk<T>(array: T[], chunkSize: number): T[][] {
    if (chunkSize <= 0) {
      throw new Error('Chunk size must be greater than 0');
    }
    
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    
    return chunks;
  }

  /**
   * Deep clones an object
   * @param obj - Object to clone
   * @returns Cloned object
   */
  public static deepClone<T>(obj: T): T {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }
    
    // For Date objects, create a new Date
    if (obj instanceof Date) {
      return new Date(obj.getTime()) as unknown as T;
    }
    
    // For arrays, create a new array and deep clone each element
    if (Array.isArray(obj)) {
      return obj.map(item => this.deepClone(item)) as unknown as T;
    }
    
    // For objects, create a new object and deep clone each property
    const cloned = {} as T;
    Object.keys(obj).forEach(key => {
      (cloned as any)[key] = this.deepClone((obj as any)[key]);
    });
    
    return cloned;
  }

  /**
   * Extracts values from an object by keys and returns a new object
   * @param obj - Source object
   * @param keys - Keys to extract
   * @returns New object with only the specified keys
   */
  public static pick<T extends object, K extends keyof T>(
    obj: T,
    keys: K[]
  ): Pick<T, K> {
    const result = {} as Pick<T, K>;
    
    for (const key of keys) {
      if (key in obj) {
        result[key] = obj[key];
      }
    }
    
    return result;
  }

  /**
   * Creates a new object without the specified keys
   * @param obj - Source object
   * @param keys - Keys to omit
   * @returns New object without the specified keys
   */
  public static omit<T extends object, K extends keyof T>(
    obj: T,
    keys: K[]
  ): Omit<T, K> {
    const result = { ...obj } as Omit<T, K>;
    
    for (const key of keys) {
      delete (result as any)[key];
    }
    
    return result;
  }
}
