import { getFirestoreDb } from './firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { MarketplaceRole, UserProfile } from './types';

const USERS_COLLECTION = 'users';

export const getUserProfile = async (userId: string): Promise<UserProfile | null> => {
  try {
    const db = getFirestoreDb();
    const userDoc = await getDoc(doc(db, USERS_COLLECTION, userId));
    
    if (userDoc.exists()) {
      return {
        id: userDoc.id,
        ...userDoc.data(),
      } as UserProfile;
    }
    return null;
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return null;
  }
};

export const updateUserProfile = async (userId: string, updates: Partial<UserProfile>): Promise<void> => {
  try {
    const db = getFirestoreDb();
    // Filter out undefined values (Firestore doesn't allow undefined)
    const cleanUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, value]) => value !== undefined)
    );
    await setDoc(
      doc(db, USERS_COLLECTION, userId),
      { ...cleanUpdates, updated_at: new Date() },
      { merge: true }
    );
  } catch (error) {
    console.error('Error updating user profile:', error);
    throw error;
  }
};

/**
 * Marketplace helper: set user role once.
 * We keep it strict: if `role` is already set to a different value, we throw.
 */
export const setUserRoleOnce = async (userId: string, role: MarketplaceRole): Promise<void> => {
  const db = getFirestoreDb();
  const userRef = doc(db, USERS_COLLECTION, userId);
  const existing = await getDoc(userRef);

  if (existing.exists()) {
    const data = existing.data() as Partial<UserProfile>;
    if (data.role && data.role !== role) {
      throw new Error('Role already set for this user and cannot be changed in the prototype.');
    }
  }

  await setDoc(
    userRef,
    { role, updated_at: new Date() },
    { merge: true }
  );
};

export const getUserRole = async (userId: string): Promise<MarketplaceRole | null> => {
  const profile = await getUserProfile(userId);
  return profile?.role || null;
};

