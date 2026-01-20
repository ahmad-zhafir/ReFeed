'use client';

import { useState } from 'react';
import { User } from 'firebase/auth';
import { Rating } from '@/lib/types';
import toast from 'react-hot-toast';

interface RatingModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: string;
  listingTitle: string;
  generatorName?: string;
  farmerUid: string;
  onRatingSubmitted: () => void;
}

export default function RatingModal({
  isOpen,
  onClose,
  orderId,
  listingTitle,
  generatorName,
  farmerUid,
  onRatingSubmitted,
}: RatingModalProps) {
  const [rating, setRating] = useState<number>(0);
  const [hoveredRating, setHoveredRating] = useState<number>(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (rating === 0) {
      toast.error('Please select a rating');
      return;
    }

    setSubmitting(true);
    try {
      const { getFirestoreDb } = await import('@/lib/firebase');
      const { collection, addDoc, updateDoc, doc, getDoc, Timestamp } = await import('firebase/firestore');
      const { getRatingsCollectionPath, getOrdersCollectionPath } = await import('@/lib/constants');

      // Get order to get generatorUid and listingId
      const db = getFirestoreDb();
      const orderDoc = await getDoc(doc(db, getOrdersCollectionPath(), orderId));
      
      if (!orderDoc.exists()) {
        toast.error('Order not found');
        setSubmitting(false);
        return;
      }

      const orderData = orderDoc.data();
      const generatorUid = orderData.generatorUid;
      const listingId = orderData.listingId;

      // Create rating
      const ratingData = {
        orderId,
        listingId,
        generatorUid,
        farmerUid,
        rating,
        comment: comment.trim() || undefined,
        createdAt: Timestamp.now(),
      };

      const ratingRef = await addDoc(collection(db, getRatingsCollectionPath()), ratingData);

      // Update order with ratingId
      await updateDoc(doc(db, getOrdersCollectionPath(), orderId), {
        ratingId: ratingRef.id,
      });

      // Recalculate generator's average rating
      await updateGeneratorRating(db, generatorUid);

      toast.success('Rating submitted successfully!');
      onRatingSubmitted();
      onClose();
      
      // Reset form
      setRating(0);
      setComment('');
    } catch (error) {
      console.error('Error submitting rating:', error);
      toast.error('Failed to submit rating. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const updateGeneratorRating = async (db: any, generatorUid: string) => {
    try {
      const { collection, query, where, getDocs, doc, updateDoc } = await import('firebase/firestore');
      const { getRatingsCollectionPath } = await import('@/lib/constants');

      const ratingsRef = collection(db, getRatingsCollectionPath());
      const q = query(ratingsRef, where('generatorUid', '==', generatorUid));
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        await updateDoc(doc(db, 'users', generatorUid), {
          averageRating: 0,
          totalRatings: 0,
        });
        return;
      }

      const ratings = snapshot.docs.map((doc) => doc.data().rating as number);
      const average = ratings.reduce((sum, r) => sum + r, 0) / ratings.length;
      const totalRatings = ratings.length;

      await updateDoc(doc(db, 'users', generatorUid), {
        averageRating: Math.round(average * 10) / 10, // Round to 1 decimal place
        totalRatings,
      });
    } catch (error) {
      console.error('Error updating generator rating:', error);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-[#1c2e20] rounded-xl shadow-2xl max-w-md w-full border border-gray-200 dark:border-[#234829] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-[#234829] flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Rate Your Experience</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-6 space-y-6">
          {/* Order Info */}
          <div className="bg-gray-50 dark:bg-[#112214] rounded-lg p-4 border border-gray-200 dark:border-[#234829]">
            <p className="text-sm text-gray-600 dark:text-[#92c99b] mb-1">Order</p>
            <p className="font-semibold text-slate-900 dark:text-white">{listingTitle}</p>
            {generatorName && (
              <p className="text-sm text-gray-500 dark:text-[#5d8265] mt-1">from {generatorName}</p>
            )}
          </div>

          {/* Star Rating */}
          <div>
            <label className="block text-sm font-medium text-slate-900 dark:text-white mb-3">
              How would you rate this experience? *
            </label>
            <div className="flex gap-2 justify-center">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoveredRating(star)}
                  onMouseLeave={() => setHoveredRating(0)}
                  className="focus:outline-none transition-transform hover:scale-110"
                >
                  <span
                    className={`material-symbols-outlined text-4xl ${
                      star <= (hoveredRating || rating)
                        ? 'text-yellow-400 fill-yellow-400'
                        : 'text-gray-300 dark:text-[#5d8265]'
                    }`}
                  >
                    star
                  </span>
                </button>
              ))}
            </div>
            {rating > 0 && (
              <p className="text-center text-sm text-gray-600 dark:text-[#92c99b] mt-2">
                {rating === 1 && 'Poor'}
                {rating === 2 && 'Fair'}
                {rating === 3 && 'Good'}
                {rating === 4 && 'Very Good'}
                {rating === 5 && 'Excellent'}
              </p>
            )}
          </div>

          {/* Comment */}
          <div>
            <label className="block text-sm font-medium text-slate-900 dark:text-white mb-2">
              Additional Comments (Optional)
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Share your experience..."
              rows={4}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-[#234829] bg-white dark:bg-[#102213] text-slate-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-[#5d8265] focus:outline-none focus:ring-2 focus:ring-[#13ec37] focus:border-transparent resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-[#234829] flex gap-3">
          <button
            onClick={onClose}
            disabled={submitting}
            className="flex-1 px-4 py-2.5 rounded-lg border border-gray-300 dark:border-[#234829] text-slate-700 dark:text-white font-medium hover:bg-gray-100 dark:hover:bg-[#234829] transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || rating === 0}
            className="flex-1 px-4 py-2.5 rounded-lg bg-[#13ec37] hover:bg-[#0fd630] text-[#102213] font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#102213]"></div>
                Submitting...
              </>
            ) : (
              'Submit Rating'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
