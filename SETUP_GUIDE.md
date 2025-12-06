# Step-by-Step Setup Guide

## Step 2: Environment Variables Setup

### What You Need

You need to set up two environment variables:
1. **NEXT_PUBLIC_GOOGLE_MAPS_API_KEY** - For Google Maps and Geocoding
2. **NEXT_PUBLIC_APP_ID** - For your Firestore collection path

---

## Part A: Getting Your Google Maps API Key

### Step 1: Go to Google Cloud Console
1. Visit: https://console.cloud.google.com/
2. Sign in with your Google account

### Step 2: Create or Select a Project
1. Click the project dropdown at the top
2. Click "New Project" (or select an existing one)
3. Enter a project name (e.g., "Leftover Loop")
4. Click "Create"

### Step 3: Enable Required APIs
1. Go to "APIs & Services" > "Library" (or visit: https://console.cloud.google.com/apis/library)
2. Search for and enable these APIs:
   - **Maps JavaScript API** - For displaying the map
   - **Geocoding API** - For converting addresses to coordinates
3. Click "Enable" for each API

### Step 4: Create API Key
1. Go to "APIs & Services" > "Credentials" (or visit: https://console.cloud.google.com/apis/credentials)
2. Click "Create Credentials" > "API Key"
3. Copy your API key (it will look like: `AIzaSy...`)

### Step 5: (Recommended) Restrict Your API Key
1. Click on your newly created API key to edit it
2. Under "API restrictions", select "Restrict key"
3. Check only:
   - Maps JavaScript API
   - Geocoding API
4. Under "Application restrictions", you can restrict by HTTP referrer for web apps
5. Click "Save"

### Step 6: Add to .env.local
Open the `.env.local` file in your project root and replace `your_google_maps_api_key_here` with your actual API key:

```env
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=AIzaSyYourActualKeyHere
```

---

## Part B: Setting Your App ID

### Option 1: Using Canvas Environment
If you're using the Canvas environment, use the App ID provided by Canvas:
```env
NEXT_PUBLIC_APP_ID=your-canvas-app-id
```

### Option 2: For Local Testing
If you're testing locally, you can use the default:
```env
NEXT_PUBLIC_APP_ID=default-app-id
```

**Note:** The App ID is used to construct the Firestore collection path. Make sure it matches your Firebase project structure.

---

## Part C: Verify Your Setup

After setting up your `.env.local` file:

1. **Restart your development server** (if it's running):
   - Stop it with `Ctrl+C`
   - Start it again with `npm run dev`

2. **Check that the file is in the right place**:
   - The `.env.local` file should be in the root directory (same level as `package.json`)

3. **Verify the format**:
   - No spaces around the `=` sign
   - No quotes around the values (unless the value itself contains spaces)
   - Each variable on its own line

### Example of correct format:
```env
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=AIzaSyExample123
NEXT_PUBLIC_APP_ID=default-app-id
```

### Common Issues:

❌ **Wrong:** `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY = AIzaSyExample123` (spaces around =)
❌ **Wrong:** `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY="AIzaSyExample123"` (unnecessary quotes)
✅ **Correct:** `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=AIzaSyExample123`

---

## Next Steps

Once you've completed Step 2:
- ✅ Your `.env.local` file is created
- ✅ Google Maps API key is set
- ✅ App ID is configured

You're ready to move to **Step 3: Firebase Configuration** or **Step 4: Run Development Server**!

---

## Troubleshooting

### "Google Maps API key not configured" error
- Make sure `.env.local` is in the root directory
- Restart your dev server after creating/modifying `.env.local`
- Check that the variable name is exactly `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`

### "Geocoding failed" error
- Verify the Geocoding API is enabled in Google Cloud Console
- Check that your API key has access to Geocoding API
- Make sure you haven't exceeded API quotas

### API Key billing
- Google Maps API has a free tier with $200 monthly credit
- For development/testing, this is usually sufficient
- Monitor usage at: https://console.cloud.google.com/billing

