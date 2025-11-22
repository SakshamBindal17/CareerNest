// [AppLayout.tsx](http://_vscodecontentref_/0)
'use client';

import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import { useAuth } from '@/context/UserContext';

// Dynamic import to reduce initial bundle and avoid reloading Sidebar logic on every route change eagerly.
const Sidebar = dynamic(() => import('./Sidebar'), { ssr: false });

/**
 * This component is now much simpler. It consumes the authentication state
 * from the `useAuth` hook. The actual logic for checking tokens and redirecting
 * has been moved into the `UserProvider` itself.
 */
function LayoutWithAuth({ children }: { children: React.ReactNode }) {
    const { user, loading } = useAuth();
    // Declare hooks unconditionally to preserve consistent order.
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [compact, setCompact] = useState(false);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
                <p className="text-lg text-gray-900 dark:text-white">Loading Application...</p>
            </div>
        );
    }

    if (!user) {
        return <>{children}</>; // Public pages (login/sign-up)
    }

    return (
        <div className="min-h-screen flex bg-gray-50 dark:bg-gray-900">
            {/* Mobile Hamburger */}
            <button
                className="lg:hidden fixed top-3 left-3 z-50 p-2 rounded-md bg-white dark:bg-gray-800 border dark:border-gray-700 shadow"
                onClick={() => setSidebarOpen(true)}
                aria-label="Open navigation"
            >
                <span className="block w-5 h-0.5 bg-gray-700 dark:bg-gray-300 mb-1" />
                <span className="block w-5 h-0.5 bg-gray-700 dark:bg-gray-300 mb-1" />
                <span className="block w-5 h-0.5 bg-gray-700 dark:bg-gray-300" />
            </button>

            {/* Sidebar (Desktop + Mobile) */}
            <div className={`hidden lg:block`}>
                <Sidebar user={user} compact={compact} onToggleCompact={() => setCompact(c => !c)} />
            </div>
            <div className={`lg:hidden fixed inset-y-0 left-0 z-40 transform transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                <Sidebar user={user} compact={false} onCloseMobile={() => setSidebarOpen(false)} />
            </div>
            {/* Overlay when mobile sidebar open */}
            {sidebarOpen && (
                <div className="lg:hidden fixed inset-0 bg-black bg-opacity-40 z-30" onClick={() => setSidebarOpen(false)} />
            )}

            <main className="flex-1 overflow-y-auto">
                {children}
            </main>
        </div>
    );
}

/**
 * This is the default export for the layout.
 * It wraps the main logic in the UserProvider so the `useAuth` hook can be used.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
    // UserProvider already mounted in root Providers (app/providers.tsx), avoid double wrap.
    return <LayoutWithAuth>{children}</LayoutWithAuth>;
}