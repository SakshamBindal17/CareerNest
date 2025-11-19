// src/app/page.tsx
import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, Briefcase, Users, MessageSquare } from 'lucide-react'
import Navbar from '@/components/Navbar' // Import our Navbar

export default function LandingPage() {
  return (
    // These classes will now work!
    <div className="flex min-h-screen flex-col bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">

      <Navbar />

      {/* --- Hero Section --- */}
      <main className="flex-1">
        <section className="relative flex h-screen items-center justify-center pt-16">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="text-5xl font-extrabold tracking-tight text-gray-900 dark:text-white sm:text-6xl">
              Connect, Collaborate, and Grow.
            </h1>
            <p className="mt-6 text-xl text-gray-600 dark:text-gray-300">
              Welcome to CareerNest, the exclusive professional network for
              students, alumni, and faculty of your university community.
            </p>
            <div className="mt-10">
              <Link href="/sign-up">
                <span className="rounded-md bg-indigo-600 px-8 py-3 text-lg font-medium text-white shadow-lg hover:bg-indigo-700">
                  Get Started Today
                </span>
              </Link>
            </div>
          </div>
        </section>

        {/* --- Features Section --- */}
        <section className="bg-white dark:bg-gray-800 py-24 sm:py-32">
          <div className="mx-auto max-w-6xl px-6 lg:px-8">
            <div className="mx-auto max-w-2xl lg:text-center">
              <h2 className="text-base font-semibold leading-7 text-indigo-600 dark:text-indigo-400">
                Everything You Need
              </h2>
              <p className="mt-2 text-3xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-4xl">
                A private network built for success.
              </p>
            </div>
            <div className="mx-auto mt-16 grid max-w-2xl grid-cols-1 gap-x-8 gap-y-16 lg:max-w-none lg:grid-cols-3">
              {/* Feature 1 */}
              <div className="flex flex-col">
                <dt className="flex items-center gap-x-3 text-base font-semibold leading-7 text-gray-900 dark:text-white">
                  <Briefcase className="h-5 w-5 flex-none text-indigo-600 dark:text-indigo-400" />
                  Exclusive Job Board
                </dt>
                <dd className="mt-4 flex flex-auto flex-col text-base leading-7 text-gray-600 dark:text-gray-300">
                  <p className="flex-auto">
                    Find opportunities posted by verified alumni and faculty who
                    want to hire from within your university community.
                  </p>
                </dd>
              </div>
              {/* Feature 2 */}
              <div className="flex flex-col">
                <dt className="flex items-center gap-x-3 text-base font-semibold leading-7 text-gray-900 dark:text-white">
                  <Users className="h-5 w-5 flex-none text-indigo-600 dark:text-indigo-400" />
                  Powerful Mentorship
                </dt>
                <dd className="mt-4 flex flex-auto flex-col text-base leading-7 text-gray-600 dark:text-gray-300">
                  <p className="flex-auto">
                    Connect with experienced alumni and faculty in your field.
                    Give and get advice that truly matters.
                  </p>
                </dd>
              </div>
              {/* Feature 3 */}
              <div className="flex flex-col">
                <dt className="flex items-center gap-x-3 text-base font-semibold leading-7 text-gray-900 dark:text-white">
                  <MessageSquare className="h-5 w-5 flex-none text-indigo-600 dark:text-indigo-400" />
                  Private Messaging
                </dt>
                <dd className="mt-4 flex flex-auto flex-col text-base leading-7 text-gray-600 dark:text-gray-300">
                  <p className="flex-auto">
                    A secure and private way to network, ask questions, and
                    collaborate on projects, all within a trusted network.
                  </p>
                </dd>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* --- Footer --- */}
      <footer className="bg-gray-900 dark:bg-gray-950">
        <div className="mx-auto max-w-6xl px-6 py-12 lg:px-8">
          <div className="mt-8 md:order-1 md:mt-0">
            <p className="text-center text-xs leading-5 text-gray-400">
              &copy; {new Date().getFullYear()} CareerNest. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}