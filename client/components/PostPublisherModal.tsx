import React from 'react';
import PostPublisher, { PostToEdit } from './PostPublisher';

type PostPublisherModalProps = {
  postToEdit: PostToEdit | null;
  isOpen: boolean;
  onClose: () => void;
  onPostUpdated: () => void;
};

export default function PostPublisherModal({ isOpen, postToEdit, onClose, onPostUpdated }: PostPublisherModalProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <PostPublisher
      postToEdit={postToEdit}
      onClose={onClose}
      onPostCreated={onPostUpdated}
    />
  );
}
