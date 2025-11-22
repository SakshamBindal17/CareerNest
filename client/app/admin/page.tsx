// src/app/admin/page.tsx
'use client'

import React, { useState, useEffect } from 'react'
import ThemeSwitcher from '@/components/ThemeSwitcher'
import AdminStatCard from '@/components/AdminStatCard'

const API_URL = 'http://localhost:3001';

type OnboardingRequest = {
  request_id: number;
  college_name: string;
  contact_name: string;
  contact_email: string;
  contact_role: string;
  is_verified: boolean;
};

type AdminStats = {
  totalUsers: number;
  roleBreakdown: Record<string, number>;
  totalUniversities: number;
  pendingOnboardingRequests: number;
};

export default function AdminDashboard() {
  const [requests, setRequests] = useState<OnboardingRequest[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);

  const fetchAll = async () => {
    setLoadingRequests(true);
    setLoadingStats(true);
    setError(null);

    try {
      const [r1, r2] = await Promise.all([
        fetch(`${API_URL}/api/admin/onboarding-requests`),
        fetch(`${API_URL}/api/admin/stats`),
      ]);

      if (!r1.ok) throw new Error('Failed to fetch requests.');
      if (!r2.ok) throw new Error('Failed to fetch stats.');

      const requestsData = await r1.json();
      const statsData = await r2.json();

      setRequests(requestsData || []);
      setStats(statsData || null);
    } catch (err: unknown) {
      const messageText = err instanceof Error ? err.message : String(err);
      setError(messageText || 'An error occurred while loading data.');
    } finally {
      setLoadingRequests(false);
      setLoadingStats(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const handleApprove = async (requestId: number) => {
    setError(null);
    setMessage(null);
    if (!confirm('Are you sure you want to APPROVE this request?')) return;

    try {
      const res = await fetch(`${API_URL}/api/admin/approve-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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

  const handleReject = async (requestId: number) => {
    setError(null);
    setMessage(null);

    const rejectionReason = prompt('Optional rejection reason (email will include it):');
    if (rejectionReason === null) return; // Cancelled

    try {
      const res = await fetch(`${API_URL}/api/admin/reject-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white">
      <nav className="flex justify-between items-center p-4 px-8 bg-white border-b border-gray-200 dark:bg-gray-800 dark:border-gray-700">
        <div>
          <h1 className="text-xl font-bold text-red-600 dark:text-red-400">Super Admin Dashboard</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">Platform overview & actions</p>
        </div>
        <div className="flex items-center gap-4">
          <ThemeSwitcher />
        </div>
      </nav>

      <div className="p-8 max-w-6xl mx-auto">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <AdminStatCard title="Total Users" value={loadingStats ? '—' : stats?.totalUsers ?? 0} icon={<span>👥</span>} />
          <AdminStatCard title="Active by Role" value={loadingStats ? '—' : Object.values(stats?.roleBreakdown || {}).reduce((s, n) => s + n, 0)} icon={<span>📊</span>} />
          <AdminStatCard title="Universities" value={loadingStats ? '—' : stats?.totalUniversities ?? 0} icon={<span>🏫</span>} />
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
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold">Pending University Onboarding</h2>
                <div className="text-sm text-gray-500">{loadingRequests ? 'Loading…' : `${requests.length} pending`}</div>
              </div>

              {error && <div className="p-3 mb-4 bg-red-100 text-red-700 rounded-md dark:bg-red-900 dark:text-red-200">{error}</div>}
              {message && <div className="p-3 mb-4 bg-green-100 text-green-700 rounded-md dark:bg-green-900 dark:text-green-200">{message}</div>}

              {loadingRequests ? (
                <p className="text-sm text-gray-500">Loading requests…</p>
              ) : requests.length === 0 ? (
                <p className="text-sm text-gray-500">No verified, pending requests.</p>
              ) : (
                <div className="space-y-4">
                  {requests.map((req) => (
                    <div key={req.request_id} className="flex items-center justify-between gap-4 p-4 rounded-md bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800">
                      <div>
                        <div className="font-semibold">{req.college_name}</div>
                        <div className="text-sm text-gray-500">{req.contact_name} — {req.contact_role}</div>
                        <div className="text-sm text-gray-500">{req.contact_email}</div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => handleReject(req.request_id)} className="px-3 py-1 rounded-md bg-red-600 text-white hover:bg-red-700">Reject</button>
                        <button onClick={() => handleApprove(req.request_id)} className="px-3 py-1 rounded-md bg-green-600 text-white hover:bg-green-700">Approve</button>
                      </div>
                    </div>
                  ))}
                </div>
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
    </div>
  );
}