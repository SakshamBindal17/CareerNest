// src/app/home/page.tsx
'use client' 

import React, { useState, useEffect, useCallback } from 'react'
import AppLayout from '@/components/AppLayout'
import { useAuth } from '@/context/UserContext'
import PostPublisher from '@/components/PostPublisher' // <-- 1. Import
import PostCard from '@/components/PostCard'
import ToastNotification from '@/components/ToastNotification'

const API_URL = 'http://localhost:3001';

// --- (Type Definitions are the same) ---
type MediaItem = { type: 'image' | 'document'; url: string; };
type ReactionCounts = {
  like?: number;
  celebrate?: number;
  support?: number;
  insightful?: number;
  funny?: number;
};
type Post = {
  post_id: number; body: string | null; created_at: string;
  author_id: number; author_name: string; author_role: string; author_headline: string | null;
  comment_count: string; reactions: ReactionCounts | null; 
  my_reaction: string | null; media: MediaItem[] | null; 
};

function HomePageContent() {
  const { user } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // --- NEW: State to manage the Create Post modal ---
  const [isPublisherOpen, setIsPublisherOpen] = useState(false);

  const clearMessages = () => { setError(null); setMessage(null); };

  const fetchPosts = useCallback(async (successMessage?: string) => {
    setLoading(true);
    if (successMessage) setMessage(successMessage);

    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const res = await fetch(`${API_URL}/api/posts`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to fetch posts');
      }

      const data = await res.json();
      setPosts(data);

    } catch (err: any) {
      setError(err.message);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (user) { 
      fetchPosts();
    }
  }, [user, fetchPosts]);

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Home Feed</h1>

      {/* --- NEW: "Start a Post" Button --- */}
      <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow-md mb-6 flex items-center gap-3">
         <div className="w-10 h-10 bg-indigo-500 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0">
           {user?.fullName[0]}
         </div>
         <button 
            onClick={() => setIsPublisherOpen(true)}
            className="w-full text-left p-3 bg-gray-100 dark:bg-gray-700 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600"
         >
            Post Something...
         </button>
      </div>
      {/* --- END NEW --- */}

      {loading && <p>Loading posts...</p>}

      {!loading && (
        <div className="space-y-6">
          {posts.length === 0 ? (
            <div className="text-center p-12 bg-white dark:bg-gray-800 rounded-lg shadow-md">
              <h3 className="text-xl font-semibold">No Posts Yet</h3>
              <p className="text-gray-500 dark:text-gray-400 mt-2">
                Be the first to share an update!
              </p>
            </div>
          ) : (
            posts.map(post => (
              <PostCard 
                key={post.post_id} 
                post={post} 
                onPostUpdated={() => fetchPosts()} // Pass the simple refresh
              />
            ))
          )}
        </div>
      )}

      {/* --- NEW: Render the Publisher Modal --- */}
      {isPublisherOpen && (
        <PostPublisher 
          postToEdit={null} // We are in "Create Mode"
          onClose={() => setIsPublisherOpen(false)}
          onPostCreated={() => {
            fetchPosts('Post created successfully!');
            setIsPublisherOpen(false);
          }}
        />
      )}

      <ToastNotification message={message} error={error} clearMessages={clearMessages} />
    </div>
  );
}

export default function HomePage() {
  return (
    <AppLayout>
      <HomePageContent />
    </AppLayout>
  );
}