/**
 * Hotel Matching Algorithm Service
 * 
 * Auto-matches hotels to Google Places by name + address with confidence scoring.
 * Uses fuzzy matching to handle variations in hotel names and addresses.
 */

import * as googlePlaces from './google-places.js';
import { PlaceSearchResult } from './google-places.js';

export interface MatchCandidate {
  placeId: string;
  name: string;
  formattedAddress: string;
  rating?: number;
  reviewCount?: number;
  confidence: number;
  matchDetails: {
    nameScore: number;
    addressScore: number;
    hasRating: boolean;
    reviewCountBonus: number;
  };
}

export interface HotelMatchInput {
  name: string;
  address?: string;
  city: string;
  country: string;
}

export interface MatchResult {
  bestMatch: MatchCandidate | null;
  allMatches: MatchCandidate[];
  autoLinkable: boolean; // true if confidence >= 0.85
  searchQuery: string;
}

// Confidence thresholds
const AUTO_LINK_THRESHOLD = 0.85; // Automatically link if confidence >= 85%
const MIN_CONFIDENCE_THRESHOLD = 0.50; // Don't show matches below 50%

/**
 * Normalize string for comparison (lowercase, remove punctuation, trim)
 */
function normalizeString(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .replace(/[^\w\s]/g, ' ') // Remove punctuation
    .replace(/\s+/g, ' ') // Collapse whitespace
    .trim();
}

/**
 * Extract key words from hotel name (remove common words)
 */
function extractKeyWords(name: string): string[] {
  const stopWords = new Set([
    'hotel', 'hotels', 'resort', 'resorts', 'inn', 'lodge', 'suites', 'suite',
    'the', 'a', 'an', 'and', '&', 'by', 'at', 'of', 'in', 'on',
    'boutique', 'luxury', 'spa', 'beach', 'city', 'center', 'centre',
  ]);
  
  const words = normalizeString(name).split(' ');
  return words.filter(w => w.length > 1 && !stopWords.has(w));
}

/**
 * Calculate Jaccard similarity between two sets of words
 */
function jaccardSimilarity(set1: string[], set2: string[]): number {
  const s1 = new Set(set1);
  const s2 = new Set(set2);
  
  const intersection = new Set([...s1].filter(x => s2.has(x)));
  const union = new Set([...s1, ...s2]);
  
  if (union.size === 0) return 0;
  return intersection.size / union.size;
}

/**
 * Calculate Levenshtein distance ratio (0-1, higher = more similar)
 */
function levenshteinRatio(s1: string, s2: string): number {
  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;
  
  if (longer.length === 0) return 1.0;
  
  const distance = levenshteinDistance(longer, shorter);
  return (longer.length - distance) / longer.length;
}

function levenshteinDistance(s1: string, s2: string): number {
  const matrix: number[][] = [];
  
  for (let i = 0; i <= s2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= s1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= s2.length; i++) {
    for (let j = 1; j <= s1.length; j++) {
      if (s2.charAt(i - 1) === s1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[s2.length][s1.length];
}

/**
 * Calculate name similarity score (0-1)
 */
function calculateNameScore(hotelName: string, placeName: string): number {
  const normalHotel = normalizeString(hotelName);
  const normalPlace = normalizeString(placeName);
  
  // Exact match (after normalization)
  if (normalHotel === normalPlace) return 1.0;
  
  // Contains check (one contains the other)
  if (normalPlace.includes(normalHotel) || normalHotel.includes(normalPlace)) {
    const shorter = normalHotel.length < normalPlace.length ? normalHotel : normalPlace;
    const longer = normalHotel.length < normalPlace.length ? normalPlace : normalHotel;
    return 0.8 + (shorter.length / longer.length) * 0.15;
  }
  
  // Keyword-based similarity
  const hotelKeywords = extractKeyWords(hotelName);
  const placeKeywords = extractKeyWords(placeName);
  const keywordScore = jaccardSimilarity(hotelKeywords, placeKeywords);
  
  // Levenshtein ratio
  const levScore = levenshteinRatio(normalHotel, normalPlace);
  
  // Weighted combination
  return keywordScore * 0.6 + levScore * 0.4;
}

/**
 * Calculate address similarity score (0-1)
 */
function calculateAddressScore(
  hotelAddress: string | undefined,
  hotelCity: string,
  hotelCountry: string,
  placeAddress: string
): number {
  const normalPlace = normalizeString(placeAddress);
  const normalCity = normalizeString(hotelCity);
  const normalCountry = normalizeString(hotelCountry);
  
  let score = 0;
  
  // Check if city is in address
  if (normalPlace.includes(normalCity)) {
    score += 0.4;
  }
  
  // Check if country is in address
  if (normalPlace.includes(normalCountry)) {
    score += 0.2;
  }
  
  // If we have a specific address, check for similarity
  if (hotelAddress) {
    const normalHotelAddr = normalizeString(hotelAddress);
    
    // Extract street number if present
    const hotelNumMatch = normalHotelAddr.match(/^\d+/);
    const placeNumMatch = normalPlace.match(/^\d+/);
    
    if (hotelNumMatch && placeNumMatch && hotelNumMatch[0] === placeNumMatch[0]) {
      score += 0.2; // Street number matches
    }
    
    // Check word overlap
    const hotelWords = normalHotelAddr.split(' ').filter(w => w.length > 2);
    const placeWords = normalPlace.split(' ').filter(w => w.length > 2);
    const overlap = jaccardSimilarity(hotelWords, placeWords);
    score += overlap * 0.2;
  } else {
    // No specific address, rely more on city/country
    score += 0.2;
  }
  
  return Math.min(1.0, score);
}

/**
 * Calculate overall confidence score for a match
 */
function calculateConfidence(
  nameScore: number,
  addressScore: number,
  hasRating: boolean,
  reviewCount: number = 0
): { confidence: number; reviewCountBonus: number } {
  // Base confidence from name and address
  let confidence = nameScore * 0.65 + addressScore * 0.25;
  
  // Bonus for having a rating (indicates it's a real business)
  if (hasRating) {
    confidence += 0.05;
  }
  
  // Small bonus for review count (more reviews = more likely correct)
  const reviewCountBonus = Math.min(0.05, reviewCount / 2000);
  confidence += reviewCountBonus;
  
  return {
    confidence: Math.min(1.0, confidence),
    reviewCountBonus,
  };
}

/**
 * Match a hotel to Google Places and return ranked candidates
 */
export async function matchHotelToGooglePlaces(
  hotel: HotelMatchInput
): Promise<MatchResult> {
  const searchQuery = `${hotel.name} ${hotel.city} ${hotel.country}`;
  
  // Search Google Places
  let searchResults: PlaceSearchResult[];
  try {
    searchResults = await googlePlaces.searchHotel(hotel.name, hotel.city, hotel.country);
  } catch (error) {
    console.error('Error searching Google Places:', error);
    return {
      bestMatch: null,
      allMatches: [],
      autoLinkable: false,
      searchQuery,
    };
  }
  
  if (searchResults.length === 0) {
    return {
      bestMatch: null,
      allMatches: [],
      autoLinkable: false,
      searchQuery,
    };
  }
  
  // Score each result
  const candidates: MatchCandidate[] = searchResults.map(place => {
    const nameScore = calculateNameScore(hotel.name, place.name);
    const addressScore = calculateAddressScore(
      hotel.address,
      hotel.city,
      hotel.country,
      place.formatted_address
    );
    const hasRating = place.rating !== undefined && place.rating > 0;
    const { confidence, reviewCountBonus } = calculateConfidence(
      nameScore,
      addressScore,
      hasRating,
      place.user_ratings_total || 0
    );
    
    return {
      placeId: place.place_id,
      name: place.name,
      formattedAddress: place.formatted_address,
      rating: place.rating,
      reviewCount: place.user_ratings_total,
      confidence,
      matchDetails: {
        nameScore,
        addressScore,
        hasRating,
        reviewCountBonus,
      },
    };
  });
  
  // Sort by confidence (descending)
  candidates.sort((a, b) => b.confidence - a.confidence);
  
  // Filter out low-confidence matches
  const validMatches = candidates.filter(c => c.confidence >= MIN_CONFIDENCE_THRESHOLD);
  
  const bestMatch = validMatches[0] || null;
  const autoLinkable = bestMatch !== null && bestMatch.confidence >= AUTO_LINK_THRESHOLD;
  
  return {
    bestMatch,
    allMatches: validMatches,
    autoLinkable,
    searchQuery,
  };
}

/**
 * Check if a match confidence is high enough for auto-linking
 */
export function isAutoLinkable(confidence: number): boolean {
  return confidence >= AUTO_LINK_THRESHOLD;
}

/**
 * Format confidence as percentage string
 */
export function formatConfidence(confidence: number): string {
  return `${Math.round(confidence * 100)}%`;
}
