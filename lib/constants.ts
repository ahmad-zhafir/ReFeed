// Get the Firestore collection path for listings
export const getListingsCollectionPath = (): string => {
  // For local development, use a simpler path
  // Set USE_SIMPLE_COLLECTION_PATH=true in .env.local to use 'listings' instead
  if (process.env.NEXT_PUBLIC_USE_SIMPLE_COLLECTION_PATH === 'true') {
    return 'listings';
  }

  // Otherwise, use the Canvas environment path
  const APP_ID = process.env.NEXT_PUBLIC_APP_ID || 'default-app-id';
  return `/artifacts/${APP_ID}/public/data/da19972000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000`;
};

// Get the Firestore collection path for claims
export const getClaimsCollectionPath = (): string => {
  if (process.env.NEXT_PUBLIC_USE_SIMPLE_COLLECTION_PATH === 'true') {
    return 'claims';
  }

  const APP_ID = process.env.NEXT_PUBLIC_APP_ID || 'default-app-id';
  return `/artifacts/${APP_ID}/public/data/claims`;
};

