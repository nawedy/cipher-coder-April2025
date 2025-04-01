/*
 * File: src/ai/localLLM/localModelLoader.ts
 * Project: Cipher Intelligence Labs VSCode AI CodeGen
 * Description: Handles loading and initialization of local AI models.
 * Copyright © 2025 Cipher Intelligence Labs
 */

import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { EnvManager } from '../config/env';
import { Logger } from '../utils/logger';
import { ResourceManager } from './resourceManager';

// Mock types for model interfaces - replace with actual library types when integrating
type ModelInstance = any;
type ModelMetadata = {
  name: string;
  version: string;
  type: string;
  quantization: string;
  size: number;
  parameters: number;
  modelFormat: string;
  lastModified: number;
};

/**
 * Class responsible for loading and managing local LLM models
 */
export class LocalModelLoader {
  private static instance: LocalModelLoader | null = null;
  private envManager: EnvManager;
  private currentModel: ModelInstance | null = null;
  private modelPath: string = '';
  private modelMetadata: ModelMetadata | null = null;
  private isLoading: boolean = false;
  private lastLoadTime: number = 0;

  /**
   * Creates an instance of LocalModelLoader
   * @param context - VSCode extension context
   */
  private constructor(context: vscode.ExtensionContext) {
    this.envManager = EnvManager.getInstance(context);
  }

  /**
   * Gets the singleton instance of LocalModelLoader
   * @param context - VSCode extension context
   * @returns The LocalModelLoader instance
   */
  public static getInstance(context: vscode.ExtensionContext): LocalModelLoader {
    if (!LocalModelLoader.instance) {
      LocalModelLoader.instance = new LocalModelLoader(context);
    }
    return LocalModelLoader.instance;
  }

  /**
   * Checks if a model is currently loaded
   * @returns True if a model is loaded, false otherwise
   */
  public isModelLoaded(): boolean {
    return this.currentModel !== null;
  }

  /**
   * Gets the currently loaded model
   * @returns The current model instance or null if no model is loaded
   * @throws Error if no model is loaded
   */
  public getModel(): ModelInstance {
    if (!this.currentModel) {
      throw new Error('No model currently loaded. Call loadModel() first.');
    }
    return this.currentModel;
  }

  /**
   * Gets metadata about the currently loaded model
   * @returns The model metadata or null if no model is loaded
   */
  public getModelMetadata(): ModelMetadata | null {
    return this.modelMetadata;
  }

  /**
   * Extracts model metadata from the model directory
   * @param modelDirectory - Path to the model directory
   * @returns Model metadata object
   */
  private async extractModelMetadata(modelDirectory: string): Promise<ModelMetadata> {
    try {
      // Check for metadata file first
      const metadataPath = path.join(modelDirectory, 'metadata.json');
      if (fs.existsSync(metadataPath)) {
        const metadataContent = await fs.promises.readFile(metadataPath, 'utf8');
        return JSON.parse(metadataContent) as ModelMetadata;
      }
      
      // If no metadata file, infer from directory structure and files
      const files = await fs.promises.readdir(modelDirectory);
      const modelFiles = files.filter(f => 
        f.endsWith('.bin') || 
        f.endsWith('.onnx') || 
        f.endsWith('.pt') ||
        f.endsWith('.tensorrt')
      );
      
      if (modelFiles.length === 0) {
        throw new Error(`No valid model files found in ${modelDirectory}`);
      }
      
      const mainModelFile = modelFiles[0];
      const stats = await fs.promises.stat(path.join(modelDirectory, mainModelFile));
      
      // Infer model format from file extension
      const extension = path.extname(mainModelFile).substring(1);
      let modelFormat = extension;
      
      // Infer model type and parameters from filename
      const filename = path.basename(mainModelFile, path.extname(mainModelFile));
      const nameParts = filename.split('-');
      
      // Default metadata
      return {
        name: filename,
        version: '1.0.0',
        type: nameParts[0] || 'unknown',
        quantization: nameParts.includes('int8') ? 'int8' : 
                      nameParts.includes('fp16') ? 'fp16' : 'fp32',
        size: stats.size,
        parameters: 0, // Unknown without model info
        modelFormat,
        lastModified: stats.mtime.getTime()
      };
    } catch (error) {
      Logger.error(`Failed to extract model metadata: ${error instanceof Error ? error.message : String(error)}`);
      
      // Return minimal metadata
      return {
        name: path.basename(modelDirectory),
        version: '1.0.0',
        type: 'unknown',
        quantization: 'unknown',
        size: 0,
        parameters: 0,
        modelFormat: 'unknown',
        lastModified: Date.now()
      };
    }
  }

  /**
   * Loads a model from the specified path
   * @param modelPath - Path to the model directory
   * @returns Promise resolving when the model is loaded
   * @throws Error if loading fails
   */
  public async loadModel(modelPath?: string): Promise<void> {
    // Prevent concurrent loads
    if (this.isLoading) {
      throw new Error('Model loading already in progress');
    }
    
    this.isLoading = true;
    
    try {
      // Use provided path or get from config
      const configPath = modelPath || await this.envManager.getModelPath();
      
      if (!configPath) {
        throw new Error('No model path specified');
      }
      
      // Check if the model path exists
      if (!fs.existsSync(configPath)) {
        throw new Error(`Model path does not exist: ${configPath}`);
      }
      
      // Get absolute path
      this.modelPath = path.resolve(configPath);
      
      Logger.info(`Loading model from ${this.modelPath}`);
      
      // Extract metadata before loading
      this.modelMetadata = await this.extractModelMetadata(this.modelPath);
      
      // Check available resources
      const resourceCheck = await ResourceManager.checkResources(this.modelMetadata);
      if (!resourceCheck.sufficient) {
        throw new Error(`Insufficient resources to load model: ${resourceCheck.reason}`);
      }
      
      // Allocate resources for the model
      await ResourceManager.allocateResources(this.modelMetadata);
      
      // TODO: Replace with actual model loading code when integrating with a specific framework
      // For example, using ONNX Runtime:
      // const session = await ort.InferenceSession.create(path.join(this.modelPath, 'model.onnx'));
      
      // Placeholder for model loading - replace with actual implementation
      this.currentModel = {
        name: this.modelMetadata.name,
        loaded: true,
        // Mock properties and methods for the model
        predict: async (input: string) => {
          return `Generated output for: ${input}`;
        }
      };
      
      this.lastLoadTime = Date.now();
      Logger.info(`Model ${this.modelMetadata.name} loaded successfully`);
    } catch (error) {
      this.currentModel = null;
      this.modelMetadata = null;
      
      // Release any allocated resources
      await ResourceManager.releaseResources();
      
      Logger.error(`Failed to load model: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Unloads the current model and releases resources
   */
  public async unloadModel(): Promise<void> {
    if (this.currentModel) {
      Logger.info(`Unloading model ${this.modelMetadata?.name || 'unknown'}`);
      
      // TODO: Add actual cleanup code specific to the model framework
      
      // Release resources
      await ResourceManager.releaseResources();
      
      this.currentModel = null;
      this.modelMetadata = null;
      
      Logger.info('Model unloaded successfully');
    }
  }

  /**
   * Scans directories for available local models
   * @param baseDir - Base directory to scan
   * @returns List of available models with metadata
   */
  public async scanAvailableModels(baseDir?: string): Promise<ModelMetadata[]> {
    try {
      // Get base directory from config if not provided
      const config = await this.envManager.loadConfig();
      const modelBaseDir = baseDir || path.dirname(config.localLLM.modelPath);
      
      if (!fs.existsSync(modelBaseDir)) {
        Logger.warn(`Model base directory does not exist: ${modelBaseDir}`);
        return [];
      }
      
      // Scan for potential model directories
      const entries = await fs.promises.readdir(modelBaseDir, { withFileTypes: true });
      const modelDirs = entries.filter(entry => entry.isDirectory());
      
      const models: ModelMetadata[] = [];
      
      for (const dir of modelDirs) {
        const dirPath = path.join(modelBaseDir, dir.name);
        try {
          const metadata = await this.extractModelMetadata(dirPath);
          models.push(metadata);
        } catch (error) {
          Logger.debug(`Skipping directory ${dirPath}: Not a valid model`);
          // Skip invalid model directories
        }
      }
      
      return models;
    } catch (error) {
      Logger.error(`Failed to scan for models: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  }
}
