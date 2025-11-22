// client/context/UserContext.tsx
'use client'

import React, { createContext, useState, useContext, ReactNode, useMemo, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';

// Define the structure of the user object
export type AuthUser = {
  id: number;
  fullName: string;
  role: string;
  email: string;
  college_id: number;
  department_id: number;
  profileIconUrl?: string; // <-- Add this line
}

// Define the context type
type UserContextType = {
  user: AuthUser | null;
  setUser: (user: AuthUser | null) => void;
  loading: boolean;
}

// Create the context
export const UserContext = createContext<UserContextType | undefined>(undefined);

// Create the Provider component
export const UserProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true); // Start with loading as true
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');

    if (!token || !userData) {
      setLoading(false);
      // Allow access to public routes. Use prefix matching because some routes
      // may appear with or without trailing slashes or small variants.
      const publicPrefixes = [
        '/', // home is public
        '/login',
        '/sign-up', '/signup',
        '/forgot-password',
        '/reset-password',
        '/api/public'
      ];

      // If pathname is not yet available, don't redirect yet.
      if (!pathname) return;

      const isPublic = publicPrefixes.some(prefix => pathname.toLowerCase().startsWith(prefix));
      if (!isPublic) {
        router.push('/login');
      }
      return;
    }

    try {
      setUser(JSON.parse(userData) as AuthUser);
    } catch (error) {
      console.error("Corrupted user data in localStorage. Clearing session.", error);
      localStorage.clear();
      router.push('/login');
    } finally {
      setLoading(false);
    }
  // The dependency array ensures this runs only once on mount.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // useMemo prevents the context value from changing on every render
  const value = useMemo(() => ({ user, setUser, loading }), [user, loading]);

  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  );
};

// Create a custom hook to easily use the context
export const useAuth = () => {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within a UserProvider');
  }
  return context;
};