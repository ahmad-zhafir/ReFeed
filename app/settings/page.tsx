'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChange, signOut } from '@/lib/firebase';
import { User } from 'firebase/auth';
import { UserProfile, MarketplaceRole } from '@/lib/types';
import { getUserProfile, updateUserProfile } from '@/lib/userProfile';
import AuthGuard from '@/components/AuthGuard';
import Logo from '@/components/Logo';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { useLoadScript, GoogleMap, Marker } from '@react-google-maps/api';

export default function SettingsPage() {
  return (
    <AuthGuard>
      <SettingsContent />
    </AuthGuard>
  );
}

function SettingsContent() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchRadius, setSearchRadius] = useState(10);
  
  // Location state for farmers
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [address, setAddress] = useState('');
  const [savingLocation, setSavingLocation] = useState(false);
  const addressInputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  
  // Google Maps API
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';
  const { isLoaded: isMapsLoaded } = useLoadScript({
    googleMapsApiKey: apiKey,
    libraries: ['places'],
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChange(async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        const profile = await getUserProfile(currentUser.uid);
        setUserProfile(profile);
        if (profile?.searchRadiusKm) {
          setSearchRadius(profile.searchRadiusKm);
        }
        // Load location for both farmers and generators
        if (profile?.location) {
          setLatitude(profile.location.latitude);
          setLongitude(profile.location.longitude);
          setAddress(profile.location.address || '');
        }
        setLoading(false);
      } else {
        router.push('/login');
      }
    });

    return () => unsubscribe();
  }, [router]);
  
  // Initialize Places Autocomplete (for both farmers and generators)
  useEffect(() => {
    if (isMapsLoaded && addressInputRef.current && !autocompleteRef.current && (userProfile?.role === 'farmer' || userProfile?.role === 'generator')) {
      autocompleteRef.current = new google.maps.places.Autocomplete(addressInputRef.current, {
        types: ['address'],
      });

      autocompleteRef.current.addListener('place_changed', () => {
        const place = autocompleteRef.current?.getPlace();
        if (place?.geometry?.location) {
          setLatitude(place.geometry.location.lat());
          setLongitude(place.geometry.location.lng());
          setAddress(place.formatted_address || '');
        }
      });
    }
  }, [isMapsLoaded, userProfile?.role]);
  
  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported in this browser.');
      return;
    }
    toast.loading('Getting your location...', { id: 'gps' });
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setLatitude(lat);
        setLongitude(lng);
        
        // Reverse geocode to get address
        try {
          const response = await fetch('/api/reverse-geocode', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ latitude: lat, longitude: lng }),
          });
          if (response.ok) {
            const data = await response.json();
            if (data.address) {
              setAddress(data.address);
            }
          }
        } catch (error) {
          console.error('Reverse geocoding failed:', error);
        }
        
        toast.dismiss('gps');
        toast.success('Location captured');
      },
      () => {
        toast.dismiss('gps');
        toast.error('Location permission denied');
      }
    );
  };
  
  const geocodeAddress = async (addressString: string) => {
    if (!addressString.trim()) return;
    
    try {
      const response = await fetch('/api/geocode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: addressString }),
      });
      if (response.ok) {
        const data = await response.json();
        if (data.latitude && data.longitude) {
          setLatitude(data.latitude);
          setLongitude(data.longitude);
          if (data.formatted_address) {
            setAddress(data.formatted_address);
          }
          toast.success('Address geocoded');
        } else {
          toast.error('Could not find coordinates for this address');
        }
      } else {
        toast.error('Failed to geocode address. Please use GPS button or select from dropdown.');
      }
    } catch (error) {
      console.error('Geocoding failed:', error);
      toast.error('Failed to geocode address. Please use GPS button or select from dropdown.');
    }
  };
  
  const handleSaveLocation = async () => {
    if (!user || (userProfile?.role !== 'farmer' && userProfile?.role !== 'generator')) return;
    if (!latitude || !longitude) {
      toast.error('Please set a location first');
      return;
    }
    
    setSavingLocation(true);
    try {
      await updateUserProfile(user.uid, {
        location: {
          latitude,
          longitude,
          address: address || undefined,
        },
      });
      // Update local profile state
      setUserProfile({
        ...userProfile,
        location: {
          latitude,
          longitude,
          address: address || undefined,
        },
      });
      toast.success('Location saved successfully');
    } catch (error) {
      console.error('Error saving location:', error);
      toast.error('Failed to save location');
    } finally {
      setSavingLocation(false);
    }
  };

  const handleSaveRadius = async () => {
    if (!user || userProfile?.role !== 'farmer') return;
    
    setSaving(true);
    try {
      await updateUserProfile(user.uid, { searchRadiusKm: searchRadius });
      toast.success('Settings saved');
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#102213] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#13ec37] mx-auto mb-4"></div>
          <p className="text-white">Loading...</p>
        </div>
      </div>
    );
  }

  const role = userProfile?.role;
  const homePath = role === 'generator' ? '/generator' : '/farmer';

  return (
    <div className="font-display bg-[#f6f8f6] dark:bg-[#102213] text-slate-900 dark:text-white antialiased min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-solid border-gray-200 dark:border-[#234829] bg-white/80 dark:bg-[#102213]/80 backdrop-blur-md">
        <div className="px-6 md:px-10 py-3 flex items-center justify-between w-full">
          <Link href={homePath} className="flex items-center gap-4 text-slate-900 dark:text-white cursor-pointer">
            <div className="size-8 text-[#13ec37]">
              <svg fill="none" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                <path d="M42.4379 44C42.4379 44 36.0744 33.9038 41.1692 24C46.8624 12.9336 42.2078 4 42.2078 4L7.01134 4C7.01134 4 11.6577 12.932 5.96912 23.9969C0.876273 33.9029 7.27094 44 7.27094 44L42.4379 44Z" fill="currentColor"></path>
              </svg>
            </div>
            <h2 className="text-xl font-bold leading-tight tracking-[-0.015em]">ReFeed</h2>
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-2xl mx-auto px-4 md:px-8 py-8">
        <div className="bg-[#1c2e20] border border-[#234829] rounded-xl shadow-lg p-6 md:p-8 relative">
          {/* Back Button - Top Left */}
          <div className="flex justify-start mb-4">
            <Link
              href={homePath}
              className="flex items-center gap-2 px-4 py-2 bg-[#234829] hover:bg-[#13ec37]/20 text-[#92c99b] hover:text-white border border-[#234829] hover:border-[#13ec37]/50 rounded-lg transition-all font-medium text-sm"
            >
              <span className="material-symbols-outlined text-base">arrow_back</span>
              <span>Back to Dashboard</span>
            </Link>
          </div>
          
          {/* Settings Title - Centered */}
          <div className="flex items-center justify-center gap-3 mb-6">
            <span className="material-symbols-outlined text-[#13ec37] text-2xl">settings</span>
            <h2 className="text-2xl font-bold text-white">Settings</h2>
          </div>
          
          <div className="space-y-5 mb-6">
            <div>
              <label className="block text-sm font-medium text-[#92c99b] mb-2">Name</label>
              <input
                type="text"
                value={userProfile?.name || ''}
                disabled
                className="w-full px-4 py-2.5 rounded-lg border-none bg-[#234829] text-white placeholder:text-[#92c99b]/50 focus:ring-1 focus:ring-[#13ec37] focus:border-[#13ec37] sm:text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#92c99b] mb-2">Email</label>
              <input
                type="email"
                value={userProfile?.email || ''}
                disabled
                className="w-full px-4 py-2.5 rounded-lg border-none bg-[#234829] text-white placeholder:text-[#92c99b]/50 focus:ring-1 focus:ring-[#13ec37] focus:border-[#13ec37] sm:text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#92c99b] mb-2">Contact</label>
              <input
                type="tel"
                value={userProfile?.contact || ''}
                disabled
                className="w-full px-4 py-2.5 rounded-lg border-none bg-[#234829] text-white placeholder:text-[#92c99b]/50 focus:ring-1 focus:ring-[#13ec37] focus:border-[#13ec37] sm:text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#92c99b] mb-2">Role</label>
              <input
                type="text"
                value={role === 'generator' ? 'Restaurant / Generator' : 'Farmer / Receiver'}
                disabled
                className="w-full px-4 py-2.5 rounded-lg border-none bg-[#234829] text-white placeholder:text-[#92c99b]/50 focus:ring-1 focus:ring-[#13ec37] focus:border-[#13ec37] sm:text-sm"
              />
            </div>
          </div>

          {/* Location Picker Section - Available for both farmers and generators */}
          {(role === 'farmer' || role === 'generator') && (
            <div className="mb-6 p-4 bg-[#234829] rounded-lg border border-[#234829]">
              <div className="flex items-center gap-2 mb-4">
                <span className="material-symbols-outlined text-[#13ec37]">location_on</span>
                <label className="block text-sm font-medium text-[#92c99b]">
                  Your Location
                </label>
              </div>
              <p className="text-xs text-[#92c99b]/70 mb-4">
                {role === 'farmer' 
                  ? 'Update your location to see listings closer to you. You can use GPS, enter an address, or adjust the pin on the map.'
                  : 'Update your restaurant location. This location will be used for new listings. You can use GPS, enter an address, or adjust the pin on the map.'}
              </p>
              
              {/* Address Input */}
              <div className="flex gap-2 mb-3">
                <input
                  ref={addressInputRef}
                  type="text"
                  value={address}
                  onChange={(e) => {
                    setAddress(e.target.value);
                    if (!autocompleteRef.current?.getPlace()) {
                      setLatitude(null);
                      setLongitude(null);
                    }
                  }}
                  onBlur={() => {
                    if (address && !latitude && !longitude) {
                      geocodeAddress(address);
                    }
                  }}
                  className="flex-1 px-4 py-2.5 rounded-lg border-none bg-[#102213] text-white placeholder:text-[#92c99b]/50 focus:ring-1 focus:ring-[#13ec37] focus:border-transparent transition-all text-sm"
                  placeholder="Enter address or select from dropdown"
                />
                <button
                  type="button"
                  onClick={useCurrentLocation}
                  className="px-4 py-2.5 bg-[#13ec37] hover:bg-[#11d632] text-[#112214] rounded-lg font-medium transition-all flex items-center gap-2"
                >
                  <span className="material-symbols-outlined text-base">my_location</span>
                  GPS
                </button>
              </div>
              
              {latitude && longitude && (
                <p className="text-xs text-[#13ec37] mb-3">
                  ✓ Coordinates: {latitude.toFixed(5)}, {longitude.toFixed(5)}
                </p>
              )}
              
              {/* Interactive Map */}
              {isMapsLoaded && (
                <div className="mb-4">
                  <p className="text-xs text-[#92c99b] mb-2">
                    Click on the map or drag the pin to adjust your location
                  </p>
                  <div className="w-full h-64 rounded-lg overflow-hidden border-2 border-[#234829]">
                    <GoogleMap
                      mapContainerStyle={{ width: '100%', height: '100%' }}
                      center={
                        latitude && longitude
                          ? { lat: latitude, lng: longitude }
                          : userProfile?.location?.latitude && userProfile?.location?.longitude
                          ? { lat: userProfile.location.latitude, lng: userProfile.location.longitude }
                          : { lat: 3.1390, lng: 101.6869 }
                      }
                      zoom={latitude && longitude ? 15 : 12}
                      onClick={(e) => {
                        if (e.latLng) {
                          const lat = e.latLng.lat();
                          const lng = e.latLng.lng();
                          setLatitude(lat);
                          setLongitude(lng);
                          
                          // Reverse geocode to get address
                          fetch('/api/reverse-geocode', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ latitude: lat, longitude: lng }),
                          })
                            .then((res) => res.json())
                            .then((data) => {
                              if (data.address) {
                                setAddress(data.address);
                              }
                            })
                            .catch((error) => {
                              console.error('Reverse geocoding failed:', error);
                            });
                        }
                      }}
                      options={{
                        disableDefaultUI: false,
                        zoomControl: true,
                        streetViewControl: false,
                        mapTypeControl: true,
                        fullscreenControl: false,
                      }}
                    >
                      {latitude && longitude && (
                        <Marker
                          position={{ lat: latitude, lng: longitude }}
                          draggable={true}
                          onDragEnd={(e) => {
                            if (e.latLng) {
                              const lat = e.latLng.lat();
                              const lng = e.latLng.lng();
                              setLatitude(lat);
                              setLongitude(lng);
                              
                              // Reverse geocode to get address
                              fetch('/api/reverse-geocode', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ latitude: lat, longitude: lng }),
                              })
                                .then((res) => res.json())
                                .then((data) => {
                                  if (data.address) {
                                    setAddress(data.address);
                                  }
                                })
                                .catch((error) => {
                                  console.error('Reverse geocoding failed:', error);
                                });
                            }
                          }}
                          icon={{
                            path: google.maps.SymbolPath.CIRCLE,
                            scale: 10,
                            fillColor: '#13ec37',
                            fillOpacity: 1,
                            strokeColor: '#FFFFFF',
                            strokeWeight: 3,
                          }}
                        />
                      )}
                    </GoogleMap>
                  </div>
                  {!latitude || !longitude ? (
                    <p className="text-xs text-amber-400 mt-2 flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm">info</span>
                      Please set location using address input, GPS button, or click on the map
                    </p>
                  ) : (
                    <p className="text-xs text-[#13ec37] mt-2 flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm">check_circle</span>
                      Location set. You can drag the pin or click on the map to adjust
                    </p>
                  )}
                </div>
              )}
              
              <button
                onClick={handleSaveLocation}
                disabled={savingLocation || !latitude || !longitude}
                className="w-full px-6 py-2.5 bg-[#13ec37] hover:bg-[#11d632] text-[#112214] rounded-lg disabled:opacity-50 transition-all font-bold shadow-[0_0_15px_rgba(19,236,55,0.3)]"
              >
                {savingLocation ? 'Saving Location...' : 'Save Location'}
              </button>
            </div>
          )}
          
          {/* Search Radius Section - Only for farmers */}
          {role === 'farmer' && (
            <div className="mb-6 p-4 bg-[#234829] rounded-lg border border-[#234829]">
              <label className="block text-sm font-medium text-[#92c99b] mb-3">
                Search Radius: <span className="text-[#13ec37] font-bold">{searchRadius} km</span>
              </label>
              <input
                type="range"
                min={1}
                max={50}
                step={1}
                value={searchRadius}
                onChange={(e) => setSearchRadius(parseInt(e.target.value, 10))}
                className="w-full mb-2 accent-[#13ec37]"
              />
              <div className="flex justify-between text-xs text-[#92c99b] mb-4">
                <span>1km</span>
                <span>50km</span>
              </div>
              <button
                onClick={handleSaveRadius}
                disabled={saving}
                className="w-full px-6 py-2.5 bg-[#13ec37] hover:bg-[#11d632] text-[#112214] rounded-lg disabled:opacity-50 transition-all font-bold shadow-[0_0_15px_rgba(19,236,55,0.3)]"
              >
                {saving ? 'Saving...' : 'Save Radius'}
              </button>
            </div>
          )}

          <div className="border-t border-[#234829] pt-6">
            <button
              onClick={async () => {
                try {
                  await signOut();
                  await new Promise(resolve => setTimeout(resolve, 100));
                  router.push('/');
                } catch (error: any) {
                  console.error('Logout error:', error);
                  toast.error('Failed to sign out');
                }
              }}
              className="w-full px-6 py-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-lg transition-all font-semibold flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined">logout</span>
              Sign Out
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

