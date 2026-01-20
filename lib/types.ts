export interface Listing {
  id: string;
  donor_id: string;
  donor_name?: string;
  donor_contact?: string;
  title: string;
  quantity: string; // Original total quantity
  remaining_quantity?: string; // Quantity still available (calculated from claims)
  address: string;
  latitude: number;
  longitude: number;
  image_url: string;
  status: 'active' | 'claimed';
  created_at: any; // Firestore Timestamp
  claims?: Claim[]; // Claims associated with this listing (optional, added when loading)
}

export interface Claim {
  id: string;
  listing_id: string;
  claimer_id: string;
  claimer_name: string;
  claimer_contact: string;
  quantity: string; // Quantity claimed
  created_at: any; // Firestore Timestamp
}

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  contact: string;
  /**
   * Legacy field (Food Loop): donor/claimer.
   * New marketplace uses `role` instead. Kept for backward compatibility during migration.
   */
  userType?: 'donor' | 'claimer';
  /**
   * Marketplace role (strictly one per user).
   * - generator: Restaurant / Food Generator
   * - farmer: Farmer / Waste Receiver
   */
  role?: MarketplaceRole;
  /**
   * User location preference (used for matching and map defaults).
   */
  location?: {
    latitude: number;
    longitude: number;
    address?: string;
  };
  /**
   * Farmer-only preference: radius in km for feed matching.
   */
  searchRadiusKm?: number;
  /**
   * Rating fields (for generators)
   */
  averageRating?: number; // Calculated average (1-5)
  totalRatings?: number; // Count of ratings received
  created_at: any;
}

export type UserType = 'donor' | 'claimer';

// ---------------- Marketplace types (Food Waste Redistribution Marketplace) ----------------

export type MarketplaceRole = 'generator' | 'farmer';

export type MarketplaceListingStatus = 'live' | 'reserved' | 'completed' | 'expired' | 'cancelled';

export interface MarketplacePickupWindow {
  /**
   * ISO string or "YYYY-MM-DDTHH:mm" local time string.
   * Keep as string for simplicity in MVP; can migrate to Firestore Timestamp later.
   */
  start: string;
  end: string;
}

export interface MarketplaceListing {
  id: string;
  generatorUid: string;
  generatorName?: string;
  generatorContact?: string;

  category: string;
  title: string;
  weightKg?: number;
  notes?: string;
  expiryAt?: string; // ISO string (MVP)

  price: number; // cash on pickup
  currency: string; // e.g. "MYR"

  address: string;
  latitude: number;
  longitude: number;
  imageUrl: string;
  imageUrls?: string[]; // Support multiple images (optional for backward compatibility)

  pickupWindows: MarketplacePickupWindow[];

  status: MarketplaceListingStatus;
  reservedBy?: string; // farmer uid
  reservedAt?: any; // Firestore Timestamp
  scheduledWindow?: MarketplacePickupWindow;

  createdAt: any; // Firestore Timestamp
}

export type MarketplaceOrderStatus = 'reserved' | 'completed' | 'cancelled';

export interface MarketplaceOrder {
  id: string;
  listingId: string;
  generatorUid: string;
  farmerUid: string;

  scheduledWindow: MarketplacePickupWindow;

  paymentMethod: 'cash';
  status: MarketplaceOrderStatus;

  // snapshot fields for display history even if listing changes
  price: number;
  currency: string;
  title: string;
  category: string;
  imageUrl: string;
  address: string;
  latitude: number;
  longitude: number;

  ratingId?: string; // Link to rating if rated

  createdAt: any; // Firestore Timestamp
 }

export interface Rating {
  id: string;
  orderId: string; // Link to the completed order
  listingId: string; // Link to the listing
  generatorUid: string; // Who is being rated
  farmerUid: string; // Who is giving the rating
  
  rating: number; // 1-5 stars
  comment?: string; // Optional review text
  
  createdAt: any; // Firestore Timestamp
  updatedAt?: any; // Firestore Timestamp
}
