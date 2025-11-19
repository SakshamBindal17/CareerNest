"use client";

import { useEffect, useState, FC, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { useAuth } from '@/context/UserContext';
import AppLayout from '@/components/AppLayout';
import { FaEdit, FaPlus, FaTrash, FaUserPlus, FaEnvelope, FaUserClock, FaBuilding, FaGraduationCap } from 'react-icons/fa';
import ToastNotification from '@/components/ToastNotification';
import { Profile, Experience, Education, Connection } from '@/types';
import EditProfileModal from '@/components/EditProfileModal';
import Avatar from '@/components/Avatar';

const API_URL = 'http://localhost:3001';

// Prop Types
interface ProfileHeaderProps {
    profile: Profile;
    isOwnProfile: boolean;
    onEdit: () => void;
    onAction: (action: string, id: number) => void;
}

interface DynamicActionButtonProps {
    connection: Connection | null;
    targetUserId: number;
    onAction: (action: string, id: number) => void;
}

interface AboutSectionProps {
    about: string;
}

interface ExperienceSectionProps {
    experience: Experience[];
    isOwnProfile: boolean;
}

interface EducationSectionProps {
    education: Education[];
    isOwnProfile: boolean;
}

const ProfileHeader: FC<ProfileHeaderProps> = ({ profile, isOwnProfile, onEdit, onAction }) => (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
        <div className="relative h-48 w-full">
            <Image 
                src={profile.cover_photo_url || '/default-cover.jpg'} 
                alt="Cover photo" 
                layout="fill" 
                objectFit="cover" 
                className="bg-gray-200 dark:bg-gray-700"
            />
        </div>
        <div className="p-6">
            <div className="flex items-end -mt-20">
                <div className="relative h-28 w-28 border-4 border-white dark:border-gray-800 rounded-full overflow-hidden">
                    <Avatar src={profile.profile_icon_url} name={profile.full_name} size={112} />
                </div>
                <div className="flex-grow flex justify-end items-center">
                    {isOwnProfile ? (
                        <button onClick={onEdit} className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-full flex items-center transition-colors">
                            <span className="mr-2"><FaEdit /></span> Edit Profile
                        </button>
                    ) : (
                        <DynamicActionButton connection={profile.connection} targetUserId={profile.user_id} onAction={onAction} />
                    )}
                </div>
            </div>
            <div className="mt-4">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{profile.full_name}</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">@{profile.role.toLowerCase().replace(' ', '-')}</p>
                <p className="text-md text-gray-700 dark:text-gray-300 mt-1">{profile.headline}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{profile.department_name}</p>
            </div>
        </div>
    </div>
);

const DynamicActionButton: FC<DynamicActionButtonProps> = ({ connection, targetUserId, onAction }) => {
    const { user: currentUser } = useAuth();

    if (!connection) {
        return (
            <button onClick={() => onAction('connect', targetUserId)} className="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded-full flex items-center transition-colors">
                <span className="mr-2"><FaUserPlus /></span>Connect
            </button>
        );
    }

    switch (connection.status) {
        case 'pending':
            if (connection.sender_id === currentUser?.id) {
                return (
                    <div className="flex items-center space-x-2">
                        <button className="bg-gray-400 text-white font-bold py-2 px-4 rounded-full flex items-center cursor-not-allowed" disabled>
                            <span className="mr-2"><FaUserClock /></span>Request Sent
                        </button>
                        <button onClick={() => onAction('message', targetUserId)} className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-full flex items-center transition-colors">
                            <span className="mr-2"><FaEnvelope /></span>Message
                        </button>
                    </div>
                );
            } else {
                return (
                    <div className="flex items-center space-x-2">
                        <button onClick={() => onAction('accept', connection.connection_id)} className="bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-2 px-4 rounded-full transition-colors">Accept</button>
                        <button onClick={() => onAction('reject', connection.connection_id)} className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded-full transition-colors">Reject</button>
                    </div>
                );
            }
        case 'accepted':
            return (
                <button onClick={() => onAction('message', targetUserId)} className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-full flex items-center transition-colors">
                    <span className="mr-2"><FaEnvelope /></span>Message
                </button>
            );
        default:
             return (
                <button onClick={() => onAction('connect', targetUserId)} className="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded-full flex items-center transition-colors">
                    <span className="mr-2"><FaUserPlus /></span>Connect
                </button>
            );
    }
};

const AboutSection: FC<AboutSectionProps> = ({ about }) => (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mt-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">About</h2>
        <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{about || "No information provided."}</p>
    </div>
);

const ExperienceSection: FC<ExperienceSectionProps> = ({ experience, isOwnProfile }) => (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mt-6">
        <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Experience</h2>
            {isOwnProfile && <button className="text-blue-500 hover:text-blue-600"><FaPlus size={20} /></button>}
        </div>
        <div className="space-y-4">
            {experience?.length > 0 ? experience.map(exp => (
                <div key={exp.experience_id} className="flex items-start space-x-4 border-b border-gray-200 dark:border-gray-700 pb-4 last:border-b-0">
                    <div className="bg-gray-100 dark:bg-gray-700 p-3 rounded-full">
                        <FaBuilding />
                    </div>
                    <div className="flex-grow">
                        <div className="flex justify-between items-start">
                            <div>
                                <h3 className="font-semibold text-gray-800 dark:text-gray-200">{exp.title}</h3>
                                <p className="text-sm text-gray-600 dark:text-gray-400">{exp.company}</p>
                                <p className="text-xs text-gray-500 dark:text-gray-500">{new Date(exp.start_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long' })} - {exp.end_date ? new Date(exp.end_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long' }) : 'Present'}</p>
                            </div>
                            {isOwnProfile && (
                                <div className="flex space-x-2">
                                    <button className="text-gray-500 hover:text-blue-500"><FaEdit /></button>
                                    <button className="text-gray-500 hover:text-red-500"><FaTrash /></button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )) : <p className="text-gray-500 dark:text-gray-400">No experience added yet.</p>}
        </div>
    </div>
);

const EducationSection: FC<EducationSectionProps> = ({ education, isOwnProfile }) => (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mt-6">
        <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Education</h2>
            {isOwnProfile && <button className="text-blue-500 hover:text-blue-600"><FaPlus size={20} /></button>}
        </div>
        <div className="space-y-4">
            {education?.length > 0 ? education.map(edu => (
                <div key={edu.education_id} className="flex items-start space-x-4 border-b border-gray-200 dark:border-gray-700 pb-4 last:border-b-0">
                     <div className="bg-gray-100 dark:bg-gray-700 p-3 rounded-full">
                        <FaGraduationCap />
                    </div>
                    <div className="flex-grow">
                        <div className="flex justify-between items-start">
                            <div>
                                <h3 className="font-semibold text-gray-800 dark:text-gray-200">{edu.school}</h3>
                                <p className="text-sm text-gray-600 dark:text-gray-400">{edu.degree}, {edu.field_of_study}</p>
                                <p className="text-xs text-gray-500 dark:text-gray-500">{new Date(edu.start_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long' })} - {edu.end_date ? new Date(edu.end_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long' }) : 'Present'}</p>
                            </div>
                            {isOwnProfile && (
                                <div className="flex space-x-2">
                                    <button className="text-gray-500 hover:text-blue-500"><FaEdit /></button>
                                    <button className="text-gray-500 hover:text-red-500"><FaTrash /></button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )) : <p className="text-gray-500 dark:text-gray-400">No education added yet.</p>}
        </div>
    </div>
);

const ActivityFeed = () => (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mt-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Activity</h2>
        <p className="text-gray-500 dark:text-gray-400">Activity feed coming soon...</p>
    </div>
);


export default function ProfilePage() {
    const { userId } = useParams();
    const { user: currentUser, loading: authLoading } = useAuth(); // Use authLoading state
    const router = useRouter();
    const [profile, setProfile] = useState<Profile | null>(null);
    const [profileLoading, setProfileLoading] = useState(true); // Separate loading state for profile fetching
    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);
    const [isEditModalOpen, setEditModalOpen] = useState(false);

    const fetchProfile = useCallback(async () => {
        if (!userId) return;
        try {
            setProfileLoading(true);
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_URL}/api/profile/${userId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) {
                const errorData = await res.json().catch(() => ({ error: 'Failed to fetch profile' }));
                throw new Error(errorData.error);
            }
            const data = await res.json();
            setProfile(data);
        } catch (err) {
            if (err instanceof Error) {
                setError(err.message);
            } else {
                setError('An unknown error occurred');
            }
        } finally {
            setProfileLoading(false);
        }
    }, [userId]);

    useEffect(() => {
        // Only fetch the profile if authentication is not loading
        if (!authLoading) {
            fetchProfile();
        }
    }, [fetchProfile, authLoading]);

    const handleAction = async (action: string, id: number) => {
        let url = '';
        let body: { receiverId?: number; connectionId?: number; } = {};
        const method = 'POST';

        switch (action) {
            case 'connect':
                url = `${API_URL}/api/connections/request`;
                body = { receiverId: id };
                break;
            case 'accept':
                url = `${API_URL}/api/connections/accept`;
                body = { connectionId: id };
                break;
            case 'reject':
                url = `${API_URL}/api/connections/reject`;
                body = { connectionId: id };
                break;
            case 'message':
                router.push(`/chat?userId=${id}`);
                return;
            default:
                return;
        }

        try {
            const token = localStorage.getItem('token');
            const res = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(body)
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Action failed');
            setMessage(data.message);
            fetchProfile(); // Re-fetch profile to update connection status
        } catch (err) {
            if (err instanceof Error) {
                setError(err.message);
            } else {
                setError('An unknown error occurred');
            }
        }
    };

    // Combined loading state
    const isLoading = authLoading || profileLoading;

    if (isLoading) return <AppLayout><div className="text-center p-8">Loading profile...</div></AppLayout>;
    if (error) return <AppLayout><div className="text-center p-8 text-red-500">Error: {error}</div></AppLayout>;
    if (!profile) return <AppLayout><div className="text-center p-8">User not found.</div></AppLayout>;

    // This check is now reliable because it only runs after authentication is confirmed.
    const isOwnProfile = currentUser?.id.toString() === userId;    return (
        <AppLayout>
            <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8">
                <ToastNotification message={message} error={error} clearMessages={() => { setMessage(null); setError(null); }} />
                <ProfileHeader profile={profile} isOwnProfile={isOwnProfile} onEdit={() => setEditModalOpen(true)} onAction={handleAction} />
                <AboutSection about={profile.about} />
                <ExperienceSection experience={profile.experience} isOwnProfile={isOwnProfile} />
                <EducationSection education={profile.education} isOwnProfile={isOwnProfile} />
                <ActivityFeed />

                {isEditModalOpen && (
                    <EditProfileModal 
                        profile={profile} 
                        onClose={() => setEditModalOpen(false)}
                        onProfileUpdate={(updatedProfile) => {
                            setProfile(prevProfile => ({...prevProfile, ...updatedProfile}));
                            setMessage("Profile updated successfully!");
                        }}
                    />
                )}
            </div>
        </AppLayout>
    );
}
