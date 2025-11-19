// src/app/jobs/page.tsx
'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import AppLayout from '@/components/AppLayout'
import { useAuth } from '@/context/UserContext'
import { Briefcase, Plus, X, Edit, Trash2 } from 'lucide-react'
import Link from 'next/link'
import ToastNotification from '@/components/ToastNotification'

const API_URL = 'http://localhost:3001';

type Job = {
  job_id: number;
  title: string;
  company_name: string;
  location: string | null;
  job_type: string | null;
  description: string;
  application_link: string | null;
  application_email: string | null;
  created_at: string;
  posted_by_name: string;
  posted_by_role: string;
  posted_by_user_id: number; 
};

// --- Reusable Job Modal (for Create and Edit) ---
const JobModal = ({
  jobToEdit, 
  onClose,
  onComplete
}: {
  jobToEdit: Job | null;
  onClose: () => void;
  onComplete: (message: string) => void;
}) => {

  const isEditMode = !!jobToEdit;

  const [title, setTitle] = useState(jobToEdit?.title || '');
  const [companyName, setCompanyName] = useState(jobToEdit?.company_name || '');
  const [location, setLocation] = useState(jobToEdit?.location || '');
  const [jobType, setJobType] = useState(jobToEdit?.job_type || 'Full-Time');
  const [description, setDescription] = useState(jobToEdit?.description || '');
  const [applicationLink, setApplicationLink] = useState(jobToEdit?.application_link || '');
  const [applicationEmail, setApplicationEmail] = useState(jobToEdit?.application_email || '');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (!applicationLink && !applicationEmail) {
      setError('You must provide at least one application method (Link or Email).');
      setLoading(false);
      return;
    }

    const jobData = {
      title, companyName, location, jobType, description, applicationLink, applicationEmail
    };

    const url = isEditMode
      ? `${API_URL}/api/jobs/${jobToEdit!.job_id}`
      : `${API_URL}/api/jobs`;

    const method = isEditMode ? 'PUT' : 'POST';

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(url, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(jobData)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit job.');

      setLoading(false);
      onComplete(isEditMode ? 'Job updated successfully!' : 'Job posted successfully!'); 
      onClose(); 

    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-2xl p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold">
            {isEditMode ? 'Edit Your Job Post' : 'Post a New Opportunity'}
          </h2>
          <button onClick={onClose}><X className="w-6 h-6" /></button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
          {/* ... (Form fields are the same) ... */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Job Title</label>
            <input type="text" required value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 dark:bg-gray-700 dark:text-white dark:border-gray-600" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Company Name</label>
              <input type="text" required value={companyName} onChange={(e) => setCompanyName(e.target.value)} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 dark:bg-gray-700 dark:text-white dark:border-gray-600" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Location (e.g., "New York" or "Remote")</label>
              <input type="text" value={location || ''} onChange={(e) => setLocation(e.target.value)} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 dark:bg-gray-700 dark:text-white dark:border-gray-600" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Job Type</label>
            <select value={jobType || 'Full-Time'} onChange={(e) => setJobType(e.target.value)} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 dark:bg-gray-700 dark:text-white dark:border-gray-600">
              <option>Full-Time</option>
              <option>Part-Time</option>
              <option>Internship</option>
              <option>Research Assistant</option>
              <option>Contract</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Job Description</label>
            <textarea rows={5} required value={description} onChange={(e) => setDescription(e.target.value)} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 dark:bg-gray-700 dark:text-white dark:border-gray-600" />
          </div>
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Application Method (Provide at least one)</p>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Application Link (URL)</label>
            <input 
              type="url" 
              value={applicationLink || ''} 
              onChange={(e) => setApplicationLink(e.target.value)} 
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 dark:bg-gray-700 dark:text-white dark:border-gray-600"
              placeholder="https://www.company.com/apply" 
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Application Email</label>
            <input 
              type="email" 
              value={applicationEmail || ''} 
              onChange={(e) => setApplicationEmail(e.target.value)} 
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 dark:bg-gray-700 dark:text-white dark:border-gray-600"
              placeholder="careers@company.com" 
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-4">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md dark:text-gray-300 dark:bg-gray-600">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50">
              {loading ? 'Saving...' : 'Save Job'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};


// --- Main Jobs Page Component ---
function JobsPageContent() {
  const { user } = useAuth(); // Get the logged-in user
  const [allJobs, setAllJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<Job | null>(null);
  const [filter, setFilter] = useState<'all' | 'myJobs'>('all');

  const userCanPost = useMemo(() => {
    if (!user) return false;
    const allowedRoles = ['Alumni', 'Faculty', 'HOD', 'College Admin', 'Super Admin'];
    return allowedRoles.includes(user.role);
  }, [user]);

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const res = await fetch(`${API_URL}/api/jobs`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to fetch jobs');
      }

      const data = await res.json();
      setAllJobs(data);

    } catch (err: any) {
      setError(err.message);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (user) { 
      fetchJobs();
    }
  }, [user, fetchJobs]);

  const displayedJobs = useMemo(() => {
    if (filter === 'all') return allJobs;
    if (filter === 'myJobs') {
      return allJobs.filter(job => job.posted_by_user_id === user?.id);
    }
    return allJobs;
  }, [allJobs, filter, user]);

  const openPostModal = () => {
    setEditingJob(null);
    setIsModalOpen(true);
  };

  const openEditModal = (job: Job) => {
    setEditingJob(job);
    setIsModalOpen(true);
  };

  const handleDeleteJob = async (jobId: number) => {
    setError(null);
    setMessage(null);
    if (!confirm('Are you sure you want to permanently delete this job posting?')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/jobs/${jobId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete job.');

      setMessage(data.message);
      fetchJobs(); // Refresh the list
    } catch (err: any) {
      setError(err.message);
    }
  };

  const onModalComplete = (successMessage: string) => {
    fetchJobs(); // Refresh the job list
    setMessage(successMessage);
  };

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Job Board</h1>
        {userCanPost && (
          <button
            onClick={openPostModal}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
          >
            <Plus className="w-5 h-5" />
            Post a Job
          </button>
        )}
      </div>

      {/* --- THIS IS THE FILTER YOU WERE MISSING --- */}
      {userCanPost && (
        <div className="mb-6 flex space-x-2 border-b dark:border-gray-700">
          <button 
            onClick={() => setFilter('all')}
            className={`py-3 px-4 text-sm font-medium ${filter === 'all' ? 'border-b-2 border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}
          >
            All Jobs
          </button>
          <button 
            onClick={() => setFilter('myJobs')}
            className={`py-3 px-4 text-sm font-medium ${filter === 'myJobs' ? 'border-b-2 border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}
          >
            Your Jobs
          </button>
        </div>
      )}
      {/* --- END OF FILTER --- */}

      {/* --- Job List --- */}
      {loading && <p>Loading jobs...</p>}
      {error && <p className="text-red-500">{error}</p>}
      {!loading && !error && (
        <div className="space-y-6">
          {displayedJobs.length === 0 ? (
            <div className="text-center p-12 bg-white dark:bg-gray-800 rounded-lg shadow-md">
              <h3 className="text-xl font-semibold">No Jobs Found</h3>
              <p className="text-gray-500 dark:text-gray-400 mt-2">
                {filter === 'myJobs' ? 'You have not posted any jobs.' : 'No jobs have been posted for your university yet.'}
              </p>
            </div>
          ) : (
            displayedJobs.map(job => {
              const isMyJob = user?.id === job.posted_by_user_id;
              const safeLink = job.application_link && !job.application_link.startsWith('http') 
                ? `https://${job.application_link}` 
                : job.application_link;

              return (
                <div key={job.job_id} className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-xs font-semibold px-2 py-1 bg-indigo-100 text-indigo-700 rounded-full dark:bg-indigo-900 dark:text-indigo-300">
                        {job.job_type || 'Opportunity'}
                      </span>
                      <h2 className="text-2xl font-bold mt-2 hover:text-indigo-600 dark:hover:text-indigo-400">
                        {isMyJob ? (
                          <span className="cursor-pointer" onClick={() => openEditModal(job)}>{job.title}</span>
                        ) : (
                          <a href={safeLink || `mailto:${job.application_email}`} target="_blank" rel="noopener noreferrer">{job.title}</a>
                        )}
                      </h2>
                      <p className="text-lg font-medium text-gray-700 dark:text-gray-300">{job.company_name}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{job.location || 'Location not specified'}</p>
                    </div>

                    <div className="flex items-center gap-2">
                      {isMyJob ? (
                        <>
                          <button
                            onClick={() => openEditModal(job)}
                            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-gray-500 rounded-md hover:bg-gray-600"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteJob(job.job_id)}
                            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      ) : (
                        <div className="flex flex-col sm:flex-row gap-2">
                          {job.application_link && (
                            <a 
                              href={safeLink!} 
                              target="_blank" rel="noopener noreferrer"
                              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 text-center"
                            >
                              Apply by Link
                            </a>
                          )}
                          {job.application_email && (
                            <a 
                              href={`mailto:${job.application_email}`}
                              className="px-4 py-2 text-sm font-medium text-white bg-gray-600 rounded-md hover:bg-gray-700 text-center"
                            >
                              Apply by Email
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="mt-4 pt-4 border-t dark:border-gray-700">
                    <p className="text-sm whitespace-pre-wrap">{job.description}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-4">
                      Posted by {' '}
                      <Link href={`/profile/${job.posted_by_user_id}`} className="font-medium text-indigo-600 dark:text-indigo-400 hover:underline">
                        {job.posted_by_name}
                      </Link>
                      {' '}
                      [{job.posted_by_role}]
                    </p>
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}

      {isModalOpen && (
        <JobModal 
          jobToEdit={editingJob}
          onClose={() => setIsModalOpen(false)} 
          onComplete={onModalComplete}
        />
      )}

      <ToastNotification message={message} error={error} clearMessages={() => { setMessage(null); setError(null); }} />
    </div>
  );
}

// --- Main Page Export ---
export default function JobsPage() {
  return (
    <AppLayout>
      <JobsPageContent />
    </AppLayout>
  );
}