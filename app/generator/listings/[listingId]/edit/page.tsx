'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { getFirestoreDb, getFirebaseStorage, onAuthStateChange } from '@/lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { User } from 'firebase/auth';
import { MarketplaceListing, MarketplacePickupWindow, MarketplaceScheduleType } from '@/lib/types';
import { getListingsCollectionPath } from '@/lib/constants';
import RoleGuard from '@/components/RoleGuard';
import Link from 'next/link';
import Image from 'next/image';
import toast from 'react-hot-toast';
import { useLoadScript } from '@react-google-maps/api';

const WASTE_CATEGORIES = [
  'Vegetative',
  'Bakery',
  'Dairy',
  'Meat',
  'Fruit Scraps & Rinds',
  'Leafy Greens',
  'Others'
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
  
  const [scheduleType, setScheduleType] = useState<MarketplaceScheduleType>('one-time');
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
      setScheduleType(listingData.scheduleType || ((listingData.pickupWindows?.length || 0) > 1 ? 'recurring' : 'one-time'));

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

      setPickupWindows([{ start: newWindowStart, end: newWindowEnd }]);
      toast.success('Pickup window set');
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

  const switchScheduleType = (nextType: MarketplaceScheduleType) => {
    if (nextType === scheduleType) return;

    setScheduleType(nextType);
    setPickupWindows([]);
    setNewWindowStart('');
    setNewWindowEnd('');
    setRecurringDays([]);
    setRecurringStartTime('');
    setRecurringEndTime('');
    setRecurringStartDate('');
    setRecurringEndDate('');
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

  const formatPickupWindow = (window: MarketplacePickupWindow) =>
    `${new Date(window.start).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })} - ${new Date(window.end).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;

  const buildRecurringPickupWindows = () => {
    if (recurringDays.length === 0 || !recurringStartTime || !recurringEndTime || !recurringStartDate) {
      return [] as MarketplacePickupWindow[];
    }

    if (recurringEndTime <= recurringStartTime) {
      return [] as MarketplacePickupWindow[];
    }

    const startDate = new Date(recurringStartDate);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    if (startDate < now) {
      return [] as MarketplacePickupWindow[];
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

    return generatedWindows;
  };

  const formatPickupWindow = (window: MarketplacePickupWindow) =>
    `${new Date(window.start).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })} - ${new Date(window.end).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;

  const removePickupWindow = (index: number) => {
    setPickupWindows(pickupWindows.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    const windowsToSave =
      scheduleType === 'one-time'
        ? (pickupWindows[0] ? [pickupWindows[0]] : newWindowStart && newWindowEnd && new Date(newWindowStart) < new Date(newWindowEnd) && new Date(newWindowStart) >= new Date() ? [{ start: newWindowStart, end: newWindowEnd }] : [])
        : pickupWindows.length > 0
          ? pickupWindows
          : buildRecurringPickupWindows();
    const hasValidPickupWindows = scheduleType === 'one-time' ? windowsToSave.length === 1 : windowsToSave.length > 0;

    if (!category || !title || !price || !address || !latitude || !longitude || !hasValidPickupWindows) {
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
        pickupWindows: windowsToSave,
        scheduleType,
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
      <div className="min-h-screen bg-[var(--rf-forest)] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--rf-sap)] mx-auto mb-4"></div>
          <p className="text-[var(--rf-bone)]">Loading...</p>
        </div>
      </div>
    );
  }

  // Continue with the rest of the component - copying the structure from new listing page
  // but with edit-specific changes...
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
          <div className="lg:col-span-8 flex flex-col gap-6">
            <div className="flex flex-col gap-4">
              <Link href={`/generator/listings/${listingId}`}
                    className="inline-flex items-center gap-2 font-mono-jb text-[11px] uppercase tracking-[0.25em] opacity-70 hover:opacity-100 hover:text-[color:var(--rf-sap)] w-fit">
                <span aria-hidden>←</span> Back to entry
              </Link>
              <div className="rf-eyebrow flex items-center gap-3">
                <span className="size-2 rounded-full" style={{ background: 'var(--rf-sap)' }} />
                Amending the entry
              </div>
              <h1 className="rf-headline text-[clamp(2.5rem,6vw,4.5rem)]">
                Revise the <span className="italic">listing.</span>
              </h1>
              <p className="font-instrument italic text-xl max-w-xl" style={{ color: 'rgba(241,234,216,.7)' }}>
                Changes are written into the ledger immediately.
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
              {/* Step 1: Category - Same as new listing */}
              {step === 1 && (
                <div className="flex flex-col gap-6">
                  <div>
                    <label className="text-[var(--rf-bone)] text-base font-medium leading-normal mb-2 block">
                      Waste Category <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full appearance-none rounded-lg bg-[var(--rf-forest)] border border-[rgba(241,234,216,0.18)] text-[var(--rf-bone)] h-14 px-4 pr-10 focus:outline-none focus:ring-2 focus:ring-[var(--rf-sap)] focus:border-transparent transition-all"
                    >
                      <option value="">Select category</option>
                      {WASTE_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                    <p className="text-xs text-[var(--rf-bone)]/60 pl-1 mt-1">Choose the primary composition of the waste.</p>
                  </div>
                </div>
              )}

              {/* Step 2: Photo - Same as new listing but show existing image */}
              {step === 2 && (
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
                    onChange={handleImageChange}
                  />
                  {imagePreview ? (
                    <div className="relative border-2 border-dashed border-[var(--rf-sap)] rounded-xl bg-[var(--rf-forest)] p-4">
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
                        className="absolute top-6 right-6 bg-red-500/90 hover:bg-red-600 text-[var(--rf-bone)] px-4 py-2 rounded-lg font-medium transition-colors"
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
                      className="relative border-2 border-dashed border-[rgba(241,234,216,0.18)] hover:border-[var(--rf-sap)] dark:hover:border-[var(--rf-sap)] rounded-xl bg-[var(--rf-forest)] p-8 flex flex-col items-center justify-center text-center transition-colors cursor-pointer group"
                    >
                      <div className="size-16 rounded-full bg-[var(--rf-sap)]/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                        <span className="material-symbols-outlined text-[var(--rf-sap)] text-3xl">add_a_photo</span>
                      </div>
                      <h3 className="text-[var(--rf-bone)] font-medium text-lg mb-1">Click to upload or drag and drop</h3>
                      <p className="text-[var(--rf-bone)]/60 text-sm max-w-xs">SVG, PNG, JPG or GIF (max. 800x400px). Ensure contents are clearly visible.</p>
                    </div>
                  )}
                </div>
              )}

              {/* Step 3: Details - Same as new listing but pre-filled */}
              {step === 3 && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="flex flex-col gap-2">
                      <label className="text-[var(--rf-bone)] text-base font-medium leading-normal">
                        Listing Title <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="w-full rounded-lg bg-[var(--rf-forest)] border border-[rgba(241,234,216,0.18)] text-[var(--rf-bone)] h-12 px-4 focus:outline-none focus:ring-2 focus:ring-[var(--rf-sap)] focus:border-transparent transition-all placeholder:text-[var(--rf-bone)]/50 dark:placeholder:text-[var(--rf-bone-muted)]/50"
                        placeholder="e.g., Fresh Coffee Grounds"
                      />
                    </div>

                    <div className="flex flex-col gap-2">
                      <label className="text-[var(--rf-bone)] text-base font-medium leading-normal">
                        Category
                      </label>
                      <input
                        type="text"
                        value={category}
                        readOnly
                        className="w-full rounded-lg bg-[var(--rf-forest)] border border-[rgba(241,234,216,0.18)] text-[var(--rf-bone)] h-12 px-4 cursor-not-allowed"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="flex flex-col gap-2">
                      <label className="text-[var(--rf-bone)] text-base font-medium leading-normal">Weight (kg)</label>
                      <div className="relative">
                        <input
                          type="number"
                          step="0.1"
                          value={weightKg}
                          onChange={(e) => setWeightKg(e.target.value)}
                          className="w-full rounded-lg bg-[var(--rf-forest)] border border-[rgba(241,234,216,0.18)] text-[var(--rf-bone)] h-12 px-4 pr-12 focus:outline-none focus:ring-2 focus:ring-[var(--rf-sap)] focus:border-transparent transition-all placeholder:text-[var(--rf-bone)]/50 dark:placeholder:text-[var(--rf-bone-muted)]/50"
                          placeholder="0.00"
                        />
                        <div className="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none">
                          <span className="text-[var(--rf-bone)]/60 font-medium">kg</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      <label className="text-[var(--rf-bone)] text-base font-medium leading-normal">
                        Price ({currency}) <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          step="0.01"
                          value={price}
                          onChange={(e) => setPrice(e.target.value)}
                          className="w-full rounded-lg bg-[var(--rf-forest)] border border-[rgba(241,234,216,0.18)] text-[var(--rf-bone)] h-12 px-4 pr-16 focus:outline-none focus:ring-2 focus:ring-[var(--rf-sap)] focus:border-transparent transition-all placeholder:text-[var(--rf-bone)]/50 dark:placeholder:text-[var(--rf-bone-muted)]/50"
                          placeholder="0.00"
                        />
                        <div className="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none">
                          <select
                            value={currency}
                            onChange={(e) => setCurrency(e.target.value)}
                            className="bg-transparent border-none text-[var(--rf-bone)] font-medium focus:outline-none cursor-pointer"
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
                    <label className="text-[var(--rf-bone)] text-base font-medium leading-normal">Pickup Address <span className="text-red-500">*</span></label>
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
                        className="flex-1 rounded-lg bg-[var(--rf-forest)] border border-[rgba(241,234,216,0.18)] text-[var(--rf-bone)] h-12 px-4 focus:outline-none focus:ring-2 focus:ring-[var(--rf-sap)] focus:border-transparent transition-all placeholder:text-[var(--rf-bone)]/50 dark:placeholder:text-[var(--rf-bone-muted)]/50"
                        placeholder="Enter address"
                      />
                      <button
                        type="button"
                        onClick={useCurrentLocation}
                        className="px-4 py-2 bg-[var(--rf-moss)] hover:bg-[var(--rf-moss)] text-[var(--rf-bone)] rounded-lg transition-colors flex items-center gap-2"
                      >
                        <span className="material-symbols-outlined">my_location</span>
                        GPS
                      </button>
                    </div>
                    {latitude && longitude && (
                      <p className="text-xs text-[var(--rf-bone)]/60">
                        Coordinates: {latitude.toFixed(6)}, {longitude.toFixed(6)}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="text-[var(--rf-bone)] text-base font-medium leading-normal">Notes</label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={4}
                      className="w-full rounded-lg bg-[var(--rf-forest)] border border-[rgba(241,234,216,0.18)] text-[var(--rf-bone)] px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[var(--rf-sap)] focus:border-transparent transition-all placeholder:text-[var(--rf-bone)]/50 dark:placeholder:text-[var(--rf-bone-muted)]/50 resize-none"
                      placeholder="Additional information about the waste..."
                    />
                  </div>
                </>
              )}

              {/* Step 4: Schedule - Same as new listing but show existing windows */}
              {step === 4 && (
                <div className="flex flex-col gap-6">
                  <div className="flex flex-col gap-4">
                    <label className="text-[var(--rf-bone)] text-base font-medium leading-normal">
                      Schedule Type
                    </label>
                    <div className="grid grid-cols-2 gap-4">
                      <button
                        type="button"
                        onClick={() => switchScheduleType('one-time')}
                        className={`p-4 rounded-lg border-2 transition-all ${
                          scheduleType === 'one-time'
                            ? 'border-[var(--rf-sap)] bg-[var(--rf-sap)]/10'
                            : 'border-[rgba(241,234,216,0.18)] hover:border-[var(--rf-sap)]/50'
                        }`}
                      >
                        <span className="material-symbols-outlined text-2xl mb-2 block">event</span>
                        <p className="font-semibold text-[var(--rf-bone)]">One-Time</p>
                      </button>
                      <button
                        type="button"
                        onClick={() => switchScheduleType('recurring')}
                        className={`p-4 rounded-lg border-2 transition-all ${
                          scheduleType === 'recurring'
                            ? 'border-[var(--rf-sap)] bg-[var(--rf-sap)]/10'
                            : 'border-[rgba(241,234,216,0.18)] hover:border-[var(--rf-sap)]/50'
                        }`}
                      >
                        <span className="material-symbols-outlined text-2xl mb-2 block">repeat</span>
                        <p className="font-semibold text-[var(--rf-bone)]">Recurring</p>
                      </button>
                    </div>
                  </div>

                  {scheduleType === 'one-time' ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="flex flex-col gap-2">
                          <label className="text-[var(--rf-bone)] text-sm font-medium">Start Date & Time</label>
                          <input
                            type="datetime-local"
                            value={newWindowStart}
                            onChange={(e) => setNewWindowStart(e.target.value)}
                            min={getMinDateTime()}
                            className="w-full rounded-lg bg-[var(--rf-forest)] border border-[rgba(241,234,216,0.18)] text-[var(--rf-bone)] h-12 px-4 focus:outline-none focus:ring-2 focus:ring-[var(--rf-sap)] focus:border-transparent transition-all"
                          />
                        </div>
                        <div className="flex flex-col gap-2">
                          <label className="text-[var(--rf-bone)] text-sm font-medium">End Date & Time</label>
                          <input
                            type="datetime-local"
                            value={newWindowEnd}
                            onChange={(e) => setNewWindowEnd(e.target.value)}
                            min={newWindowStart || getMinDateTime()}
                            className="w-full rounded-lg bg-[var(--rf-forest)] border border-[rgba(241,234,216,0.18)] text-[var(--rf-bone)] h-12 px-4 focus:outline-none focus:ring-2 focus:ring-[var(--rf-sap)] focus:border-transparent transition-all"
                          />
                        </div>
                      </div>
                      <div className="rounded-xl border border-[rgba(241,234,216,0.12)] bg-[var(--rf-forest)] px-4 py-3 flex items-center justify-between gap-4">
                        <div className="min-w-0">
                          <p className="text-xs uppercase tracking-[0.25em] text-[var(--rf-bone)]/50">Pickup Window</p>
                          <p className="text-sm text-[var(--rf-bone)] truncate">
                            {pickupWindows[0] ? formatPickupWindow(pickupWindows[0]) : 'Set one pickup window for this listing'}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={addPickupWindow}
                          className="shrink-0 px-4 py-2 bg-[var(--rf-sap)] hover:bg-[var(--rf-sap-bright)] text-[var(--rf-ink)] rounded-lg font-bold transition-all"
                        >
                          {pickupWindows.length === 1 ? 'Replace' : 'Set'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="flex flex-col gap-2">
                          <label className="text-[var(--rf-bone)] text-sm font-medium">Start Date</label>
                          <input
                            type="date"
                            value={recurringStartDate}
                            onChange={(e) => setRecurringStartDate(e.target.value)}
                            min={getMinDate()}
                            className="w-full rounded-lg bg-[var(--rf-forest)] border border-[rgba(241,234,216,0.18)] text-[var(--rf-bone)] h-12 px-4 focus:outline-none focus:ring-2 focus:ring-[var(--rf-sap)] focus:border-transparent transition-all"
                          />
                        </div>
                        <div className="flex flex-col gap-2">
                          <label className="text-[var(--rf-bone)] text-sm font-medium">End Date (Optional)</label>
                          <input
                            type="date"
                            value={recurringEndDate}
                            onChange={(e) => setRecurringEndDate(e.target.value)}
                            min={recurringStartDate || getMinDate()}
                            className="w-full rounded-lg bg-[var(--rf-forest)] border border-[rgba(241,234,216,0.18)] text-[var(--rf-bone)] h-12 px-4 focus:outline-none focus:ring-2 focus:ring-[var(--rf-sap)] focus:border-transparent transition-all"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="flex flex-col gap-2">
                          <label className="text-[var(--rf-bone)] text-sm font-medium">Start Time</label>
                          <input
                            type="time"
                            value={recurringStartTime}
                            onChange={(e) => setRecurringStartTime(e.target.value)}
                            className="w-full rounded-lg bg-[var(--rf-forest)] border border-[rgba(241,234,216,0.18)] text-[var(--rf-bone)] h-12 px-4 focus:outline-none focus:ring-2 focus:ring-[var(--rf-sap)] focus:border-transparent transition-all"
                          />
                        </div>
                        <div className="flex flex-col gap-2">
                          <label className="text-[var(--rf-bone)] text-sm font-medium">End Time</label>
                          <input
                            type="time"
                            value={recurringEndTime}
                            onChange={(e) => setRecurringEndTime(e.target.value)}
                            className="w-full rounded-lg bg-[var(--rf-forest)] border border-[rgba(241,234,216,0.18)] text-[var(--rf-bone)] h-12 px-4 focus:outline-none focus:ring-2 focus:ring-[var(--rf-sap)] focus:border-transparent transition-all"
                          />
                        </div>
                      </div>
                      <div className="flex flex-col gap-2">
                        <label className="text-[var(--rf-bone)] text-sm font-medium">Days of Week</label>
                        <div className="grid grid-cols-7 gap-2">
                          {dayNames.map((_, index) => (
                            <button
                              key={index}
                              type="button"
                              onClick={() => toggleRecurringDay(index)}
                              className={`p-2 rounded-lg border-2 transition-all text-sm font-medium ${
                                recurringDays.includes(index)
                                  ? 'border-[var(--rf-sap)] bg-[var(--rf-sap)]/10 text-[var(--rf-sap)]'
                                  : 'border-[rgba(241,234,216,0.18)] text-[var(--rf-bone)] hover:border-[var(--rf-sap)]/50'
                              }`}
                            >
                              {dayAbbr[index]}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {scheduleType === 'recurring' && (
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={addPickupWindow}
                        className="w-full py-3 bg-[var(--rf-moss)] hover:bg-[var(--rf-moss)] text-[var(--rf-bone)] rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                      >
                        <span className="material-symbols-outlined">add</span>
                        Add Pickup Window
                      </button>

                      {pickupWindows.length > 0 && (
                        <>
                          <label className="text-[var(--rf-bone)] text-base font-medium leading-normal">Current Pickup Windows</label>
                          <div className="space-y-2 max-h-64 overflow-y-auto">
                        {pickupWindows.map((window, index) => (
                          <div key={index} className="flex items-center justify-between p-3 bg-[var(--rf-forest)] rounded-lg border border-[rgba(241,234,216,0.12)]">
                            <p className="text-[var(--rf-bone)] text-sm">
                              {formatPickupWindow(window)}
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
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Navigation Buttons */}
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
                    className="flex-1 h-12 rounded-lg bg-[var(--rf-sap)] hover:bg-[var(--rf-sap-bright)] text-[var(--rf-ink)] font-bold transition-colors flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(200,255,77,0.3)]"
                  >
                    Next
                    <span className="material-symbols-outlined text-lg">arrow_forward</span>
                  </button>
                ) : (
                  <button
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="flex-1 h-12 rounded-lg bg-[var(--rf-sap)] hover:bg-[var(--rf-sap-bright)] text-[var(--rf-ink)] font-bold transition-colors flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(200,255,77,0.3)] disabled:opacity-50 disabled:cursor-not-allowed"
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
            <div className="bg-[rgba(241,234,216,0.025)] border border-[rgba(241,234,216,0.14)] rounded-xl p-6 sticky top-24">
              <div className="flex items-center gap-3 mb-6">
                <div className="bg-[var(--rf-sap)] text-black p-1.5 rounded-lg flex items-center justify-center">
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
