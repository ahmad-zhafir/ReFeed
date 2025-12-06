'use client';

import Image from 'next/image';
import { useState } from 'react';

export default function Logo({ className = "w-10 h-10" }: { className?: string }) {
  const [imageError, setImageError] = useState(false);

  return (
    <div className={`${className} relative flex items-center justify-center`}>
      {imageError ? (
        // Placeholder when image doesn't exist
        <div className="w-full h-full bg-gradient-to-br from-green-400 to-emerald-500 rounded-lg flex items-center justify-center shadow-sm">
          <span className="text-white font-bold text-xs">FL</span>
        </div>
      ) : (
        <Image
          src="/images/logonew.svg"
          alt="Food Loop Logo"
          width={40}
          height={40}
          className="object-contain"
          onError={() => setImageError(true)}
          priority
        />
      )}
    </div>
  );
}

