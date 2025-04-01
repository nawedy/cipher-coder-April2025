      });
    } else {
      // No active editor, create new file
      vscode.workspace.openTextDocument({
        content: code,
        language: 'javascript' // Default language
      }).then(document => {
        vscode.window.showTextDocument(document);
      });
    }
  }
}
```

### 4. WebView Client Script

Create a client-side script for the WebView:

#### `src/vs/extensions/ai-codegen/webview/chatView.ts`

```typescript
/**
 * File: src/vs/extensions/ai-codegen/webview/chatView.ts
 * Project: VSCode AI Code Generator
 * Description: Client-side script for the chat webview
 * Copyright © 2025 AI Code Generator Project
 */

// Acquire VSCode API
const vscode = acquireVsCodeApi();

// Chat message structure
interface ChatMessage {
  id: string;
  role: 'system' | 'user' | 'assistant';
  content: string;
  timestamp: number;
}

// Chat session structure
interface ChatSession {
  id: string;
  name: string;
  messages: ChatMessage[];
  language?: string;
  createdAt: number;
  updatedAt: number;
}

// State
let sessions: ChatSession[] = [];
let currentSessionId: string = '';
let isProcessing: boolean = false;

// Elements
const chatMessages = document.getElementById('chat-messages') as HTMLDivElement;
const chatInput = document.getElementById('chat-input') as HTMLTextAreaElement;
const sendButton = document.getElementById('send-button') as HTMLButtonElement;
const newChatButton = document.querySelector('.new-chat-button') as HTMLButtonElement;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
});

/**
 * Set up event listeners
 */
function setupEventListeners() {
  // Send message when clicking send button
  sendButton.addEventListener('click', sendMessage);
  
  // Send message when pressing Enter (without shift)
  chatInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  });
  
  // Create new chat
  newChatButton.addEventListener('click', () => {
    vscode.postMessage({
      command: 'createSession'
    });
  });
  
  // Handle message events from the extension
  window.addEventListener('message', handleMessage);
}

/**
 * Sends a message to the extension
 */
function sendMessage() {
  const text = chatInput.value.trim();
  
  if (text && !isProcessing) {
    // Clear input
    chatInput.value = '';
    
    // Add message to UI immediately
    addMessageToUI({
      id: `temp_${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: Date.now()
    });
    
    // Send to extension
    vscode.postMessage({
      command: 'sendMessage',
      text
    });
  }
}

/**
 * Handles messages from the extension
 */
function handleMessage(event: MessageEvent) {
  const message = event.data;
  
  switch (message.command) {
    case 'initialize':
      sessions = message.sessions;
      currentSessionId = message.currentSessionId;
      renderMessages();
      break;
      
    case 'messagesUpdated':
      renderMessages(message.messages);
      break;
      
    case 'sessionsUpdated':
      sessions = message.sessions;
      currentSessionId = message.currentSessionId;
      renderMessages();
      break;
      
    case 'processingStart':
      isProcessing = true;
      sendButton.disabled = true;
      sendButton.textContent = 'Processing...';
      break;
      
    case 'processingEnd':
      isProcessing = false;
      sendButton.disabled = false;
      sendButton.textContent = 'Send';
      break;
      
    case 'error':
      showError(message.message);
      break;
  }
}

/**
 * Renders messages in the UI
 */
function renderMessages(messages?: ChatMessage[]) {
  // Clear messages
  chatMessages.innerHTML = '';
  
  // If messages are provided, use those, otherwise get from current session
  const messagesToRender = messages || getCurrentSessionMessages();
  
  // Render each message
  messagesToRender.forEach(message => {
    addMessageToUI(message);
  });
  
  // Scroll to bottom
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

/**
 * Adds a message to the UI
 */
function addMessageToUI(message: ChatMessage) {
  const messageElement = document.createElement('div');
  messageElement.classList.add('message');
  messageElement.classList.add(message.role);
  
  // Format content
  let content = message.content;
  
  // Look for code blocks and make them copyable
  content = formatCodeBlocks(content);
  
  // Set content
  messageElement.innerHTML = content;
  
  // Add to messages
  chatMessages.appendChild(messageElement);
  
  // Add code insert buttons
  addCodeInsertButtons(messageElement);
  
  // Scroll to bottom
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

/**
 * Formats code blocks in a message
 */
function formatCodeBlocks(content: string): string {
  // Replace ```code``` blocks with formatted HTML
  return content.replace(/```(\w*)\n([\s\S]+?)```/g, (match, language, code) => {
    return `<div class="code-block">
      <div class="code-header">
        <span class="code-language">${language || 'code'}</span>
        <button class="copy-button">Copy</button>
        <button class="insert-button">Insert</button>
      </div>
      <pre><code>${escapeHtml(code)}</code></pre>
    </div>`;
  });
}

/**
 * Adds event listeners to code insert buttons
 */
function addCodeInsertButtons(messageElement: HTMLElement) {
  const insertButtons = messageElement.querySelectorAll('.insert-button');
  const copyButtons = messageElement.querySelectorAll('.copy-button');
  
  insertButtons.forEach(button => {
    button.addEventListener('click', (event) => {
      const codeBlock = (event.target as HTMLElement).closest('.code-block');
      const code = codeBlock?.querySelector('code')?.textContent || '';
      
      vscode.postMessage({
        command: 'insertCode',
        code
      });
    });
  });
  
  copyButtons.forEach(button => {
    button.addEventListener('click', (event) => {
      const codeBlock = (event.target as HTMLElement).closest('.code-block');
      const code = codeBlock?.querySelector('code')?.textContent || '';
      
      // Use clipboard API (wrapped in try/catch for compatibility)
      try {
        navigator.clipboard.writeText(code);
      } catch (error) {
        // Fallback - create temp textarea
        const textarea = document.createElement('textarea');
        textarea.value = code;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      
      // Show copied feedback
      const originalText = (event.target as HTMLElement).textContent;
      (event.target as HTMLElement).textContent = 'Copied!';
      setTimeout(() => {
        (event.target as HTMLElement).textContent = originalText;
      }, 1500);
    });
  });
}

/**
 * Gets messages from current session
 */
function getCurrentSessionMessages(): ChatMessage[] {
  const session = sessions.find(s => s.id === currentSessionId);
  return session?.messages || [];
}

/**
 * Shows an error message
 */
function showError(message: string) {
  const errorElement = document.createElement('div');
  errorElement.classList.add('error-message');
  errorElement.textContent = message;
  
  chatMessages.appendChild(errorElement);
  
  // Remove after delay
  setTimeout(() => {
    errorElement.remove();
  }, 5000);
}

/**
 * Helper to escape HTML
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
```

### 5. WebView Styles

Create styles for the WebView:

#### `src/vs/extensions/ai-codegen/webview/chatView.css`

```css
/* 
 * File: src/vs/extensions/ai-codegen/webview/chatView.css
 * Project: VSCode AI Code Generator
 * Description: Styles for the chat webview
 * Copyright © 2025 AI Code Generator Project
 */

body {
  font-family: var(--vscode-font-family);
  font-size: var(--vscode-font-size);
  color: var(--vscode-foreground);
  padding: 0;
  margin: 0;
}

#chat-app {
  display: flex;
  flex-direction: column;
  height: 100vh;
}

.chat-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background-color: var(--vscode-editor-background);
  border-bottom: 1px solid var(--vscode-panel-border);
}

.chat-title {
  font-weight: bold;
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
}

.message {
  margin-bottom: 12px;
  padding: 8px 12px;
  border-radius: 6px;
  max-width: 80%;
}

.message.user {
  background-color: var(--vscode-button-background);
  color: var(--vscode-button-foreground);
  align-self: flex-end;
  margin-left: auto;
}

.message.assistant {
  background-color: var(--vscode-editor-inactiveSelectionBackground);
  color: var(--vscode-editor-foreground);
  align-self: flex-start;
}

.chat-input-container {
  padding: 12px;
  display: flex;
  border-top: 1px solid var(--vscode-panel-border);
}

#chat-input {
  flex: 1;
  padding: 8px;
  min-height: 40px;
  max-height: 120px;
  resize: vertical;
  background-color: var(--vscode-input-background);
  color: var(--vscode-input-foreground);
  border: 1px solid var(--vscode-input-border);
  border-radius: 4px;
  font-family: var(--vscode-font-family);
}

button {
  padding: 8px 12px;
  background-color: var(--vscode-button-background);
  color: var(--vscode-button-foreground);
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

button:hover {
  background-color: var(--vscode-button-hoverBackground);
}

button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.code-block {
  background-color: var(--vscode-editor-background);
  border: 1px solid var(--vscode-panel-border);
  border-radius: 4px;
  margin: 8px 0;
  overflow: hidden;
}

.code-header {
  display: flex;
  justify-content: space-between;
  padding: 4px 8px;
  background-color: var(--vscode-tab-inactiveBackground);
  border-bottom: 1px solid var(--vscode-panel-border);
}

.code-language {
  font-family: monospace;
  font-size: 12px;
  color: var(--vscode-descriptionForeground);
}

.code-block pre {
  margin: 0;
  padding: 8px;
  overflow-x: auto;
}

.code-block code {
  font-family: var(--vscode-editor-font-family);
  font-size: var(--vscode-editor-font-size);
}

.copy-button,
.insert-button {
  font-size: 12px;
  padding: 2px 6px;
  margin-left: 4px;
}

.error-message {
  background-color: var(--vscode-inputValidation-errorBackground);
  color: var(--vscode-inputValidation-errorForeground);
  border: 1px solid var(--vscode-inputValidation-errorBorder);
  border-radius: 4px;
  padding: 8px 12px;
  margin: 8px 0;
}
```

### 6. Extension Manifest

Create the extension manifest:

#### `src/vs/extensions/ai-codegen/package.json`

```json
{
  "name": "vscode-ai-codegen",
  "displayName": "AI Code Generator",
  "description": "Generate code using AI with a chat interface",
  "version": "1.0.0",
  "engines": {
    "vscode": "^1.60.0"
  },
  "categories": [
    "Programming Languages",
    "Other"
  ],
  "activationEvents": [
    "onView:aiCodegen.chatView",
    "onCommand:aiCodegen.generateCode",
    "onCommand:aiCodegen.improveCode",
    "onCommand:aiCodegen.openChat",
    "onCommand:aiCodegen.setApiKey"
  ],
  "main": "./dist/extension.js",
  "contributes": {
    "viewsContainers": {
      "activitybar": [
        {
          "id": "aiCodegen",
          "title": "AI Code Generator",
          "icon": "resources/icon.svg"
        }
      ]
    },
    "views": {
      "aiCodegen": [
        {
          "id": "aiCodegen.chatView",
          "name": "AI Chat",
          "type": "webview"
        }
      ]
    },
    "commands": [
      {
        "command": "aiCodegen.generateCode",
        "title": "AI: Generate Code",
        "category": "AI Code Generator"
      },
      {
        "command": "aiCodegen.improveCode",
        "title": "AI: Improve Selected Code",
        "category": "AI Code Generator"
      },
      {
        "command": "aiCodegen.openChat",
        "title": "AI: Open Chat",
        "category": "AI Code Generator"
      },
      {
        "command": "aiCodegen.setApiKey",
        "title": "AI: Set API Key",
        "category": "AI Code Generator"
      }
    ],
    "configuration": {
      "title": "AI Code Generator",
      "properties": {
        "aiCodegen.localModelPath": {
          "type": "string",
          "default": "",
          "description": "Path to local LLM model (leave empty to use API)"
        },
        "aiCodegen.apiEndpoint": {
          "type": "string",
          "default": "https://api.openai.com/v1/chat/completions",
          "description": "API endpoint URL for external LLM service"
        },
        "aiCodegen.defaultModel": {
          "type": "string",
          "default": "gpt-4",
          "description": "Default model to use for code generation"
        },
        "aiCodegen.maxTokens": {
          "type": "number",
          "default": 1024,
          "description": "Maximum tokens for completions"
        },
        "aiCodegen.temperature": {
          "type": "number",
          "default": 0.7,
          "minimum": 0,
          "maximum": 1,
          "description": "Temperature (randomness) of completions"
        }
      }
    },
    "menus": {
      "editor/context": [
        {
          "command": "aiCodegen.improveCode",
          "when": "editorHasSelection",
          "group": "aiCodegen"
        }
      ]
    },
    "keybindings": [
      {
        "command": "aiCodegen.generateCode",
        "key": "ctrl+shift+i",
        "mac": "cmd+shift+i"
      },
      {
        "command": "aiCodegen.openChat",
        "key": "ctrl+shift+a",
        "mac": "cmd+shift+a"
      }
    ]
  },
  "repository": {
    "type": "git",
    "url": "https://github.com/yourusername/vscode-ai-codegen.git"
  },
  "scripts": {
    "vscode:prepublish": "npm run compile",
    "compile": "tsc -p ./",
    "watch": "tsc -watch -p ./",
    "pretest": "npm run compile",
    "test": "node ./out/test/runTest.js"
  }
}
```

### 7. Webpack Configuration for Extension

Create a Webpack configuration for the extension:

#### `webpack.extension.config.js`

```javascript
const path = require('path');

module.exports = {
  mode: 'production',
  entry: {
    extension: './src/vs/extensions/ai-codegen/extension.ts',
    chatView: './src/vs/extensions/ai-codegen/webview/chatView.ts'
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
    libraryTarget: 'commonjs2'
  },
  externals: {
    vscode: 'commonjs vscode'
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.json']
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        loader: 'ts-loader',
        exclude: /node_modules/
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader']
      }
    ]
  },
  target: 'node',
  node: {
    __dirname: false
  }
};
```

### 8. Building and Packaging the Extension

Now that we have all the components, let's build and package the extension:

```bash
# Build TypeScript
npm run build

# Bundle extension with Webpack
npx webpack --config webpack.extension.config.js

# Package extension
vsce package
```

This will create a `.vsix` file in the project root that can be installed in VSCode.

## Testing and Debugging

### 1. Testing the Standalone Desktop App

To test the standalone desktop app:

```bash
# Start in development mode
npm run electron-start
```

### 2. Testing the VSCode Extension

To test the VSCode extension:

1. Press F5 in VSCode to launch the Extension Development Host
2. In the new VSCode window, open the AI Code Generator view in the Activity Bar
3. Try using the commands from the Command Palette (Ctrl+Shift+P or Cmd+Shift+P)

### 3. Debugging

#### For the Standalone App:

```bash
# Start with DevTools
NODE_ENV=development npm run electron-start
```

#### For the VSCode Extension:

1. Add breakpoints in your code
2. Press F5 to start debugging
3. Use the Debug Console to view logs and evaluate expressions

## Packaging and Distribution

### 1. Packaging the Standalone App

```bash
# For Windows
npm run electron-build -- --win

# For macOS
npm run electron-build -- --mac

# For Linux
npm run electron-build -- --linux

# For all platforms
npm run electron-build -- --win --mac --linux
```

### 2. Publishing the VSCode Extension

```bash
# Login to vsce
vsce login <publisher>

# Publish extension
vsce publish
```

## Maintenance and Updates

### 1. Update Dependencies

Regularly update dependencies to ensure security and compatibility:

```bash
# Check for outdated packages
npm outdated

# Update packages
npm update
```

### 2. Update VSCode API

When updating the VSCode API:

1. Update the `vscode` dependency in `package.json`
2. Check for API changes in the [VSCode Extension API documentation](https://code.visualstudio.com/api)
3. Test thoroughly with the new API version

### 3. Update AI Models

When updating AI models:

1. Update the model endpoint URL and parameters in `settings.json`
2. Test with the new model to ensure compatibility
3. Update documentation to reflect new capabilities

## Troubleshooting

### Common Issues and Solutions

#### API Connection Issues

If you encounter API connection issues:

1. Check your API key and endpoint URL
2. Verify internet connectivity
3. Check for rate limits or quota issues
4. Look for error responses in the logs

#### Building and Packaging Issues

If you encounter issues during building or packaging:

1. Clear the `dist` and `node_modules` folders and reinstall dependencies
2. Check TypeScript errors in the output
3. Verify Webpack configuration
4. For Electron packaging, check system requirements

#### Extension Loading Issues

If the extension fails to load in VSCode:

1. Check the developer console for errors (Help > Toggle Developer Tools)
2. Verify the activation events in `package.json`
3. Make sure all dependencies are properly bundled

## Conclusion

You now have a complete implementation guide for both a standalone desktop application and a VSCode extension for the AI Code Generator. Both implementations share the same core AI components but offer different integration approaches.

The standalone desktop app is ideal for users who want a dedicated application for AI code generation, while the VSCode extension provides seamless integration with the existing VSCode workflow.

By following this guide, you should be able to build, test, and deploy both versions successfully.


.sidebar-header {
  padding: 10px 15px;
  border-bottom: 1px solid #3c3c3c;
  font-weight: bold;
}

.sidebar-content {
  flex: 1;
  overflow-y: auto;
}

.editor-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.editor-tabs {
  background-color: #2d2d2d;
  border-bottom: 1px solid #3c3c3c;
  display: flex;
}

.editor-tab {
  padding: 8px 15px;
  border-right: 1px solid #3c3c3c;
  cursor: pointer;
}

.editor-tab.active {
  background-color: #1e1e1e;
  border-bottom: 2px solid #0e639c;
}

.editor {
  flex: 1;
  overflow: auto;
  padding: 10px;
  font-family: 'Courier New', Courier, monospace;
}

.chat-container {
  height: 300px;
  border-top: 1px solid #3c3c3c;
  display: flex;
  flex-direction: column;
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 10px;
}

.chat-input-container {
  display: flex;
  padding: 10px;
  border-top: 1px solid #3c3c3c;
}

.chat-input {
  flex: 1;
  padding: 8px 12px;
  background-color: #3c3c3c;
  border: none;
  color: #d4d4d4;
  border-radius: 4px;
}

.chat-button {
  margin-left: 10px;
  padding: 8px 16px;
  background-color: #0e639c;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.chat-button:hover {
  background-color: #1177bb;
}

.status-bar {
  padding: 5px 10px;
  background-color: #007acc;
  color: white;
  font-size: 12px;
}

/* Message styling */
.message {
  margin-bottom: 10px;
  padding: 8px 12px;
  border-radius: 4px;
  max-width: 80%;
}

.message.user {
  background-color: #2d2d2d;
  align-self: flex-end;
  margin-left: auto;
}

.message.assistant {
  background-color: #3c3c3c;
  align-self: flex-start;
}

/* Button styling */
button {
  background-color: #0e639c;
  color: white;
  border: none;
  padding: 8px 12px;
  border-radius: 4px;
  cursor: pointer;
}

button:hover {
  background-color: #1177bb;
}

button:disabled {
  background-color: #3c3c3c;
  cursor: not-allowed;
}
```

### 4. Frontend Components

Let's implement the React components for our desktop application:

#### `src/front/components/ChatPanel.tsx`

```typescript
/**
 * File: src/front/components/ChatPanel.tsx
 * Project: VSCode AI Code Generator
 * Description: Chat interface component for interacting with the AI
 * Copyright © 2025 AI Code Generator Project
 */

import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage } from '../../ai/chat/chatController';

interface ChatPanelProps {
  messages: ChatMessage[];
  onSendMessage: (message: string) => Promise<void>;
  isProcessing: boolean;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({ 
  messages, 
  onSendMessage, 
  isProcessing 
}) => {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (input.trim() && !isProcessing) {
      const message = input.trim();
      setInput('');
      await onSendMessage(message);
    }
  };

  return (
    <div className="chat-container">
      <div className="chat-messages">
        {messages.map((message) => (
          <div 
            key={message.id} 
            className={`message ${message.role === 'user' ? 'user' : 'assistant'}`}
          >
            {message.content}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      
      <form onSubmit={handleSubmit} className="chat-input-container">
        <input
          type="text"
          className="chat-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask the AI..."
          disabled={isProcessing}
        />
        <button 
          type="submit" 
          className="chat-button"
          disabled={isProcessing || !input.trim()}
        >
          {isProcessing ? 'Processing...' : 'Send'}
        </button>
      </form>
    </div>
  );
};
```

#### `src/front/components/EditorPanel.tsx`

```typescript
/**
 * File: src/front/components/EditorPanel.tsx
 * Project: VSCode AI Code Generator
 * Description: Code editor component
 * Copyright © 2025 AI Code Generator Project
 */

import React, { useState } from 'react';

interface EditorTab {
  id: string;
  name: string;
  content: string;
  language: string;
}

interface EditorPanelProps {
  initialTabs?: EditorTab[];
}

export const EditorPanel: React.FC<EditorPanelProps> = ({ initialTabs = [] }) => {
  const [tabs, setTabs] = useState<EditorTab[]>(initialTabs.length > 0 ? initialTabs : [
    { id: 'new-file', name: 'New File', content: '', language: 'javascript' }
  ]);
  const [activeTabId, setActiveTabId] = useState<string>(
    initialTabs.length > 0 ? initialTabs[0].id : 'new-file'
  );

  const handleTabClick = (tabId: string) => {
    setActiveTabId(tabId);
  };

  const handleContentChange = (content: string) => {
    setTabs(tabs.map(tab => 
      tab.id === activeTabId ? { ...tab, content } : tab
    ));
  };

  const activeTab = tabs.find(tab => tab.id === activeTabId) || tabs[0];

  const handleNewTab = () => {
    const newTab: EditorTab = {
      id: `new-file-${Date.now()}`,
      name: `New File ${tabs.length + 1}`,
      content: '',
      language: 'javascript'
    };
    
    setTabs([...tabs, newTab]);
    setActiveTabId(newTab.id);
  };

  const handleSaveFile = async () => {
    // Check if we have access to Electron API
    if (window.electronAPI) {
      try {
        const result = await window.electronAPI.saveFile(
          activeTab.content,
          activeTab.name,
          [{ name: 'All Files', extensions: ['*'] }]
        );
        
        if (result.success) {
          // Update tab name with filename
          const fileName = result.filePath.split(/[/\\]/).pop();
          setTabs(tabs.map(tab => 
            tab.id === activeTabId ? { ...tab, name: fileName } : tab
          ));
        }
      } catch (error) {
        console.error('Error saving file:', error);
      }
    } else {
      // Fallback for non-Electron environments
      console.log('Save functionality requires Electron environment');
    }
  };

  return (
    <div className="editor-container">
      <div className="editor-tabs">
        {tabs.map(tab => (
          <div 
            key={tab.id}
            className={`editor-tab ${tab.id === activeTabId ? 'active' : ''}`}
            onClick={() => handleTabClick(tab.id)}
          >
            {tab.name}
          </div>
        ))}
        <div className="editor-tab" onClick={handleNewTab}>+</div>
      </div>
      
      <div className="editor-actions">
        <button onClick={handleSaveFile}>Save</button>
      </div>
      
      <div className="editor">
        <textarea
          value={activeTab.content}
          onChange={(e) => handleContentChange(e.target.value)}
          spellCheck={false}
          style={{ 
            width: '100%', 
            height: '100%', 
            backgroundColor: 'transparent',
            color: 'inherit',
            border: 'none',
            outline: 'none',
            resize: 'none',
            fontFamily: 'monospace'
          }}
        />
      </div>
    </div>
  );
};
```

#### `src/front/components/StatusBar.tsx`

```typescript
/**
 * File: src/front/components/StatusBar.tsx
 * Project: VSCode AI Code Generator
 * Description: Status bar component for the application
 * Copyright © 2025 AI Code Generator Project
 */

import React from 'react';

interface StatusBarProps {
  status: string;
}

export const StatusBar: React.FC<StatusBarProps> = ({ status }) => {
  return (
    <div className="status-bar">
      {status}
    </div>
  );
};
```

#### `src/front/views/MainView.tsx`

```typescript
/**
 * File: src/front/views/MainView.tsx
 * Project: VSCode AI Code Generator
 * Description: Main view that integrates all UI components
 * Copyright © 2025 AI Code Generator Project
 */

import React, { useState, useEffect } from 'react';
import { ChatPanel } from '../components/ChatPanel';
import { EditorPanel } from '../components/EditorPanel';
import { StatusBar } from '../components/StatusBar';
import { ChatController, ChatMessage, ChatSession } from '../../ai/chat/chatController';
import { CodeGenerationOptions } from '../../ai/generator/codeGenerator';

export const MainView: React.FC = () => {
  // State
  const [chatController] = useState(() => new ChatController());
  const [currentSession, setCurrentSession] = useState<ChatSession | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState('Ready');

  // Initialize chat
  useEffect(() => {
    // Create default session if none exists
    if (chatController.getSessions().length === 0) {
      const newSession = chatController.createSession('New Chat');
      setSessions([newSession]);
      setCurrentSession(newSession);
      setMessages(newSession.messages);
    } else {
      setSessions(chatController.getSessions());
      const firstSession = chatController.getSessions()[0];
      setCurrentSession(firstSession);
      setMessages(firstSession.messages);
    }
  }, [chatController]);

  // Handle sending a message
  const handleSendMessage = async (content: string) => {
    if (!currentSession) return;
    
    setIsProcessing(true);
    setStatus('AI is processing...');
    
    try {
      const options: CodeGenerationOptions = {
        language: currentSession.language
      };
      
      await chatController.sendMessage(currentSession.id, content, options);
      
      // Update messages
      const updatedSession = chatController.getSession(currentSession.id);
      if (updatedSession) {
        setMessages([...updatedSession.messages]);
      }
      
      setStatus('Ready');
    } catch (error) {
      console.error('Error sending message:', error);
      setStatus(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Create a new chat session
  const createNewSession = () => {
    const newSession = chatController.createSession('New Chat');
    setSessions([...sessions, newSession]);
    setCurrentSession(newSession);
    setMessages(newSession.messages);
  };

  // Switch to a different session
  const switchSession = (sessionId: string) => {
    const session = chatController.getSession(sessionId);
    if (session) {
      setCurrentSession(session);
      setMessages(session.messages);
    }
  };

  return (
    <>
      <div className="main-container">
        <div className="sidebar">
          <div className="sidebar-header">Chat Sessions</div>
          <div className="sidebar-content">
            {sessions.map(session => (
              <div 
                key={session.id}
                className={`sidebar-item ${currentSession?.id === session.id ? 'active' : ''}`}
                onClick={() => switchSession(session.id)}
              >
                {session.name}
              </div>
            ))}
            <button onClick={createNewSession}>New Chat</button>
          </div>
        </div>
        
        <div className="content">
          <EditorPanel />
          <ChatPanel 
            messages={messages} 
            onSendMessage={handleSendMessage}
            isProcessing={isProcessing}
          />
        </div>
      </div>
      
      <StatusBar status={status} />
    </>
  );
};
```

### 5. Webpack Configuration

Create a Webpack configuration to bundle the frontend:

#### `webpack.config.js`

```javascript
const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
  mode: process.env.NODE_ENV || 'development',
  entry: './src/front/app.tsx',
  target: 'electron-renderer',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'app.js'
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.json']
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        loader: 'ts-loader',
        exclude: /node_modules/
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader']
      }
    ]
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './src/front/index.html'
    })
  ]
};
```

### 6. Electron Builder Configuration

Add Electron Builder configuration to `package.json`:

```json
{
  "build": {
    "appId": "com.company.vscode-ai-codegen",
    "productName": "VSCode AI Code Generator",
    "directories": {
      "output": "dist-electron"
    },
    "files": [
      "dist/**/*",
      "electron-main.js",
      "preload.js",
      "package.json"
    ],
    "win": {
      "target": ["nsis"],
      "icon": "resources/icon.ico"
    },
    "mac": {
      "target": ["dmg"],
      "icon": "resources/icon.icns"
    },
    "linux": {
      "target": ["AppImage", "deb"],
      "icon": "resources/icon.png"
    }
  }
}
```

### 7. Building the Standalone Desktop Application

Now that we have all the components, let's build the application:

```bash
# Build TypeScript
npm run build

# Bundle frontend with Webpack
npx webpack

# Build Electron application
npm run electron-build
```

This will create distributable packages in the `dist-electron` directory.

## VSCode Extension Implementation

Now, let's implement the VSCode extension version of our AI code generator.

### 1. Extension Entry Point

Create the extension entry point:

#### `src/vs/extensions/ai-codegen/extension.ts`

```typescript
/**
 * File: src/vs/extensions/ai-codegen/extension.ts
 * Project: VSCode AI Code Generator
 * Description: Main entry point for the VSCode extension
 * Copyright © 2025 AI Code Generator Project
 */

import * as vscode from 'vscode';
import { CodeGenerator } from '../../../ai/generator/codeGenerator';
import { ChatController } from '../../../ai/chat/chatController';
import { EnvManager } from '../../../ai/config/env';
import { VSCodeChatViewProvider } from './chatViewProvider';
import { registerCommands } from './commands';

// Extension activation function
export async function activate(context: vscode.ExtensionContext) {
  console.log('AI Code Generator extension is now active');
  
  // Initialize environment manager with VSCode secret storage
  const envManager = EnvManager.getInstance(
    undefined, 
    context.secrets
  );
  
  // Initialize services
  const codeGenerator = new CodeGenerator();
  const chatController = new ChatController();
  
  // Register webview provider for chat interface
  const chatViewProvider = new VSCodeChatViewProvider(
    context.extensionUri,
    chatController
  );
  
  const chatView = vscode.window.registerWebviewViewProvider(
    'aiCodegen.chatView',
    chatViewProvider
  );
  
  // Register commands
  const commands = registerCommands(codeGenerator, chatController);
  
  // Add all disposables to context
  context.subscriptions.push(
    chatView,
    ...commands
  );
  
  // Show welcome message on first activation
  const hasShownWelcome = context.globalState.get('aiCodegen.hasShownWelcome');
  if (!hasShownWelcome) {
    vscode.window.showInformationMessage(
      'AI Code Generator extension is now active! Use the chat panel or run the "AI: Generate Code" command to get started.'
    );
    context.globalState.update('aiCodegen.hasShownWelcome', true);
  }
}

// Extension deactivation function
export function deactivate() {
  console.log('AI Code Generator extension has been deactivated');
}
```

### 2. VSCode Commands

Create the commands for the extension:

#### `src/vs/extensions/ai-codegen/commands.ts`

```typescript
/**
 * File: src/vs/extensions/ai-codegen/commands.ts
 * Project: VSCode AI Code Generator
 * Description: VSCode commands for AI code generation
 * Copyright © 2025 AI Code Generator Project
 */

import * as vscode from 'vscode';
import { CodeGenerator, CodeGenerationOptions } from '../../../ai/generator/codeGenerator';
import { ChatController } from '../../../ai/chat/chatController';

/**
 * Registers all extension commands
 */
export function registerCommands(
  codeGenerator: CodeGenerator,
  chatController: ChatController
): vscode.Disposable[] {
  const disposables: vscode.Disposable[] = [];
  
  // Command to generate code
  disposables.push(
    vscode.commands.registerCommand('aiCodegen.generateCode', async () => {
      const prompt = await vscode.window.showInputBox({
        prompt: 'What code would you like to generate?',
        placeHolder: 'E.g., "Create a function to reverse a string"'
      });
      
      if (!prompt) return;
      
      try {
        // Show progress indicator
        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: 'Generating code...',
            cancellable: false
          },
          async (progress) => {
            // Determine language from active editor
            let language: string | undefined;
            const activeEditor = vscode.window.activeTextEditor;
            
            if (activeEditor) {
              language = activeEditor.document.languageId;
            }
            
            // Generate code
            const options: CodeGenerationOptions = { language };
            const generatedCode = await codeGenerator.generateCode(prompt, options);
            
            // Insert into editor
            if (activeEditor) {
              const position = activeEditor.selection.active;
              
              await activeEditor.edit((editBuilder) => {
                editBuilder.insert(position, generatedCode);
              });
              
              vscode.window.showInformationMessage('Code generated and inserted');
            } else {
              // No active editor, create a new file
              const document = await vscode.workspace.openTextDocument({
                content: generatedCode,
                language: language || 'javascript'
              });
              
              await vscode.window.showTextDocument(document);
              vscode.window.showInformationMessage('Code generated in new file');
            }
          }
        );
      } catch (error) {
        vscode.window.showErrorMessage(
          `Error generating code: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    })
  );
  
  // Command to improve selected code
  disposables.push(
    vscode.commands.registerCommand('aiCodegen.improveCode', async () => {
      const activeEditor = vscode.window.activeTextEditor;
      
      if (!activeEditor) {
        vscode.window.showErrorMessage('No active editor to improve code');
        return;
      }
      
      const selection = activeEditor.selection;
      
      if (selection.isEmpty) {
        vscode.window.showErrorMessage('No code selected to improve');
        return;
      }
      
      try {
        // Get selected code
        const selectedText = activeEditor.document.getText(selection);
        
        // Create prompt for improvement
        const prompt = `Improve the following code, making it more efficient, readable, and following best practices:\n\n${selectedText}`;
        
        // Show progress indicator
        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: 'Improving code...',
            cancellable: false
          },
          async (progress) => {
            // Generate improved code
            const options: CodeGenerationOptions = {
              language: activeEditor.document.languageId
            };
            
            const improvedCode = await codeGenerator.generateCode(prompt, options);
            
            // Replace selected code
            await activeEditor.edit((editBuilder) => {
              editBuilder.replace(selection, improvedCode);
            });
            
            vscode.window.showInformationMessage('Code improved successfully');
          }
        );
      } catch (error) {
        vscode.window.showErrorMessage(
          `Error improving code: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    })
  );
  
  // Command to open chat view
  disposables.push(
    vscode.commands.registerCommand('aiCodegen.openChat', () => {
      vscode.commands.executeCommand('aiCodegen.chatView.focus');
    })
  );
  
  // Command to set API key
  disposables.push(
    vscode.commands.registerCommand('aiCodegen.setApiKey', async () => {
      const apiKey = await vscode.window.showInputBox({
        prompt: 'Enter your API key',
        password: true
      });
      
      if (apiKey) {
        try {
          const envManager = EnvManager.getInstance();
          await envManager.setApiKey(apiKey);
          vscode.window.showInformationMessage('API key saved successfully');
        } catch (error) {
          vscode.window.showErrorMessage('Error saving API key');
        }
      }
    })
  );
  
  return disposables;
}
```

### 3. VSCode WebView Provider

Create a WebView provider for the chat interface:

#### `src/vs/extensions/ai-codegen/chatViewProvider.ts`

```typescript
/**
 * File: src/vs/extensions/ai-codegen/chatViewProvider.ts
 * Project: VSCode AI Code Generator
 * Description: WebView provider for the chat interface
 * Copyright © 2025 AI Code Generator Project
 */

import * as vscode from 'vscode';
import { ChatController, ChatMessage, ChatSession } from '../../../ai/chat/chatController';
import { CodeGenerationOptions } from '../../../ai/generator/codeGenerator';

/**
 * WebView provider for the chat interface
 */
export class VSCodeChatViewProvider implements vscode.WebviewViewProvider {
  private _view?: vscode.WebviewView;
  private _chatController: ChatController;
  private _currentSession?: ChatSession;

  constructor(
    private readonly _extensionUri: vscode.Uri,
    chatController: ChatController
  ) {
    this._chatController = chatController;
    
    // Create initial chat session if needed
    if (this._chatController.getSessions().length === 0) {
      this._currentSession = this._chatController.createSession('New Chat');
    } else {
      this._currentSession = this._chatController.getSessions()[0];
    }
  }

  /**
   * Called when the webview is initialized
   */
  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    token: vscode.CancellationToken
  ): void | Thenable<void> {
    this._view = webviewView;

    // Configure webview
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri]
    };

    // Set initial HTML
    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    // Handle messages from the webview
    webviewView.webview.onDidReceiveMessage(async (message) => {
      switch (message.command) {
        case 'sendMessage':
          await this._handleSendMessage(message.text);
          break;
          
        case 'createSession':
          this._handleCreateSession();
          break;
          
        case 'switchSession':
          this._handleSwitchSession(message.sessionId);
          break;
          
        case 'insertCode':
          this._handleInsertCode(message.code);
          break;
      }
    });

    // Initial data
    this._postMessage({
      command: 'initialize',
      sessions: this._chatController.getSessions(),
      currentSessionId: this._currentSession?.id
    });
  }

  /**
   * Creates the HTML for the webview
   */
  private _getHtmlForWebview(webview: vscode.Webview): string {
    // Create URIs for scripts and styles
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'dist', 'chatView.js')
    );
    
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'dist', 'chatView.css')
    );

    // HTML content
    return `<!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <link href="${styleUri}" rel="stylesheet">
        <title>AI Chat</title>
      </head>
      <body>
        <div id="chat-app">
          <div class="chat-header">
            <span class="chat-title">AI Code Assistant</span>
            <button class="new-chat-button">New Chat</button>
          </div>
          
          <div class="chat-messages" id="chat-messages"></div>
          
          <div class="chat-input-container">
            <textarea id="chat-input" placeholder="Ask the AI..."></textarea>
            <button id="send-button">Send</button>
          </div>
        </div>
        <script src="${scriptUri}"></script>
      </body>
    </html>`;
  }

  /**
   * Sends a message to the webview
   */
  private _postMessage(message: any): void {
    if (this._view) {
      this._view.webview.postMessage(message);
    }
  }

  /**
   * Handles sending a message in the chat
   */
  private async _handleSendMessage(text: string): Promise<void> {
    if (!this._currentSession) return;
    
    try {
      // Determine language from active editor
      let language: string | undefined;
      const activeEditor = vscode.window.activeTextEditor;
      
      if (activeEditor) {
        language = activeEditor.document.languageId;
      }
      
      // Send message
      const options: CodeGenerationOptions = { language };
      
      this._postMessage({ command: 'processingStart' });
      
      await this._chatController.sendMessage(
        this._currentSession.id,
        text,
        options
      );
      
      // Get updated session
      const updatedSession = this._chatController.getSession(this._currentSession.id);
      if (updatedSession) {
        this._currentSession = updatedSession;
      }
      
      // Update UI
      this._postMessage({
        command: 'messagesUpdated',
        messages: this._currentSession.messages
      });
    } catch (error) {
      this._postMessage({
        command: 'error',
        message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    } finally {
      this._postMessage({ command: 'processingEnd' });
    }
  }

  /**
   * Handles creating a new chat session
   */
  private _handleCreateSession(): void {
    this._currentSession = this._chatController.createSession('New Chat');
    
    this._postMessage({
      command: 'sessionsUpdated',
      sessions: this._chatController.getSessions(),
      currentSessionId: this._currentSession.id
    });
  }

  /**
   * Handles switching between chat sessions
   */
  private _handleSwitchSession(sessionId: string): void {
    const session = this._chatController.getSession(sessionId);
    if (session) {
      this._currentSession = session;
      
      this._postMessage({
        command: 'messagesUpdated',
        messages: this._currentSession.messages
      });
    }
  }

  /**
   * Handles inserting code into the editor
   */
  private _handleInsertCode(code: string): void {
    const activeEditor = vscode.window.activeTextEditor;
    
    if (activeEditor) {
      const position = activeEditor.selection.active;
      
      activeEditor.edit((editBuilder) => {
        editBuilder.insert(position, code);
      });
    } else {
      // No active editor, create new file
      vscode.workspace.openTextDocument({
        content: code,
        language: 'javascript' // Default language# VSCode AI Code Generator: Complete Implementation Guide

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
  

#### `src/ai/generator/promptParser.ts`

```typescript
/**
 * File: src/ai/generator/promptParser.ts
 * Project: VSCode AI Code Generator
 * Description: Parses and enhances user prompts for better code generation
 * Copyright © 2025 AI Code Generator Project
 */

export class PromptParser {
  /**
   * Parses and enhances a user prompt for code generation
   */
  public parsePrompt(prompt: string, language?: string): string {
    // Clean up the prompt
    let enhancedPrompt = prompt.trim();
    
    // Add language context if specified
    if (language) {
      enhancedPrompt = `Write the following in ${language}:\n${enhancedPrompt}`;
    }
    
    // Add code-specific context
    if (!enhancedPrompt.includes('code') && !enhancedPrompt.includes('function')) {
      enhancedPrompt = `Write code that ${enhancedPrompt}`;
    }
    
    return enhancedPrompt;
  }
  
  /**
   * Returns a system prompt to guide the AI toward good code generation
   */
  public getSystemPrompt(language?: string): string {
    let systemPrompt = `You are an expert programmer that writes clean, efficient code. `;
    
    if (language) {
      systemPrompt += `You primarily write ${language} code and follow best practices for this language. `;
    }
    
    systemPrompt += `
When asked to generate code, please follow these guidelines:

1. Write clean, readable, and well-documented code.
2. Add helpful comments to explain complex parts.
3. Follow standard conventions and best practices.
4. Include proper error handling.
5. Be concise but complete.
6. Focus only on the code without unnecessary explanations unless requested.

Respond with only the code itself, properly formatted and indented.`;
    
    return systemPrompt;
  }
}
```

#### `src/ai/generator/responsePostProcessor.ts`

```typescript
/**
 * File: src/ai/generator/responsePostProcessor.ts
 * Project: VSCode AI Code Generator
 * Description: Post-processes, formats, and validates generated code
 * Copyright © 2025 AI Code Generator Project
 */

export class ResponsePostProcessor {
  /**
   * Process generated code for better quality and formatting
   */
  public processCode(code: string, language?: string, includeComments: boolean = true): string {
    try {
      // Extract code from potential markdown code blocks
      let processedCode = this.extractCodeFromMarkdown(code);
      
      // Remove unnecessary comments if requested
      if (!includeComments) {
        processedCode = this.removeComments(processedCode, language);
      }
      
      // Add header comment if not present
      processedCode = this.ensureHeaderComment(processedCode, language);
      
      // Format code according to language (would use appropriate formatter)
      // processedCode = this.formatCode(processedCode, language);
      
      return processedCode;
    } catch (error) {
      console.error('Error post-processing code:', error);
      return code; // Return original on error
    }
  }
  
  /**
   * Extracts code from markdown code blocks if present
   */
  private extractCodeFromMarkdown(text: string): string {
    // Check if the text is wrapped in markdown code blocks
    const codeBlockRegex = /```(?:\w+)?\n([\s\S]+?)```/;
    const match = text.match(codeBlockRegex);
    
    if (match && match[1]) {
      return match[1].trim();
    }
    
    return text.trim();
  }
  
  /**
   * Removes comments from code based on language
   */
  private removeComments(code: string, language?: string): string {
    if (!language) {
      return code;
    }
    
    switch (language.toLowerCase()) {
      case 'javascript':
      case 'typescript':
      case 'java':
      case 'c':
      case 'cpp':
      case 'csharp':
        // Remove /* */ comments
        code = code.replace(/\/\*[\s\S]*?\*\//g, '');
        // Remove // comments
        code = code.replace(/\/\/.*$/gm, '');
        break;
        
      case 'python':
        // Remove # comments
        code = code.replace(/^\s*#.*$/gm, '');
        // Remove """ """ comments
        code = code.replace(/"""[\s\S]*?"""/g, '');
        break;
        
      case 'html':
        // Remove <!-- --> comments
        code = code.replace(/<!--[\s\S]*?-->/g, '');
        break;
        
      // Add more language-specific comment removal as needed
    }
    
    // Remove empty lines and normalize spacing
    code = code.replace(/^\s*[\r\n]/gm, '');
    
    return code;
  }
  
  /**
   * Ensures the code has a header comment
   */
  private ensureHeaderComment(code: string, language?: string): string {
    // Skip if no language is specified
    if (!language) {
      return code;
    }
    
    // Check if there's already a header comment
    const firstLines = code.split('\n', 5).join('\n');
    if (firstLines.includes('Copyright') || 
        firstLines.includes('File:') || 
        firstLines.includes('Description:')) {
      return code;
    }
    
    // Create a header comment based on language
    let headerComment = '';
    const date = new Date().toISOString().split('T')[0];
    
    switch (language.toLowerCase()) {
      case 'javascript':
      case 'typescript':
      case 'java':
      case 'c':
      case 'cpp':
      case 'csharp':
        headerComment = `/**
 * Generated by VSCode AI Code Generator
 * Date: ${date}
 * Description: Auto-generated code
 */\n\n`;
        break;
        
      case 'python':
        headerComment = `# Generated by VSCode AI Code Generator
# Date: ${date}
# Description: Auto-generated code\n\n`;
        break;
        
      case 'html':
        headerComment = `<!-- 
  Generated by VSCode AI Code Generator
  Date: ${date}
  Description: Auto-generated code
-->\n\n`;
        break;
        
      // Add more language-specific formats as needed
      
      default:
        // Generic comment for unknown languages
        headerComment = `// Generated by VSCode AI Code Generator
// Date: ${date}
// Description: Auto-generated code\n\n`;
    }
    
    return headerComment + code;
  }
}
```

### 6. Chat

#### `src/ai/chat/chatController.ts`

```typescript
/**
 * File: src/ai/chat/chatController.ts
 * Project: VSCode AI Code Generator
 * Description: Controls chat sessions and message routing
 * Copyright © 2025 AI Code Generator Project
 */

import { ChatService } from './chatService';
import { CodeGenerationOptions } from '../generator/codeGenerator';

// Define message types
export interface ChatMessage {
  id: string;
  role: 'system' | 'user' | 'assistant';
  content: string;
  timestamp: number;
}

// Define chat session
export interface ChatSession {
  id: string;
  name: string;
  messages: ChatMessage[];
  language?: string;
  createdAt: number;
  updatedAt: number;
}

/**
 * Manages chat sessions and routes messages
 */
export class ChatController {
  private chatService: ChatService;
  private sessions: Map<string, ChatSession> = new Map();

  constructor() {
    this.chatService = new ChatService();
  }

  /**
   * Creates a new chat session
   */
  public createSession(name: string = 'New Chat', language?: string): ChatSession {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    
    const session: ChatSession = {
      id: sessionId,
      name,
      messages: [],
      language,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    
    this.sessions.set(sessionId, session);
    return session;
  }

  /**
   * Returns all chat sessions
   */
  public getSessions(): ChatSession[] {
    return Array.from(this.sessions.values());
  }

  /**
   * Gets a specific session by ID
   */
  public getSession(sessionId: string): ChatSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Deletes a chat session
   */
  public deleteSession(sessionId: string): boolean {
    return this.sessions.delete(sessionId);
  }

  /**
   * Adds a message to a session and gets a response
   */
  public async sendMessage(
    sessionId: string,
    content: string,
    options: CodeGenerationOptions = {}
  ): Promise<ChatMessage> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    
    // Create user message
    const userMessage: ChatMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      role: 'user',
      content,
      timestamp: Date.now()
    };
    
    // Add to session
    session.messages.push(userMessage);
    session.updatedAt = Date.now();
    
    // Set language from session if not specified in options
    if (!options.language && session.language) {
      options.language = session.language;
    }
    
    // Get response from chat service
    const responseContent = await this.chatService.processMessage(
      session.messages,
      options
    );
    
    // Create assistant message
    const assistantMessage: ChatMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      role: 'assistant',
      content: responseContent,
      timestamp: Date.now()
    };
    
    // Add to session
    session.messages.push(assistantMessage);
    session.updatedAt = Date.now();
    
    return assistantMessage;
  }
}
```

#### `src/ai/chat/chatService.ts`

```typescript
/**
 * File: src/ai/chat/chatService.ts
 * Project: VSCode AI Code Generator
 * Description: Processes chat messages and generates responses
 * Copyright © 2025 AI Code Generator Project
 */

import { ChatMessage } from './chatController';
import { CodeGenerator, CodeGenerationOptions } from '../generator/codeGenerator';
import { ChatLLMRequest } from '../models/llmRequest';
import { ExternalLLMConnector } from '../apiConnector/externalLLMConnector';
import { PromptParser } from '../generator/promptParser';

export class ChatService {
  private codeGenerator: CodeGenerator;
  private externalConnector: ExternalLLMConnector;
  private promptParser: PromptParser;

  constructor() {
    this.codeGenerator = new CodeGenerator();
    this.externalConnector = new ExternalLLMConnector();
    this.promptParser = new PromptParser();
  }

  /**
   * Processes a message in a chat context
   */
  public async processMessage(
    messages: ChatMessage[],
    options: CodeGenerationOptions = {}
  ): Promise<string> {
    try {
      // Determine if this is a code generation request
      const latestMessage = messages[messages.length - 1];
      const isCodeRequest = this.isCodeGenerationRequest(latestMessage.content);
      
      if (isCodeRequest) {
        // Use code generator for code-specific requests
        return await this.codeGenerator.generateCode(
          latestMessage.content,
          options
        );
      } else {
        // Use chat API for conversation
        const systemPrompt = this.getSystemPrompt(options.language);
        
        // Convert chat history to API format
        const apiMessages = this.convertToAPIMessages(messages, systemPrompt);
        
        // Send request to LLM
        const response = await this.externalConnector.sendChatRequest({
          messages: apiMessages,
          maxTokens: options.maxTokens,
          temperature: options.temperature || 0.7
        });
        
        if (response.error) {
          throw new Error(response.error);
        }
        
        return response.message.content;
      }
    } catch (error) {
      console.error('Error processing message:', error);
      return `Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`;
    }
  }
  
  /**
   * Determines if a message is a code generation request
   */
  private isCodeGenerationRequest(message: string): boolean {
    const codeKeywords = [
      'generate code', 'write code', 'create a function',
      'implement', 'write a class', 'create a method',
      'code that', 'program that', 'script that'
    ];
    
    const lowercaseMessage = message.toLowerCase();
    
    // Check for code keywords
    return codeKeywords.some(keyword => lowercaseMessage.includes(keyword));
  }
  
  /**
   * Converts chat messages to API format
   */
  private convertToAPIMessages(
    messages: ChatMessage[],
    systemPrompt: string
  ): { role: string; content: string }[] {
    // Start with system message
    const apiMessages = [
      { role: 'system', content: systemPrompt }
    ];
    
    // Add conversation history (limited to last 10 messages for context window)
    const conversationHistory = messages.slice(-10);
    
    for (const message of conversationHistory) {
      apiMessages.push({
        role: message.role,
        content: message.content
      });
    }
    
    return apiMessages;
  }
  
  /**
   * Gets system prompt for chat context
   */
  private getSystemPrompt(language?: string): string {
    let systemPrompt = `You are an AI programming assistant that helps with coding questions and generates code. `;
    
    if (language) {
      systemPrompt += `You specialize in ${language} programming. `;
    }
    
    systemPrompt += `
You provide helpful, concise, and accurate responses to programming questions.
When asked to generate code, you write clean, efficient, and well-commented code.
When explaining concepts, you use clear examples to illustrate your points.
You follow best programming practices and conventions.`;
    
    return systemPrompt;
  }
}
```

### 7. Utils

#### `src/ai/utils/logger.ts`

```typescript
/**
 * File: src/ai/utils/logger.ts
 * Project: VSCode AI Code Generator
 * Description: Provides logging functionality
 * Copyright © 2025 AI Code Generator Project
 */

// Log levels
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

export class Logger {
  private static instance: Logger;
  private minLevel: LogLevel = LogLevel.INFO;
  private logListeners: ((level: LogLevel, message: string, data?: any) => void)[] = [];

  private constructor() {}

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  /**
   * Sets the minimum log level to display
   */
  public setMinLevel(level: LogLevel): void {
    this.minLevel = level;
  }

  /**
   * Adds a log listener
   */
  public addListener(listener: (level: LogLevel, message: string, data?: any) => void): void {
    this.logListeners.push(listener);
  }

  /**
   * Removes a log listener
   */
  public removeListener(listener: (level: LogLevel, message: string, data?: any) => void): void {
    const index = this.logListeners.indexOf(listener);
    if (index > -1) {
      this.logListeners.splice(index, 1);
    }
  }

  /**
   * Logs a debug message
   */
  public debug(message: string, data?: any): void {
    this.log(LogLevel.DEBUG, message, data);
  }

  /**
   * Logs an info message
   */
  public info(message: string, data?: any): void {
    this.log(LogLevel.INFO, message, data);
  }

  /**
   * Logs a warning message
   */
  public warn(message: string, data?: any): void {
    this.log(LogLevel.WARN, message, data);
  }

  /**
   * Logs an error message
   */
  public error(message: string, data?: any): void {
    this.log(LogLevel.ERROR, message, data);
  }

  /**
   * Internal logging function
   */
  private log(level: LogLevel, message: string, data?: any): void {
    // Skip if below minimum level
    if (level < this.minLevel) {
      return;
    }

    // Format timestamp
    const timestamp = new Date().toISOString();
    
    // Get level name
    const levelName = LogLevel[level];
    
    // Format message
    const formattedMessage = `[${timestamp}] [${levelName}] ${message}`;
    
    // Log to console
    switch (level) {
      case LogLevel.DEBUG:
        console.debug(formattedMessage, data);
        break;
      case LogLevel.INFO:
        console.info(formattedMessage, data);
        break;
      case LogLevel.WARN:
        console.warn(formattedMessage, data);
        break;
      case LogLevel.ERROR:
        console.error(formattedMessage, data);
        break;
    }
    
    // Notify listeners
    for (const listener of this.logListeners) {
      try {
        listener(level, message, data);
      } catch (error) {
        console.error('Error in log listener:', error);
      }
    }
  }
}
```

#### `src/ai/utils/dataProcessor.ts`

```typescript
/**
 * File: src/ai/utils/dataProcessor.ts
 * Project: VSCode AI Code Generator
 * Description: Utility functions for processing and transforming data
 * Copyright © 2025 AI Code Generator Project
 */

export class DataProcessor {
  /**
   * Truncates text to a specific token count (approximate)
   */
  public static truncateToTokenCount(text: string, maxTokens: number): string {
    // Simple approximation: 1 token ≈ 4 characters
    const avgCharsPerToken = 4;
    const maxChars = maxTokens * avgCharsPerToken;
    
    if (text.length <= maxChars) {
      return text;
    }
    
    return text.slice(0, maxChars) + '...';
  }
  
  /**
   * Extracts code snippets from text
   */
  public static extractCodeSnippets(text: string): string[] {
    const codeBlockRegex = /```(?:\w+)?\n([\s\S]+?)```/g;
    const snippets: string[] = [];
    let match;
    
    while ((match = codeBlockRegex.exec(text)) !== null) {
      snippets.push(match[1].trim());
    }
    
    return snippets;
  }
  
  /**
   * Counts tokens in text (approximation)
   */
  public static countTokens(text: string): number {
    // Simple approximation: 1 token ≈ 4 characters
    return Math.ceil(text.length / 4);
  }
}
```

#### `src/ai/utils/errorHandler.ts`

```typescript
/**
 * File: src/ai/utils/errorHandler.ts
 * Project: VSCode AI Code Generator
 * Description: Centralized error handling functionality
 * Copyright © 2025 AI Code Generator Project
 */

import { Logger } from './logger';

export class ErrorHandler {
  private static logger = Logger.getInstance();

  /**
   * Handles an error with proper logging and formatting
   */
  public static handleError(error: unknown, context?: string): Error {
    const contextPrefix = context ? `[${context}] ` : '';
    let formattedError: Error;
    
    if (error instanceof Error) {
      formattedError = new Error(`${contextPrefix}${error.message}`);
      formattedError.stack = error.stack;
    } else if (typeof error === 'string') {
      formattedError = new Error(`${contextPrefix}${error}`);
    } else {
      formattedError = new Error(`${contextPrefix}Unknown error: ${JSON.stringify(error)}`);
    }
    
    // Log the error
    this.logger.error(formattedError.message, { stack: formattedError.stack });
    
    return formattedError;
  }
  
  /**
   * Wraps an async function with error handling
   */
  public static async wrapAsync<T>(
    fn: () => Promise<T>,
    context?: string
  ): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      throw this.handleError(error, context);
    }
  }
}
```

### 8. Tests

#### `src/ai/tests/generator.test.ts`

```typescript
/**
 * File: src/ai/tests/generator.test.ts
 * Project: VSCode AI Code Generator
 * Description: Tests for the code generator
 * Copyright © 2025 AI Code Generator Project
 */

import { expect } from 'chai';
import 'mocha';
import { CodeGenerator, CodeGenerationSource } from '../generator/codeGenerator';

describe('CodeGenerator', () => {
  let codeGenerator: CodeGenerator;
  
  before(() => {
    codeGenerator = new CodeGenerator();
  });
  
  it('should generate code from a simple prompt', async () => {
    // This test uses the actual API, so we'll mock it in a real implementation
    const prompt = 'Write a function that reverses a string';
    
    try {
      const code = await codeGenerator.generateCode(prompt, {
        source: CodeGenerationSource.API, // Use API to avoid local model setup for tests
        language: 'javascript'
      });
      
      // Check the generated code has expected content
      expect(code).to.be.a('string');
      expect(code.length).to.be.greaterThan(0);
      expect(code).to.include('function');
      expect(code).to.include('reverse');
    } catch (error) {
      // Skip test if API key is not configured
      if (error.message.includes('API key')) {
        console.log('Skipping test due to missing API key');
        this.skip();
      } else {
        throw error;
      }
    }
  });
  
  // More tests would be added here
});
```

## Standalone Desktop App Implementation

Now that we have the core AI components, let's build the standalone desktop application using Electron.

### 1. Electron Entry Point

Create the main electron entry point:

#### `electron-main.js`

```javascript
/**
 * File: electron-main.js
 * Project: VSCode AI Code Generator
 * Description: Main entry point for the Electron desktop application
 * Copyright © 2025 AI Code Generator Project
 */

const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

// Keep a global reference of the window object to prevent it from being garbage collected
let mainWindow;

/**
 * Creates the main application window
 */
function createWindow() {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      preload: path.join(__dirname, 'preload.js')
    },
    title: 'VSCode AI Code Generator',
    icon: path.join(__dirname, 'resources', 'icon.png')
  });

  // Load the index.html file
  mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));

  // Open DevTools in development mode
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }

  // Window closed event
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// App ready event
app.whenReady().then(() => {
  createWindow();

  // Set up IPC event handlers
  setupIPCHandlers();
});

// Quit when all windows are closed, except on macOS
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// On macOS, re-create window when dock icon is clicked
app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

/**
 * Sets up IPC event handlers for communication with the renderer process
 */
function setupIPCHandlers() {
  // Handle file saving
  ipcMain.handle('save-file', async (event, { content, defaultPath, filters }) => {
    const { canceled, filePath } = await dialog.showSaveDialog({
      defaultPath,
      filters: filters || [
        { name: 'All Files', extensions: ['*'] }
      ]
    });

    if (!canceled && filePath) {
      fs.writeFileSync(filePath, content);
      return { success: true, filePath };
    }
    
    return { success: false };
  });

  // Handle file opening
  ipcMain.handle('open-file', async (event, { filters }) => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: filters || [
        { name: 'All Files', extensions: ['*'] }
      ]
    });

    if (!canceled && filePaths.length > 0) {
      const filePath = filePaths[0];
      const content = fs.readFileSync(filePath, 'utf8');
      return { success: true, filePath, content };
    }
    
    return { success: false };
  });
}
```

### 2. Preload Script for Electron

Create a preload script for secure context bridging:

#### `preload.js`

```javascript
/**
 * File: preload.js
 * Project: VSCode AI Code Generator
 * Description: Preload script for Electron to expose secure APIs to renderer
 * Copyright © 2025 AI Code Generator Project
 */

const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld(
  'electronAPI', {
    saveFile: (content, defaultPath, filters) => {
      return ipcRenderer.invoke('save-file', { content, defaultPath, filters });
    },
    openFile: (filters) => {
      return ipcRenderer.invoke('open-file', { filters });
    }
  }
);
```

### 3. Frontend Implementation

Create the frontend for the standalone desktop app:

#### `src/front/index.html`

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>VSCode AI Code Generator</title>
  <link rel="stylesheet" href="styles/main.css">
</head>
<body>
  <div id="root"></div>
  <script src="app.js"></script>
</body>
</html>
```

#### `src/front/app.tsx`

```typescript
/**
 * File: src/front/app.tsx
 * Project: VSCode AI Code Generator
 * Description: Main entry point for the frontend React application
 * Copyright © 2025 AI Code Generator Project
 */

import React from 'react';
import ReactDOM from 'react-dom';
import { MainView } from './views/MainView';
import './styles/main.css';

// Render the main application
ReactDOM.render(
  <React.StrictMode>
    <MainView />
  </React.StrictMode>,
  document.getElementById('root')
);
```

#### `src/front/styles/main.css`

```css
/* 
 * File: src/front/styles/main.css
 * Project: VSCode AI Code Generator
 * Description: Main stylesheet for the application
 * Copyright © 2025 AI Code Generator Project
 */

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
  margin: 0;
  padding: 0;
  background-color: #1e1e1e;
  color: #d4d4d4;
  height: 100vh;
  overflow: hidden;
}

#root {
  height: 100vh;
  display: flex;
  flex-direction: column;
}

.main-container {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.sidebar {
  width: 250px;
  background-color: #252526;
  display: flex;
  flex-direction: column;,
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
    
    // For AUTO or undefined, try to make an intelligent decision
    // Check if a local model path is configured
    const config = this.envManager.getConfig();
    const hasLocalModel = !!config.localLLM.modelPath;
    
    // Check if API key is available (async function but we'll use sync check for simplicity)
    const hasApiKey = !!config.externalLLM.apiKey;
    
    // Prefer local if available, otherwise API
    if (hasLocalModel) {
      return CodeGenerationSource.LOCAL;
    } else if (hasApiKey) {
      return CodeGenerationSource.API;
    } else {
      throw new Error('No local model or API key configured for code generation');
    }
  }
}
