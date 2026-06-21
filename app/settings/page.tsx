'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChange, signOut } from '@/lib/firebase';
import { User } from 'firebase/auth';
import { UserProfile } from '@/lib/types';
import { getUserProfile, updateUserProfile } from '@/lib/userProfile';
import AuthGuard from '@/components/AuthGuard';
import toast from 'react-hot-toast';
import { useLoadScript, GoogleMap, Marker } from '@react-google-maps/api';
import { FarmerHeader } from '@/components/FarmerHeader';
import { GeneratorLayout } from '@/components/GeneratorLayout';

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
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [address, setAddress] = useState('');
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [errors, setErrors] = useState<{ name?: string; contact?: string; location?: string; radius?: string }>({});
  const addressInputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';
  const { isLoaded: isMapsLoaded } = useLoadScript({ googleMapsApiKey: apiKey, libraries: ['places'] });

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setProfileDropdownOpen(false);
    };
    if (profileDropdownOpen) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [profileDropdownOpen]);

  useEffect(() => {
    const unsub = onAuthStateChange(async (cu) => {
      if (cu) {
        setUser(cu);
        const profile = await getUserProfile(cu.uid);
        setUserProfile(profile);
        setName(profile?.name || '');
        setContact(profile?.contact || '');
        if (profile?.searchRadiusKm) setSearchRadius(profile.searchRadiusKm);
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
    return () => unsub();
  }, [router]);

  useEffect(() => {
    if (isMapsLoaded && addressInputRef.current && !autocompleteRef.current &&
        (userProfile?.role === 'farmer' || userProfile?.role === 'generator')) {
      autocompleteRef.current = new google.maps.places.Autocomplete(addressInputRef.current, { types: ['address'] });
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

  const validateProfile = () => {
    const nextErrors: typeof errors = {};
    const trimmedName = name.trim();
    const trimmedContact = contact.trim();

    if (!trimmedName) {
      nextErrors.name = 'Name is required.';
    }

    if (!trimmedContact) {
      nextErrors.contact = 'Contact number is required.';
    } else if (!/^[+()0-9\s-]{7,}$/.test(trimmedContact)) {
      nextErrors.contact = 'Contact number must contain valid digits and symbols only.';
    }

    if ((userProfile?.role === 'farmer' || userProfile?.role === 'generator') && (!latitude || !longitude)) {
      nextErrors.location = 'Location is required for farmer and generator profiles.';
    }

    if (userProfile?.role === 'farmer' && (searchRadius < 1 || searchRadius > 50)) {
      nextErrors.radius = 'Search radius must be between 1 and 50 km.';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSaveChanges = async () => {
    if (!user || !userProfile) return;
    if (!validateProfile()) {
      toast.error('Please correct the highlighted fields.');
      return;
    }

    setSaving(true);
    try {
      const updates: Partial<UserProfile> = {
        name: name.trim(),
        contact: contact.trim(),
      };

      if (userProfile.role === 'farmer' || userProfile.role === 'generator') {
        updates.location = {
          latitude: latitude!,
          longitude: longitude!,
          address: address || undefined,
        };
      }

      if (userProfile.role === 'farmer') {
        updates.searchRadiusKm = searchRadius;
      }

      await updateUserProfile(user.uid, updates);

      setUserProfile((prev) => prev ? {
        ...prev,
        name: updates.name ?? prev.name,
        contact: updates.contact ?? prev.contact,
        location: updates.location ?? prev.location,
        searchRadiusKm: updates.searchRadiusKm ?? prev.searchRadiusKm,
      } : prev);

      toast.success('Profile Updated Successfully');
    } catch (e) {
      console.error(e);
      toast.error('Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const useCurrentLocation = () => {
    if (!navigator.geolocation) { toast.error('Geolocation is not supported in this browser.'); return; }
    toast.loading('Getting your location...', { id: 'gps' });
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude, lng = pos.coords.longitude;
        setLatitude(lat); setLongitude(lng);
        try {
          const r = await fetch('/api/reverse-geocode', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ latitude: lat, longitude: lng }),
          });
          if (r.ok) {
            const d = await r.json();
            if (d.address) setAddress(d.address);
          }
        } catch (e) { console.error(e); }
        toast.dismiss('gps');
        toast.success('Location captured');
      },
      () => { toast.dismiss('gps'); toast.error('Location permission denied'); }
    );
  };

  const geocodeAddress = async (s: string) => {
    if (!s.trim()) return;
    try {
      const r = await fetch('/api/geocode', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: s }),
      });
      if (r.ok) {
        const d = await r.json();
        if (d.latitude && d.longitude) {
          setLatitude(d.latitude); setLongitude(d.longitude);
          if (d.formatted_address) setAddress(d.formatted_address);
          toast.success('Address geocoded');
        } else toast.error('Could not find coordinates');
      } else toast.error('Geocoding failed. Use GPS or map instead.');
    } catch (e) { console.error(e); toast.error('Geocoding failed.'); }
  };

  const handleMapClick = (e: google.maps.MapMouseEvent) => {
    if (!e.latLng) return;
    const lat = e.latLng.lat(), lng = e.latLng.lng();
    setLatitude(lat); setLongitude(lng);
    fetch('/api/reverse-geocode', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ latitude: lat, longitude: lng }),
    }).then((r) => r.json()).then((d) => { if (d.address) setAddress(d.address); })
      .catch((e) => console.error(e));
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--rf-forest)' }}>
        <p className="font-instrument italic text-2xl" style={{ color: 'var(--rf-bone)' }}>
          opening your profile<span className="animate-pulse">…</span>
        </p>
      </div>
    );
  }

  const role = userProfile?.role;

  const isGenerator = role === 'generator';

  const content = (
    <main className="relative flex-1 w-full px-4 sm:px-6 lg:px-10 py-10">
        <div className="max-w-3xl mx-auto">

          <div className="flex items-center justify-between mb-4 rf-fade-up">
            <div className="rf-eyebrow flex items-center gap-3">
              <span className="size-2 rounded-full" style={{ background: 'var(--rf-sap)' }} />
              Chapter 05 · Your bench
            </div>
            <span className="font-mono-jb text-[10px] uppercase tracking-[0.3em] opacity-60 hidden md:block">
              {role === 'generator' ? 'Kitchen' : 'Farmer'} · Settings
            </span>
          </div>

          <h1 className="rf-headline text-[clamp(2.5rem,7vw,5.5rem)] mb-10 rf-fade-up" style={{ animationDelay: '.08s' }}>
            Your <span className="italic">corner</span>
            <br />
            of the almanac.
          </h1>

          {/* Identity card */}
          <section className="rounded-2xl p-6 md:p-8 border mb-6 rf-fade-up"
                   style={{ borderColor: 'rgba(241,234,216,.14)', background: 'rgba(241,234,216,.025)', animationDelay: '.14s' }}>
            <div className="flex items-center gap-5 mb-7">
              <div className="size-16 rounded-full flex items-center justify-center"
                   style={{ background: 'var(--rf-sap)', color: 'var(--rf-forest)' }}>
                <span className="font-fraunces fraunces-wonk italic font-medium text-3xl leading-none">
                  {userProfile?.name?.charAt(0).toUpperCase() || 'U'}
                </span>
              </div>
              <div>
                <p className="rf-eyebrow mb-1">Identity</p>
                <h2 className="font-fraunces fraunces-wonk text-3xl font-light tracking-[-0.03em]">
                  {userProfile?.name}
                </h2>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <EditableField label="01 · Name" hint="Required" error={errors.name}>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="rf-input w-full h-12 px-4"
                  placeholder="Jane Harvest"
                />
              </EditableField>
              <ReadonlyField label="02 · Email" value={userProfile?.email || ''} />
              <EditableField label="03 · Contact" hint="Required" error={errors.contact}>
                <input
                  type="tel"
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                  className="rf-input w-full h-12 px-4"
                  placeholder="+60 12-345 6789"
                />
              </EditableField>
              <ReadonlyField
                label="04 · Bench"
                value={role === 'generator' ? 'Restaurant / Generator' : 'Farmer / Receiver'}
                accent
              />
            </div>
          </section>

          {/* Location */}
          {(role === 'farmer' || role === 'generator') && (
            <section className="rounded-2xl p-6 md:p-8 border mb-6 rf-fade-up"
                     style={{ borderColor: 'rgba(241,234,216,.14)', background: 'rgba(241,234,216,.025)', animationDelay: '.2s' }}>

              <div className="flex items-center gap-3 mb-4">
                <span className="material-symbols-outlined" style={{ color: 'var(--rf-sap)' }}>location_on</span>
                <div>
                  <p className="rf-eyebrow">05 · Your patch of soil</p>
                  <p className="font-instrument italic text-base mt-1" style={{ color: 'rgba(241,234,216,.65)' }}>
                    {role === 'farmer'
                      ? 'A pin so the kitchens within your orbit can find you.'
                      : 'A pin so the farmers know where to come collect.'}
                  </p>
                </div>
              </div>

              <div className="flex gap-2 mb-3">
                <input ref={addressInputRef} type="text" value={address}
                       onChange={(e) => {
                         setAddress(e.target.value);
                         setErrors((prev) => ({ ...prev, location: undefined }));
                         if (!autocompleteRef.current?.getPlace()) { setLatitude(null); setLongitude(null); }
                       }}
                       onBlur={() => { if (address && !latitude && !longitude) geocodeAddress(address); }}
                       className="rf-input flex-1 h-11 px-4"
                       placeholder="Enter address or select from dropdown…" />
                <button onClick={useCurrentLocation}
                        className="group inline-flex items-center gap-2 px-4 h-11 rounded-lg font-mono-jb text-[10px] uppercase tracking-[0.25em] transition-all hover:-translate-y-0.5"
                        style={{ background: 'var(--rf-sap)', color: 'var(--rf-forest)' }}>
                  <span className="material-symbols-outlined text-base">my_location</span>
                  GPS
                </button>
              </div>

              {latitude && longitude && (
                <p className="font-mono-jb text-[10px] uppercase tracking-[0.22em] mb-3" style={{ color: 'var(--rf-sap)' }}>
                  ✓ Coordinates · {latitude.toFixed(5)}, {longitude.toFixed(5)}
                </p>
              )}

              {errors.location && (
                <p className="mb-3 font-mono-jb text-[10px] uppercase tracking-[0.22em]" style={{ color: 'var(--rf-rust)' }}>
                  {errors.location}
                </p>
              )}

              {isMapsLoaded && (
                <div className="mb-4">
                  <p className="font-mono-jb text-[10px] uppercase tracking-[0.22em] opacity-60 mb-2">
                    Click on the map or drag the pin to adjust
                  </p>
                  <div className="w-full h-64 rounded-xl overflow-hidden border"
                       style={{ borderColor: 'rgba(241,234,216,.14)' }}>
                    <GoogleMap
                      mapContainerStyle={{ width: '100%', height: '100%' }}
                      center={
                        latitude && longitude ? { lat: latitude, lng: longitude }
                        : userProfile?.location?.latitude && userProfile?.location?.longitude
                          ? { lat: userProfile.location.latitude, lng: userProfile.location.longitude }
                          : { lat: 3.139, lng: 101.6869 }
                      }
                      zoom={latitude && longitude ? 15 : 12}
                      onClick={handleMapClick}
                      options={{ disableDefaultUI: false, zoomControl: true, streetViewControl: false, mapTypeControl: true, fullscreenControl: false }}
                    >
                      {latitude && longitude && (
                        <Marker
                          position={{ lat: latitude, lng: longitude }}
                          draggable
                          onDragEnd={handleMapClick}
                          icon={{
                            // Maps API doesn't parse CSS vars — literals must match --rf-sap / --rf-forest.
                            path: google.maps.SymbolPath.CIRCLE,
                            scale: 10, fillColor: '#c8ff4d', fillOpacity: 1,
                            strokeColor: '#0d1a10', strokeWeight: 3,
                          }}
                        />
                      )}
                    </GoogleMap>
                  </div>
                </div>
              )}

              <button onClick={handleSaveChanges} disabled={saving}
                      className="w-full inline-flex items-center justify-center h-12 rounded-full font-mono-jb text-[11px] uppercase tracking-[0.25em] transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{ background: 'var(--rf-sap)', color: 'var(--rf-forest)' }}>
                {saving ? 'Saving changes…' : 'Save location'}
              </button>
            </section>
          )}

          {/* Radius (farmer) */}
          {role === 'farmer' && (
            <section className="rounded-2xl p-6 md:p-8 border mb-6 rf-fade-up"
                     style={{ borderColor: 'rgba(241,234,216,.14)', background: 'rgba(241,234,216,.025)', animationDelay: '.26s' }}>
              <div className="flex items-baseline justify-between mb-4">
                <div>
                  <p className="rf-eyebrow">06 · The orbit</p>
                  <p className="font-instrument italic text-base mt-1" style={{ color: 'rgba(241,234,216,.65)' }}>
                    How far you&apos;re willing to forage.
                  </p>
                </div>
                <span className="font-fraunces fraunces-wonk italic text-4xl font-light leading-none"
                      style={{ color: 'var(--rf-sap)' }}>
                  {searchRadius}<span className="font-mono-jb text-sm ml-1 not-italic opacity-70">km</span>
                </span>
              </div>
              {errors.radius && (
                <p className="mb-3 font-mono-jb text-[10px] uppercase tracking-[0.22em]" style={{ color: 'var(--rf-rust)' }}>
                  {errors.radius}
                </p>
              )}

              <div className="relative h-1.5 rounded-full mb-2" style={{ background: 'rgba(241,234,216,.1)' }}>
                <div className="absolute left-0 top-0 h-full rounded-full transition-all"
                     style={{ width: `${((searchRadius - 1) / 49) * 100}%`, background: 'var(--rf-sap)' }} />
                <input type="range" min={1} max={50} step={1} value={searchRadius}
                       onChange={(e) => {
                         setSearchRadius(parseInt(e.target.value, 10));
                         setErrors((prev) => ({ ...prev, radius: undefined }));
                       }}
                       className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                <div className="absolute top-1/2 -translate-y-1/2 size-4 rounded-full border-2 pointer-events-none"
                     style={{ left: `calc(${((searchRadius - 1) / 49) * 100}% - 8px)`, background: 'var(--rf-sap)', borderColor: 'var(--rf-forest)' }} />
              </div>
              <div className="flex justify-between mb-5 font-mono-jb text-[9px] uppercase tracking-[0.2em] opacity-50">
                <span>1km</span><span>50km</span>
              </div>
            </section>
          )}

          <section className="rounded-2xl p-6 md:p-8 border mb-6 rf-fade-up"
                   style={{ borderColor: 'rgba(241,234,216,.14)', background: 'rgba(241,234,216,.025)', animationDelay: '.3s' }}>
            <div className="flex items-center justify-between gap-4 mb-4">
              <div>
                <p className="rf-eyebrow">07 · Save changes</p>
                <p className="font-instrument italic text-base mt-1" style={{ color: 'rgba(241,234,216,.65)' }}>
                  Update your details and save them to Firestore.
                </p>
              </div>
              <span className="font-mono-jb text-[10px] uppercase tracking-[0.22em] opacity-50">UC-10</span>
            </div>

            <button
              onClick={handleSaveChanges}
              disabled={saving}
              className="w-full inline-flex items-center justify-center h-12 rounded-full font-mono-jb text-[11px] uppercase tracking-[0.25em] transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: 'var(--rf-sap)', color: 'var(--rf-forest)' }}
            >
              {saving ? 'Saving changes…' : 'Save Changes'}
            </button>
          </section>

          {/* Sign out */}
          <section className="rounded-2xl p-6 md:p-8 border rf-fade-up"
                   style={{ borderColor: 'rgba(217,87,42,.22)', background: 'rgba(217,87,42,.04)', animationDelay: '.32s' }}>
            <p className="rf-eyebrow mb-3" style={{ color: 'var(--rf-rust)' }}>Danger zone</p>
            <button onClick={async () => {
                      try {
                        await signOut();
                        await new Promise((r) => setTimeout(r, 100));
                        router.push('/');
                      } catch { toast.error('Failed to sign out'); }
                    }}
                    className="inline-flex items-center gap-3 h-12 px-6 rounded-full font-mono-jb text-[11px] uppercase tracking-[0.25em] border transition-all hover:bg-white/5"
                    style={{ borderColor: 'rgba(217,87,42,.4)', color: 'var(--rf-rust)' }}>
              <span className="material-symbols-outlined text-base">logout</span>
              Step away from the bench
            </button>
          </section>
        </div>
      </main>
  );

  if (isGenerator) {
    return (
      <GeneratorLayout user={user} userProfile={userProfile} active="dashboard" router={router}>
        {content}
      </GeneratorLayout>
    );
  }

  return (
    <div className="font-fraunces antialiased min-h-screen flex flex-col relative"
         style={{ background: 'var(--rf-forest)', color: 'var(--rf-bone)' }}>
      <div className="pointer-events-none fixed inset-0 rf-dotgrid opacity-40" />
      <FarmerHeader userProfile={userProfile} active="orders"
        profileDropdownOpen={profileDropdownOpen} setProfileDropdownOpen={setProfileDropdownOpen}
        dropdownRef={dropdownRef} router={router} />
      {content}
    </div>
  );
}

function ReadonlyField({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <p className="rf-eyebrow mb-2">{label}</p>
      <p className={`font-fraunces text-lg leading-tight ${accent ? 'fraunces-wonk italic font-light text-2xl' : ''}`}
         style={{ color: accent ? 'var(--rf-sap)' : 'var(--rf-bone)' }}>
        {value || <span className="opacity-50 italic font-instrument">— not set —</span>}
      </p>
    </div>
  );
}

function EditableField({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-end justify-between mb-2">
        <p className="rf-eyebrow">{label}</p>
        {hint && <span className="font-mono-jb text-[9px] uppercase tracking-[0.22em] opacity-50">{hint}</span>}
      </div>
      {children}
      {error && (
        <p className="mt-2 font-mono-jb text-[10px] uppercase tracking-[0.18em]" style={{ color: 'var(--rf-rust)' }}>
          {error}
        </p>
      )}
    </div>
  );
}
