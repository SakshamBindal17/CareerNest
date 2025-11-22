// client/components/PostPublisher.tsx
'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/context/UserContext'
import { Paperclip, Send, X, ArrowLeft, ArrowRight, FileText, Trash2 } from 'lucide-react'
import Avatar from './Avatar';
import Image from 'next/image';
import { getCaretCoordinates } from '@/utils/caretUtils'; // Import the new utility

const API_URL = 'http://localhost:3001';

// --- Type Definitions ---
type UserMention = {
  user_id: number;
  full_name: string;
  headline: string | null;
};
type MediaItem = {
  type: 'image' | 'document';
  url: string;
};
type NewFile = {
  file: File;
  preview: string;
  type: 'image' | 'document';
};
export type PostToEdit = {
  post_id: number;
  body: string | null;
  media: MediaItem[] | null;
};
type PostPublisherProps = {
  postToEdit: PostToEdit | null;
  onClose: () => void;
  onPostCreated: () => void;
};

// --- Image Lightbox ---
const ImageLightbox = ({ images, startIndex, onClose, onDelete }: {
  images: (NewFile | MediaItem)[];
  startIndex: number;
  onClose: () => void;
  onDelete: (index: number) => void;
}) => {
  const [currentIndex, setCurrentIndex] = useState(startIndex);
  if (currentIndex >= images.length) {
    onClose();
    return null;
  }
  const currentImage = images[currentIndex];
  const getUrl = (img: NewFile | MediaItem) => (img as NewFile).preview || (img as MediaItem).url;

  const nextImage = () => setCurrentIndex((prev) => (prev + 1) % images.length);
  const prevImage = () => setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation(); 
    onDelete(currentIndex);
    if (images.length === 1) {
      onClose();
    } else if (currentIndex >= images.length - 1) {
      setCurrentIndex(images.length - 2);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-80" onClick={onClose}>
      <div className="absolute top-4 right-4 z-50 flex gap-4">
        <button className="text-white" onClick={handleDelete} title="Delete Image"><Trash2 className="w-7 h-7" /></button>
        <button className="text-white" onClick={onClose} title="Close"><X className="w-8 h-8" /></button>
      </div>
      <div className="relative w-full h-full flex items-center justify-center p-4" onClick={(e) => e.stopPropagation()}>
        <Image src={getUrl(currentImage)} alt="Post attachment" layout="fill" objectFit="contain" />
      </div>
      {images.length > 1 && (
        <>
          <button className="absolute left-4 top-1/2 -translate-y-1/2 p-2 bg-black bg-opacity-50 text-white rounded-full" onClick={(e) => { e.stopPropagation(); prevImage(); }}><ArrowLeft className="w-6 h-6" /></button>
          <button className="absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-black bg-opacity-50 text-white rounded-full" onClick={(e) => { e.stopPropagation(); nextImage(); }}><ArrowRight className="w-6 h-6" /></button>
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 p-2 bg-black bg-opacity-50 text-white text-sm rounded-full">{currentIndex + 1} / {images.length}</div>
        </>
      )}
    </div>
  );
};

// --- Media Preview Grid ---
const MediaPreview = ({ files, existingMedia, onRemoveFile, onRemoveExisting, onImageClick }: {
  files: NewFile[];
  existingMedia: MediaItem[];
  onRemoveFile: (file: NewFile) => void;
  onRemoveExisting: (media: MediaItem) => void;
  onImageClick: (index: number) => void;
}) => {
  const allMedia = [...existingMedia, ...files];
  const images = allMedia.filter(m => m.type === 'image' || (m as NewFile).file?.type.startsWith('image/'));
  const documents = allMedia.filter(m => m.type === 'document' || (m as NewFile).file?.type.startsWith('application/'));

  const getUrl = (img: NewFile | MediaItem) => (img as NewFile).preview || (img as MediaItem).url;
  const getName = (doc: NewFile | MediaItem) => (doc as NewFile).file?.name || 'Attached Document';
  const getSize = (doc: NewFile | MediaItem) => (doc as NewFile).file?.size || 0;

  if (documents.length > 0) {
    const doc = documents[0];
    return (
      <div className="relative p-2 mt-4 border dark:border-gray-700 rounded-lg flex items-center gap-3">
        <FileText className="w-10 h-10 text-indigo-500" />
        <div className="min-w-0">
          <p className="font-medium truncate">{getName(doc)}</p>
          <p className="text-sm text-gray-500">{(getSize(doc) / 1024).toFixed(1)} KB</p>
        </div>
        <button 
          type="button" 
          onClick={() => { if ((doc as NewFile).file) { onRemoveFile(doc as NewFile) } else { onRemoveExisting(doc as MediaItem) }}} 
          className="absolute top-1 right-1 p-1 bg-gray-800 bg-opacity-50 rounded-full text-white"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    );
  }

  const renderImage = (file: NewFile | MediaItem, index: number, className = "") => (
    <div key={index} className={`relative group ${className}`} onClick={() => onImageClick(index)}>
      <Image 
        src={getUrl(file)} 
        alt={`Preview ${index + 1}`}
        layout="fill"
        objectFit="cover"
        className="rounded-md"
      />
      <button 
        type="button" 
        onClick={(e) => { 
          e.stopPropagation(); 
          if ((file as NewFile).file) {
            onRemoveFile(file as NewFile);
          } else {
            onRemoveExisting(file as MediaItem);
          }
        }} 
        className="absolute top-1 right-1 p-1 bg-gray-800 bg-opacity-50 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity z-10"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );

  const renderGrid = () => {
    const remaining = images.length - 4;
    if (images.length > 4) {
      return (
        <div className="grid grid-cols-2 grid-rows-2 gap-1 h-64">
          {renderImage(images[0], 0, "row-span-1 col-span-1")}
          {renderImage(images[1], 1, "row-span-1 col-span-1")}
          {renderImage(images[2], 2, "row-span-1 col-span-1")}
          <div 
            className="relative row-span-1 col-span-1 group rounded-md cursor-pointer"
            onClick={() => onImageClick(3)}
          >
            <Image src={getUrl(images[3])} alt="Preview 4" layout="fill" objectFit="cover" className="rounded-md brightness-50" />
            <div className="absolute inset-0 flex items-center justify-center text-white text-3xl font-bold">+{remaining}</div>
          </div>
        </div>
      );
    }
    switch (images.length) {
      case 1: return <div className="grid gap-1 h-80">{renderImage(images[0], 0)}</div>;
      case 2: return <div className="grid grid-cols-2 gap-1 h-64">{images.map((img, i) => renderImage(img, i))}</div>;
      case 3: return (
          <div className="grid grid-cols-2 grid-rows-2 gap-1 h-64">
            {renderImage(images[0], 0, "row-span-2 col-span-1")}
            {renderImage(images[1], 1, "row-span-1 col-span-1")}
            {renderImage(images[2], 2, "row-span-1 col-span-1")}
          </div>
        );
      case 4: return <div className="grid grid-cols-2 grid-rows-2 gap-1 h-64">{images.map((img, i) => renderImage(img, i))}</div>;
      default: return null;
    }
  };

  return <div className="mt-4">{renderGrid()}</div>;
};

// --- Post Publisher Component ---
export default function PostPublisher({ postToEdit, onClose, onPostCreated }: PostPublisherProps) {
  const { user } = useAuth();
  const isEditMode = !!postToEdit;

  const [body, setBody] = useState(postToEdit?.body || '');
  const [newFiles, setNewFiles] = useState<NewFile[]>([]); 
  const [existingMedia, setExistingMedia] = useState<MediaItem[]>(postToEdit?.media || []); 

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  // --- State for mentions ---
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionResults, setMentionResults] = useState<UserMention[]>([]);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionPosition, setMentionPosition] = useState({ top: 0, left: 0 });
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const allFiles = [...existingMedia, ...newFiles];
  const isButtonDisabled = loading || !body.trim();

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

    if (atMatch && textareaRef.current) {
      const { top, left } = getCaretCoordinates(textareaRef.current, cursorPosition);
      const rect = textareaRef.current.getBoundingClientRect();
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
    const cursorPosition = textareaRef.current?.selectionStart || 0;
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
      textareaRef.current?.focus();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const selectedFiles = e.target.files;
    if (!selectedFiles) return;

    const filesArray = Array.from(selectedFiles);
    let filesToProcess: File[] = [];

    if (filesArray.some(f => !f.type.startsWith('image/'))) {
      if (allFiles.length > 0) { 
        setError("You cannot mix images and documents.");
        return;
      }
      if (filesArray.length > 1) {
        setError("You can only upload 1 document at a time.");
        return;
      }
      filesToProcess = filesArray;
    } 
    else {
      if (allFiles.length > 0 && allFiles[0].type === 'document') { 
        setError("You cannot mix images and documents.");
        return;
      }

      const existingNewFileNames = new Set(newFiles.map(f => f.file.name));
      const existingMediaFileNames = new Set(existingMedia.map(m => m.url.split('/').pop()));

      const uniqueNewFiles = filesArray.filter(f => !existingNewFileNames.has(f.name) && !existingMediaFileNames.has(f.name));

      if ((allFiles.length + uniqueNewFiles.length) > 5) {
        setError("You can upload a maximum of 5 images.");
        filesToProcess = uniqueNewFiles.slice(0, 5 - allFiles.length);
      } else {
        filesToProcess = uniqueNewFiles;
      }
    }

    const newFileObjects = filesToProcess.map(file => ({
      file: file,
      preview: URL.createObjectURL(file),
      type: (file.type.startsWith('image/') ? 'image' : 'document') as 'image' | 'document'
    }));

    setNewFiles(prevFiles => [...prevFiles, ...newFileObjects]);
  };

  const removeNewFile = (fileToRemove: NewFile) => {
    setNewFiles(prevFiles => prevFiles.filter(f => f !== fileToRemove));
  };
  const removeExistingMedia = (mediaToRemove: MediaItem) => {
    setExistingMedia(prevMedia => prevMedia.filter(m => m !== mediaToRemove));
  };

  const handlePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim()) {
      setError("Post text cannot be empty.");
      return;
    }

    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append('body', body.trim());

    newFiles.forEach(f => {
      formData.append('attachments', f.file);
    });

    existingMedia.forEach(m => {
      formData.append('mediaToKeep', m.url);
    });

    const url = isEditMode
      ? `${API_URL}/api/posts/${postToEdit.post_id}`
      : `${API_URL}/api/posts`;

    const method = isEditMode ? 'PUT' : 'POST';

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(url, {
        method: method,
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create post.');

      onPostCreated(); 
      onClose(); 

    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An unknown error occurred while posting.');
      }
    }
    setLoading(false);
  };

  return (
    <>
      <div 
        className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60"
        onClick={onClose}
      >
        <div 
          className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex justify-between items-center p-4 border-b dark:border-gray-700">
            <h2 className="text-xl font-bold">
              {isEditMode ? 'Edit Your Post' : 'Create a New Post'}
            </h2>
            <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 max-h-[70vh] overflow-y-auto">
            <div className="flex items-center gap-3 mb-4">
              <Avatar src={user?.profileIconUrl} name={user?.fullName || 'User'} size={40} />
              <div>
                <p className="font-semibold text-sm">{user?.fullName}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Share an update with your network</p>
              </div>
            </div>
            <form id="post-form" onSubmit={handlePost}>
              <div className="relative">
                <textarea
                  ref={textareaRef}
                  className="w-full p-2 border-none rounded-md dark:bg-gray-700 focus:ring-2 focus:ring-indigo-500"
                  rows={5}
                  placeholder={`What's on your mind, ${user?.fullName.split(' ')[0]}?`}
                  value={body}
                  onChange={handleBodyChange}
                />
              </div>

              {allFiles.length > 0 && (
                <MediaPreview 
                  files={newFiles}
                  existingMedia={existingMedia}
                  onRemoveFile={removeNewFile} 
                  onRemoveExisting={removeExistingMedia}
                  onImageClick={(index) => setLightboxIndex(index)}
                />
              )}

              {error && <p className="text-sm text-red-500 mt-2">{error}</p>}
            </form>
          </div>

          <div className="flex justify-between items-center p-4 border-t dark:border-gray-700">
            <label className={`cursor-pointer p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 ${
              (allFiles.length >= 5 || (allFiles.length > 0 && allFiles[0].type === 'document')) ? 'opacity-50 cursor-not-allowed' : ''
            }`}>
              <Paperclip className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              <input 
                type="file" 
                className="hidden" 
                accept="image/*,.pdf"
                multiple 
                onChange={handleFileChange}
                onClick={(e) => (e.currentTarget.value = '')} 
                disabled={allFiles.length >= 5 || (allFiles.length > 0 && allFiles[0].type === 'document')}
              />
            </label>

            <button 
              type="submit" 
              form="post-form"
              disabled={isButtonDisabled}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading ? (isEditMode ? 'Saving...' : 'Posting...') : (isEditMode ? 'Save Changes' : 'Post')}
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

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
                  <div className="w-8 h-8 bg-gray-500 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0">
                    {user.full_name[0]}
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

      {lightboxIndex !== null && (
        <ImageLightbox 
          images={[...existingMedia, ...newFiles].filter(m => m.type === 'image' || ((m as NewFile).file?.type.startsWith('image/')))}
          startIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onDelete={(indexToRemove) => {
            const allMedia = [...existingMedia, ...newFiles].filter(m => m.type === 'image' || ((m as NewFile).file?.type.startsWith('image/')));
            const itemToRemove = allMedia[indexToRemove];
            if ((itemToRemove as NewFile).file) {
              removeNewFile(itemToRemove as NewFile);
            } else {
              removeExistingMedia(itemToRemove as MediaItem);
            }

            if (allMedia.length === 1) {
              setLightboxIndex(null); 
            } else if (indexToRemove >= allMedia.length - 1) {
              setLightboxIndex(allMedia.length - 2);
            }
          }}
        />
      )}
    </>
  );
}