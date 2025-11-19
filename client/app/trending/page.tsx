// src/app/trending/page.tsx
'use client'

import React, { useState, useEffect, useCallback } from 'react'
import AppLayout from '@/components/AppLayout'
import PostCard from '@/components/PostCard'
import { Post } from '@/types'
import ToastNotification from '@/components/ToastNotification'

// Placeholder for a post card
const PostCardPlaceholder = () => (
  <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow animate-pulse">
    <div className="flex items-center space-x-3 mb-4">
      <div className="w-10 h-10 bg-gray-300 dark:bg-gray-700 rounded-full"></div>
      <div>
        <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-32"></div>
        <div className="h-3 bg-gray-300 dark:bg-gray-700 rounded w-24 mt-2"></div>
      </div>
    </div>
    <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-full mb-2"></div>
    <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-5/6"></div>
  </div>
);

export default function TrendingPage() {
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
        throw new Error("You must be logged in to see trending posts.");
      }

      const res = await fetch('http://localhost:3001/api/posts/trending', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to fetch trending posts');
      }

      const data = await res.json();
      setPosts(data);
      setError(null); // Clear previous errors on success
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
        setToastInfo({ message: err.message, isError: true });
      } else {
        const genericError = 'An unexpected error occurred.';
        setError(genericError);
        setToastInfo({ message: genericError, isError: true });
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTrendingPosts();
  }, [fetchTrendingPosts]);

  const handlePostUpdated = (message?: string, isError?: boolean) => {
    if (message) {
      setToastInfo({ message, isError: isError || false });
    }
    fetchTrendingPosts();
  };

  const clearToast = () => {
    setToastInfo(null);
  }

  return (
    <AppLayout>
      <div className="p-8">
        <h1 className="text-3xl font-bold mb-6 text-gray-900 dark:text-white">Trending Posts</h1>

        <div className="max-w-2xl mx-auto space-y-6">
          {loading && (
            <>
              <PostCardPlaceholder />
              <PostCardPlaceholder />
            </>
          )}

          {!loading && error && (
             <div className="text-center py-12">
                <p className="text-red-500">{error}</p>
             </div>
          )}

          {!loading && !error && posts.length === 0 && (
            <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg shadow">
              <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-300">No trending posts right now.</h2>
              <p className="text-gray-500 dark:text-gray-400 mt-2">Why not start a conversation and get things going?</p>
            </div>
          )}

          {!loading && !error && posts.map(post => (
            <PostCard key={post.post_id} post={post} onPostUpdated={handlePostUpdated} />
          ))}
        </div>
      </div>
      <ToastNotification 
        message={toastInfo?.message || null} 
        error={toastInfo?.isError ? toastInfo.message : null} 
        clearMessages={clearToast} 
      />
    </AppLayout>
  );
}