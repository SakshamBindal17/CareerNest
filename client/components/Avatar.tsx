"use client";

import Image from 'next/image';
import { FC } from 'react';

interface AvatarProps {
  src: string | null | undefined;
  name: string;
  size?: number;
}

const getInitials = (name: string) => {
  if (!name) return '?';
  const words = name.split(' ');
  if (words.length > 1) {
    return (words[0][0] + words[words.length - 1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
};

const Avatar: FC<AvatarProps> = ({ src, name, size = 40 }) => {
  const initials = getInitials(name);

  return (
    <div
      className="relative rounded-full flex items-center justify-center bg-gray-300 dark:bg-gray-600 overflow-hidden"
      style={{ width: size, height: size }}
    >
      {src ? (
        <Image
          src={src}
          alt={name || 'User avatar'}
          layout="fill"
          objectFit="cover"
          className="rounded-full"
        />
      ) : (
        <span
          className="font-bold text-white"
          style={{ fontSize: size * 0.4 }}
        >
          {initials}
        </span>
      )}
    </div>
  );
};

export default Avatar;
