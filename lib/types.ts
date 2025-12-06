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
  userType?: 'donor' | 'claimer';
  created_at: any;
}

export type UserType = 'donor' | 'claimer';

