/*
 * File: src/front/app.tsx
 * Project: Cipher Intelligence Labs VSCode AI CodeGen
 * Description: Main entry point for the React front-end application.
 * Copyright © 2025 Cipher Intelligence Labs
 */

import React, { useState } from 'react';
import { aiService } from './renderer.jsx';
import './styles/main.css';
import ReactDOM from 'react-dom';

/**
 * Initializes the application and acquires the VSCode API
 */
const initializeApp = () => {
  // Attempt to acquire VSCode API
  try {
    // Check if we're running in VSCode webview context
    // @ts-ignore: TS doesn't know about acquireVsCodeApi
    const vscode = typeof acquireVsCodeApi === 'function' ? acquireVsCodeApi() : undefined;
    
    // Save reference to window for communication
    if (vscode) {
      window.vsCodeApi = vscode;
      console.log('VSCode API acquired');
    } else {
      console.warn('Running outside VSCode context, some features may be unavailable');
    }
  } catch (error) {
    console.warn('Error acquiring VSCode API:', error);
  }
  
  // Render the application
  const rootElement = document.getElementById('root');
  
  if (!rootElement) {
    console.error('Root element not found');
    return;
  }
  
  ReactDOM.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
    rootElement
  );
};

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Main App component
 */
const App: React.FC = () => {
  const [chatMessage, setChatMessage] = useState('');
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleSendMessage = async () => {
    if (!chatMessage.trim()) return;

    setIsLoading(true);
    try {
      const response = await aiService.startChat(chatMessage);
      setChatHistory(prev => [
        ...prev,
        { role: 'user', content: chatMessage },
        { role: 'assistant', content: response }
      ]);
      setChatMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-100">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8">
          <h1 className="text-2xl font-bold text-gray-900">Cipher Coder</h1>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4">
        <div className="max-w-7xl mx-auto">
          <div className="bg-white rounded-lg shadow p-4">
            {chatHistory.map((message, index) => (
              <div
                key={index}
                className={`mb-4 ${
                  message.role === 'user' ? 'text-right' : 'text-left'
                }`}
              >
                <div
                  className={`inline-block p-3 rounded-lg ${
                    message.role === 'user'
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-200 text-gray-800'
                  }`}
                >
                  {message.content}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="text-center text-gray-500">Loading...</div>
            )}
          </div>
        </div>
      </main>

      <footer className="bg-white border-t">
        <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-4">
            <input
              type="text"
              value={chatMessage}
              onChange={(e) => setChatMessage(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder="Type your message..."
              className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              disabled={isLoading}
            />
            <button
              onClick={handleSendMessage}
              disabled={isLoading}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              Send
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};

// Initialize the application when the DOM is ready
document.addEventListener('DOMContentLoaded', initializeApp);

// Export App for testing
export default App;
