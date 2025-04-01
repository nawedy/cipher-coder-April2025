/*
 * File: src/ai/config/env.ts
 * Project: Cipher Intelligence Labs VSCode AI CodeGen
 * Description: Manages environment variables and secure storage of API keys using VSCode's SecretStorage.
 * Copyright © 2025 Cipher Intelligence Labs
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Interface for environment configuration
 */
export interface EnvConfig {
  externalLLM: {
    apiKey: string;
    endpoint: string;
    defaultModel: string;
    fallbackModel: string;
  };
  localLLM: {
    modelPath: string;
    useGPU: boolean;
    maxThreads: number;
    quantization: string;
  };
  inference: {
    timeout: number;
    maxTokens: number;
    temperature: number;
    topP: number;
    frequencyPenalty: number;
    presencePenalty: number;
  };
  chat: {
    contextWindow: number;
    saveHistory: boolean;
    historyPath: string;
  };
  security: {
    encryptPayloads: boolean;
    logSensitiveData: boolean;
  };
}

/**
 * Manages secure storage and retrieval of environment configuration
 */
export class EnvManager {
  private secretStorage: vscode.SecretStorage;
  private config: EnvConfig | null = null;
  private static instance: EnvManager | null = null;
  private readonly CONFIG_PATH = path.join(__dirname, 'settings.json');

  /**
   * Private constructor for singleton pattern
   * @param context - VSCode extension context providing access to SecretStorage
   */
  private constructor(context: vscode.ExtensionContext) {
    this.secretStorage = context.secrets;
  }

  /**
   * Get singleton instance of EnvManager
   * @param context - VSCode extension context
   * @returns The EnvManager instance
   */
  public static getInstance(context: vscode.ExtensionContext): EnvManager {
    if (!EnvManager.instance) {
      EnvManager.instance = new EnvManager(context);
    }
    return EnvManager.instance;
  }

  /**
   * Loads configuration from settings.json
   * @returns The loaded environment configuration
   */
  public async loadConfig(): Promise<EnvConfig> {
    try {
      // If already loaded, return cached config
      if (this.config) {
        return this.config;
      }

      // Read configuration file
      const configData = await fs.promises.readFile(this.CONFIG_PATH, 'utf8');
      this.config = JSON.parse(configData) as EnvConfig;

      // Try to get API key from secure storage
      const apiKey = await this.secretStorage.get('ai-codegen.apiKey');
      if (apiKey) {
        this.config.externalLLM.apiKey = apiKey;
      }

      return this.config;
    } catch (error) {
      throw new Error(`Failed to load configuration: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Stores API key securely in VSCode's SecretStorage
   * @param apiKey - The API key to store
   */
  public async setApiKey(apiKey: string): Promise<void> {
    try {
      await this.secretStorage.store('ai-codegen.apiKey', apiKey);
      
      // Update in-memory config if it's loaded
      if (this.config) {
        this.config.externalLLM.apiKey = apiKey;
      }
    } catch (error) {
      throw new Error(`Failed to store API key: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Updates a specific configuration setting
   * @param section - The main section of the config (e.g., 'externalLLM')
   * @param key - The specific key to update
   * @param value - The new value
   */
  public async updateConfig<T>(section: keyof EnvConfig, key: string, value: T): Promise<void> {
    try {
      // Ensure config is loaded
      if (!this.config) {
        await this.loadConfig();
      }

      // Update the value if config section exists
      if (this.config && this.config[section] && key in this.config[section]) {
        (this.config[section] as any)[key] = value;
        
        // Write updated config back to file
        await fs.promises.writeFile(
          this.CONFIG_PATH,
          JSON.stringify(this.config, null, 2),
          'utf8'
        );
      } else {
        throw new Error(`Invalid configuration path: ${String(section)}.${key}`);
      }
    } catch (error) {
      throw new Error(`Failed to update configuration: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Retrieves the stored model path
   * @returns The configured model path
   */
  public async getModelPath(): Promise<string> {
    const config = await this.loadConfig();
    return config.localLLM.modelPath;
  }

  /**
   * Sets the local model path
   * @param modelPath - Path to the local model
   */
  public async setModelPath(modelPath: string): Promise<void> {
    await this.updateConfig('localLLM', 'modelPath', modelPath);
  }
}
