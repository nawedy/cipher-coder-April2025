/*
 * File: src/front/components/ChatPanel.tsx
 * Project: Cipher Intelligence Labs VSCode AI CodeGen
 * Description: React component for the chat interface that interacts with the AI assistant.
 * Copyright © 2025 Cipher Intelligence Labs
 */

import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import { Send, Code, Copy, Settings, Download, Trash2 } from 'lucide-react';
import { ChatMessage, ChatSession } from '../../ai/chat/chatController';

/**
 * Props for ChatPanel component
 */
interface ChatPanelProps {
  /**
   * Current chat session
   */
  session: ChatSession | null;
  
  /**
   * Function to handle sending a message
   */
  onSendMessage: (content: string) => Promise<void>;
  
  /**
   * Function to handle creating a new session
   */
  onNewSession: () => Promise<void>;
  
  /**
   * Function to handle clearing the session history
   */
  onClearHistory: () => Promise<void>;
  
  /**
   * Whether a message is currently being processed
   */
  isProcessing: boolean;
  
  /**
   * Suggested responses for quick selection
   */
  suggestedResponses?: string[];
}

/**
 * Chat panel component for interacting with the AI assistant
 */
const ChatPanel: React.FC<ChatPanelProps> = ({
  session,
  onSendMessage,
  onNewSession,
  onClearHistory,
  isProcessing,
  suggestedResponses = []
}) => {
  const [inputValue, setInputValue] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  
  // Scroll to the bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [session?.messages]);
  
  // Focus input when not processing
  useEffect(() => {
    if (!isProcessing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isProcessing]);

  /**
   * Scrolls the chat to the bottom
   */
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  /**
   * Handles sending a message
   */
  const handleSend = () => {
    if (inputValue.trim() && !isProcessing) {
      onSendMessage(inputValue);
      setInputValue('');
    }
  };

  /**
   * Handles key press events in the input
   */
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  /**
   * Formats message content to render code blocks
   */
  const formatMessageContent = (content: string) => {
    // Regex to find code blocks with optional language
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
    const parts: JSX.Element[] = [];
    let lastIndex = 0;
    let match;
    let key = 0;
    
    // Reset regex
    codeBlockRegex.lastIndex = 0;
    
    // Find all code blocks
    while ((match = codeBlockRegex.exec(content)) !== null) {
      // Add text before the code block
      if (match.index > lastIndex) {
        parts.push(
          <span key={key++} className="whitespace-pre-wrap">
            {content.slice(lastIndex, match.index)}
          </span>
        );
      }
      
      // Get language and code
      const language = match[1] || '';
      const code = match[2];
      
      // Add code block
      parts.push(
        <div key={key++} className="relative my-2 w-full">
          <div className="flex justify-between items-center bg-gray-800 text-white py-1 px-2 text-xs rounded-t">
            <span>{language}</span>
            <button 
              className="p-1 hover:bg-gray-700 rounded"
              onClick={() => navigator.clipboard.writeText(code)}
            >
              <Copy size={14} />
            </button>
          </div>
          <pre className="bg-gray-800 text-white p-2 overflow-x-auto rounded-b">
            <code className="text-sm">{code}</code>
          </pre>
        </div>
      );
      
      lastIndex = match.index + match[0].length;
    }
    
    // Add any remaining text
    if (lastIndex < content.length) {
      parts.push(
        <span key={key++} className="whitespace-pre-wrap">
          {content.slice(lastIndex)}
        </span>
      );
    }
    
    return parts.length > 0 ? parts : <span className="whitespace-pre-wrap">{content}</span>;
  };

  /**
   * Renders a single chat message
   */
  const renderMessage = (message: ChatMessage) => {
    const isUser = message.role === 'user';
    const isSystem = message.role === 'system';
    
    if (isSystem) {
      return (
        <div key={message.id} className="p-2 my-1 bg-gray-100 text-xs text-gray-500 rounded italic">
          {message.content}
        </div>
      );
    }
    
    return (
      <div 
        key={message.id} 
        className={`flex my-2 ${isUser ? 'justify-end' : 'justify-start'}`}
      >
        <div 
          className={`p-3 rounded-lg max-w-3/4 ${
            isUser ? 'bg-blue-100 text-gray-800' : 'bg-white border border-gray-200 text-gray-800'
          }`}
        >
          {formatMessageContent(message.content)}
        </div>
      </div>
    );
  };

  /**
   * Renders suggested responses as chips
   */
  const renderSuggestions = () => {
    if (suggestedResponses.length === 0 || isProcessing) {
      return null;
    }
    
    return (
      <div className="flex flex-wrap gap-2 mb-2">
        {suggestedResponses.map((suggestion, index) => (
          <button
            key={index}
            className="py-1 px-3 bg-gray-100 hover:bg-gray-200 rounded-full text-xs text-gray-700"
            onClick={() => {
              setInputValue(suggestion);
              inputRef.current?.focus();
            }}
          >
            {suggestion}
          </button>
        ))}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Chat header */}
      <div className="flex justify-between items-center p-2 border-b bg-white">
        <div className="font-medium text-sm">
          {session ? session.title : 'Chat Assistant'}
        </div>
        <div className="flex space-x-2">
          <button 
            className="p-1 hover:bg-gray-100 rounded"
            onClick={onNewSession}
            title="New conversation"
          >
            <Code size={16} />
          </button>
          <button 
            className="p-1 hover:bg-gray-100 rounded"
            onClick={onClearHistory}
            title="Clear conversation"
          >
            <Trash2 size={16} />
          </button>
          <button 
            className="p-1 hover:bg-gray-100 rounded"
            onClick={() => setShowSettings(!showSettings)}
            title="Settings"
          >
            <Settings size={16} />
          </button>
        </div>
      </div>
      
      {/* Settings panel (collapsible) */}
      {showSettings && (
        <div className="p-3 bg-white border-b">
          <h3 className="text-sm font-medium mb-2">Chat Settings</h3>
          <div className="flex flex-col space-y-2">
            <label className="flex items-center text-xs">
              <input type="checkbox" className="mr-2" />
              Use local model when available
            </label>
            <label className="flex items-center text-xs">
              <input type="checkbox" className="mr-2" />
              Auto-format code
            </label>
          </div>
        </div>
      )}
      
      {/* Chat messages */}
      <div className="flex-grow overflow-y-auto p-4">
        {session?.messages.length ? (
          session.messages.map(renderMessage)
        ) : (
          <div className="text-center text-gray-500 mt-10">
            <p className="mb-2">How can I help you today?</p>
            <p className="text-xs">Ask me to generate code, explain concepts, or help with your project.</p>
          </div>
        )}
        {isProcessing && (
          <div className="flex justify-start my-2">
            <div className="bg-white border border-gray-200 rounded-lg p-3">
              <div className="flex space-x-2">
                <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '600ms' }}></div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      
      {/* Suggested responses */}
      <div className="px-4 pt-2">
        {renderSuggestions()}
      </div>
      
      {/* Chat input */}
      <div className="p-4 border-t bg-white">
        <div className="flex">
          <textarea
            ref={inputRef}
            className="flex-grow p-2 border rounded-l border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            rows={1}
            placeholder="Type a message..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyPress}
            disabled={isProcessing}
          />
          <button
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 rounded-r flex items-center justify-center"
            onClick={handleSend}
            disabled={!inputValue.trim() || isProcessing}
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatPanel;
