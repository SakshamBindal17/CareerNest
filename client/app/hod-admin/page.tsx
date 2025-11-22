// src/app/hod-admin/page.tsx
'use client'

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import ToastNotification from '@/components/ToastNotification';
import { ChevronLeft, ChevronRight, Search, Trash2, Users, UserCheck, UserCog, Hourglass } from 'lucide-react';

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
  const [studentCount, setStudentCount] = useState(0);
  const [facultyCount, setFacultyCount] = useState(0);
  const [verifiedAlumniCount, setVerifiedAlumniCount] = useState(0);
  const [pendingAlumniCount, setPendingAlumniCount] = useState(0);

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

          // Derive simple role-based stats from current page plus total where possible
          const students = data.users.filter((u: UserRosterItem) => u.role === 'Student').length;
          const faculty = data.users.filter((u: UserRosterItem) => u.role === 'Faculty').length;
          const verifiedAlumni = data.users.filter((u: UserRosterItem) => u.role === 'Alumni' && u.status === 'active').length;
          setStudentCount(students);
          setFacultyCount(faculty);
          setVerifiedAlumniCount(verifiedAlumni);

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
      setPendingAlumniCount(Array.isArray(queueData) ? queueData.length : 0);

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
  type VerifyPayload = { userId: number; actionType: 'approve' | 'reject' | 'transfer'; newDeptId?: number };
  const payload: VerifyPayload = { userId, actionType: action };
    let newDeptId = null;
    let confirmText = '';

    if (action === 'transfer') {
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

  // Rejection modal state & handlers
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectUserId, setRejectUserId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const openRejectModal = (userId: number) => {
    setRejectUserId(userId);
    setRejectReason('');
    setShowRejectModal(true);
  };

  const submitReject = async () => {
    if (rejectUserId == null) return;
    clearMessages();
    try {
      const token = localStorage.getItem('token');
      if (!token) { router.push('/login'); return; }
      const payload = {
        userId: rejectUserId,
        actionType: 'reject',
        rejectionReason: rejectReason.trim() || ''
      };
      const res = await fetch(`${API_URL}/api/hod-admin/verify-alumnus`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to reject alumnus.');
      setMessage(data.message);
      setShowRejectModal(false);
      setRejectUserId(null);
      fetchQueueAndDeps();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reject alumnus.');
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
          {/* ThemeSwitcher removed */}
        </div>
      </nav>

      {/* Page Content */}
      <div className="p-8 max-w-7xl mx-auto space-y-8">

        {/* Top Stats Widget with Icon Badges */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Total Students"
            value={studentCount}
            icon={<Users className="w-5 h-5" />}
            accent="emerald"
          />
          <StatCard
            label="Total Faculty"
            value={facultyCount}
            icon={<UserCog className="w-5 h-5" />}
            accent="indigo"
          />
          <StatCard
            label="Verified Alumni"
            value={verifiedAlumniCount}
            icon={<UserCheck className="w-5 h-5" />}
            accent="sky"
          />
          <StatCard
            label="Pending Alumni"
            value={pendingAlumniCount}
            icon={<Hourglass className="w-5 h-5" />}
            accent="amber"
          />
        </section>

        {/* Main Columns */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* COLUMN 1: Verification Queue (compact, scrollable) with tools beneath */}
        <div className="lg:col-span-1 space-y-4">
            <h2 className="text-2xl font-bold flex items-center justify-between">
              <span>Alumni Verification Queue</span>
              <span className="text-sm font-semibold text-amber-500">{queue.length} pending</span>
            </h2>
            {loading && <p>Loading queue...</p>}
            {!loading && queue.length === 0 && <p className="text-gray-600 dark:text-gray-400">No alumni pending verification.</p>}

            {/* List of pending alumni (scrollable widget) */}
            <div className="space-y-4 max-h-80 overflow-y-auto pr-1">
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
                      {/* Removed duplicate document links; single button row below now handles view */}
                    </div>
                    <div className="mt-3 flex gap-2 justify-end">
                      <a
                        href={alumnus.verification_document_url || '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-blue-600 text-white px-3 py-1 rounded-md hover:bg-blue-700 text-xs"
                      >
                        View Verification Document
                      </a>
                      <button
                        onClick={() => openRejectModal(alumnus.user_id)}
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

            {/* Department Tools under alumni verification section */}
            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
              <h2 className="mb-3 text-xl font-bold">Department Tools</h2>
              <button 
                onClick={openDelegatesModal}
                className="w-full bg-indigo-500 text-white p-3 rounded-lg hover:bg-indigo-600"
              >
                Manage Verification Delegates
              </button>
            </div>
        </div>

        {/* COLUMN 2: Department Roster (Main Management Area) */}
        <div className="lg:col-span-2 space-y-6">
            {renderDepartmentRoster()}
        </div>

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

        {showRejectModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Reject Alumnus</h3>
                <button onClick={() => setShowRejectModal(false)} className="text-gray-500 hover:text-gray-700">✕</button>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">Optional: provide a reason to include in the email.</p>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={4}
                placeholder="Reason for rejection (optional)"
                className="w-full rounded-md border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm dark:bg-gray-700 dark:text-white"
              />
              <div className="flex justify-end gap-3 mt-4">
                <button
                  onClick={() => setShowRejectModal(false)}
                  className="px-4 py-2 rounded-md bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-sm"
                >Cancel</button>
                <button
                  onClick={submitReject}
                  className="px-4 py-2 rounded-md bg-red-600 hover:bg-red-700 text-white text-sm"
                >Reject</button>
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

// Lightweight stat card component (placed at file end for simplicity)
function StatCard({
  label,
  value,
  icon,
  accent
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  accent: 'emerald' | 'indigo' | 'sky' | 'amber';
}) {
  const accentMap: Record<string, { ring: string; text: string; bg: string }> = {
    emerald: { ring: 'ring-emerald-400/40', text: 'text-emerald-500', bg: 'bg-emerald-500/10' },
    indigo: { ring: 'ring-indigo-400/40', text: 'text-indigo-500', bg: 'bg-indigo-500/10' },
    sky: { ring: 'ring-sky-400/40', text: 'text-sky-500', bg: 'bg-sky-500/10' },
    amber: { ring: 'ring-amber-400/40', text: 'text-amber-500', bg: 'bg-amber-500/10' }
  };

  const colors = accentMap[accent];

  return (
    <div className={`relative rounded-lg bg-white dark:bg-gray-800 shadow-sm border border-gray-200 dark:border-gray-700 p-4 overflow-hidden group`}>      
      <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-br from-gray-50/0 to-gray-200/10 dark:from-gray-800/0 dark:to-gray-700/20`} />
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] font-semibold tracking-wider uppercase text-gray-500 dark:text-gray-400">{label}</p>
          <p className={`mt-1 text-2xl font-bold ${colors.text}`}>{value}</p>
        </div>
        <div className={`flex items-center justify-center w-10 h-10 rounded-full ${colors.bg} ${colors.text} ring-2 ${colors.ring}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}