"use client";

import { FC, useState, ChangeEvent, FormEvent, useEffect } from 'react';
import { FaTimes, FaSpinner, FaPlus, FaEdit, FaTrash } from 'react-icons/fa';
import { Profile, Experience, Education } from '@/types';
import { API_URL } from '@/utils/api';


interface EditProfileModalProps {
    profile: Profile;
    onClose: () => void;
    onProfileUpdate: (updatedProfile: Profile) => void;
    initialSection?: Section;
}

type Section = 'core' | 'experience' | 'education';

// --- Reusable Form for Experience/Education ---
interface CrudFormProps<T> {
    item: T | null;
    onSave: (item: T) => void;
    onCancel: () => void;
    fields: Array<{ name: keyof T; label: string; type: string; }>;
}

function CrudForm<T extends { [key: string]: any }>({ item, onSave, onCancel, fields }: CrudFormProps<T>) {
    const [formData, setFormData] = useState<T>(item || {} as T);

    const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSave = () => {
        onSave(formData);
    };

    return (
        <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg mt-4 space-y-4">
            {fields.map(field => (
                <div key={String(field.name)}>
                    <label htmlFor={String(field.name)} className="block text-sm font-medium text-gray-700 dark:text-gray-300">{field.label}</label>
                    {field.type === 'textarea' ? (
                         <textarea
                            name={String(field.name)}
                            id={String(field.name)}
                            value={formData[field.name] || ''}
                            onChange={handleChange}
                            rows={3}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-white"
                        />
                    ) : (
                        <input
                            type={field.type}
                            name={String(field.name)}
                            id={String(field.name)}
                            value={formData[field.name] || ''}
                            onChange={handleChange}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-white"
                        />
                    )}
                </div>
            ))}
            <div className="flex justify-end space-x-2">
                <button type="button" onClick={onCancel} className="bg-gray-200 text-gray-800 px-4 py-2 rounded-lg">Cancel</button>
                <button type="button" onClick={handleSave} className="bg-blue-600 text-white px-4 py-2 rounded-lg">Save</button>
            </div>
        </div>
    );
}


const EditProfileModal: FC<EditProfileModalProps> = ({ profile, onClose, onProfileUpdate, initialSection = 'core' }) => {
    const [activeSection, setActiveSection] = useState<Section>(initialSection);
    const [formData, setFormData] = useState<Profile>(profile);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [profileIconFile, setProfileIconFile] = useState<File | null>(null);
    const [coverPhotoFile, setCoverPhotoFile] = useState<File | null>(null);

    // Generic CRUD helper for experience/education endpoints
    const handleCrud = async (endpoint: string, method: 'POST' | 'PUT' | 'DELETE', body?: any) => {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_URL}/api/${endpoint}`, {
            method,
            headers: {
                'Authorization': `Bearer ${token}`,
                ...(body ? { 'Content-Type': 'application/json' } : {})
            },
            body: body ? JSON.stringify(body) : undefined
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `Request failed: ${method} ${endpoint}`);
        return data; // For POST/PUT this is the created/updated row object
    };

    // State for Experience and Education
    const [localExperience, setLocalExperience] = useState<Experience[]>(profile.experience || []);
    const [localEducation, setLocalEducation] = useState<Education[]>(profile.education || []);
    const [editingExperience, setEditingExperience] = useState<Experience | null>(null);
    const [editingEducation, setEditingEducation] = useState<Education | null>(null);
    const [showExperienceForm, setShowExperienceForm] = useState(false);
    const [showEducationForm, setShowEducationForm] = useState(false);

    const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
        const { name, files } = e.target;
        if (files && files.length > 0) {
            if (name === 'profileIcon') setProfileIconFile(files[0]);
            else if (name === 'coverPhoto') setCoverPhotoFile(files[0]);
        }
    };

    const handleCoreSubmit = async () => {
        const submissionData = new FormData();
        submissionData.append('full_name', formData.full_name);
        submissionData.append('headline', formData.headline || '');
        submissionData.append('about', formData.about || '');
        if (profileIconFile) submissionData.append('profileIcon', profileIconFile);
        if (coverPhotoFile) submissionData.append('coverPhoto', coverPhotoFile);

        const token = localStorage.getItem('token');
        const res = await fetch(`${API_URL}/api/profile`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${token}` },
            body: submissionData,
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || 'Failed to update profile.');
        return result.profile;
    };

    const handleSaveExperience = (item: Experience) => {
        setLocalExperience(prev => {
            // If item has an id, it's an edit; otherwise, it's a new item.
            const isEditing = 'experience_id' in item && item.experience_id !== undefined;
            if (isEditing) {
                return prev.map(i => i.experience_id === item.experience_id ? item : i);
            }
            // For new items, add them with a temporary ID for list key purposes
            return [...prev, { ...item, experience_id: Date.now() }];
        });
        setShowExperienceForm(false);
        setEditingExperience(null);
    };

    const handleDeleteExperience = (id: number) => {
        if (id === undefined) return;
        setLocalExperience(prev => prev.filter(i => i.experience_id !== id));
    };
    
    const handleSaveEducation = (item: Education) => {
        setLocalEducation(prev => {
            const isEditing = 'education_id' in item && item.education_id !== undefined;
            if (isEditing) {
                return prev.map(i => i.education_id === item.education_id ? item : i);
            }
            return [...prev, { ...item, education_id: Date.now() }];
        });
        setShowEducationForm(false);
        setEditingEducation(null);
    };

    const handleDeleteEducation = (id: number) => {
        if (id === undefined) return;
        setLocalEducation(prev => prev.filter(i => i.education_id !== id));
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
            // 1. Update core profile info
            await handleCoreSubmit();

            // 2. Sync Experience (transform snake_case to camelCase for API)
            const originalExpIds = profile.experience.map(e => e.experience_id);
            const currentExpIds = localExperience.map(e => e.experience_id);

            // Deletes
            for (const id of originalExpIds) {
                if (!currentExpIds.includes(id)) {
                    await handleCrud(`profile/experience/${id}`, 'DELETE');
                }
            }
            // Adds / Updates
            for (const item of localExperience) {
                const body = {
                    title: item.title || '',
                    company: item.company || '',
                    location: item.location || '',
                    startDate: item.start_date || new Date().toISOString().split('T')[0],
                    endDate: item.end_date || null,
                    description: item.description || ''
                };
                if (item.experience_id && originalExpIds.includes(item.experience_id)) {
                    const originalItem = profile.experience.find(e => e.experience_id === item.experience_id);
                    if (JSON.stringify(originalItem) !== JSON.stringify(item)) {
                        await handleCrud(`profile/experience/${item.experience_id}`, 'PUT', body);
                    }
                } else {
                    await handleCrud('profile/experience', 'POST', body);
                }
            }

            // 3. Sync Education (transform snake_case to camelCase for API)
            const originalEduIds = profile.education.map(e => e.education_id);
            const currentEduIds = localEducation.map(e => e.education_id);

            for (const id of originalEduIds) {
                if (!currentEduIds.includes(id)) {
                    await handleCrud(`profile/education/${id}`, 'DELETE');
                }
            }
            for (const item of localEducation) {
                const body = {
                    school: item.school || '',
                    degree: item.degree || '',
                    fieldOfStudy: item.field_of_study || '',
                    startDate: item.start_date || new Date().toISOString().split('T')[0],
                    endDate: item.end_date || null
                };
                if (item.education_id && originalEduIds.includes(item.education_id)) {
                    const originalItem = profile.education.find(e => e.education_id === item.education_id);
                    if (JSON.stringify(originalItem) !== JSON.stringify(item)) {
                        await handleCrud(`profile/education/${item.education_id}`, 'PUT', body);
                    }
                } else {
                    await handleCrud('profile/education', 'POST', body);
                }
            }

            // 4. Fetch updated profile
            const finalProfileRes = await fetch(`${API_URL}/api/profile/${profile.user_id}`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            const finalProfile = await finalProfileRes.json();
            onProfileUpdate(finalProfile);
            onClose();
        } catch (err) {
            if (err instanceof Error) setError(err.message);
            else setError('An unknown error occurred.');
        } finally {
            setLoading(false);
        }
    };

    const renderSection = () => {
        switch (activeSection) {
            case 'core':
                return (
                    <div>
                        <h3 className="text-lg font-semibold mb-4 dark:text-white">Core Info</h3>
                        <div className="space-y-4">
                            <div>
                                <label htmlFor="full_name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Full Name</label>
                                <input type="text" name="full_name" id="full_name" value={formData.full_name} onChange={handleInputChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-white" />
                            </div>
                            <div>
                                <label htmlFor="headline" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Headline</label>
                                <input type="text" name="headline" id="headline" value={formData.headline || ''} onChange={handleInputChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-white" />
                            </div>
                            <div>
                                <label htmlFor="about" className="block text-sm font-medium text-gray-700 dark:text-gray-300">About</label>
                                <textarea name="about" id="about" value={formData.about || ''} onChange={handleInputChange} rows={4} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-white"></textarea>
                            </div>
                            <div>
                                <label htmlFor="profileIcon" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Profile Photo</label>
                                <input type="file" name="profileIcon" id="profileIcon" onChange={handleFileChange} className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-blue-900 dark:file:text-blue-300 dark:hover:file:bg-blue-800"/>
                            </div>
                            <div>
                                <label htmlFor="coverPhoto" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Cover Photo</label>
                                <input type="file" name="coverPhoto" id="coverPhoto" onChange={handleFileChange} className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-blue-900 dark:file:text-blue-300 dark:hover:file:bg-blue-800"/>
                            </div>
                        </div>
                    </div>
                );
            case 'experience':
                return (
                    <div>
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-semibold dark:text-white">Experience</h3>
                            <button type="button" onClick={() => { setEditingExperience({} as Experience); setShowExperienceForm(true); }} className="bg-blue-500 text-white p-2 rounded-full hover:bg-blue-600"><FaPlus /></button>
                        </div>
                        {showExperienceForm && (
                            <CrudForm<Experience>
                                item={editingExperience}
                                onSave={handleSaveExperience}
                                onCancel={() => { setShowExperienceForm(false); setEditingExperience(null); }}
                                fields={[
                                    { name: 'title', label: 'Title', type: 'text' },
                                    { name: 'company', label: 'Company', type: 'text' },
                                    { name: 'location', label: 'Location', type: 'text' },
                                    { name: 'start_date', label: 'Start Date', type: 'date' },
                                    { name: 'end_date', label: 'End Date', type: 'date' },
                                    { name: 'description', label: 'Description', type: 'textarea' },
                                ]}
                            />
                        )}
                        <div className="space-y-4 mt-4">
                            {localExperience.map(exp => (
                                <div key={exp.experience_id} className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg flex justify-between items-start">
                                    <div>
                                        <p className="font-bold dark:text-white">{exp.title} at {exp.company}</p>
                                        <p className="text-sm text-gray-600 dark:text-gray-400">{exp.start_date} - {exp.end_date || 'Present'}</p>
                                    </div>
                                    <div className="flex space-x-2">
                                        <button onClick={() => { setEditingExperience(exp); setShowExperienceForm(true); }} className="text-gray-500 hover:text-blue-500"><FaEdit /></button>
                                        <button onClick={() => exp.experience_id && handleDeleteExperience(exp.experience_id)} className="text-gray-500 hover:text-red-500"><FaTrash /></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                );
            case 'education':
                 return (
                    <div>
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-semibold dark:text-white">Education</h3>
                            <button type="button" onClick={() => { setEditingEducation({} as Education); setShowEducationForm(true); }} className="bg-blue-500 text-white p-2 rounded-full hover:bg-blue-600"><FaPlus /></button>
                        </div>
                        {showEducationForm && (
                            <CrudForm<Education>
                                item={editingEducation}
                                onSave={handleSaveEducation}
                                onCancel={() => { setShowEducationForm(false); setEditingEducation(null); }}
                                fields={[
                                    { name: 'school', label: 'School', type: 'text' },
                                    { name: 'degree', label: 'Degree', type: 'text' },
                                    { name: 'field_of_study', label: 'Field of Study', type: 'text' },
                                    { name: 'start_date', label: 'Start Date', type: 'date' },
                                    { name: 'end_date', label: 'End Date', type: 'date' },
                                ]}
                            />
                        )}
                        <div className="space-y-4 mt-4">
                            {localEducation.map(edu => (
                                <div key={edu.education_id} className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg flex justify-between items-start">
                                    <div>
                                        <p className="font-bold dark:text-white">{edu.school}</p>
                                        <p className="text-sm text-gray-600 dark:text-gray-400">{edu.degree}, {edu.field_of_study}</p>
                                        <p className="text-xs text-gray-500 dark:text-gray-500">{edu.start_date} - {edu.end_date || 'Present'}</p>
                                    </div>
                                    <div className="flex space-x-2">
                                        <button onClick={() => { setEditingEducation(edu); setShowEducationForm(true); }} className="text-gray-500 hover:text-blue-500"><FaEdit /></button>
                                        <button onClick={() => edu.education_id && handleDeleteEducation(edu.education_id)} className="text-gray-500 hover:text-red-500"><FaTrash /></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
                <div className="flex justify-between items-center p-4 border-b dark:border-gray-700">
                    <h2 className="text-xl font-bold dark:text-white">Edit Profile</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white">
                        <FaTimes />
                    </button>
                </div>
                <div className="flex flex-grow overflow-hidden">
                    <aside className="w-1/4 border-r dark:border-gray-700 p-4">
                        <nav className="flex flex-col space-y-2">
                            <button onClick={() => setActiveSection('core')} className={`text-left p-2 rounded w-full ${activeSection === 'core' ? 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300' : 'hover:bg-gray-100 dark:hover:bg-gray-700 dark:text-gray-300'}`}>Core Info</button>
                            <button onClick={() => setActiveSection('experience')} className={`text-left p-2 rounded w-full ${activeSection === 'experience' ? 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300' : 'hover:bg-gray-100 dark:hover:bg-gray-700 dark:text-gray-300'}`}>Experience</button>
                            <button onClick={() => setActiveSection('education')} className={`text-left p-2 rounded w-full ${activeSection === 'education' ? 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300' : 'hover:bg-gray-100 dark:hover:bg-gray-700 dark:text-gray-300'}`}>Education</button>
                        </nav>
                    </aside>
                    <main className="w-3/4 p-6 overflow-y-auto">
                        <form onSubmit={handleSubmit}>
                            {error && <div className="text-red-500 bg-red-100 dark:bg-red-900 dark:text-red-300 p-3 rounded mb-4">{error}</div>}
                            {renderSection()}
                            <div className="flex justify-end pt-4 mt-4 border-t dark:border-gray-700">
                                <button type="button" onClick={onClose} className="bg-gray-200 text-gray-800 px-4 py-2 rounded-lg mr-2 dark:bg-gray-600 dark:text-gray-200">Cancel</button>
                                <button type="submit" disabled={loading} className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center disabled:bg-blue-400">
                                    {loading && <span className="animate-spin mr-2"><FaSpinner /></span>}
                                    Save Changes
                                </button>
                            </div>
                        </form>
                    </main>
                </div>
            </div>
        </div>
    );
};

export default EditProfileModal;
