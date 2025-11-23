"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import ToastNotification from "@/components/ToastNotification";
import { AlertTriangle } from "lucide-react";
import { API_URL } from "@/utils/api";

type AlumniRequest = {
  user_id: number;
  full_name: string;
  personal_email: string;
  graduation_year: string;
  institute_roll_number?: string;
  verification_document_url: string;
  created_at: string;
  role: "Alumni";
  status?: string; // (pending_admin_approval | active)
};

export default function FacultyAlumniVerificationPage() {
  const router = useRouter();
  const [queue, setQueue] = useState<AlumniRequest[]>([]);
  const [queueStatusFilter, setQueueStatusFilter] = useState<string>('pending');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  // Reject modal state
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectUserId, setRejectUserId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const clearMessages = useCallback(() => {
    setError(null);
    setMessage(null);
  }, []);

  const readJson = async (res: Response) => {
    const ct = res.headers.get("content-type") || "";
    if (!ct.toLowerCase().includes("application/json")) {
      const body = await res.text();
      throw new Error(
        `Server returned non-JSON (status ${res.status}). ${body.slice(0, 200)}`
      );
    }
    return res.json();
  };

  const fetchQueue = useCallback(async () => {
    setLoading(true);
    clearMessages();
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        router.push("/login");
        return;
      }
      const res = await fetch(`${API_URL}/api/hod-admin/alumni-queue`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await readJson(res);
      if (!res.ok) throw new Error(data.error || "Failed to fetch alumni queue.");
      setQueue(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Error connecting to server."
      );
    } finally {
      setLoading(false);
    }
  }, [router, clearMessages]);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  const handleVerificationAction = async (
    userId: number,
    action: "approve"
  ) => {
    clearMessages();
    let confirmText = 'Approve and activate this alumnus?';
    if (!confirm(confirmText)) return;

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        router.push("/login");
        return;
      }
      const payload: { userId: number; actionType: string } = { userId, actionType: action };
      const res = await fetch(`${API_URL}/api/hod-admin/verify-alumnus`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });
      const data = await readJson(res);
      if (!res.ok) throw new Error(data.error || `Failed to perform ${action}.`);
      setMessage(data.message || "Updated");
      fetchQueue();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : `Failed to perform ${action}.`
      );
    }
  };

  // Open reject modal
  const openRejectModal = (userId: number) => {
    clearMessages();
    setRejectUserId(userId);
    setRejectReason('');
    setShowRejectModal(true);
  };

  // Submit reject with optional reason
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
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload)
      });
      const data = await readJson(res);
      if (!res.ok) throw new Error(data.error || 'Failed to reject alumnus.');
      setMessage(data.message || 'Rejected');
      setShowRejectModal(false);
      setRejectUserId(null);
      // Remove from queue optimistically then refresh
      setQueue(prev => prev.filter(a => a.user_id !== rejectUserId));
      fetchQueue();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reject alumnus.');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white">
      <div className="max-w-4xl mx-auto px-4 py-10">
        <header className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <AlertTriangle className="w-6 h-6 text-emerald-500" />
              Alumni Verification
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Review and verify alumni assigned to your department.
            </p>
          </div>
          <button
            onClick={() => router.push('/home')}
            className="text-sm font-medium text-gray-700 hover:text-indigo-600 dark:text-gray-300 dark:hover:text-indigo-400"
          >
            ← Back to Main
          </button>
        </header>

        <section className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 p-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold">Alumni Queue</h2>
              <span className="text-xs font-semibold px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-200">
                {queue.length} pending
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={fetchQueue}
                className="text-xs px-3 py-2 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white"
              >Refresh</button>
            </div>
          </div>

          {loading && <p className="py-4 text-center">Loading queue...</p>}
          {!loading && queue.length === 0 && (
            <p className="py-4 text-center text-gray-500 dark:text-gray-400">
              No alumni pending verification.
            </p>
          )}

          <div className="space-y-4 max-h-[480px] overflow-y-auto pr-1">
            {queue.map((alumnus) => (
              <div
                key={alumnus.user_id}
                className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-4 flex flex-col gap-3"
              >
                <div>
                  <h3 className="text-base font-semibold flex items-center justify-between gap-2">
                    <span>{alumnus.full_name}</span>
                    <span className="text-xs font-medium text-amber-500">
                      [PENDING]
                    </span>
                  </h3>
                  <p className="text-xs text-gray-500">
                    Grad Year: {alumnus.graduation_year || "N/A"}
                  </p>
                  {alumnus.institute_roll_number && (
                    <p className="text-xs text-gray-500">
                      Roll No: {alumnus.institute_roll_number}
                    </p>
                  )}
                  <p className="text-xs text-gray-500">
                    Email: {alumnus.personal_email}
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-end gap-2">
                  <a
                    href={alumnus.verification_document_url || "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1 text-xs rounded-md bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    View Document
                  </a>
                  <button
                    onClick={() => openRejectModal(alumnus.user_id)}
                    className="px-3 py-1 text-xs rounded-md bg-red-600 hover:bg-red-700 text-white"
                  >
                    Reject
                  </button>
                  <button
                    onClick={() => handleVerificationAction(alumnus.user_id, "approve")}
                    className="px-3 py-1 text-xs rounded-md bg-green-600 hover:bg-green-700 text-white"
                  >
                    Approve
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <ToastNotification
          message={message}
          error={error}
          clearMessages={clearMessages}
        />

        {/* Reject Modal (inside component scope) */}
        {showRejectModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Reject Alumnus</h3>
                <button onClick={() => setShowRejectModal(false)} className="text-gray-500 hover:text-gray-700">✕</button>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">Optional: provide a reason (included in email).</p>
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
      </div>
    </div>
  );
}
