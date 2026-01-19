'use client';

import { useState, useEffect, useRef } from 'react';
import { getCurrentUser, getFirestoreDb, getFirebaseStorage, signOut, onAuthStateChange } from '@/lib/firebase';
import { collection, addDoc, query, where, getDocs, onSnapshot } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { User } from 'firebase/auth';
import { Listing, UserProfile, Claim } from '@/lib/types';
import { getListingsCollectionPath, getClaimsCollectionPath } from '@/lib/constants';
import { getUserProfile } from '@/lib/userProfile';
import AuthGuard from '@/components/AuthGuard';
import Logo from '@/components/Logo';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { useLoadScript } from '@react-google-maps/api';

export default function DonorPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [myListings, setMyListings] = useState<Listing[]>([]);

  // Form state
  const [title, setTitle] = useState('');
  const [quantity, setQuantity] = useState('');
  const [address, setAddress] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState(''); // For manual URL entry (fallback)
  const [uploadingImage, setUploadingImage] = useState(false);
  const [useCurrentLocation, setUseCurrentLocation] = useState(false);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [currentCoordinates, setCurrentCoordinates] = useState<{ latitude: number; longitude: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const addressInputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Load Google Maps script with Places library
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';
  const { isLoaded: isMapsLoaded, loadError } = useLoadScript({
    googleMapsApiKey: apiKey,
    libraries: ['places'],
  });

  // Debug: Log API key status (only first few chars for security)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      console.log('🔑 API Key Status:', {
        exists: !!apiKey,
        length: apiKey?.length || 0,
        preview: apiKey ? `${apiKey.substring(0, 10)}...` : 'MISSING',
        isMapsLoaded,
        loadError: loadError?.message || null,
      });
    }
  }, [apiKey, isMapsLoaded, loadError]);

  // Log if Places API is not available
  useEffect(() => {
    if (isMapsLoaded && typeof window !== 'undefined') {
      if (!window.google?.maps?.places) {
        console.error('❌ Places API is not loaded. Please enable Places API in Google Cloud Console.');
        console.error('Debug info:', {
          googleExists: !!window.google,
          mapsExists: !!window.google?.maps,
          placesExists: !!window.google?.maps?.places,
        });
        toast.error('Places API not available. Please enable it in Google Cloud Console.');
      } else {
        console.log('✅ Google Places API loaded successfully');
      }
    }
    
    if (loadError) {
      console.error('❌ Google Maps script load error:', loadError);
      toast.error('Failed to load Google Maps. Please check your API key configuration.');
    }
  }, [isMapsLoaded, loadError]);

  useEffect(() => {
    let listingsUnsubscribe: (() => void) | undefined;

    const unsubscribe = onAuthStateChange(async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        const profile = await getUserProfile(currentUser.uid);
        setUserProfile(profile);
        if (profile) {
          listingsUnsubscribe = await loadMyListings(currentUser.uid);
        }
        setLoading(false);
      } else {
        router.push('/login');
      }
    });

    return () => {
      unsubscribe();
      if (listingsUnsubscribe) {
        listingsUnsubscribe();
      }
    };
  }, [router]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setProfileDropdownOpen(false);
      }
    };

    if (profileDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [profileDropdownOpen]);

  // Initialize Google Places Autocomplete
  useEffect(() => {
    if (!isMapsLoaded) {
      return;
    }

    if (!addressInputRef.current) {
      // Input might not be ready yet, try again after a short delay
      const timer = setTimeout(() => {
        if (addressInputRef.current && !autocompleteRef.current) {
          initializeAutocomplete();
        }
      }, 100);
      return () => clearTimeout(timer);
    }

    if (autocompleteRef.current) {
      return; // Already initialized
    }

    initializeAutocomplete();

    function initializeAutocomplete() {
      if (!addressInputRef.current || !window.google?.maps?.places) {
        console.error('Google Places API not loaded or input not available');
        return;
      }

      try {
        const autocomplete = new google.maps.places.Autocomplete(addressInputRef.current, {
          types: ['address'],
          fields: ['formatted_address', 'geometry'],
        });

        autocomplete.addListener('place_changed', () => {
          const place = autocomplete.getPlace();
          
          if (place.geometry && place.geometry.location) {
            const lat = place.geometry.location.lat();
            const lng = place.geometry.location.lng();
            
            setAddress(place.formatted_address || '');
            setCurrentCoordinates({ latitude: lat, longitude: lng });
            setUseCurrentLocation(false);
          }
        });

        autocompleteRef.current = autocomplete;
        console.log('Google Places Autocomplete initialized successfully');
      } catch (error) {
        console.error('Error initializing Google Places Autocomplete:', error);
        toast.error('Failed to initialize address autocomplete. Please ensure Places API is enabled.');
      }
    }

    return () => {
      if (autocompleteRef.current) {
        google.maps.event.clearInstanceListeners(autocompleteRef.current);
        autocompleteRef.current = null;
      }
    };
  }, [isMapsLoaded]);

  const loadMyListings = (userId: string) => {
    try {
      const db = getFirestoreDb();
      const listingsRef = collection(db, getListingsCollectionPath());
      const claimsRef = collection(db, getClaimsCollectionPath());
      const q = query(listingsRef, where('donor_id', '==', userId));
      
      // Use real-time subscription
      const unsubscribe = onSnapshot(q, async (snapshot) => {
        const listings = await Promise.all(
          snapshot.docs.map(async (doc) => {
            const listingData = {
              id: doc.id,
              ...doc.data(),
            } as Listing;

            // Get all claims for this listing
            const listingClaimsQuery = query(claimsRef, where('listing_id', '==', doc.id));
            const claimsSnapshot = await getDocs(listingClaimsQuery);
            const claims = claimsSnapshot.docs.map((claimDoc) => ({
              id: claimDoc.id,
              ...claimDoc.data(),
            })) as Claim[];

            // Calculate remaining quantity
            const originalQuantity = listingData.quantity || '0';
            const quantityUnit = originalQuantity.replace(/[0-9.\s]/g, '').trim() || '';
            const originalQuantityNum = parseFloat(originalQuantity.replace(/[^0-9.]/g, '')) || 0;

            let totalClaimedNum = 0;
            claims.forEach((claim) => {
              const claimNum = parseFloat(claim.quantity.replace(/[^0-9.]/g, '')) || 0;
              totalClaimedNum += claimNum;
            });

            const remainingNum = Math.max(0, originalQuantityNum - totalClaimedNum);
            const remainingQuantity = remainingNum > 0 
              ? `${remainingNum}${quantityUnit ? ' ' + quantityUnit : ''}` 
              : '0';

            return {
              ...listingData,
              remaining_quantity: remainingQuantity,
              claims: claims, // Store claims for display
            };
          })
        );

        setMyListings(listings);
      });

      return unsubscribe;
    } catch (error) {
      console.error('Error loading listings:', error);
      return () => {}; // Return empty unsubscribe function
    }
  };

  const handleGeocode = async (address: string): Promise<{ latitude: number; longitude: number } | null> => {
    try {
      const response = await fetch('/api/geocode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Geocoding failed');
      }

      const data = await response.json();
      return { latitude: data.latitude, longitude: data.longitude };
    } catch (error) {
      console.error('Geocoding error:', error);
      toast.error('Failed to geocode address: ' + (error instanceof Error ? error.message : 'Unknown error'));
      return null;
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        toast.error('Please select an image file');
        return;
      }
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Image size should be less than 5MB');
        return;
      }
      setImageFile(file);
      setImageUrl(''); // Clear URL input when file is selected
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const uploadImageToStorage = async (file: File, userId: string): Promise<string> => {
    try {
      const storage = getFirebaseStorage();
      if (!storage) {
        throw new Error('Firebase Storage is not initialized. Please check your Firebase configuration.');
      }

      const timestamp = Date.now();
      const fileName = `listings/${userId}/${timestamp}_${file.name}`;
      const storageRef = ref(storage, fileName);
      
      setUploadingImage(true);
      
      // Upload file
      await uploadBytes(storageRef, file);
      
      // Get download URL
      const downloadURL = await getDownloadURL(storageRef);
      return downloadURL;
    } catch (error: any) {
      console.error('Error uploading image:', error);
      
      // Provide more specific error messages
      let errorMessage = 'Failed to upload image. ';
      
      if (error?.code === 'storage/unauthorized') {
        errorMessage += 'Storage permission denied. Please check Firebase Storage security rules.';
      } else if (error?.code === 'storage/quota-exceeded') {
        errorMessage += 'Storage quota exceeded. Please check your Firebase plan.';
      } else if (error?.code === 'storage/unauthenticated') {
        errorMessage += 'User not authenticated. Please refresh and try again.';
      } else if (error?.code === 'storage/unknown') {
        errorMessage += 'Unknown storage error. Please check if Firebase Storage is enabled.';
      } else if (error?.message) {
        errorMessage += error.message;
      } else {
        errorMessage += 'Please check: 1) Firebase Storage is enabled, 2) Storage security rules allow uploads, 3) You are authenticated.';
      }
      
      throw new Error(errorMessage);
    } finally {
      setUploadingImage(false);
    }
  };

  const handleGetCurrentLocation = async () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser');
      return;
    }

    setGettingLocation(true);
    setUseCurrentLocation(true);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        setCurrentCoordinates({ latitude, longitude });

        // Reverse geocode to get address
        try {
          const response = await fetch('/api/reverse-geocode', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ latitude, longitude }),
          });

          if (response.ok) {
            const data = await response.json();
            setAddress(data.address);
          } else {
            // If reverse geocoding fails, still use coordinates but show a generic address
            setAddress(`Current Location (${latitude.toFixed(6)}, ${longitude.toFixed(6)})`);
          }
        } catch (error) {
          console.error('Reverse geocoding error:', error);
          setAddress(`Current Location (${latitude.toFixed(6)}, ${longitude.toFixed(6)})`);
        } finally {
          setGettingLocation(false);
        }
      },
      (error) => {
        console.error('Geolocation error:', error);
        let errorMessage = 'Failed to get your location. ';
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage += 'Please allow location access.';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage += 'Location information is unavailable.';
            break;
          case error.TIMEOUT:
            errorMessage += 'Location request timed out.';
            break;
          default:
            errorMessage += 'An unknown error occurred.';
            break;
        }
        toast.error(errorMessage);
        setGettingLocation(false);
        setUseCurrentLocation(false);
        setCurrentCoordinates(null);
      }
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setSubmitting(true);

    try {
      // Get coordinates - either from current location or geocode address
      let coordinates: { latitude: number; longitude: number } | null = null;
      
      if (useCurrentLocation && currentCoordinates) {
        // Use current location coordinates
        coordinates = currentCoordinates;
      } else {
        // Geocode the address
        coordinates = await handleGeocode(address);
        if (!coordinates) {
          setSubmitting(false);
          return;
        }
      }

      // Upload image if file is selected
      let finalImageUrl = imageUrl || 'https://via.placeholder.com/400x300?text=Food+Item';
      if (imageFile) {
        try {
          finalImageUrl = await uploadImageToStorage(imageFile, user.uid);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to upload image. Please try again.';
          toast.error(errorMessage + '\n\nTip: Check browser console (F12) for more details.');
          console.error('Upload error details:', error);
          setSubmitting(false);
          return;
        }
      }

      // Create listing document
      const db = getFirestoreDb();
      const listingsRef = collection(db, getListingsCollectionPath());
      
      const listingData = {
        donor_id: user.uid,
        donor_name: userProfile?.name || 'Unknown',
        donor_contact: userProfile?.contact || '',
        title,
        quantity,
        remaining_quantity: quantity, // Initially, all quantity is available
        address,
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
        image_url: finalImageUrl,
        status: 'active',
        created_at: new Date(),
      };

      await addDoc(listingsRef, listingData);

      // Reset form
      setTitle('');
      setQuantity('');
      setAddress('');
      setImageFile(null);
      setImagePreview(null);
      setImageUrl('');
      setUseCurrentLocation(false);
      setCurrentCoordinates(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      // Reload listings
      await loadMyListings(user.uid);

      toast.success('Listing created successfully!');
    } catch (error) {
      console.error('Error creating listing:', error);
      toast.error('Failed to create listing: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-white via-green-50 to-emerald-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <div className="text-xl text-gray-600">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-green-50 to-emerald-100">
      {/* Header */}
      <header className="bg-white/95 backdrop-blur-sm border-b border-gray-100 sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            <Link href="/" className="flex items-center gap-3">
              <Logo className="w-10 h-10" />
              <h1 className="text-3xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent" style={{ fontFamily: '"Lilita One", sans-serif' }}>
                Food Loop
              </h1>
            </Link>
            
            {/* Centered Navigation */}
            <nav className="absolute left-1/2 transform -translate-x-1/2 hidden md:flex items-center gap-8">
              <Link
                href="/donor"
                className="text-base font-semibold text-green-600 relative"
              >
                Donate
                <span className="absolute bottom-0 left-0 w-full h-0.5 bg-green-600"></span>
              </Link>
              <Link
                href="/claimer"
                className="text-base font-semibold text-gray-700 hover:text-green-600 transition-all duration-200 relative group"
              >
                Claim
                <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-green-600 transition-all duration-200 group-hover:w-full"></span>
              </Link>
            </nav>

            {/* Right side actions */}
            <div className="flex items-center gap-3">
              {userProfile && (
                <div className="relative" ref={dropdownRef}>
                  <button
                    onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                    className="flex items-center gap-3 px-4 py-2 rounded-full bg-gray-50 border border-gray-200 hover:bg-gray-100 transition-all cursor-pointer"
                  >
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center shadow-sm">
                      <span className="text-white font-semibold text-sm">{userProfile.name.charAt(0).toUpperCase()}</span>
                    </div>
                    <div className="hidden sm:block">
                      <p className="text-sm font-semibold text-gray-900">{userProfile.name}</p>
                      <p className="text-xs text-gray-500">{userProfile.contact}</p>
                    </div>
                    <svg className={`w-4 h-4 text-gray-500 transition-transform ${profileDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  
                  {profileDropdownOpen && (
                    <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg border border-gray-200 py-2 z-50">
                      <div className="px-4 py-3 border-b border-gray-100">
                        <p className="text-sm font-semibold text-gray-900">{userProfile.name}</p>
                        <p className="text-xs text-gray-500 mt-1">{userProfile.contact}</p>
                        <p className="text-xs text-gray-400 mt-1">{userProfile.email}</p>
                      </div>
                      <button
                        onClick={async () => {
                          try {
                            setProfileDropdownOpen(false);
                            await signOut();
                            // Wait a bit for auth state to update
                            await new Promise(resolve => setTimeout(resolve, 100));
                            router.push('/login');
                          } catch (error: any) {
                            console.error('Logout error:', error);
                            toast.error('Failed to sign out. Please try again.');
                          }
                        }}
                        className="w-full text-left px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors flex items-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                        Sign Out
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Donor Dashboard</h1>
          <p className="text-gray-600">Create and manage your food donation listings</p>
        </div>

        <div className="grid lg:grid-cols-10 gap-6">
          {/* Create Listing Form */}
          <div className="lg:col-span-7 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
              <h2 className="text-xl font-bold text-gray-900">Create New Listing</h2>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Food Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all text-gray-900"
                  placeholder="e.g., 5 boxes of surplus croissants"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Quantity
                </label>
                <input
                  type="text"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  required
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all text-gray-900"
                  placeholder="e.g., 20 servings"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Pickup Address
                </label>
                <div className="flex gap-2">
                  <input
                    ref={addressInputRef}
                    type="text"
                    value={address}
                    onChange={(e) => {
                      setAddress(e.target.value);
                      setUseCurrentLocation(false);
                      // Coordinates will be set by autocomplete when a place is selected
                    }}
                    required
                    disabled={gettingLocation}
                    className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all disabled:bg-gray-100 disabled:cursor-not-allowed text-gray-900"
                    placeholder="Start typing an address..."
                  />
                  <button
                    type="button"
                    onClick={handleGetCurrentLocation}
                    disabled={gettingLocation}
                    className="px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap flex items-center gap-2 font-semibold transition-all hover:shadow-md active:scale-95"
                    title="Use your current location"
                  >
                    {gettingLocation ? (
                      <>
                        <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Getting...
                      </>
                    ) : (
                      <>
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        Use Current Location
                      </>
                    )}
                  </button>
                </div>
                {useCurrentLocation && currentCoordinates && (
                  <p className="text-xs text-green-600 mt-2 flex items-center gap-1">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    Using current location: {currentCoordinates.latitude.toFixed(6)}, {currentCoordinates.longitude.toFixed(6)}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Food Photo (optional)
                </label>
                
                {/* File Upload */}
                <div className="space-y-3">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageSelect}
                    className="hidden"
                    id="image-upload"
                  />
                  <label
                    htmlFor="image-upload"
                    className="flex items-center justify-center w-full px-4 py-6 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-green-500 hover:bg-green-50 transition-all group"
                  >
                    <div className="text-center">
                      <svg className="mx-auto h-10 w-10 text-gray-400 group-hover:text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <p className="text-sm font-medium text-gray-700 mt-2">
                        {imageFile ? imageFile.name : 'Click to upload photo'}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">PNG, JPG, GIF up to 5MB</p>
                    </div>
                  </label>

                  {/* Image Preview */}
                  {imagePreview && (
                    <div className="relative group">
                      <img
                        src={imagePreview}
                        alt="Preview"
                        className="w-full h-56 object-cover rounded-lg"
                      />
                      <button
                        type="button"
                        onClick={handleRemoveImage}
                        className="absolute top-3 right-3 bg-red-500 text-white rounded-full p-2 hover:bg-red-600 shadow-lg transition-all"
                        title="Remove image"
                      >
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  )}

                  {/* Or use URL (fallback) */}
                  {!imagePreview && (
                    <>
                      <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                          <div className="w-full border-t border-gray-300"></div>
                        </div>
                        <div className="relative flex justify-center text-sm">
                          <span className="px-3 bg-white text-gray-500 font-medium">OR</span>
                        </div>
                      </div>

                      <input
                        type="url"
                        value={imageUrl}
                        onChange={(e) => {
                          setImageUrl(e.target.value);
                          if (e.target.value) {
                            setImageFile(null);
                            setImagePreview(null);
                            if (fileInputRef.current) {
                              fileInputRef.current.value = '';
                            }
                          }
                        }}
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all text-gray-900"
                        placeholder="Enter image URL instead"
                      />
                    </>
                  )}
                </div>

                {uploadingImage && (
                  <div className="flex items-center gap-2 text-sm text-green-600 mt-2">
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Uploading image...
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={submitting || uploadingImage}
                className="w-full bg-green-600 text-white py-3 px-6 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-base transition-all hover:shadow-md active:scale-95"
              >
                {uploadingImage ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Uploading Image...
                  </span>
                ) : submitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Creating...
                  </span>
                ) : (
                  'Create Listing'
                )}
              </button>
            </form>
          </div>

          {/* My Listings */}
          <div className="lg:col-span-3 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
              <h2 className="text-xl font-bold text-gray-900">
                My Listings
                <span className="ml-2 text-sm font-normal text-gray-500">({myListings.length})</span>
              </h2>
            </div>
            <div className="p-6 space-y-4 max-h-[655px] overflow-y-auto">
              {myListings.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">📝</div>
                  <p className="text-gray-500 font-medium">No listings yet</p>
                  <p className="text-sm text-gray-400 mt-1">Create your first listing to get started!</p>
                </div>
              ) : (
                [...myListings]
                  .sort((a, b) => {
                    // Active listings first
                    if (a.status === 'active' && b.status !== 'active') return -1;
                    if (a.status !== 'active' && b.status === 'active') return 1;
                    // If both are same status, check remaining quantity
                    const aRemaining = parseFloat(a.remaining_quantity?.replace(/[^0-9.]/g, '') || '0') || 0;
                    const bRemaining = parseFloat(b.remaining_quantity?.replace(/[^0-9.]/g, '') || '0') || 0;
                    // Fully claimed (remaining = 0) should be at bottom
                    if (aRemaining === 0 && bRemaining > 0) return 1;
                    if (aRemaining > 0 && bRemaining === 0) return -1;
                    return 0;
                  })
                  .map((listing) => (
                  <div
                    key={listing.id}
                    className="border-2 border-gray-200 rounded-xl p-5 hover:border-green-300 hover:shadow-md transition-all bg-white"
                  >
                    {listing.image_url && (
                      <div className="relative w-full h-32 mb-4 rounded-lg overflow-hidden bg-gray-100">
                        <img
                          src={listing.image_url}
                          alt={listing.title}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    <div className="flex justify-between items-start mb-3">
                      <h3 className="font-bold text-lg text-gray-900">{listing.title}</h3>
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          listing.status === 'active'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {listing.status}
                      </span>
                    </div>
                    <div className="space-y-2 mb-3">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-gray-600 font-medium">Original:</span>
                        <span className="text-gray-900">{listing.quantity}</span>
                      </div>
                      {listing.remaining_quantity && listing.remaining_quantity !== listing.quantity && (
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-green-600 font-medium">Remaining:</span>
                          <span className="text-green-700 font-semibold">{listing.remaining_quantity}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <span className="truncate">{listing.address}</span>
                      </div>
                    </div>
                    {listing.claims && listing.claims.length > 0 && (
                      <div className="mt-4 p-3 bg-green-50 rounded-lg border border-green-200">
                        <p className="text-sm font-semibold text-green-800 mb-2">
                          Claims ({listing.claims.length}):
                        </p>
                        <div className="space-y-2">
                          {listing.claims.map((claim) => (
                            <div key={claim.id} className="bg-white rounded-md p-2 border border-green-200">
                              <p className="text-sm font-medium text-gray-900">
                                {claim.claimer_name} - <span className="text-green-600">{claim.quantity}</span>
                              </p>
                              {claim.claimer_contact && (
                                <p className="text-xs text-gray-600 mt-1">{claim.claimer_contact}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


