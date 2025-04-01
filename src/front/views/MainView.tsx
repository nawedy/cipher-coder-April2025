/*
 * File: src/front/views/MainView.tsx
 * Project: Cipher Intelligence Labs VSCode AI CodeGen
 * Description: Main view that integrates the chat and editor components.
 * Copyright © 2025 Cipher Intelligence Labs
 */

import * as React from 'react';
import { useState, useEffect, useCallback } from 'react';
import ChatPanel from '../components/ChatPanel';
import EditorIntegration from '../components/EditorIntegration';
import StatusBarWidget, { AIStatus } from '../components/StatusBarWidget';
import { ChatSession, ChatMessage } from '../../ai/chat/chatController';

/**
 * Mock API for connecting to the VSCode extension
 * In a real implementation, this would use VSCode's message passing
 */
declare global {
  interface Window {
    vsCodeApi?: {
      postMessage: (message: any) => void;
      setState: (state: any) => void;
      getState: () => any;
    };
  }
}

/**
 * Props for MainView component
 */
interface MainViewProps {
  /**
   * Initial chat session (if any)
   */
  initialSession?: ChatSession;
}

/**
 * Main view component that integrates all UI components
 */
const MainView: React.FC<MainViewProps> = ({ initialSession }) => {
  const [session, setSession] = useState<ChatSession | null>(initialSession || null);
  const [codeSuggestion, setCodeSuggestion] = useState('');
  const [codeLanguage, setCodeLanguage] = useState<string | undefined>();
  const [codeExplanation, setCodeExplanation] = useState<string | undefined>();
  const [aiStatus, setAiStatus] = useState<AIStatus>(AIStatus.IDLE);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [suggestedResponses, setSuggestedResponses] = useState<string[]>([]);
  const [usingLocalModel, setUsingLocalModel] = useState(false);
  
  // Reference to VSCode API (for communication with extension)
  const vsCodeApi = window.vsCodeApi;
  
  /**
   * Handles messages from the extension
   */
  const handleExtensionMessage = useCallback((event: MessageEvent) => {
    const message = event.data;
    
    switch (message.type) {
      case 'session-update':
        setSession(message.session);
        break;
      
      case 'code-suggestion':
        setCodeSuggestion(message.code);
        setCodeLanguage(message.language);
        setCodeExplanation(message.explanation);
        setAiStatus(AIStatus.SUCCESS);
        break;
      
      case 'ai-status':
        setAiStatus(message.status);
        setErrorMessage(message.error);
        break;
      
      case 'suggested-responses':
        setSuggestedResponses(message.suggestions);
        break;
      
      case 'model-info':
        setUsingLocalModel(message.usingLocalModel);
        break;
    }
  }, []);
  
  // Set up message listener for extension communication
  useEffect(() => {
    window.addEventListener('message', handleExtensionMessage);
    
    // Request initial data
    if (vsCodeApi) {
      vsCodeApi.postMessage({ type: 'request-initial-data' });
    }
    
    return () => {
      window.removeEventListener('message', handleExtensionMessage);
    };
  }, [handleExtensionMessage]);

  /**
   * Sends a message to the chat
   */
  const handleSendMessage = async (content: string) => {
    if (!vsCodeApi) {
      console.error('VSCode API not available');
      return;
    }
    
    setAiStatus(AIStatus.PROCESSING);
    
    // In a real implementation, this would communicate with the extension
    vsCodeApi.postMessage({
      type: 'send-message',
      sessionId: session?.id,
      content
    });
    
    // For demo purposes, simulate a response after a delay
    if (!session) {
      // Create a mock session if none exists
      const mockSession: ChatSession = {
        id: 'mock-session',
        title: 'New Chat',
        messages: [
          {
            id: 'mock-user-msg',
            role: 'user',
            content,
            timestamp: Date.now()
          }
        ],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        metadata: {}
      };
      
      setSession(mockSession);
    }
  };

  /**
   * Creates a new chat session
   */
  const handleNewSession = async () => {
    if (!vsCodeApi) {
      console.error('VSCode API not available');
      return;
    }
    
    // Send message to extension
    vsCodeApi.postMessage({ type: 'new-session' });
    
    // For demo purposes, clear the UI immediately
    setSession(null);
    setCodeSuggestion('');
    setCodeLanguage(undefined);
    setCodeExplanation(undefined);
    setAiStatus(AIStatus.IDLE);
  };

  /**
   * Clears the chat history
   */
  const handleClearHistory = async () => {
    if (!vsCodeApi || !session) {
      return;
    }
    
    // Send message to extension
    vsCodeApi.postMessage({
      type: 'clear-history',
      sessionId: session.id
    });
    
    // For demo purposes, clear messages immediately
    if (session) {
      const updatedSession = {
        ...session,
        messages: []
      };
      setSession(updatedSession);
    }
  };

  /**
   * Handles accepting a code suggestion
   */
  const handleAcceptCode = () => {
    if (!vsCodeApi) {
      return;
    }
    
    // Send message to extension to insert code
    vsCodeApi.postMessage({
      type: 'accept-code',
      code: codeSuggestion,
      language: codeLanguage
    });
    
    // Clear the suggestion
    setCodeSuggestion('');
    setCodeLanguage(undefined);
    setCodeExplanation(undefined);
  };

  /**
   * Handles rejecting a code suggestion
   */
  const handleRejectCode = () => {
    // Simply clear the suggestion
    setCodeSuggestion('');
    setCodeLanguage(undefined);
    setCodeExplanation(undefined);
  };

  /**
   * Requests a new code suggestion
   */
  const handleRequestNewCode = () => {
    if (!vsCodeApi || !session) {
      return;
    }
    
    setAiStatus(AIStatus.PROCESSING);
    
    // Send message to extension
    vsCodeApi.postMessage({
      type: 'regenerate-code',
      sessionId: session.id
    });
  };

  /**
   * Handles clicking on the status bar
   */
  const handleStatusBarClick = () => {
    if (aiStatus === AIStatus.ERROR) {
      // Clear error state
      setAiStatus(AIStatus.IDLE);
      setErrorMessage(undefined);
    } else {
      // Toggle between local and API mode
      setUsingLocalModel(!usingLocalModel);
      
      if (vsCodeApi) {
        vsCodeApi.postMessage({
          type: 'toggle-model-type',
          useLocalModel: !usingLocalModel
        });
      }
    }
  };

  return (
    <div className="flex flex-col h-screen bg-white">
      {/* Header / code suggestion panel (conditionally rendered) */}
      {codeSuggestion && (
        <EditorIntegration
          codeSuggestion={codeSuggestion}
          language={codeLanguage}
          explanation={codeExplanation}
          onAccept={handleAcceptCode}
          onReject={handleRejectCode}
          onRequestNew={handleRequestNewCode}
        />
      )}
      
      {/* Main chat panel */}
      <div className="flex-grow overflow-hidden">
        <ChatPanel
          session={session}
          onSendMessage={handleSendMessage}
          onNewSession={handleNewSession}
          onClearHistory={handleClearHistory}
          isProcessing={aiStatus === AIStatus.PROCESSING}
          suggestedResponses={suggestedResponses}
        />
      </div>
      
      {/* Status bar */}
      <div className="border-t p-1 bg-gray-100 flex justify-between items-center">
        <StatusBarWidget
          status={aiStatus}
          usingLocalModel={usingLocalModel}
          errorMessage={errorMessage}
          onClick={handleStatusBarClick}
        />
        <div className="text-xs text-gray-500">
          {usingLocalModel ? 'Local Model' : 'API Model'}
        </div>
      </div>
    </div>
  );
};

export default MainView;