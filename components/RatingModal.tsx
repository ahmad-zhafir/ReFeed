'use client';

import { useState } from 'react';
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
      const ratingData: any = {
        orderId,
        listingId,
        generatorUid,
        farmerUid,
        rating,
        createdAt: Timestamp.now(),
      };

      // Only add comment if it's not empty
      const trimmedComment = comment.trim();
      if (trimmedComment) {
        ratingData.comment = trimmedComment;
      }

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

  const ratingLabels = ['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-md"
         style={{ background: 'rgba(10, 22, 12, 0.75)' }}>
      <div className="font-fraunces rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border"
           style={{ background: 'var(--rf-moss)', color: 'var(--rf-bone)', borderColor: 'rgba(241,234,216,0.14)' }}>
        {/* Header */}
        <div className="px-6 py-5 border-b flex items-center justify-between"
             style={{ borderColor: 'rgba(241,234,216,0.10)' }}>
          <div>
            <p className="rf-eyebrow mb-1">§ Field note</p>
            <h2 className="font-fraunces fraunces-wonk text-2xl font-light tracking-[-0.03em]">
              Rate the <span className="italic" style={{ color: 'var(--rf-sap)' }}>kitchen</span>
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="size-9 rounded-full flex items-center justify-center opacity-70 hover:opacity-100 transition-opacity border"
            style={{ borderColor: 'rgba(241,234,216,0.18)' }}
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="px-6 py-6 space-y-6">
          {/* Order info */}
          <div className="rounded-xl p-4 border"
               style={{ borderColor: 'rgba(241,234,216,0.10)', background: 'rgba(13,26,16,0.5)' }}>
            <p className="rf-eyebrow mb-1">Parcel</p>
            <p className="font-fraunces text-lg font-medium">{listingTitle}</p>
            {generatorName && (
              <p className="font-instrument italic text-base mt-1" style={{ color: 'rgba(241,234,216,0.65)' }}>
                from {generatorName}
              </p>
            )}
          </div>

          {/* Star rating */}
          <div>
            <label className="rf-eyebrow mb-3 block">How was it? *</label>
            <div className="flex gap-2 justify-center">
              {[1, 2, 3, 4, 5].map((star) => {
                const active = star <= (hoveredRating || rating);
                return (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHoveredRating(star)}
                    onMouseLeave={() => setHoveredRating(0)}
                    className="focus:outline-none transition-transform hover:scale-110"
                  >
                    <span
                      className="material-symbols-outlined text-4xl transition-colors"
                      style={{
                        color: active ? 'var(--rf-sap)' : 'rgba(241,234,216,0.25)',
                        fontVariationSettings: active ? '"FILL" 1' : '"FILL" 0',
                      }}
                    >
                      star
                    </span>
                  </button>
                );
              })}
            </div>
            {rating > 0 && (
              <p className="text-center font-instrument italic text-base mt-3"
                 style={{ color: 'var(--rf-sap)' }}>
                {ratingLabels[rating]}
              </p>
            )}
          </div>

          {/* Comment */}
          <div>
            <label className="rf-eyebrow mb-2 block">Notes (optional)</label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Share what stood out…"
              rows={4}
              className="rf-input w-full px-4 py-3 resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-5 border-t flex gap-3"
             style={{ borderColor: 'rgba(241,234,216,0.10)' }}>
          <button
            onClick={onClose}
            disabled={submitting}
            className="flex-1 inline-flex items-center justify-center h-12 rounded-full font-mono-jb text-[11px] uppercase tracking-[0.25em] border transition-colors hover:bg-white/5 disabled:opacity-50"
            style={{ borderColor: 'rgba(241,234,216,0.2)', color: 'var(--rf-bone)' }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || rating === 0}
            className="group flex-1 inline-flex items-center justify-between pl-5 pr-1.5 h-12 rounded-full font-mono-jb text-[11px] uppercase tracking-[0.25em] transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
            style={{ background: 'var(--rf-sap)', color: 'var(--rf-forest)' }}
          >
            <span>{submitting ? 'Submitting…' : 'Submit'}</span>
            <span className="size-9 rounded-full flex items-center justify-center transition-transform group-hover:rotate-45"
                  style={{ background: 'var(--rf-forest)', color: 'var(--rf-sap)' }}>
              {submitting ? (
                <span className="size-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
