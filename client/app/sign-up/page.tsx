// src/app/sign-up/page.tsx
'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link' 
import Image from 'next/image'
import PasswordStrength from '@/components/PasswordStrength'
import ThemeSwitcher from '@/components/ThemeSwitcher'
import OtpInput from '@/components/OtpInput'
import { Eye, EyeOff } from 'lucide-react'

const API_URL = 'http://localhost:3001';

type College = { university_id: number; name: string; domains: string[] }; 
type Department = { department_id: number; name: string; };

export default function SignUpPage() {
  // States (All necessary states for the form)
  const [step, setStep] = useState<'details' | 'otp' | 'success'>('details');
  const [fullName, setFullName] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [role, setRole] = useState<'Student' | 'Alumni' | 'Faculty' | ''>('')
  const [collegeId, setCollegeId] = useState<number | string>('');
  const [colleges, setColleges] = useState<College[]>([]); 
  const [departments, setDepartments] = useState<Department[]>([]);
  const [departmentId, setDepartmentId] = useState<number | string>('');
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [email, setEmail] = useState('') 
  const [verificationFile, setVerificationFile] = useState<File | null>(null) 
  const [graduationYear, setGraduationYear] = useState('')
  const [instituteRollNumber, setInstituteRollNumber] = useState('')
  const [otp, setOtp] = useState(''); 
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [hasMinLength, setHasMinLength] = useState(false);
  const [hasUppercase, setHasUppercase] = useState(false);
  const [hasLowercase, setHasLowercase] = useState(false);
  const [hasNumber, setHasNumber] = useState(false);
  const [hasSpecialChar, setHasSpecialChar] = useState(false);

  // --- MODIFIED: Fetch colleges on load ---
  useEffect(() => {
    const fetchColleges = async () => {
        try {
            // 1. Fetch colleges
            const res = await fetch(`${API_URL}/api/public/colleges`);
            if (!res.ok) throw new Error('API Error: Failed to load college list.');
            const data = await res.json();

            // 2. Check for empty database
            if (data.length === 0) {
                 setError('No colleges found. Please ensure a university has been approved by the Super Admin.');
            }

            setColleges(data);
    } catch (err: unknown) {
      // 3. Display network error on the page if it fails
      setError(err instanceof Error ? err.message : "Network connection failed. Is the server running (port 3001)?");
      console.error("Could not load colleges:", err);
        }
    };
    fetchColleges();
  }, [])

  // Fetch departments when a college is selected (logic is the same)
  useEffect(() => {
    if (collegeId) {
        setDepartmentId('');
        const fetchDepartments = async () => {
            try {
                const res = await fetch(`${API_URL}/api/public/departments/${collegeId}`);
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Failed to load departments.');
                setDepartments(data);
      } catch (err: unknown) {
        setError("Failed to load departments for this college.");
        console.error("Could not load departments:", err);
            }
        };
        fetchDepartments();
    } else {
        setDepartments([]);
    }
  }, [collegeId])

  // --- Password/Validation Handlers (Omitted for brevity, assumed correct) ---
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

  const handleAutofill = (e: React.AnimationEvent<HTMLInputElement>) => {
  if (e.animationName === 'onAutoFillStart' && e.currentTarget.id === 'password') {
    handlePasswordChange(e as unknown as React.ChangeEvent<HTMLInputElement>);
    }
  }

  const isPasswordValid = 
    hasMinLength && hasUppercase && hasLowercase && hasNumber && hasSpecialChar;
  const canSubmitDetails = isPasswordValid && password === confirmPassword && password.length > 0;

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmitDetails) {
      setError('Please ensure your password meets all requirements and matches.');
      return;
    }
    if (!departmentId) {
         setError('Please select a department.');
         return;
    }

    const selectedCollege = colleges.find(c => c.university_id == collegeId);
    if (!selectedCollege) {
        setError('Please select a college.');
        return;
    }

    if (role !== 'Alumni' && selectedCollege.domains.length > 0) {
        const isValid = selectedCollege.domains.some(domain => email.toLowerCase().endsWith(`@${domain.toLowerCase()}`));
        if (!isValid) {
            const domainList = selectedCollege.domains.join(' or @');
            setError(`Official email must end with @${domainList}.`);
            return;
        }
    }

    // NOTE: File upload logic removed for now to fix crash

    setLoading(true)
    setError(null)
    setMessage(null)

    const formData = new FormData();
    formData.append('fullName', fullName);
    formData.append('email', email);
    formData.append('password', password);
    formData.append('role', role);
    formData.append('collegeId', String(collegeId));
    formData.append('departmentId', String(departmentId));
    if (graduationYear) {
      formData.append('graduationYear', graduationYear);
    }
    if (role === 'Alumni' && instituteRollNumber) {
      formData.append('instituteRollNumber', instituteRollNumber);
    }
    if (verificationFile) {
      formData.append('verificationFile', verificationFile);
    }

    try {
      const response = await fetch(`${API_URL}/api/auth/signup`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to sign up.');
      }

      setLoading(false);
      setStep('otp');

    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  }

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/api/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to verify OTP.');
      }
      setLoading(false);
      setStep('success');
      setMessage(data.message);
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  }

  return (
    <div className="grid min-h-screen grid-cols-1 md:grid-cols-2 bg-gray-50 dark:bg-gray-900">
      <div className="hidden items-center justify-center bg-gray-50 p-12 md:flex dark:bg-gray-900">
        <Link href="/">
            <Image src="/logo.png" alt="CareerNest Logo" width={728} height={142} className="h-auto w-80" />
          </Link>
      </div>

      {/* --- Right Form Pane --- */}
      <div className="relative flex min-h-screen items-center justify-center bg-gray-50 p-4 py-12 dark:bg-gray-900">
        <div className="absolute top-4 right-4">
          <ThemeSwitcher />
        </div>

        <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-md dark:bg-gray-800">
          <h2 className="mb-6 text-center text-3xl font-bold text-gray-900 dark:text-white">
            {step === 'details' ? 'Create Your Account' : 'Verify Your Email'}
          </h2>

          {step === 'details' && (
            <form onSubmit={handleSignUp} className="space-y-4">

              {/* Full Name */}
              <div>
                <label htmlFor="full-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Full Name</label>
                <input id="full-name" type="text" required className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 placeholder:text-gray-400 dark:bg-gray-700 dark:text-white dark:border-gray-600" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="e.g., Jane Doe" />
              </div>

              {/* College Dropdown */}
              <div>
                <label htmlFor="college-id" className="block text-sm font-medium text-gray-700 dark:text-gray-300">College</label>
                <select
                  id="college-id" required
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 dark:bg-gray-700 dark:text-white dark:border-gray-600"
                  value={collegeId} onChange={(e) => setCollegeId(e.target.value)}
                  disabled={colleges.length === 0}
                >
                  <option value="" disabled>
                    {colleges.length === 0 ? 'Loading colleges...' : 'Select your college...'}
                  </option>
                  {colleges.map((college) => (
                    <option key={college.university_id} value={college.university_id}>{college.name}</option>
                  ))}
                </select>
              </div>

              {/* Department Dropdown (Fix: Now relies on College ID) */}
              {collegeId && (
                <div>
                  <label htmlFor="department-id" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Department</label>
                  <select
                    id="department-id" required
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 dark:bg-gray-700 dark:text-white dark:border-gray-600"
                    value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}
                    disabled={departments.length === 0}
                  >
                    <option value="" disabled>
                      {departments.length === 0 ? 'No departments found' : 'Select your department...'}
                    </option>
                    {departments.map((dept) => (
                      <option key={dept.department_id} value={dept.department_id}>{dept.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Role (same) */}
              <div>
                <label htmlFor="role" className="block text-sm font-medium text-gray-700 dark:text-gray-300">I am a...</label>
                <select id="role" required className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 dark:bg-gray-700 dark:text-white dark:border-gray-600" value={role} onChange={(e) => setRole(e.target.value as 'Student' | 'Alumni' | 'Faculty' | '')}>
                  <option value="" disabled>Select your role...</option>
                  <option value="Student">Student</option>
                  <option value="Faculty">Faculty</option>
                  <option value="Alumni">Alumni</option>
                </select>
              </div>

              {/* Dynamic Email Field (same) */}
              {role && (
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    {role === 'Alumni' ? 'Personal Email' : 'Official College Email'}
                  </label>
                  <input id="email" type="email" required className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 placeholder:text-gray-400 dark:bg-gray-700 dark:text-white dark:border-gray-600" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={role === 'Alumni' ? 'you@gmail.com' : 'your_id@dcrustm.org'} />
                </div>
              )}

              {/* Alumni-Only Fields (same) */}
              {role === 'Alumni' && (
                <>
                  <div>
                    <label htmlFor="graduation-year" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Graduation Year
                    </label>
                    <input id="graduation-year" type="number" required className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 placeholder:text-gray-400 dark:bg-gray-700 dark:text-white dark:border-gray-600" value={graduationYear} onChange={(e) => setGraduationYear(e.target.value)} placeholder="e.g., 2020" />
                  </div>
                  <div>
                    <label htmlFor="institute-roll" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Institute Roll Number
                    </label>
                    <input
                      id="institute-roll"
                      type="text"
                      required
                      className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 placeholder:text-gray-400 dark:bg-gray-700 dark:text-white dark:border-gray-600"
                      value={instituteRollNumber}
                      onChange={(e) => setInstituteRollNumber(e.target.value)}
                      placeholder="e.g., 2K20-CS-123"
                    />
                  </div>
                  <div>
                    <label htmlFor="verification-file" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Verification Document
                    </label>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Upload your Degree, Transcript, or old ID card.</p>
                    <input 
                        id="verification-file" 
                        type="file" 
                        required 
                        accept=".pdf,.png,.jpg,.jpeg" 
                        className="mt-1 block w-full text-sm text-gray-700 file:mr-4 file:rounded-md file:border-0 file:bg-indigo-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-indigo-600 hover:file:bg-indigo-100 dark:text-gray-300 dark:file:bg-indigo-900 dark:file:text-indigo-300 dark:hover:file:bg-indigo-800" 
                        onChange={(e) => setVerificationFile(e.target.files ? e.target.files[0] : null)} 
                    />
                  </div>
                </>
              )}

              {/* Password Field (same) */}
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Password</label>
                <div className="relative mt-1">
                  <input id="password" type={showPassword ? "text" : "password"} required className="block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 placeholder:text-gray-400 dark:bg-gray-700 dark:text-white dark:border-gray-600" value={password} onChange={handlePasswordChange} onAnimationStart={handleAutofill} placeholder="Min. 8 characters" />
                  {password.length > 0 && (
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 flex items-center pr-3">
                      {showPassword ? (<EyeOff className="h-5 w-5 text-gray-500" />) : (<Eye className="h-5 w-5 text-gray-500" />)}
                    </button>
                  )}
                </div>
                {password.length > 0 && (
                  <PasswordStrength hasMinLength={hasMinLength} hasUppercase={hasUppercase} hasLowercase={hasLowercase} hasNumber={hasNumber} hasSpecialChar={hasSpecialChar} />
                )}
              </div>

              {/* Confirm Password (same) */}
              <div>
                <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Confirm Password</label>
                <div className="relative mt-1">
                  <input id="confirm-password" type={showConfirmPassword ? "text" : "password"} required className="block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 placeholder:text-gray-400 dark:bg-gray-700 dark:text-white dark:border-gray-600" value={confirmPassword} onChange={handleConfirmPasswordChange} onAnimationStart={handleAutofill} placeholder="Type your password again" />
                  {confirmPassword.length > 0 && (
                    <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute inset-y-0 right-0 flex items-center pr-3">
                      {showConfirmPassword ? (<EyeOff className="h-5 w-5 text-gray-500" />) : (<Eye className="h-5 w-5 text-gray-500" />)}
                    </button>
                  )}
                </div>
                {passwordError && (<p className="text-sm text-red-600 mt-1">{passwordError}</p>)}
              </div>

              {/* Submit Button (same) */}
              <div>
                <button type="submit" disabled={loading || !canSubmitDetails} className="flex w-full justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm disabled:opacity-50 disabled:cursor-not-allowed">
                  {loading ? 'Submitting...' : 'Sign Up'}
                </button>
              </div>
            </form>
          )}

          {/* ... (OTP and Success blocks are the same) ... */}
          {step === 'otp' && (
            <>
              <p className="mt-4 text-center text-sm text-gray-600 dark:text-gray-300">
                We sent a 6-digit code to <strong>{email}</strong>. Please enter it below.
              </p>
              <form onSubmit={handleVerifyOtp} className="mt-8 space-y-6">
                <div>
                  <label htmlFor="otp" className="block text-sm font-medium text-gray-700 dark:text-gray-300 text-center mb-2">
                    Verification Code
                  </label>
                  <OtpInput value={otp} onChange={setOtp} />
                </div>
                <div>
                  <button type="submit" disabled={loading} className="flex w-full justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50">
                    {loading ? 'Verifying...' : 'Verify Account'}
                  </button>
                </div>
              </form>
            </>
          )}
          {step === 'success' && (
            <div className="mt-8 text-center">
              <h2 className="text-center text-2xl font-bold text-green-600 dark:text-green-500">
                Email Verified!
              </h2>
              <p className="mt-4 text-gray-600 dark:text-gray-300">
                {message}
              </p>
              <Link href="/login">
                <span className="mt-6 inline-block text-indigo-600 hover:text-indigo-500 dark:text-indigo-400">
                  Click here to Log In
                </span>
              </Link>
            </div>
          )}
          {error && (<p className="text-center text-sm text-red-600 mt-4">{error}</p>)}
          <p className="mt-8 text-center text-sm text-gray-600 dark:text-gray-400">
            Already have an account?{' '}
            <Link href="/login" className="font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400">
              Log In
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}