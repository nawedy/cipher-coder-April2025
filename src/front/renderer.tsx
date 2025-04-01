import { ipcRenderer } from 'electron';
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './app';

// Initialize React app
const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Failed to find the root element');
}

const root = createRoot(rootElement);
root.render(React.createElement(React.StrictMode, null, React.createElement(App)));

// IPC handlers for AI functionality
export const aiService = {
  startChat: async (message: string) => {
    return await ipcRenderer.invoke('ai:startChat', message);
  },
  
  generateCode: async (prompt: string) => {
    return await ipcRenderer.invoke('ai:generateCode', prompt);
  },
  
  explainCode: async (code: string) => {
    return await ipcRenderer.invoke('ai:explainCode', code);
  },
  
  improveCode: async (code: string) => {
    return await ipcRenderer.invoke('ai:improveCode', code);
  }
}; 