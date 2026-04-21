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
  if (!rating || rating === 0 || isNaN(Number(rating))) {
    return (
      <div className="flex items-center gap-1 text-gray-400 dark:text-[#5d8265]">
        <span className="text-xs">No ratings yet</span>
      </div>
    );
  }

  // Ensure rating is a number and format to 1 decimal place
  const numericRating = typeof rating === 'number' ? rating : parseFloat(String(rating));
  // Force 1 decimal place display (e.g., 4 becomes 4.0)
  const formattedRating = isNaN(numericRating) ? '0.0' : Number(numericRating.toFixed(1)).toFixed(1);

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

  const starScale = {
    sm: 'scale-75',
    md: 'scale-100',
    lg: 'scale-100',
  };

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-0">
        {Array.from({ length: 5 }).map((_, i) => {
          const fillRatio = Math.max(0, Math.min(1, numericRating - i));
          const isPartialStar = fillRatio > 0 && fillRatio < 1;
          return (
            <span key={`star-${i}`} className={`relative inline-block leading-none -mr-[2px] ${starSize[size]}`}>
              <span className={`material-symbols-outlined inline-block origin-left transform-gpu ${starScale[size]} text-gray-400 dark:text-[#48664e]`}>star</span>
              <span
                className="absolute inset-y-0 left-0 overflow-hidden whitespace-nowrap"
                style={{ width: `${fillRatio * 100}%` }}
              >
                <span className={`material-symbols-outlined inline-block origin-left transform-gpu ${starScale[size]} ${isPartialStar ? 'text-amber-400' : 'text-yellow-400'} fill-current`}>star</span>
              </span>
            </span>
          );
        })}
      </div>
      
      <div className="flex items-center gap-1.5">
        <span className={`font-semibold text-slate-900 dark:text-white ${sizeClasses[size]}`}>
          {formattedRating}
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
