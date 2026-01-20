'use client';

import { useEffect, useRef, useState } from 'react';
import { GoogleMap, useLoadScript, Marker, InfoWindow } from '@react-google-maps/api';
import { Listing } from '@/lib/types';

const mapContainerStyle = {
  width: '100%',
  height: '100%',
  // Fix blurry text issue
  transform: 'translateZ(0)',
  WebkitTransform: 'translateZ(0)',
  backfaceVisibility: 'hidden' as const,
  WebkitBackfaceVisibility: 'hidden' as const,
};

// Default center: Malaysia (Kuala Lumpur)
const defaultCenter = {
  lat: 3.1390,
  lng: 101.6869,
};

interface MapViewProps {
  listings: Listing[];
  onClaimListing: (listing: Listing) => void;
  selectedListingId?: string | null;
  onListingSelect?: (listing: Listing | null) => void;
  onGetDirections?: (listing: Listing) => void;
  currentUserId?: string | null;
  mapKey?: string | number;
}

export default function MapView({ listings, onClaimListing, selectedListingId, onListingSelect, onGetDirections, currentUserId, mapKey }: MapViewProps) {
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);
  const [mapCenter, setMapCenter] = useState(defaultCenter);
  const [mapZoom, setMapZoom] = useState(6); // Wider zoom for Malaysia overview
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const mapRef = useRef<google.maps.Map | null>(null);

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';
  
  // Use useLoadScript hook instead of LoadScript component for better control
  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: apiKey,
  });

  useEffect(() => {
    // Center map on first active listing if available, otherwise use Malaysia default
    const activeListings = listings.filter(l => l.status === 'active');
    if (activeListings.length > 0 && !selectedListingId) {
      setMapCenter({
        lat: activeListings[0].latitude,
        lng: activeListings[0].longitude,
      });
      setMapZoom(12); // Closer zoom when showing listings
    } else if (activeListings.length === 0) {
      // No active listings, center on Malaysia with wider zoom
      setMapCenter(defaultCenter);
      setMapZoom(6); // Wider zoom to show more of Malaysia
    }
  }, [listings, selectedListingId]);

  // Force map resize when component mounts or listings change
  useEffect(() => {
    if (mapRef.current && isMapLoaded) {
      // Use multiple timeouts to ensure resize happens after DOM updates
      setTimeout(() => {
        if (mapRef.current) {
          google.maps.event.trigger(mapRef.current, 'resize');
        }
      }, 100);
      setTimeout(() => {
        if (mapRef.current) {
          google.maps.event.trigger(mapRef.current, 'resize');
        }
      }, 300);
    }
  }, [isMapLoaded, listings.length]);

  // Reset map state when component remounts
  useEffect(() => {
    return () => {
      mapRef.current = null;
      setIsMapLoaded(false);
      setSelectedListing(null);
    };
  }, []);

  // When selectedListingId changes (from list click), center map and show info window
  useEffect(() => {
    if (selectedListingId && mapRef.current) {
      const listing = listings.find(l => l.id === selectedListingId);
      if (listing) {
        setSelectedListing(listing);
        setMapCenter({
          lat: listing.latitude,
          lng: listing.longitude,
        });
        setMapZoom(15); // Zoom in when a listing is selected
        // Pan to the location
        mapRef.current.panTo({ lat: listing.latitude, lng: listing.longitude });
        mapRef.current.setZoom(15);
      }
    }
  }, [selectedListingId, listings]);

  if (!apiKey) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <p className="text-red-600 mb-2">Google Maps API key not configured</p>
          <p className="text-sm text-gray-600">
            Please set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY in your environment variables
          </p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <p className="text-red-600 mb-2">Error loading Google Maps</p>
          <p className="text-sm text-gray-600">{loadError.message}</p>
        </div>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading map...</p>
        </div>
      </div>
    );
  }

  const activeListings = listings.filter((listing) => listing.status === 'active');

  // Custom food-themed pin icon with bright, visible colors
  const createCustomIcon = (isSelected: boolean = false) => {
    const size = isSelected ? 50 : 40;
    const color = isSelected ? '#f97316' : '#ea580c'; // bright orange-500 or orange-600
    const shadowColor = '#9a3412'; // orange-800 for shadow
    
    // Create a custom SVG pin with food theme
    const svg = `
      <svg width="${size}" height="${size + 10}" viewBox="0 0 40 50" xmlns="http://www.w3.org/2000/svg">
        <!-- Shadow -->
        <ellipse cx="20" cy="48" rx="8" ry="3" fill="${shadowColor}" opacity="0.3"/>
        <!-- Pin body -->
        <path d="M20 2 C12 2 6 8 6 16 C6 24 20 42 20 42 C20 42 34 24 34 16 C34 8 28 2 20 2 Z" 
              fill="${color}" 
              stroke="white" 
              stroke-width="2"/>
        <!-- Inner circle for food icon -->
        <circle cx="20" cy="16" r="6" fill="white" opacity="0.9"/>
        <!-- Food icon (plate/bowl) -->
        <path d="M14 16 Q14 20 20 20 Q26 20 26 16" 
              fill="none" 
              stroke="${color}" 
              stroke-width="1.5" 
              stroke-linecap="round"/>
        <circle cx="20" cy="14" r="2" fill="${color}"/>
      </svg>
    `;
    
    return {
      url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
      scaledSize: new google.maps.Size(size, size + 10),
      anchor: new google.maps.Point(size / 2, size + 10),
    };
  };

  return (
      <GoogleMap
        key={mapKey ? `map-${mapKey}` : undefined}
        mapContainerStyle={mapContainerStyle}
        center={mapCenter}
        zoom={mapZoom}
      onLoad={(map) => {
        mapRef.current = map;
        setIsMapLoaded(true);
        // Force a resize to ensure map renders correctly
        setTimeout(() => {
          if (map) {
            google.maps.event.trigger(map, 'resize');
          }
        }, 100);
      }}
    >
      {activeListings.map((listing) => (
        <Marker
          key={listing.id}
          position={{
            lat: listing.latitude,
            lng: listing.longitude,
          }}
          icon={createCustomIcon(selectedListingId === listing.id)}
          onClick={() => {
            setSelectedListing(listing);
            onListingSelect?.(listing);
          }}
        />
      ))}

      {selectedListing && (
        <InfoWindow
          position={{
            lat: selectedListing.latitude,
            lng: selectedListing.longitude,
          }}
          onCloseClick={() => {
            setSelectedListing(null);
            onListingSelect?.(null);
          }}
        >
          <div className="p-2 max-w-xs">
            <h3 className="font-bold text-lg mb-2 text-gray-900">{selectedListing.title}</h3>
            <p className="text-sm text-gray-600 mb-1">
              <strong>Available:</strong> {selectedListing.remaining_quantity || selectedListing.quantity}
            </p>
            {selectedListing.remaining_quantity && selectedListing.quantity !== selectedListing.remaining_quantity && (
              <p className="text-xs text-gray-500 mb-1">
                <strong>Original:</strong> {selectedListing.quantity}
              </p>
            )}
            <p className="text-sm text-gray-600 mb-1">
              <strong>Address:</strong> {selectedListing.address}
            </p>
            {selectedListing.donor_name && (
              <p className="text-xs text-gray-500 mb-1">
                <strong>Donor:</strong> {selectedListing.donor_name}
                {selectedListing.donor_contact && ` (${selectedListing.donor_contact})`}
              </p>
            )}
            {selectedListing.image_url && (
              <img
                src={selectedListing.image_url}
                alt={selectedListing.title}
                className="w-full h-32 object-cover rounded mt-2 mb-2"
              />
            )}
            <div className="flex gap-2 mt-2">
              {(() => {
                const isOwnDonation = selectedListing.donor_id === currentUserId;
                const remainingNum = selectedListing.remaining_quantity 
                  ? parseFloat(selectedListing.remaining_quantity.replace(/[^0-9.]/g, '')) || 0
                  : 0;
                const isFullyClaimed = remainingNum <= 0;
                const isDisabled = isOwnDonation || isFullyClaimed;
                
                return (
                  <button
                    onClick={() => {
                      onClaimListing(selectedListing);
                      setSelectedListing(null);
                    }}
                    disabled={isDisabled}
                    className={`flex-1 py-2 px-4 rounded-md ${
                      isDisabled
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                    title={isOwnDonation ? 'Cannot claim your own donation' : isFullyClaimed ? 'Fully claimed' : 'Claim this item'}
                  >
                    {isOwnDonation ? 'Your Donation' : isFullyClaimed ? 'Fully Claimed' : 'Claim This Item'}
                  </button>
                );
              })()}
              {onGetDirections && (
                <button
                  onClick={() => onGetDirections(selectedListing)}
                  className="bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700"
                  title="Get Directions"
                >
                  🗺️
                </button>
              )}
            </div>
          </div>
        </InfoWindow>
      )}
    </GoogleMap>
  );
}

