'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentUser, getFirestoreDb, getFirebaseStorage, onAuthStateChange } from '@/lib/firebase';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { User } from 'firebase/auth';
import { UserProfile, MarketplaceListing, MarketplacePickupWindow } from '@/lib/types';
import { getUserProfile } from '@/lib/userProfile';
import { getListingsCollectionPath } from '@/lib/constants';
import RoleGuard from '@/components/RoleGuard';
import Logo from '@/components/Logo';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { useLoadScript } from '@react-google-maps/api';

const WASTE_CATEGORIES = [
  'Vegetative Waste',
  'Bakery',
  'Dairy',
  'Meat',
  'Prepared Food',
  'Beverages',
  'Other'
];

export default function NewListingPage() {
  return (
    <RoleGuard allowedRoles={['generator']}>
      <NewListingContent />
    </RoleGuard>
  );
}

function NewListingContent() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [category, setCategory] = useState('');
  const [title, setTitle] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [notes, setNotes] = useState('');
  const [price, setPrice] = useState('');
  const [currency, setCurrency] = useState('MYR');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [address, setAddress] = useState('');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [pickupWindows, setPickupWindows] = useState<MarketplacePickupWindow[]>([]);
  
  // Schedule type: 'one-time' or 'recurring'
  const [scheduleType, setScheduleType] = useState<'one-time' | 'recurring'>('one-time');
  
  // One-time schedule
  const [newWindowStart, setNewWindowStart] = useState('');
  const [newWindowEnd, setNewWindowEnd] = useState('');
  
  // Recurring schedule
  const [recurringDays, setRecurringDays] = useState<number[]>([]); // 0 = Sunday, 1 = Monday, etc.
  const [recurringStartTime, setRecurringStartTime] = useState('');
  const [recurringEndTime, setRecurringEndTime] = useState('');
  const [recurringStartDate, setRecurringStartDate] = useState('');
  const [recurringEndDate, setRecurringEndDate] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const addressInputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);

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
        
        // Use user's location if available
        if (profile?.location?.latitude && profile?.location?.longitude) {
          setLatitude(profile.location.latitude);
          setLongitude(profile.location.longitude);
          if (profile.location.address) {
            setAddress(profile.location.address);
          }
        }
      } else {
        router.push('/login');
      }
    });

    return () => unsubscribe();
  }, [router]);

  useEffect(() => {
    if (isMapsLoaded && addressInputRef.current && !autocompleteRef.current) {
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
  }, [isMapsLoaded]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const useCurrentLocation = async () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation not supported');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        setLatitude(pos.coords.latitude);
        setLongitude(pos.coords.longitude);
        
        // Reverse geocode to get address
        try {
          const response = await fetch('/api/reverse-geocode', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
            }),
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
        
        toast.success('Location captured');
      },
      () => toast.error('Location permission denied')
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

  const addPickupWindow = () => {
    if (scheduleType === 'one-time') {
      if (!newWindowStart || !newWindowEnd) {
        toast.error('Please fill both start and end times');
        return;
      }

      const startDate = new Date(newWindowStart);
      const endDate = new Date(newWindowEnd);
      const now = new Date();
      now.setSeconds(0, 0);

      if (startDate < now) {
        toast.error('Start date and time must be today or in the future');
        return;
      }

      if (endDate <= startDate) {
        toast.error('End date and time must be after start date and time');
        return;
      }

      setPickupWindows([...pickupWindows, { start: newWindowStart, end: newWindowEnd }]);
      setNewWindowStart('');
      setNewWindowEnd('');
    } else {
      // Recurring schedule
      if (recurringDays.length === 0) {
        toast.error('Please select at least one day');
        return;
      }
      if (!recurringStartTime || !recurringEndTime) {
        toast.error('Please fill both start and end times');
        return;
      }
      if (!recurringStartDate) {
        toast.error('Please select a start date');
        return;
      }

      // Validate times
      if (recurringEndTime <= recurringStartTime) {
        toast.error('End time must be after start time');
        return;
      }

      // Validate start date is today or in the future
      const startDate = new Date(recurringStartDate);
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      if (startDate < now) {
        toast.error('Start date must be today or in the future');
        return;
      }

      // Generate pickup windows for selected days
      const endDate = recurringEndDate ? new Date(recurringEndDate) : null;
      const generatedWindows: MarketplacePickupWindow[] = [];
      const currentDate = new Date(startDate);
      
      // Generate windows for up to 12 weeks (84 days) or until end date
      const maxDate = endDate || new Date(currentDate.getTime() + 84 * 24 * 60 * 60 * 1000);
      
      while (currentDate <= maxDate && generatedWindows.length < 100) {
        const dayOfWeek = currentDate.getDay();
        if (recurringDays.includes(dayOfWeek)) {
          const [startHours, startMinutes] = recurringStartTime.split(':').map(Number);
          const [endHours, endMinutes] = recurringEndTime.split(':').map(Number);
          
          const windowStart = new Date(currentDate);
          windowStart.setHours(startHours, startMinutes, 0, 0);
          
          const windowEnd = new Date(currentDate);
          windowEnd.setHours(endHours, endMinutes, 0, 0);
          
          // Only add if window is in the future
          if (windowStart >= new Date()) {
            generatedWindows.push({
              start: windowStart.toISOString(),
              end: windowEnd.toISOString(),
            });
          }
        }
        currentDate.setDate(currentDate.getDate() + 1);
      }

      if (generatedWindows.length === 0) {
        toast.error('No valid pickup windows generated. Please check your dates and times.');
        return;
      }

      setPickupWindows([...pickupWindows, ...generatedWindows]);
      toast.success(`Added ${generatedWindows.length} pickup window(s)`);
      
      // Reset recurring form
      setRecurringDays([]);
      setRecurringStartTime('');
      setRecurringEndTime('');
      setRecurringStartDate('');
      setRecurringEndDate('');
    }
  };

  const toggleRecurringDay = (day: number) => {
    setRecurringDays(prev => 
      prev.includes(day) 
        ? prev.filter(d => d !== day)
        : [...prev, day].sort()
    );
  };

  // Get minimum datetime for today (in local timezone format for datetime-local input)
  const getMinDateTime = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  // Get minimum date for today (YYYY-MM-DD format)
  const getMinDate = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayAbbr = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const removePickupWindow = (index: number) => {
    setPickupWindows(pickupWindows.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!category || !title || !price || !imageFile || !address || !latitude || !longitude || pickupWindows.length === 0) {
      toast.error('Please fill all required fields');
      return;
    }

    setSubmitting(true);
    try {
      const db = getFirestoreDb();
      const storage = getFirebaseStorage();

      // Upload image
      const imageRef = ref(storage, `listings/${user!.uid}/${Date.now()}_${imageFile.name}`);
      await uploadBytes(imageRef, imageFile);
      const imageUrl = await getDownloadURL(imageRef);

      // Create listing - filter out undefined values (Firestore doesn't allow undefined)
      const listingData: any = {
        generatorUid: user!.uid,
        generatorName: userProfile?.name,
        generatorContact: userProfile?.contact,
        category,
        title,
        price: parseFloat(price),
        currency,
        address,
        latitude,
        longitude,
        imageUrl,
        pickupWindows,
        status: 'live', // Auto-approve
        createdAt: Timestamp.now(),
      };

      // Only add optional fields if they have values
      if (weightKg) {
        listingData.weightKg = parseFloat(weightKg);
      }
      if (notes && notes.trim()) {
        listingData.notes = notes.trim();
      }

      // Remove any undefined values (safety check)
      Object.keys(listingData).forEach(key => {
        if (listingData[key] === undefined) {
          delete listingData[key];
        }
      });

      await addDoc(collection(db, getListingsCollectionPath()), listingData);
      toast.success('Listing created successfully!');
      router.push('/generator');
    } catch (error: any) {
      console.error('Error creating listing:', error);
      toast.error('Failed to create listing. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-green-50 to-emerald-100">
      <header className="bg-white backdrop-blur-sm border-b border-gray-100 sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            <Link href="/generator" className="flex items-center gap-3">
              <Logo className="w-10 h-10" />
              <h1 className="text-3xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent" style={{ fontFamily: '"Lilita One", sans-serif' }}>
                ReFeed
              </h1>
            </Link>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-6 py-8 max-w-3xl">
        {/* Progress Steps */}
        <div className="mb-8">
          <div className="relative">
            {/* Circles and connecting lines */}
            <div className="flex items-center">
              {[1, 2, 3, 4].map((s) => (
                <div key={s} className="flex items-center" style={{ flex: s === 4 ? '0 0 auto' : '1 1 0' }}>
                  <div className="relative flex flex-col items-center">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                      step >= s ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-600'
                    }`}>
                      {s}
                    </div>
                    <span className="text-xs text-gray-600 mt-2 text-center whitespace-nowrap">
                      {s === 1 ? 'Category' : s === 2 ? 'Photo' : s === 3 ? 'Details' : 'Schedule'}
                    </span>
                  </div>
                  {s < 4 && (
                    <div className={`flex-1 h-1 mx-2 ${step > s ? 'bg-green-600' : 'bg-gray-200'}`} style={{ minWidth: '20px' }} />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Step 1: Category */}
        {step === 1 && (
          <div className="bg-white rounded-xl shadow-lg p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Select Waste Category</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {WASTE_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => {
                    setCategory(cat);
                    setTimeout(() => setStep(2), 300);
                  }}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    category === cat
                      ? 'border-green-600 bg-green-50'
                      : 'border-gray-200 hover:border-green-300'
                  }`}
                >
                  <p className="font-semibold text-gray-900">{cat}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Photo */}
        {step === 2 && (
          <div className="bg-white rounded-xl shadow-lg p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Upload Photo Evidence</h2>
            <div className="space-y-4">
              {imagePreview ? (
                <div className="relative">
                  <img src={imagePreview} alt="Preview" className="w-full h-64 object-cover rounded-lg" />
                  <button
                    onClick={() => {
                      setImagePreview(null);
                      setImageFile(null);
                      fileInputRef.current?.click();
                    }}
                    className="absolute top-2 right-2 bg-red-600 text-white px-4 py-2 rounded-lg"
                  >
                    Change
                  </button>
                </div>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center cursor-pointer hover:border-green-500 transition-colors"
                >
                  <svg className="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <p className="text-gray-600">Click to upload photo</p>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="hidden"
              />
            </div>
            <div className="flex justify-between mt-6">
              <button onClick={() => setStep(1)} className="px-6 py-2 bg-gray-200 text-gray-900 rounded-lg font-semibold hover:bg-gray-300">Back</button>
              <button
                onClick={() => imageFile && setStep(3)}
                disabled={!imageFile}
                className="px-6 py-2 bg-green-600 text-white rounded-lg disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Details */}
        {step === 3 && (
          <div className="bg-white rounded-xl shadow-lg p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Listing Details</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">Title *</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 text-gray-900"
                  placeholder="e.g., Fresh vegetable scraps"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">Weight (kg)</label>
                  <input
                    type="number"
                    value={weightKg}
                    onChange={(e) => setWeightKg(e.target.value)}
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg text-gray-900"
                    placeholder="Optional"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">Price * ({currency})</label>
                  <input
                    type="number"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg text-gray-900"
                    placeholder="0.00"
                    step="0.01"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg text-gray-900"
                  rows={3}
                  placeholder="Additional details about the waste..."
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">Pickup Address *</label>
                <div className="flex gap-2">
                  <input
                    ref={addressInputRef}
                    type="text"
                    value={address}
                    onChange={(e) => {
                      setAddress(e.target.value);
                      // Clear coordinates when address changes manually (unless from autocomplete)
                      if (!autocompleteRef.current?.getPlace()) {
                        setLatitude(null);
                        setLongitude(null);
                      }
                    }}
                    onBlur={() => {
                      // If address is set but no coordinates, try to geocode
                      if (address && !latitude && !longitude) {
                        geocodeAddress(address);
                      }
                    }}
                    className="flex-1 px-4 py-2 border-2 border-gray-200 rounded-lg text-gray-900"
                    placeholder="Enter address or select from dropdown"
                  />
                  <button
                    type="button"
                    onClick={useCurrentLocation}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    Use GPS
                  </button>
                </div>
                {latitude && longitude && (
                  <p className="text-xs text-green-600 mt-1">
                    ✓ Coordinates: {latitude.toFixed(5)}, {longitude.toFixed(5)}
                  </p>
                )}
              </div>
            </div>
            <div className="flex justify-between mt-6">
              <button onClick={() => setStep(2)} className="px-6 py-2 bg-gray-200 text-gray-900 rounded-lg font-semibold hover:bg-gray-300">Back</button>
              <button
                onClick={() => {
                  if (!title || !price || !address || !latitude || !longitude) {
                    toast.error('Please fill all required fields including address with GPS coordinates');
                    return;
                  }
                  setStep(4);
                }}
                disabled={!title || !price || !address || !latitude || !longitude}
                className="px-6 py-2 bg-green-600 text-white rounded-lg disabled:opacity-50"
              >
                Next
              </button>
            </div>
            {address && (!latitude || !longitude) && (
              <p className="text-sm text-red-600 mt-2">
                Please use the "Use GPS" button or select an address from the dropdown to get coordinates.
              </p>
            )}
          </div>
        )}

        {/* Step 4: Schedule */}
        {step === 4 && (
          <div className="bg-white rounded-xl shadow-lg p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Pickup Schedule</h2>
            
            {/* Schedule Type Selector */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-900 mb-3">Schedule Type *</label>
              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => setScheduleType('one-time')}
                  className={`flex-1 px-4 py-3 rounded-lg border-2 font-semibold transition-colors ${
                    scheduleType === 'one-time'
                      ? 'bg-green-600 text-white border-green-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-green-500'
                  }`}
                >
                  One-Time
                </button>
                <button
                  type="button"
                  onClick={() => setScheduleType('recurring')}
                  className={`flex-1 px-4 py-3 rounded-lg border-2 font-semibold transition-colors ${
                    scheduleType === 'recurring'
                      ? 'bg-green-600 text-white border-green-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-green-500'
                  }`}
                >
                  Recurring
                </button>
              </div>
            </div>

            <div className="space-y-4">
              {scheduleType === 'one-time' ? (
                <>
                  {/* One-Time Schedule */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-900 mb-2">Start Date & Time *</label>
                      <input
                        type="datetime-local"
                        value={newWindowStart}
                        min={getMinDateTime()}
                        onChange={(e) => {
                          setNewWindowStart(e.target.value);
                          if (e.target.value && newWindowEnd && new Date(e.target.value) >= new Date(newWindowEnd)) {
                            setNewWindowEnd('');
                          }
                        }}
                        className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg text-gray-900"
                      />
                      <p className="text-xs text-gray-500 mt-1">Must be today or in the future</p>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-900 mb-2">End Date & Time *</label>
                      <input
                        type="datetime-local"
                        value={newWindowEnd}
                        min={newWindowStart || getMinDateTime()}
                        onChange={(e) => setNewWindowEnd(e.target.value)}
                        className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg text-gray-900 disabled:text-gray-500"
                        disabled={!newWindowStart}
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        {newWindowStart ? 'Must be after start time' : 'Select start time first'}
                      </p>
                    </div>
                  </div>
                  {newWindowStart && newWindowEnd && new Date(newWindowStart) >= new Date(newWindowEnd) && (
                    <p className="text-sm text-red-600">
                      ⚠️ End time must be after start time
                    </p>
                  )}
                  {newWindowStart && new Date(newWindowStart) < new Date() && (
                    <p className="text-sm text-red-600">
                      ⚠️ Start time cannot be in the past
                    </p>
                  )}
                </>
              ) : (
                <>
                  {/* Recurring Schedule */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">Days of Week *</label>
                    <div className="grid grid-cols-7 gap-2">
                      {dayAbbr.map((day, index) => (
                        <button
                          key={index}
                          type="button"
                          onClick={() => toggleRecurringDay(index)}
                          className={`px-3 py-2 rounded-lg border-2 font-semibold text-sm transition-colors ${
                            recurringDays.includes(index)
                              ? 'bg-green-600 text-white border-green-600'
                              : 'bg-white text-gray-700 border-gray-300 hover:border-green-500'
                          }`}
                        >
                          {day}
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-gray-500 mt-2">Select one or more days</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-900 mb-2">Start Time *</label>
                      <input
                        type="time"
                        value={recurringStartTime}
                        onChange={(e) => {
                          setRecurringStartTime(e.target.value);
                          if (e.target.value && recurringEndTime && e.target.value >= recurringEndTime) {
                            setRecurringEndTime('');
                          }
                        }}
                        className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg text-gray-900"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-900 mb-2">End Time *</label>
                      <input
                        type="time"
                        value={recurringEndTime}
                        min={recurringStartTime}
                        onChange={(e) => setRecurringEndTime(e.target.value)}
                        className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg text-gray-900 disabled:text-gray-500"
                        disabled={!recurringStartTime}
                      />
                    </div>
                  </div>
                  {recurringStartTime && recurringEndTime && recurringEndTime <= recurringStartTime && (
                    <p className="text-sm text-red-600">
                      ⚠️ End time must be after start time
                    </p>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-900 mb-2">Start Date *</label>
                      <input
                        type="date"
                        value={recurringStartDate}
                        min={getMinDate()}
                        onChange={(e) => {
                          setRecurringStartDate(e.target.value);
                          if (e.target.value && recurringEndDate && new Date(e.target.value) >= new Date(recurringEndDate)) {
                            setRecurringEndDate('');
                          }
                        }}
                        className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg text-gray-900"
                      />
                      <p className="text-xs text-gray-500 mt-1">When recurring schedule begins</p>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-900 mb-2">End Date (Optional)</label>
                      <input
                        type="date"
                        value={recurringEndDate}
                        min={recurringStartDate || getMinDate()}
                        onChange={(e) => setRecurringEndDate(e.target.value)}
                        className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg text-gray-900 disabled:text-gray-500"
                        disabled={!recurringStartDate}
                      />
                      <p className="text-xs text-gray-500 mt-1">Leave empty for ongoing schedule (max 12 weeks)</p>
                    </div>
                  </div>
                </>
              )}

              <button
                onClick={addPickupWindow}
                className="w-full px-4 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700"
              >
                {scheduleType === 'one-time' ? 'Add Window' : 'Generate Recurring Windows'}
              </button>

              {pickupWindows.length > 0 && (
                <div className="mt-4">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="text-sm font-semibold text-gray-900">
                      Added Windows ({pickupWindows.length})
                    </h3>
                    <button
                      onClick={() => setPickupWindows([])}
                      className="text-sm text-red-600 hover:text-red-800"
                    >
                      Clear All
                    </button>
                  </div>
                  <div className="max-h-60 overflow-y-auto space-y-2">
                    {pickupWindows.map((window, index) => (
                      <div key={index} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                        <span className="text-sm text-gray-900">
                          {new Date(window.start).toLocaleString()} - {new Date(window.end).toLocaleString()}
                        </span>
                        <button
                          onClick={() => removePickupWindow(index)}
                          className="text-red-600 hover:text-red-800 text-sm font-semibold"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="flex justify-between mt-6">
              <button onClick={() => setStep(3)} className="px-6 py-2 bg-gray-200 text-gray-900 rounded-lg font-semibold hover:bg-gray-300">Back</button>
              <button
                onClick={handleSubmit}
                disabled={submitting || pickupWindows.length === 0}
                className="px-6 py-2 bg-green-600 text-white rounded-lg disabled:opacity-50"
              >
                {submitting ? 'Publishing...' : 'Publish Listing'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

