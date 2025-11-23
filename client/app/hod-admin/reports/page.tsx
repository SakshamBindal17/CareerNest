'use client'

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/UserContext';
import { ShieldCheck, Trash2, AlertTriangle, User, Calendar, X, ArrowLeft, ArrowRight, FileText } from 'lucide-react';
import ToastNotification from '@/components/ToastNotification';
import { API_URL } from '@/utils/api';


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
  media?: { type: string; url: string }[] | null;
};

const ReportCard = ({ report, onDismiss, onRemoveContent }: {
  report: Report;
  onDismiss: (reportId: number) => void;
  onRemoveContent: (reportId: number, contentId: number, contentType: 'post' | 'comment') => void;
}) => {
  const contentType = report.post_id ? 'Post' : 'Comment';
  const contentBody = report.post_body || report.comment_body;
  const contentId = report.post_id || report.comment_id;
  const images = (report.media || []).filter(m => m.type === 'image');
  const documents = (report.media || []).filter(m => m.type === 'document');

  // Lightbox state
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const openLightbox = (i: number) => setLightboxIndex(i);
  const closeLightbox = () => setLightboxIndex(null);
  const nextImage = () => lightboxIndex != null && setLightboxIndex((lightboxIndex + 1) % images.length);
  const prevImage = () => lightboxIndex != null && setLightboxIndex((lightboxIndex - 1 + images.length) % images.length);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
      <div className="p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white truncate">Reported {contentType}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">by {report.author_name}</p>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
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
              <span>Remove</span>
            </button>
          </div>
        </div>

        <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-700">
          <p className="text-gray-800 dark:text-gray-200 italic">&quot;{contentBody}&quot;</p>
          {/* Document preview */}
          {documents.length > 0 && (
            <a
              href={documents[0].url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 flex items-center gap-3 p-3 rounded-md border dark:border-gray-600 bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
            >
              <FileText className="w-8 h-8 text-indigo-500" />
              <div className="min-w-0">
                <p className="font-medium truncate">Attached Document</p>
                <p className="text-xs text-gray-500">Click to open</p>
              </div>
            </a>
          )}
          {/* Image grid */}
          {images.length > 0 && (
            <div className="mt-4">
              {images.length === 1 ? (
                <button
                  onClick={() => openLightbox(0)}
                  className="relative w-full bg-gray-100 dark:bg-gray-900 rounded-md border border-gray-200 dark:border-gray-700 overflow-hidden focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <img
                    src={images[0].url}
                    alt="Reported media"
                    className="w-full max-h-[480px] object-contain mx-auto bg-black/5 dark:bg-white/5"
                  />
                </button>
              ) : (
                <div className={`grid gap-2 grid-cols-2 ${images.length > 2 ? 'sm:grid-rows-2' : ''}`}>                
                  {images.slice(0,4).map((img, i) => (
                    <button
                      key={i}
                      onClick={() => openLightbox(i)}
                      className={`relative group w-full aspect-[4/3] rounded-md overflow-hidden border border-white dark:border-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500`}
                    >
                      <img src={img.url} alt={`Media ${i+1}`} className="w-full h-full object-cover" />
                      {i === 3 && images.length > 4 && (
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white text-xl font-semibold">
                          +{images.length - 4}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="mt-4 space-y-3 text-sm">
          <div className="flex items-center gap-3 text-gray-600 dark:text-gray-300">
            <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0" />
            <div className="min-w-0"><span className="font-semibold">Reason:</span> {report.reason}</div>
          </div>
          <div className="flex items-center gap-3 text-gray-600 dark:text-gray-300">
            <User className="w-5 h-5 text-indigo-500 flex-shrink-0" />
            <div className="min-w-0"><span className="font-semibold">Reported by:</span> {report.reporter_name}</div>
          </div>
          <div className="flex items-center gap-3 text-gray-600 dark:text-gray-300">
            <Calendar className="w-5 h-5 text-gray-500 flex-shrink-0" />
            <div className="min-w-0"><span className="font-semibold">Reported on:</span> {new Date(report.reported_at).toLocaleString()}</div>
          </div>
        </div>

        {lightboxIndex != null && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
            <button
              onClick={closeLightbox}
              className="absolute top-4 right-4 text-white hover:text-gray-300"
              aria-label="Close"
            >
              <X className="w-8 h-8" />
            </button>
            {images.length > 1 && (
              <>
                <button onClick={prevImage} className="absolute left-4 top-1/2 -translate-y-1/2 p-2 bg-black/50 text-white rounded-full" aria-label="Previous">
                  <ArrowLeft className="w-6 h-6" />
                </button>
                <button onClick={nextImage} className="absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-black/50 text-white rounded-full" aria-label="Next">
                  <ArrowRight className="w-6 h-6" />
                </button>
              </>
            )}
            <img
              src={images[lightboxIndex].url}
              alt={`Full view ${lightboxIndex+1}`}
              className="max-h-[90vh] max-w-[90vw] object-contain rounded-md shadow-lg"
            />
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white text-sm bg-black/40 px-3 py-1 rounded-full">
              {lightboxIndex + 1} / {images.length}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// (Removed old MediaPreview; replaced by integrated grid + lightbox in ReportCard)


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