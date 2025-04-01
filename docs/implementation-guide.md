# VSCode AI Code Generator: Complete Implementation Guide

**© 2025 AI Code Generator Project**

## Table of Contents

1. [Introduction](#introduction)
2. [Prerequisites](#prerequisites)
3. [Project Setup](#project-setup)
4. [Implementing the Core AI Components](#implementing-the-core-ai-components)
5. [Standalone Desktop App Implementation](#standalone-desktop-app-implementation)
6. [VSCode Extension Implementation](#vscode-extension-implementation)
7. [Testing and Debugging](#testing-and-debugging)
8. [Packaging and Distribution](#packaging-and-distribution)
9. [Maintenance and Updates](#maintenance-and-updates)
10. [Troubleshooting](#troubleshooting)

## Introduction

This guide provides detailed instructions for implementing the VSCode AI Code Generator in two forms:

1. A standalone Electron-based desktop application for Windows, macOS, and Linux
2. A VSCode extension (.vsix) that integrates with existing VSCode installations

Both implementations share the same core AI functionality but differ in how they integrate with the VSCode environment.

## Prerequisites

Before beginning implementation, ensure you have the following:

### Development Environment

- **Node.js**: v16.x or later
- **npm**: v8.x or later (or Yarn 1.22+)
- **Git**: Latest version
- **Visual Studio Code**: Latest version (for testing)
- **TypeScript**: v4.4.x or later
- **Electron**: v15.x or later (for standalone app)
- **VSCE**: Visual Studio Code Extension CLI (for extension packaging)

### Required Knowledge

- TypeScript/JavaScript programming
- React.js for UI components
- Visual Studio Code extension API
- Basic understanding of Electron for desktop app development
- Understanding of LLM APIs (e.g., OpenAI, Hugging Face)

### Install Key Tools

```bash
# Install global development tools
npm install -g typescript vsce electron electron-builder

# Verify installations
node --version
npm --version
tsc --version
vsce --version
electron --version
```

## Project Setup

### 1. Create the Base Project Structure

```bash
#!/bin/bash
# setup-project.sh

# Create root project directory
mkdir -p vscode-ai-codegen
cd vscode-ai-codegen

# Create directory structure
mkdir -p src/ai/config
mkdir -p src/ai/models
mkdir -p src/ai/apiConnector
mkdir -p src/ai/localLLM
mkdir -p src/ai/generator
mkdir -p src/ai/chat
mkdir -p src/ai/utils
mkdir -p src/ai/tests

mkdir -p src/front/components
mkdir -p src/front/views
mkdir -p src/front/styles

mkdir -p src/vs/extensions/ai-codegen
mkdir -p docs
```

### 2. Initialize the Project

```bash
# Initialize package.json
npm init -y

# Install core dependencies
npm install --save react react-dom axios typescript @types/node @types/react @types/react-dom

# Install development dependencies
npm install --save-dev webpack webpack-cli ts-loader css-loader style-loader html-webpack-plugin electron electron-builder @types/vscode mocha chai @types/mocha @types/chai
```

### 3. Configure TypeScript

Create a `tsconfig.json` file in the root directory:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "moduleResolution": "node",
    "esModuleInterop": true,
    "strict": true,
    "jsx": "react",
    "sourceMap": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "lib": ["ES2020", "DOM"],
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### 4. Configure Package.json Scripts

Update `package.json` to include necessary scripts:

```json
{
  "scripts": {
    "build": "tsc",
    "watch": "tsc -watch",
    "test": "mocha -r ts-node/register src/**/*.test.ts",
    "package-extension": "vsce package",
    "electron-start": "electron .",
    "electron-build": "electron-builder",
    "build-all": "npm run build && npm run package-extension && npm run electron-build"
  }
}
```

## Implementing the Core AI Components

The core AI components are shared between both the standalone app and the extension, so we'll implement these first.

### 1. Configuration

#### `src/ai/config/settings.json`

```json
{
  "externalLLM": {
    "apiKey": "",
    "endpoint": "https://api.openai.com/v1/chat/completions",
    "model": "gpt-4"
  },
  "localLLM": {
    "modelPath": "",
    "useGPU": true
  },
  "inference": {
    "timeout": 30000,
    "maxTokens": 150
  }
}
```

#### `src/ai/config/env.ts`

```typescript
/**
 * File: src/ai/config/env.ts
 * Project: VSCode AI Code Generator
 * Description: Manages environment variables and secure storage of settings
 * Copyright © 2025 AI Code Generator Project
 */

import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

interface EnvConfig {
  externalLLM: {
    apiKey: string;
    endpoint: string;
    model: string;
  };
  localLLM: {
    modelPath: string;
    useGPU: boolean;
  };
  inference: {
    timeout: number;
    maxTokens: number;
  };
}

export class EnvManager {
  private static instance: EnvManager;
  private config: EnvConfig;
  private secretStorage: vscode.SecretStorage | null = null;
  private configPath: string;

  private constructor(configPath?: string, secretStorage?: vscode.SecretStorage) {
    // Default config path is in the same directory as this file
    this.configPath = configPath || path.join(__dirname, 'settings.json');
    this.secretStorage = secretStorage || null;
    this.config = this.loadConfig();
  }

  public static getInstance(configPath?: string, secretStorage?: vscode.SecretStorage): EnvManager {
    if (!EnvManager.instance) {
      EnvManager.instance = new EnvManager(configPath, secretStorage);
    }
    return EnvManager.instance;
  }

  private loadConfig(): EnvConfig {
    try {
      if (fs.existsSync(this.configPath)) {
        const data = fs.readFileSync(this.configPath, 'utf8');
        return JSON.parse(data);
      }
    } catch (error) {
      console.error('Error loading config:', error);
    }

    // Return default config if file doesn't exist or has errors
    return {
      externalLLM: {
        apiKey: '',
        endpoint: 'https://api.openai.com/v1/chat/completions',
        model: 'gpt-4'
      },
      localLLM: {
        modelPath: '',
        useGPU: true
      },
      inference: {
        timeout: 30000,
        maxTokens: 150
      }
    };
  }

  public saveConfig(): void {
    const configToSave = { ...this.config };
    
    // Don't save API key to disk
    configToSave.externalLLM.apiKey = '';
    
    try {
      fs.writeFileSync(this.configPath, JSON.stringify(configToSave, null, 2));
    } catch (error) {
      console.error('Error saving config:', error);
    }
  }

  public async getApiKey(): Promise<string> {
    // Try to get API key from secret storage first
    if (this.secretStorage) {
      const apiKey = await this.secretStorage.get('apiKey');
      if (apiKey) {
        return apiKey;
      }
    }
    
    // Fall back to config file (not recommended for production)
    return this.config.externalLLM.apiKey;
  }

  public async setApiKey(apiKey: string): Promise<void> {
    // Store in secret storage if available
    if (this.secretStorage) {
      await this.secretStorage.store('apiKey', apiKey);
    } else {
      // Store in memory only if secret storage is not available
      this.config.externalLLM.apiKey = apiKey;
    }
  }

  public getConfig(): EnvConfig {
    return { ...this.config };
  }

  public updateConfig(newConfig: Partial<EnvConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.saveConfig();
  }
}
```

### 2. Models

#### `src/ai/models/llmRequest.ts`

```typescript
/**
 * File: src/ai/models/llmRequest.ts
 * Project: VSCode AI Code Generator
 * Description: Defines the structure for requests to LLM APIs
 * Copyright © 2025 AI Code Generator Project
 */

export interface LLMRequest {
  prompt: string;
  maxTokens?: number;
  temperature?: number;
  model?: string;
  stream?: boolean;
  stop?: string[];
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatLLMRequest {
  messages: ChatMessage[];
  maxTokens?: number;
  temperature?: number;
  model?: string;
  stream?: boolean;
  stop?: string[];
}
```

#### `src/ai/models/llmResponse.ts`

```typescript
/**
 * File: src/ai/models/llmResponse.ts
 * Project: VSCode AI Code Generator
 * Description: Defines the structure for responses from LLM APIs
 * Copyright © 2025 AI Code Generator Project
 */

export interface LLMResponseUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface LLMResponse {
  text: string;
  usage?: LLMResponseUsage;
  error?: string;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatLLMResponse {
  message: ChatMessage;
  usage?: LLMResponseUsage;
  error?: string;
}
```

### 3. API Connector

#### `src/ai/apiConnector/externalLLMConnector.ts`

```typescript
/**
 * File: src/ai/apiConnector/externalLLMConnector.ts
 * Project: VSCode AI Code Generator
 * Description: Handles communication with external LLM APIs
 * Copyright © 2025 AI Code Generator Project
 */

import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { LLMRequest, ChatLLMRequest, ChatMessage } from '../models/llmRequest';
import { LLMResponse, ChatLLMResponse } from '../models/llmResponse';
import { EnvManager } from '../config/env';
import { handleAPIError } from './apiErrorHandler';

export class ExternalLLMConnector {
  private httpClient: AxiosInstance;
  private envManager: EnvManager;

  constructor() {
    this.envManager = EnvManager.getInstance();
    
    // Initialize axios client
    this.httpClient = axios.create({
      timeout: this.envManager.getConfig().inference.timeout,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }

  /**
   * Sets up authentication for API requests
   */
  private async setupAuth(): Promise<void> {
    const apiKey = await this.envManager.getApiKey();
    this.httpClient.defaults.headers.common['Authorization'] = `Bearer ${apiKey}`;
  }

  /**
   * Sends a completion request to the LLM API
   */
  public async sendCompletionRequest(request: LLMRequest): Promise<LLMResponse> {
    try {
      await this.setupAuth();
      const config = this.envManager.getConfig();
      
      const requestData = {
        prompt: request.prompt,
        max_tokens: request.maxTokens || config.inference.maxTokens,
        temperature: request.temperature || 0.7,
        model: request.model || config.externalLLM.model
      };

      const response = await this.httpClient.post(
        config.externalLLM.endpoint,
        requestData
      );

      return {
        text: response.data.choices[0].text,
        usage: {
          promptTokens: response.data.usage.prompt_tokens,
          completionTokens: response.data.usage.completion_tokens,
          totalTokens: response.data.usage.total_tokens
        }
      };
    } catch (error) {
      const errorMessage = handleAPIError(error);
      return { text: '', error: errorMessage };
    }
  }

  /**
   * Sends a chat request to the LLM API (for chat-based models like GPT-4)
   */
  public async sendChatRequest(request: ChatLLMRequest): Promise<ChatLLMResponse> {
    try {
      await this.setupAuth();
      const config = this.envManager.getConfig();
      
      const requestData = {
        messages: request.messages,
        max_tokens: request.maxTokens || config.inference.maxTokens,
        temperature: request.temperature || 0.7,
        model: request.model || config.externalLLM.model
      };

      const response = await this.httpClient.post(
        config.externalLLM.endpoint,
        requestData
      );

      return {
        message: response.data.choices[0].message,
        usage: {
          promptTokens: response.data.usage.prompt_tokens,
          completionTokens: response.data.usage.completion_tokens,
          totalTokens: response.data.usage.total_tokens
        }
      };
    } catch (error) {
      const errorMessage = handleAPIError(error);
      return { 
        message: { role: 'assistant', content: '' }, 
        error: errorMessage 
      };
    }
  }
}
```

#### `src/ai/apiConnector/apiErrorHandler.ts`

```typescript
/**
 * File: src/ai/apiConnector/apiErrorHandler.ts
 * Project: VSCode AI Code Generator
 * Description: Handles API errors and provides retry logic
 * Copyright © 2025 AI Code Generator Project
 */

import axios, { AxiosError } from 'axios';

/**
 * Parses API errors and returns meaningful error messages
 */
export function handleAPIError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError;
    
    if (axiosError.response) {
      // Server responded with a non-2xx status code
      const status = axiosError.response.status;
      
      switch (status) {
        case 401:
          return 'Authentication error: Invalid API key';
        case 403:
          return 'Authorization error: You do not have permission to use this API';
        case 404:
          return 'The requested resource was not found';
        case 429:
          return 'Rate limit exceeded: Too many requests';
        case 500:
        case 502:
        case 503:
        case 504:
          return `Server error (${status}): The AI service is experiencing issues`;
        default:
          return `API error (${status}): ${JSON.stringify(axiosError.response.data)}`;
      }
    } else if (axiosError.request) {
      // Request was made but no response received
      return 'Network error: No response received from the AI service';
    } else {
      // Error setting up the request
      return `Request setup error: ${axiosError.message}`;
    }
  }
  
  // Generic error handling
  if (error instanceof Error) {
    return `Error: ${error.message}`;
  }
  
  return 'Unknown error occurred';
}

/**
 * Retries an async function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 1000
): Promise<T> {
  let retries = 0;
  
  while (true) {
    try {
      return await fn();
    } catch (error) {
      retries++;
      
      if (retries > maxRetries) {
        throw error;
      }
      
      // Calculate exponential backoff delay
      const delay = initialDelay * Math.pow(2, retries - 1);
      
      // Add some randomness to prevent synchronized retries
      const jitter = Math.random() * 100;
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay + jitter));
    }
  }
}
```

### 4. Local LLM

#### `src/ai/localLLM/localModelLoader.ts`

```typescript
/**
 * File: src/ai/localLLM/localModelLoader.ts
 * Project: VSCode AI Code Generator
 * Description: Loads and initializes local LLM models
 * Copyright © 2025 AI Code Generator Project
 */

import * as fs from 'fs';
import * as path from 'path';
import { EnvManager } from '../config/env';

// Interface for loaded model metadata
interface ModelMetadata {
  name: string;
  version: string;
  type: string;
  parameters: number;
  quantization?: string;
}

// Model instance type (to be extended with actual model implementation)
export type Model = {
  metadata: ModelMetadata;
  // Additional model-specific properties would go here
  // This is a placeholder that would be replaced with actual model integration
};

export class LocalModelLoader {
  private static instance: LocalModelLoader;
  private envManager: EnvManager;
  private loadedModel: Model | null = null;

  private constructor() {
    this.envManager = EnvManager.getInstance();
  }

  public static getInstance(): LocalModelLoader {
    if (!LocalModelLoader.instance) {
      LocalModelLoader.instance = new LocalModelLoader();
    }
    return LocalModelLoader.instance;
  }

  /**
   * Checks if the model path exists and is valid
   */
  public validateModelPath(modelPath: string): boolean {
    if (!modelPath) {
      return false;
    }

    try {
      // Check if the path exists
      if (!fs.existsSync(modelPath)) {
        return false;
      }

      // Check if the path is a directory
      const stats = fs.statSync(modelPath);
      if (!stats.isDirectory()) {
        return false;
      }

      // Check for model.json or similar file (depends on model format)
      const modelFiles = ['model.json', 'config.json', 'model.bin', 'pytorch_model.bin'];
      const hasModelFile = modelFiles.some(file => 
        fs.existsSync(path.join(modelPath, file))
      );

      return hasModelFile;
    } catch (error) {
      console.error('Error validating model path:', error);
      return false;
    }
  }

  /**
   * Loads a model from the specified path
   * Note: This is a placeholder implementation that would be replaced
   * with actual model loading logic based on your chosen framework
   */
  public async loadModel(modelPath?: string): Promise<Model | null> {
    try {
      // Use provided path or get from config
      const config = this.envManager.getConfig();
      const path = modelPath || config.localLLM.modelPath;
      
      if (!this.validateModelPath(path)) {
        throw new Error(`Invalid model path: ${path}`);
      }

      console.log(`Loading model from ${path}...`);
      
      // This is where you would actually load the model
      // using TensorFlow.js, ONNX Runtime, or another framework
      
      // Mock implementation for placeholder purposes
      this.loadedModel = {
        metadata: {
          name: 'CodeGen Model',
          version: '1.0',
          type: 'transformer',
          parameters: 7000000000,
          quantization: 'int8'
        }
      };
      
      console.log('Model loaded successfully');
      return this.loadedModel;
    } catch (error) {
      console.error('Error loading model:', error);
      this.loadedModel = null;
      return null;
    }
  }

  /**
   * Gets the currently loaded model (loads if not already loaded)
   */
  public async getModel(): Promise<Model | null> {
    if (!this.loadedModel) {
      return await this.loadModel();
    }
    return this.loadedModel;
  }

  /**
   * Unloads the current model to free memory
   */
  public unloadModel(): void {
    this.loadedModel = null;
    // This is where you would release model resources
  }
}
```

#### `src/ai/localLLM/localInference.ts`

```typescript
/**
 * File: src/ai/localLLM/localInference.ts
 * Project: VSCode AI Code Generator
 * Description: Runs inference using locally loaded models
 * Copyright © 2025 AI Code Generator Project
 */

import { LocalModelLoader, Model } from './localModelLoader';
import { LLMRequest } from '../models/llmRequest';
import { LLMResponse } from '../models/llmResponse';
import { ResourceManager } from './resourceManager';
import { EnvManager } from '../config/env';

export class LocalInference {
  private modelLoader: LocalModelLoader;
  private resourceManager: ResourceManager;
  private envManager: EnvManager;

  constructor() {
    this.modelLoader = LocalModelLoader.getInstance();
    this.resourceManager = ResourceManager.getInstance();
    this.envManager = EnvManager.getInstance();
  }

  /**
   * Runs inference on a local model
   * Note: This is a placeholder implementation that would be replaced
   * with actual inference logic based on your chosen framework
   */
  public async runInference(request: LLMRequest): Promise<LLMResponse> {
    try {
      // Allocate resources (GPU/CPU)
      this.resourceManager.allocateResources();
      
      // Get or load the model
      const model = await this.modelLoader.getModel();
      if (!model) {
        throw new Error('Failed to load local model');
      }
      
      console.log('Running inference with prompt:', request.prompt);
      
      // This is where you would actually run the inference
      // using your model and framework of choice
      
      // Mock implementation for placeholder purposes
      const config = this.envManager.getConfig();
      const maxTokens = request.maxTokens || config.inference.maxTokens;
      
      // Simulate inference time
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Create a mock response
      const response: LLMResponse = {
        text: `// Generated code for: ${request.prompt}\n\nfunction generatedFunction() {\n  console.log("This is placeholder code from local inference");\n  // TODO: Implement actual functionality\n}\n`,
        usage: {
          promptTokens: request.prompt.length / 4, // Rough token estimate
          completionTokens: maxTokens,
          totalTokens: (request.prompt.length / 4) + maxTokens
        }
      };
      
      return response;
    } catch (error) {
      console.error('Error during local inference:', error);
      return {
        text: '',
        error: error instanceof Error ? error.message : 'Unknown error during inference'
      };
    } finally {
      // Always release resources regardless of success or failure
      this.resourceManager.releaseResources();
    }
  }
}
```

#### `src/ai/localLLM/resourceManager.ts`

```typescript
/**
 * File: src/ai/localLLM/resourceManager.ts
 * Project: VSCode AI Code Generator
 * Description: Manages compute resources for local LLM inference
 * Copyright © 2025 AI Code Generator Project
 */

import { EnvManager } from '../config/env';

export class ResourceManager {
  private static instance: ResourceManager;
  private envManager: EnvManager;
  private isGpuAvailable: boolean = false;
  private resources: {
    allocated: boolean;
    gpuMemory: number;
    cpuThreads: number;
  };

  private constructor() {
    this.envManager = EnvManager.getInstance();
    this.resources = {
      allocated: false,
      gpuMemory: 0,
      cpuThreads: 0
    };
    this.detectAvailableResources();
  }

  public static getInstance(): ResourceManager {
    if (!ResourceManager.instance) {
      ResourceManager.instance = new ResourceManager();
    }
    return ResourceManager.instance;
  }

  /**
   * Detects available GPU/CPU resources
   * Note: This is a placeholder implementation that would be replaced
   * with actual resource detection logic based on your framework
   */
  private detectAvailableResources(): void {
    // Placeholder for actual GPU detection
    try {
      // This would be replaced with actual GPU detection logic using 
      // TensorFlow.js, ONNX Runtime, or another framework
      this.isGpuAvailable = false;
      
      // If GPU is available, estimate memory
      if (this.isGpuAvailable) {
        this.resources.gpuMemory = 4096; // Estimate in MB
      }
      
      // Estimate available CPU threads
      this.resources.cpuThreads = Math.max(1, navigator?.hardwareConcurrency || 4);
      
      console.log(`Resource detection completed: GPU ${this.isGpuAvailable ? 'available' : 'not available'}, CPU threads: ${this.resources.cpuThreads}`);
    } catch (error) {
      console.error('Error detecting resources:', error);
      this.isGpuAvailable = false;
      this.resources.cpuThreads = 2; // Conservative fallback
    }
  }

  /**
   * Returns whether GPU acceleration is available
   */
  public isGPUAvailable(): boolean {
    return this.isGpuAvailable;
  }

  /**
   * Allocates resources for inference
   */
  public allocateResources(): void {
    const config = this.envManager.getConfig();
    
    if (this.resources.allocated) {
      console.warn('Resources already allocated');
      return;
    }
    
    console.log(`Allocating resources (GPU: ${config.localLLM.useGPU && this.isGpuAvailable})`);
    this.resources.allocated = true;
  }

  /**
   * Releases allocated resources
   */
  public releaseResources(): void {
    if (!this.resources.allocated) {
      return;
    }
    
    console.log('Releasing resources');
    this.resources.allocated = false;
  }
}
```

### 5. Generator

#### `src/ai/generator/codeGenerator.ts`

```typescript
/**
 * File: src/ai/generator/codeGenerator.ts
 * Project: VSCode AI Code Generator
 * Description: Core module for generating code from prompts
 * Copyright © 2025 AI Code Generator Project
 */

import { LLMRequest, ChatLLMRequest, ChatMessage } from '../models/llmRequest';
import { LLMResponse, ChatLLMResponse } from '../models/llmResponse';
import { ExternalLLMConnector } from '../apiConnector/externalLLMConnector';
import { LocalInference } from '../localLLM/localInference';
import { PromptParser } from './promptParser';
import { ResponsePostProcessor } from './responsePostProcessor';
import { EnvManager } from '../config/env';

/**
 * Source options for code generation
 */
export enum CodeGenerationSource {
  AUTO = 'auto',
  LOCAL = 'local',
  API = 'api'
}

/**
 * Options for code generation
 */
export interface CodeGenerationOptions {
  source?: CodeGenerationSource;
  language?: string;
  maxTokens?: number;
  temperature?: number;
  includeComments?: boolean;
}

/**
 * Main code generator class
 */
export class CodeGenerator {
  private externalConnector: ExternalLLMConnector;
  private localInference: LocalInference;
  private promptParser: PromptParser;
  private postProcessor: ResponsePostProcessor;
  private envManager: EnvManager;

  constructor() {
    this.externalConnector = new ExternalLLMConnector();
    this.localInference = new LocalInference();
    this.promptParser = new PromptParser();
    this.postProcessor = new ResponsePostProcessor();
    this.envManager = EnvManager.getInstance();
  }

  /**
   * Generates code based on a text prompt
   */
  public async generateCode(
    prompt: string, 
    options: CodeGenerationOptions = {}
  ): Promise<string> {
    try {
      // Determine source to use (local or API)
      const source = this.determineSource(options.source);
      
      // Parse and enhance the prompt
      const parsedPrompt = this.promptParser.parsePrompt(prompt, options.language);
      
      // Call appropriate service
      let response: LLMResponse;
      
      if (source === CodeGenerationSource.LOCAL) {
        // Use local model
        const request: LLMRequest = {
          prompt: parsedPrompt,
          maxTokens: options.maxTokens,
          temperature: options.temperature
        };
        
        response = await this.localInference.runInference(request);
      } else {
        // Use API
        const systemPrompt = this.promptParser.getSystemPrompt(options.language);
        
        const messages: ChatMessage[] = [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: parsedPrompt }
        ];
        
        const request: ChatLLMRequest = {
          messages,
          maxTokens: options.maxTokens,
          temperature: options.temperature
        };
        
        const chatResponse = await this.externalConnector.sendChatRequest(request);
        
        // Convert to standard response format
        response = {
          text: chatResponse.message.content,
          usage: chatResponse.usage,
          error: chatResponse.error
        };
      }
      
      // Handle errors
      if (response.error) {
        throw new Error(response.error);
      }
      
      // Post-process the generated code
      return this.postProcessor.processCode(
        response.text,
        options.language,
        options.includeComments ?? true
      );
    } catch (error) {
      console.error('Error generating code:', error);
      throw error;
    }
  }

  /**
   * Determines which source to use for code generation
   */
  private determineSource(requestedSource?: CodeGenerationSource): CodeGenerationSource {
    // If explicitly requested, use that source
    if (requestedSource === CodeGenerationSource.LOCAL) {
      return CodeGenerationSource.LOCAL;
    }
    
    if (requestedSource === CodeGenerationSource.API) {
      return CodeGenerationSource.API;
    }
    
    // For AUTO or undefined, try to