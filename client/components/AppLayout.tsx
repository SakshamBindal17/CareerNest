// [AppLayout.tsx](http://_vscodecontentref_/0)
'use client';

import React from 'react';
import Sidebar from './Sidebar';
import { UserProvider, useAuth } from '@/context/UserContext';

/**
 * This component is now much simpler. It consumes the authentication state
 * from the `useAuth` hook. The actual logic for checking tokens and redirecting
 * has been moved into the `UserProvider` itself.
 */
function LayoutWithAuth({ children }: { children: React.ReactNode }) {
    const { user, loading } = useAuth();

    // While the UserProvider is checking for authentication, show a global loading screen.
    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
                <p className="text-lg text-gray-900 dark:text-white">Loading Application...</p>
            </div>
        );
    }

    // If loading is done AND we have a user, display the application with the sidebar.
    if (user) {
        return (
            <div className="flex min-h-screen">
                <Sidebar user={user} />
                <main className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white">
                    {children}
                </main>
            </div>
        );
    }

    // If loading is done and there's NO user, it means the user is on a public page
    // (like login or sign-up). In this case, we render the children directly without the sidebar.
    // The UserProvider has already handled the redirection logic.
    return <>{children}</>;
}

/**
 * This is the default export for the layout.
 * It wraps the main logic in the UserProvider so the `useAuth` hook can be used.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
    return (
        <UserProvider>
            <LayoutWithAuth>{children}</LayoutWithAuth>
        </UserProvider>
    );
}