'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { getFirestoreDb, onAuthStateChange } from '@/lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { User } from 'firebase/auth';
import { MarketplaceOrder, MarketplaceRole, UserProfile } from '@/lib/types';
import { getUserProfile } from '@/lib/userProfile';
import { getOrdersCollectionPath } from '@/lib/constants';
import AuthGuard from '@/components/AuthGuard';
import RatingModal from '@/components/RatingModal';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { RoleAwareHeader } from '@/components/GeneratorHeader';

export default function OrdersPage() {
  return (
    <AuthGuard>
      <OrdersContent />
    </AuthGuard>
  );
}

function OrdersContent() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [orders, setOrders] = useState<MarketplaceOrder[]>([]);
  const [counterpartyProfiles, setCounterpartyProfiles] = useState<Record<string, UserProfile>>({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'reserved' | 'completed' | 'cancelled'>('reserved');
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [ratingModalOpen, setRatingModalOpen] = useState(false);
  const [selectedOrderForRating, setSelectedOrderForRating] = useState<MarketplaceOrder | null>(null);
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

  // Orders snapshot — keyed by uid + role so listener replaces cleanly.
  useEffect(() => {
    if (!user || !userProfile?.role) return;
    const db = getFirestoreDb();
    const ordersRef = collection(db, getOrdersCollectionPath());
    const q = userProfile.role === 'generator'
      ? query(ordersRef, where('generatorUid', '==', user.uid))
      : query(ordersRef, where('farmerUid', '==', user.uid));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const data = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as MarketplaceOrder[];
        data.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
        setOrders(data);
      },
      (err) => {
        console.error(err);
        toast.error('Failed to load orders');
      },
    );
    return () => unsub();
  }, [user, userProfile?.role]);

  // Resolve counterparty names so the rating modal (and any future "from X" labels)
  // can show a real kitchen/farmer name rather than a raw Firestore UID.
  useEffect(() => {
    if (!userProfile?.role || orders.length === 0) return;
    const role = userProfile.role;
    const counterpartyUids = Array.from(
      new Set(
        orders
          .map((o) => (role === 'farmer' ? o.generatorUid : o.farmerUid))
          .filter((uid): uid is string => !!uid),
      ),
    );
    const missing = counterpartyUids.filter((uid) => !counterpartyProfiles[uid]);
    if (missing.length === 0) return;

    let cancelled = false;
    (async () => {
      const fetched: Record<string, UserProfile> = {};
      for (const uid of missing) {
        try {
          const p = await getUserProfile(uid);
          if (p) fetched[uid] = p;
        } catch (e) {
          console.error(`Failed to load profile for ${uid}`, e);
        }
      }
      if (!cancelled && Object.keys(fetched).length > 0) {
        setCounterpartyProfiles((prev) => ({ ...prev, ...fetched }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orders, userProfile?.role, counterpartyProfiles]);

  const markCompleted = async (_orderId: string) => {
    toast.success('Order marked as completed');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--rf-forest)' }}>
        <p className="font-instrument italic text-2xl" style={{ color: 'var(--rf-bone)' }}>
          opening the ledger<span className="animate-pulse">…</span>
        </p>
      </div>
    );
  }

  const role = userProfile?.role;
  const homePath = role === 'generator' ? '/generator' : '/farmer';

  const reservedOrders  = orders.filter((o) => o.status === 'reserved');
  const completedOrders = orders.filter((o) => o.status === 'completed');
  const cancelledOrders = orders.filter((o) => o.status === 'cancelled');
  const currentTabOrders = activeTab === 'reserved' ? reservedOrders : activeTab === 'completed' ? completedOrders : cancelledOrders;

  return (
    <div className="font-fraunces antialiased min-h-screen flex flex-col relative"
         style={{ background: 'var(--rf-forest)', color: 'var(--rf-bone)' }}>

      <div className="pointer-events-none fixed inset-0 rf-dotgrid opacity-40" />

      <RoleAwareHeader userProfile={userProfile} active="orders"
        profileDropdownOpen={profileDropdownOpen} setProfileDropdownOpen={setProfileDropdownOpen}
        dropdownRef={dropdownRef} router={router} />

      <main className="relative flex-1 w-full px-4 sm:px-6 lg:px-10 py-10">

        <div className="flex items-center justify-between mb-4 rf-fade-up">
          <div className="rf-eyebrow flex items-center gap-3">
            <span className="size-2 rounded-full" style={{ background: 'var(--rf-sap)' }} />
            {role === 'generator' ? 'Chapter 03 · The Books' : 'Chapter 04 · The Returns'}
          </div>
          <span className="font-mono-jb text-[10px] uppercase tracking-[0.3em] opacity-60 hidden md:block">
            {orders.length} {orders.length === 1 ? 'entry' : 'entries'}
          </span>
        </div>

        <h1 className="rf-headline text-[clamp(2.5rem,7vw,5.5rem)] mb-10 rf-fade-up" style={{ animationDelay: '.08s' }}>
          {role === 'generator' ? <>The <span className="italic">orders</span>.</> : <>Your <span className="italic">claims</span>.</>}
        </h1>

        {/* Tabs */}
        <div className="flex flex-wrap items-center gap-2 mb-8 rf-fade-up" style={{ animationDelay: '.16s' }}>
          <Tab label="Reserved"  count={reservedOrders.length}  active={activeTab === 'reserved'}  onClick={() => setActiveTab('reserved')} />
          <Tab label="Collected" count={completedOrders.length} active={activeTab === 'completed'} onClick={() => setActiveTab('completed')} />
          {cancelledOrders.length > 0 && (
            <Tab label="Cancelled" count={cancelledOrders.length} active={activeTab === 'cancelled'} onClick={() => setActiveTab('cancelled')} />
          )}
        </div>

        {/* Orders list */}
        {orders.length === 0 ? (
          <EmptyOrders
            title="The books are empty."
            body={role === 'generator'
              ? 'Once farmers claim your surplus, the entries appear here.'
              : 'Claim a parcel and your first entry will be written in.'}
            cta={role === 'generator' ? 'Post surplus' : 'Browse the gather'}
            href={homePath}
          />
        ) : currentTabOrders.length === 0 ? (
          <EmptyOrders
            title={`No ${activeTab === 'completed' ? 'collected' : activeTab} entries.`}
            body="Switch tabs to see other states."
          />
        ) : (
          <div className="space-y-4 rf-fade-up" style={{ animationDelay: '.22s' }}>
            {currentTabOrders.map((order, idx) => (
              <OrderRow
                key={order.id}
                order={order}
                idx={idx + 1}
                role={role}
                onMarkCompleted={() => markCompleted(order.id)}
                onRate={() => { setSelectedOrderForRating(order); setRatingModalOpen(true); }}
              />
            ))}
          </div>
        )}
      </main>

      {selectedOrderForRating && (
        <RatingModal
          isOpen={ratingModalOpen}
          onClose={() => { setRatingModalOpen(false); setSelectedOrderForRating(null); }}
          orderId={selectedOrderForRating.id}
          listingTitle={selectedOrderForRating.title}
          generatorName={counterpartyProfiles[selectedOrderForRating.generatorUid]?.name}
          farmerUid={user?.uid || ''}
          onRatingSubmitted={() => {
            // The onSnapshot listener will pick up the rating write automatically.
            setRatingModalOpen(false);
            setSelectedOrderForRating(null);
          }}
        />
      )}
    </div>
  );
}

function Tab({ label, count, active, onClick }: { label: string; count: number; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick}
            className="px-5 h-10 rounded-full font-mono-jb text-[11px] uppercase tracking-[0.25em] inline-flex items-center gap-2.5 transition-all"
            style={active
              ? { background: 'var(--rf-sap)', color: 'var(--rf-forest)' }
              : { background: 'rgba(241,234,216,.04)', color: 'var(--rf-bone)', border: '1px solid rgba(241,234,216,.18)' }}>
      <span>{label}</span>
      <span className="font-fraunces fraunces-wonk italic text-lg leading-none"
            style={{ color: active ? 'var(--rf-forest)' : 'var(--rf-sap)' }}>
        {count}
      </span>
    </button>
  );
}

function OrderStatusPill({ status }: { status: string }) {
  const map: Record<string, { c: string; bg: string; label: string }> = {
    reserved:  { c: 'var(--rf-amber)',       bg: 'rgba(233,196,106,.10)', label: 'Reserved'  },
    completed: { c: 'var(--rf-sky)',       bg: 'rgba(108,180,241,.10)', label: 'Collected' },
    cancelled: { c: 'var(--rf-rust)',       bg: 'rgba(217,87,42,.10)',   label: 'Cancelled' },
  };
  const s = map[status] || { c: 'var(--rf-bone)', bg: 'rgba(241,234,216,.05)', label: status };
  return (
    <span className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full font-mono-jb text-[10px] uppercase tracking-[0.22em]"
          style={{ background: s.bg, color: s.c, border: `1px solid ${s.c}33` }}>
      <span className="size-1.5 rounded-full" style={{ background: s.c }} />
      {s.label}
    </span>
  );
}

function OrderRow({ order, idx, role, onMarkCompleted, onRate }: {
  order: MarketplaceOrder; idx: number; role?: MarketplaceRole; onMarkCompleted: () => void; onRate: () => void;
}) {
  const num = String(idx).padStart(2, '0');
  const dim = order.status === 'completed' || order.status === 'cancelled';
  return (
    <article
      className="relative rounded-2xl p-5 border transition-all hover:-translate-y-0.5"
      style={{
        borderColor: 'rgba(241,234,216,.14)',
        background: 'rgba(241,234,216,.025)',
        opacity: dim ? 0.85 : 1,
      }}
    >
      <div className="flex flex-col md:flex-row gap-5">
        <div className="relative shrink-0">
          <img src={order.imageUrl} alt={order.title} className="w-28 h-28 object-cover rounded-xl" />
          <span className="absolute -top-2 -left-2 font-fraunces fraunces-wonk italic text-3xl font-light leading-none px-2"
                style={{ color: 'var(--rf-sap)' }}>
            {num}
          </span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
            <div className="min-w-0">
              <h3 className="font-fraunces text-xl font-medium tracking-tight leading-tight">{order.title}</h3>
              <p className="font-mono-jb text-[10px] uppercase tracking-[0.22em] opacity-60 mt-1">{order.category}</p>
            </div>
            <OrderStatusPill status={order.status} />
          </div>

          <p className="font-instrument italic text-base mb-3" style={{ color: 'rgba(241,234,216,.7)' }}>
            {order.address}
          </p>

          <div className="flex flex-wrap items-end justify-between gap-4 pt-3 border-t"
               style={{ borderColor: 'rgba(241,234,216,.08)' }}>
            <div>
              {order.scheduledWindow && (
                <p className="font-mono-jb text-[10px] uppercase tracking-[0.22em] opacity-70">
                  Pickup · {new Date(order.scheduledWindow.start).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                </p>
              )}
              <p className="font-fraunces fraunces-wonk text-3xl font-light leading-none mt-1"
                 style={{ color: 'var(--rf-sap)' }}>
                <span className="font-mono-jb text-xs opacity-70 mr-1" style={{ color: 'var(--rf-bone)' }}>{order.currency}</span>
                {order.price.toFixed(2)}
              </p>
            </div>

            {role === 'generator' && order.status === 'reserved' && (
              <button onClick={onMarkCompleted}
                      className="group inline-flex items-center gap-3 pl-5 pr-1.5 h-11 rounded-full font-mono-jb text-[11px] uppercase tracking-[0.25em] transition-all hover:-translate-y-0.5"
                      style={{ background: 'var(--rf-sap)', color: 'var(--rf-forest)' }}>
                <span>Mark collected</span>
                <span className="flex items-center justify-center size-8 rounded-full transition-transform group-hover:rotate-45"
                      style={{ background: 'var(--rf-forest)', color: 'var(--rf-sap)' }}>
                  <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
              </button>
            )}

            {role === 'farmer' && order.status === 'completed' && !order.ratingId && (
              <button onClick={onRate}
                      className="inline-flex items-center gap-2 px-5 h-11 rounded-full font-mono-jb text-[11px] uppercase tracking-[0.25em] transition-all hover:-translate-y-0.5"
                      style={{ background: 'var(--rf-sap)', color: 'var(--rf-forest)' }}>
                <span className="material-symbols-outlined text-base">star</span>
                Rate the kitchen
              </button>
            )}

            {order.ratingId && (
              <span className="inline-flex items-center gap-2 px-4 h-9 rounded-full font-mono-jb text-[10px] uppercase tracking-[0.22em]"
                    style={{ background: 'rgba(233,196,106,.10)', color: 'var(--rf-amber)', border: '1px solid rgba(233,196,106,.3)' }}>
                <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: '"FILL" 1' }}>star</span>
                Rated
              </span>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

function EmptyOrders({ title, body, cta, href }: { title: string; body: string; cta?: string; href?: string }) {
  return (
    <div className="text-center py-20 rounded-2xl border rf-fade-up"
         style={{ borderColor: 'rgba(241,234,216,.14)', background: 'rgba(241,234,216,.02)' }}>
      <div className="font-fraunces fraunces-wonk italic text-7xl font-light leading-none mb-4"
           style={{ color: 'var(--rf-sap)' }}>ø</div>
      <h3 className="font-fraunces text-2xl font-medium mb-2">{title}</h3>
      <p className="font-instrument italic text-lg max-w-md mx-auto mb-8" style={{ color: 'rgba(241,234,216,.6)' }}>
        {body}
      </p>
      {cta && href && (
        <Link href={href}
              className="inline-flex items-center gap-3 pl-6 pr-1.5 h-12 rounded-full font-mono-jb text-[11px] uppercase tracking-[0.25em]"
              style={{ background: 'var(--rf-sap)', color: 'var(--rf-forest)' }}>
          <span>{cta}</span>
          <span className="size-9 rounded-full flex items-center justify-center"
                style={{ background: 'var(--rf-forest)', color: 'var(--rf-sap)' }}>→</span>
        </Link>
      )}
    </div>
  );
}
