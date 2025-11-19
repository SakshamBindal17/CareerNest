// src/app/request-onboarding/page.tsx
'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import ThemeSwitcher from '@/components/ThemeSwitcher'
import OtpInput from '@/components/OtpInput'; // <-- ADD THIS

// Define our API's base URL
const API_URL = 'http://localhost:3001';

export default function RequestOnboardingPage() {
  const [step, setStep] = useState<'details' | 'otp' | 'success'>('details');
  const [otp, setOtp] = useState('');
  const [collegeName, setCollegeName] = useState('')
  const [contactName, setContactName] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [contactRole, setContactRole] = useState('')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // --- THIS FUNCTION IS NOW LIVE ---
  const handleSubmitDetails = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      // 1. Send the form data to our backend
      const response = await fetch(`${API_URL}/api/onboarding/request-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          collegeName,
          contactName,
          contactEmail,
          contactRole,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        // If the server sends an error (e.g., "Email already in use")
        throw new Error(data.error || 'Failed to request OTP.');
      }

      // 2. If successful, move to the OTP step
      setLoading(false)
      setStep('otp'); 

    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  }

  // --- THIS FUNCTION IS NOW LIVE ---
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      // 1. Send the email and OTP to our backend
      const response = await fetch(`${API_URL}/api/onboarding/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactEmail,
          otp,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        // If the server sends an error (e.g., "Invalid OTP")
        throw new Error(data.error || 'Failed to verify OTP.');
      }

      // 2. If successful, move to the success step
      setLoading(false)
      setStep('success');

    } catch (err: any) {
      setError(err.message);
      setLoading(false);
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
            Join the CareerNest network and connect your entire community.
          </p>
        </div>
      </div>

      {/* --- Right Form Pane --- */}
      <div className="relative flex min-h-screen items-center justify-center bg-gray-50 p-4 dark:bg-gray-900">

        <div className="absolute top-4 right-4">
          <ThemeSwitcher />
        </div>

        <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-md dark:bg-gray-800">

          {/* --- STEP 1: DETAILS FORM --- */}
          {step === 'details' && (
            <>
              <h2 className="text-center text-2xl font-bold text-gray-900 dark:text-white">
                Onboard Your College
              </h2>
              <form onSubmit={handleSubmitDetails} className="mt-8 space-y-6">
                <div>
                  <label htmlFor="college-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Official College Name
                  </label>
                  <input
                    id="college-name" type="text" required
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 placeholder:text-gray-400 dark:bg-gray-700 dark:text-white dark:border-gray-600"
                    value={collegeName}
                    onChange={(e) => setCollegeName(e.target.value)}
                    placeholder="e.g., Deenbandhu Chhotu Ram University"
                  />
                </div>
                <div>
                  <label htmlFor="contact-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Your Full Name
                  </label>
                  <input
                    id="contact-name" type="text" required
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 placeholder:text-gray-400 dark:bg-gray-700 dark:text-white dark:border-gray-600"
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    placeholder="e.g., Dr. Jane Smith"
                  />
                </div>
                <div>
                  <label htmlFor="contact-email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Your Official Email
                  </label>
                  <input
                    id="contact-email" type="email" required
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 placeholder:text-gray-400 dark:bg-gray-700 dark:text-white dark:border-gray-600"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    placeholder="e.g., jane.smith@collegedomain.edu"
                  />
                </div>
                <div>
                  <label htmlFor="contact-role" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Your Role/Title (e.g., "Dean of Students")
                  </label>
                  <input
                    id="contact-role" type="text"
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 placeholder:text-gray-400 dark:bg-gray-700 dark:text-white dark:border-gray-600"
                    value={contactRole}
                    onChange={(e) => setContactRole(e.target.value)}
                    placeholder="e.g., Dean of Students"
                  />
                </div>
                <div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex w-full justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {loading ? 'Submitting...' : 'Request Verification Code'}
                  </button>
                </div>
                {error && <p className="text-center text-sm text-red-600">{error}</p>}
              </form>
            </>
          )}

          {/* --- STEP 2: OTP FORM --- */}
          {step === 'otp' && (
            <>
              <h2 className="text-center text-2xl font-bold text-gray-900 dark:text-white">
                Verify Your Email
              </h2>
              <p className="mt-4 text-center text-sm text-gray-600 dark:text-gray-300">
                We sent a 6-digit code to <strong>{contactEmail}</strong>. Please enter it below.
              </p>
              <form onSubmit={handleVerifyOtp} className="mt-8 space-y-6">
                <div>
                  <label htmlFor="otp" className="block text-sm font-medium text-gray-700 dark:text-gray-300 text-center mb-2">
                    Verification Code
                  </label>
                  <OtpInput 
                    value={otp} 
                    onChange={setOtp} 
                  />
                </div>
                <div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex w-full justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {loading ? 'Verifying...' : 'Verify and Submit Request'}
                  </button>
                </div>
                {error && <p className="text-center text-sm text-red-600">{error}</p>}
              </form>
            </>
          )}

          {/* --- STEP 3: SUCCESS MESSAGE --- */}
          {step === 'success' && (
            <div className="mt-8 text-center">
              <h2 className="text-center text-2xl font-bold text-green-600 dark:text-green-500">
                Request Submitted!
              </h2>
              <p className="mt-4 text-gray-600 dark:text-gray-300">
                Your request has been verified and sent to our Super Admin for final approval. We will get back to you soon.
              </p>
              <Link href="/">
                <span className="mt-6 inline-block text-indigo-600 hover:text-indigo-500 dark:text-indigo-400">
                  &larr; Back to Home
                </span>
              </Link>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}