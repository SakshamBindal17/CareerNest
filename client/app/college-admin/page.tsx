// src/app/college-admin/page.tsx
'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import ToastNotification from '@/components/ToastNotification';
import { API_URL } from '@/utils/api';


type Department = {
  department_id: number;
  name: string;
  dept_code: string; 
  hod_name: string;
  hod_email: string;
  hod_status: 'active' | 'pending_invite' | null; 
  stats?: { students: number; alumni: number; faculty: number };
};
type Domain = {
  domain_id: number;
  domain: string;
};
type StatsOverview = {
  totalStudents: number;
  totalAlumni: number;
  totalFaculty: number;
  totalHods: number;
};
type DeptStats = {
  [key: number]: { students: number; alumni: number; faculty: number };
};

// --- CSV HELPER FUNCTION ---
const convertToCSV = (data: any[]) => {
  const header = Object.keys(data[0]);
  const rows = data.map(obj => header.map(fieldName => JSON.stringify(obj[fieldName] || '')).join(','));
  return [header.join(','), ...rows].join('\n');
};
// --- END CSV HELPER ---

// --- MODIFIED DashboardStats Component (Accepts the new handler) ---
const DashboardStats = ({ stats, departments, domains, handleDownloadReport }: { stats: StatsOverview, departments: Department[], domains: Domain[], handleDownloadReport: () => void }) => {
  const activeHods = departments.filter(d => d.hod_status === 'active').length;
  const pendingHods = departments.filter(d => d.hod_status !== 'active').length;
  const totalUsers = stats.totalStudents + stats.totalAlumni + stats.totalFaculty + stats.totalHods;

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow-md text-center">
          <h3 className="text-3xl font-bold text-indigo-500">{totalUsers}</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">Total Active Users</p>
        </div>
        <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow-md text-center">
          <h3 className="text-3xl font-bold">{departments.length}</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">Total Departments</p>
        </div>
        <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow-md text-center">
          <h3 className="text-3xl font-bold text-green-500">{activeHods}</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">Active HODs</p>
        </div>
        <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow-md text-center">
          <h3 className="text-3xl font-bold text-amber-500">{pendingHods}</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">Pending HODs</p>
        </div>
        <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow-md text-center">
          <h3 className="text-3xl font-bold">{domains.length}</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">Email Domains</p>
        </div>
        <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow-md text-center">
          <h3 className="text-3xl font-bold">{stats.totalStudents}</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">Students</p>
        </div>
        <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow-md text-center">
          <h3 className="text-3xl font-bold">{stats.totalAlumni}</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">Alumni</p>
        </div>
        <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow-md text-center">
          <h3 className="text-3xl font-bold">{stats.totalFaculty}</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">Faculty</p>
        </div>
      </div>

      {/* --- NEW: Download Button --- */}
      <div className="mb-8 flex justify-end">
         <button
            onClick={handleDownloadReport} // <-- BUTTON NOW CALLS THE FUNCTION
            className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 flex items-center gap-2"
            disabled={totalUsers === 0}
          >
            Download Full User Report ({totalUsers})
          </button>
      </div>
    </>
  );
};

export default function CollegeAdminDashboard() {
  const router = useRouter();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [stats, setStats] = useState<StatsOverview>({ totalStudents: 0, totalAlumni: 0, totalFaculty: 0, totalHods: 0 });
  const [collegeName, setCollegeName] = useState('Loading...');
  const [deptName, setDeptName] = useState('');
  const [deptCode, setDeptCode] = useState(''); 
  const [hodName, setHodName] = useState('');
  const [hodEmail, setHodEmail] = useState('');
  const [newDomain, setNewDomain] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'active' | 'pending'>('all');

  const clearMessages = () => {
    setError(null);
    setMessage(null);
  };

  const fetchData = async () => { /* ... (fetchData is the same) ... */ 
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/login');
        return;
      }
      const authHeader = { 'Authorization': `Bearer ${token}` };

      const [deptRes, domainRes, statsRes] = await Promise.all([
        fetch(`${API_URL}/api/college-admin/departments`, { headers: authHeader }),
        fetch(`${API_URL}/api/college-admin/domains`, { headers: authHeader }),
        fetch(`${API_URL}/api/college-admin/stats`, { headers: authHeader })
      ]);

      if (!deptRes.ok) throw new Error('Failed to fetch departments.');
      if (!domainRes.ok) throw new Error('Failed to fetch domains.');
      if (!statsRes.ok) throw new Error('Failed to fetch stats.');

      const deptData: Department[] = await deptRes.json();
      const domainData: Domain[] = await domainRes.json();
      const statsData: { collegeName: string, overview: StatsOverview, byDepartment: DeptStats } = await statsRes.json();

      const combinedDepts = deptData.map(dept => ({
        ...dept,
        stats: statsData.byDepartment[dept.department_id] || { students: 0, alumni: 0, faculty: 0 }
      }));

      setDepartments(combinedDepts);
      setDomains(domainData);
      setStats(statsData.overview);
      setCollegeName(statsData.collegeName); 

    } catch (err: any) {
      setError(err.message);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleLogout = () => {
    if (confirm('Are you sure you want to log out?')) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      router.push('/login');
    }
  };

  // --- NEW: Download Handler Function ---
  const handleDownloadReport = async () => {
    setError(null); setMessage(null);
    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('Authentication required.');

      setMessage('Generating report...'); // Show a temporary message

      const res = await fetch(`${API_URL}/api/college-admin/report`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!res.ok) throw new Error('Failed to fetch report data.');

      const data = await res.json();

      if (data.list.length === 0) {
        setMessage('No users registered to download a report.');
        return;
      }

      // 1. Convert the JSON array to a CSV string
      const csvString = convertToCSV(data.list);

      // 2. Create a Blob and a temporary download link
      const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');

      // 3. Trigger the download
      link.setAttribute('href', url);
      link.setAttribute('download', `${collegeName.replace(/\s/g, '_')}_User_Report_${new Date().toLocaleDateString()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setMessage('User report download successfully initiated!');

    } catch (err: any) {
      setError(err.message || 'Error initiating download.');
    }
  };

  // --- (All other handlers are the same) ---
  const handleAddDomain = async (e: React.FormEvent) => { 
    e.preventDefault();
    setError(null); setMessage(null);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/college-admin/domains`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`},
        body: JSON.stringify({ domain: newDomain }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add domain.');
      setNewDomain('');
      fetchData();
      setMessage('Domain added successfully!');
    } catch (err: any) {
      setError(err.message);
    }
  };
  const handleDeleteDomain = async (domainId: number) => { 
    if (!confirm('Are you sure you want to delete this domain?')) return;
    setError(null); setMessage(null);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/college-admin/domains/${domainId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete domain.');
      fetchData();
      setMessage('Domain deleted successfully!');
    } catch (err: any) {
      setError(err.message);
    }
  };
  const handleAddDepartment = async (e: React.FormEvent) => { 
    e.preventDefault();
    setError(null); setMessage(null);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/college-admin/departments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          departmentName: deptName,
          deptCode: deptCode, 
          hodName: hodName,
          hodEmail: hodEmail
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add department.');

      setDeptName('');
      setDeptCode('');
      setHodName('');
      setHodEmail('');
      fetchData();
      setMessage('Department added and HOD invite sent!');
    } catch (err: any) {
      setError(err.message);
    }
  };
  const handleEditDepartmentName = async (dept: Department) => { 
    setError(null); setMessage(null);
    const newName = prompt("Enter the new name for the department:", dept.name);

    if (!newName || newName === dept.name) return;

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/college-admin/departments/${dept.department_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`},
        body: JSON.stringify({ newName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to edit department.');
      fetchData();
      setMessage('Department name updated!');
    } catch (err: any) {
      setError(err.message);
    }
  };
  const handleChangeHod = async (dept: Department) => { 
    setError(null); setMessage(null);
    const newHodName = prompt("Enter the NEW HOD's Full Name:");
    if (!newHodName) return;
    const newHodEmail = prompt(`Enter ${newHodName}'s OFFICIAL Email:`);
    if (!newHodEmail) return;
    if (!confirm(`Are you sure you want to assign ${newHodName} as the new HOD for ${dept.name}? This will create a new user and send them an invite.`)) {
      return;
    }
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/college-admin/change-hod`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`},
        body: JSON.stringify({ 
          departmentId: dept.department_id,
          hodName: newHodName,
          hodEmail: newHodEmail
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to change HOD.');
      fetchData(); 
      setMessage(data.message);
    } catch (err: any) {
      setError(err.message);
    }
  };
  const handleDeleteDepartment = async (dept: Department) => { 
    setError(null); setMessage(null);
    if (!confirm(`Are you sure you want to DELETE "${dept.name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/college-admin/departments/${dept.department_id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete department.');

      fetchData(); 
      setMessage(data.message);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const filteredDepartments = useMemo(() => {
    if (filter === 'all') return departments;
    if (filter === 'active') return departments.filter(d => d.hod_status === 'active');
    if (filter === 'pending') return departments.filter(d => d.hod_status !== 'active');
    return departments;
  }, [departments, filter]);


  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white">
      <nav className="flex justify-between items-center p-4 px-8 bg-white border-b border-gray-200 dark:bg-gray-800 dark:border-gray-700">
        {/* ThemeSwitcher removed */}
        <div className="text-center">
          <h1 className="text-xl font-bold text-indigo-600 dark:text-indigo-400">
            {collegeName}
          </h1>
        </div>
        <div>
          <button onClick={handleLogout} className="text-sm font-medium text-gray-700 hover:text-indigo-600 dark:text-gray-300 dark:hover:text-indigo-400">
            Logout
          </button>
        </div>
      </nav>

      <div className="p-8 max-w-6xl mx-auto">

        <h2 className="text-3xl font-bold mb-6 text-center">
          College Admin Dashboard
        </h2>

        <DashboardStats stats={stats} departments={departments} domains={domains} handleDownloadReport={handleDownloadReport} />

        <div className="mb-6 space-y-4">
          {error && <div className="p-4 bg-red-100 text-red-700 rounded-md dark:bg-red-900 dark:text-red-200">{error}</div>}
          {message && <div className="p-4 bg-green-100 text-green-700 rounded-md dark:bg-green-900 dark:text-green-200">{message}</div>}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* --- LEFT COLUMN: DEPARTMENTS --- */}
          <div className="space-y-6">
            <h2 className="text-3xl font-bold">Manage Departments</h2>

            <form onSubmit={handleAddDepartment} className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md space-y-4">
              <h3 className="text-lg font-semibold">Add New Department</h3>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Department ID (e.g., "101")</label>
                <input type="number" required className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 dark:bg-gray-700 dark:text-white dark:border-gray-600" value={deptCode} onChange={(e) => setDeptCode(e.target.value)} placeholder="e.g. 101 for CSE"/>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Department Name</label>
                <input type="text" required className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 dark:bg-gray-700 dark:text-white dark:border-gray-600" value={deptName} onChange={(e) => setDeptName(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">HOD Full Name</label>
                <input type="text" required className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 dark:bg-gray-700 dark:text-white dark:border-gray-600" value={hodName} onChange={(e) => setHodName(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">HOD Official Email</label>
                <input type="email" required className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 dark:bg-gray-700 dark:text-white dark:border-gray-600" value={hodEmail} onChange={(e) => setHodEmail(e.target.value)} />
              </div>
              <button type="submit" className="w-full flex justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700">
                Create Department & Send HOD Invite
              </button>
            </form>

            <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md">
              <h3 className="text-lg font-semibold mb-4">Existing Departments</h3>

              <div className="flex space-x-2 mb-4">
                <button onClick={() => setFilter('all')} className={`px-3 py-1 rounded-md text-sm ${filter === 'all' ? 'bg-indigo-600 text-white' : 'bg-gray-200 dark:bg-gray-700'}`}>
                  All ({departments.length})
                </button>
                <button onClick={() => setFilter('active')} className={`px-3 py-1 rounded-md text-sm ${filter === 'active' ? 'bg-green-600 text-white' : 'bg-gray-200 dark:bg-gray-700'}`}>
                  Active HODs ({departments.filter(d => d.hod_status === 'active').length})
                </button>
                <button onClick={() => setFilter('pending')} className={`px-3 py-1 rounded-md text-sm ${filter === 'pending' ? 'bg-amber-600 text-white' : 'bg-gray-200 dark:bg-gray-700'}`}>
                  Pending HODs ({departments.filter(d => d.hod_status !== 'active').length})
                </button>
              </div>

              <div className="space-y-3">
                {loading ? <p>Loading...</p> : filteredDepartments.map((dept) => (
                  <div key={dept.department_id} className="p-3 border dark:border-gray-700 rounded-md">
                    <div className="flex justify-between items-center gap-4">
                      <div className="min-w-0">
                        <p className="font-bold break-words">{dept.name} ({dept.dept_code})</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400 break-words">
                          HOD: {dept.hod_name} ({dept.hod_email})
                        </p>
                        {dept.hod_status === 'active' ? (
                          <span className="text-xs font-medium text-green-500">✓ HOD Active</span>
                        ) : (
                          <span className="text-xs font-medium text-amber-500">! HOD Pending Invite</span>
                        )}
                      </div>
                      <div className="flex flex-col gap-2 items-end flex-shrink-0">
                        <button onClick={() => handleEditDepartmentName(dept)} className="text-indigo-500 hover:text-indigo-700 text-sm font-medium">
                          Edit Name
                        </button>
                        <button onClick={() => handleChangeHod(dept)} className="text-amber-500 hover:text-amber-700 text-sm font-medium">
                          Change HOD
                        </button>
                        <button onClick={() => handleDeleteDepartment(dept)} className="text-red-500 hover:text-red-700 text-sm font-medium">
                          Delete
                        </button>
                      </div>
                    </div>
                    <div className="flex justify-around pt-2 mt-2 border-t dark:border-gray-700">
                       <div className="text-center">
                         <span className="font-bold">{dept.stats?.students || 0}</span>
                         <p className="text-xs text-gray-500">Students</p>
                       </div>
                       <div className="text-center">
                         <span className="font-bold">{dept.stats?.alumni || 0}</span>
                         <p className="text-xs text-gray-500">Alumni</p>
                       </div>
                       <div className="text-center">
                         <span className="font-bold">{dept.stats?.faculty || 0}</span>
                         <p className="text-xs text-gray-500">Faculty</p>
                       </div>
                    </div>
                  </div>
                ))}
                {filteredDepartments.length === 0 && !loading && <p>No departments found for this filter.</p>}
              </div>
            </div>
          </div>

          {/* --- RIGHT COLUMN: DOMAINS --- */}
          <div className="space-y-6">
            <h2 className="text-3xl font-bold">Manage Email Domains</h2>
            <form onSubmit={handleAddDomain} className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md space-y-4">
              <h3 className="text-lg font-semibold">Add New Verification Domain</h3>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Domain (e.g., dcrustm.org)</label>
                <input type="text" required className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 dark:bg-gray-700 dark:text-white dark:border-gray-600" value={newDomain} onChange={(e) => setNewDomain(e.target.value)} placeholder="dcrustm.org" />
              </div>
              <button type="submit" className="w-full flex justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700">
                Add Domain
              </button>
            </form>
            <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md">
              <h3 className="text-lg font-semibold mb-4">Active Domains</h3>
              <div className="space-y-3">
                {loading ? <p>Loading...</p> : domains.map((dom) => (
                  <div key={dom.domain_id} className="p-3 border dark:border-gray-700 rounded-md flex justify-between items-center">
                    <p className="font-mono text-lg">{dom.domain}</p>
                    <button onClick={() => handleDeleteDomain(dom.domain_id)} className="text-red-500 hover:text-red-700 text-sm font-medium">
                      Delete
                    </button>
                  </div>
                ))}
                {domains.length === 0 && !loading && <p>No domains added yet. Students/Faculty cannot sign up.</p>}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* --- 4. ADD THE TOAST COMPONENT --- */}
      <ToastNotification 
        message={message} 
        error={error} 
        clearMessages={clearMessages} 
      />
    </div>
  );
}