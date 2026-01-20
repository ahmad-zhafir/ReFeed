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
import { useLoadScript, GoogleMap, Marker } from '@react-google-maps/api';

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

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
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

      {/* Main Content */}
      <main className="flex-1 w-full max-w-[1280px] mx-auto px-4 md:px-10 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
          {/* Left Column: Form Wizard */}
          <div className="lg:col-span-8 flex flex-col gap-6">
            {/* Header Section */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 text-[#92c99b] text-sm font-medium">
                <span className="material-symbols-outlined text-lg">arrow_back</span>
                <Link href="/generator" className="hover:underline">Back to Dashboard</Link>
              </div>
              <h1 className="text-slate-900 dark:text-white tracking-tight text-3xl md:text-[32px] font-bold leading-tight">New Waste Listing</h1>
              <p className="text-slate-500 dark:text-[#92c99b] text-base">Post your organic waste for farmers to collect. Ensure details are accurate for successful transactions.</p>
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

            {/* Form Card */}
            <div className="bg-white dark:bg-[#1c2e20] border border-gray-200 dark:border-[#234829] rounded-xl p-6 md:p-8 shadow-sm flex flex-col gap-8">
              {/* Step 1: Category */}
              {step === 1 && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="flex flex-col gap-2">
                      <label className="text-slate-900 dark:text-white text-base font-medium leading-normal">Waste Category</label>
                      <div className="relative">
                        <select
                          value={category}
                          onChange={(e) => {
                            setCategory(e.target.value);
                            if (e.target.value) {
                              setTimeout(() => setStep(2), 300);
                            }
                          }}
                          className="w-full appearance-none rounded-lg bg-gray-50 dark:bg-[#102213] border border-gray-300 dark:border-[#234829] text-slate-900 dark:text-white h-14 px-4 pr-10 focus:outline-none focus:ring-2 focus:ring-[#13ec37] focus:border-transparent transition-all"
                        >
                          <option disabled value="">Select classification</option>
                          {WASTE_CATEGORIES.map((cat) => (
                            <option key={cat} value={cat}>{cat}</option>
                          ))}
                        </select>
                        <div className="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none text-[#13ec37]">
                          <span className="material-symbols-outlined">expand_more</span>
                        </div>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-[#92c99b] pl-1">Choose the primary composition of the waste.</p>
                    </div>
                  </div>
                </>
              )}

              {/* Step 2: Photo */}
              {step === 2 && (
                <>
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
                      multiple
                      onChange={handleImageChange}
                    />
                    {imagePreviews.length > 0 || imagePreview ? (
                      <div className="flex flex-col gap-4">
                        {/* Primary Image Preview */}
                        <div className="relative border-2 border-dashed border-[#13ec37] rounded-xl bg-gray-50 dark:bg-[#102213] p-4">
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
                                  className="w-full h-24 object-cover rounded-lg border-2 border-gray-300 dark:border-[#234829]" 
                                />
                                <button
                                  type="button"
                                  onClick={() => removeImage(index + 1)}
                                  className="absolute top-1 right-1 bg-red-500/90 hover:bg-red-600 text-white rounded-full p-1 transition-colors opacity-0 group-hover:opacity-100"
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
                            className="flex items-center gap-2 px-4 py-2 bg-[#234829] hover:bg-[#32673b] text-white rounded-lg font-medium transition-colors"
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
                            className="flex items-center gap-2 px-4 py-2 bg-red-500/90 hover:bg-red-600 text-white rounded-lg font-medium transition-colors"
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
                        className="relative border-2 border-dashed border-gray-300 dark:border-[#32673b] hover:border-[#13ec37] dark:hover:border-[#13ec37] rounded-xl bg-gray-50 dark:bg-[#102213] p-8 flex flex-col items-center justify-center text-center transition-colors cursor-pointer group"
                      >
                        <div className="size-16 rounded-full bg-[#13ec37]/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                          <span className="material-symbols-outlined text-[#13ec37] text-3xl">add_a_photo</span>
                        </div>
                        <h3 className="text-slate-900 dark:text-white font-medium text-lg mb-1">Click to upload or drag and drop</h3>
                        <p className="text-slate-500 dark:text-[#92c99b] text-sm max-w-xs">SVG, PNG, JPG or GIF. You can upload multiple images (first image will be primary).</p>
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
                      <label className="text-slate-900 dark:text-white text-base font-medium leading-normal">Title *</label>
                      <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="w-full rounded-lg bg-gray-50 dark:bg-[#102213] border border-gray-300 dark:border-[#234829] text-slate-900 dark:text-white h-14 px-4 focus:outline-none focus:ring-2 focus:ring-[#13ec37] focus:border-transparent transition-all placeholder:text-slate-400 dark:placeholder:text-[#92c99b]/50"
                        placeholder="e.g., Fresh vegetable scraps"
                      />
                      <p className="text-xs text-slate-500 dark:text-[#92c99b] pl-1">A clear, descriptive title for your listing.</p>
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="text-slate-900 dark:text-white text-base font-medium leading-normal">Estimated Weight</label>
                      <div className="relative">
                        <input
                          type="number"
                          value={weightKg}
                          onChange={(e) => setWeightKg(e.target.value)}
                          className="w-full rounded-lg bg-gray-50 dark:bg-[#102213] border border-gray-300 dark:border-[#234829] text-slate-900 dark:text-white h-14 px-4 pr-12 focus:outline-none focus:ring-2 focus:ring-[#13ec37] focus:border-transparent transition-all placeholder:text-slate-400 dark:placeholder:text-[#92c99b]/50"
                          placeholder="0.00"
                        />
                        <div className="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none">
                          <span className="text-slate-500 dark:text-[#92c99b] font-medium">kg</span>
                        </div>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-[#92c99b] pl-1">Use the kitchen scale for accuracy.</p>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-slate-900 dark:text-white text-base font-medium leading-normal">Price *</label>
                    <div className="relative">
                      <input
                        type="number"
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                        className="w-full rounded-lg bg-gray-50 dark:bg-[#102213] border border-gray-300 dark:border-[#234829] text-slate-900 dark:text-white h-14 px-4 pr-16 focus:outline-none focus:ring-2 focus:ring-[#13ec37] focus:border-transparent transition-all placeholder:text-slate-400 dark:placeholder:text-[#92c99b]/50"
                        placeholder="0.00"
                        step="0.01"
                      />
                      <div className="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none">
                        <span className="text-slate-500 dark:text-[#92c99b] font-medium">{currency}</span>
                      </div>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-[#92c99b] pl-1">Price for this waste listing.</p>
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-slate-900 dark:text-white text-base font-medium leading-normal">Notes</label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="w-full rounded-lg bg-gray-50 dark:bg-[#102213] border border-gray-300 dark:border-[#234829] text-slate-900 dark:text-white px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#13ec37] focus:border-transparent transition-all placeholder:text-slate-400 dark:placeholder:text-[#92c99b]/50"
                      rows={3}
                      placeholder="Additional details about the waste..."
                    />
                  </div>
                  <hr className="border-gray-200 dark:border-[#234829]" />
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-2">
                      <label className="text-slate-900 dark:text-white text-base font-medium leading-normal">Pickup Address *</label>
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
                          className="flex-1 rounded-lg bg-gray-50 dark:bg-[#102213] border border-gray-300 dark:border-[#234829] text-slate-900 dark:text-white h-14 px-4 focus:outline-none focus:ring-2 focus:ring-[#13ec37] focus:border-transparent transition-all placeholder:text-slate-400 dark:placeholder:text-[#92c99b]/50"
                          placeholder="Enter address or select from dropdown"
                        />
                        <button
                          type="button"
                          onClick={useCurrentLocation}
                          className="px-4 py-2 bg-[#13ec37] hover:bg-[#11d632] text-[#112214] rounded-lg font-medium transition-all flex items-center gap-2"
                        >
                          <span className="material-symbols-outlined text-lg">my_location</span>
                          Use GPS
                        </button>
                      </div>
                      {latitude && longitude && (
                        <p className="text-xs text-[#13ec37] mt-1">
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
                        <label className="text-slate-900 dark:text-white text-base font-medium leading-normal">Adjust Pin Location</label>
                        <p className="text-xs text-slate-500 dark:text-[#92c99b] mb-2">
                          Click on the map or drag the pin to set the exact pickup location
                        </p>
                        <div className="w-full h-64 md:h-80 rounded-lg overflow-hidden border-2 border-gray-300 dark:border-[#234829]">
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
                          <p className="text-xs text-amber-500 dark:text-amber-400 flex items-center gap-1">
                            <span className="material-symbols-outlined text-sm">info</span>
                            Please set location using address input, GPS button, or click on the map
                          </p>
                        ) : (
                          <p className="text-xs text-[#13ec37] flex items-center gap-1">
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
                    <label className="text-slate-900 dark:text-white text-base font-medium leading-normal">Schedule Type *</label>
                    <div className="flex gap-4">
                      <button
                        type="button"
                        onClick={() => setScheduleType('one-time')}
                        className={`flex-1 px-4 py-3 rounded-lg border-2 font-semibold transition-colors ${
                          scheduleType === 'one-time'
                            ? 'bg-[#13ec37] text-[#112214] border-[#13ec37]'
                            : 'bg-white dark:bg-[#102213] text-slate-700 dark:text-white border-gray-300 dark:border-[#234829] hover:border-[#13ec37]'
                        }`}
                      >
                        One-Time
                      </button>
                      <button
                        type="button"
                        onClick={() => setScheduleType('recurring')}
                        className={`flex-1 px-4 py-3 rounded-lg border-2 font-semibold transition-colors ${
                          scheduleType === 'recurring'
                            ? 'bg-[#13ec37] text-[#112214] border-[#13ec37]'
                            : 'bg-white dark:bg-[#102213] text-slate-700 dark:text-white border-gray-300 dark:border-[#234829] hover:border-[#13ec37]'
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
                            <label className="text-slate-900 dark:text-white text-base font-medium leading-normal">Start Date & Time *</label>
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
                              className="w-full rounded-lg bg-gray-50 dark:bg-[#102213] border border-gray-300 dark:border-[#234829] text-slate-900 dark:text-white h-14 px-4 focus:outline-none focus:ring-2 focus:ring-[#13ec37] focus:border-transparent transition-all"
                            />
                            <p className="text-xs text-slate-500 dark:text-[#92c99b] pl-1">Must be today or in the future</p>
                          </div>
                          <div className="flex flex-col gap-2">
                            <label className="text-slate-900 dark:text-white text-base font-medium leading-normal">End Date & Time *</label>
                            <input
                              type="datetime-local"
                              value={newWindowEnd}
                              min={newWindowStart || getMinDateTime()}
                              onChange={(e) => setNewWindowEnd(e.target.value)}
                              className="w-full rounded-lg bg-gray-50 dark:bg-[#102213] border border-gray-300 dark:border-[#234829] text-slate-900 dark:text-white h-14 px-4 focus:outline-none focus:ring-2 focus:ring-[#13ec37] focus:border-transparent transition-all disabled:opacity-50"
                              disabled={!newWindowStart}
                            />
                            <p className="text-xs text-slate-500 dark:text-[#92c99b] pl-1">
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
                          <label className="text-slate-900 dark:text-white text-base font-medium leading-normal">Days of Week *</label>
                          <div className="grid grid-cols-7 gap-2">
                            {dayAbbr.map((day, index) => (
                              <button
                                key={index}
                                type="button"
                                onClick={() => toggleRecurringDay(index)}
                                className={`px-3 py-2 rounded-lg border-2 font-semibold text-sm transition-colors ${
                                  recurringDays.includes(index)
                                    ? 'bg-[#13ec37] text-[#112214] border-[#13ec37]'
                                    : 'bg-white dark:bg-[#102213] text-slate-700 dark:text-white border-gray-300 dark:border-[#234829] hover:border-[#13ec37]'
                                }`}
                              >
                                {day}
                              </button>
                            ))}
                          </div>
                          <p className="text-xs text-slate-500 dark:text-[#92c99b] pl-1">Select one or more days</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="flex flex-col gap-2">
                            <label className="text-slate-900 dark:text-white text-base font-medium leading-normal">Start Time *</label>
                            <input
                              type="time"
                              value={recurringStartTime}
                              onChange={(e) => {
                                setRecurringStartTime(e.target.value);
                                if (e.target.value && recurringEndTime && e.target.value >= recurringEndTime) {
                                  setRecurringEndTime('');
                                }
                              }}
                              className="w-full rounded-lg bg-gray-50 dark:bg-[#102213] border border-gray-300 dark:border-[#234829] text-slate-900 dark:text-white h-14 px-4 focus:outline-none focus:ring-2 focus:ring-[#13ec37] focus:border-transparent transition-all"
                            />
                          </div>
                          <div className="flex flex-col gap-2">
                            <label className="text-slate-900 dark:text-white text-base font-medium leading-normal">End Time *</label>
                            <input
                              type="time"
                              value={recurringEndTime}
                              min={recurringStartTime}
                              onChange={(e) => setRecurringEndTime(e.target.value)}
                              className="w-full rounded-lg bg-gray-50 dark:bg-[#102213] border border-gray-300 dark:border-[#234829] text-slate-900 dark:text-white h-14 px-4 focus:outline-none focus:ring-2 focus:ring-[#13ec37] focus:border-transparent transition-all disabled:opacity-50"
                              disabled={!recurringStartTime}
                            />
                          </div>
                        </div>
                        {recurringStartTime && recurringEndTime && recurringEndTime <= recurringStartTime && (
                          <p className="text-sm text-red-400">⚠️ End time must be after start time</p>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="flex flex-col gap-2">
                            <label className="text-slate-900 dark:text-white text-base font-medium leading-normal">Start Date *</label>
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
                              className="w-full rounded-lg bg-gray-50 dark:bg-[#102213] border border-gray-300 dark:border-[#234829] text-slate-900 dark:text-white h-14 px-4 focus:outline-none focus:ring-2 focus:ring-[#13ec37] focus:border-transparent transition-all"
                            />
                            <p className="text-xs text-slate-500 dark:text-[#92c99b] pl-1">When recurring schedule begins</p>
                          </div>
                          <div className="flex flex-col gap-2">
                            <label className="text-slate-900 dark:text-white text-base font-medium leading-normal">End Date (Optional)</label>
                            <input
                              type="date"
                              value={recurringEndDate}
                              min={recurringStartDate || getMinDate()}
                              onChange={(e) => setRecurringEndDate(e.target.value)}
                              className="w-full rounded-lg bg-gray-50 dark:bg-[#102213] border border-gray-300 dark:border-[#234829] text-slate-900 dark:text-white h-14 px-4 focus:outline-none focus:ring-2 focus:ring-[#13ec37] focus:border-transparent transition-all disabled:opacity-50"
                              disabled={!recurringStartDate}
                            />
                            <p className="text-xs text-slate-500 dark:text-[#92c99b] pl-1">Leave empty for ongoing schedule (max 12 weeks)</p>
                          </div>
                        </div>
                      </>
                    )}

                    <button
                      onClick={addPickupWindow}
                      className="w-full px-4 py-2.5 bg-[#13ec37] hover:bg-[#11d632] text-[#112214] rounded-lg font-bold transition-all shadow-[0_0_15px_rgba(19,236,55,0.3)]"
                    >
                      {scheduleType === 'one-time' ? 'Add Window' : 'Generate Recurring Windows'}
                    </button>

                    {pickupWindows.length > 0 && (
                      <div className="mt-4">
                        <div className="flex justify-between items-center mb-2">
                          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
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
                            <div key={index} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-[#234829] rounded-lg">
                              <span className="text-sm text-slate-900 dark:text-white">
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
                    className="flex-1 h-12 rounded-lg bg-[#13ec37] text-[#112214] font-bold hover:bg-[#11d632] transition-colors flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(19,236,55,0.3)] disabled:opacity-50"
                  >
                    {step === 1 ? 'Next: Photo' : step === 2 ? 'Next: Details' : 'Next: Schedule'}
                    <span className="material-symbols-outlined text-lg">arrow_forward</span>
                  </button>
                ) : (
                  <button
                    onClick={handleSubmit}
                    disabled={submitting || pickupWindows.length === 0}
                    className="flex-1 h-12 rounded-lg bg-[#13ec37] text-[#112214] font-bold hover:bg-[#11d632] transition-colors flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(19,236,55,0.3)] disabled:opacity-50"
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
            <div className="bg-[#e8f5e9] dark:bg-[#152a19] border border-[#c8e6c9] dark:border-[#1e3f24] rounded-xl p-6 sticky top-24">
              <div className="flex items-center gap-3 mb-6">
                <div className="bg-[#13ec37] text-[#112214] p-1.5 rounded-lg flex items-center justify-center">
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

