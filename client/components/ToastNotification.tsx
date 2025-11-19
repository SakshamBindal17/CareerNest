// client/components/ToastNotification.tsx
'use client'

import React, { useEffect } from 'react';
import { XCircle, CheckCircle2 } from 'lucide-react';

// Define the props our component will accept
interface ToastProps {
  message: string | null;
  error: string | null;
  clearMessages: () => void;
}

export default function ToastNotification({ message, error, clearMessages }: ToastProps) {
  const isVisible = !!message || !!error;
  const content = message || error;
  const isError = !!error;

  // This is the 10-second auto-fade timer
  useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(() => {
        clearMessages();
      }, 10000); // 10 seconds

      // This cleans up the timer if the component is closed early
      return () => clearTimeout(timer);
    }
  }, [isVisible, message, error, clearMessages]);

  if (!isVisible) {
    return null; // Don't render anything if there's no message
  }

  return (
    // This positions the toast at the bottom-right of the screen
    <div 
      className={`fixed bottom-8 right-8 z-50 w-full max-w-sm rounded-lg shadow-lg p-4 
        ${isError ? 'bg-red-600' : 'bg-green-600'} 
        text-white
        animate-fade-in
      `}
    >
      <div className="flex items-start">
        {/* Icon */}
        <div className="flex-shrink-0">
          {isError ? (
            <XCircle className="h-6 w-6" />
          ) : (
            <CheckCircle2 className="h-6 w-6" />
          )}
        </div>
        {/* Message */}
        <div className="ml-3 w-0 flex-1 pt-0.5">
          <p className="text-sm font-medium">{isError ? 'Error' : 'Success'}</p>
          <p className="mt-1 text-sm">{content}</p>
        </div>
        {/* Close Button */}
        <div className="ml-4 flex flex-shrink-0">
          <button
            onClick={clearMessages}
            className="inline-flex rounded-md text-white hover:text-gray-200 focus:outline-none focus:ring-2 focus:ring-white"
          >
            <span className="sr-only">Close</span>
            <XCircle className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}