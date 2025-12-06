# The Leftover Loop

A hyperlocal food sharing web application that connects local food donors (restaurants, bakeries) with claimers (individuals or groups in need) for real-time food sharing.

## Features

- **Simple Authentication**: Email/Password sign-up and login for Donor and Claimer user types
- **Donor Listing Creation**: Form to input food title, quantity, pickup address, and upload a photo URL
- **Geocoding**: Automatic conversion of addresses to latitude/longitude coordinates
- **Real-time Map View**: Dynamic map displaying active food listings with pins
- **Claim Transaction**: Real-time claiming system that updates listings instantly across all users

## Tech Stack

- **Frontend**: Next.js 14 with React and TypeScript
- **Styling**: Tailwind CSS
- **Database & Auth**: Firebase (Firestore)
- **Mapping**: Google Maps JavaScript API
- **Deployment**: Vercel (ready)

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Variables

Create a `.env.local` file in the root directory with the following variables:

```env
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here
NEXT_PUBLIC_APP_ID=your_app_id_here
```

### 3. Firebase Configuration

The application uses global variables from the Canvas environment:
- `__Firebase_config`: JSON string containing Firebase configuration
- `__initial_auth_token`: Optional authentication token

If running outside the Canvas environment, you'll need to modify `lib/firebase.ts` to use standard Firebase configuration.

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
├── app/
│   ├── api/
│   │   └── geocode/          # Geocoding API route
│   ├── donor/                 # Donor dashboard page
│   ├── claimer/               # Claimer map view page
│   ├── layout.tsx             # Root layout
│   ├── page.tsx               # Home page
│   └── globals.css            # Global styles
├── components/
│   └── MapView.tsx            # Google Maps component
├── lib/
│   ├── firebase.ts            # Firebase initialization
│   └── types.ts               # TypeScript interfaces
└── package.json
```

## Usage

1. **As a Donor**:
   - Click "I'm a Donor" on the home page
   - Fill out the listing form with food details
   - Submit to create a listing (address is automatically geocoded)
   - View your listings in the dashboard

2. **As a Claimer**:
   - Click "I'm a Claimer" on the home page
   - Browse the map to see available food listings
   - Click on a pin to view details
   - Click "Claim This Item" to claim it
   - View your claimed items in the sidebar

## Data Model

Listings are stored in Firestore with the following structure:

- `id`: Document ID
- `donor_id`: User ID of the donor
- `title`: Food description
- `quantity`: Serving size or volume
- `address`: Pickup address
- `latitude`: Map coordinate
- `longitude`: Map coordinate
- `image_url`: Image link
- `status`: 'active' or 'claimed'
- `claimed_by_id`: User ID of claimer (if claimed)
- `created_at`: Timestamp

## Deployment

The application is configured for Vercel deployment:

1. Push your code to GitHub
2. Import the project in Vercel
3. Add environment variables in Vercel dashboard
4. Deploy!

## License

MIT

