# Troubleshooting: Image Upload Failed

## Quick Fixes

### 1. Enable Firebase Storage

**Most Common Issue:** Firebase Storage is not enabled.

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Click "Build" > "Storage"
4. If you see "Get started", click it
5. Choose "Start in test mode"
6. Select a location (same as Firestore)
7. Click "Done"

### 2. Update Storage Security Rules

Storage rules might be blocking uploads. Update them:

1. Go to Firebase Console > Storage > Rules tab
2. Replace the rules with:

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // Allow read/write for all files (development only!)
    match /{allPaths=**} {
      allow read, write: if true;
    }
  }
}
```

3. Click "Publish"

**⚠️ Warning:** These rules allow anyone to read/write. For production, add proper authentication checks.

### 3. Check Browser Console

1. Open browser DevTools (F12)
2. Go to Console tab
3. Try uploading an image
4. Look for error messages - they will tell you exactly what's wrong

Common error codes:
- `storage/unauthorized` - Storage rules blocking upload
- `storage/quota-exceeded` - Storage quota exceeded
- `storage/unauthenticated` - User not authenticated
- `storage/unknown` - Storage not enabled or configured

### 4. Verify Firebase Configuration

Make sure your `.env.local` has the correct Storage bucket:

```env
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
```

The storage bucket should match what's in Firebase Console > Project Settings > Your apps > Web app config.

### 5. Check Authentication

Make sure you're authenticated:
- The app should show you're signed in
- Check browser console for auth errors
- Try refreshing the page

### 6. Test Storage Manually

1. Go to Firebase Console > Storage
2. Try uploading a file manually through the console
3. If that fails, there's a Storage configuration issue

## Step-by-Step Verification

### Step 1: Verify Storage is Enabled
- [ ] Firebase Console > Storage shows files/buckets (not "Get started")
- [ ] Storage bucket exists

### Step 2: Check Security Rules
- [ ] Storage > Rules tab shows permissive rules (for development)
- [ ] Rules are published (not just saved)

### Step 3: Verify Configuration
- [ ] `.env.local` has `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- [ ] Storage bucket name matches Firebase Console
- [ ] Restarted dev server after adding config

### Step 4: Check Browser Console
- [ ] No Firebase initialization errors
- [ ] No Storage-related errors
- [ ] User is authenticated

## Common Error Messages & Solutions

### "Storage permission denied"
**Solution:** Update Storage security rules (see step 2 above)

### "Storage quota exceeded"
**Solution:** 
- Check Firebase billing/usage
- Free tier has 5GB storage limit
- Upgrade plan if needed

### "Storage is not initialized"
**Solution:**
- Check Firebase config in `.env.local`
- Verify `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` is set
- Restart dev server

### "User not authenticated"
**Solution:**
- Refresh the page
- Check if Anonymous auth is enabled in Firebase Console
- Check browser console for auth errors

## Still Not Working?

1. **Check the exact error message** in browser console (F12)
2. **Verify Storage is enabled** in Firebase Console
3. **Check Storage rules** are permissive for development
4. **Restart dev server** after any config changes
5. **Try a smaller image** (under 1MB) to rule out size issues

## Alternative: Use URL Instead

If uploads still don't work, you can:
1. Upload your image to a service like Imgur, Cloudinary, or similar
2. Copy the image URL
3. Paste it in the "Enter image URL instead" field
4. This bypasses Firebase Storage entirely

