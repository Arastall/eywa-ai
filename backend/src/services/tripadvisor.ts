/**
 * TripAdvisor Content API Service
 * 
 * Fetches hotel ratings, reviews, and ranking from TripAdvisor API.
 * Uses the Location Details and Location Search endpoints.
 * 
 * API Docs: https://tripadvisor-content-api.readme.io/reference
 * Rate Limit: 50 QPS
 * Auth: API Key in header
 */

import dotenv from 'dotenv';

dotenv.config();

const TRIPADVISOR_API_KEY = process.env.TRIPADVISOR_API_KEY;
const BASE_URL = 'https://api.content.tripadvisor.com/api/v1';

// Endpoints
const LOCATION_SEARCH_URL = `${BASE_URL}/location/search`;
const LOCATION_DETAILS_URL = (id: string) => `${BASE_URL}/location/${id}/details`;
const LOCATION_REVIEWS_URL = (id: string) => `${BASE_URL}/location/${id}/reviews`;

export interface TripAdvisorLocation {
  location_id: string;
  name: string;
  address_obj: {
    street1?: string;
    street2?: string;
    city?: string;
    state?: string;
    country?: string;
    postalcode?: string;
    address_string?: string;
  };
}

export interface TripAdvisorDetails {
  location_id: string;
  name: string;
  web_url: string;
  address_obj: {
    street1?: string;
    city?: string;
    country?: string;
    address_string?: string;
  };
  rating: number;
  num_reviews: number;
  ranking: string; // e.g., "#15 of 234 Hotels in Paris"
  ranking_position: number; // Parsed from ranking string
  ranking_total: number; // Parsed from ranking string
  ranking_category: string; // "hotel"
  subcategory?: Array<{ name: string; localized_name: string }>;
  price_level?: string;
  photo?: {
    images: {
      small: { url: string };
      medium: { url: string };
      large: { url: string };
      original: { url: string };
    };
  };
}

export interface TripAdvisorReview {
  id: string;
  title: string;
  text: string;
  rating: number; // 1-5
  published_date: string;
  lang: string;
  user: {
    username: string;
    user_location?: {
      name: string;
    };
    avatar?: {
      small?: { url: string };
      medium?: { url: string };
    };
  };
  trip_type?: string; // "business", "couples", "family", etc.
  travel_date?: string;
  url: string;
}

export interface TripAdvisorSearchResult {
  location_id: string;
  name: string;
  address_obj: {
    city?: string;
    country?: string;
    address_string?: string;
  };
}

/**
 * Common headers for TripAdvisor API requests
 */
function getHeaders(): Record<string, string> {
  if (!TRIPADVISOR_API_KEY) {
    throw new Error('TRIPADVISOR_API_KEY not configured');
  }
  
  return {
    'Accept': 'application/json',
  };
}

/**
 * Add API key to URL params (TripAdvisor uses query param authentication)
 */
function addApiKey(url: string): string {
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}key=${TRIPADVISOR_API_KEY}`;
}

/**
 * Parse ranking string to extract position and total
 * Input: "#15 of 234 Hotels in Paris"
 * Output: { position: 15, total: 234 }
 */
export function parseRankingString(ranking: string): { position: number; total: number; context: string } {
  const match = ranking.match(/#(\d+) of (\d+) (.+)/i);
  if (match) {
    return {
      position: parseInt(match[1], 10),
      total: parseInt(match[2], 10),
      context: `of ${match[2]} ${match[3]}`,
    };
  }
  return { position: 0, total: 0, context: ranking };
}

/**
 * Search for a hotel by name and address
 */
export async function searchHotel(
  hotelName: string,
  city?: string,
  country?: string
): Promise<TripAdvisorSearchResult[]> {
  if (!TRIPADVISOR_API_KEY) {
    throw new Error('TRIPADVISOR_API_KEY not configured');
  }

  // Build search query
  const queryParts = [hotelName];
  if (city) queryParts.push(city);
  if (country) queryParts.push(country);
  const searchQuery = queryParts.join(' ');

  const params = new URLSearchParams({
    searchQuery,
    category: 'hotels',
    language: 'en',
  });

  const url = addApiKey(`${LOCATION_SEARCH_URL}?${params}`);
  
  const response = await fetch(url, {
    method: 'GET',
    headers: getHeaders(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('TripAdvisor Search error:', response.status, errorText);
    throw new Error(`TripAdvisor API error: ${response.status}`);
  }

  const data = await response.json();

  return (data.data || []).map((r: any) => ({
    location_id: r.location_id,
    name: r.name,
    address_obj: r.address_obj || {},
  }));
}

/**
 * Search for hotels near a location (for competitor analysis)
 */
export async function searchNearbyHotels(
  locationQuery: string,
  radius?: number
): Promise<TripAdvisorSearchResult[]> {
  if (!TRIPADVISOR_API_KEY) {
    throw new Error('TRIPADVISOR_API_KEY not configured');
  }

  const params = new URLSearchParams({
    searchQuery: locationQuery,
    category: 'hotels',
    language: 'en',
  });

  if (radius) {
    params.append('radius', radius.toString());
    params.append('radiusUnit', 'km');
  }

  const url = addApiKey(`${LOCATION_SEARCH_URL}?${params}`);
  
  const response = await fetch(url, {
    method: 'GET',
    headers: getHeaders(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('TripAdvisor Nearby Search error:', response.status, errorText);
    throw new Error(`TripAdvisor API error: ${response.status}`);
  }

  const data = await response.json();

  return (data.data || []).map((r: any) => ({
    location_id: r.location_id,
    name: r.name,
    address_obj: r.address_obj || {},
  }));
}

/**
 * Get detailed location information including rating and ranking
 */
export async function getLocationDetails(locationId: string): Promise<TripAdvisorDetails | null> {
  if (!TRIPADVISOR_API_KEY) {
    throw new Error('TRIPADVISOR_API_KEY not configured');
  }

  const params = new URLSearchParams({
    language: 'en',
    currency: 'USD',
  });

  const url = addApiKey(`${LOCATION_DETAILS_URL(locationId)}?${params}`);
  
  const response = await fetch(url, {
    method: 'GET',
    headers: getHeaders(),
  });

  if (!response.ok) {
    if (response.status === 404) {
      return null;
    }
    const errorText = await response.text();
    console.error('TripAdvisor Details error:', response.status, errorText);
    throw new Error(`TripAdvisor API error: ${response.status}`);
  }

  const data = await response.json();

  // Parse ranking to extract position and total
  const rankingInfo = parseRankingString(data.ranking_data?.ranking_string || '');

  return {
    location_id: data.location_id,
    name: data.name,
    web_url: data.web_url,
    address_obj: data.address_obj || {},
    rating: parseFloat(data.rating) || 0,
    num_reviews: parseInt(data.num_reviews, 10) || 0,
    ranking: data.ranking_data?.ranking_string || '',
    ranking_position: rankingInfo.position,
    ranking_total: rankingInfo.total,
    ranking_category: data.ranking_data?.ranking_category || 'hotel',
    subcategory: data.subcategory,
    price_level: data.price_level,
    photo: data.photo,
  };
}

/**
 * Get reviews for a location
 */
export async function getLocationReviews(
  locationId: string,
  language: string = 'en',
  limit: number = 5
): Promise<TripAdvisorReview[]> {
  if (!TRIPADVISOR_API_KEY) {
    throw new Error('TRIPADVISOR_API_KEY not configured');
  }

  const params = new URLSearchParams({
    language,
    limit: limit.toString(),
  });

  const url = addApiKey(`${LOCATION_REVIEWS_URL(locationId)}?${params}`);
  
  const response = await fetch(url, {
    method: 'GET',
    headers: getHeaders(),
  });

  if (!response.ok) {
    if (response.status === 404) {
      return [];
    }
    const errorText = await response.text();
    console.error('TripAdvisor Reviews error:', response.status, errorText);
    throw new Error(`TripAdvisor API error: ${response.status}`);
  }

  const data = await response.json();

  return (data.data || []).map((r: any) => ({
    id: r.id?.toString() || '',
    title: r.title || '',
    text: r.text || '',
    rating: r.rating || 0,
    published_date: r.published_date || '',
    lang: r.lang || language,
    user: {
      username: r.user?.username || 'Anonymous',
      user_location: r.user?.user_location,
      avatar: r.user?.avatar,
    },
    trip_type: r.trip_type,
    travel_date: r.travel_date,
    url: r.url || '',
  }));
}

/**
 * Get full location data including details and reviews
 */
export async function getFullLocationData(locationId: string): Promise<{
  details: TripAdvisorDetails | null;
  reviews: TripAdvisorReview[];
}> {
  const [details, reviews] = await Promise.all([
    getLocationDetails(locationId),
    getLocationReviews(locationId),
  ]);

  return { details, reviews };
}

/**
 * Verify that a location_id is valid and matches expected hotel
 */
export async function verifyLocationId(
  locationId: string,
  expectedHotelName: string
): Promise<{ valid: boolean; matchScore: number; actualName?: string }> {
  try {
    const details = await getLocationDetails(locationId);
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
    console.error('Error verifying TripAdvisor location_id:', error);
    return { valid: false, matchScore: 0 };
  }
}

/**
 * Check if TripAdvisor API is configured
 */
export function isTripAdvisorConfigured(): boolean {
  return !!TRIPADVISOR_API_KEY;
}
