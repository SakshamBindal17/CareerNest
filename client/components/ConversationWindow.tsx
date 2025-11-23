// client/components/ConversationWindow.tsx
'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { io, Socket } from 'socket.io-client'
import { useAuth } from '@/context/UserContext'
import { Send, Paperclip, Check, CheckCheck } from 'lucide-react'
import Link from 'next/link'
import { API_URL, SOCKET_URL } from '@/utils/api';

type Message = {
  message_id: number;
  sender_id: number;
  body: string;
  attachment_url?: string | null;
  created_at: string;
  read_at: string | null; 
  connection_id?: number;
};

type ConversationProps = {
  connectionId: number;
  otherUserId: number;
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

export default function ConversationWindow({ connectionId, otherUserId, otherUserName, otherUserRole }: ConversationProps) {
  const { user } = useAuth(); 
  const [messages, setMessages] = useState<Message[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<'pending' | 'accepted' | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [pendingImageFile, setPendingImageFile] = useState<File | null>(null);
  const [pendingImagePreview, setPendingImagePreview] = useState<string | null>(null);
  const [pendingImageCaption, setPendingImageCaption] = useState('');

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const messagesEndRef = useRef<null | HTMLDivElement>(null); 
  const socketRef = useRef<Socket | null>(null);
  const normalizeMessage = (raw: any): Message => ({
    message_id: Number(raw.message_id),
    sender_id: Number(raw.sender_id),
    body: raw.body || '',
    attachment_url: raw.attachment_url || null,
    created_at: raw.created_at,
    read_at: raw.read_at || null,
    connection_id: raw.connection_id !== undefined ? Number(raw.connection_id) : undefined
  });

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

        setMessages(data.messages.map((m: any) => normalizeMessage(m)));
        setConnectionStatus(data.connection.status);
      } catch (err: any) {
        setError(err.message);
      }
      setLoading(false);
    };

    fetchHistory();
    // Setup socket connection for real-time updates
    const token = localStorage.getItem('token');
    if (token) {
      socketRef.current = io(API_URL, {
        auth: { token }
      });
      socketRef.current.on('connect', () => {
        socketRef.current?.emit('chat:join', { connectionId });
      });
      socketRef.current.on('message:new', (msg: any) => {
        if (Number(msg.connection_id) !== Number(connectionId)) return;
        const incoming = normalizeMessage(msg);
        setMessages(prev => {
          const idx = prev.findIndex(m => m.message_id === incoming.message_id);
          if (idx !== -1) {
            const clone = [...prev];
            clone[idx] = { ...clone[idx], ...incoming }; // merge updates
            return clone;
          }
          return [...prev, incoming];
        });
      });
      socketRef.current.on('connect_error', (err) => {
        console.error('Socket connect_error:', err.message);
        setError('Real-time connection failed.');
      });
    }
    return () => {
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, [connectionId]); 

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    // If there is a pending image, send image + optional caption
    if (pendingImageFile) {
      try {
        const token = localStorage.getItem('token');
        const formData = new FormData();
        formData.append('connectionId', String(connectionId));
        formData.append('file', pendingImageFile);
        if (pendingImageCaption.trim()) {
          formData.append('caption', pendingImageCaption.trim());
        }

        const res = await fetch(`${API_URL}/api/chat/upload`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: formData,
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to upload image.');

        setMessages(prev => {
          const incoming = normalizeMessage(data);
          return prev.some(m => m.message_id === incoming.message_id) ? prev : [...prev, incoming];
        });
        setPendingImageFile(null);
        setPendingImagePreview(null);
        setPendingImageCaption('');
        (document.getElementById('chat-image-input') as HTMLInputElement | null)?.value && ((document.getElementById('chat-image-input') as HTMLInputElement).value = '');
      } catch (err: any) {
        setError(err.message || 'Failed to upload image.');
      }
      return;
    }

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

      setMessages(prevMessages => {
        const incoming = normalizeMessage(data);
        return prevMessages.some(m => m.message_id === incoming.message_id) ? prevMessages : [...prevMessages, incoming];
      });
      setNewMessage(''); 

    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleAttachClick = () => {
    if (connectionStatus !== 'accepted') return;
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Allow only images as Cloudinary supports only images
    if (!file.type.startsWith('image/')) {
      setError('Only image files are allowed.');
      e.target.value = '';
      return;
    }

    setPendingImageFile(file);
    setPendingImageCaption('');

    const previewUrl = URL.createObjectURL(file);
    setPendingImagePreview(previewUrl);
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
          <Link href={`/profile/${otherUserId}`} className="font-bold hover:underline">
            {otherUserName}
          </Link>
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
            <React.Fragment key={`${msg.message_id}-${msg.created_at}`}>
              {dateBanner}
              <div className={`flex ${isMyMessage ? 'justify-end' : 'justify-start'}`}>
                <div className={`p-3 rounded-lg max-w-xs lg:max-w-md ${
                  isMyMessage 
                  ? 'bg-indigo-600 text-white' 
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white'
                }`}>
                  {msg.attachment_url ? (
                    <a
                      href={msg.attachment_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block"
                    >
                      <img
                        src={msg.attachment_url}
                        alt="Attachment"
                        className="rounded-md max-h-64 object-contain mb-1"
                      />
                    </a>
                  ) : null}
                  {msg.body && (
                    <p>{msg.body}</p>
                  )}
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

        <form onSubmit={handleSendMessage} className="flex flex-col gap-2">
          {pendingImagePreview && (
            <div className="flex items-start gap-3 p-2 rounded-md bg-gray-100 dark:bg-gray-800">
              <img
                src={pendingImagePreview}
                alt="Preview"
                className="w-20 h-20 object-cover rounded-md flex-shrink-0"
              />
              <div className="flex-1 flex flex-col gap-2">
                <input
                  type="text"
                  value={pendingImageCaption}
                  onChange={(e) => setPendingImageCaption(e.target.value)}
                  placeholder="Add a caption... (optional)"
                  className="w-full rounded-md border border-gray-300 px-3 py-1 text-sm text-gray-900 dark:bg-gray-700 dark:text-white dark:border-gray-600"
                />
                <button
                  type="button"
                  onClick={() => {
                    setPendingImageFile(null);
                    setPendingImagePreview(null);
                    setPendingImageCaption('');
                    const input = document.getElementById('chat-image-input') as HTMLInputElement | null;
                    if (input) input.value = '';
                  }}
                  className="self-start text-xs text-red-500 hover:underline"
                >
                  Remove image
                </button>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2">
          <button 
            type="button" 
            onClick={handleAttachClick}
            disabled={isMessageLimitReached || connectionStatus !== 'accepted'} 
            className="p-2 text-gray-500 dark:text-gray-400 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
          >
            <Paperclip className="w-5 h-5" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            id="chat-image-input"
            className="hidden"
            onChange={handleFileChange}
          />
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
          </div>
        </form>
      </div>
    </div>
  );
}