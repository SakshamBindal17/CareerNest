"use client";
import React, { useState, useEffect, useCallback } from 'react';
import PostCard from '@/components/PostCard';
import { Post } from '@/types';
import ToastNotification from '@/components/ToastNotification';
import { API_URL } from '@/utils/api';

const PostCardPlaceholder = () => (
  <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow animate-pulse">
    <div className="flex items-center space-x-3 mb-4">
      <div className="w-10 h-10 bg-gray-300 dark:bg-gray-700 rounded-full"></div>
      <div>
        <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-32" />
        <div className="h-3 bg-gray-300 dark:bg-gray-700 rounded w-24 mt-2" />
      </div>
    </div>
    <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-full mb-2" />
    <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-5/6" />
  </div>
);

export default function TrendingClient() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toastInfo, setToastInfo] = useState<{ message: string; isError: boolean } | null>(null);

  const fetchTrendingPosts = useCallback(async (successMessage?: string) => {
    setLoading(true);
    if (successMessage) setToastInfo({ message: successMessage, isError: false });

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('You must be logged in to see trending posts.');
      }

      const res = await fetch(`${API_URL}/api/posts/trending`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to fetch trending posts');
      }

      const data = await res.json();
      setPosts(data);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred.';
      setError(message);
      setToastInfo({ message, isError: true });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTrendingPosts(); }, [fetchTrendingPosts]);

  const handlePostUpdated = (message?: string, isError?: boolean) => {
    if (message) setToastInfo({ message, isError: !!isError });
    fetchTrendingPosts();
  };

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-6 text-gray-900 dark:text-white">Trending Posts</h1>
      <div className="max-w-2xl mx-auto space-y-6">
        {loading && (<><PostCardPlaceholder /><PostCardPlaceholder /></>)}
        {!loading && error && (
          <div className="text-center py-12"><p className="text-red-500">{error}</p></div>
        )}
        {!loading && !error && posts.length === 0 && (
          <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg shadow">
            <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-300">No trending posts right now.</h2>
            <p className="text-gray-500 dark:text-gray-400 mt-2">Start a conversation to get things moving.</p>
          </div>
        )}
        {!loading && !error && posts.map(post => (
          <PostCard key={post.post_id} post={post} onPostUpdated={handlePostUpdated} />
        ))}
      </div>
      <ToastNotification
        message={toastInfo?.isError ? null : toastInfo?.message || null}
        error={toastInfo?.isError ? toastInfo?.message || null : null}
        clearMessages={() => setToastInfo(null)}
      />
    </div>
  );
}
