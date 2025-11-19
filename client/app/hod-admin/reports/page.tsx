'use client'

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/UserContext';
import { ShieldCheck, Trash2, AlertTriangle, User, Calendar } from 'lucide-react';
import ToastNotification from '@/components/ToastNotification';

const API_URL = 'http://localhost:3001';

type Report = {
  report_id: number;
  reason: string;
  status: string;
  reported_at: string;
  post_id: number | null;
  comment_id: number | null;
  post_body: string | null;
  comment_body: string | null;
  reporter_name: string;
  author_name: string;
};

const ReportCard = ({ report, onDismiss, onRemoveContent }: {
  report: Report;
  onDismiss: (reportId: number) => void;
  onRemoveContent: (reportId: number, contentId: number, contentType: 'post' | 'comment') => void;
}) => {
  const contentType = report.post_id ? 'Post' : 'Comment';
  const contentBody = report.post_body || report.comment_body;
  const contentId = report.post_id || report.comment_id;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
      <div className="p-6">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
              Reported {contentType}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              by {report.author_name}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => onDismiss(report.report_id)}
              className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-md"
              title="Dismiss this report"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Dismiss</span>
            </button>
            <button
              onClick={() => onRemoveContent(report.report_id, contentId!, contentType.toLowerCase() as 'post' | 'comment')}
              className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md"
              title={`Permanently delete this ${contentType}`}
            >
              <Trash2 className="w-4 h-4" />
              <span>Remove Content</span>
            </button>
          </div>
        </div>

        <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-700">
          <p className="text-gray-800 dark:text-gray-200 italic">&quot;{contentBody}&quot;</p>
        </div>

        <div className="mt-4 space-y-3 text-sm">
          <div className="flex items-center gap-3 text-gray-600 dark:text-gray-300">
            <AlertTriangle className="w-5 h-5 text-yellow-500" />
            <div>
              <span className="font-semibold">Reason for report:</span> {report.reason}
            </div>
          </div>
          <div className="flex items-center gap-3 text-gray-600 dark:text-gray-300">
            <User className="w-5 h-5 text-indigo-500" />
            <div>
              <span className="font-semibold">Reported by:</span> {report.reporter_name}
            </div>
          </div>
          <div className="flex items-center gap-3 text-gray-600 dark:text-gray-300">
            <Calendar className="w-5 h-5 text-gray-500" />
            <div>
              <span className="font-semibold">Reported on:</span> {new Date(report.reported_at).toLocaleString()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};


export default function HodReportDashboard() {
  const { user, loading: authLoading } = useAuth();
  const [reports, setReports] = useState<Report[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ message: string, isError: boolean } | null>(null);

  const fetchReports = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/hod-admin/reports`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to fetch reports.');
      }
      const data = await res.json();
      setReports(data);
    } catch (err) {
      setError((err as Error).message);
    }
  }, []);

  useEffect(() => {
    if (authLoading) {
      return; // Wait for authentication to complete
    }

    if (!user || (user.role !== 'HOD' && user.role !== 'College Admin')) {
      setError("You do not have permission to view this page.");
    } else {
      fetchReports();
    }
  }, [user, authLoading, fetchReports]);

  const handleAction = async (action: () => Promise<void>, successMessage: string) => {
    try {
      await action();
      setNotification({ message: successMessage, isError: false });
      await fetchReports(); // Refresh the list
    } catch (err) {
      setNotification({ message: (err as Error).message, isError: true });
    }
  };

  const handleDismissReport = (reportId: number) => {
    handleAction(async () => {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/hod-admin/reports/${reportId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to dismiss report.');
      }
    }, 'Report dismissed successfully.');
  };

  const handleRemoveContent = (reportId: number, contentId: number, contentType: 'post' | 'comment') => {
    handleAction(async () => {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/hod-admin/${contentType}s/${contentId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `Failed to remove ${contentType}.`);
      }
    }, `Content (${contentType}) removed successfully.`);
  };

  if (authLoading) {
    return <div className="text-center p-8">Loading reports...</div>;
  }

  if (error) {
    return <div className="text-center p-8 text-red-500">Error: {error}</div>;
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      {notification && (
        <ToastNotification
          message={notification.isError ? null : notification.message}
          error={notification.isError ? notification.message : null}
          clearMessages={() => setNotification(null)}
        />
      )}
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">
          Reported Content Queue
        </h1>

        {reports.length === 0 ? (
          <div className="text-center py-12 px-6 bg-white dark:bg-gray-800 rounded-lg shadow-md">
            <ShieldCheck className="w-16 h-16 mx-auto text-green-500" />
            <h3 className="mt-4 text-xl font-semibold text-gray-900 dark:text-white">All Clear!</h3>
            <p className="mt-2 text-gray-500 dark:text-gray-400">
              There are no pending reports in your college&apos;s queue.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {reports.map(report => (
              <ReportCard
                key={report.report_id}
                report={report}
                onDismiss={handleDismissReport}
                onRemoveContent={handleRemoveContent}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}