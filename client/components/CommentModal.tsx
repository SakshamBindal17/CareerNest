// client/components/CommentModal.tsx
'use client'

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useAuth } from '@/context/UserContext'
import { ThumbsUp, MessageCircle, Send, X, MoreHorizontal, Edit, Trash2, Flag } from 'lucide-react'
import Link from 'next/link'
import { ReportModal } from './PostCard';
import { getCaretCoordinates } from '@/utils/caretUtils'; // Import the utility
import CommentTextRenderer from './CommentTextRenderer'; // Import the new renderer
import Avatar from './Avatar'; // Import the Avatar component

const API_URL = 'http://localhost:3001';

// --- User type for mentions ---
type UserMention = {
  user_id: number;
  full_name: string;
  headline: string | null;
  profile_icon_url?: string | null; // optional profile icon for mention list
};

// Base comment type from API
type ApiComment = {
  comment_id: number;
  body: string;
  created_at: string;
  parent_comment_id: number | null;
  author_id: number;
  author_name: string | null; // <-- FIX: Can be null
  author_role: string | null;
  author_headline: string | null;
  author_profile_icon_url: string | null; // <-- Add profile icon
  like_count: string;
  i_like: boolean;
};

// Our new nested comment type for the frontend
type NestedComment = ApiComment & {
  replies: NestedComment[];
};

type CommentModalProps = {
  postId: number;
  onClose: () => void;
  onCommentPosted: () => void;
};

// --- 1. "Show More" Comment Component ---
const Comment = ({ comment, onLikeToggle, onEdit, onDelete, onReport, replies, postId, onCommentPosted, setComments, level, commentsById }: {
  comment: NestedComment;
  onLikeToggle: (commentId: number) => void;
  onEdit: (comment: ApiComment) => void;
  onDelete: (commentId: number) => void;
  onReport: (commentId: number) => void;
  replies: React.ReactNode;
  postId: number;
  onCommentPosted: () => void;
  setComments: React.Dispatch<React.SetStateAction<ApiComment[]>>;
  level: number;
  commentsById: Record<number, ApiComment>;
}) => {
  const { user } = useAuth();
  const [isExpanded, setIsExpanded] = useState(false);
  const [showReplyBox, setShowReplyBox] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const timeAgo = (dateStr: string) => new Date(dateStr).toLocaleDateString();

  const authorName = comment.author_name || '[Deleted User]';

  const isLongComment = comment.body.length > 200 || comment.body.split('\n').length > 4;
  const displayBody = isExpanded ? comment.body : (comment.body.substring(0, 200) + (isLongComment ? '...' : ''));

  let tag = '';
  let commentBody = displayBody;

  if (comment.parent_comment_id && commentsById[comment.parent_comment_id]) {
    const parentComment = commentsById[comment.parent_comment_id];
    const parentAuthorName = parentComment.author_name || '[Deleted User]';
    const expectedTag = `@${parentAuthorName}`;
    if (displayBody.startsWith(expectedTag)) {
      tag = expectedTag;
      commentBody = displayBody.substring(tag.length).trim();
    }
  }

  const containerClass = `flex items-start space-x-3 ${level > 1 ? 'mt-3' : ''} ${level === 2 ? 'ml-8 border-l-2 border-gray-200 dark:border-gray-700 pl-4' : ''}`;

  return (
    <div className={containerClass}>
      <div className="flex-shrink-0">
        <Avatar src={comment.author_profile_icon_url} name={authorName} size={32} />
      </div>
      <div className="flex-1">
        <div className="relative p-3 bg-gray-100 dark:bg-gray-700 rounded-lg">
          <div className="flex justify-between items-start">
            <div>
              <Link href={`/profile/${comment.author_id}`} className="font-bold text-gray-900 dark:text-white hover:underline text-sm">
                {authorName}
              </Link>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {comment.author_headline || comment.author_role}
              </p>
            </div>
            <div className="relative">
              <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600">
                <MoreHorizontal className="w-4 h-4" />
              </button>
              {isMenuOpen && (
                <div className="absolute right-0 mt-2 w-40 bg-white dark:bg-gray-800 rounded-md shadow-lg z-20 border dark:border-gray-600" onMouseLeave={() => setIsMenuOpen(false)}>
                  {user?.id === comment.author_id ? (
                    <>
                      <button onClick={() => { onEdit(comment); setIsMenuOpen(false); }} className="w-full text-left flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700">
                        <Edit className="w-4 h-4" /> Edit
                      </button>
                      <button onClick={() => { onDelete(comment.comment_id); setIsMenuOpen(false); }} className="w-full text-left flex items-center gap-2 px-3 py-2 text-sm text-red-500 hover:bg-gray-100 dark:hover:bg-gray-700">
                        <Trash2 className="w-4 h-4" /> Delete
                      </button>
                    </>
                  ) : (
                    <button onClick={() => { onReport(comment.comment_id); setIsMenuOpen(false); }} className="w-full text-left flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700">
                      <Flag className="w-4 h-4" /> Report
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="text-sm text-gray-800 dark:text-gray-200 mt-2 whitespace-pre-wrap">
            {tag && <span className="bg-gray-200 dark:bg-gray-600 px-2 py-1 rounded-md font-medium text-indigo-600 dark:text-indigo-400 mr-1">{tag}</span>}
            <CommentTextRenderer text={commentBody} />
          </div>
          {isLongComment && !isExpanded && (
            <button onClick={() => setIsExpanded(true)} className="text-xs font-medium text-indigo-600 dark:text-indigo-400">
              Show More
            </button>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 mt-1 pl-2">
          <button
            onClick={() => onLikeToggle(comment.comment_id)}
            className={`font-medium ${comment.i_like ? 'text-indigo-600' : 'hover:underline'}`}
          >
            Like
          </button>
          <span>•</span>
          <button onClick={() => setShowReplyBox(!showReplyBox)} className="font-medium hover:underline">
            Reply
          </button>
          <span>•</span>
          <span>{timeAgo(comment.created_at)}</span>
          {parseInt(comment.like_count, 10) > 0 && (
            <>
              <span>•</span>
              <span className="flex items-center gap-1">
                <ThumbsUp className="w-3 h-3 text-blue-500" />
                {comment.like_count}
              </span>
            </>
          )}
        </div>

        {showReplyBox && (
          <div className="mt-2">
            <CommentPublisher
              postId={postId}
              parentId={comment.comment_id}
              initialText={`@${authorName} `}
              onCommentPosted={(newReply) => {
                setComments(prev => [...prev, newReply]);
                onCommentPosted();
                setShowReplyBox(false); 
              }}
            />
          </div>
        )}
        {replies}
      </div>
    </div>
  );
};

// --- 2. Comment Publisher (MODIFIED) ---
const CommentPublisher = ({ postId, parentId, onCommentPosted, initialText = '' }: {
  postId: number;
  parentId: number | null;
  onCommentPosted: (newComment: ApiComment) => void;
  initialText?: string;
}) => {
  const { user } = useAuth();
  const [body, setBody] = useState(initialText);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // --- State for mentions ---
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionResults, setMentionResults] = useState<UserMention[]>([]);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionPosition, setMentionPosition] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (initialText) {
      inputRef.current?.focus();
    }
    setBody(initialText);
  }, [initialText]);

  // --- Effect to fetch mentions ---
  useEffect(() => {
    if (mentionQuery === null) {
      setShowMentions(false);
      return;
    }

    const fetchMentions = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_URL}/api/users/search?q=${mentionQuery}`, {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (!res.ok) throw new Error('Failed to fetch users');
        const data = await res.json();
        setMentionResults(data);
        setShowMentions(true);
      } catch (err) {
        console.error(err);
        setShowMentions(false);
      }
    };

    const debounce = setTimeout(() => {
      fetchMentions();
    }, 300);

    return () => clearTimeout(debounce);
  }, [mentionQuery]);

  const handleBodyChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setBody(text);

    const cursorPosition = e.target.selectionStart;
    const textBeforeCursor = text.substring(0, cursorPosition);
    const atMatch = textBeforeCursor.match(/@(\w*)$/);

    if (atMatch && inputRef.current) {
      const { top, left } = getCaretCoordinates(inputRef.current, cursorPosition);
      const rect = inputRef.current.getBoundingClientRect();
      setMentionPosition({ 
        top: rect.top + window.scrollY + top + 20,
        left: rect.left + window.scrollX + left 
      });
      setMentionQuery(atMatch[1]);
      setShowMentions(true);
    } else {
      setMentionQuery(null);
    }
  };

  const handleMentionSelect = (user: UserMention) => {
    const cursorPosition = inputRef.current?.selectionStart || 0;
    const textBeforeCursor = body.substring(0, cursorPosition);
    const atMatch = textBeforeCursor.match(/@(\w*)$/);

    if (atMatch && atMatch.index !== undefined) {
      const startIndex = atMatch.index;
      const newText = 
        body.substring(0, startIndex) + 
        `@${user.full_name} ` + 
        body.substring(cursorPosition);
      
      setBody(newText);
      setMentionQuery(null);
      inputRef.current?.focus();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim()) return;
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/posts/${postId}/comment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ body: body.trim(), parentCommentId: parentId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to post comment.');

      onCommentPosted(data); // Send the new comment up
      setBody(parentId ? initialText : ''); // Clear input, but keep tag if it's a reply

    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="flex items-start space-x-3 mt-4">
        <div className="flex-shrink-0">
          <Avatar src={user?.profileIconUrl} name={user?.fullName || ''} size={32} />
        </div>
        <div className="flex-1 relative">
          <textarea
            ref={inputRef}
            className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 focus:ring-2 focus:ring-indigo-500"
            rows={body.startsWith('@') ? 2 : 1}
            placeholder="Write a comment..."
            value={body}
            onChange={handleBodyChange}
          />
          <button
            type="submit"
            disabled={loading || !body.trim()}
            className="absolute right-2 top-2 p-1 rounded-full text-indigo-600 disabled:text-gray-400"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </form>

      {showMentions && (
        <div 
          className="fixed w-64 bg-gray-900 border border-gray-700 rounded-lg shadow-lg z-50"
          style={{ top: mentionPosition.top, left: mentionPosition.left }}
        >
          <div className="max-h-48 overflow-y-auto">
            {mentionResults.length > 0 ? (
              mentionResults.map(user => (
                <div 
                  key={user.user_id} 
                  className="flex items-center gap-3 p-2 hover:bg-gray-800 cursor-pointer"
                  onClick={() => handleMentionSelect(user)}
                >
                  <div className="flex-shrink-0">
                    <Avatar src={user.profile_icon_url} name={user.full_name} size={32} />
                  </div>
                  <div>
                    <p className="font-bold text-sm text-white">{user.full_name}</p>
                    <p className="text-xs text-gray-400">{user.headline || 'User'}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-3 text-center text-sm text-gray-500">
                {mentionQuery ? 'No users found.' : 'Type to search...'}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

// --- 3. Main Modal Component (MODIFIED) ---
export default function CommentModal({ postId, onClose, onCommentPosted }: CommentModalProps) {
  const [comments, setComments] = useState<ApiComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [commentToEdit, setCommentToEdit] = useState<ApiComment | null>(null);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportingCommentId, setReportingCommentId] = useState<number | null>(null);

  const fetchComments = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/posts/${postId}/comments`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch comments.');
      const data = await res.json();
      setComments(data);
    } catch (err) {
      setError((err as Error).message);
    }
    setLoading(false);
  }, [postId]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  const handleLikeToggle = async (commentId: number) => {
    // ... (This logic is the same)
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/comments/${commentId}/like`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to like comment.');

      setComments(prev => 
        prev.map(c => {
          if (c.comment_id === commentId) {
            const newLikeCount = c.i_like ? parseInt(c.like_count, 10) - 1 : parseInt(c.like_count, 10) + 1;
            return { ...c, i_like: !c.i_like, like_count: String(newLikeCount) };
          }
          return c;
        })
      );
    } catch (err) {
      console.error((err as Error).message);
    }
  };

  const handleEditComment = (comment: ApiComment) => {
    setCommentToEdit(comment);
  };

  const handleDeleteComment = async (commentId: number) => {
    try {
      const token = localStorage.getItem('token');
      await fetch(`${API_URL}/api/comments/${commentId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      setComments(prev => prev.filter(c => c.comment_id !== commentId));
    } catch (err) {
      console.error('Failed to delete comment', err);
    }
  };

  const handleReportComment = (commentId: number) => {
    setReportingCommentId(commentId);
    setIsReportModalOpen(true);
  };

  const submitReport = async (reason: string) => {
    if (!reportingCommentId) return;
    try {
      const token = localStorage.getItem('token');
      await fetch(`${API_URL}/api/comments/${reportingCommentId}/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ reason }),
      });
      // Optionally show a success message
    } catch (err) {
      console.error('Failed to report comment', err);
    }
    setIsReportModalOpen(false);
    setReportingCommentId(null);
  };

  const handleCommentUpdate = (updatedComment: ApiComment) => {
    setComments(prev => prev.map(c => c.comment_id === updatedComment.comment_id ? updatedComment : c));
    setCommentToEdit(null);
  };

  // --- FIX: This function now adds to local state and does NOT close ---
  const handleLocalCommentPosted = (newComment: ApiComment) => {
    setComments(prev => [...prev, newComment]); // Add new comment to the list
    onCommentPosted(); // Tell the PostCard to refresh its count
  };

  // --- Tree-building logic ---
  const commentsByParentId = useMemo(() => {
    const group: Record<string, ApiComment[]> = {};
    for (const comment of comments) {
      const parentId = comment.parent_comment_id || 'root';
      if (!group[parentId]) {
        group[parentId] = [];
      }
      group[parentId].push(comment);
    }
    return group;
  }, [comments]);

  // --- Recursive function to render comments ---
  const commentsById = useMemo(() => {
    const map: Record<number, ApiComment> = {};
    for (const comment of comments) {
      map[comment.comment_id] = comment;
    }
    return map;
  }, [comments]);

  // --- Recursive function to render comments ---
  const renderComments = (parentId: number | null = null, level = 1): React.ReactNode => {
    const children = commentsByParentId[parentId || 'root'];
    if (!children || children.length === 0) return null;

    return (
      <div className="space-y-3">
        {children.map(comment => (
          <Comment 
            key={comment.comment_id}
            comment={comment as NestedComment}
            onLikeToggle={handleLikeToggle}
            onEdit={handleEditComment}
            onDelete={handleDeleteComment}
            onReport={handleReportComment}
            replies={renderComments(comment.comment_id, level + 1)}
            postId={postId}
            onCommentPosted={onCommentPosted}
            setComments={setComments}
            level={level}
            commentsById={commentsById}
          />
        ))}
      </div>
    );
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60"
      onClick={onClose}
    >
      <div 
        className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-2xl h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex justify-between items-center p-4 border-b dark:border-gray-700">
          <h2 className="text-xl font-bold">Comments</h2>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Comment List */}
        <div className="flex-1 p-6 space-y-4 overflow-y-auto">
          {loading && <p>Loading comments...</p>}
          {error && <p className="text-red-500">{error}</p>}

          {renderComments(null)} {/* Start rendering top-level comments */}

          {comments.length === 0 && !loading && (
             <p className="text-center text-gray-500 dark:text-gray-400 pt-8">No comments yet. Be the first!</p>
          )}
        </div>

        {/* Modal Footer (Publisher) */}
        <div className="p-4 border-t dark:border-gray-700 bg-white dark:bg-gray-800">
          {commentToEdit ? (
            <CommentEditor
              comment={commentToEdit}
              onCommentUpdated={handleCommentUpdate}
              onCancel={() => setCommentToEdit(null)}
            />
          ) : (
            <CommentPublisher
              postId={postId}
              parentId={null} // This is always for a new, top-level comment
              onCommentPosted={handleLocalCommentPosted}
            />
          )}
        </div>
      </div>
      <ReportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        onSubmit={submitReport}
      />
    </div>
  );
}

const CommentEditor = ({ comment, onCommentUpdated, onCancel }: {
  comment: ApiComment;
  onCommentUpdated: (updatedComment: ApiComment) => void;
  onCancel: () => void;
}) => {
  const [body, setBody] = useState(comment.body);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim()) return;
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/comments/${comment.comment_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ body: body.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update comment.');
      onCommentUpdated(data);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="mt-4">
      <textarea
        className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 focus:ring-2 focus:ring-indigo-500"
        rows={3}
        value={body}
        onChange={(e) => setBody(e.target.value)}
      />
      <div className="flex justify-end gap-2 mt-2">
        <button type="button" onClick={onCancel} className="px-3 py-1 rounded-md text-sm bg-gray-200 dark:bg-gray-600">Cancel</button>
        <button type="submit" disabled={loading} className="px-3 py-1 rounded-md text-sm text-white bg-indigo-600 disabled:bg-indigo-400">Save</button>
      </div>
    </form>
  );
};