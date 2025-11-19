// src/app/forgot-password/page.tsx
'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import ThemeSwitcher from '@/components/ThemeSwitcher'

// Define our API's base URL
const API_URL = 'http://localhost:3001';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  // --- THIS FUNCTION IS NOW LIVE ---
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setMessage(null)

    try {
      // 1. Call our new backend API
      const response = await fetch(`${API_URL}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send reset link.');
      }

      // 2. Show the success message from the server
      setMessage(data.message);

    } catch (err: any) {
      setError(err.message);
    }
    setLoading(false); // We set loading to false to show the message
  }

  return (
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
            Enter your email to reset your password.
          </p>
        </div>
      </div>

      {/* --- Right Form Pane --- */}
      <div className="relative flex min-h-screen items-center justify-center bg-gray-50 p-4 dark:bg-gray-900">
        <div className="absolute top-4 right-4">
          <ThemeSwitcher />
        </div>

        <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-md dark:bg-gray-800">
          <h2 className="mb-6 text-center text-2xl font-bold text-gray-900 dark:text-white">
            Forgot Your Password?
          </h2>

          <form onSubmit={handleResetPassword} className="space-y-6">

            {!message ? (
              <>
                <div>
                  <label 
                    htmlFor="email" 
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                  >
                    Email Address
                  </label>
                  <input
                    id="email"
                    type="email"
                    required
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 placeholder:text-gray-400 dark:bg-gray-700 dark:text-white dark:border-gray-600"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>

                <div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex w-full justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {loading ? 'Sending link...' : 'Send Reset Link'}
                  </button>
                </div>
              </>
            ) : (
              // Show the success message here
              <p className="text-center text-green-600 dark:text-green-400">{message}</p>
            )}

            {error && (
              <p className="text-center text-sm text-red-600">{error}</p>
            )}
          </form>

          <p className="mt-8 text-center text-sm text-gray-600 dark:text-gray-400">
            Remembered your password?{' '}
            <Link href="/login" className="font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400">
              Log In
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}