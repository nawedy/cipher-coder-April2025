/*
 * File: src/front/components/EditorIntegration.tsx
 * Project: Cipher Intelligence Labs VSCode AI CodeGen
 * Description: React component that bridges the editor with AI-generated suggestions.
 * Copyright © 2025 Cipher Intelligence Labs
 */

import * as React from 'react';
import { useState, useEffect } from 'react';
import { Check, X, Copy, Code, Zap, CornerDownLeft } from 'lucide-react';

/**
 * Props for EditorIntegration component
 */
interface EditorIntegrationProps {
  /**
   * Generated code suggestion
   */
  codeSuggestion: string;
  
  /**
   * Programming language of the code
   */
  language?: string;
  
  /**
   * Explanation of the code
   */
  explanation?: string;
  
  /**
   * Function to handle accepting the suggestion
   */
  onAccept: () => void;
  
  /**
   * Function to handle rejecting the suggestion
   */
  onReject: () => void;
  
  /**
   * Function to handle requesting a new suggestion
   */
  onRequestNew: () => void;
}

/**
 * EditorIntegration component that displays and manages code suggestions
 */
const EditorIntegration: React.FC<EditorIntegrationProps> = ({
  codeSuggestion,
  language,
  explanation,
  onAccept,
  onReject,
  onRequestNew
}) => {
  const [showExplanation, setShowExplanation] = useState(false);
  const [copied, setCopied] = useState(false);
  
  // Reset copied state after 2 seconds
  useEffect(() => {
    if (copied) {
      const timeout = setTimeout(() => setCopied(false), 2000);
      return () => clearTimeout(timeout);
    }
  }, [copied]);

  /**
   * Handles copying code to clipboard
   */
  const handleCopyToClipboard = () => {
    navigator.clipboard.writeText(codeSuggestion);
    setCopied(true);
  };

  // If no code suggestion, render placeholder
  if (!codeSuggestion) {
    return (
      <div className="p-4 border-b bg-gray-50 text-gray-500 text-center">
        <p>No code suggestions yet</p>
      </div>
    );
  }

  return (
    <div className="border-b">
      {/* Header */}
      <div className="flex justify-between items-center bg-gray-100 p-2 border-b">
        <div className="flex items-center">
          <Code size={16} className="mr-2 text-gray-600" />
          <span className="text-sm font-medium">Code Suggestion</span>
          {language && (
            <span className="ml-2 text-xs bg-gray-200 py-1 px-2 rounded">
              {language}
            </span>
          )}
        </div>
        <div className="flex space-x-1">
          <button
            className="p-1 hover:bg-gray-200 rounded"
            onClick={handleCopyToClipboard}
            title="Copy to clipboard"
          >
            {copied ? (
              <Check size={16} className="text-green-500" />
            ) : (
              <Copy size={16} className="text-gray-600" />
            )}
          </button>
          {explanation && (
            <button
              className={`p-1 hover:bg-gray-200 rounded ${
                showExplanation ? 'bg-gray-200' : ''
              }`}
              onClick={() => setShowExplanation(!showExplanation)}
              title="Show explanation"
            >
              <Zap size={16} className="text-gray-600" />
            </button>
          )}
          <button
            className="p-1 hover:bg-gray-200 rounded"
            onClick={onRequestNew}
            title="Generate alternative"
          >
            <CornerDownLeft size={16} className="text-gray-600" />
          </button>
        </div>
      </div>
      
      {/* Code display */}
      <div className="p-4 bg-white">
        <pre className="bg-gray-800 text-white p-3 rounded overflow-x-auto">
          <code className="text-sm">{codeSuggestion}</code>
        </pre>
      </div>
      
      {/* Explanation (conditional) */}
      {showExplanation && explanation && (
        <div className="p-4 bg-gray-50 border-t">
          <h3 className="text-sm font-medium mb-2">Explanation</h3>
          <div className="text-sm text-gray-700">
            {explanation}
          </div>
        </div>
      )}
      
      {/* Action buttons */}
      <div className="flex justify-end p-2 bg-gray-50 border-t">
        <button
          className="px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded-md mr-2 text-sm flex items-center"
          onClick={onReject}
        >
          <X size={16} className="mr-1" />
          Reject
        </button>
        <button
          className="px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded-md text-sm flex items-center"
          onClick={onAccept}
        >
          <Check size={16} className="mr-1" />
          Insert
        </button>
      </div>
    </div>
  );
};

export default EditorIntegration;
