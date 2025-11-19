// client/components/Navbar.tsx
'use client'

import Link from 'next/link'
import Image from 'next/image'
import { ArrowRight } from 'lucide-react'
import ThemeSwitcher from './ThemeSwitcher' // <-- Import
import { useAuth } from '@/context/UserContext' // Import useAuth
import Avatar from './Avatar'; // Import Avatar

export default function Navbar() {
  const { user, loading } = useAuth(); // Get user from context

  return (
    <header className="sticky top-0 z-30 w-full px-6 py-4 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm shadow-sm">
      <nav className="mx-auto flex max-w-7xl items-center justify-between">
        <Link href="/home">
          <Image src="/logo.png" alt="CareerNest Logo" width={728} height={142} priority className="h-8 w-auto" />
        </Link>
        <div className="flex items-center space-x-4 md:space-x-6">
          {!loading && user ? (
            <>
              {/* Add other authenticated nav links here if needed */}
              <ThemeSwitcher />
              <Link href={`/profile/${user.id}`}>
                <div className="cursor-pointer">
                  <Avatar src={user.profileIconUrl} name={user.fullName} size={32} />
                </div>
              </Link>
            </>
          ) : (
            <>
              <Link href="/request-onboarding" className="hidden sm:inline text-sm font-medium text-gray-700 hover:text-indigo-600 dark:text-gray-300 dark:hover:text-indigo-400">
                Add Your College
              </Link>
              <Link href="/login" className="rounded-md px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800">
                Log In
              </Link>
              <Link href="/sign-up" className="flex items-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700">
                Sign Up
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
              <ThemeSwitcher />
            </>
          )}
        </div>
      </nav>
    </header>
  );
}