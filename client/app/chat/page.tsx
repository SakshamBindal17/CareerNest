// src/app/chat/page.tsx
'use client'

import React, { useState, useEffect, useMemo, useCallback, Suspense } from 'react'
import AppLayout from '@/components/AppLayout'
import { useAuth } from '@/context/UserContext'
import { Search, MessageSquarePlus } from 'lucide-react'
import ToastNotification from '@/components/ToastNotification'
import ConversationWindow from '@/components/ConversationWindow'
import { useSearchParams } from 'next/navigation'

const API_URL = 'http://localhost:3001';

type ConversationPreview = {
  connection_id: number;
  status: 'pending' | 'accepted' | 'rejected';
  other_user_id: number;
  other_user_name: string;
  other_user_role: string;
  last_message: string | null;
  last_message_at: string | null;
  unread_count: number; 
};

function ChatPageContent() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<ConversationPreview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [selectedConversation, setSelectedConversation] = useState<ConversationPreview | null>(null);
  const [filter, setFilter] = useState<'accepted' | 'pending'>('accepted');

  // --- NEW: State for search query ---
  const [searchQuery, setSearchQuery] = useState('');

  const clearMessages = () => { setError(null); setMessage(null); };

  const searchParams = useSearchParams();
  const openChatId = searchParams.get('open');

  const fetchConversations = useCallback(async () => {
    setLoading(true);
    clearMessages();
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const res = await fetch(`${API_URL}/api/chat/conversations`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to fetch conversations');
      }

      const data: ConversationPreview[] = await res.json();
      setConversations(data);

      if (openChatId) {
        const convoToOpen = data.find(c => c.connection_id === Number(openChatId));
        if (convoToOpen) {
          setSelectedConversation(convoToOpen);
          if (convoToOpen.status === 'pending') setFilter('pending');
        }
      }

    } catch (err: any) {
      setError(err.message);
    }
    setLoading(false);
  }, [openChatId]); 

  useEffect(() => {
    if (user) { 
      fetchConversations();
    }
  }, [user, fetchConversations]);

  // --- MODIFIED: Filter logic now includes search ---
  const { pendingChats, acceptedChats, pendingCount, acceptedCount } = useMemo(() => {
    const pending: ConversationPreview[] = [];
    const accepted: ConversationPreview[] = [];
    let pCount = 0;
    let aCount = 0;

    // 1. Filter by search query first
    const searchedList = conversations.filter(convo => 
      convo.other_user_name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // 2. Separate into lists and get counts
    searchedList.forEach(convo => {
      if (convo.status === 'pending') {
        pending.push(convo);
        if (convo.unread_count > 0) pCount++;
      }
      if (convo.status === 'accepted') {
        accepted.push(convo);
        if (convo.unread_count > 0) aCount++;
      }
    });
    return { pendingChats: pending, acceptedChats: accepted, pendingCount: pCount, acceptedCount: aCount };
  }, [conversations, searchQuery]);

  const filteredConversations = filter === 'accepted' ? acceptedChats : pendingChats;

  const onChatOpened = (convo: ConversationPreview) => {
    setSelectedConversation(convo);
    if (convo.unread_count > 0) {
      fetchConversations();
    }
  };

  return (
    <div className="flex h-screen overflow-hidden">
      {/* --- Left Panel: Conversations List --- */}
      <div className="w-full md:w-1/3 xl:w-1/4 h-full flex flex-col border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">

        {/* --- MODIFIED: Search Bar --- */}
        <div className="p-4 border-b dark:border-gray-700">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search chats..."
              className="w-full pl-10 pr-4 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Filter Toggles (Same as before, now with counts) */}
        <div className="flex border-b dark:border-gray-700">
          <button 
            onClick={() => setFilter('accepted')}
            className={`flex-1 py-3 px-4 text-sm font-medium text-center flex justify-center items-center gap-2 ${
              filter === 'accepted' 
              ? 'border-b-2 border-indigo-500 text-indigo-600 dark:text-indigo-400' 
              : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
            Accepted
            {acceptedCount > 0 && (
              <span className="px-2 py-0.5 bg-indigo-600 text-white text-xs rounded-full">{acceptedCount}</span>
            )}
          </button>
          <button 
            onClick={() => setFilter('pending')}
            className={`flex-1 py-3 px-4 text-sm font-medium text-center flex justify-center items-center gap-2 ${
              filter === 'pending' 
              ? 'border-b-2 border-indigo-500 text-indigo-600 dark:text-indigo-400' 
              : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
            Pending
            {pendingCount > 0 && (
              <span className="px-2 py-0.5 bg-amber-600 text-white text-xs rounded-full">{pendingCount}</span>
            )}
          </button>
        </div>

        {/* Conversation List Area */}
        <div className="flex-1 overflow-y-auto">
          {loading && <p className="p-4 text-center">Loading chats...</p>}

          {filteredConversations.length > 0 ? (
            <div className="p-2 space-y-1">
              {filteredConversations.map(convo => (
                <button
                  key={convo.connection_id}
                  onClick={() => onChatOpened(convo)} 
                  className={`w-full flex items-center gap-3 p-3 rounded-lg text-left ${
                    selectedConversation?.connection_id === convo.connection_id 
                    ? 'bg-indigo-100 dark:bg-indigo-900' 
                    : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  <div className={`relative w-10 h-10 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0 ${
                    convo.status === 'pending' ? 'bg-gray-400' : 'bg-indigo-500'
                  }`}>
                    {convo.other_user_name[0]}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold truncate">{convo.other_user_name}</p>
                    {/* --- THIS IS THE FIX for Pending Preview --- */}
                    <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                      {convo.last_message ? (
                        <span className={convo.unread_count > 0 ? 'font-bold text-gray-700 dark:text-gray-200' : ''}>
                          {convo.last_message}
                        </span>
                      ) : (
                        'Request pending...'
                      )}
                    </p>
                  </div>
                  {convo.unread_count > 0 && (
                    <span className="flex-shrink-0 px-2.5 py-0.5 bg-indigo-600 text-white text-xs font-bold rounded-full">
                      {convo.unread_count}
                    </span>
                  )}
                </button>
              ))}
            </div>
          ) : (
            <p className="p-4 text-center text-gray-500 dark:text-gray-400">
              No {filter} chats.
            </p>
          )}
        </div>
      </div>

      {/* --- Right Panel: Active Chat Window --- */}
      <div className="flex-1 h-full flex flex-col">
        {!selectedConversation ? (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-500 dark:text-gray-400">
            <MessageSquarePlus className="w-16 h-16" />
            <h2 className="text-xl font-medium mt-4">Select a conversation</h2>
            <p className="text-sm">...or send a new connection request from the 'People' page.</p>
          </div>
        ) : (
          <ConversationWindow
            key={selectedConversation.connection_id} 
            connectionId={selectedConversation.connection_id}
            otherUserName={selectedConversation.other_user_name}
            otherUserRole={selectedConversation.other_user_role}
          />
        )}
      </div>

      <ToastNotification message={message} error={error} clearMessages={clearMessages} />
    </div>
  );
}

// --- Main Page Export ---
export default function ChatPage() {
  return (
    <AppLayout>
      <Suspense fallback={<div className="p-4 text-center">Loading Chat...</div>}>
        <ChatPageContent />
      </Suspense>
    </AppLayout>
  );
}