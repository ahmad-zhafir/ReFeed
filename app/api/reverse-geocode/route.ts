import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { latitude, longitude } = await request.json();

    if (latitude === undefined || longitude === undefined) {
      return NextResponse.json(
        { error: 'Latitude and longitude are required' },
        { status: 400 }
      );
    }

    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Google Maps API key not configured' },
        { status: 500 }
      );
    }

    // Call Google Reverse Geocoding API
    const reverseGeocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${apiKey}`;
    
    const response = await fetch(reverseGeocodeUrl);
    const data = await response.json();

    if (data.status === 'OK' && data.results.length > 0) {
      return NextResponse.json({
        address: data.results[0].formatted_address,
        latitude: latitude,
        longitude: longitude,
      });
    } else {
      return NextResponse.json(
        { error: 'Reverse geocoding failed: ' + data.status },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Reverse geocoding error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

