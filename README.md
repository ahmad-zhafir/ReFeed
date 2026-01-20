# ReFeed

A modern, hyperlocal food waste redistribution marketplace that connects restaurants (generators) with farmers in real-time. Help reduce food waste while supporting local agriculture with a beautiful, dark-themed interface.

![ReFeed](https://img.shields.io/badge/Next.js-14-black) ![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue) ![Firebase](https://img.shields.io/badge/Firebase-12.8-orange) ![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-38bdf8)

---

## 🚀 Live Demo

Deployment Link: [View Live Deployment](https://re-feed-nine.vercel.app/)

### Testing Credentials

To test the application without creating a new account, use:

- **Email:** food@refeed.com / farmer@refeed.com  
- **Password:** refeed123

---
## 🚀 Features

### Core Functionality
- **Role-Based Marketplace**: Two distinct user roles - Generators (Restaurants) and Farmers
- **User Authentication**: Secure sign-up/login with role selection via Firebase Auth
- **Interactive Maps**: Real-time Google Maps integration showing available listings and user locations
- **Smart Location**: Address autocomplete (Google Places) and GPS-based location selection
- **Real-time Sync**: Instant updates for listings and orders using Firestore
- **Responsive Design**: Optimized for mobile, tablet, and desktop

### Generator (Restaurant) Features
- **Dashboard**: Overview with active listings, pending orders, total earnings, and impact score
- **Listing Management**: Create, edit, and delete waste listings with multiple images
- **Order Tracking**: View and manage reserved, completed, and cancelled orders
- **ESG Analytics**: Comprehensive sustainability metrics including CO2 saved, waste diversion rate, and cost savings
- **Find Farmers**: Map view to discover available farmers in your area
- **Waste Inventory**: Tab-based view of all listings with search functionality
- **Rating System**: Receive and display ratings from farmers

### Farmer Features
- **Marketplace Feed**: Browse available organic waste listings with filters (category, price, distance)
- **Interactive Map**: View listings on a map with bidirectional selection (click card to highlight pin, click pin to highlight card)
- **Listing Details**: View comprehensive listing information with image gallery
- **Checkout System**: First-come-first-serve reservation with pickup window selection
- **Order Management**: Track reserved and completed orders
- **Schedule View**: Calendar and list views for upcoming pickups
- **Rating System**: Rate generators after completing pickups
- **Location Settings**: Adjust location and search radius preferences

### Shared Features
- **Settings Page**: Manage profile, location, and preferences
- **Order History**: View all orders with status filters
- **Schedule Management**: Calendar view for scheduled pickups
- **Dark Theme**: Modern, consistent dark theme throughout the application

---

## 🛠️ Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS with custom dark theme
- **Backend:** Firebase (Auth, Firestore, Storage)
- **Maps:** Google Maps JavaScript API & Places API
- **Notifications:** react-hot-toast
- **Icons:** Material Symbols

---

## 📋 Prerequisites

Before running locally, ensure you have:

- Node.js 18+
- A Firebase Project (Auth, Firestore, Storage enabled)
- A Google Cloud Project (Maps JS API, Places API, Geocoding API enabled)

---

## 🚀 Local Setup

### 1. Clone and Install

```bash
# Clone the repository
git clone <repository-url>
cd ReFeed

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

# Collection Path (for local development)
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

3. **Set Up Firestore Collections**:
   - Collections: `users`, `listings`, `orders`, `ratings`
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

---

## 📁 Project Structure

```
├── app/
│   ├── api/
│   │   ├── geocode/              # Geocoding API route
│   │   └── reverse-geocode/      # Reverse geocoding API route
│   ├── farmer/                    # Farmer pages
│   │   ├── page.tsx              # Farmer dashboard/feed
│   │   ├── listings/            # Listing detail pages
│   │   ├── checkout/             # Checkout pages
│   │   └── map/                  # Map view page
│   ├── generator/                 # Generator (Restaurant) pages
│   │   ├── page.tsx              # Generator dashboard
│   │   └── listings/            # Listing management pages
│   ├── onboarding/               # Onboarding flow
│   │   ├── role/                 # Role selection
│   │   └── location/             # Location setup
│   ├── login/                    # Authentication page
│   ├── orders/                   # Order history page
│   ├── schedule/                 # Schedule/calendar page
│   ├── settings/                 # Settings page
│   ├── layout.tsx                # Root layout
│   ├── page.tsx                  # Landing page
│   └── globals.css               # Global styles
├── components/
│   ├── AuthGuard.tsx             # Authentication guard
│   ├── RoleGuard.tsx             # Role-based access control
│   ├── RatingModal.tsx           # Rating submission modal
│   ├── RatingDisplay.tsx         # Rating display component
│   ├── MapView.tsx               # Generic map component
│   ├── FarmerMapView.tsx         # Farmer map for generators
│   ├── FarmerListingMap.tsx      # Listing map for farmers
│   ├── ImageCarousel.tsx         # Image gallery component
│   └── Logo.tsx                  # Logo component
├── lib/
│   ├── constants.ts              # Collection paths and constants
│   ├── firebase.ts               # Firebase initialization
│   ├── types.ts                  # TypeScript interfaces
│   └── userProfile.ts            # User profile utilities
└── package.json
```

---

## 🎯 Usage

### As a Generator (Restaurant)

1. **Sign Up**: Create an account and select "Restaurant" role
2. **Set Location**: Configure your restaurant location during onboarding
3. **Create Listings**:
   - Navigate to Dashboard → Add Listing
   - Select waste category (Vegetative, Bakery, Dairy, Meat, Fruit Scraps & Rinds, Leafy Greens, Others)
   - Upload multiple images
   - Enter details (title, weight, price, notes)
   - Set pickup address with interactive map
   - Configure pickup windows (one-time or recurring)
   - Publish listing
4. **Manage Listings**: View, edit, or delete listings in Waste Inventory tab
5. **Track Orders**: Monitor reserved and completed orders
6. **View Analytics**: Check ESG metrics and impact score
7. **Find Farmers**: Discover available farmers on the map

### As a Farmer

1. **Sign Up**: Create an account and select "Farmer" role
2. **Set Location**: Configure your location and search radius during onboarding
3. **Browse Listings**:
   - View available organic waste on the marketplace feed
   - Filter by category, price, and distance
   - Use interactive map to explore listings
4. **View Listing Details**: Click on a listing to see full details and image gallery
5. **Reserve Listing**:
   - Select a pickup window
   - For multi-day windows, choose a specific date
   - Confirm reservation (first-come-first-serve)
6. **Manage Orders**: Track reserved and completed orders
7. **Schedule Pickups**: View upcoming pickups in calendar or list view
8. **Rate Generators**: Rate your experience after completing a pickup

---

## 🔐 Data Model

### User Profile
- Basic info (name, email, contact)
- Role (generator/farmer)
- Location (latitude, longitude, address)
- Search radius (farmers only)
- Rating fields (averageRating, totalRatings)

### Listing
- Generator information
- Category, title, weight, notes
- Price and currency
- Location (address, coordinates)
- Images (primary + additional)
- Pickup windows (start/end times)
- Status (live/reserved/completed/expired/cancelled)

### Order
- Links to listing and users
- Scheduled pickup window
- Payment method
- Status (reserved/completed/cancelled)
- Snapshot fields for history
- Rating ID (if rated)

### Rating
- Links to order, listing, and users
- Rating (1-5 stars)
- Optional comment
- Timestamps

---

## 🎨 Design System

The application uses a custom dark theme with:
- **Primary Color:** `#13ec37` (Green)
- **Background:** `#102213` (Dark Green)
- **Cards:** `#1c2e20` (Surface Dark)
- **Borders:** `#234829` (Border Dark)
- **Text Secondary:** `#92c99b` (Light Green)

---

## 📝 Key Features Explained

### Rating System
- Farmers can rate generators after completing a pickup
- One rating per completed order
- Average rating automatically calculated and displayed
- Ratings shown on generator profiles and listing cards

### First-Come-First-Serve (FCFS)
- Atomic transaction system prevents double-booking
- Listings are reserved immediately upon confirmation
- Only one farmer can reserve a listing at a time

### Multi-Day Pickup Windows
- For pickup windows spanning multiple days
- Farmers can select a specific date within the window
- System validates date selection

### Location Management
- Both generators and farmers can adjust their location
- Interactive map picker with address autocomplete
- GPS-based location capture
- Search radius configuration for farmers

---

## 🚀 Deployment

### Vercel Deployment

1. Push code to GitHub
2. Import project in Vercel
3. Add environment variables
4. Deploy

The application is configured for production builds with TypeScript type checking.

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

---

## 📄 License

This project is private and proprietary.

---

## 🙏 Acknowledgments

- Firebase for backend services
- Google Maps for mapping functionality
- Next.js team for the amazing framework
- Tailwind CSS for styling utilities
- Material Symbols for icons

---

**Made with ❤️ for reducing food waste and supporting local agriculture**
