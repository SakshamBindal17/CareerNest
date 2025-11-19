// src/app/hod-admin/page.tsx
'use client'

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import ThemeSwitcher from '@/components/ThemeSwitcher';
import ToastNotification from '@/components/ToastNotification';
import { ChevronLeft, ChevronRight, Search, Trash2 } from 'lucide-react';

const API_URL = 'http://localhost:3001';

// Define types
type AlumniRequest = {
  user_id: number;
  full_name: string;
  personal_email: string;
  graduation_year: string;
  institute_roll_number?: string;
  verification_document_url: string;
  created_at: string;
  role: 'Alumni';
};

type UserRosterItem = {
    user_id: number;
    full_name: string;
    official_email: string;
    personal_email: string;
    role: string;
    status: string;
    created_at: string;
  is_verification_delegate?: boolean;
};

type Department = { department_id: number; name: string; };

// --- Helper Functions ---
// Moved inside component scope below; placeholder removed.

// --- MAIN DASHBOARD COMPONENT ---
export default function HODDashboard() {
  const router = useRouter();
  // Data states
  const [queue, setQueue] = useState<AlumniRequest[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [roster, setRoster] = useState<UserRosterItem[]>([]);
  const [rosterTotal, setRosterTotal] = useState(0);

  // UI/Loading/Message states
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // Delegates management state
  const [showDelegatesModal, setShowDelegatesModal] = useState(false);
  const [delegatesLoading, setDelegatesLoading] = useState(false);
  const [facultyList, setFacultyList] = useState<Array<{ user_id: number; full_name: string; official_email: string; is_verification_delegate: boolean }>>([]);

  // Helper to safely parse JSON (gives clear error when HTML/error pages arrive)
  const readJson = async (res: Response) => {
    const ct = res.headers.get('content-type') || '';
    if (!ct.toLowerCase().includes('application/json')) {
      const body = await res.text();
      throw new Error(`Server returned non-JSON (status ${res.status}). ${body.slice(0, 200)}`);
    }
    return res.json();
  };

  // Clear toast messages
  const clearMessages = useCallback(() => {
    setError(null);
    setMessage(null);
  }, []);

  // Fix older Cloudinary PDF URLs that were uploaded as image type
  // kept for reference; getDocumentLinks now handles both variants
  // const fixCloudinaryPdfUrl = (url: string) => {
  //   if (!url) return url;
  //   return url.endsWith('.pdf') && url.includes('/image/upload/')
  //     ? url.replace('/image/upload/', '/raw/upload/')
  //     : url;
  // };

  const getDocumentLinks = (url: string): Array<{ label: string; url: string }> => {
    if (!url) return [];
    const links: Array<{ label: string; url: string }> = [];
    const isPdf = url.toLowerCase().endsWith('.pdf');

    if (isPdf) {
      // Primary (prefer raw for PDFs)
      const primary = url.includes('/image/upload/')
        ? url.replace('/image/upload/', '/raw/upload/')
        : url;
      links.push({ label: 'Open (PDF - raw)', url: primary });

      // Alternate fallback (image path, for older uploads)
      const alternate = primary.includes('/raw/upload/')
        ? primary.replace('/raw/upload/', '/image/upload/')
        : primary;
      if (alternate !== primary) {
        links.push({ label: 'Open (alternate - image)', url: alternate });
      }
    } else {
      // Non-PDFs: return original
      links.push({ label: 'Open Document', url });
    }
    return links;
  };

  const openDocumentAuto = async (userId: number, fallbackUrl?: string) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) { router.push('/login'); return; }
      const res = await fetch(`${API_URL}/api/hod-admin/document-link/${userId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        // Not JSON; try reading text and fallback
        const text = await res.text();
        throw new Error(`Unexpected response while resolving link. Status: ${res.status}. Body: ${text.slice(0, 200)}`);
      }
      const data: { url?: string; error?: string } = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error || 'Failed to resolve document link.');
      window.open(data.url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      // Fallback: try direct links if we have a stored URL
      if (fallbackUrl) {
        const candidates = getDocumentLinks(fallbackUrl);
        if (candidates.length > 0) {
          window.open(candidates[0].url, '_blank', 'noopener,noreferrer');
          return;
        }
      }
      setError(err instanceof Error ? err.message : 'Failed to open document.');
    }
  };

  // Delegates: fetch faculty list for modal
  const openDelegatesModal = async () => {
    try {
      setDelegatesLoading(true);
      const token = localStorage.getItem('token');
      if (!token) { router.push('/login'); return; }
      const res = await fetch(`${API_URL}/api/hod-admin/delegates`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await readJson(res);
      if (!res.ok) throw new Error(data.error || 'Failed to load delegates.');
      setFacultyList(data.faculty || []);
      setShowDelegatesModal(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load delegates.');
    } finally {
      setDelegatesLoading(false);
    }
  };

  const toggleDelegate = async (userId: number, makeDelegate: boolean) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) { router.push('/login'); return; }
      const res = await fetch(`${API_URL}/api/hod-admin/delegates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ userId, makeDelegate })
      });
      const data = await readJson(res);
      if (!res.ok) throw new Error(data.error || 'Failed to update delegate.');
      // Update local modal list
      setFacultyList(prev => prev.map(f => f.user_id === userId ? { ...f, is_verification_delegate: data.is_verification_delegate } : f));
      // Also update roster if loaded
      setRoster(prev => prev.map(u => u.user_id === userId ? { ...u, is_verification_delegate: data.is_verification_delegate } : u));
      setMessage(data.message || 'Updated');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update delegate.');
    }
  };

  // Pagination/Filter states
  const [currentPage, setCurrentPage] = useState(1);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('active'); // Default filter to see active users
  const LIMIT = 20;

  const totalPages = Math.ceil(rosterTotal / LIMIT);
  const offset = (currentPage - 1) * LIMIT;

  // --- FETCH DATA FUNCTIONS ---
  const fetchRoster = useCallback(async (newOffset: number, currentSearch: string, roleF: string, statusF: string) => {
      setLoading(true);
      try {
          const token = localStorage.getItem('token');
          if (!token) { router.push('/login'); return; }
          const authHeader = { 'Authorization': `Bearer ${token}` };

          const params = new URLSearchParams({
              limit: LIMIT.toString(),
              offset: newOffset.toString(),
              search: currentSearch,
              roleFilter: roleF,
              statusFilter: statusF,
          }).toString();

      const res = await fetch(`${API_URL}/api/hod-admin/department-roster?${params}`, { headers: authHeader });
      const data = await readJson(res);
      if (!res.ok) throw new Error(data.error || 'Failed to fetch department roster.');
          setRoster(data.users);
          setRosterTotal(data.total);

    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error connecting to server.');
      } finally {
          setLoading(false);
      }
  }, [router]);

  const fetchQueueAndDeps = useCallback(async () => {
    setLoading(true);
    clearMessages();
    try {
      const token = localStorage.getItem('token');
      if (!token) { router.push('/login'); return; }
      const authHeader = { 'Authorization': `Bearer ${token}` };

      // Fetch Alumni Queue
  const queueRes = await fetch(`${API_URL}/api/hod-admin/alumni-queue`, { headers: authHeader });
  const queueData = await readJson(queueRes);
  if (!queueRes.ok) throw new Error(queueData.error || 'Failed to fetch alumni queue.');
      setQueue(queueData);

      // Fetch Departments for the 'Transfer' option
      // Prefer HOD-friendly endpoint (works for HOD and College Admin)
      let deptData: Department[] = [];
      const hodDeptRes = await fetch(`${API_URL}/api/hod-admin/departments`, { headers: authHeader });
      if (hodDeptRes.ok) {
        const json: Department[] = await readJson(hodDeptRes);
        deptData = json;
      } else {
        // Fallback to College Admin endpoint (in case of admin role)
        const adminDeptRes = await fetch(`${API_URL}/api/college-admin/departments`, { headers: authHeader });
        const adminDeptData: Array<{ department_id: number; name: string } & Record<string, unknown>> = await readJson(adminDeptRes);
        if (!adminDeptRes.ok) throw new Error('Failed to fetch departments for transfer.');
        deptData = adminDeptData.map((d) => ({ department_id: d.department_id, name: d.name }));
      }
      // Normalize structure
      setDepartments(deptData.map((d) => ({ department_id: d.department_id, name: d.name })));

    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error connecting to server.');
    } finally {
      setLoading(false);
    }
  }, [router, clearMessages]);

  // --- EFFECTS & HELPERS ---
  // Load initial data
  useEffect(() => {
    fetchQueueAndDeps();
  }, [fetchQueueAndDeps]);

  // Load roster when page or filters change
  useEffect(() => {
    fetchRoster(offset, search, roleFilter, statusFilter);
  }, [offset, search, roleFilter, statusFilter, fetchRoster]);

  // Map Department IDs to Names for display purposes
  // Map Department IDs to Names (reserved for future UI use)
  // const departmentMap = useMemo(() => {
  //   return departments.reduce((acc, dept) => {
  //       acc[dept.department_id] = dept.name;
  //       return acc;
  //   }, {} as Record<number, string>);
  // }, [departments]);

  // --- ACTION HANDLERS ---

  const handleUserAction = async (userId: number) => {
    clearMessages();
    if (!confirm(`Are you sure you want to suspend this user? They will lose access to the platform.`)) return;

    try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_URL}/api/hod-admin/suspend-user`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ userId }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to suspend user.');

        setMessage(data.message);
        fetchRoster(offset, search, roleFilter, statusFilter); // Refresh current view
  } catch (err: unknown) {
    setError(err instanceof Error ? err.message : 'Failed to suspend user.');
    }
  };

  const handleVerificationAction = async (userId: number, action: 'approve' | 'reject' | 'transfer') => {
    clearMessages();
  type VerifyPayload = { userId: number; actionType: 'approve' | 'reject' | 'transfer'; newDeptId?: number; rejectionReason?: string };
  const payload: VerifyPayload = { userId, actionType: action };
    let reason = '';
    let newDeptId = null;
    let confirmText = '';

    if (action === 'reject') {
      reason = prompt('Enter rejection reason (optional):') || '';
  (payload as VerifyPayload).rejectionReason = reason;
      confirmText = 'Reject this alumnus? They will be notified.';
    } else if (action === 'transfer') {
      // Present the HOD with a list of department names for better UX
      const deptList = departments.map(d => `${d.department_id}: ${d.name}`).join('\n');
      const deptInput = prompt(`Enter the ID of the department to transfer to:\n\n${deptList}`);
      if (!deptInput) return;

      const deptIdNum = parseInt(deptInput);
      const targetDept = departments.find(d => d.department_id === deptIdNum);

      if (!targetDept) {
          setError("Invalid Department ID entered.");
          return;
      }

      newDeptId = deptIdNum;
  (payload as VerifyPayload).newDeptId = newDeptId;
      confirmText = `Transfer this alumnus to ${targetDept.name}?`;
    } else if (action === 'approve') {
      confirmText = 'Approve and activate this alumnus?';
    }

    if (!confirm(confirmText)) return;

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/hod-admin/verify-alumnus`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Failed to perform ${action}.`);

      setMessage(data.message);
      fetchQueueAndDeps(); // Refresh the list

    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : `Failed to perform ${action}.`);
    }
  };

  // --- UI RENDERING ---
  const renderDepartmentRoster = () => (
    <div className="space-y-6">
        <h3 className="text-xl font-bold">Department Roster ({rosterTotal} total)</h3>

        {/* Filters and Search */}
        <div className="flex flex-col md:flex-row gap-4 items-center p-4 bg-white dark:bg-gray-800 rounded-lg shadow-sm">

            {/* Search Bar */}
            <div className="relative w-full md:w-1/3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                    type="text"
                    placeholder="Search by name..."
                    className="w-full pl-10 pr-4 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                    value={search}
                    onChange={(e) => {
                        setSearch(e.target.value);
                        setCurrentPage(1); // Reset to page 1 on search
                    }}
                />
            </div>

            {/* Role Filter */}
            <select 
                value={roleFilter} 
                onChange={(e) => { setRoleFilter(e.target.value); setCurrentPage(1); }}
                className="w-full md:w-1/4 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
            >
                <option value="all">Filter by Role (All)</option>
                <option value="Student">Student</option>
                <option value="Faculty">Faculty</option>
                <option value="Alumni">Alumni</option>
            </select>

            {/* Status Filter - Default is active. Let's add 'all' */}
            <select 
                value={statusFilter} 
                onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
                className="w-full md:w-1/4 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
            >
                <option value="all">Filter by Status (All)</option>
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
            </select>
        </div>

        {/* Roster List */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md divide-y dark:divide-gray-700">
            {loading && <p className="p-4 text-center">Loading users...</p>}
            {!loading && roster.length === 0 && <p className="p-4 text-center">No users match your criteria.</p>}

            {roster.map((user) => (
                <div key={user.user_id} className="p-4 flex justify-between items-center hover:bg-gray-50 dark:hover:bg-gray-700">
                    {/* User Info */}
                    <div>
                        <p className="font-semibold">{user.full_name} <span className={`text-xs font-medium ${user.status === 'active' ? 'text-green-600' : 'text-red-600'}`}>[{user.status.toUpperCase()}]</span></p>
                        <p className="text-sm text-gray-500">{user.official_email || user.personal_email}</p>
                        <p className="text-xs text-indigo-500 flex items-center gap-2">
                          <span>{user.role}</span>
                          {user.is_verification_delegate && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-200">Delegate</span>
                          )}
                        </p>
                    </div>

                    {/* Actions */}
                    <button
                        onClick={() => handleUserAction(user.user_id)}
                        disabled={user.status === 'suspended'}
                        className="flex items-center gap-1 text-red-500 hover:text-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Trash2 className="w-4 h-4" />
                        {user.status === 'suspended' ? 'Suspended' : 'Suspend'}
                    </button>
                </div>
            ))}
        </div>

        {/* Pagination Controls */}
        {rosterTotal > LIMIT && (
            <div className="flex justify-between items-center mt-4 p-4 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
                <button
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="flex items-center gap-1 text-indigo-600 disabled:text-gray-400"
                >
                    <ChevronLeft className="w-5 h-5" /> Previous
                </button>
                <span className="text-sm">Page {currentPage} of {totalPages}</span>
                <button
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className="flex items-center gap-1 text-indigo-600 disabled:text-gray-400"
                >
                    Next <ChevronRight className="w-5 h-5" />
                </button>
            </div>
        )}
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white">
      {/* HOD Navbar (Same as before) */}
      <nav className="flex justify-between items-center p-4 px-8 bg-white border-b border-gray-200 dark:bg-gray-800 dark:border-gray-700">
        <h1 className="text-xl font-bold text-amber-600 dark:text-amber-400">
          HOD Verification Panel
        </h1>
        <div className="flex items-center gap-4">
          <button 
            onClick={() => router.push('/home')}
            className="text-sm font-medium text-gray-700 hover:text-indigo-600 dark:text-gray-300 dark:hover:text-indigo-400"
          >
            ← Back to Main
          </button>
          <ThemeSwitcher />
        </div>
      </nav>

      {/* Page Content */}
      <div className="p-8 max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* COLUMN 1: Verification Queue */}
        <div className="lg:col-span-1 space-y-6">
            <h2 className="mb-4 text-2xl font-bold">Alumni Verification Queue ({queue.length})</h2>
            {loading && <p>Loading queue...</p>}
            {!loading && queue.length === 0 && <p className="text-gray-600 dark:text-gray-400">No alumni pending verification.</p>}

            {/* List of pending alumni */}
            <div className="space-y-4">
                {queue.map((alumnus) => (
                  <div key={alumnus.user_id} className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md border border-amber-300 dark:border-amber-700">
                    {/* Details and Actions */}
                    <div>
                      <h3 className="text-base font-bold">{alumnus.full_name} <span className="text-sm font-medium text-amber-600 dark:text-amber-400">[PENDING]</span></h3>
                      <p className="text-xs text-gray-500">Grad Year: {alumnus.graduation_year || 'N/A'}</p>
                      {alumnus.institute_roll_number && (
                        <p className="text-xs text-gray-500">Roll No: {alumnus.institute_roll_number}</p>
                      )}
                      <p className="text-xs text-gray-500">Email: {alumnus.personal_email}</p>
                      {alumnus.verification_document_url && (
                        <div className="flex flex-wrap gap-3 mt-1">
                          {getDocumentLinks(alumnus.verification_document_url).map((l, idx) => (
                            <a
                              key={idx}
                              href={l.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-indigo-600 dark:text-indigo-400 underline"
                            >
                              {idx === 0 ? 'View Verification Document' : l.label}
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="mt-3 flex gap-2 justify-end">
                      <button
                        onClick={() => openDocumentAuto(alumnus.user_id, alumnus.verification_document_url)}
                        className="bg-blue-600 text-white px-3 py-1 rounded-md hover:bg-blue-700 text-xs"
                      >
                        Open Document (auto)
                      </button>
                      <button
                        onClick={async () => {
                          try {
                            const token = localStorage.getItem('token');
                            if (!token) { router.push('/login'); return; }
                            const resp = await fetch(`${API_URL}/api/hod-admin/document/${alumnus.user_id}`, {
                              headers: { 'Authorization': `Bearer ${token}` }
                            });
                            if (!resp.ok) {
                              const txt = await resp.text();
                              throw new Error(`Proxy fetch failed (${resp.status}). ${txt.slice(0, 200)}`);
                            }
                            const blob = await resp.blob();
                            const url = URL.createObjectURL(blob);
                            window.open(url, '_blank', 'noopener,noreferrer');
                          } catch (e) {
                            setError(e instanceof Error ? e.message : 'Proxy document download failed.');
                          }
                        }}
                        className="bg-indigo-600 text-white px-3 py-1 rounded-md hover:bg-indigo-700 text-xs"
                      >
                        Download via Proxy
                      </button>
                        <button
                          onClick={() => handleVerificationAction(alumnus.user_id, 'reject')}
                          className="bg-red-600 text-white px-3 py-1 rounded-md hover:bg-red-700 text-xs"
                        >
                          Reject
                        </button>
                        <button
                          onClick={() => handleVerificationAction(alumnus.user_id, 'approve')}
                          className="bg-green-600 text-white px-3 py-1 rounded-md hover:bg-green-700 text-xs"
                        >
                          Approve
                        </button>
                    </div>
                  </div>
                ))}
            </div>

            <h2 className="mt-8 mb-4 text-2xl font-bold">Department Tools</h2>
      <button 
        onClick={openDelegatesModal}
        className="w-full bg-indigo-500 text-white p-3 rounded-lg hover:bg-indigo-600"
      >
        Manage Verification Delegates
      </button>
        </div>

        {/* COLUMN 2: Department Roster (Main Management Area) */}
        <div className="lg:col-span-2 space-y-6">
            {renderDepartmentRoster()}
        </div>

        {/* Delegates Modal */}
        {showDelegatesModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="w-full max-w-2xl bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Manage Verification Delegates</h3>
                <button onClick={() => setShowDelegatesModal(false)} className="text-gray-500 hover:text-gray-700">✕</button>
              </div>
              {delegatesLoading ? (
                <p>Loading...</p>
              ) : (
                <div className="divide-y dark:divide-gray-700">
                  {facultyList.length === 0 && (
                    <p className="text-sm text-gray-600 dark:text-gray-400">No faculty found in your department.</p>
                  )}
                  {facultyList.map(f => (
                    <div key={f.user_id} className="py-3 flex items-center justify-between">
                      <div>
                        <p className="font-medium">{f.full_name}</p>
                        <p className="text-xs text-gray-500">{f.official_email}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        {f.is_verification_delegate && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-200">Delegate</span>
                        )}
                        <button
                          onClick={() => toggleDelegate(f.user_id, !f.is_verification_delegate)}
                          className={`px-3 py-1 rounded-md ${f.is_verification_delegate ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'} text-white text-sm`}
                        >
                          {f.is_verification_delegate ? 'Remove' : 'Assign'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-4 text-right">
                <button onClick={() => setShowDelegatesModal(false)} className="px-4 py-2 rounded-md bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600">Close</button>
              </div>
            </div>
          </div>
        )}

        {/* Messages */}
        <ToastNotification message={message} error={error} clearMessages={clearMessages} />

      </div>
    </div>
  );
}