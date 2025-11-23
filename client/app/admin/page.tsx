// src/app/admin/page.tsx
'use client'

import React, { useState, useEffect } from 'react'
import AdminStatCard from '@/components/AdminStatCard'
import { useRouter } from 'next/navigation'
import { API_URL } from '@/utils/api';
import { useAuth } from '@/context/UserContext'


type PendingUniversity = {
  request_id: number;
  college_name: string;
  contact_name: string;
  contact_email: string;
  contact_role: string;
  created_at: string;
};

type ActiveUniversity = {
  university_id: number;
  name: string;
  admin_name: string;
  admin_email: string;
  admin_title: string;
  status: string;
  created_at: string;
};

type AdminStats = {
  totalUsers: number;
  roleBreakdown: Record<string, number>;
  totalUniversities: number;
  pendingOnboardingRequests: number;
};

export default function AdminDashboard() {
  const router = useRouter();
  const { user } = useAuth();
  const [activeUniversities, setActiveUniversities] = useState<ActiveUniversity[]>([]);
  const [pendingUniversities, setPendingUniversities] = useState<PendingUniversity[]>([]);
  const [loadingUniversities, setLoadingUniversities] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);

  const fetchAll = async () => {
    setLoadingUniversities(true);
    setLoadingStats(true);
    setError(null);
    const token = localStorage.getItem('token');
    // Ensure headers type satisfies fetch (HeadersInit) – do not create a union with undefined values
    const authHeaders: HeadersInit = token ? { 'Authorization': `Bearer ${token}` } : {};
    try {
      const [activeRes, pendingRes, statsRes] = await Promise.all([
        fetch(`${API_URL}/api/admin/universities?status=active`, { headers: authHeaders }),
        fetch(`${API_URL}/api/admin/universities?status=pending`, { headers: authHeaders }),
        fetch(`${API_URL}/api/admin/stats`, { headers: authHeaders }),
      ]);
      if (!activeRes.ok) throw new Error('Failed to fetch active universities.');
      if (!pendingRes.ok) throw new Error('Failed to fetch pending universities.');
      if (!statsRes.ok) throw new Error('Failed to fetch stats.');
      const activeData = await activeRes.json();
      const pendingData = await pendingRes.json();
      const statsData = await statsRes.json();
      setActiveUniversities(activeData.items || []);
      setPendingUniversities(pendingData.items || []);
      setStats(statsData || null);
    } catch (err: unknown) {
      const messageText = err instanceof Error ? err.message : String(err);
      setError(messageText || 'An error occurred while loading data.');
    } finally {
      setLoadingUniversities(false);
      setLoadingStats(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  // Frontend guard: redirect if not Super Admin
  useEffect(() => {
    if (user && user.role !== 'Super Admin') {
      router.replace('/home');
    }
  }, [user, router]);

  const handleApprove = async (requestId: number) => {
    setError(null);
    setMessage(null);
    if (!confirm('Are you sure you want to APPROVE this request?')) return;
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`${API_URL}/api/admin/approve-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ requestId }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to approve request.');

      setMessage(data.message || 'Request approved');
      await fetchAll();
    } catch (err: unknown) {
      const messageText = err instanceof Error ? err.message : String(err);
      setError(messageText);
    }
  };

  const handleReject = async (requestId: number, rejectionReason: string) => {
    setError(null);
    setMessage(null);
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`${API_URL}/api/admin/reject-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ requestId, rejectionReason }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to reject request.');

      setMessage(data.message || 'Request rejected');
      await fetchAll();
    } catch (err: unknown) {
      const messageText = err instanceof Error ? err.message : String(err);
      setError(messageText);
    }
  };

  const renderRoleBars = () => {
    if (!stats) return null;
    const entries = Object.entries(stats.roleBreakdown || {});
    if (entries.length === 0) return <div className="text-sm text-gray-500 dark:text-gray-400">No active users yet.</div>;
    const max = Math.max(...entries.map(([, v]) => v), 1);
    return (
      <div className="space-y-3">
        {entries.map(([role, count]) => (
          <div key={role} className="flex items-center gap-4">
            <div className="w-28 text-sm text-gray-600 dark:text-gray-400">{role}</div>
            <div className="flex-1 bg-gray-100 dark:bg-gray-700 h-3 rounded overflow-hidden">
              <div className="h-3 rounded bg-red-500" style={{ width: `${(count / max) * 100}%` }} />
            </div>
            <div className="w-12 text-right text-sm font-medium">{count}</div>
          </div>
        ))}
      </div>
    );
  };

  // --- Tabs ---
  const [activeTab, setActiveTab] = useState<'active' | 'pending'>('active');

  // --- Rejection Modal ---
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const openRejectModal = (id: number) => { setRejectTarget(id); setRejectReason(''); setRejectModalOpen(true); };
  const submitReject = async () => {
    if (rejectTarget !== null) {
      await handleReject(rejectTarget, rejectReason);
    }
    setRejectModalOpen(false);
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    router.push('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white">
      <nav className="flex justify-between items-center p-4 px-8 bg-white border-b border-gray-200 dark:bg-gray-800 dark:border-gray-700">
        <div>
          <h1 className="text-xl font-bold text-red-600 dark:text-red-400">Super Admin Dashboard</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">Platform overview & actions</p>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={logout} className="px-3 py-1 rounded-md bg-red-600 text-white text-sm hover:bg-red-700">Logout</button>
        </div>
      </nav>

      <div className="p-8 max-w-6xl mx-auto">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <AdminStatCard title="Total Users" value={loadingStats ? '—' : stats?.totalUsers ?? 0} icon={<span>👥</span>} />
          <AdminStatCard title="Active Users" value={loadingStats ? '—' : Object.values(stats?.roleBreakdown || {}).reduce((s, n) => s + n, 0)} icon={<span>✅</span>} />
          <AdminStatCard title="Universities" value={loadingStats ? '—' : stats?.totalUniversities ?? 0} icon={<span>🏫</span>} />
          <AdminStatCard title="Pending Requests" value={loadingStats ? '—' : stats?.pendingOnboardingRequests ?? 0} icon={<span>⏳</span>} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <section className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md border border-gray-100 dark:border-gray-700">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold">Active Users Breakdown</h2>
                {loadingStats ? <div className="text-sm text-gray-400">Loading…</div> : null}
              </div>
              {renderRoleBars()}
            </section>

            <section className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md border border-gray-100 dark:border-gray-700">
              <div className="flex justify-between items-center mb-6">
                <div className="flex gap-2">
                  <button onClick={() => setActiveTab('active')} className={`px-4 py-2 rounded-md text-sm font-medium ${activeTab==='active' ? 'bg-red-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'}`}>Active Universities</button>
                  <button onClick={() => setActiveTab('pending')} className={`px-4 py-2 rounded-md text-sm font-medium ${activeTab==='pending' ? 'bg-red-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'}`}>Pending Requests</button>
                </div>
                <div className="text-sm text-gray-500">
                  {activeTab === 'active' ? (loadingUniversities ? 'Loading…' : `${activeUniversities.length} active`) : (loadingUniversities ? 'Loading…' : `${pendingUniversities.length} pending`)}
                </div>
              </div>

              {error && <div className="p-3 mb-4 bg-red-100 text-red-700 rounded-md dark:bg-red-900 dark:text-red-200">{error}</div>}
              {message && <div className="p-3 mb-4 bg-green-100 text-green-700 rounded-md dark:bg-green-900 dark:text-green-200">{message}</div>}

              {loadingUniversities ? (
                <p className="text-sm text-gray-500">Loading…</p>
              ) : activeTab === 'active' ? (
                activeUniversities.length === 0 ? <p className="text-sm text-gray-500">No active universities yet.</p> : (
                  <div className="space-y-4">
                    {activeUniversities.map(u => (
                      <div key={u.university_id} className="p-4 rounded-md bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800 flex justify-between items-center">
                        <div>
                          <div className="font-semibold">{u.name}</div>
                          <div className="text-sm text-gray-500">{u.admin_name} — {u.admin_title || 'Admin'}</div>
                          <div className="text-sm text-gray-500">{u.admin_email}</div>
                        </div>
                        <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-700 dark:bg-green-800 dark:text-green-200">{u.status}</span>
                      </div>
                    ))}
                  </div>
                )
              ) : (
                pendingUniversities.length === 0 ? <p className="text-sm text-gray-500">No verified pending requests.</p> : (
                  <div className="space-y-4">
                    {pendingUniversities.map(p => (
                      <div key={p.request_id} className="p-4 rounded-md bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800 flex justify-between items-center">
                        <div>
                          <div className="font-semibold">{p.college_name}</div>
                          <div className="text-sm text-gray-500">{p.contact_name} — {p.contact_role || 'Role'}</div>
                          <div className="text-sm text-gray-500">{p.contact_email}</div>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => openRejectModal(p.request_id)} className="px-3 py-1 rounded-md bg-red-600 text-white hover:bg-red-700">Reject</button>
                          <button onClick={() => handleApprove(p.request_id)} className="px-3 py-1 rounded-md bg-green-600 text-white hover:bg-green-700">Approve</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              )}
            </section>
          </div>

          <aside className="space-y-6">
            <section className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md border border-gray-100 dark:border-gray-700">
              <h3 className="text-lg font-semibold mb-3">Quick Summary</h3>
              <div className="text-sm text-gray-600 dark:text-gray-400 space-y-2">
                <div className="flex justify-between"><span>Total Users</span><span className="font-medium">{loadingStats ? '—' : stats?.totalUsers ?? 0}</span></div>
                <div className="flex justify-between"><span>Universities</span><span className="font-medium">{loadingStats ? '—' : stats?.totalUniversities ?? 0}</span></div>
                <div className="flex justify-between"><span>Pending Requests</span><span className="font-medium">{loadingStats ? '—' : stats?.pendingOnboardingRequests ?? 0}</span></div>
              </div>
            </section>

            <section className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md border border-gray-100 dark:border-gray-700">
              <h3 className="text-lg font-semibold mb-3">Tips</h3>
              <ul className="text-sm text-gray-600 dark:text-gray-400 list-disc list-inside space-y-2">
                <li>Approve verified universities to grow the platform.</li>
                <li>Monitor role breakdown to spot imbalances (few faculty, many students).</li>
                <li>Use the quick summary to spot spikes in requests.</li>
              </ul>
            </section>
          </aside>
        </div>
      </div>
      {rejectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60" onClick={() => setRejectModalOpen(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold mb-4">Reject University Request</h2>
            <textarea
              className="w-full p-2 rounded-md bg-gray-100 dark:bg-gray-700 border-none focus:ring-2 focus:ring-red-500 text-sm"
              rows={4}
              placeholder="Optional reason (will be emailed)"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setRejectModalOpen(false)} className="px-3 py-1 rounded-md bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200">Cancel</button>
              <button onClick={submitReject} className="px-3 py-1 rounded-md bg-red-600 text-white hover:bg-red-700">Reject</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}