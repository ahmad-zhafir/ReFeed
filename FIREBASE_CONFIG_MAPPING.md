# Where to Put Your Firebase Config Values

## Step 1: What You Copied from Firebase

When you copied the Firebase config from Firebase Console, it looks like this:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  authDomain: "your-project-name.firebaseapp.com",
  projectId: "your-project-name",
  storageBucket: "your-project-name.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abcdef123456"
};
```

## Step 2: Map to .env.local File

Open your `.env.local` file (in the root folder of your project) and replace the placeholder values:

### Location: `.env.local` file (root directory)

Replace these lines:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key_here
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abcdef
```

### With your actual values:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXX
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project-name.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-name
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project-name.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789012
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789012:web:abcdef123456
```

## Mapping Guide

| Firebase Config Object | .env.local Variable | Example Value |
|----------------------|---------------------|---------------|
| `apiKey` | `NEXT_PUBLIC_FIREBASE_API_KEY` | `AIzaSy...` |
| `authDomain` | `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | `myproject.firebaseapp.com` |
| `projectId` | `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | `myproject` |
| `storageBucket` | `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | `myproject.appspot.com` |
| `messagingSenderId` | `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | `123456789012` |
| `appId` | `NEXT_PUBLIC_FIREBASE_APP_ID` | `1:123456789012:web:abc123` |

## Example: Complete .env.local File

After updating, your `.env.local` should look like this:

```env
# Google Maps API Key
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=YourActualApiKeyHere

# App ID for Firestore collection path
NEXT_PUBLIC_APP_ID=default-app-id

# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyYourActualApiKeyHere
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=my-leftover-loop.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=my-leftover-loop
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=my-leftover-loop.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=987654321098
NEXT_PUBLIC_FIREBASE_APP_ID=1:987654321098:web:xyz789abc123
```

## Important Notes

1. **No quotes needed** - Don't put quotes around the values
2. **No spaces** - No spaces around the `=` sign
3. **Keep the `NEXT_PUBLIC_` prefix** - This is required for Next.js
4. **Save the file** - Make sure to save after editing
5. **Restart dev server** - Stop and restart `npm run dev` after changes

## Quick Checklist

- [ ] Opened `.env.local` file in the root directory
- [ ] Replaced `your_firebase_api_key_here` with your actual `apiKey`
- [ ] Replaced `your-project.firebaseapp.com` with your actual `authDomain`
- [ ] Replaced `your-project-id` with your actual `projectId`
- [ ] Replaced `your-project.appspot.com` with your actual `storageBucket`
- [ ] Replaced `123456789` with your actual `messagingSenderId`
- [ ] Replaced `1:123456789:web:abcdef` with your actual `appId`
- [ ] Saved the file
- [ ] Restarted the dev server

