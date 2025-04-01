/*
 * File: src/ai/tests/generator.test.ts
 * Project: Cipher Intelligence Labs VSCode AI CodeGen
 * Description: Unit tests for the code generator module.
 * Copyright © 2025 Cipher Intelligence Labs
 */

import * as vscode from 'vscode';
import { CodeGenerator } from '../generator/codeGenerator';
import { PromptParser } from '../generator/promptParser';
import { ResponsePostProcessor } from '../generator/responsePostProcessor';
import { ExternalLLMConnector } from '../apiConnector/externalLLMConnector';
import { LocalInference } from '../localLLM/localInference';
import { mock, instance, when, verify, anything, deepEqual } from 'ts-mockito';

// Mock the VSCode extension context
class MockExtensionContext implements vscode.ExtensionContext {
  asAbsolutePath(relativePath: string): string {
    throw new Error('Method not implemented.');
  }
  storagePath: string | undefined;
  globalStoragePath!: string;
  logPath!: string;
  extension!: vscode.Extension<any>;
  languageModelAccessInformation!: vscode.LanguageModelAccessInformation;
  subscriptions: { dispose(): any }[] = [];
  workspaceState: vscode.Memento = {} as vscode.Memento;
  globalState: vscode.Memento & { setKeysForSync(keys: readonly string[]): void } = {} as any;
  extensionUri: vscode.Uri = {} as vscode.Uri;
  extensionPath: string = '';
  environmentVariableCollection: vscode.GlobalEnvironmentVariableCollection = {
    persistent: true,
    description: 'Test Environment Variables',
    getScoped: () => ({} as vscode.EnvironmentVariableCollection),
    replace: () => { },
    append: () => { },
    prepend: () => { },
    get: () => undefined,
    forEach: () => { },
    delete: () => { },
    has: () => false
  } as unknown as vscode.GlobalEnvironmentVariableCollection;
  storageUri: vscode.Uri | undefined;
  globalStorageUri: vscode.Uri = {} as vscode.Uri;
  logUri: vscode.Uri = {} as vscode.Uri;
  extensionMode: vscode.ExtensionMode = vscode.ExtensionMode.Production;
  secrets: vscode.SecretStorage = {} as vscode.SecretStorage;
}

describe('CodeGenerator', () => {
  let mockContext: MockExtensionContext;
  let mockExternalConnector: ExternalLLMConnector;
  let mockLocalInference: LocalInference;
  let mockPromptParser: PromptParser;
  let mockResponseProcessor: ResponsePostProcessor;
  let codeGenerator: CodeGenerator;

  beforeEach(() => {
    // Create mocks
    mockContext = new MockExtensionContext();
    mockExternalConnector = mock(ExternalLLMConnector);
    mockLocalInference = mock(LocalInference);
    mockPromptParser = mock(PromptParser);
    mockResponseProcessor = mock(ResponsePostProcessor);
    // Create generator with test dependencies
    codeGenerator = CodeGenerator.createForTesting(mockContext, {
      externalConnector: instance(mockExternalConnector),
      localInference: instance(mockLocalInference)
    });
    (codeGenerator as any).promptParser = instance(mockPromptParser);
    (codeGenerator as any).postProcessor = instance(mockResponseProcessor);
  });

  test('generateCode should use external API by default', async () => {
    // Arrange
    const prompt = 'Generate a React component that displays a counter';
    const language = 'typescript';
    
    const parsedRequest = { prompt: 'Enhanced prompt', language: 'typescript', params: {} };
    const llmResponse = { 
      generatedText: 'function Counter() { return <div>Count: 0</div>; }',
      timestamp: Date.now(),
      requestId: '1234'
    };
    const processedResponse = {
      generatedText: 'function Counter() {\n  return <div>Count: 0</div>;\n}',
      timestamp: Date.now(),
      requestId: '1234'
    };
    
    when(mockPromptParser.parsePrompt(prompt, anything())).thenReturn(parsedRequest as any);
    when(mockExternalConnector.sendCompletionRequest(deepEqual(parsedRequest))).thenResolve(llmResponse as any);
    when(mockResponseProcessor.processResponse(llmResponse, anything())).thenResolve(processedResponse as any);
    
    // Act
    const result = await codeGenerator.generateCode(prompt, { language });
    
    // Assert
    verify(mockExternalConnector.sendCompletionRequest(anything())).once();
    verify(mockLocalInference.runInference(anything())).never();
    expect(result.generatedText).toBe(processedResponse.generatedText);
    expect(result.language).toBe(language);
  });

  test('generateCode should use local model when specified', async () => {
    // Arrange
    const prompt = 'Generate a Python function to calculate factorial';
    const language = 'python';
    
    const parsedRequest = { prompt: 'Enhanced prompt', language: 'python', params: {} };
    const llmResponse = { 
      generatedText: 'def factorial(n):\n    return 1 if n <= 1 else n * factorial(n-1)',
      timestamp: Date.now(),
      requestId: '5678'
    };
    const processedResponse = {
      generatedText: 'def factorial(n):\n    return 1 if n <= 1 else n * factorial(n-1)',
      timestamp: Date.now(),
      requestId: '5678'
    };
    
    when(mockPromptParser.parsePrompt(prompt, anything())).thenReturn(parsedRequest as any);
    when(mockLocalInference.runInference(deepEqual(parsedRequest))).thenResolve(llmResponse as any);
    when(mockResponseProcessor.processResponse(llmResponse, anything())).thenResolve(processedResponse as any);
    
    // Act
    const result = await codeGenerator.generateCode(prompt, { language, useLocalModel: true });
    
    // Assert
    verify(mockLocalInference.runInference(anything())).once();
    verify(mockExternalConnector.sendCompletionRequest(anything())).never();
    expect(result.generatedText).toBe(processedResponse.generatedText);
    expect(result.language).toBe(language);
  });

  test('generateCode should handle errors gracefully', async () => {
    // Arrange
    const prompt = 'Generate invalid code';
    const errorMessage = 'API connection failed';
    
    when(mockPromptParser.parsePrompt(prompt, anything())).thenReturn({ prompt } as any);
    when(mockExternalConnector.sendCompletionRequest(anything())).thenReject(new Error(errorMessage));
    
    // Act
    const result = await codeGenerator.generateCode(prompt);
    
    // Assert
    expect(result.error).toContain(errorMessage);
    expect(result.generatedText).toBe('');
    expect(result.finishReason).toBe('error');
  });

  test('improveCode should create an improvement prompt', async () => {
    // Arrange
    const existingCode = 'function add(a, b) { return a + b; }';
    const improvementDescription = 'Add type annotations';
    const language = 'typescript';
    
    const expectedPrompt = 'Improve TypeScript code with type annotations';
    
    when(mockPromptParser.createImprovementPrompt(
      existingCode, 
      improvementDescription, 
      language
    )).thenReturn(expectedPrompt);
    
    // Mock the generateCode method to avoid duplicating test logic
    const generateCodeSpy = jest.spyOn(codeGenerator, 'generateCode');
    generateCodeSpy.mockResolvedValue({ 
      generatedText: 'function add(a: number, b: number): number { return a + b; }',
      language: 'typescript'
    } as any);
    
    // Act
    await codeGenerator.improveCode(existingCode, improvementDescription, { language });
    
    // Assert
    expect(generateCodeSpy).toHaveBeenCalledWith(
      expectedPrompt,
      expect.objectContaining({ language })
    );
    
    // Cleanup
    generateCodeSpy.mockRestore();
  });
});
