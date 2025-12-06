# Food Loop

A modern, hyperlocal food sharing web application that connects local food donors with claimers in real-time. Help reduce food waste while feeding your community with a beautiful, minimalist interface.

![Food Loop](https://img.shields.io/badge/Next.js-14-black) ![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue) ![Firebase](https://img.shields.io/badge/Firebase-10.14-orange) ![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-38bdf8)

---

## 🚀 Live Demo

Deployment Link: [View Live Deployment](https://food-loop-indol.vercel.app/)

### Testing Credentials

To test the application without creating a new account, use:

- **Email:** user@foodloop.com / user2@foodloop.com  
- **Password:** foodloop123

---

## ✨ Features

- **User Authentication:** Secure sign-up/login via Firebase Auth.  
- **Donor Dashboard:** Create listings with photos, quantities, and pickup details.  
- **Interactive Map:** Real-time Google Maps integration showing available food nearby.  
- **Smart Location:** Address autocomplete (Google Places) and one-click geolocation.  
- **Real-time Sync:** Instant updates for listings and claims using Firestore.  
- **Dual Roles:** Seamlessly switch between Donor and Claimer modes.  
- **Responsive Design:** Optimized for mobile, tablet, and desktop.  

---

## 🛠️ Tech Stack

- **Framework:** Next.js 14 (App Router)  
- **Language:** TypeScript  
- **Styling:** Tailwind CSS  
- **Backend:** Firebase (Auth, Firestore, Storage)  
- **Maps:** Google Maps JavaScript API & Places API  
- **Notifications:** react-hot-toast  

---

## 📋 Prerequisites

Before running locally, ensure you have:

- Node.js 18+  
- A Firebase Project (Auth, Firestore, Storage enabled)  
- A Google Cloud Project (Maps JS API, Places API enabled)  

---

## 🚀 Local Setup

### 1. Clone and Install

```bash
# Clone the repository
git clone https://github.com/ahmad-zhafir/FoodLoop.git
cd food-loop

# Install dependencies
npm install
```

### 2. Environment Variables

Create a `.env.local` file in the root directory:

```env
# Google Maps API
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here

# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_firebase_app_id

# Collection Path (optional)
NEXT_PUBLIC_USE_SIMPLE_COLLECTION_PATH=true
NEXT_PUBLIC_APP_ID=your_app_id
```

### 3. Firebase Setup

1. **Create Firebase Project**:
   - Go to [Firebase Console](https://console.firebase.google.com/)
   - Create a new project
   - Enable Authentication (Email/Password)
   - Enable Firestore Database
   - Enable Storage

2. **Get Firebase Config**:
   - Project Settings → Your apps → Web app
   - Copy the configuration values to `.env.local`

3. **Set Up Firestore**:
   - Create collections: `listings` and `claims` (or use Canvas path)
   - Set up security rules (see Firebase documentation)

4. **Set Up Storage**:
   - Enable Storage
   - Configure security rules for image uploads

### 4. Google Maps Setup

1. **Enable APIs**:
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Enable: Maps JavaScript API, Geocoding API, Places API

2. **Create API Key**:
   - APIs & Services → Credentials
   - Create API Key
   - Restrict key to required APIs

3. **Add API Key**:
   - Add to `.env.local` as `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`

### 5. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## 📁 Project Structure

```
├── app/
│   ├── api/
│   │   ├── geocode/              # Geocoding API route
│   │   └── reverse-geocode/      # Reverse geocoding API route
│   ├── claimer/                  # Claimer map view page
│   │   └── page.tsx
│   ├── donor/                    # Donor dashboard page
│   │   └── page.tsx
│   ├── login/                    # Authentication page
│   │   └── page.tsx
│   ├── layout.tsx                # Root layout with Toaster
│   ├── page.tsx                  # Home page
│   └── globals.css               # Global styles
├── components/
│   ├── AuthGuard.tsx             # Authentication guard component
│   ├── ClaimModal.tsx            # Claim quantity modal
│   ├── Logo.tsx                  # Logo component
│   ├── MapView.tsx               # Google Maps component
│   └── MyClaimCard.tsx           # Claim card component
├── lib/
│   ├── constants.ts               # Collection paths and constants
│   ├── firebase.ts                # Firebase initialization
│   ├── types.ts                   # TypeScript interfaces
│   └── userProfile.ts             # User profile utilities
└── package.json
```

## 🎯 Usage

### As a Donor

1. **Sign Up/Login**: Create an account or sign in
2. **Navigate to Donor Page**: Click "I'm a Donor" on the home page
3. **Create Listing**:
   - Fill in food title and quantity
   - Enter pickup address (with autocomplete) or use current location
   - Upload a photo or provide image URL
   - Click "Create Listing"
4. **Manage Listings**: View all your listings in "My Listings" section
   - See status (active/claimed)
   - View claims on your listings
   - Track remaining quantities

### As a Claimer

1. **Sign Up/Login**: Create an account or sign in
2. **Navigate to Claimer Page**: Click "I'm a Claimer" on the home page
3. **Browse Listings**: 
   - View available food on the interactive map
   - Click on map markers to see details
   - Browse listings in the sidebar
4. **Claim Food**:
   - Click "Claim This Item" on a listing
   - Enter quantity to claim
   - Confirm claim
5. **Track Claims**: View all your claims in "My Claims" section


## 📝 Notes

- The app uses real-time Firestore listeners for instant updates
- Map defaults to Malaysia when no listings are available
- Images are stored in Firebase Storage
- Address autocomplete requires Places API to be enabled
- All user data is stored in Firestore

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.


## 🙏 Acknowledgments

- Firebase for backend services
- Google Maps for mapping functionality
- Next.js team for the amazing framework
- Tailwind CSS for styling utilities

---

**Made with ❤️ for reducing food waste and connecting communities**
