// client/components/PostBody.tsx
'use client';

import React, { useState, useEffect } from 'react';
import PostTextRenderer from './PostTextRenderer'; // Import the new renderer

type PostBodyProps = {
  text: string;
  maxLength: number;
};

const PostBody: React.FC<PostBodyProps> = ({ text, maxLength }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isTruncated, setIsTruncated] = useState(false);

  useEffect(() => {
    setIsTruncated(text.length > maxLength);
  }, [text, maxLength]);

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  const displayText = isTruncated && !isExpanded ? `${text.substring(0, maxLength)}...` : text;

  return (
    <div>
      <p className="my-4 text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
        <PostTextRenderer text={displayText} />
      </p>
      {isTruncated && (
        <button
          onClick={toggleExpanded}
          className="text-indigo-500 hover:underline text-sm font-semibold"
        >
          {isExpanded ? 'See Less' : 'See More'}
        </button>
      )}
    </div>
  );
};

export default PostBody;
