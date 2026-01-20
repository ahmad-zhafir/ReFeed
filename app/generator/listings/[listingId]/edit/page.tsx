'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { getFirestoreDb, getFirebaseStorage, onAuthStateChange } from '@/lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { User } from 'firebase/auth';
import { UserProfile, MarketplaceListing, MarketplacePickupWindow } from '@/lib/types';
import { getUserProfile } from '@/lib/userProfile';
import { getListingsCollectionPath } from '@/lib/constants';
import RoleGuard from '@/components/RoleGuard';
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

export default function EditListingPage() {
  return (
    <RoleGuard allowedRoles={['generator']}>
      <EditListingContent />
    </RoleGuard>
  );
}

function EditListingContent() {
  const router = useRouter();
  const params = useParams();
  const listingId = params.listingId as string;
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
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
  const [existingImageUrl, setExistingImageUrl] = useState<string | null>(null);
  const [address, setAddress] = useState('');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [pickupWindows, setPickupWindows] = useState<MarketplacePickupWindow[]>([]);
  
  const [scheduleType, setScheduleType] = useState<'one-time' | 'recurring'>('one-time');
  const [newWindowStart, setNewWindowStart] = useState('');
  const [newWindowEnd, setNewWindowEnd] = useState('');
  const [recurringDays, setRecurringDays] = useState<number[]>([]);
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
        await loadListing(currentUser.uid);
      } else {
        router.push('/login');
      }
    });

    return () => unsubscribe();
  }, [router, listingId]);

  const loadListing = async (generatorUid: string) => {
    try {
      const db = getFirestoreDb();
      const listingDoc = await getDoc(doc(db, getListingsCollectionPath(), listingId));
      
      if (!listingDoc.exists()) {
        toast.error('Listing not found');
        router.push('/generator');
        return;
      }

      const listingData = { id: listingDoc.id, ...listingDoc.data() } as MarketplaceListing;
      
      if (listingData.generatorUid !== generatorUid) {
        toast.error('Unauthorized');
        router.push('/generator');
        return;
      }

      // Only allow editing if status is 'live'
      if (listingData.status !== 'live') {
        toast.error('Only live listings can be edited');
        router.push(`/generator/listings/${listingId}`);
        return;
      }

      // Pre-fill form with existing data
      setCategory(listingData.category);
      setTitle(listingData.title);
      setWeightKg(listingData.weightKg?.toString() || '');
      setNotes(listingData.notes || '');
      setPrice(listingData.price.toString());
      setCurrency(listingData.currency);
      setExistingImageUrl(listingData.imageUrl);
      setImagePreview(listingData.imageUrl);
      setAddress(listingData.address);
      setLatitude(listingData.latitude);
      setLongitude(listingData.longitude);
      setPickupWindows(listingData.pickupWindows || []);

      setLoading(false);
    } catch (error) {
      console.error('Error loading listing:', error);
      toast.error('Failed to load listing');
      router.push('/generator');
    }
  };

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
    e.preventDefault();
    e.stopPropagation();
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
      setExistingImageUrl(null);
    }
    if (e.target) {
      e.target.value = '';
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

      if (recurringEndTime <= recurringStartTime) {
        toast.error('End time must be after start time');
        return;
      }

      const startDate = new Date(recurringStartDate);
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      if (startDate < now) {
        toast.error('Start date must be today or in the future');
        return;
      }

      const endDate = recurringEndDate ? new Date(recurringEndDate) : null;
      const generatedWindows: MarketplacePickupWindow[] = [];
      const currentDate = new Date(startDate);
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

  const getMinDateTime = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

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
    if (!category || !title || !price || !address || !latitude || !longitude || pickupWindows.length === 0) {
      toast.error('Please fill all required fields');
      return;
    }

    if (!imagePreview && !existingImageUrl) {
      toast.error('Please upload an image');
      return;
    }

    setSubmitting(true);
    try {
      const db = getFirestoreDb();
      const storage = getFirebaseStorage();

      let imageUrl = existingImageUrl;

      // Upload new image if provided
      if (imageFile) {
        const imageRef = ref(storage, `listings/${user!.uid}/${Date.now()}_${imageFile.name}`);
        await uploadBytes(imageRef, imageFile);
        imageUrl = await getDownloadURL(imageRef);
      }

      // Update listing
      const listingData: any = {
        category,
        title,
        price: parseFloat(price),
        currency,
        address,
        latitude,
        longitude,
        imageUrl,
        pickupWindows,
      };

      if (weightKg) {
        listingData.weightKg = parseFloat(weightKg);
      }
      if (notes && notes.trim()) {
        listingData.notes = notes.trim();
      } else {
        listingData.notes = null;
      }

      Object.keys(listingData).forEach(key => {
        if (listingData[key] === undefined) {
          delete listingData[key];
        }
      });

      await updateDoc(doc(db, getListingsCollectionPath(), listingId), listingData);
      toast.success('Listing updated successfully!');
      router.push(`/generator/listings/${listingId}`);
    } catch (error: any) {
      console.error('Error updating listing:', error);
      toast.error('Failed to update listing. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const progressPercentage = ((step - 1) / 3) * 100;
  const stepNames = ['Category', 'Photo', 'Details', 'Schedule'];
  const currentStepName = stepNames[step - 1] || 'Category';

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

  // Continue with the rest of the component - copying the structure from new listing page
  // but with edit-specific changes...
  return (
    <div className="font-display bg-[#f6f8f6] dark:bg-[#102213] text-slate-900 dark:text-white antialiased min-h-screen flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-solid border-gray-200 dark:border-[#234829] bg-white/80 dark:bg-[#102213]/80 backdrop-blur-md">
        <div className="px-6 md:px-10 py-3 flex items-center justify-between w-full">
          <Link href="/generator" className="flex items-center gap-4 text-slate-900 dark:text-white cursor-pointer">
            <div className="size-8 text-[#13ec37]">
              <svg fill="none" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                <path d="M42.4379 44C42.4379 44 36.0744 33.9038 41.1692 24C46.8624 12.9336 42.2078 4 42.2078 4L7.01134 4C7.01134 4 11.6577 12.932 5.96912 23.9969C0.876273 33.9029 7.27094 44 7.27094 44L42.4379 44Z" fill="currentColor"></path>
              </svg>
            </div>
            <h2 className="text-xl font-bold leading-tight tracking-[-0.015em]">ReFeed</h2>
          </Link>
        </div>
      </header>

      {/* Main Content - Same structure as new listing page */}
      <main className="flex-1 w-full max-w-[1280px] mx-auto px-4 md:px-10 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
          <div className="lg:col-span-8 flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 text-[#92c99b] text-sm font-medium">
                <span className="material-symbols-outlined text-lg">arrow_back</span>
                <Link href={`/generator/listings/${listingId}`} className="hover:underline">Back to Listing</Link>
              </div>
              <h1 className="text-slate-900 dark:text-white tracking-tight text-3xl md:text-[32px] font-bold leading-tight">Edit Waste Listing</h1>
              <p className="text-slate-500 dark:text-[#92c99b] text-base">Update your listing details. Changes will be reflected immediately.</p>
            </div>

            {/* Progress Bar */}
            <div className="flex flex-col gap-3 py-2">
              <div className="flex gap-6 justify-between items-end">
                <p className="text-slate-900 dark:text-white text-base font-medium leading-normal">
                  Step {step} of 4: {currentStepName}
                </p>
                <span className="text-slate-500 dark:text-[#92c99b] text-sm">{Math.round(progressPercentage)}% Completed</span>
              </div>
              <div className="rounded-full bg-gray-200 dark:bg-[#32673b] h-2 w-full overflow-hidden">
                <div className="h-full bg-[#13ec37] rounded-full transition-all duration-500" style={{ width: `${progressPercentage}%` }}></div>
              </div>
            </div>

            {/* Form Card - Reuse structure from new listing page but pre-filled */}
            <div className="bg-white dark:bg-[#1c2e20] border border-gray-200 dark:border-[#234829] rounded-xl p-6 md:p-8 shadow-sm flex flex-col gap-8">
              {/* Step 1: Category - Same as new listing */}
              {step === 1 && (
                <div className="flex flex-col gap-6">
                  <div>
                    <label className="text-slate-900 dark:text-white text-base font-medium leading-normal mb-2 block">
                      Waste Category <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full appearance-none rounded-lg bg-gray-50 dark:bg-[#102213] border border-gray-300 dark:border-[#234829] text-slate-900 dark:text-white h-14 px-4 pr-10 focus:outline-none focus:ring-2 focus:ring-[#13ec37] focus:border-transparent transition-all"
                    >
                      <option value="">Select category</option>
                      {WASTE_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                    <p className="text-xs text-slate-500 dark:text-[#92c99b] pl-1 mt-1">Choose the primary composition of the waste.</p>
                  </div>
                </div>
              )}

              {/* Step 2: Photo - Same as new listing but show existing image */}
              {step === 2 && (
                <div className="flex flex-col gap-4">
                  <div className="flex justify-between items-center">
                    <label className="text-slate-900 dark:text-white text-base font-medium leading-normal">Photo Verification</label>
                    <span className="text-xs bg-[#13ec37]/20 text-[#13ec37] px-2 py-1 rounded font-medium">Required</span>
                  </div>
                  <input
                    ref={fileInputRef}
                    accept="image/*"
                    className="hidden"
                    type="file"
                    onChange={handleImageChange}
                  />
                  {imagePreview ? (
                    <div className="relative border-2 border-dashed border-[#13ec37] rounded-xl bg-gray-50 dark:bg-[#102213] p-4">
                      <img src={imagePreview} alt="Preview" className="w-full h-64 object-cover rounded-lg" />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setImagePreview(existingImageUrl);
                          setImageFile(null);
                          if (fileInputRef.current) {
                            fileInputRef.current.value = '';
                          }
                        }}
                        className="absolute top-6 right-6 bg-red-500/90 hover:bg-red-600 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                      >
                        Change
                      </button>
                    </div>
                  ) : (
                    <div
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        fileInputRef.current?.click();
                      }}
                      className="relative border-2 border-dashed border-gray-300 dark:border-[#32673b] hover:border-[#13ec37] dark:hover:border-[#13ec37] rounded-xl bg-gray-50 dark:bg-[#102213] p-8 flex flex-col items-center justify-center text-center transition-colors cursor-pointer group"
                    >
                      <div className="size-16 rounded-full bg-[#13ec37]/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                        <span className="material-symbols-outlined text-[#13ec37] text-3xl">add_a_photo</span>
                      </div>
                      <h3 className="text-slate-900 dark:text-white font-medium text-lg mb-1">Click to upload or drag and drop</h3>
                      <p className="text-slate-500 dark:text-[#92c99b] text-sm max-w-xs">SVG, PNG, JPG or GIF (max. 800x400px). Ensure contents are clearly visible.</p>
                    </div>
                  )}
                </div>
              )}

              {/* Step 3: Details - Same as new listing but pre-filled */}
              {step === 3 && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="flex flex-col gap-2">
                      <label className="text-slate-900 dark:text-white text-base font-medium leading-normal">
                        Listing Title <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="w-full rounded-lg bg-gray-50 dark:bg-[#234829] border border-gray-300 dark:border-[#234829] text-slate-900 dark:text-white h-12 px-4 focus:outline-none focus:ring-2 focus:ring-[#13ec37] focus:border-transparent transition-all placeholder:text-slate-400 dark:placeholder:text-[#92c99b]/50"
                        placeholder="e.g., Fresh Coffee Grounds"
                      />
                    </div>

                    <div className="flex flex-col gap-2">
                      <label className="text-slate-900 dark:text-white text-base font-medium leading-normal">
                        Category
                      </label>
                      <input
                        type="text"
                        value={category}
                        readOnly
                        className="w-full rounded-lg bg-gray-100 dark:bg-[#112214] border border-gray-300 dark:border-[#234829] text-slate-600 dark:text-[#92c99b] h-12 px-4 cursor-not-allowed"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="flex flex-col gap-2">
                      <label className="text-slate-900 dark:text-white text-base font-medium leading-normal">Weight (kg)</label>
                      <div className="relative">
                        <input
                          type="number"
                          step="0.1"
                          value={weightKg}
                          onChange={(e) => setWeightKg(e.target.value)}
                          className="w-full rounded-lg bg-gray-50 dark:bg-[#234829] border border-gray-300 dark:border-[#234829] text-slate-900 dark:text-white h-12 px-4 pr-12 focus:outline-none focus:ring-2 focus:ring-[#13ec37] focus:border-transparent transition-all placeholder:text-slate-400 dark:placeholder:text-[#92c99b]/50"
                          placeholder="0.00"
                        />
                        <div className="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none">
                          <span className="text-slate-500 dark:text-[#92c99b] font-medium">kg</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      <label className="text-slate-900 dark:text-white text-base font-medium leading-normal">
                        Price ({currency}) <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          step="0.01"
                          value={price}
                          onChange={(e) => setPrice(e.target.value)}
                          className="w-full rounded-lg bg-gray-50 dark:bg-[#234829] border border-gray-300 dark:border-[#234829] text-slate-900 dark:text-white h-12 px-4 pr-16 focus:outline-none focus:ring-2 focus:ring-[#13ec37] focus:border-transparent transition-all placeholder:text-slate-400 dark:placeholder:text-[#92c99b]/50"
                          placeholder="0.00"
                        />
                        <div className="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none">
                          <select
                            value={currency}
                            onChange={(e) => setCurrency(e.target.value)}
                            className="bg-transparent border-none text-slate-900 dark:text-white font-medium focus:outline-none cursor-pointer"
                          >
                            <option value="MYR">MYR</option>
                            <option value="USD">USD</option>
                            <option value="SGD">SGD</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="text-slate-900 dark:text-white text-base font-medium leading-normal">Pickup Address <span className="text-red-500">*</span></label>
                    <div className="flex gap-2">
                      <input
                        ref={addressInputRef}
                        type="text"
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        onBlur={() => {
                          if (address && (!latitude || !longitude)) {
                            geocodeAddress(address);
                          }
                        }}
                        className="flex-1 rounded-lg bg-gray-50 dark:bg-[#234829] border border-gray-300 dark:border-[#234829] text-slate-900 dark:text-white h-12 px-4 focus:outline-none focus:ring-2 focus:ring-[#13ec37] focus:border-transparent transition-all placeholder:text-slate-400 dark:placeholder:text-[#92c99b]/50"
                        placeholder="Enter address"
                      />
                      <button
                        type="button"
                        onClick={useCurrentLocation}
                        className="px-4 py-2 bg-[#234829] hover:bg-[#32673b] text-white rounded-lg transition-colors flex items-center gap-2"
                      >
                        <span className="material-symbols-outlined">my_location</span>
                        GPS
                      </button>
                    </div>
                    {latitude && longitude && (
                      <p className="text-xs text-slate-500 dark:text-[#92c99b]">
                        Coordinates: {latitude.toFixed(6)}, {longitude.toFixed(6)}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="text-slate-900 dark:text-white text-base font-medium leading-normal">Notes</label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={4}
                      className="w-full rounded-lg bg-gray-50 dark:bg-[#234829] border border-gray-300 dark:border-[#234829] text-slate-900 dark:text-white px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#13ec37] focus:border-transparent transition-all placeholder:text-slate-400 dark:placeholder:text-[#92c99b]/50 resize-none"
                      placeholder="Additional information about the waste..."
                    />
                  </div>
                </>
              )}

              {/* Step 4: Schedule - Same as new listing but show existing windows */}
              {step === 4 && (
                <div className="flex flex-col gap-6">
                  <div className="flex flex-col gap-4">
                    <label className="text-slate-900 dark:text-white text-base font-medium leading-normal">
                      Schedule Type
                    </label>
                    <div className="grid grid-cols-2 gap-4">
                      <button
                        type="button"
                        onClick={() => setScheduleType('one-time')}
                        className={`p-4 rounded-lg border-2 transition-all ${
                          scheduleType === 'one-time'
                            ? 'border-[#13ec37] bg-[#13ec37]/10 dark:bg-[#13ec37]/20'
                            : 'border-gray-300 dark:border-[#234829] hover:border-[#13ec37]/50'
                        }`}
                      >
                        <span className="material-symbols-outlined text-2xl mb-2 block">event</span>
                        <p className="font-semibold text-slate-900 dark:text-white">One-Time</p>
                      </button>
                      <button
                        type="button"
                        onClick={() => setScheduleType('recurring')}
                        className={`p-4 rounded-lg border-2 transition-all ${
                          scheduleType === 'recurring'
                            ? 'border-[#13ec37] bg-[#13ec37]/10 dark:bg-[#13ec37]/20'
                            : 'border-gray-300 dark:border-[#234829] hover:border-[#13ec37]/50'
                        }`}
                      >
                        <span className="material-symbols-outlined text-2xl mb-2 block">repeat</span>
                        <p className="font-semibold text-slate-900 dark:text-white">Recurring</p>
                      </button>
                    </div>
                  </div>

                  {scheduleType === 'one-time' ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="flex flex-col gap-2">
                        <label className="text-slate-900 dark:text-white text-sm font-medium">Start Date & Time</label>
                        <input
                          type="datetime-local"
                          value={newWindowStart}
                          onChange={(e) => setNewWindowStart(e.target.value)}
                          min={getMinDateTime()}
                          className="w-full rounded-lg bg-gray-50 dark:bg-[#234829] border border-gray-300 dark:border-[#234829] text-slate-900 dark:text-white h-12 px-4 focus:outline-none focus:ring-2 focus:ring-[#13ec37] focus:border-transparent transition-all"
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                        <label className="text-slate-900 dark:text-white text-sm font-medium">End Date & Time</label>
                        <input
                          type="datetime-local"
                          value={newWindowEnd}
                          onChange={(e) => setNewWindowEnd(e.target.value)}
                          min={newWindowStart || getMinDateTime()}
                          className="w-full rounded-lg bg-gray-50 dark:bg-[#234829] border border-gray-300 dark:border-[#234829] text-slate-900 dark:text-white h-12 px-4 focus:outline-none focus:ring-2 focus:ring-[#13ec37] focus:border-transparent transition-all"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="flex flex-col gap-2">
                          <label className="text-slate-900 dark:text-white text-sm font-medium">Start Date</label>
                          <input
                            type="date"
                            value={recurringStartDate}
                            onChange={(e) => setRecurringStartDate(e.target.value)}
                            min={getMinDate()}
                            className="w-full rounded-lg bg-gray-50 dark:bg-[#234829] border border-gray-300 dark:border-[#234829] text-slate-900 dark:text-white h-12 px-4 focus:outline-none focus:ring-2 focus:ring-[#13ec37] focus:border-transparent transition-all"
                          />
                        </div>
                        <div className="flex flex-col gap-2">
                          <label className="text-slate-900 dark:text-white text-sm font-medium">End Date (Optional)</label>
                          <input
                            type="date"
                            value={recurringEndDate}
                            onChange={(e) => setRecurringEndDate(e.target.value)}
                            min={recurringStartDate || getMinDate()}
                            className="w-full rounded-lg bg-gray-50 dark:bg-[#234829] border border-gray-300 dark:border-[#234829] text-slate-900 dark:text-white h-12 px-4 focus:outline-none focus:ring-2 focus:ring-[#13ec37] focus:border-transparent transition-all"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="flex flex-col gap-2">
                          <label className="text-slate-900 dark:text-white text-sm font-medium">Start Time</label>
                          <input
                            type="time"
                            value={recurringStartTime}
                            onChange={(e) => setRecurringStartTime(e.target.value)}
                            className="w-full rounded-lg bg-gray-50 dark:bg-[#234829] border border-gray-300 dark:border-[#234829] text-slate-900 dark:text-white h-12 px-4 focus:outline-none focus:ring-2 focus:ring-[#13ec37] focus:border-transparent transition-all"
                          />
                        </div>
                        <div className="flex flex-col gap-2">
                          <label className="text-slate-900 dark:text-white text-sm font-medium">End Time</label>
                          <input
                            type="time"
                            value={recurringEndTime}
                            onChange={(e) => setRecurringEndTime(e.target.value)}
                            className="w-full rounded-lg bg-gray-50 dark:bg-[#234829] border border-gray-300 dark:border-[#234829] text-slate-900 dark:text-white h-12 px-4 focus:outline-none focus:ring-2 focus:ring-[#13ec37] focus:border-transparent transition-all"
                          />
                        </div>
                      </div>
                      <div className="flex flex-col gap-2">
                        <label className="text-slate-900 dark:text-white text-sm font-medium">Days of Week</label>
                        <div className="grid grid-cols-7 gap-2">
                          {dayNames.map((day, index) => (
                            <button
                              key={index}
                              type="button"
                              onClick={() => toggleRecurringDay(index)}
                              className={`p-2 rounded-lg border-2 transition-all text-sm font-medium ${
                                recurringDays.includes(index)
                                  ? 'border-[#13ec37] bg-[#13ec37]/10 dark:bg-[#13ec37]/20 text-[#13ec37]'
                                  : 'border-gray-300 dark:border-[#234829] text-slate-700 dark:text-[#92c99b] hover:border-[#13ec37]/50'
                              }`}
                            >
                              {dayAbbr[index]}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  <button
                    onClick={addPickupWindow}
                    className="w-full py-3 bg-[#234829] hover:bg-[#32673b] text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                  >
                    <span className="material-symbols-outlined">add</span>
                    Add Pickup Window
                  </button>

                  {pickupWindows.length > 0 && (
                    <div className="flex flex-col gap-2">
                      <label className="text-slate-900 dark:text-white text-base font-medium leading-normal">Current Pickup Windows</label>
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {pickupWindows.map((window, index) => (
                          <div key={index} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-[#234829] rounded-lg border border-gray-200 dark:border-[#234829]">
                            <p className="text-slate-900 dark:text-white text-sm">
                              {new Date(window.start).toLocaleString()} - {new Date(window.end).toLocaleString()}
                            </p>
                            <button
                              onClick={() => removePickupWindow(index)}
                              className="p-1 text-red-400 hover:text-red-300 transition-colors"
                            >
                              <span className="material-symbols-outlined text-lg">delete</span>
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Navigation Buttons */}
              <div className="flex flex-col sm:flex-row gap-4 pt-4 mt-auto">
                {step > 1 && (
                  <button
                    onClick={() => setStep(step - 1)}
                    className="flex-1 sm:flex-none px-6 h-12 rounded-lg border border-gray-300 dark:border-[#234829] text-slate-700 dark:text-white font-medium hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
                  >
                    Back
                  </button>
                )}
                {step < 4 ? (
                  <button
                    onClick={() => {
                      if (step === 1 && !category) {
                        toast.error('Please select a category');
                        return;
                      }
                      if (step === 2 && !imagePreview) {
                        toast.error('Please upload an image');
                        return;
                      }
                      if (step === 3) {
                        if (!title || !price || !address || !latitude || !longitude) {
                          toast.error('Please fill all required fields');
                          return;
                        }
                      }
                      setStep(step + 1);
                    }}
                    className="flex-1 h-12 rounded-lg bg-[#13ec37] hover:bg-[#11d632] text-[#112214] font-bold transition-colors flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(19,236,55,0.3)]"
                  >
                    Next
                    <span className="material-symbols-outlined text-lg">arrow_forward</span>
                  </button>
                ) : (
                  <button
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="flex-1 h-12 rounded-lg bg-[#13ec37] hover:bg-[#11d632] text-[#112214] font-bold transition-colors flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(19,236,55,0.3)] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submitting ? 'Updating...' : 'Update Listing'}
                    <span className="material-symbols-outlined text-lg">check</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Safety Standards */}
          <div className="lg:col-span-4 flex flex-col gap-6">
            <div className="bg-[#e8f5e9] dark:bg-[#152a19] border border-[#c8e6c9] dark:border-[#1e3f24] rounded-xl p-6 sticky top-24">
              <div className="flex items-center gap-3 mb-6">
                <div className="bg-[#13ec37] text-black p-1.5 rounded-lg flex items-center justify-center">
                  <span className="material-symbols-outlined">shield</span>
                </div>
                <h3 className="text-slate-900 dark:text-white text-lg font-bold">Safety Standards</h3>
              </div>
              <p className="text-slate-700 dark:text-gray-300 text-sm mb-6 leading-relaxed">
                To ensure high-quality compost for our partner farmers, please verify your waste meets these strict criteria before submitting.
              </p>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 mt-0.5 text-[#13ec37]">
                    <span className="material-symbols-outlined">check_circle</span>
                  </div>
                  <div>
                    <p className="text-slate-900 dark:text-white font-medium text-sm">No Inorganic Material</p>
                    <p className="text-slate-600 dark:text-[#92c99b] text-xs">Zero tolerance for plastic, glass, metal, or rubber bands.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 mt-0.5 text-[#13ec37]">
                    <span className="material-symbols-outlined">check_circle</span>
                  </div>
                  <div>
                    <p className="text-slate-900 dark:text-white font-medium text-sm">Low Fat/Oil Content</p>
                    <p className="text-slate-600 dark:text-[#92c99b] text-xs">Avoid large quantities of grease or fryer oil.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 mt-0.5 text-[#13ec37]">
                    <span className="material-symbols-outlined">check_circle</span>
                  </div>
                  <div>
                    <p className="text-slate-900 dark:text-white font-medium text-sm">No Hazardous Waste</p>
                    <p className="text-slate-600 dark:text-[#92c99b] text-xs">No cleaning chemicals, batteries, or medical waste.</p>
                  </div>
                </div>
              </div>
              <div className="mt-8 p-4 bg-white/50 dark:bg-black/20 rounded-lg border border-[#13ec37]/10">
                <div className="flex items-center gap-2 mb-2">
                  <span className="material-symbols-outlined text-[#13ec37] text-sm">lightbulb</span>
                  <span className="text-xs font-bold uppercase tracking-wider text-[#13ec37]">Pro Tip</span>
                </div>
                <p className="text-slate-600 dark:text-[#92c99b] text-xs">
                  Chopping larger vegetative scraps into smaller pieces speeds up the composting process and earns bonus points.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
