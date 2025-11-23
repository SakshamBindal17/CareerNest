// src/app/reset-password/page.tsx
'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import PasswordStrength from '@/components/PasswordStrength'
import { Eye, EyeOff } from 'lucide-react'
// This is a new hook from Next.js to read URL parameters
import { useSearchParams } from 'next/navigation'

import { API_URL } from '@/utils/api';

// We wrap the component in <React.Suspense> in layout.tsx if needed,
// but for this simple page, we'll just call the hook directly.

function ResetPasswordForm() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  // Password strength states
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [hasMinLength, setHasMinLength] = useState(false);
  const [hasUppercase, setHasUppercase] = useState(false);
  const [hasLowercase, setHasLowercase] = useState(false);
  const [hasNumber, setHasNumber] = useState(false);
  const [hasSpecialChar, setHasSpecialChar] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // This hook reads the URL (e.g., ?token=...)
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  useEffect(() => {
    if (!token) {
      setError("No reset token found. Please request a new link.");
    }
  }, [token]);

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newPassword = e.target.value;
    setPassword(newPassword);
    setHasMinLength(newPassword.length >= 8);
    setHasLowercase(/[a-z]/.test(newPassword));
    setHasUppercase(/[A-Z]/.test(newPassword));
    setHasNumber(/[0-9]/.test(newPassword));
    setHasSpecialChar(/[^A-Za-z0-9]/.test(newPassword));
    if (confirmPassword && newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match.");
    } else {
      setPasswordError(null);
    }
  }

  const handleConfirmPasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newConfirmPassword = e.target.value;
    setConfirmPassword(newConfirmPassword);
    if (password && newConfirmPassword !== password) {
      setPasswordError("Passwords do not match.");
    } else {
      setPasswordError(null);
    }
  }

  const isPasswordValid = 
    hasMinLength && hasUppercase && hasLowercase && hasNumber && hasSpecialChar;
  const canSubmit = isPasswordValid && password === confirmPassword && password.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) {
      setError('Please ensure your password meets all requirements and matches.');
      return;
    }
    if (!token) {
      setError("No reset token found. Please request a new link.");
      return;
    }

    setLoading(true)
    setError(null)
    setMessage(null)

    try {
      // 1. Call our new backend API
      const response = await fetch(`${API_URL}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword: password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to reset password.');
      }

      // 2. Show success message
      setMessage(data.message);

    } catch (err: any) {
      setError(err.message);
    }
    setLoading(false);
  }

  return (
    <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-md dark:bg-gray-800">
      <h2 className="mb-6 text-center text-2xl font-bold text-gray-900 dark:text-white">
        Set Your New Password
      </h2>

      {!message ? (
        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Password Field */}
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">New Password</label>
            <div className="relative mt-1">
              <input
                id="password" type={showPassword ? "text" : "password"} required
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 placeholder:text-gray-400 dark:bg-gray-700 dark:text-white dark:border-gray-600"
                value={password}
                onChange={handlePasswordChange}
                placeholder="Min. 8 characters"
              />
              {password.length > 0 && (
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 flex items-center pr-3">
                  {showPassword ? <EyeOff className="h-5 w-5 text-gray-500" /> : <Eye className="h-5 w-5 text-gray-500" />}
                </button>
              )}
            </div>
            {password.length > 0 && (
              <PasswordStrength 
                hasMinLength={hasMinLength}
                hasUppercase={hasUppercase}
                hasLowercase={hasLowercase}
                hasNumber={hasNumber}
                hasSpecialChar={hasSpecialChar}
              />
            )}
          </div>

          {/* Confirm Password */}
          <div>
            <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Confirm New Password</label>
            <div className="relative mt-1">
              <input
                id="confirm-password" type={showConfirmPassword ? "text" : "password"} required
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 placeholder:text-gray-400 dark:bg-gray-700 dark:text-white dark:border-gray-600"
                value={confirmPassword}
                onChange={handleConfirmPasswordChange}
                placeholder="Type your new password again"
              />
              {confirmPassword.length > 0 && (
                <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute inset-y-0 right-0 flex items-center pr-3">
                  {showConfirmPassword ? <EyeOff className="h-5 w-5 text-gray-500" /> : <Eye className="h-5 w-5 text-gray-500" />}
                </button>
              )}
            </div>
            {passwordError && (
              <p className="text-sm text-red-600 mt-1">{passwordError}</p>
            )}
          </div>

          {/* Submit Button */}
          <div>
            <button
              type="submit"
              disabled={loading || !canSubmit}
              className="flex w-full justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Saving...' : 'Set New Password'}
            </button>
          </div>

          {error && (
            <p className="text-center text-sm text-red-600">{error}</p>
          )}
        </form>
      ) : (
        <div className="text-center">
          <p className="text-green-600 dark:text-green-400">{message}</p>
          <Link href="/login" className="mt-4 inline-block font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400">
            &larr; Back to Log In
          </Link>
        </div>
      )}
    </div>
  );
}

// We must wrap the page in a Suspense boundary for useSearchParams() to work
export default function ResetPasswordPage() {
  return (
    <React.Suspense fallback={<div>Loading...</div>}>
      <div className="grid min-h-screen grid-cols-1 md:grid-cols-2 bg-gray-50 dark:bg-gray-900">
        {/* --- Left Logo Pane --- */}
        <div className="hidden items-center justify-center bg-gray-50 p-12 md:flex dark:bg-gray-900">
          <div className="flex flex-col items-center text-center">
            <Link href="/">
              <Image
                src="/logo.png"
                alt="CareerNest Logo"
                width={728}
                height={142}
                className="h-auto w-80"
              />
            </Link>
            <p className="mt-6 text-xl text-gray-600 dark:text-gray-300">
              Choose a new, strong password.
            </p>
          </div>
        </div>

        {/* --- Right Form Pane --- */}
        <div className="relative flex min-h-screen items-center justify-center bg-gray-50 p-4 dark:bg-gray-900">
          {/* ThemeSwitcher removed */}
          <ResetPasswordForm />
        </div>
      </div>
    </React.Suspense>
  );
}