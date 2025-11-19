// client/components/Sidebar.tsx
'use client'

import React, { useMemo } from 'react';
// --- NEW: Added TrendingUp ---
import { LogOut, Home, Users, Briefcase, MessageSquare, Tag, Bell, Settings, LayoutDashboard, TrendingUp, AlertTriangle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import ThemeSwitcher from './ThemeSwitcher';

type User = {
    fullName: string;
    role: string;
    id: number;
}

// --- Helper Component for Each Nav Link ---
const NavLink = ({ href, icon, label }: { href: string, icon: React.ReactNode, label: string }) => {
    // This 'isActive' check will be refined later
    const isActive = (typeof window !== 'undefined' && window.location.pathname === href);
    return (
        <Link href={href} className={`flex items-center p-3 rounded-lg transition-colors duration-150 
            ${isActive 
                ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-700 dark:text-white' 
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`
        }>
            {icon}
            <span className="ml-3 font-medium">{label}</span>
        </Link>
    );
};

export default function Sidebar({ user }: { user: User | null }) {
    const router = useRouter();

    const { isHOD, isCollegeAdmin, isSuperAdmin, adminPath } = useMemo(() => {
        const role = user?.role;
        const isHOD = role === 'HOD';
        const isCollegeAdmin = role === 'College Admin';
        const isSuperAdmin = role === 'Super Admin';

        let path = '/';
        if (isHOD) path = '/hod-admin';
        if (isCollegeAdmin) path = '/college-admin';
        if (isSuperAdmin) path = '/admin';

        return {
            isHOD, isCollegeAdmin, isSuperAdmin,
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
        <div className="flex flex-col h-full bg-white dark:bg-gray-800 border-r dark:border-gray-700 w-64 p-4 flex-shrink-0">

            {/* 1. Profile/Admin Section */}
            <div className="flex flex-col items-center pb-4 border-b dark:border-gray-700">
                <div className="w-10 h-10 bg-indigo-500 rounded-full flex items-center justify-center text-white font-bold text-lg">
                    {user?.fullName[0] || 'U'}
                </div>
                <p className="mt-2 font-semibold text-gray-900 dark:text-white">{user?.fullName || 'Guest'}</p>
                <span className="text-xs text-indigo-600 dark:text-indigo-400 font-medium">
                    {user?.role}
                </span>
                <div className="mt-3">
                  <ThemeSwitcher />
                </div>
            </div>

            {/* 2. HOD/ADMIN LINK */}
            {(isHOD || isCollegeAdmin || isSuperAdmin) && (
                <div className="my-4 border-b dark:border-gray-700 pb-4">
                    <NavLink 
                        href={adminPath}
                        icon={<LayoutDashboard className="w-5 h-5 text-amber-500" />}
                        label={isHOD ? "HOD Admin Panel" : isCollegeAdmin ? "College Admin Tools" : "Super Admin Tools"}
                    />
                    {isHOD && (
                        <NavLink
                            href="/hod-admin/reports"
                            icon={<AlertTriangle className="w-5 h-5 text-red-500" />}
                            label="Report Queue"
                        />
                    )}
                </div>
            )}

            {/* 3. Main Tabs (Standard User Links) */}
            <div className="space-y-1 mt-4 flex-1">
                <NavLink href="/home" icon={<Home className="w-5 h-5" />} label="Posts (Home)" />
                {/* --- NEW: Added Trending Tab --- */}
                <NavLink href="/trending" icon={<TrendingUp className="w-5 h-5" />} label="Trending" />
                <NavLink href="/people" icon={<Users className="w-5 h-5" />} label="People" />
                <NavLink href="/jobs" icon={<Briefcase className="w-5 h-5" />} label="Jobs" />
                <NavLink href="/chat" icon={<MessageSquare className="w-5 h-5" />} label="Chat" />
                <NavLink href="/requests" icon={<Bell className="w-5 h-5" />} label="Requests" />
                {user && <NavLink href={`/profile/${user.id}`} icon={<Settings className="w-5 h-5" />} label="Profile" />}
            </div>

            {/* 4. Logout */}
            <button onClick={handleLogout} className="flex items-center p-3 text-red-500 dark:text-red-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-150 mt-4">
                <LogOut className="w-5 h-5" />
                <span className="ml-3">Log Out</span>
            </button>
        </div>
    );
}