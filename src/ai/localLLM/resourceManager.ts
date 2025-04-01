/*
 * File: src/ai/localLLM/resourceManager.ts
 * Project: Cipher Intelligence Labs VSCode AI CodeGen
 * Description: Manages system resources for local model inference.
 * Copyright © 2025 Cipher Intelligence Labs
 */

import * as os from 'os';
import { Logger } from '../utils/logger';

/**
 * Interface for resource check results
 */
interface ResourceCheckResult {
  sufficient: boolean;
  reason?: string;
  details: {
    availableMemory: number;
    requiredMemory: number;
    availableCores: number;
    gpuAvailable: boolean;
    gpuMemory?: number;
  };
}

/**
 * Class for managing system resources when loading and running local models
 */
export class ResourceManager {
  /**
   * Whether resources have been allocated for model inference
   */
  private static resourcesAllocated = false;
  
  /**
   * Number of CPU cores reserved for inference
   */
  private static reservedCores = 0;
  
  /**
   * Amount of memory (in MB) reserved for inference
   */
  private static reservedMemory = 0;
  
  /**
   * Whether GPU resources are being used
   */
  private static usingGPU = false;

  /**
   * Minimum memory required for basic model loading (in MB)
   */
  private static MINIMUM_MEMORY_REQUIRED = 2048; // 2GB

  /**
   * Amount of system memory to leave free for other processes (in MB)
   */
  private static SYSTEM_MEMORY_BUFFER = 1024; // 1GB
  
  /**
   * Maximum percentage of CPU cores to use
   */
  private static MAX_CPU_USAGE_PERCENT = 75;

  /**
   * Checks if the system has access to a GPU
   * @returns True if a compatible GPU is available, false otherwise
   */
  private static checkGPUAvailability(): { available: boolean; memory?: number } {
    // TODO: Implement actual GPU detection code
    // This would typically use platform-specific APIs or libraries
    
    // For now, return a mock implementation
    try {
      // Mock GPU detection
      const mockGPUAvailable = false;
      const mockGPUMemory = 0;
      
      Logger.debug(`GPU detection: available=${mockGPUAvailable}, memory=${mockGPUMemory}MB`);
      
      return {
        available: mockGPUAvailable,
        memory: mockGPUMemory
      };
    } catch (error) {
      Logger.warn(`Failed to detect GPU: ${error instanceof Error ? error.message : String(error)}`);
      return { available: false };
    }
  }

  /**
   * Calculates memory required for a given model
   * @param modelMetadata - Metadata about the model
   * @returns Memory required in MB
   */
  private static calculateRequiredMemory(modelMetadata: any): number {
    // With a real implementation, you would use the model's size and quantization
    // to accurately estimate memory requirements
    
    // For now, base it on the model's reported size if available
    if (modelMetadata && modelMetadata.size) {
      // Model file size is usually compressed, so actual memory usage is higher
      // A common multiplier is somewhere between 2-5x depending on the model type
      const sizeInMB = modelMetadata.size / (1024 * 1024);
      return Math.max(this.MINIMUM_MEMORY_REQUIRED, sizeInMB * 3);
    }
    
    // Default requirement if we can't determine from metadata
    return this.MINIMUM_MEMORY_REQUIRED;
  }

  /**
   * Checks if there are sufficient resources to load and run a model
   * @param modelMetadata - Metadata about the model to be loaded
   * @returns Result of the resource check
   */
  public static async checkResources(modelMetadata: any): Promise<ResourceCheckResult> {
    // Get available system memory
    const totalMemory = os.totalmem() / (1024 * 1024); // Convert to MB
    const freeMemory = os.freemem() / (1024 * 1024); // Convert to MB
    const availableMemory = freeMemory - this.SYSTEM_MEMORY_BUFFER;
    
    // Calculate required memory based on model metadata
    const requiredMemory = this.calculateRequiredMemory(modelMetadata);
    
    // Check CPU cores
    const totalCores = os.cpus().length;
    const availableCores = Math.floor(totalCores * (this.MAX_CPU_USAGE_PERCENT / 100));
    
    // Check GPU availability
    const gpuInfo = this.checkGPUAvailability();
    
    // Determine if we have sufficient resources
    if (availableMemory < requiredMemory) {
      return {
        sufficient: false,
        reason: `Insufficient memory: ${Math.round(availableMemory)}MB available, ${Math.round(requiredMemory)}MB required`,
        details: {
          availableMemory,
          requiredMemory,
          availableCores,
          gpuAvailable: gpuInfo.available,
          gpuMemory: gpuInfo.memory
        }
      };
    }
    
    // Passed all checks
    return {
      sufficient: true,
      details: {
        availableMemory,
        requiredMemory,
        availableCores,
        gpuAvailable: gpuInfo.available,
        gpuMemory: gpuInfo.memory
      }
    };
  }

  /**
   * Allocates system resources for model inference
   * @param modelMetadata - Metadata about the model
   * @returns Promise that resolves when resources are allocated
   */
  public static async allocateResources(modelMetadata: any): Promise<void> {
    // Avoid re-allocating if already allocated
    if (this.resourcesAllocated) {
      Logger.warn('Resources already allocated; call releaseResources() first');
      return;
    }
    
    // Calculate required resources
    const requiredMemory = this.calculateRequiredMemory(modelMetadata);
    const totalCores = os.cpus().length;
    const coresToUse = Math.floor(totalCores * (this.MAX_CPU_USAGE_PERCENT / 100));
    
    // Check GPU availability
    const gpuInfo = this.checkGPUAvailability();
    
    Logger.info(`Allocating resources: ${requiredMemory}MB memory, ${coresToUse} CPU cores, GPU: ${gpuInfo.available}`);
    
    // Set the resource allocation flags
    this.reservedMemory = requiredMemory;
    this.reservedCores = coresToUse;
    this.usingGPU = gpuInfo.available;
    this.resourcesAllocated = true;
    
    // TODO: Add platform-specific resource allocation
    // This might include setting thread affinity, memory limits, etc.
    
    Logger.info('Resources allocated successfully');
  }

  /**
   * Releases allocated system resources
   * @returns Promise that resolves when resources are released
   */
  public static async releaseResources(): Promise<void> {
    if (!this.resourcesAllocated) {
      Logger.debug('No resources to release');
      return;
    }
    
    Logger.info('Releasing allocated resources');
    
    // TODO: Add platform-specific resource cleanup
    
    // Reset allocation flags
    this.reservedMemory = 0;
    this.reservedCores = 0;
    this.usingGPU = false;
    this.resourcesAllocated = false;
    
    Logger.info('Resources released successfully');
  }

  /**
   * Gets information about currently allocated resources
   * @returns Object containing resource allocation details
   */
  public static getResourceAllocation(): {
    allocated: boolean;
    memory: number;
    cores: number;
    gpu: boolean;
  } {
    return {
      allocated: this.resourcesAllocated,
      memory: this.reservedMemory,
      cores: this.reservedCores,
      gpu: this.usingGPU
    };
  }
}