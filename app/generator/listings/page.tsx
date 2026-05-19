'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { getFirestoreDb, onAuthStateChange } from '@/lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { User } from 'firebase/auth';
import { MarketplaceListing, UserProfile } from '@/lib/types';
import { getUserProfile } from '@/lib/userProfile';
import { getListingsCollectionPath } from '@/lib/constants';
import RoleGuard from '@/components/RoleGuard';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { GeneratorLayout } from '@/components/GeneratorLayout';

export default function GeneratorListingsPage() {
  return (
    <RoleGuard allowedRoles={['generator']}>
      <GeneratorListingsContent />
    </RoleGuard>
  );
}

function GeneratorListingsContent() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [listings, setListings] = useState<MarketplaceListing[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'live' | 'reserved' | 'completed'>('all');
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setProfileDropdownOpen(false);
    };
    if (profileDropdownOpen) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [profileDropdownOpen]);

  useEffect(() => {
    const unsubAuth = onAuthStateChange(async (cu) => {
      if (cu) {
        setUser(cu);
        const profile = await getUserProfile(cu.uid);
        setUserProfile(profile);
        setLoading(false);
      } else {
        router.push('/login');
      }
    });
    return () => unsubAuth();
  }, [router]);

  // Listings snapshot — keyed by user.uid; unsubscribes on unmount or uid change.
  useEffect(() => {
    if (!user) return;
    const db = getFirestoreDb();
    const q = query(collection(db, getListingsCollectionPath()), where('generatorUid', '==', user.uid));
    const unsub = onSnapshot(
      q,
      (snap) => setListings(snap.docs.map((d) => ({ id: d.id, ...d.data() })) as MarketplaceListing[]),
      (err) => {
        console.error(err);
        toast.error('Failed to load listings');
      },
    );
    return () => unsub();
  }, [user]);

  const formatDate = (ts: any) => {
    if (!ts) return 'N/A';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
  };

  const getCategoryIcon = (category: string) => {
    const c = category.toLowerCase();
    if (c.includes('fruit') || c.includes('rind')) return 'nutrition';
    if (c.includes('leafy') || c.includes('greens')) return 'local_florist';
    if (c.includes('bakery') || c.includes('grain')) return 'bakery_dining';
    if (c.includes('dairy')) return 'lunch_dining';
    if (c.includes('meat')) return 'set_meal';
    if (c.includes('vegetable') || c.includes('vegetative')) return 'eco';
    if (c.includes('coffee')) return 'coffee';
    if (c.includes('egg')) return 'egg';
    return 'recycling';
  };

  const filtered = listings.filter((l) => {
    if (statusFilter !== 'all' && l.status !== statusFilter) return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return l.title.toLowerCase().includes(q) || l.category.toLowerCase().includes(q) || l.address.toLowerCase().includes(q);
  });

  const sorted = [...filtered].sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));

  const counts = {
    all: listings.length,
    live: listings.filter((l) => l.status === 'live').length,
    reserved: listings.filter((l) => l.status === 'reserved').length,
    completed: listings.filter((l) => l.status === 'completed').length,
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--rf-forest)' }}>
        <p className="font-instrument italic text-2xl" style={{ color: 'var(--rf-bone)' }}>
          gathering the ledger<span className="animate-pulse">…</span>
        </p>
      </div>
    );
  }

  return (
    <GeneratorLayout user={user} userProfile={userProfile} active="inventory" router={router}>
      <main className="relative flex-1 w-full px-4 sm:px-6 lg:px-10 py-10">

        {/* Editorial header */}
        <div className="flex items-center justify-between mb-4 rf-fade-up">
          <div className="rf-eyebrow flex items-center gap-3">
            <span className="size-2 rounded-full" style={{ background: 'var(--rf-sap)' }} />
            Chapter 02 · The Ledger
          </div>
          <span className="font-mono-jb text-[10px] uppercase tracking-[0.3em] opacity-60 hidden md:block">
            {listings.length} {listings.length === 1 ? 'entry' : 'entries'} on the books
          </span>
        </div>

        <div className="grid grid-cols-12 gap-x-6 gap-y-6 items-end mb-10 rf-fade-up" style={{ animationDelay: '.08s' }}>
          <h1 className="col-span-12 md:col-span-8 rf-headline text-[clamp(2.5rem,7vw,5.5rem)]">
            Today&apos;s
            <br />
            <span className="italic">surplus,</span> recorded.
          </h1>
          <div className="col-span-12 md:col-span-4 md:text-right">
            <Link href="/generator/listings/new"
                  className="group inline-flex items-center gap-3 pl-6 pr-2 h-14 rounded-full font-mono-jb text-[12px] uppercase tracking-[0.25em] transition-all hover:-translate-y-0.5 rf-glow-sap"
                  style={{ background: 'var(--rf-sap)', color: 'var(--rf-forest)' }}>
              <span>List new surplus</span>
              <span className="flex items-center justify-center size-11 rounded-full transition-transform group-hover:rotate-45"
                    style={{ background: 'var(--rf-forest)', color: 'var(--rf-sap)' }}>
                <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M12 5v14M5 12h14" strokeLinecap="round" />
                </svg>
              </span>
            </Link>
          </div>
        </div>

        {/* Status tally strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-px mb-8 border rounded-2xl overflow-hidden rf-fade-up"
             style={{ borderColor: 'rgba(241,234,216,.14)', background: 'rgba(241,234,216,.05)', animationDelay: '.12s' }}>
          <StatusTally num={counts.all} label="all entries" active={statusFilter === 'all'}
            onClick={() => setStatusFilter('all')} key1="◍" />
          <StatusTally num={counts.live} label="live" active={statusFilter === 'live'}
            onClick={() => setStatusFilter('live')} key1="✺" accent />
          <StatusTally num={counts.reserved} label="claimed" active={statusFilter === 'reserved'}
            onClick={() => setStatusFilter('reserved')} key1="↻" />
          <StatusTally num={counts.completed} label="collected" active={statusFilter === 'completed'}
            onClick={() => setStatusFilter('completed')} key1="✓" />
        </div>

        {/* Search */}
        <div className="mb-6 max-w-md rf-fade-up" style={{ animationDelay: '.18s' }}>
          <label className="rf-eyebrow mb-2 block">Search the ledger</label>
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 opacity-60"
                  style={{ color: 'var(--rf-sap)' }}>search</span>
            <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                   placeholder="title, category, address…"
                   className="rf-input w-full h-11 pl-10 pr-4 font-fraunces" />
          </div>
        </div>

        {/* Table or empty state */}
        {sorted.length > 0 ? (
          <div className="rounded-2xl overflow-hidden border rf-fade-up"
               style={{ borderColor: 'rgba(241,234,216,.14)', background: 'rgba(241,234,216,.025)', animationDelay: '.22s' }}>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(241,234,216,.10)' }}>
                    <th className="p-4 font-mono-jb text-[10px] uppercase tracking-[0.25em] opacity-60">№</th>
                    <th className="p-4 font-mono-jb text-[10px] uppercase tracking-[0.25em] opacity-60">Item</th>
                    <th className="p-4 font-mono-jb text-[10px] uppercase tracking-[0.25em] opacity-60">Weight</th>
                    <th className="p-4 font-mono-jb text-[10px] uppercase tracking-[0.25em] opacity-60">Price</th>
                    <th className="p-4 font-mono-jb text-[10px] uppercase tracking-[0.25em] opacity-60">Status</th>
                    <th className="p-4 font-mono-jb text-[10px] uppercase tracking-[0.25em] opacity-60 text-right">Listed</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((l, idx) => (
                    <tr key={l.id} className="group transition-colors hover:bg-white/[0.02]"
                        style={{ borderBottom: idx === sorted.length - 1 ? 'none' : '1px solid rgba(241,234,216,.06)' }}>
                      <td className="p-4 font-fraunces fraunces-wonk italic text-2xl font-light leading-none"
                          style={{ color: 'var(--rf-sap)' }}>
                        {String(idx + 1).padStart(2, '0')}
                      </td>
                      <td className="p-4">
                        <Link href={`/generator/listings/${l.id}`} className="flex items-center gap-3 group/link">
                          <div className="size-10 rounded-lg flex items-center justify-center shrink-0"
                               style={{ background: 'rgba(200,255,77,.08)' }}>
                            <span className="material-symbols-outlined text-[20px]" style={{ color: 'var(--rf-sap)' }}>
                              {getCategoryIcon(l.category)}
                            </span>
                          </div>
                          <div>
                            <p className="font-fraunces text-base font-medium leading-tight group-hover/link:text-[color:var(--rf-sap)] transition-colors">
                              {l.title}
                            </p>
                            <p className="font-mono-jb text-[9px] uppercase tracking-[0.2em] opacity-50 mt-0.5">
                              {l.category}
                            </p>
                          </div>
                        </Link>
                      </td>
                      <td className="p-4 font-fraunces text-base opacity-80">
                        {l.weightKg ? `${l.weightKg} kg` : '—'}
                      </td>
                      <td className="p-4">
                        <p className="font-fraunces fraunces-wonk text-xl font-light leading-none" style={{ color: 'var(--rf-bone)' }}>
                          <span className="font-mono-jb text-[10px] opacity-60 mr-1">{l.currency}</span>
                          {l.price.toFixed(2)}
                        </p>
                      </td>
                      <td className="p-4"><StatusBadge status={l.status} /></td>
                      <td className="p-4 text-right font-mono-jb text-[10px] uppercase tracking-[0.2em] opacity-70">
                        {formatDate(l.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="text-center py-20 rounded-2xl border rf-fade-up"
               style={{ borderColor: 'rgba(241,234,216,.14)', background: 'rgba(241,234,216,.02)', animationDelay: '.22s' }}>
            <div className="font-fraunces fraunces-wonk italic text-7xl font-light leading-none mb-4"
                 style={{ color: 'var(--rf-sap)' }}>ø</div>
            <h3 className="font-fraunces text-2xl font-medium mb-2">
              {searchQuery || statusFilter !== 'all' ? 'Nothing matches.' : 'The ledger is empty.'}
            </h3>
            <p className="font-instrument italic text-lg max-w-md mx-auto mb-8" style={{ color: 'rgba(241,234,216,.6)' }}>
              {searchQuery || statusFilter !== 'all'
                ? 'Try a different filter or keyword.'
                : 'Post your first surplus and the farmers will find it.'}
            </p>
            {!searchQuery && statusFilter === 'all' && (
              <Link href="/generator/listings/new"
                    className="inline-flex items-center gap-3 pl-6 pr-1.5 h-12 rounded-full font-mono-jb text-[11px] uppercase tracking-[0.25em]"
                    style={{ background: 'var(--rf-sap)', color: 'var(--rf-forest)' }}>
                <span>List surplus</span>
                <span className="size-9 rounded-full flex items-center justify-center"
                      style={{ background: 'var(--rf-forest)', color: 'var(--rf-sap)' }}>+</span>
              </Link>
            )}
          </div>
        )}
      </main>
    </GeneratorLayout>
  );
}

function StatusTally({
  num, label, active, onClick, key1, accent,
}: { num: number; label: string; active: boolean; onClick: () => void; key1: string; accent?: boolean }) {
  return (
    <button onClick={onClick}
            className="p-6 flex flex-col justify-between min-h-[110px] text-left transition-colors"
            style={{ background: active ? 'rgba(200,255,77,.06)' : 'var(--rf-forest)' }}>
      <div className="flex items-start justify-between">
        <span className="font-fraunces fraunces-wonk text-5xl font-light leading-none tracking-[-0.04em]"
              style={{ color: active || accent ? 'var(--rf-sap)' : 'var(--rf-bone)' }}>
          {num}
        </span>
        <span className="font-mono-jb text-lg opacity-50" style={{ color: 'var(--rf-sap)' }}>{key1}</span>
      </div>
      <span className="mt-2 font-mono-jb text-[10px] uppercase tracking-[0.25em] opacity-70">
        {label}
      </span>
    </button>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { color: string; label: string; bg: string }> = {
    live:      { color: 'var(--rf-sap)', label: 'Live',      bg: 'rgba(200,255,77,.10)' },
    reserved:  { color: 'var(--rf-amber)',       label: 'Claimed',   bg: 'rgba(233,196,106,.10)' },
    completed: { color: 'var(--rf-sky)',       label: 'Collected', bg: 'rgba(108,180,241,.10)' },
  };
  const s = map[status] || { color: 'var(--rf-bone)', label: status, bg: 'rgba(241,234,216,.06)' };
  return (
    <span className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full font-mono-jb text-[10px] uppercase tracking-[0.22em]"
          style={{ background: s.bg, color: s.color, border: `1px solid ${s.color}33` }}>
      <span className="size-1.5 rounded-full" style={{ background: s.color }} />
      {s.label}
    </span>
  );
}
