# Food Loop

A modern, hyperlocal food sharing web application that connects local food donors with claimers in real-time. Help reduce food waste while feeding your community with a beautiful, minimalist interface.

![Food Loop](https://img.shields.io/badge/Next.js-14-black) ![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue) ![Firebase](https://img.shields.io/badge/Firebase-10.14-orange) ![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-38bdf8)

## ✨ Features

### Core Functionality
- **User Authentication**: Email/Password sign-up and login with Firebase Authentication
- **Donor Dashboard**: Create and manage food donation listings
- **Claimer Map View**: Browse available food on an interactive Google Map
- **Real-time Updates**: Live synchronization across all users using Firestore
- **Image Upload**: Upload food photos directly to Firebase Storage or use image URLs
- **Address Autocomplete**: Google Places API integration for easy address entry
- **Current Location**: One-click location detection for quick address entry

### User Experience
- **Toast Notifications**: Beautiful, non-intrusive notifications for all actions
- **Modern UI**: Minimalist, aesthetic design with gradient backgrounds
- **Responsive Design**: Works seamlessly on desktop, tablet, and mobile
- **Real-time Map**: Interactive Google Maps with custom markers
- **My Listings**: View and manage all your donations with status tracking
- **My Claims**: Track all your claimed items in one place
- **Smart Sorting**: Active listings shown first, fully claimed at bottom

### Technical Features
- **Geocoding**: Automatic address to coordinates conversion
- **Reverse Geocoding**: Get address from current location
- **Quantity Management**: Automatic calculation of remaining quantities
- **Status Tracking**: Active and claimed status for listings
- **Multiple Claims**: Support for multiple claimers per listing
- **Malaysia-Focused**: Default map view centered on Malaysia

## 🛠️ Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Database**: Firebase Firestore
- **Authentication**: Firebase Authentication
- **Storage**: Firebase Storage
- **Maps**: Google Maps JavaScript API with Places API
- **Notifications**: react-hot-toast
- **Deployment**: Vercel (ready)

## 📋 Prerequisites

- Node.js 18+ and npm
- Firebase project with Firestore and Storage enabled
- Google Cloud project with Maps JavaScript API and Places API enabled
- Google Maps API key
- Firebase configuration credentials

## 🚀 Setup Instructions

### 1. Clone and Install

```bash
# Clone the repository
git clone <your-repo-url>
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

## 📊 Data Model

### Listing Document

```typescript
{
  id: string;                      // Document ID
  donor_id: string;                // User ID of donor
  donor_name?: string;             // Donor's name
  donor_contact?: string;         // Donor's contact
  title: string;                   // Food description
  quantity: string;                // Original total quantity
  remaining_quantity?: string;    // Quantity still available
  address: string;               // Pickup address
  latitude: number;               // Map coordinate
  longitude: number;              // Map coordinate
  image_url: string;              // Image URL
  status: 'active' | 'claimed';   // Listing status
  created_at: Timestamp;          // Creation timestamp
}
```

### Claim Document

```typescript
{
  id: string;                     // Document ID
  listing_id: string;              // ID of claimed listing
  claimer_id: string;              // User ID of claimer
  claimer_name: string;            // Claimer's name
  claimer_contact: string;        // Claimer's contact
  quantity: string;                // Quantity claimed
  created_at: Timestamp;           // Claim timestamp
}
```

### User Profile Document

```typescript
{
  id: string;                     // User ID
  email: string;                  // User email
  name: string;                   // User name
  contact: string;                 // Contact number
  created_at: Timestamp;           // Profile creation date
}
```

## 🚀 Deployment

### Deploy to Vercel

1. **Push to GitHub**:
   ```bash
   git add .
   git commit -m "Ready for deployment"
   git push origin main
   ```

2. **Import to Vercel**:
   - Go to [vercel.com](https://vercel.com)
   - Sign in with GitHub
   - Click "Add New Project"
   - Import your repository

3. **Configure Environment Variables**:
   - Add all variables from `.env.local`
   - Make sure all `NEXT_PUBLIC_*` variables are added

4. **Deploy**:
   - Click "Deploy"
   - Wait for build to complete
   - Your app will be live!

5. **Update Firebase Settings**:
   - Add Vercel domain to Firebase Authorized Domains
   - Update Google Maps API restrictions to include Vercel domain

### Environment Variables for Vercel

Add all these in Vercel dashboard:
- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `NEXT_PUBLIC_USE_SIMPLE_COLLECTION_PATH` (optional)
- `NEXT_PUBLIC_APP_ID` (optional)

## 🎨 UI/UX Features

- **Gradient Backgrounds**: Beautiful white-to-green gradient across all pages
- **Modern Cards**: Rounded corners, subtle shadows, hover effects
- **Toast Notifications**: Non-blocking, centered notifications
- **Responsive Design**: Mobile-first approach
- **Loading States**: Smooth loading indicators
- **Empty States**: Helpful messages when no data
- **Custom Scrollbars**: Styled scrollbars for better aesthetics

## 🔧 Development

### Available Scripts

```bash
# Development server
npm run dev

# Production build
npm run build

# Start production server
npm start

# Lint code
npm run lint
```

### Key Dependencies

- `next`: Next.js framework
- `react` & `react-dom`: React library
- `firebase`: Firebase SDK
- `@react-google-maps/api`: Google Maps integration
- `react-hot-toast`: Toast notifications
- `tailwindcss`: Utility-first CSS framework

## 📝 Notes

- The app uses real-time Firestore listeners for instant updates
- Map defaults to Malaysia when no listings are available
- Images are stored in Firebase Storage
- Address autocomplete requires Places API to be enabled
- All user data is stored in Firestore

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

MIT

## 🙏 Acknowledgments

- Firebase for backend services
- Google Maps for mapping functionality
- Next.js team for the amazing framework
- Tailwind CSS for styling utilities

---

**Made with ❤️ for reducing food waste and connecting communities**
