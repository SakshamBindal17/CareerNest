// client/components/Sidebar.tsx
'use client'

import React, { useMemo, useEffect, useState } from 'react';
import Avatar from './Avatar';
// --- NEW: Added TrendingUp ---
import { LogOut, Home, Users, Briefcase, MessageSquare, Tag, Bell, Settings, LayoutDashboard, TrendingUp, AlertTriangle } from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';

type User = {
    fullName: string;
    role: string;
    id: number;
    profileIconUrl?: string | null;
    is_verification_delegate?: boolean;
}

// --- Helper Component for Each Nav Link ---
const NavLink = ({ href, icon, label, compact, badge, currentPath }: { href: string, icon: React.ReactNode, label: string, compact?: boolean, badge?: number | 'dot' | null, currentPath: string }) => {
    // Active if exact match or nested path segment
    const isActive = currentPath === href || currentPath.startsWith(href + '/');
    return (
        <Link
            href={href}
            title={label}
            className={`group relative flex items-center p-3 rounded-lg transition-colors duration-150 ${isActive
                ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-700 dark:text-white'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
        >
            {icon}
            {!compact && <span className="ml-3 font-medium">{label}</span>}
            {badge !== null && badge !== undefined && badge !== 0 && (
                badge === 'dot' ? (
                    <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full shadow" />
                ) : (
                    <span className="absolute -top-1 -right-1 text-[10px] font-semibold bg-red-600 text-white px-1.5 py-0.5 rounded-full shadow">
                        {badge > 99 ? '99+' : badge}
                    </span>
                )
            )}
        </Link>
    );
};

export default function Sidebar({ user, compact = false, onToggleCompact, onCloseMobile }: { user: User | null; compact?: boolean; onToggleCompact?: () => void; onCloseMobile?: () => void }) {
    const router = useRouter();
        const [pendingRequests, setPendingRequests] = useState(0);
        const [unreadChats, setUnreadChats] = useState(0);
        const [newJobs, setNewJobs] = useState(0);
        const [newPosts, setNewPosts] = useState(0);
        const [newMentions, setNewMentions] = useState(0); // placeholder (mentions not implemented)
        const socketRef = React.useRef<Socket | null>(null);
        const pathname = usePathname();

        const refreshSummary = async () => {
            try {
                const token = localStorage.getItem('token');
                if (!token) return;
                const res = await fetch('http://localhost:3001/api/notifications/summary', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const data = await res.json();
                if (res.ok) {
                    setPendingRequests(data.pendingRequests || 0);
                    setUnreadChats(data.unreadChats || 0);
                    // Jobs unseen logic
                    const latestJobCreatedAt = data.latestJobCreatedAt ? new Date(data.latestJobCreatedAt).getTime() : 0;
                    const lastJobSeen = Number(localStorage.getItem('latestJobSeen') || 0);
                    if (latestJobCreatedAt > lastJobSeen) {
                        setNewJobs(n => n + 1);
                    }
                    // Posts unseen logic
                    const latestPostCreatedAt = data.latestPostCreatedAt ? new Date(data.latestPostCreatedAt).getTime() : 0;
                    const lastPostSeen = Number(localStorage.getItem('latestPostSeen') || 0);
                    if (latestPostCreatedAt > lastPostSeen) {
                        setNewPosts(n => n + 1);
                    }
                    setNewMentions(data.newMentions || 0);
                }
            } catch {}
        };

        // Fetch initial summary
        useEffect(() => { refreshSummary(); }, []);

        // Socket listeners for real-time updates
        useEffect(() => {
            const token = localStorage.getItem('token');
            if (!token) return;
            socketRef.current = io('http://localhost:3001', { auth: { token } });
            socketRef.current.on('connection:request:new', refreshSummary);
            socketRef.current.on('connection:request:accepted', refreshSummary);
            socketRef.current.on('message:new', () => {
                if (pathname !== '/chat') refreshSummary();
            });
            socketRef.current.on('jobs:new', (payload: any) => {
                const createdTs = payload?.created_at ? new Date(payload.created_at).getTime() : Date.now();
                // If user is on jobs page, mark as seen immediately
                if (pathname === '/jobs') {
                    localStorage.setItem('latestJobSeen', String(createdTs));
                    setNewJobs(0);
                } else {
                        const lastSeen = Number(localStorage.getItem('latestJobSeen') || 0);
                        if (createdTs > lastSeen) {
                            setNewJobs(n => n + 1);
                        }
                }
            });
            socketRef.current.on('posts:new', (payload: any) => {
                const createdTs = payload?.created_at ? new Date(payload.created_at).getTime() : Date.now();
                if (pathname === '/home') {
                    localStorage.setItem('latestPostSeen', String(createdTs));
                    setNewPosts(0);
                } else {
                    const lastSeen = Number(localStorage.getItem('latestPostSeen') || 0);
                    if (createdTs > lastSeen) {
                        setNewPosts(n => n + 1);
                    }
                }
            });
            return () => {
                socketRef.current?.disconnect();
            };
        }, [pathname]);

        // Reset counters when user visits pages
        useEffect(() => {
            if (!pathname) return;
            if (pathname === '/requests') setPendingRequests(0);
            if (pathname === '/chat') setUnreadChats(0);
            if (pathname === '/jobs') {
                // Mark all current jobs as seen
                const markSeen = () => {
                    const ts = Date.now();
                    localStorage.setItem('latestJobSeen', String(ts));
                    setNewJobs(0);
                };
                markSeen();
            }
            if (pathname === '/home') {
                const markPostsSeen = () => {
                    const ts = Date.now();
                    localStorage.setItem('latestPostSeen', String(ts));
                    setNewPosts(0);
                };
                markPostsSeen();
            }
        }, [pathname]);

    const { isHOD, isCollegeAdmin, isSuperAdmin, isFacultyDelegate, adminPath } = useMemo(() => {
        const role = user?.role;
        const isHOD = role === 'HOD';
        const isCollegeAdmin = role === 'College Admin';
        const isSuperAdmin = role === 'Super Admin';
        const isFacultyDelegate = role === 'Faculty' && user?.is_verification_delegate;

        let path = '/';
        if (isHOD) path = '/hod-admin';
        if (isCollegeAdmin) path = '/college-admin';
        if (isSuperAdmin) path = '/admin';

        return {
            isHOD, isCollegeAdmin, isSuperAdmin, isFacultyDelegate,
            adminPath: path
        };
    }, [user]);

    const handleLogout = () => {
        if (confirm('Are you sure you want to log out?')) {
            localStorage.clear();
            router.push('/login');
        }
    };

    return (
        <div className={`flex flex-col bg-white dark:bg-gray-800 border-r dark:border-gray-700 ${compact ? 'w-20' : 'w-64'} p-4 flex-shrink-0 h-screen lg:sticky lg:top-0 overflow-y-auto`}>

            {/* 1. Profile/Admin Section */}
            <div className={`pb-4 border-b dark:border-gray-700 ${compact ? 'items-center' : ''} flex flex-col`}>
                <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-3">
                        <Avatar src={user?.profileIconUrl} name={user?.fullName || 'User'} size={40} />
                        {!compact && (
                            <div>
                                <p className="font-semibold text-gray-900 dark:text-white truncate max-w-[9rem]">{user?.fullName || 'Guest'}</p>
                                <span className="text-xs text-indigo-600 dark:text-indigo-400 font-medium">{user?.role}</span>
                            </div>
                        )}
                    </div>
                    <button onClick={onToggleCompact} className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 lg:block hidden" title="Toggle sidebar width">
                        {compact ? <span className="text-sm">›</span> : <span className="text-sm">‹</span>}
                    </button>
                    {/* Mobile close */}
                    <button onClick={onCloseMobile} className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 lg:hidden" title="Close sidebar">
                        ✕
                    </button>
                </div>
            </div>

            {/* 2. HOD/ADMIN / Delegate Links */}
            {(isHOD || isCollegeAdmin || isSuperAdmin) && (
                <div className="my-4 border-b dark:border-gray-700 pb-4">
                    <NavLink
                        compact={compact}
                        href={adminPath}
                        currentPath={pathname || ''}
                        icon={<LayoutDashboard className="w-5 h-5 text-amber-500" />}
                        label={isHOD ? "HOD Admin Panel" : isCollegeAdmin ? "College Admin Tools" : "Super Admin Tools"}
                    />
                    {isHOD && (
                        <NavLink
                            compact={compact}
                            href="/hod-admin/reports"
                            currentPath={pathname || ''}
                            icon={<AlertTriangle className="w-5 h-5 text-red-500" />}
                            label="Report Queue"
                        />
                    )}
                </div>
            )}

            {isFacultyDelegate && !isHOD && !isCollegeAdmin && !isSuperAdmin && (
                <div className="my-4 border-b dark:border-gray-700 pb-4">
                    <NavLink
                        href="/faculty/alumni-verification"
                        currentPath={pathname || ''}
                        icon={<LayoutDashboard className="w-5 h-5 text-emerald-500" />}
                        label="Alumni Verification"
                    />
                </div>
            )}

            {/* 3. Main Tabs (Standard User Links) */}
            <div className="space-y-1 mt-4 flex-1">
                <NavLink compact={compact} href="/home" currentPath={pathname || ''} icon={<Home className="w-5 h-5" />} label={'Posts (Home)'} badge={newPosts > 0 ? newPosts : null} />
                <NavLink compact={compact} href="/trending" currentPath={pathname || ''} icon={<TrendingUp className="w-5 h-5" />} label={'Trending'} />
                <NavLink compact={compact} href="/people" currentPath={pathname || ''} icon={<Users className="w-5 h-5" />} label={'People'} />
                <NavLink compact={compact} href="/jobs" currentPath={pathname || ''} icon={<Briefcase className="w-5 h-5" />} label={'Jobs'} badge={newJobs > 0 ? newJobs : null} />
                <NavLink compact={compact} href="/chat" currentPath={pathname || ''} icon={<MessageSquare className="w-5 h-5" />} label={'Chat'} badge={unreadChats > 0 ? unreadChats : null} />
                <NavLink compact={compact} href="/requests" currentPath={pathname || ''} icon={<Bell className="w-5 h-5" />} label={'Requests'} badge={pendingRequests > 0 ? pendingRequests : null} />
                {user && <NavLink compact={compact} href={`/profile/${user.id}`} currentPath={pathname || ''} icon={<Settings className="w-5 h-5" />} label={'Profile'} />}
            </div>

            {/* 4. Logout */}
            <button onClick={handleLogout} className={`flex items-center p-3 text-red-500 dark:text-red-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-150 mt-4 ${compact ? 'justify-center' : ''}`}>
                <LogOut className="w-5 h-5" />
                {!compact && <span className="ml-3">Log Out</span>}
            </button>
        </div>
    );
}