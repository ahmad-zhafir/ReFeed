'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { getFirestoreDb, getFirebaseStorage, onAuthStateChange } from '@/lib/firebase';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { User } from 'firebase/auth';
import { UserProfile, MarketplacePickupWindow } from '@/lib/types';
import { getUserProfile } from '@/lib/userProfile';
import { getListingsCollectionPath } from '@/lib/constants';
import RoleGuard from '@/components/RoleGuard';
import Link from 'next/link';
import Image from 'next/image';
import toast from 'react-hot-toast';
import { useLoadScript, GoogleMap, Marker } from '@react-google-maps/api';

const WASTE_CATEGORIES = [
  'Vegetative',
  'Bakery',
  'Dairy',
  'Meat',
  'Fruit Scraps & Rinds',
  'Leafy Greens',
  'Others'
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
  const [currency] = useState('MYR');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
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
    e.preventDefault();
    e.stopPropagation();
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      if (files.length === 1) {
        // Single image
        const file = files[0];
        setImageFile(file);
        const reader = new FileReader();
        reader.onloadend = () => {
          setImagePreview(reader.result as string);
        };
        reader.readAsDataURL(file);
        setImageFiles([file]);
        setImagePreviews([URL.createObjectURL(file)]);
      } else {
        // Multiple images
        const newFiles = [...imageFiles, ...files];
        setImageFiles(newFiles);
        const newPreviews = newFiles.map(file => URL.createObjectURL(file));
        setImagePreviews(newPreviews);
        // Set first image as primary
        if (newFiles.length > 0) {
          setImageFile(newFiles[0]);
          setImagePreview(newPreviews[0]);
        }
      }
    }
    if (e.target) {
      e.target.value = '';
    }
  };

  const removeImage = (index: number) => {
    const newFiles = imageFiles.filter((_, i) => i !== index);
    const newPreviews = imagePreviews.filter((_, i) => i !== index);
    setImageFiles(newFiles);
    setImagePreviews(newPreviews);
    if (newFiles.length > 0) {
      setImageFile(newFiles[0]);
      setImagePreview(newPreviews[0]);
    } else {
      setImageFile(null);
      setImagePreview(null);
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

  const dayAbbr = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const removePickupWindow = (index: number) => {
    setPickupWindows(pickupWindows.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!category || !title || !price || (!imageFile && imageFiles.length === 0) || !address || !latitude || !longitude || pickupWindows.length === 0) {
      toast.error('Please fill all required fields');
      return;
    }

    setSubmitting(true);
    try {
      const db = getFirestoreDb();
      const storage = getFirebaseStorage();

      // Upload primary image (required)
      const primaryImageFile = imageFiles[0] || imageFile!;
      const primaryImageRef = ref(storage, `listings/${user!.uid}/${Date.now()}_${primaryImageFile.name}`);
      await uploadBytes(primaryImageRef, primaryImageFile);
      const imageUrl = await getDownloadURL(primaryImageRef);

      // Upload additional images if any
      let imageUrls: string[] | undefined;
      if (imageFiles.length > 1) {
        imageUrls = [];
        for (let i = 1; i < imageFiles.length; i++) {
          const file = imageFiles[i];
          const imageRef = ref(storage, `listings/${user!.uid}/${Date.now()}_${i}_${file.name}`);
          await uploadBytes(imageRef, file);
          const url = await getDownloadURL(imageRef);
          imageUrls.push(url);
        }
      }

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

      // Add multiple images if available
      if (imageUrls && imageUrls.length > 0) {
        listingData.imageUrls = imageUrls;
      }

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

  // Calculate progress percentage
  const progressPercentage = ((step - 1) / 3) * 100;
  const stepNames = ['Category', 'Photo', 'Details', 'Schedule'];
  const currentStepName = stepNames[step - 1] || 'Category';

  return (
    <div className="font-fraunces antialiased min-h-screen flex flex-col relative" style={{ background: 'var(--rf-forest)', color: 'var(--rf-bone)' }}>
      <div className="pointer-events-none fixed inset-0 rf-dotgrid opacity-40" />
      {/* Header */}
      <header className="sticky top-0 z-50 w-full backdrop-blur-xl border-b" style={{ background: 'rgba(13,26,16,.85)', borderColor: 'rgba(241,234,216,.10)' }}>
        <div className="px-6 md:px-10 py-3 flex items-center justify-between w-full">
          <Link href="/generator/listings" className="flex items-center gap-3 cursor-pointer">
            <div className="relative size-9">
              <Image src="/images/logo.svg" alt="ReFeed logo" fill sizes="36px" priority className="object-contain" />
            </div>
            <div className="flex flex-col leading-none">
              <h2 className="font-fraunces fraunces-wonk text-xl font-black tracking-[-0.03em]">
                Re<span className="italic font-light" style={{ color: 'var(--rf-sap)' }}>Feed</span>
              </h2>
              <span className="font-mono-jb text-[8px] uppercase tracking-[0.32em] mt-0.5 opacity-60">Kitchen · Ledger</span>
            </div>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative flex-1 w-full max-w-[1280px] mx-auto px-4 md:px-10 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
          {/* Left Column: Form Wizard */}
          <div className="lg:col-span-8 flex flex-col gap-6">
            {/* Header Section */}
            <div className="flex flex-col gap-4">
              <Link href="/generator/listings"
                    className="inline-flex items-center gap-2 font-mono-jb text-[11px] uppercase tracking-[0.25em] opacity-70 hover:opacity-100 hover:text-[color:var(--rf-sap)] w-fit">
                <span aria-hidden>←</span> Back to ledger
              </Link>
              <div className="rf-eyebrow flex items-center gap-3">
                <span className="size-2 rounded-full animate-pulse" style={{ background: 'var(--rf-sap)' }} />
                Chapter 02 · A new entry
              </div>
              <h1 className="rf-headline text-[clamp(2.5rem,6vw,4.5rem)]">
                List the day&apos;s
                <br />
                <span className="italic">surplus.</span>
              </h1>
              <p className="font-instrument italic text-xl max-w-xl" style={{ color: 'rgba(241,234,216,.7)' }}>
                A photo, a price, a pickup window — and the farmers will find it.
              </p>
            </div>

            {/* Progress Bar */}
            <div className="flex flex-col gap-3 py-2">
              <div className="flex gap-6 justify-between items-baseline">
                <p className="font-mono-jb text-[11px] uppercase tracking-[0.25em]">
                  <span className="opacity-60 mr-2">Step {step} / 4</span>
                  <span style={{ color: 'var(--rf-sap)' }}>{currentStepName}</span>
                </p>
                <span className="font-fraunces fraunces-wonk italic text-2xl font-light leading-none" style={{ color: 'var(--rf-sap)' }}>
                  {Math.round(progressPercentage)}<span className="font-mono-jb text-[10px] not-italic opacity-70">%</span>
                </span>
              </div>
              <div className="rounded-full h-1.5 w-full overflow-hidden" style={{ background: 'rgba(241,234,216,.1)' }}>
                <div className="h-full rounded-full transition-all duration-500" style={{ width: `${progressPercentage}%`, background: 'var(--rf-sap)' }}></div>
              </div>
            </div>

            {/* Form Card */}
            <div className="rounded-2xl p-6 md:p-8 flex flex-col gap-8 border"
                 style={{ borderColor: 'rgba(241,234,216,.14)', background: 'rgba(241,234,216,.025)' }}>
              {/* Step 1: Category */}
              {step === 1 && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="flex flex-col gap-2">
                      <label className="text-[var(--rf-bone)] text-base font-medium leading-normal">Waste Category</label>
                      <div className="relative">
                        <select
                          value={category}
                          onChange={(e) => {
                            setCategory(e.target.value);
                            if (e.target.value) {
                              setTimeout(() => setStep(2), 300);
                            }
                          }}
                          className="w-full appearance-none rounded-lg bg-[var(--rf-forest)] border border-[rgba(241,234,216,0.18)] text-[var(--rf-bone)] h-14 px-4 pr-10 focus:outline-none focus:ring-2 focus:ring-[var(--rf-sap)] focus:border-transparent transition-all"
                        >
                          <option disabled value="">Select classification</option>
                          {WASTE_CATEGORIES.map((cat) => (
                            <option key={cat} value={cat}>{cat}</option>
                          ))}
                        </select>
                        <div className="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none text-[var(--rf-sap)]">
                          <span className="material-symbols-outlined">expand_more</span>
                        </div>
                      </div>
                      <p className="text-xs text-[var(--rf-bone)]/60 pl-1">Choose the primary composition of the waste.</p>
                    </div>
                  </div>
                </>
              )}

              {/* Step 2: Photo */}
              {step === 2 && (
                <>
                  <div className="flex flex-col gap-4">
                    <div className="flex justify-between items-center">
                      <label className="text-[var(--rf-bone)] text-base font-medium leading-normal">Photo Verification</label>
                      <span className="text-xs bg-[var(--rf-sap)]/20 text-[var(--rf-sap)] px-2 py-1 rounded font-medium">Required</span>
                    </div>
                    <input
                      ref={fileInputRef}
                      accept="image/*"
                      className="hidden"
                      type="file"
                      multiple
                      onChange={handleImageChange}
                    />
                    {imagePreviews.length > 0 || imagePreview ? (
                      <div className="flex flex-col gap-4">
                        {/* Primary Image Preview */}
                        <div className="relative border-2 border-dashed border-[var(--rf-sap)] rounded-xl bg-[var(--rf-forest)] p-4">
                          <img 
                            src={imagePreviews[0] || imagePreview || ''} 
                            alt="Primary Preview" 
                            className="w-full h-64 object-cover rounded-lg" 
                          />
                        </div>
                        
                        {/* Additional Images Grid */}
                        {imagePreviews.length > 1 && (
                          <div className="grid grid-cols-4 gap-3">
                            {imagePreviews.slice(1).map((preview, index) => (
                              <div key={index} className="relative group">
                                <img 
                                  src={preview} 
                                  alt={`Preview ${index + 2}`} 
                                  className="w-full h-24 object-cover rounded-lg border-2 border-[rgba(241,234,216,0.18)]" 
                                />
                                <button
                                  type="button"
                                  onClick={() => removeImage(index + 1)}
                                  className="absolute top-1 right-1 bg-red-500/90 hover:bg-red-600 text-[var(--rf-bone)] rounded-full p-1 transition-colors opacity-0 group-hover:opacity-100"
                                  title="Remove"
                                >
                                  <span className="material-symbols-outlined text-sm">close</span>
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                        
                        {/* Actions */}
                        <div className="flex gap-3">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              fileInputRef.current?.click();
                            }}
                            className="flex items-center gap-2 px-4 py-2 bg-[var(--rf-moss)] hover:bg-[var(--rf-moss)] text-[var(--rf-bone)] rounded-lg font-medium transition-colors"
                          >
                            <span className="material-symbols-outlined text-lg">add</span>
                            Add More Images
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setImagePreviews([]);
                              setImageFiles([]);
                              setImagePreview(null);
                              setImageFile(null);
                              if (fileInputRef.current) {
                                fileInputRef.current.value = '';
                              }
                            }}
                            className="flex items-center gap-2 px-4 py-2 bg-red-500/90 hover:bg-red-600 text-[var(--rf-bone)] rounded-lg font-medium transition-colors"
                          >
                            <span className="material-symbols-outlined text-lg">delete</span>
                            Clear All
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          fileInputRef.current?.click();
                        }}
                        className="relative border-2 border-dashed border-[rgba(241,234,216,0.18)] hover:border-[var(--rf-sap)] dark:hover:border-[var(--rf-sap)] rounded-xl bg-[var(--rf-forest)] p-8 flex flex-col items-center justify-center text-center transition-colors cursor-pointer group"
                      >
                        <div className="size-16 rounded-full bg-[var(--rf-sap)]/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                          <span className="material-symbols-outlined text-[var(--rf-sap)] text-3xl">add_a_photo</span>
                        </div>
                        <h3 className="text-[var(--rf-bone)] font-medium text-lg mb-1">Click to upload or drag and drop</h3>
                        <p className="text-[var(--rf-bone)]/60 text-sm max-w-xs">SVG, PNG, JPG or GIF. You can upload multiple images (first image will be primary).</p>
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* Step 3: Details */}
              {step === 3 && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="flex flex-col gap-2">
                      <label className="text-[var(--rf-bone)] text-base font-medium leading-normal">Title *</label>
                      <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="w-full rounded-lg bg-[var(--rf-forest)] border border-[rgba(241,234,216,0.18)] text-[var(--rf-bone)] h-14 px-4 focus:outline-none focus:ring-2 focus:ring-[var(--rf-sap)] focus:border-transparent transition-all placeholder:text-[var(--rf-bone)]/50 dark:placeholder:text-[var(--rf-bone-muted)]/50"
                        placeholder="e.g., Fresh vegetable scraps"
                      />
                      <p className="text-xs text-[var(--rf-bone)]/60 pl-1">A clear, descriptive title for your listing.</p>
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="text-[var(--rf-bone)] text-base font-medium leading-normal">Estimated Weight</label>
                      <div className="relative">
                        <input
                          type="number"
                          value={weightKg}
                          onChange={(e) => setWeightKg(e.target.value)}
                          className="w-full rounded-lg bg-[var(--rf-forest)] border border-[rgba(241,234,216,0.18)] text-[var(--rf-bone)] h-14 px-4 pr-12 focus:outline-none focus:ring-2 focus:ring-[var(--rf-sap)] focus:border-transparent transition-all placeholder:text-[var(--rf-bone)]/50 dark:placeholder:text-[var(--rf-bone-muted)]/50"
                          placeholder="0.00"
                        />
                        <div className="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none">
                          <span className="text-[var(--rf-bone)]/60 font-medium">kg</span>
                        </div>
                      </div>
                      <p className="text-xs text-[var(--rf-bone)]/60 pl-1">Use the kitchen scale for accuracy.</p>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-[var(--rf-bone)] text-base font-medium leading-normal">Price *</label>
                    <div className="relative">
                      <input
                        type="number"
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                        className="w-full rounded-lg bg-[var(--rf-forest)] border border-[rgba(241,234,216,0.18)] text-[var(--rf-bone)] h-14 px-4 pr-16 focus:outline-none focus:ring-2 focus:ring-[var(--rf-sap)] focus:border-transparent transition-all placeholder:text-[var(--rf-bone)]/50 dark:placeholder:text-[var(--rf-bone-muted)]/50"
                        placeholder="0.00"
                        step="0.01"
                      />
                      <div className="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none">
                        <span className="text-[var(--rf-bone)]/60 font-medium">{currency}</span>
                      </div>
                    </div>
                    <p className="text-xs text-[var(--rf-bone)]/60 pl-1">Price for this waste listing.</p>
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-[var(--rf-bone)] text-base font-medium leading-normal">Notes</label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="w-full rounded-lg bg-[var(--rf-forest)] border border-[rgba(241,234,216,0.18)] text-[var(--rf-bone)] px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[var(--rf-sap)] focus:border-transparent transition-all placeholder:text-[var(--rf-bone)]/50 dark:placeholder:text-[var(--rf-bone-muted)]/50"
                      rows={3}
                      placeholder="Additional details about the waste..."
                    />
                  </div>
                  <hr className="border-[rgba(241,234,216,0.12)]" />
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-2">
                      <label className="text-[var(--rf-bone)] text-base font-medium leading-normal">Pickup Address *</label>
                      <div className="flex gap-2">
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
                          className="flex-1 rounded-lg bg-[var(--rf-forest)] border border-[rgba(241,234,216,0.18)] text-[var(--rf-bone)] h-14 px-4 focus:outline-none focus:ring-2 focus:ring-[var(--rf-sap)] focus:border-transparent transition-all placeholder:text-[var(--rf-bone)]/50 dark:placeholder:text-[var(--rf-bone-muted)]/50"
                          placeholder="Enter address or select from dropdown"
                        />
                        <button
                          type="button"
                          onClick={useCurrentLocation}
                          className="px-4 py-2 bg-[var(--rf-sap)] hover:bg-[var(--rf-sap-bright)] text-[var(--rf-ink)] rounded-lg font-medium transition-all flex items-center gap-2"
                        >
                          <span className="material-symbols-outlined text-lg">my_location</span>
                          Use GPS
                        </button>
                      </div>
                      {latitude && longitude && (
                        <p className="text-xs text-[var(--rf-sap)] mt-1">
                          ✓ Coordinates: {latitude.toFixed(5)}, {longitude.toFixed(5)}
                        </p>
                      )}
                      {address && (!latitude || !longitude) && (
                        <p className="text-xs text-red-400 mt-1">
                          Please use the "Use GPS" button or select an address from the dropdown to get coordinates.
                        </p>
                      )}
                    </div>

                    {/* Interactive Map */}
                    {isMapsLoaded && (
                      <div className="flex flex-col gap-2">
                        <label className="text-[var(--rf-bone)] text-base font-medium leading-normal">Adjust Pin Location</label>
                        <p className="text-xs text-[var(--rf-bone)]/60 mb-2">
                          Click on the map or drag the pin to set the exact pickup location
                        </p>
                        <div className="w-full h-64 md:h-80 rounded-lg overflow-hidden border-2 border-[rgba(241,234,216,0.18)]">
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
                                  fillColor: 'var(--rf-sap)',
                                  fillOpacity: 1,
                                  strokeColor: '#FFFFFF',
                                  strokeWeight: 3,
                                }}
                              />
                            )}
                          </GoogleMap>
                        </div>
                        {!latitude || !longitude ? (
                          <p className="text-xs text-amber-400 flex items-center gap-1">
                            <span className="material-symbols-outlined text-sm">info</span>
                            Please set location using address input, GPS button, or click on the map
                          </p>
                        ) : (
                          <p className="text-xs text-[var(--rf-sap)] flex items-center gap-1">
                            <span className="material-symbols-outlined text-sm">check_circle</span>
                            Location set. You can drag the pin or click on the map to adjust
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* Step 4: Schedule */}
              {step === 4 && (
                <>
                  <div className="flex flex-col gap-2 mb-4">
                    <label className="text-[var(--rf-bone)] text-base font-medium leading-normal">Schedule Type *</label>
                    <div className="flex gap-4">
                      <button
                        type="button"
                        onClick={() => setScheduleType('one-time')}
                        className={`flex-1 px-4 py-3 rounded-lg border-2 font-semibold transition-colors ${
                          scheduleType === 'one-time'
                            ? 'bg-[var(--rf-sap)] text-[var(--rf-ink)] border-[var(--rf-sap)]'
                            : 'bg-[var(--rf-moss)] text-[var(--rf-bone)] border-[rgba(241,234,216,0.18)] hover:border-[var(--rf-sap)]'
                        }`}
                      >
                        One-Time
                      </button>
                      <button
                        type="button"
                        onClick={() => setScheduleType('recurring')}
                        className={`flex-1 px-4 py-3 rounded-lg border-2 font-semibold transition-colors ${
                          scheduleType === 'recurring'
                            ? 'bg-[var(--rf-sap)] text-[var(--rf-ink)] border-[var(--rf-sap)]'
                            : 'bg-[var(--rf-moss)] text-[var(--rf-bone)] border-[rgba(241,234,216,0.18)] hover:border-[var(--rf-sap)]'
                        }`}
                      >
                        Recurring
                      </button>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {scheduleType === 'one-time' ? (
                      <>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="flex flex-col gap-2">
                            <label className="text-[var(--rf-bone)] text-base font-medium leading-normal">Start Date & Time *</label>
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
                              className="w-full rounded-lg bg-[var(--rf-forest)] border border-[rgba(241,234,216,0.18)] text-[var(--rf-bone)] h-14 px-4 focus:outline-none focus:ring-2 focus:ring-[var(--rf-sap)] focus:border-transparent transition-all"
                            />
                            <p className="text-xs text-[var(--rf-bone)]/60 pl-1">Must be today or in the future</p>
                          </div>
                          <div className="flex flex-col gap-2">
                            <label className="text-[var(--rf-bone)] text-base font-medium leading-normal">End Date & Time *</label>
                            <input
                              type="datetime-local"
                              value={newWindowEnd}
                              min={newWindowStart || getMinDateTime()}
                              onChange={(e) => setNewWindowEnd(e.target.value)}
                              className="w-full rounded-lg bg-[var(--rf-forest)] border border-[rgba(241,234,216,0.18)] text-[var(--rf-bone)] h-14 px-4 focus:outline-none focus:ring-2 focus:ring-[var(--rf-sap)] focus:border-transparent transition-all disabled:opacity-50"
                              disabled={!newWindowStart}
                            />
                            <p className="text-xs text-[var(--rf-bone)]/60 pl-1">
                              {newWindowStart ? 'Must be after start time' : 'Select start time first'}
                            </p>
                          </div>
                        </div>
                        {newWindowStart && newWindowEnd && new Date(newWindowStart) >= new Date(newWindowEnd) && (
                          <p className="text-sm text-red-400">⚠️ End time must be after start time</p>
                        )}
                        {newWindowStart && new Date(newWindowStart) < new Date() && (
                          <p className="text-sm text-red-400">⚠️ Start time cannot be in the past</p>
                        )}
                      </>
                    ) : (
                      <>
                        <div className="flex flex-col gap-2">
                          <label className="text-[var(--rf-bone)] text-base font-medium leading-normal">Days of Week *</label>
                          <div className="grid grid-cols-7 gap-2">
                            {dayAbbr.map((day, index) => (
                              <button
                                key={index}
                                type="button"
                                onClick={() => toggleRecurringDay(index)}
                                className={`px-3 py-2 rounded-lg border-2 font-semibold text-sm transition-colors ${
                                  recurringDays.includes(index)
                                    ? 'bg-[var(--rf-sap)] text-[var(--rf-ink)] border-[var(--rf-sap)]'
                                    : 'bg-[var(--rf-moss)] text-[var(--rf-bone)] border-[rgba(241,234,216,0.18)] hover:border-[var(--rf-sap)]'
                                }`}
                              >
                                {day}
                              </button>
                            ))}
                          </div>
                          <p className="text-xs text-[var(--rf-bone)]/60 pl-1">Select one or more days</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="flex flex-col gap-2">
                            <label className="text-[var(--rf-bone)] text-base font-medium leading-normal">Start Time *</label>
                            <input
                              type="time"
                              value={recurringStartTime}
                              onChange={(e) => {
                                setRecurringStartTime(e.target.value);
                                if (e.target.value && recurringEndTime && e.target.value >= recurringEndTime) {
                                  setRecurringEndTime('');
                                }
                              }}
                              className="w-full rounded-lg bg-[var(--rf-forest)] border border-[rgba(241,234,216,0.18)] text-[var(--rf-bone)] h-14 px-4 focus:outline-none focus:ring-2 focus:ring-[var(--rf-sap)] focus:border-transparent transition-all"
                            />
                          </div>
                          <div className="flex flex-col gap-2">
                            <label className="text-[var(--rf-bone)] text-base font-medium leading-normal">End Time *</label>
                            <input
                              type="time"
                              value={recurringEndTime}
                              min={recurringStartTime}
                              onChange={(e) => setRecurringEndTime(e.target.value)}
                              className="w-full rounded-lg bg-[var(--rf-forest)] border border-[rgba(241,234,216,0.18)] text-[var(--rf-bone)] h-14 px-4 focus:outline-none focus:ring-2 focus:ring-[var(--rf-sap)] focus:border-transparent transition-all disabled:opacity-50"
                              disabled={!recurringStartTime}
                            />
                          </div>
                        </div>
                        {recurringStartTime && recurringEndTime && recurringEndTime <= recurringStartTime && (
                          <p className="text-sm text-red-400">⚠️ End time must be after start time</p>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="flex flex-col gap-2">
                            <label className="text-[var(--rf-bone)] text-base font-medium leading-normal">Start Date *</label>
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
                              className="w-full rounded-lg bg-[var(--rf-forest)] border border-[rgba(241,234,216,0.18)] text-[var(--rf-bone)] h-14 px-4 focus:outline-none focus:ring-2 focus:ring-[var(--rf-sap)] focus:border-transparent transition-all"
                            />
                            <p className="text-xs text-[var(--rf-bone)]/60 pl-1">When recurring schedule begins</p>
                          </div>
                          <div className="flex flex-col gap-2">
                            <label className="text-[var(--rf-bone)] text-base font-medium leading-normal">End Date (Optional)</label>
                            <input
                              type="date"
                              value={recurringEndDate}
                              min={recurringStartDate || getMinDate()}
                              onChange={(e) => setRecurringEndDate(e.target.value)}
                              className="w-full rounded-lg bg-[var(--rf-forest)] border border-[rgba(241,234,216,0.18)] text-[var(--rf-bone)] h-14 px-4 focus:outline-none focus:ring-2 focus:ring-[var(--rf-sap)] focus:border-transparent transition-all disabled:opacity-50"
                              disabled={!recurringStartDate}
                            />
                            <p className="text-xs text-[var(--rf-bone)]/60 pl-1">Leave empty for ongoing schedule (max 12 weeks)</p>
                          </div>
                        </div>
                      </>
                    )}

                    <button
                      onClick={addPickupWindow}
                      className="w-full px-4 py-2.5 bg-[var(--rf-sap)] hover:bg-[var(--rf-sap-bright)] text-[var(--rf-ink)] rounded-lg font-bold transition-all shadow-[0_0_15px_rgba(200,255,77,0.3)]"
                    >
                      {scheduleType === 'one-time' ? 'Add Window' : 'Generate Recurring Windows'}
                    </button>

                    {pickupWindows.length > 0 && (
                      <div className="mt-4">
                        <div className="flex justify-between items-center mb-2">
                          <h3 className="text-sm font-semibold text-[var(--rf-bone)]">
                            Added Windows ({pickupWindows.length})
                          </h3>
                          <button
                            onClick={() => setPickupWindows([])}
                            className="text-sm text-red-400 hover:text-red-300"
                          >
                            Clear All
                          </button>
                        </div>
                        <div className="max-h-60 overflow-y-auto space-y-2">
                          {pickupWindows.map((window, index) => (
                            <div key={index} className="flex justify-between items-center p-3 bg-[var(--rf-forest)] rounded-lg">
                              <span className="text-sm text-[var(--rf-bone)]">
                                {new Date(window.start).toLocaleString()} - {new Date(window.end).toLocaleString()}
                              </span>
                              <button
                                onClick={() => removePickupWindow(index)}
                                className="text-red-400 hover:text-red-300 text-sm font-semibold"
                              >
                                Remove
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-4 pt-4 mt-auto">
                {step > 1 && (
                  <button
                    onClick={() => setStep(step - 1)}
                    className="flex-1 sm:flex-none px-6 h-12 rounded-lg border border-[rgba(241,234,216,0.18)] text-[var(--rf-bone)] font-medium hover:bg-[var(--rf-forest)] transition-colors"
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
                      if (step === 2 && !imageFile) {
                        toast.error('Please upload a photo');
                        return;
                      }
                      if (step === 3) {
                        if (!title || !price || !address || !latitude || !longitude) {
                          toast.error('Please fill all required fields including address with GPS coordinates');
                          return;
                        }
                      }
                      setStep(step + 1);
                    }}
                    disabled={
                      (step === 1 && !category) ||
                      (step === 2 && !imageFile) ||
                      (step === 3 && (!title || !price || !address || !latitude || !longitude))
                    }
                    className="flex-1 h-12 rounded-lg bg-[var(--rf-sap)] text-[var(--rf-ink)] font-bold hover:bg-[var(--rf-sap-bright)] transition-colors flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(200,255,77,0.3)] disabled:opacity-50"
                  >
                    {step === 1 ? 'Next: Photo' : step === 2 ? 'Next: Details' : 'Next: Schedule'}
                    <span className="material-symbols-outlined text-lg">arrow_forward</span>
                  </button>
                ) : (
                  <button
                    onClick={handleSubmit}
                    disabled={submitting || pickupWindows.length === 0}
                    className="flex-1 h-12 rounded-lg bg-[var(--rf-sap)] text-[var(--rf-ink)] font-bold hover:bg-[var(--rf-sap-bright)] transition-colors flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(200,255,77,0.3)] disabled:opacity-50"
                  >
                    {submitting ? 'Publishing...' : 'Publish Listing'}
                    <span className="material-symbols-outlined text-lg">check</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Safety Context */}
          <div className="lg:col-span-4 flex flex-col gap-6">
            {/* Safety Standards Card */}
            <div className="bg-[rgba(241,234,216,0.025)] border border-[rgba(241,234,216,0.14)] rounded-2xl p-6 sticky top-24">
              <div className="flex items-center gap-3 mb-6">
                <div className="bg-[var(--rf-sap)] text-[var(--rf-ink)] p-1.5 rounded-lg flex items-center justify-center">
                  <span className="material-symbols-outlined">shield</span>
                </div>
                <h3 className="text-[var(--rf-bone)] text-lg font-bold">Safety Standards</h3>
              </div>
              <p className="text-[var(--rf-bone)]/60 text-sm mb-6 leading-relaxed">
                To ensure high-quality compost for our partner farmers, please verify your waste meets these strict criteria before submitting.
              </p>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 mt-0.5 text-[var(--rf-sap)]">
                    <span className="material-symbols-outlined">check_circle</span>
                  </div>
                  <div>
                    <p className="text-[var(--rf-bone)] font-medium text-sm">No Inorganic Material</p>
                    <p className="text-[var(--rf-bone)] text-xs">Zero tolerance for plastic, glass, metal, or rubber bands.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 mt-0.5 text-[var(--rf-sap)]">
                    <span className="material-symbols-outlined">check_circle</span>
                  </div>
                  <div>
                    <p className="text-[var(--rf-bone)] font-medium text-sm">Low Fat/Oil Content</p>
                    <p className="text-[var(--rf-bone)] text-xs">Avoid large quantities of grease or fryer oil.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 mt-0.5 text-[var(--rf-sap)]">
                    <span className="material-symbols-outlined">check_circle</span>
                  </div>
                  <div>
                    <p className="text-[var(--rf-bone)] font-medium text-sm">No Hazardous Waste</p>
                    <p className="text-[var(--rf-bone)] text-xs">No cleaning chemicals, batteries, or medical waste.</p>
                  </div>
                </div>
              </div>
              <div className="mt-8 p-4 bg-[var(--rf-forest)] rounded-lg border border-[var(--rf-sap)]/15">
                <div className="flex items-center gap-2 mb-2">
                  <span className="material-symbols-outlined text-[var(--rf-sap)] text-sm">lightbulb</span>
                  <span className="text-xs font-bold uppercase tracking-wider text-[var(--rf-sap)]">Pro Tip</span>
                </div>
                <p className="text-[var(--rf-bone)] text-xs">
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

