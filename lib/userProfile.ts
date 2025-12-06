import { getFirestoreDb } from './firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { UserProfile } from './types';

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
    await setDoc(
      doc(db, USERS_COLLECTION, userId),
      { ...updates, updated_at: new Date() },
      { merge: true }
    );
  } catch (error) {
    console.error('Error updating user profile:', error);
    throw error;
  }
};

