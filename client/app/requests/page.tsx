// src/app/requests/page.tsx
'use client'

import React, { useState, useEffect, useCallback } from 'react'
import AppLayout from '@/components/AppLayout'
import { useAuth } from '@/context/UserContext'
// --- NEW: Import MessageSquare and useRouter ---
import { Check, X, MessageSquare } from 'lucide-react'
import { useRouter } from 'next/navigation'
import ToastNotification from '@/components/ToastNotification'
import { API_URL } from '@/utils/api';

type ConnectionRequest = {
  connection_id: number;
  sender_id: number;
  sender_name: string;
  sender_role: string;
  sender_headline: string | null;
};

function RequestsPageContent() {
  const { user } = useAuth();
  const router = useRouter(); // <-- NEW
  const [requests, setRequests] = useState<ConnectionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const clearMessages = () => { setError(null); setMessage(null); };

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    // Do not clear messages here
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const res = await fetch(`${API_URL}/api/connections/requests`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to fetch requests');
      }

      const data = await res.json();
      setRequests(data);

    } catch (err: any) {
      setError(err.message);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (user) { 
      fetchRequests();
    }
  }, [user, fetchRequests]);

  const handleRespond = async (connectionId: number, response: 'accepted' | 'rejected') => {
    clearMessages();
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/connections/respond`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ connectionId, response }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to respond to request.');

      setMessage(data.message);
      fetchRequests(); // Refresh the list

    } catch (err: any) {
      setError(err.message);
    }
  };

  // --- NEW: Handle Message Button ---
  const handleMessage = (connectionId: number) => {
    router.push(`/chat?open=${connectionId}`);
  };

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-6">Connection Requests</h1>

      {loading && <p>Loading requests...</p>}
      {!loading && !error && (
        <div className="max-w-2xl space-y-4">
          {requests.length === 0 ? (
            <div className="text-center p-12 bg-white dark:bg-gray-800 rounded-lg shadow-md">
              <h3 className="text-xl font-semibold">No Pending Requests</h3>
              <p className="text-gray-500 dark:text-gray-400 mt-2">
                You're all caught up!
              </p>
            </div>
          ) : (
            requests.map(req => (
              <div key={req.connection_id} className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow-md flex justify-between items-center">
                <div className="flex items-center space-x-4">
                  {/* Placeholder Icon */}
                  <div className="w-12 h-12 bg-indigo-500 rounded-full flex items-center justify-center text-white font-bold text-xl">
                    {req.sender_name[0]}
                  </div>
                  <div>
                    <p className="font-bold text-gray-900 dark:text-white">{req.sender_name}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {req.sender_headline || req.sender_role}
                    </p>
                  </div>
                </div>

                {/* --- MODIFIED: Action Buttons --- */}
                <div className="flex gap-2">
                  <button
                    onClick={() => handleRespond(req.connection_id, 'rejected')}
                    className="p-2 rounded-full text-red-500 hover:bg-red-100 dark:hover:bg-red-900"
                    title="Ignore"
                  >
                    <X className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => handleMessage(req.connection_id)}
                    className="p-2 rounded-full text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700"
                    title="Message"
                  >
                    <MessageSquare className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => handleRespond(req.connection_id, 'accepted')}
                    className="p-2 rounded-full text-green-600 hover:bg-green-100 dark:hover:bg-green-900"
                    title="Accept"
                  >
                    <Check className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      <ToastNotification message={message} error={error} clearMessages={clearMessages} />
    </div>
  );
}

// --- Main Page Export ---
export default function RequestsPage() {
  return (
    <AppLayout>
      <RequestsPageContent />
    </AppLayout>
  );
}