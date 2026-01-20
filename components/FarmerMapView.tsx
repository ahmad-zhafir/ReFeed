'use client';

import { useEffect, useRef, useState } from 'react';
import { GoogleMap, useLoadScript, Marker, InfoWindow, Circle } from '@react-google-maps/api';
import { UserProfile } from '@/lib/types';

const mapContainerStyle = {
  width: '100%',
  height: '100%',
};

// Default center: Malaysia (Kuala Lumpur)
const defaultCenter = {
  lat: 3.1390,
  lng: 101.6869,
};

interface FarmerMapViewProps {
  farmers: UserProfile[];
  generatorLocation?: { latitude: number; longitude: number };
  onFarmerSelect?: (farmer: UserProfile | null) => void;
  selectedFarmerId?: string | null;
}

export default function FarmerMapView({ 
  farmers, 
  generatorLocation, 
  onFarmerSelect,
  selectedFarmerId 
}: FarmerMapViewProps) {
  const [selectedFarmer, setSelectedFarmer] = useState<UserProfile | null>(null);
  const [mapCenter, setMapCenter] = useState(defaultCenter);
  const [mapZoom, setMapZoom] = useState(10);
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const mapRef = useRef<google.maps.Map | null>(null);

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';
  
  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: apiKey,
  });

  useEffect(() => {
    // Center map on generator location if available, otherwise center on first farmer
    if (generatorLocation?.latitude && generatorLocation?.longitude) {
      setMapCenter({
        lat: generatorLocation.latitude,
        lng: generatorLocation.longitude,
      });
      setMapZoom(12);
    } else if (farmers.length > 0 && farmers[0].location) {
      setMapCenter({
        lat: farmers[0].location.latitude,
        lng: farmers[0].location.longitude,
      });
      setMapZoom(10);
    }
  }, [generatorLocation, farmers]);

  useEffect(() => {
    if (mapRef.current && isMapLoaded) {
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
  }, [isMapLoaded, farmers.length]);

  useEffect(() => {
    if (selectedFarmerId && mapRef.current) {
      const farmer = farmers.find(f => f.id === selectedFarmerId);
      if (farmer && farmer.location) {
        setSelectedFarmer(farmer);
        setMapCenter({
          lat: farmer.location.latitude,
          lng: farmer.location.longitude,
        });
        setMapZoom(13);
        if (mapRef.current) {
          mapRef.current.panTo({ lat: farmer.location.latitude, lng: farmer.location.longitude });
          mapRef.current.setZoom(13);
        }
      }
    }
  }, [selectedFarmerId, farmers]);

  const handleMarkerClick = (farmer: UserProfile) => {
    setSelectedFarmer(farmer);
    if (onFarmerSelect) {
      onFarmerSelect(farmer);
    }
    if (farmer.location) {
      setMapCenter({
        lat: farmer.location.latitude,
        lng: farmer.location.longitude,
      });
      setMapZoom(13);
      if (mapRef.current) {
        mapRef.current.panTo({ lat: farmer.location.latitude, lng: farmer.location.longitude });
      }
    }
  };

  const handleMapLoad = (map: google.maps.Map) => {
    mapRef.current = map;
    setIsMapLoaded(true);
  };

  if (loadError) {
    return (
      <div className="flex items-center justify-center h-full bg-[#1c2e20] text-white">
        <p className="text-red-400">Error loading map. Please check your Google Maps API key.</p>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center h-full bg-[#1c2e20] text-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#13ec37] mx-auto mb-4"></div>
          <p>Loading map...</p>
        </div>
      </div>
    );
  }

  // Filter farmers with valid location
  const farmersWithLocation = farmers.filter(f => f.location && f.location.latitude && f.location.longitude);

  return (
    <div className="relative w-full h-full">
      <GoogleMap
        mapContainerStyle={mapContainerStyle}
        center={mapCenter}
        zoom={mapZoom}
        onLoad={handleMapLoad}
        options={{
          styles: [
            {
              featureType: 'poi',
              elementType: 'labels',
              stylers: [{ visibility: 'off' }],
            },
          ],
          disableDefaultUI: false,
          zoomControl: true,
          streetViewControl: false,
          mapTypeControl: true,
          fullscreenControl: true,
        }}
      >
        {/* Generator location marker */}
        {generatorLocation?.latitude && generatorLocation?.longitude && (
          <Marker
            position={{
              lat: generatorLocation.latitude,
              lng: generatorLocation.longitude,
            }}
            icon={{
              path: google.maps.SymbolPath.CIRCLE,
              scale: 8,
              fillColor: '#FF0000',
              fillOpacity: 1,
              strokeColor: '#FFFFFF',
              strokeWeight: 2,
            }}
            title="Your Location"
          />
        )}

        {/* Farmer markers */}
        {farmersWithLocation.map((farmer) => {
          if (!farmer.location) return null;

          const isSelected = selectedFarmer?.id === farmer.id;
          
          return (
            <div key={farmer.id}>
              {/* Search radius circle */}
              {farmer.searchRadiusKm && farmer.searchRadiusKm > 0 && (
                <Circle
                  center={{
                    lat: farmer.location.latitude,
                    lng: farmer.location.longitude,
                  }}
                  radius={farmer.searchRadiusKm * 1000} // Convert km to meters
                  options={{
                    fillColor: '#13ec37',
                    fillOpacity: 0.15,
                    strokeColor: '#13ec37',
                    strokeOpacity: 0.5,
                    strokeWeight: 2,
                  }}
                />
              )}

              {/* Farmer marker */}
              <Marker
                position={{
                  lat: farmer.location.latitude,
                  lng: farmer.location.longitude,
                }}
                onClick={() => handleMarkerClick(farmer)}
                icon={{
                  path: google.maps.SymbolPath.CIRCLE,
                  scale: isSelected ? 10 : 8,
                  fillColor: isSelected ? '#13ec37' : '#4CAF50',
                  fillOpacity: 1,
                  strokeColor: '#FFFFFF',
                  strokeWeight: isSelected ? 3 : 2,
                }}
                title={farmer.name || 'Farmer'}
              />

              {/* Info Window */}
              {selectedFarmer?.id === farmer.id && (
                <InfoWindow
                  position={{
                    lat: farmer.location.latitude,
                    lng: farmer.location.longitude,
                  }}
                  onCloseClick={() => {
                    setSelectedFarmer(null);
                    if (onFarmerSelect) {
                      onFarmerSelect(null);
                    }
                  }}
                >
                  <div className="p-2 text-slate-900 min-w-[200px]">
                    <h3 className="font-bold text-lg mb-1">{farmer.name || 'Farmer'}</h3>
                    {farmer.contact && (
                      <p className="text-sm text-slate-600 mb-1">
                        <span className="font-medium">Contact:</span> {farmer.contact}
                      </p>
                    )}
                    {farmer.email && (
                      <p className="text-sm text-slate-600 mb-1">
                        <span className="font-medium">Email:</span> {farmer.email}
                      </p>
                    )}
                    {farmer.location.address && (
                      <p className="text-sm text-slate-600 mb-1">
                        <span className="font-medium">Location:</span> {farmer.location.address}
                      </p>
                    )}
                    {farmer.searchRadiusKm && (
                      <p className="text-sm text-slate-600">
                        <span className="font-medium">Search Radius:</span> {farmer.searchRadiusKm} km
                      </p>
                    )}
                  </div>
                </InfoWindow>
              )}
            </div>
          );
        })}
      </GoogleMap>
    </div>
  );
}
