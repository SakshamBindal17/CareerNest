// client/components/OtpInput.tsx
'use client'

import React, { useRef, useState, ChangeEvent, KeyboardEvent } from 'react';

// Define the props our component will accept
interface OtpInputProps {
  length?: number;
  value: string;
  onChange: (value: string) => void;
}

export default function OtpInput({ length = 6, value, onChange }: OtpInputProps) {
  // Create an array of refs to hold references to each input box
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const handleChange = (e: ChangeEvent<HTMLInputElement>, index: number) => {
    const newValue = e.target.value;

    // Only allow numbers
    if (/[^0-9]/.test(newValue)) return;

    const newOtp = value.split('');
    newOtp[index] = newValue.slice(-1); // Only take the last digit
    const newOtpString = newOtp.join('').slice(0, length);

    onChange(newOtpString);

    // Move to the next input if a number was entered
    if (newValue && index < length - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>, index: number) => {
    // Handle Backspace
    if (e.key === 'Backspace' && !value[index] && index > 0) {
      // If current box is empty and we press backspace, move to the previous box
      inputRefs.current[index - 1]?.focus();
    }
  };

  return (
    <div className="flex justify-center gap-2">
      {Array(length)
        .fill('')
        .map((_, index) => (
          <input
            key={index}
            type="text"
            inputMode="numeric" // Shows number pad on mobile
            maxLength={1}
            value={value[index] || ''}
            onChange={(e) => handleChange(e, index)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            ref={(el) => (inputRefs.current[index] = el)}
            className="w-12 h-14 rounded-md border border-gray-300 text-center text-2xl font-bold text-gray-900 dark:bg-gray-700 dark:text-white dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        ))}
    </div>
  );
}