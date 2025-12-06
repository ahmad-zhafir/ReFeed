# Firebase Setup Guide

Yes, you need to set up Firebase to create listings! Here's how to do it:

## Step 1: Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project" or select an existing project
3. Enter a project name (e.g., "Leftover Loop")
4. Follow the setup wizard (you can disable Google Analytics for now if you want)

## Step 2: Get Your Firebase Configuration

1. In your Firebase project, click the gear icon ⚙️ next to "Project Overview"
2. Select "Project settings"
3. Scroll down to "Your apps" section
4. Click the web icon `</>` to add a web app
5. Register your app with a nickname (e.g., "Leftover Loop Web")
6. **Copy the Firebase configuration object** - it will look like this:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef"
};
```

## Step 3: Enable Required Services

### Enable Firestore Database

1. In Firebase Console, go to "Build" > "Firestore Database"
2. Click "Create database"
3. Choose "Start in test mode" (for development)
4. Select a location for your database
5. Click "Enable"

### Enable Email/Password Authentication

1. Go to "Build" > "Authentication"
2. Click "Get started"
3. Go to the "Sign-in method" tab
4. Click on "Email/Password"
5. Enable "Email/Password" (toggle ON)
6. Click "Save"

**Note:** You can also enable "Anonymous" authentication if you want to support anonymous users, but the app now requires email/password login.

### Enable Firebase Storage (for photo uploads)

1. Go to "Build" > "Storage"
2. Click "Get started"
3. Choose "Start in test mode" (for development)
4. Select a location (same as Firestore is recommended)
5. Click "Done"

**Important:** Update Storage security rules for development:
1. Go to "Storage" > "Rules" tab
2. Use these rules for development:
```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read, write: if true; // Development only!
    }
  }
}
```
3. Click "Publish"

## Step 4: Update Your .env.local File

Add these Firebase configuration variables to your `.env.local` file:

```env
# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key_here
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abcdef
```

Replace the values with the ones from your Firebase config object.

## Step 5: Set Up Firestore Security Rules (Important!)

1. Go to "Build" > "Firestore Database" > "Rules" tab
2. Update the rules to allow read/write for development:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow read/write access to listings collection
    match /artifacts/{appId}/public/data/{document=**} {
      allow read, write: if true; // For development only!
    }
  }
}
```

**⚠️ Warning:** These rules allow anyone to read/write. For production, you should add proper authentication checks.

## Step 6: Restart Your Development Server

After updating `.env.local`:

1. Stop your dev server (Ctrl+C)
2. Start it again: `npm run dev`

## Troubleshooting

### "Firebase configuration not found" error
- Make sure all 6 Firebase environment variables are set in `.env.local`
- Restart your dev server after adding them
- Check that variable names start with `NEXT_PUBLIC_`

### "Permission denied" error when creating listings
- Check your Firestore security rules
- Make sure Anonymous authentication is enabled
- Verify your Firestore database is created

### "Collection not found" error
- Make sure your Firestore database is created
- Check that the collection path matches your `NEXT_PUBLIC_APP_ID`

## Quick Checklist

- [ ] Firebase project created
- [ ] Firestore Database enabled
- [ ] Anonymous Authentication enabled
- [ ] Firebase config added to `.env.local`
- [ ] Firestore security rules updated
- [ ] Development server restarted

Once all these are done, you should be able to create listings!

