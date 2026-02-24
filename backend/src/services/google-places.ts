/**
 * Google Places API Service
 * 
 * Fetches hotel ratings and reviews from Google Places API.
 * Uses the Place Details endpoint to get comprehensive information.
 * 
 * API Cost: ~$17/1000 requests
 * Rate Limit: 100 QPS
 */

import dotenv from 'dotenv';

dotenv.config();

const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY;
const PLACE_DETAILS_URL = 'https://maps.googleapis.com/maps/api/place/details/json';
const PLACE_SEARCH_URL = 'https://maps.googleapis.com/maps/api/place/textsearch/json';

export interface GooglePlaceDetails {
  place_id: string;
  name: string;
  formatted_address: string;
  rating: number;
  user_ratings_total: number;
  reviews: GoogleReview[];
  url: string;
  website?: string;
}

export interface GoogleReview {
  author_name: string;
  author_url: string;
  profile_photo_url: string;
  rating: number;
  text: string;
  language: string;
  relative_time_description: string;
  time: number; // Unix timestamp
}

export interface PlaceSearchResult {
  place_id: string;
  name: string;
  formatted_address: string;
  rating?: number;
  user_ratings_total?: number;
}

/**
 * Search for a hotel by name and address
 */
export async function searchHotel(
  hotelName: string,
  city: string,
  country: string
): Promise<PlaceSearchResult[]> {
  if (!GOOGLE_PLACES_API_KEY) {
    throw new Error('GOOGLE_PLACES_API_KEY not configured');
  }

  const query = `${hotelName} hotel ${city} ${country}`;
  const params = new URLSearchParams({
    query,
    type: 'lodging',
    key: GOOGLE_PLACES_API_KEY,
  });

  const response = await fetch(`${PLACE_SEARCH_URL}?${params}`);
  const data = await response.json();

  if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
    console.error('Google Places Search error:', data.status, data.error_message);
    throw new Error(`Google Places API error: ${data.status}`);
  }

  return (data.results || []).map((r: any) => ({
    place_id: r.place_id,
    name: r.name,
    formatted_address: r.formatted_address,
    rating: r.rating,
    user_ratings_total: r.user_ratings_total,
  }));
}

/**
 * Get detailed place information including reviews
 */
export async function getPlaceDetails(placeId: string): Promise<GooglePlaceDetails | null> {
  if (!GOOGLE_PLACES_API_KEY) {
    throw new Error('GOOGLE_PLACES_API_KEY not configured');
  }

  const fields = [
    'place_id',
    'name',
    'formatted_address',
    'rating',
    'user_ratings_total',
    'reviews',
    'url',
    'website',
  ].join(',');

  const params = new URLSearchParams({
    place_id: placeId,
    fields,
    key: GOOGLE_PLACES_API_KEY,
  });

  const response = await fetch(`${PLACE_DETAILS_URL}?${params}`);
  const data = await response.json();

  if (data.status !== 'OK') {
    if (data.status === 'NOT_FOUND' || data.status === 'INVALID_REQUEST') {
      return null;
    }
    console.error('Google Places Details error:', data.status, data.error_message);
    throw new Error(`Google Places API error: ${data.status}`);
  }

  const result = data.result;
  return {
    place_id: result.place_id,
    name: result.name,
    formatted_address: result.formatted_address,
    rating: result.rating || 0,
    user_ratings_total: result.user_ratings_total || 0,
    reviews: (result.reviews || []).map((r: any) => ({
      author_name: r.author_name,
      author_url: r.author_url || '',
      profile_photo_url: r.profile_photo_url || '',
      rating: r.rating,
      text: r.text,
      language: r.language || 'en',
      relative_time_description: r.relative_time_description,
      time: r.time,
    })),
    url: result.url,
    website: result.website,
  };
}

/**
 * Verify that a place_id is still valid and matches expected hotel
 */
export async function verifyPlaceId(
  placeId: string,
  expectedHotelName: string
): Promise<{ valid: boolean; matchScore: number; actualName?: string }> {
  try {
    const details = await getPlaceDetails(placeId);
    if (!details) {
      return { valid: false, matchScore: 0 };
    }

    // Simple name matching (could be improved with fuzzy matching)
    const expectedLower = expectedHotelName.toLowerCase();
    const actualLower = details.name.toLowerCase();
    
    const matchScore = expectedLower === actualLower ? 1.0 :
      actualLower.includes(expectedLower) || expectedLower.includes(actualLower) ? 0.7 : 0.3;

    return {
      valid: true,
      matchScore,
      actualName: details.name,
    };
  } catch (error) {
    console.error('Error verifying place_id:', error);
    return { valid: false, matchScore: 0 };
  }
}

/**
 * Check if Google Places API is configured
 */
export function isGooglePlacesConfigured(): boolean {
  return !!GOOGLE_PLACES_API_KEY;
}
