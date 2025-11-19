// client/components/CommentTextRenderer.tsx
'use client';

import React from 'react';

type CommentTextRendererProps = {
  text: string;
};

const CommentTextRenderer: React.FC<CommentTextRendererProps> = ({ text }) => {
  // Regex to match both @mentions and URLs
  const pattern = /(https?:\/\/[^\s]+)|(@[a-zA-Z0-9\s_.-]+)/g;
  const parts = text.split(pattern).filter(Boolean);

  return (
    <>
      {parts.map((part, index) => {
        // Check if it's a URL
        if (part.startsWith('http')) {
          return (
            <a
              key={index}
              href={part}
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-500 hover:underline"
            >
              {part}
            </a>
          );
        }
        // Check if it's a mention
        if (part.startsWith('@')) {
          return (
            <span key={index} className="font-semibold">
              {part}
            </span>
          );
        }
        // Otherwise, it's just plain text
        return part;
      })}
    </>
  );
};

export default CommentTextRenderer;
