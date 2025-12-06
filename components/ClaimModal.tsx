'use client';

import { useState, useEffect } from 'react';
import { Listing } from '@/lib/types';

interface ClaimModalProps {
  listing: Listing | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (listingId: string, quantity: string) => void;
  maxQuantity: string;
}

export default function ClaimModal({ listing, isOpen, onClose, onConfirm, maxQuantity }: ClaimModalProps) {
  const [claimQuantity, setClaimQuantity] = useState('');

  useEffect(() => {
    if (isOpen && listing) {
      setClaimQuantity(maxQuantity); // Default to remaining quantity
    }
  }, [isOpen, listing, maxQuantity]);

  if (!isOpen || !listing) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (claimQuantity && parseFloat(claimQuantity) > 0) {
      onConfirm(listing.id, claimQuantity);
      setClaimQuantity('');
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Claim Food Item</h2>
        
        <div className="mb-4">
          <h3 className="font-bold text-lg mb-2 text-gray-900">{listing.title}</h3>
          <p className="text-sm text-gray-600 mb-1">
            <strong>Available Quantity:</strong> {maxQuantity}
          </p>
          {listing.quantity !== maxQuantity && (
            <p className="text-xs text-green-600 mb-1">
              <strong>Original Quantity:</strong> {listing.quantity}
            </p>
          )}
          {listing.donor_name && (
            <p className="text-xs text-gray-500 mb-1">
              <strong>Donor:</strong> {listing.donor_name}
            </p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              How much do you want to claim?
            </label>
            <input
              type="text"
              value={claimQuantity}
              onChange={(e) => setClaimQuantity(e.target.value)}
              required
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all text-gray-900 placeholder-gray-400"
              placeholder={maxQuantity}
            />
            <p className="text-xs text-gray-500 mt-1">
              Enter the quantity you want (e.g., "5 servings", "2 boxes", "10 pieces")
            </p>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-gray-200 text-gray-800 py-2.5 px-4 rounded-lg hover:bg-gray-300 transition-all font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 text-white py-2.5 px-4 rounded-lg hover:from-green-700 hover:to-emerald-700 transition-all shadow-md hover:shadow-lg font-semibold"
            >
              Confirm Claim
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

