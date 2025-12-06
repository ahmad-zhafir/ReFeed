'use client';

import { useState, useEffect } from 'react';
import { getFirestoreDb } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { Claim, Listing } from '@/lib/types';
import { getListingsCollectionPath } from '@/lib/constants';

interface MyClaimCardProps {
  claim: Claim;
  onGetDirections: (listing: Listing) => void;
}

export default function MyClaimCard({ claim, onGetDirections }: MyClaimCardProps) {
  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchListing = async () => {
      try {
        const db = getFirestoreDb();
        const listingRef = doc(db, getListingsCollectionPath(), claim.listing_id);
        const listingDoc = await getDoc(listingRef);
        
        if (listingDoc.exists()) {
          setListing({
            id: listingDoc.id,
            ...listingDoc.data(),
          } as Listing);
        }
      } catch (error) {
        console.error('Error fetching listing:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchListing();
  }, [claim.listing_id]);

  if (loading) {
    return (
      <div className="border-2 border-gray-200 rounded-xl p-6 bg-gray-50 animate-pulse">
        <div className="h-32 bg-gray-200 rounded-lg mb-4"></div>
        <div className="h-4 bg-gray-200 rounded mb-2"></div>
        <div className="h-3 bg-gray-200 rounded w-2/3"></div>
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="border-2 border-gray-200 rounded-xl p-6 bg-gray-50">
        <p className="text-gray-500 text-center">Listing not found</p>
      </div>
    );
  }

  return (
    <div className="group border-2 border-gray-200 rounded-xl overflow-hidden bg-white hover:border-green-300 hover:shadow-md transition-all duration-200">
      {listing.image_url && (
        <div className="relative h-32 overflow-hidden bg-gray-100">
          <img
            src={listing.image_url}
            alt={listing.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        </div>
      )}
      <div className="p-4">
        <h3 className="font-bold text-base text-gray-900 mb-2 line-clamp-1">{listing.title}</h3>
        <div className="flex items-center gap-2 mb-2">
          <div className="px-2 py-1 bg-green-100 text-green-700 rounded-md text-xs font-semibold">
            You claimed: {claim.quantity}
          </div>
        </div>
        {listing.donor_name && (
          <div className="flex items-center gap-2 mb-2 text-sm text-gray-600">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <span className="truncate">{listing.donor_name}</span>
          </div>
        )}
        <div className="flex items-center gap-2 mb-3 text-xs text-gray-500">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span className="truncate">{listing.address}</span>
        </div>
        <button
          onClick={() => onGetDirections(listing)}
          className="w-full bg-green-600 text-white py-2.5 px-4 rounded-lg hover:bg-green-700 font-semibold text-sm transition-all hover:shadow-md active:scale-95"
        >
          Get Directions
        </button>
      </div>
    </div>
  );
}

