// client/components/PasswordStrength.tsx
'use client'

// 1. Import icons for our checklist
import { XCircle, CheckCircle2 } from 'lucide-react'

// 2. Define the props (same as before)
type StrengthProps = {
  hasMinLength: boolean;
  hasUppercase: boolean;
  hasLowercase: boolean;
  hasNumber: boolean;
  hasSpecialChar: boolean;
}

// 3. This is a small helper component for each *rule* in the list
const StrengthRule = ({ valid, text }: { valid: boolean; text: string }) => {
  return (
    <div className={`flex items-center text-sm ${
        valid 
          ? 'text-green-600 dark:text-green-400' 
          : 'text-gray-500 dark:text-gray-400'
      }`}
    >
      {/* Show a green check or a gray X icon */}
      {valid ? (
        <CheckCircle2 className="w-4 h-4 mr-2" />
      ) : (
        <XCircle className="w-4 h-4 mr-2" />
      )}
      {text}
    </div>
  )
}

// 4. This is the main component that shows the full checklist
export default function PasswordStrength({
  hasMinLength,
  hasUppercase,
  hasLowercase,
  hasNumber,
  hasSpecialChar,
}: StrengthProps) {
  return (
    <div className="space-y-1 mt-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-md">
      {/* This directly shows the user what is done and what is left */}
      <StrengthRule valid={hasMinLength} text="At least 8 characters" />
      <StrengthRule valid={hasLowercase} text="At least 1 lowercase letter" />
      <StrengthRule valid={hasUppercase} text="At least 1 uppercase letter" />
      <StrengthRule valid={hasNumber} text="At least 1 number" />
      <StrengthRule valid={hasSpecialChar} text="At least 1 special character" />
    </div>
  )
}