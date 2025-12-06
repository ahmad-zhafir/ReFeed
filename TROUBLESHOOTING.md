# Troubleshooting: Why Claimers Can't See Available Food

## Quick Checks

### 1. Check Browser Console
Open your browser's developer console (F12) and look for:
- Firebase errors
- Firestore permission errors
- Network errors
- Any red error messages

### 2. Verify Listings Were Created
- Go to the Donor page
- Check "My Listings" section - do you see your listings there?
- Verify the listing status is "active" (not "claimed")

### 3. Check Firebase Connection
- Make sure Firebase is properly configured in `.env.local`
- Restart your dev server after adding Firebase config
- Check if you can see any data in Firebase Console > Firestore

## Common Issues & Solutions

### Issue 1: Collection Path Mismatch

**Problem:** The collection path in code doesn't match where data is stored in Firestore.

**Solution:** Use a simpler collection path for local development.

1. Add this to your `.env.local`:
```env
NEXT_PUBLIC_USE_SIMPLE_COLLECTION_PATH=true
```

2. In Firebase Console, create a collection called `listings` (not the complex path)

3. Restart your dev server

### Issue 2: Firestore Security Rules

**Problem:** Security rules are blocking read access.

**Solution:** Update Firestore rules in Firebase Console:

1. Go to Firebase Console > Firestore Database > Rules
2. Use these rules for development:
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true; // Development only!
    }
  }
}
```
3. Click "Publish"

### Issue 3: Listings Status Not Set Correctly

**Problem:** Listings might not have `status: 'active'` field.

**Check:**
1. Go to Firebase Console > Firestore
2. Open a listing document
3. Verify it has a `status` field with value `'active'` (as a string, not boolean)

**Fix:** If missing, manually add the field or recreate the listing.

### Issue 4: Data Structure Mismatch

**Problem:** Listing documents don't have required fields.

**Required fields:**
- `status` (string): must be `'active'` or `'claimed'`
- `latitude` (number)
- `longitude` (number)
- `title` (string)
- `quantity` (string)
- `address` (string)

**Check in Firebase Console:**
- Open a listing document
- Verify all required fields exist with correct types

### Issue 5: Firebase Not Initialized

**Problem:** Firebase connection failed.

**Check:**
1. Open browser console (F12)
2. Look for "Firebase configuration not found" error
3. Verify all Firebase env variables in `.env.local` are correct

**Solution:**
- Double-check all 6 Firebase config values in `.env.local`
- Make sure they match your Firebase project settings
- Restart dev server

## Debug Steps

### Step 1: Enable Debug Mode
The claimer page now shows debug information in development mode. Check:
- Collection path being used
- Number of listings found
- Any error messages

### Step 2: Check Firestore Directly
1. Go to Firebase Console
2. Navigate to Firestore Database
3. Check if your listings collection exists
4. Verify documents have the correct structure

### Step 3: Test Query Manually
In browser console, try:
```javascript
// This should show if Firebase is connected
console.log('Firebase initialized');
```

### Step 4: Check Network Tab
1. Open browser DevTools > Network tab
2. Filter by "firestore"
3. Look for failed requests
4. Check error responses

## Quick Fix: Use Simple Collection Path

For local development, the easiest solution is to use a simple collection path:

1. **Update `.env.local`:**
```env
NEXT_PUBLIC_USE_SIMPLE_COLLECTION_PATH=true
```

2. **In Firebase Console:**
   - Create a collection named `listings` (if it doesn't exist)
   - Make sure your listings are stored there

3. **Update Firestore Rules:**
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /listings/{listingId} {
      allow read, write: if true;
    }
  }
}
```

4. **Restart dev server**

## Still Not Working?

1. **Check the debug panel** on the claimer page (visible in development mode)
2. **Check browser console** for detailed error messages
3. **Verify Firebase project** is active and billing is enabled (if required)
4. **Test with a simple listing** - create one with all required fields
5. **Check Firestore indexes** - if you get index errors, create the suggested index

## Expected Behavior

When working correctly:
- Claimer page shows "X active listings available"
- Map displays pins for each active listing
- Clicking a pin shows listing details
- "Claim" button works and removes listing from map

If any of these don't work, check the debug information on the page!

