// client/components/TextWithSeeMore.tsx
'use client';

import React, { useState, useEffect } from 'react';

type TextWithSeeMoreProps = {
  text: string;
  maxLength: number;
};

const TextWithSeeMore: React.FC<TextWithSeeMoreProps> = ({ text, maxLength }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isTruncated, setIsTruncated] = useState(false);

  useEffect(() => {
    setIsTruncated(text.length > maxLength);
  }, [text, maxLength]);

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  const renderText = () => {
    if (!isTruncated || isExpanded) {
      return text;
    }
    return `${text.substring(0, maxLength)}...`;
  };

  return (
    <div>
      <p className="my-4 text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
        {renderText()}
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

export default TextWithSeeMore;
