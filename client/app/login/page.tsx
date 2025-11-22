// src/app/login/page.tsx
'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation' 
import Link from 'next/link' 
import Image from 'next/image' 
import { Eye, EyeOff } from 'lucide-react'

// Define our API's base URL
const API_URL = 'http://localhost:3001';

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const [showPassword, setShowPassword] = useState(false);

  // --- THIS FUNCTION IS NOW LIVE ---
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      // 1. Call our backend API
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        // If the server sends an error (e.g., "Invalid email or password.")
        throw new Error(data.error || 'Login failed.');
      }

      // 2. On success, save the token and user data
      // We'll use localStorage to keep the user logged in
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));

      // 3. Redirect to the correct dashboard [cite: 258-265]
      router.push(data.redirectTo);

    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
    // We don't set loading to false on success, as we are redirecting
  }

  // --- (This autofill handler is the same) ---
  const handleAutofill = (e: React.AnimationEvent<HTMLInputElement>) => {
    if (e.animationName === 'onAutoFillStart' && e.target.id === 'password') {
      setPassword(e.currentTarget.value);
    }
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
          <p className="mt-2 text-m text-gray-600 dark:text-gray-300">
            Welcome back! Please log in to access your network.
          </p>
        </div>
      </div>

      {/* --- Right Form Pane --- */}
      <div className="relative flex min-h-screen items-center justify-center bg-gray-50 p-4 dark:bg-gray-900">
        {/* ThemeSwitcher removed */}

        <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-md dark:bg-gray-800">
          <h2 className="mb-6 text-center text-2xl font-bold text-gray-900 dark:text-white">
            Welcome Back
          </h2>

          <form onSubmit={handleLogin} className="space-y-6">

            {/* Email Address */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
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

            {/* Password Field */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Password
              </label>
              <div className="relative mt-1">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  className="block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 placeholder:text-gray-400 dark:bg-gray-700 dark:text-white dark:border-gray-600"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onAnimationStart={handleAutofill}
                />
                {password.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3"
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5 text-gray-500" />
                    ) : (
                      <Eye className="h-5 w-5 text-gray-500" />
                    )}
                  </button>
                )}
              </div>
              <div className="flex justify-end text-xs mt-1">
                <Link href="/forgot-password" className="font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400">
                  Forgot your password?
                </Link>
              </div>
            </div>

            {/* Submit Button */}
            <div>
              <button
                type="submit"
                disabled={loading}
                className="flex w-full justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
              >
                {loading ? 'Logging in...' : 'Log In'}
              </button>
            </div>

            {/* Error Display */}
            {error && (
              <p className="text-center text-sm text-red-600">{error}</p>
            )}
          </form>

          {/* Link to Sign Up Page */}
          <p className="mt-8 text-center text-sm text-gray-600 dark:text-gray-400">
            Don't have an account?{' '}
            <Link href="/sign-up" className="font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400">
              Sign Up
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}