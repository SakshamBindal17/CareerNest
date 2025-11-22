// client/components/PostCard.tsx
'use client'

import React, { useState } from 'react'
import { useAuth } from '@/context/UserContext'
import { 
  MessageCircle, ThumbsUp, MoreHorizontal, X, ArrowLeft, ArrowRight, FileText, 
  Heart, Handshake, Lightbulb, Smile, Edit, Trash2, Flag // <-- NEW ICONS
} from 'lucide-react'
import Link from 'next/link'
import CommentModal from './CommentModal';
import PostPublisherModal from './PostPublisherModal';
import PostBody from './PostBody'; // Import the new component
import { PostToEdit } from './PostPublisher';
import Avatar from './Avatar'; // Import the Avatar component

const API_URL = 'http://localhost:3001';

// --- (All type definitions are the same) ---
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
  author_profile_icon_url?: string | null; // <-- NEW FIELD
};

// --- (All sub-components are the same as before) ---
const formatSmartTimestamp = (dateStr: string) => {
  const date = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const time = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  if (date.toDateString() === today.toDateString()) return `Today at ${time}`;
  if (date.toDateString() === yesterday.toDateString()) return `Yesterday at ${time}`;
  return `${date.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })} at ${time}`;
};

const ImageLightbox = ({ urls, startIndex, onClose }: { urls: string[]; startIndex: number; onClose: () => void; }) => {
  // ... (code is identical)
  const [currentIndex, setCurrentIndex] = useState(startIndex);
  const currentImage = urls[currentIndex];
  const nextImage = () => { setCurrentIndex((prev) => (prev + 1) % urls.length); };
  const prevImage = () => { setCurrentIndex((prev) => (prev - 1 + urls.length) % urls.length); };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-80" onClick={onClose}>
      <button className="absolute top-4 right-4 text-white z-50" onClick={onClose} title="Close"><X className="w-8 h-8" /></button>
      <div className="relative w-full h-full flex items-center justify-center p-4">
        <img src={currentImage} alt="Post attachment" className="max-h-[90vh] max-w-[90vw] object-contain" onClick={(e) => e.stopPropagation()} />
      </div>
      {urls.length > 1 && (
        <>
          <button className="absolute left-4 top-1/2 -translate-y-1/2 p-2 bg-black bg-opacity-50 text-white rounded-full" onClick={(e) => { e.stopPropagation(); prevImage(); }}><ArrowLeft className="w-6 h-6" /></button>
          <button className="absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-black bg-opacity-50 text-white rounded-full" onClick={(e) => { e.stopPropagation(); nextImage(); }}><ArrowRight className="w-6 h-6" /></button>
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 p-2 bg-black bg-opacity-50 text-white text-sm rounded-full">{currentIndex + 1} / {urls.length}</div>
        </>
      )}
    </div>
  );
};

const PostMediaGrid = ({ media, onImageClick }: { media: MediaItem[]; onImageClick: (index: number) => void; }) => {
  // ... (code is identical)
  const images = media.filter(m => m.type === 'image');
  const documents = media.filter(m => m.type === 'document');
  if (documents.length > 0) {
    return (
      <a href={documents[0].url} target="_blank" rel="noopener noreferrer" className="mt-4 relative p-3 border dark:border-gray-700 rounded-lg flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-700">
        <FileText className="w-10 h-10 text-indigo-500" />
        <div className="min-w-0"><p className="font-medium truncate">View Attached Document</p><p className="text-sm text-gray-500">Click to open in a new tab</p></div>
      </a>
    );
  }
  const renderImage = (url: string, index: number, className = "") => (
    <div key={index} className={`relative group ${className}`}>
      <img src={url} alt={`Attachment ${index + 1}`} className="w-full h-full object-cover rounded-md cursor-pointer border-2 border-white dark:border-gray-800" onClick={() => onImageClick(index)} />
    </div>
  );
  const renderGrid = () => {
    const imageUrls = images.map(i => i.url);
    const remaining = imageUrls.length - 4;
    if (imageUrls.length > 4) {
      return (
        <div className="grid grid-cols-2 grid-rows-2 gap-1 h-64">
          {renderImage(imageUrls[0], 0, "row-span-1 col-span-1")}
          {renderImage(imageUrls[1], 1, "row-span-1 col-span-1")}
          {renderImage(imageUrls[2], 2, "row-span-1 col-span-1")}
          <div className="relative row-span-1 col-span-1 group rounded-md cursor-pointer" onClick={() => onImageClick(3)}>
            <img src={imageUrls[3]} alt="Preview 4" className="w-full h-full object-cover rounded-md brightness-50 border-2 border-white dark:border-gray-800" />
            <div className="absolute inset-0 flex items-center justify-center text-white text-3xl font-bold">+{remaining}</div>
          </div>
        </div>
      );
    }
    switch (imageUrls.length) {
      case 1: return <div className="grid gap-1 h-80">{renderImage(imageUrls[0], 0)}</div>;
      case 2: return <div className="grid grid-cols-2 gap-1 h-64">{imageUrls.map((url, i) => renderImage(url, i))}</div>;
      case 3: return (
          <div className="grid grid-cols-2 grid-rows-2 gap-1 h-64">
            {renderImage(imageUrls[0], 0, "row-span-2 col-span-1")}
            {renderImage(imageUrls[1], 1, "row-span-1 col-span-1")}
            {renderImage(imageUrls[2], 2, "row-span-1 col-span-1")}
          </div>
        );
      case 4: return <div className="grid grid-cols-2 grid-rows-2 gap-1 h-64">{imageUrls.map((url, i) => renderImage(url, i))}</div>;
      default: return null;
    }
  };
  return <div className="mt-4">{renderGrid()}</div>;
};

const ReactionButton = ({ myReaction, onReact, onUnreact }: {
  myReaction: string | null;
  onReact: (reaction: string) => void;
  onUnreact: () => void;
}) => {
  // ... (code is identical)
  const [showPicker, setShowPicker] = useState(false);
  const reactions = [
    { type: 'like', icon: <ThumbsUp className="w-5 h-5" />, color: 'text-blue-500' },
    { type: 'celebrate', icon: <Heart className="w-5 h-5" />, color: 'text-red-500' },
    { type: 'support', icon: <Handshake className="w-5 h-5" />, color: 'text-emerald-500' },
    { type: 'insightful', icon: <Lightbulb className="w-5 h-5" />, color: 'text-amber-500' },
    { type: 'funny', icon: <Smile className="w-5 h-5" />, color: 'text-yellow-500' },
  ];
  const currentReaction = reactions.find(r => r.type === myReaction);
  const handleReact = (type: string) => {
    if (myReaction === type) { onUnreact(); } else { onReact(type); }
    setShowPicker(false);
  };
  const renderButtonContent = () => {
    if (currentReaction) {
      return (
        <>
          {React.cloneElement(currentReaction.icon, { className: `w-5 h-5 ${currentReaction.color}` })}
          <span className={`text-sm font-medium capitalize ${currentReaction.color}`}>{currentReaction.type}</span>
        </>
      );
    }
    return (<><ThumbsUp className="w-5 h-5" /><span className="text-sm font-medium">Like</span></>);
  };
  return (
    <div className="relative flex-1" onMouseEnter={() => setShowPicker(true)} onMouseLeave={() => setShowPicker(false)}>
      {showPicker && (
        <div className="absolute bottom-full flex gap-2 p-2 bg-white dark:bg-gray-700 rounded-full shadow-lg border dark:border-gray-600">
          {reactions.map(r => (
            <button key={r.type} onClick={() => handleReact(r.type)} className={`p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 transition-transform transform hover:scale-125 ${r.color}`}>
              {r.icon}
            </button>
          ))}
        </div>
      )}
      <button onClick={() => handleReact(myReaction || 'like')} className={`flex items-center gap-2 px-3 py-2 rounded-md w-full justify-center ${!myReaction && 'text-gray-600 dark:text-gray-300'} hover:bg-gray-100 dark:hover:bg-gray-700`}>
        {renderButtonContent()}
      </button>
    </div>
  );
};

const ReactionSummary = ({ reactions, commentCount, onCommentClick }: {
  reactions: ReactionCounts | null;
  commentCount: string;
  onCommentClick: () => void;
}) => {
  // ... (code is identical)
  if (!reactions && commentCount === '0') return null; 
  const reactionIcons: { [key: string]: string } = { like: '👍', celebrate: '❤️', support: '🤝', insightful: '💡', funny: '😂' };
  const sortedReactions = reactions ? Object.entries(reactions).sort(([,a], [,b]) => b - a) : [];

  return (
    <div className="flex justify-between items-center mt-4 pt-4 border-t dark:border-gray-700">
      <div className="flex gap-2 items-center">
        {sortedReactions.map(([type, count]) => (
          <div key={type} className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full" title={type}>
            <span className="text-lg">{reactionIcons[type]}</span>
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{count}</span>
          </div>
        ))}
      </div>
      <button onClick={onCommentClick} className="text-sm text-gray-500 dark:text-gray-400 hover:underline cursor-pointer">
        {commentCount} Comments
      </button>
    </div>
  );
};

// --- NEW: Report Modal Component ---
export const ReportModal = ({ isOpen, onClose, onSubmit }: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (reason: string) => void;
}) => {
  const [reason, setReason] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (reason.trim()) {
      onSubmit(reason);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md m-4" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-xl font-bold mb-4">Report Content</h2>
        <form onSubmit={handleSubmit}>
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
            Please provide a reason for reporting this content. Your feedback is important for maintaining community standards.
          </p>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full p-2 border rounded-md bg-gray-50 dark:bg-gray-700 dark:border-gray-600 focus:ring-2 focus:ring-indigo-500"
            rows={4}
            placeholder="e.g., Spam, harassment, inappropriate content..."
            required
          />
          <div className="flex justify-end gap-4 mt-6">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-md text-gray-700 dark:text-gray-200 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500">
              Cancel
            </button>
            <button type="submit" className="px-4 py-2 rounded-md text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300" disabled={!reason.trim()}>
              Submit Report
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// --- 6. Main PostCard Component (MODIFIED) ---
export default function PostCard({ post, onPostUpdated }: { 
  post: Post; 
  onPostUpdated: (message?: string, isError?: boolean) => void; // Can now accept messages
}) {
  const { user } = useAuth();
  const isMyPost = user?.id === post.author_id;
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [isCommentModalOpen, setIsCommentModalOpen] = useState(false);
  const [localCommentCount, setLocalCommentCount] = useState(parseInt(post.comment_count, 10));
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [postToEdit, setPostToEdit] = useState<PostToEdit | null>(null);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);

  // --- NEW: State for the "..." menu ---
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleReact = async (reactionType: string) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/posts/${post.post_id}/react`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`},
        body: JSON.stringify({ reactionType })
      });
      if (!res.ok) throw new Error('Failed to react');
      onPostUpdated(); 
    } catch (err) {
      console.error(err);
    }
  };

  const handleUnreact = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/posts/${post.post_id}/react`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}`},
      });
      if (!res.ok) throw new Error('Failed to un-react');
      onPostUpdated(); 
    } catch (err) {
      console.error(err);
    }
  };

  // --- NEW: Handlers for Edit, Delete, Report ---
  const handleEdit = () => {
    setPostToEdit({
      post_id: post.post_id,
      body: post.body,
      media: post.media,
    });
    setIsEditModalOpen(true);
    setIsMenuOpen(false);
  };

  const handleDelete = async () => {
    setIsMenuOpen(false);
    if (!confirm('Are you sure you want to permanently delete this post?')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/posts/${post.post_id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}`}
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete post.');
      onPostUpdated('Post deleted successfully!');
    } catch (err) {
      onPostUpdated((err as Error).message, true);
    }
  };

  const handleReport = async (reason: string) => {
    setIsReportModalOpen(false);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/posts/${post.post_id}/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`},
        body: JSON.stringify({ reason })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to report post.');
      onPostUpdated('Post reported. A moderator will review it.');
    } catch (err) {
      onPostUpdated((err as Error).message, true);
    }
  };

  const handleCommentPosted = () => {
    setLocalCommentCount(prev => prev + 1);
  };


  return (
    <>
      <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md">
        {/* Post Header */}
        <div className="flex justify-between items-start">
          <div className="flex items-center space-x-3">
            <Link href={`/profile/${post.author_id}`} className="group">
              <Avatar src={post.author_profile_icon_url} name={post.author_name} size={40} />
            </Link>
            <div>
              <Link href={`/profile/${post.author_id}`} className="font-bold text-gray-900 dark:text-white hover:underline">
                {post.author_name || '[Deleted User]'}
              </Link>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {post.author_headline || post.author_role} • {formatSmartTimestamp(post.created_at)}
              </p>
            </div>
          </div>

          {/* --- NEW: "..." Menu Button --- */}
          <div className="relative">
            <button 
              onClick={() => setIsMenuOpen(!isMenuOpen)} 
              className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <MoreHorizontal className="w-5 h-5 text-gray-500" />
            </button>

            {/* --- NEW: "..." Menu Dropdown --- */}
            {isMenuOpen && (
              <div 
                className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-700 rounded-md shadow-lg z-10 border dark:border-gray-600"
                onMouseLeave={() => setIsMenuOpen(false)} // Auto-close
              >
                {isMyPost ? (
                  <>
                    <button onClick={handleEdit} className="w-full text-left flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600">
                      <Edit className="w-4 h-4" /> Edit Post
                    </button>
                    <button onClick={handleDelete} className="w-full text-left flex items-center gap-2 px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-600">
                      <Trash2 className="w-4 h-4" /> Delete Post
                    </button>
                  </>
                ) : (
                  <button onClick={() => { setIsMenuOpen(false); setIsReportModalOpen(true); }} className="w-full text-left flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600">
                    <Flag className="w-4 h-4" /> Report Post
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ... (Post Body & Media are the same) ... */}
        {post.body && (
          <PostBody text={post.body} maxLength={250} />
        )}
        {post.media && post.media.length > 0 && (
          <PostMediaGrid 
            media={post.media} 
            onImageClick={(index) => setLightboxIndex(index)}
          />
        )}

        <ReactionSummary 
          reactions={post.reactions} 
          commentCount={String(localCommentCount)}
          onCommentClick={() => setIsCommentModalOpen(true)}
        />

        <div className="flex gap-2 mt-2 pt-2 border-t dark:border-gray-700">
          <ReactionButton 
            myReaction={post.my_reaction}
            onReact={handleReact}
            onUnreact={handleUnreact}
          />
          <button 
            onClick={() => setIsCommentModalOpen(true)}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300"
          >
            <MessageCircle className="w-5 h-5" />
            <span className="text-sm font-medium">Comment</span>
          </button>
        </div>
      </div>

      {isCommentModalOpen && (
        <CommentModal
          postId={post.post_id}
          onClose={() => setIsCommentModalOpen(false)}
          onCommentPosted={handleCommentPosted}
        />
      )}

      {isEditModalOpen && (
        <PostPublisherModal
          postToEdit={postToEdit}
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false);
            setPostToEdit(null);
          }}
          onPostUpdated={() => {
            setIsEditModalOpen(false);
            setPostToEdit(null);
            onPostUpdated('Post updated successfully!');
          }}
        />
      )}

      {isReportModalOpen && (
        <ReportModal
          isOpen={isReportModalOpen}
          onClose={() => setIsReportModalOpen(false)}
          onSubmit={handleReport}
        />
      )}

      {lightboxIndex !== null && (
        <ImageLightbox 
          urls={post.media?.filter(m => m.type === 'image').map(m => m.url) || []}
          startIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </>
  );
}