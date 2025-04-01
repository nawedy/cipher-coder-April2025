/*
 * File: src/front/components/StatusBarWidget.tsx
 * Project: Cipher Intelligence Labs VSCode AI CodeGen
 * Description: React component that displays the AI status information in the status bar.
 * Copyright © 2025 Cipher Intelligence Labs
 */

import * as React from 'react';
import { useState, useEffect } from 'react';
import { Brain, Loader, Cpu, Server, AlertTriangle } from 'lucide-react';

/**
 * Different AI status states
 */
export enum AIStatus {
  IDLE = 'idle',
  PROCESSING = 'processing',
  SUCCESS = 'success',
  ERROR = 'error',
  WARMING_UP = 'warming_up'
}

/**
 * Status message description
 */
interface StatusMessage {
  /**
   * Status text to display
   */
  text: string;
  
  /**
   * Icon to display
   */
  icon: React.ReactNode;
  
  /**
   * CSS class for styling
   */
  className: string;
}

/**
 * Props for StatusBarWidget component
 */
interface StatusBarWidgetProps {
  /**
   * Current AI status
   */
  status: AIStatus;
  
  /**
   * Whether a local model is being used
   */
  usingLocalModel: boolean;
  
  /**
   * Optional error message
   */
  errorMessage?: string;
  
  /**
   * Status bar click handler
   */
  onClick?: () => void;
}

/**
 * Component that displays the AI assistant status in the status bar
 */
const StatusBarWidget: React.FC<StatusBarWidgetProps> = ({
  status,
  usingLocalModel,
  errorMessage,
  onClick
}) => {
  const [visible, setVisible] = useState(true);
  const [showTooltip, setShowTooltip] = useState(false);
  
  // Animation timer for processing state
  const [dots, setDots] = useState('.');
  
  // Auto-hide success status after 3 seconds
  useEffect(() => {
    if (status === AIStatus.SUCCESS) {
      const timer = setTimeout(() => {
        setVisible(false);
      }, 3000);
      
      return () => clearTimeout(timer);
    } else {
      setVisible(true);
    }
  }, [status]);
  
  // Animate dots for processing status
  useEffect(() => {
    if (status === AIStatus.PROCESSING) {
      const interval = setInterval(() => {
        setDots(prev => (prev.length >= 3 ? '.' : prev + '.'));
      }, 500);
      
      return () => clearInterval(interval);
    }
  }, [status]);

  /**
   * Gets status message based on current state
   */
  const getStatusMessage = (): StatusMessage => {
    const modelType = usingLocalModel ? 'Local' : 'API';
    
    switch (status) {
      case AIStatus.IDLE:
        return {
          text: `AI Ready (${modelType})`,
          icon: <Brain size={14} />,
          className: 'text-gray-600'
        };
      
      case AIStatus.PROCESSING:
        return {
          text: `AI Working${dots}`,
          icon: <Loader size={14} className="animate-spin" />,
          className: 'text-blue-600'
        };
      
      case AIStatus.SUCCESS:
        return {
          text: 'AI Complete',
          icon: usingLocalModel ? <Cpu size={14} /> : <Server size={14} />,
          className: 'text-green-600'
        };
      
      case AIStatus.ERROR:
        return {
          text: 'AI Error',
          icon: <AlertTriangle size={14} />,
          className: 'text-red-600'
        };
      
      case AIStatus.WARMING_UP:
        return {
          text: 'AI Warming Up',
          icon: <Loader size={14} className="animate-spin" />,
          className: 'text-yellow-600'
        };
      
      default:
        return {
          text: 'AI',
          icon: <Brain size={14} />,
          className: 'text-gray-600'
        };
    }
  };
  
  // If not visible, don't render
  if (!visible) {
    return null;
  }
  
  const statusMessage = getStatusMessage();
  
  return (
    <div className="relative">
      <button
        className={`flex items-center px-2 py-1 text-xs ${statusMessage.className} hover:bg-gray-200 rounded`}
        onClick={onClick}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <span className="mr-1">{statusMessage.icon}</span>
        <span>{statusMessage.text}</span>
      </button>
      
      {/* Tooltip for error messages */}
      {showTooltip && status === AIStatus.ERROR && errorMessage && (
        <div className="absolute bottom-full mb-2 left-0 bg-red-100 border border-red-200 text-red-800 px-2 py-1 rounded text-xs whitespace-nowrap">
          {errorMessage}
        </div>
      )}
    </div>
  );
};

export default StatusBarWidget;
