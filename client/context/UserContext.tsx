// client/context/UserContext.tsx
'use client'

import React, { createContext, useState, useContext, ReactNode, useMemo, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

import { API_URL } from '@/utils/api';
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
  is_verification_delegate?: boolean;
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

  // Initial load of auth from localStorage
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
      const parsed = JSON.parse(userData) as AuthUser;

      // If an already-authenticated user manually visits the public landing page ('/'),
      // confirm whether they want to log out in order to view it.
      if (pathname === '/') {
        const roleLabel = parsed.role || 'user';
        const wantsLogout = window.confirm(
          `You are currently logged in as ${roleLabel}.\n` +
          'To view the public landing page you must first log out.\n\n' +
          'Press OK to logout and stay on the landing page, or Cancel to go back to your dashboard.'
        );

        if (wantsLogout) {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          setUser(null);
          setLoading(false);
          return; // remain on '/'
        } else {
          // Send them back to their role-specific area instead of viewing landing page
          const rawRole = (parsed.role || '').toLowerCase();
          let target = '/home';
          if (rawRole === 'hod') target = '/hod-admin';
          else if (rawRole === 'college_admin' || rawRole === 'college-admin') target = '/college-admin';
          else if (rawRole === 'admin' || rawRole === 'super_admin' || rawRole === 'super-admin') target = '/admin';

          setUser(parsed);
          setLoading(false);
          router.replace(target);
          return;
        }
      }

      setUser(parsed);
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

  // Live refresh of delegate flag (and other dynamic user fields) via lightweight polling & socket events
  const lastDelegateCheck = useRef<number>(0);
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token || !user) return;

    let cancelled = false;

    const fetchFreshUser = async () => {
      try {
        const res = await fetch(`${API_URL}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) return; // ignore
        const data = await res.json();
        if (!data?.user) return;
        // Only update if delegate flag changed (avoid re-renders on identical data)
        setUser(prev => {
          if (!prev) return prev;
            const changed = prev.is_verification_delegate !== data.user.is_verification_delegate;
            return changed ? { ...prev, is_verification_delegate: data.user.is_verification_delegate } : prev;
        });
      } catch {}
    };

    // Poll every 30s, but only if last check older than interval (tab visibility friendly)
    const interval = setInterval(() => {
      const now = Date.now();
      if (now - lastDelegateCheck.current > 30000) {
        lastDelegateCheck.current = now;
        fetchFreshUser();
      }
    }, 10000); // check timer, apply 30s gate inside

    // One immediate fetch for prompt update after potential delegation
    fetchFreshUser();

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [user]);

  // Socket listener for real-time delegate flag updates
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token || !user) return;
    const socket: Socket = io(API_URL, { auth: { token } });
    socket.on('delegate:updated', (payload: any) => {
      if (payload?.userId === user.id) {
        setUser(prev => prev ? { ...prev, is_verification_delegate: !!payload.is_verification_delegate } : prev);
      }
    });
    return () => { socket.disconnect(); };
  }, [user]);

  // Fetch profile icon (and future lightweight profile fields) once per session.
  useEffect(() => {
    const fetchProfileExtras = async () => {
      if (!user) return;
      if (user.profileIconUrl) return; // already have it
      const token = localStorage.getItem('token');
      if (!token) return;
      try {
        const res = await fetch(`${API_URL}/api/profile/${user.id}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) return; // silently ignore
        const data = await res.json();
        if (data?.profile_icon_url) {
          setUser(prev => prev ? { ...prev, profileIconUrl: data.profile_icon_url } : prev);
        }
      } catch (err) {
        // Non critical; do not surface globally
        console.warn('Failed to fetch profile icon', err);
      }
    };
    fetchProfileExtras();
  }, [user]);

  // NOTE: Removed automatic delegate refresh to prevent extra rerenders.
  // Delegate flag now updates only on fresh login (localStorage user payload).

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