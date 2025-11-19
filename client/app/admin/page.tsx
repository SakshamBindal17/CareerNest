// src/app/admin/page.tsx
'use client'

import React, { useState, useEffect } from 'react'
import ThemeSwitcher from '@/components/ThemeSwitcher'

const API_URL = 'http://localhost:3001';

type OnboardingRequest = {
  request_id: number;
  college_name: string;
  contact_name: string;
  contact_email: string;
  contact_role: string;
  is_verified: boolean;
};

export default function AdminDashboard() {
  const [requests, setRequests] = useState<OnboardingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const fetchRequests = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/admin/onboarding-requests`);
      if (!res.ok) throw new Error('Failed to fetch requests.');
      const data = await res.json();
      setRequests(data);
    } catch (err: any) {
      setError(err.message);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const handleApprove = async (requestId: number) => {
    setError(null);
    setMessage(null);
    if (!confirm('Are you sure you want to APPROVE this request?')) {
      return;
    }

    try {
      const res = await fetch(`${API_URL}/api/admin/approve-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to approve request.');

      setMessage(data.message);
      fetchRequests(); 
    } catch (err: any) {
      setError(err.message);
    }
  };

  // --- NEW: Handle Reject Function ---
  const handleReject = async (requestId: number) => {
    setError(null);
    setMessage(null);

    // 1. Ask for an optional rejection reason
    const rejectionReason = prompt(
      'You are about to REJECT this request. (Optional) Enter a reason to include in the email:'
    );

    // 2. If the user clicks "Cancel" (prompt returns null), do nothing.
    if (rejectionReason === null) {
      return;
    }

    try {
      // 3. Call the new reject API
      const res = await fetch(`${API_URL}/api/admin/reject-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId, rejectionReason }), // Send the reason
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to reject request.');

      setMessage(data.message); // Show "Request rejected!"
      fetchRequests(); // Refresh the list
    } catch (err: any) {
      setError(err.message);
    }
  };
  // --- END NEW ---

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white">
      {/* Admin Navbar */}
      <nav className="flex justify-between items-center p-4 px-8 bg-white border-b border-gray-200 dark:bg-gray-800 dark:border-gray-700">
        <h1 className="text-xl font-bold text-red-600 dark:text-red-500">
          Super Admin Dashboard
        </h1>
        <ThemeSwitcher />
      </nav>

      {/* Page Content */}
      <div className="p-8 max-w-4xl mx-auto">
        <h2 className="mb-6 text-3xl font-bold">Pending University Requests</h2>

        {error && <div className="p-4 mb-4 bg-red-100 text-red-700 rounded-md dark:bg-red-900 dark:text-red-200">{error}</div>}
        {message && <div className="p-4 mb-4 bg-green-100 text-green-700 rounded-md dark:bg-green-900 dark:text-green-200">{message}</div>}

        {loading ? (
          <p>Loading requests...</p>
        ) : requests.length === 0 ? (
          <p className="text-gray-600 dark:text-gray-400">There are no verified, pending requests.</p>
        ) : (
          <div className="space-y-4">
            {requests.map((req) => (
              <div key={req.request_id} className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-bold">{req.college_name}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {req.contact_name} ({req.contact_role})
                  </p>
                  <p className="text-sm text-gray-700 dark:text-gray-300">{req.contact_email}</p>
                </div>
                {/* --- NEW: Button Group --- */}
                <div className="flex gap-2">
                  <button
                    onClick={() => handleReject(req.request_id)}
                    className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700"
                  >
                    Reject
                  </button>
                  <button
                    onClick={() => handleApprove(req.request_id)}
                    className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700"
                  >
                    Approve
                  </button>
                </div>
                {/* --- END NEW --- */}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}