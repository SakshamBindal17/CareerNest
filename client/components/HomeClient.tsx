"use client";
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/UserContext';
import dynamic from 'next/dynamic';
import Avatar from '@/components/Avatar';
import PostCard from '@/components/PostCard';
import { API_URL } from '@/utils/api';

const PostPublisher = dynamic(() => import('@/components/PostPublisher'), { ssr: false });
const ToastNotification = dynamic(() => import('@/components/ToastNotification'), { ssr: false });


type MediaItem = { type: 'image' | 'document'; url: string; };
 type ReactionCounts = { like?: number; celebrate?: number; support?: number; insightful?: number; funny?: number; };
 type Post = { post_id: number; body: string | null; created_at: string; author_id: number; author_name: string; author_role: string; author_headline: string | null; author_profile_icon_url?: string | null; comment_count: string; reactions: ReactionCounts | null; my_reaction: string | null; media: MediaItem[] | null; };

const PostSkeleton = () => (
  <div className="animate-pulse p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md space-y-4">
    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
    <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-full" />
    <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-5/6" />
  </div>
);

export default function HomeClient() {
  const { user } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isPublisherOpen, setIsPublisherOpen] = useState(false);

  const clearMessages = () => { setError(null); setMessage(null); };

  const fetchPosts = useCallback(async (successMessage?: string) => {
    if (successMessage) setMessage(successMessage);
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) { setLoading(false); return; }
      const res = await fetch(`${API_URL}/api/posts`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) {
        let errText = 'Failed to fetch posts';
        try { const errData = await res.json(); errText = errData.error || errText; } catch {}
        throw new Error(errText);
      }
      const data = await res.json();
      setPosts(data);
      // Cache to sessionStorage for faster immediate subsequent visits without blank state
      try { sessionStorage.setItem('home_posts', JSON.stringify(data)); } catch {}
    } catch (e:any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Hydrate from session cache to avoid blank experience then still refresh in background
  useEffect(() => {
    try {
      const cached = sessionStorage.getItem('home_posts');
      if (cached) {
        const parsed = JSON.parse(cached) as Post[];
        if (parsed.length) {
          setPosts(parsed);
          setLoading(false); // show cached immediately
        }
      }
    } catch {}
  }, []);

  useEffect(() => { if (user) fetchPosts(); }, [user, fetchPosts]);

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Home Feed</h1>
      <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow-md mb-6 flex items-center gap-3">
        <Avatar src={user?.profileIconUrl} name={user?.fullName || 'User'} size={40} />
        <button onClick={()=>setIsPublisherOpen(true)} className="w-full text-left p-3 bg-gray-100 dark:bg-gray-700 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600">Post Something...</button>
      </div>
      {loading && (
        <div className="space-y-6">
          {[...Array(3)].map((_, i) => <PostSkeleton key={i} />)}
        </div>
      )}
      {!loading && (
        <div className="space-y-6">
          {posts.length === 0 ? (
            <div className="text-center p-12 bg-white dark:bg-gray-800 rounded-lg shadow-md">
              <h3 className="text-xl font-semibold">No Posts Yet</h3>
              <p className="text-gray-500 dark:text-gray-400 mt-2">Be the first to share an update!</p>
            </div>
          ) : posts.map(p => (
            <PostCard key={p.post_id} post={p} onPostUpdated={()=>fetchPosts()} />
          ))}
        </div>
      )}
      {isPublisherOpen && (
        <PostPublisher postToEdit={null} onClose={()=>setIsPublisherOpen(false)} onPostCreated={()=>{ fetchPosts('Post created successfully!'); setIsPublisherOpen(false); }} />
      )}
      <ToastNotification message={message} error={error} clearMessages={clearMessages} />
    </div>
  );
}
