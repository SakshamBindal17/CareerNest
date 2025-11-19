// client/components/ConversationWindow.tsx
'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '@/context/UserContext'
import { Send, Paperclip, Check, CheckCheck } from 'lucide-react'
import Link from 'next/link'

const API_URL = 'http://localhost:3001';

type Message = {
  message_id: number;
  sender_id: number;
  body: string;
  created_at: string;
  read_at: string | null; 
};

type ConversationProps = {
  connectionId: number;
  otherUserName: string;
  otherUserRole: string;
};

// --- NEW: Helper function to format date banners ---
const formatDateBanner = (dateStr: string) => {
  const date = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) {
    return 'Today';
  }
  if (date.toDateString() === yesterday.toDateString()) {
    return 'Yesterday';
  }
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
};
// --- END NEW ---

export default function ConversationWindow({ connectionId, otherUserName, otherUserRole }: ConversationProps) {
  const { user } = useAuth(); 
  const [messages, setMessages] = useState<Message[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<'pending' | 'accepted' | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState('');

  const messagesEndRef = useRef<null | HTMLDivElement>(null); 

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    const fetchHistory = async () => {
      setLoading(true);
      setError(null);
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_URL}/api/chat/history/${connectionId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to fetch history.');

        setMessages(data.messages);
        setConnectionStatus(data.connection.status);
      } catch (err: any) {
        setError(err.message);
      }
      setLoading(false);
    };

    fetchHistory();
  }, [connectionId]); 

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return; 

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/chat/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ connectionId, body: newMessage }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send message.');

      setMessages(prevMessages => [...prevMessages, data]);
      setNewMessage(''); 

    } catch (err: any) {
      setError(err.message);
    }
  };

  const isMessageLimitReached = connectionStatus === 'pending' && messages.length >= 5;

  let lastMessageDate: string | null = null; // For date banners

  if (loading) {
    return <div className="flex-1 flex items-center justify-center">Loading chat...</div>;
  }

  return (
    <div className="flex-1 h-full flex flex-col">
      {/* --- Chat Header --- */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex justify-between items-center">
        <div>
          <p className="font-bold">{otherUserName}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">{otherUserRole}</p>
        </div>
      </div>

      {/* --- Message History --- */}
      <div className="flex-1 p-4 overflow-y-auto space-y-2">
        {messages.map((msg, index) => {
          const isMyMessage = msg.sender_id === user?.id;

          // --- NEW: Date Banner Logic ---
          let dateBanner = null;
          const messageDate = new Date(msg.created_at).toDateString();
          if (messageDate !== lastMessageDate) {
            dateBanner = (
              <div className="flex justify-center my-4">
                <span className="px-3 py-1 bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs font-medium rounded-full">
                  {formatDateBanner(msg.created_at)}
                </span>
              </div>
            );
            lastMessageDate = messageDate;
          }
          // --- END NEW ---

          return (
            <React.Fragment key={msg.message_id}>
              {dateBanner}
              <div className={`flex ${isMyMessage ? 'justify-end' : 'justify-start'}`}>
                <div className={`p-3 rounded-lg max-w-xs lg:max-w-md ${
                  isMyMessage 
                  ? 'bg-indigo-600 text-white' 
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white'
                }`}>
                  <p>{msg.body}</p>
                  <div className="flex justify-end items-center gap-1 mt-1">
                    <p className="text-xs opacity-70">
                      {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                    {isMyMessage && (
                      msg.read_at ? (
                        <CheckCheck className="w-4 h-4 text-green-300" /> // Read tick
                      ) : (
                        <Check className="w-4 h-4 opacity-70" /> // Sent tick
                      )
                    )}
                  </div>
                </div>
              </div>
            </React.Fragment>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* --- Message Input Form --- */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        {connectionStatus === 'pending' && (
          <div className="text-center text-sm text-amber-600 dark:text-amber-400 mb-2 p-2 bg-amber-50 dark:bg-amber-900/30 rounded-md">
            Connection request is pending. A 5-message limit is in effect. ({messages.length} / 5 sent)
          </div>
        )}

        <form onSubmit={handleSendMessage} className="flex items-center gap-2">
          <button 
            type="button" 
            disabled={isMessageLimitReached || connectionStatus === 'pending'} 
            className="p-2 text-gray-500 dark:text-gray-400 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
          >
            <Paperclip className="w-5 h-5" />
          </button>
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder={isMessageLimitReached ? "Message limit reached" : "Type a message..."}
            disabled={isMessageLimitReached} 
            className="flex-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 dark:bg-gray-700 dark:text-white dark:border-gray-600"
          />
          <button
            type="submit"
            disabled={isMessageLimitReached} 
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50"
          >
            <Send className="w-5 h-5" />
          </button>
        </form>
      </div>
    </div>
  );
}