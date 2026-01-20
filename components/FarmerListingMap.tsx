'use client';

import { useEffect, useRef, useState } from 'react';
import { GoogleMap, useLoadScript, Marker, InfoWindow } from '@react-google-maps/api';
import { MarketplaceListing, UserProfile } from '@/lib/types';

const mapContainerStyle = {
  width: '100%',
  height: '100%',
  // Fix blurry text issue
  transform: 'translateZ(0)',
  WebkitTransform: 'translateZ(0)',
  backfaceVisibility: 'hidden' as const,
  WebkitBackfaceVisibility: 'hidden' as const,
};

const defaultCenter = {
  lat: 3.1390,
  lng: 101.6869,
};

interface FarmerListingMapProps {
  listings: MarketplaceListing[];
  userProfile: UserProfile | null;
  selectedListingId?: string | null;
  onListingSelect?: (listing: MarketplaceListing | null) => void;
  mapKey?: string | number;
}

export default function FarmerListingMap({ 
  listings, 
  userProfile, 
  selectedListingId, 
  onListingSelect,
  mapKey 
}: FarmerListingMapProps) {
  const [selectedListing, setSelectedListing] = useState<MarketplaceListing | null>(null);
  const [mapCenter, setMapCenter] = useState(defaultCenter);
  const [mapZoom, setMapZoom] = useState(12);
  const mapRef = useRef<google.maps.Map | null>(null);

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';
  const { isLoaded } = useLoadScript({
    googleMapsApiKey: apiKey,
  });

  useEffect(() => {
    // Center map on user location or first listing
    if (userProfile?.location?.latitude && userProfile?.location?.longitude) {
      setMapCenter({
        lat: userProfile.location.latitude,
        lng: userProfile.location.longitude,
      });
    } else if (listings.length > 0) {
      setMapCenter({
        lat: listings[0].latitude,
        lng: listings[0].longitude,
      });
    }
  }, [userProfile, listings]);

  // Center and zoom to selected listing
  useEffect(() => {
    if (selectedListingId && mapRef.current) {
      const listing = listings.find(l => l.id === selectedListingId);
      if (listing) {
        const newCenter = {
          lat: listing.latitude,
          lng: listing.longitude,
        };
        setMapCenter(newCenter);
        mapRef.current.panTo(newCenter);
        mapRef.current.setZoom(15);
      }
    }
  }, [selectedListingId, listings]);

  const createCustomIcon = (isSelected: boolean) => {
    return {
      path: google.maps.SymbolPath.CIRCLE,
      scale: isSelected ? 14 : 10,
      fillColor: '#13ec37',
      fillOpacity: isSelected ? 1 : 0.8,
      strokeColor: isSelected ? '#FFFFFF' : '#FFFFFF',
      strokeWeight: isSelected ? 3 : 2,
    };
  };

  if (!isLoaded) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-[#1a351f]" style={{ transform: 'translateZ(0)' }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#13ec37] mx-auto mb-2"></div>
          <p className="text-xs text-[#92c99b]">Loading map...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      {/* Map Legend */}
      <div className="absolute bottom-4 left-4 z-10 bg-[#1c2e20] border border-[#234829] rounded-lg shadow-lg p-3 backdrop-blur-sm">
        <h4 className="text-xs font-bold text-white mb-2 uppercase tracking-wide">Legend</h4>
        <div className="flex flex-col gap-2">
          {/* Your Current Location */}
          <div className="flex items-center gap-2">
            <div
              style={{
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                backgroundColor: '#3b82f6',
                border: '2px solid #ffffff',
                flexShrink: 0,
              }}
            />
            <span className="text-xs text-[#92c99b]">Your Current Location</span>
          </div>
          {/* Active Listings */}
          <div className="flex items-center gap-2">
            <div
              style={{
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                backgroundColor: '#13ec37',
                border: '2px solid #ffffff',
                flexShrink: 0,
              }}
            />
            <span className="text-xs text-[#92c99b]">Active Listings</span>
          </div>
        </div>
      </div>

      <GoogleMap
        mapContainerStyle={mapContainerStyle}
        center={mapCenter}
        zoom={mapZoom}
        onLoad={(map) => {
          mapRef.current = map;
          // Force proper rendering to fix blurry text
          setTimeout(() => {
            if (map) {
              google.maps.event.trigger(map, 'resize');
              // Force redraw to ensure crisp rendering
              map.setZoom(map.getZoom() || 12);
            }
          }, 100);
          // Additional resize trigger after render
          setTimeout(() => {
            if (map) {
              google.maps.event.trigger(map, 'resize');
            }
          }, 300);
        }}
      options={{
        styles: [
          {
            featureType: 'all',
            elementType: 'geometry',
            stylers: [{ color: '#1a351f' }],
          },
          {
            featureType: 'all',
            elementType: 'labels.text.fill',
            stylers: [{ color: '#ffffff', visibility: 'on' }],
          },
          {
            featureType: 'all',
            elementType: 'labels.text.stroke',
            stylers: [{ color: '#000000', weight: 0.5 }],
          },
          {
            featureType: 'all',
            elementType: 'labels.icon',
            stylers: [{ visibility: 'on' }],
          },
          {
            featureType: 'water',
            elementType: 'geometry',
            stylers: [{ color: '#234829' }],
          },
          {
            featureType: 'water',
            elementType: 'labels.text.fill',
            stylers: [{ color: '#ffffff' }],
          },
          {
            featureType: 'road',
            elementType: 'labels.text.fill',
            stylers: [{ color: '#ffffff' }],
          },
          {
            featureType: 'road',
            elementType: 'labels.text.stroke',
            stylers: [{ color: '#000000', weight: 0.5 }],
          },
          {
            featureType: 'poi',
            elementType: 'labels.text.fill',
            stylers: [{ color: '#ffffff' }],
          },
          {
            featureType: 'poi',
            elementType: 'labels.text.stroke',
            stylers: [{ color: '#000000', weight: 0.5 }],
          },
          {
            featureType: 'administrative',
            elementType: 'labels.text.fill',
            stylers: [{ color: '#ffffff' }],
          },
          {
            featureType: 'administrative',
            elementType: 'labels.text.stroke',
            stylers: [{ color: '#000000', weight: 0.5 }],
          },
        ],
        disableDefaultUI: false,
        zoomControl: true,
        streetViewControl: false,
        mapTypeControl: false,
        fullscreenControl: false,
        // Fix blurry text
        gestureHandling: 'auto',
        mapTypeId: 'roadmap',
      }}
    >
      {/* User Location Marker */}
      {userProfile?.location?.latitude && userProfile?.location?.longitude && (
        <Marker
          position={{
            lat: userProfile.location.latitude,
            lng: userProfile.location.longitude,
          }}
          icon={{
            path: google.maps.SymbolPath.CIRCLE,
            scale: 8,
            fillColor: '#3b82f6',
            fillOpacity: 1,
            strokeColor: '#FFFFFF',
            strokeWeight: 2,
          }}
          zIndex={1000}
        />
      )}

      {/* Listing Markers */}
      {listings.map((listing) => {
        const isSelected = selectedListingId === listing.id;
        return (
          <Marker
            key={listing.id}
            position={{
              lat: listing.latitude,
              lng: listing.longitude,
            }}
            icon={createCustomIcon(isSelected)}
            onClick={() => {
              setSelectedListing(listing);
              onListingSelect?.(listing);
            }}
            animation={isSelected ? google.maps.Animation.BOUNCE : undefined}
            zIndex={isSelected ? 1000 : 1}
          />
        );
      })}

      {/* Info Window */}
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
          <div className="p-2">
            <h3 className="font-bold text-gray-900 text-sm mb-1">{selectedListing.title}</h3>
            <p className="text-xs text-gray-600">{selectedListing.address}</p>
            <p className="text-xs font-semibold text-emerald-600 mt-1">
              {selectedListing.currency} {selectedListing.price.toFixed(2)}
            </p>
          </div>
        </InfoWindow>
      )}
      </GoogleMap>
    </div>
  );
}
