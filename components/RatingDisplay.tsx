'use client';

interface RatingDisplayProps {
  rating: number; // 1-5
  totalRatings?: number;
  showCount?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export default function RatingDisplay({
  rating,
  totalRatings,
  showCount = true,
  size = 'md',
}: RatingDisplayProps) {
  if (!rating || rating === 0) {
    return (
      <div className="flex items-center gap-1 text-gray-400 dark:text-[#5d8265]">
        <span className="text-xs">No ratings yet</span>
      </div>
    );
  }

  const sizeClasses = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
  };

  const starSize = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-xl',
  };

  const fullStars = Math.floor(rating);
  const hasHalfStar = rating % 1 >= 0.5;
  const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-0.5">
        {/* Full stars */}
        {Array.from({ length: fullStars }).map((_, i) => (
          <span
            key={`full-${i}`}
            className={`material-symbols-outlined ${starSize[size]} text-yellow-400 fill-yellow-400`}
          >
            star
          </span>
        ))}
        
        {/* Half star */}
        {hasHalfStar && (
          <span className={`material-symbols-outlined ${starSize[size]} text-yellow-400 fill-yellow-400`}>
            star_half
          </span>
        )}
        
        {/* Empty stars */}
        {Array.from({ length: emptyStars }).map((_, i) => (
          <span
            key={`empty-${i}`}
            className={`material-symbols-outlined ${starSize[size]} text-gray-300 dark:text-[#5d8265]`}
          >
            star
          </span>
        ))}
      </div>
      
      <div className="flex items-center gap-1.5">
        <span className={`font-semibold text-slate-900 dark:text-white ${sizeClasses[size]}`}>
          {rating.toFixed(1)}
        </span>
        {showCount && totalRatings !== undefined && totalRatings > 0 && (
          <span className={`text-gray-500 dark:text-[#5d8265] ${sizeClasses.sm}`}>
            ({totalRatings} {totalRatings === 1 ? 'rating' : 'ratings'})
          </span>
        )}
      </div>
    </div>
  );
}
