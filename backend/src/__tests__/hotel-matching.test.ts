/**
 * Unit tests for Hotel Matching Algorithm
 */

// Mock Google Places module before importing
jest.mock('../services/google-places.js', () => ({
  searchHotel: jest.fn(),
  getPlaceDetails: jest.fn(),
  isGooglePlacesConfigured: jest.fn().mockReturnValue(true),
}));

import * as hotelMatching from '../services/hotel-matching.js';
import * as googlePlaces from '../services/google-places.js';

const mockSearchHotel = googlePlaces.searchHotel as jest.Mock;

describe('Hotel Matching Algorithm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('matchHotelToGooglePlaces', () => {
    test('returns high confidence for exact name match', async () => {
      mockSearchHotel.mockResolvedValueOnce([
        {
          place_id: 'ChIJ123',
          name: 'Grand Hotel Paris',
          formatted_address: '123 Rue de Rivoli, Paris, France',
          rating: 4.5,
          user_ratings_total: 500,
        },
      ]);

      const result = await hotelMatching.matchHotelToGooglePlaces({
        name: 'Grand Hotel Paris',
        city: 'Paris',
        country: 'France',
      });

      expect(result.bestMatch).not.toBeNull();
      expect(result.bestMatch!.placeId).toBe('ChIJ123');
      expect(result.bestMatch!.confidence).toBeGreaterThanOrEqual(0.85);
      expect(result.autoLinkable).toBe(true);
    });

    test('returns partial confidence for similar name', async () => {
      mockSearchHotel.mockResolvedValueOnce([
        {
          place_id: 'ChIJ456',
          name: 'Grand Hotel Paris - City Center',
          formatted_address: '123 Rue de Rivoli, Paris, France',
          rating: 4.2,
          user_ratings_total: 300,
        },
      ]);

      const result = await hotelMatching.matchHotelToGooglePlaces({
        name: 'Grand Hotel Paris',
        city: 'Paris',
        country: 'France',
      });

      expect(result.bestMatch).not.toBeNull();
      expect(result.bestMatch!.confidence).toBeGreaterThanOrEqual(0.5);
      expect(result.bestMatch!.confidence).toBeLessThan(1.0);
    });

    test('returns no match for completely different hotel', async () => {
      mockSearchHotel.mockResolvedValueOnce([
        {
          place_id: 'ChIJ789',
          name: 'Seaside Resort Bangkok',
          formatted_address: '789 Beach Road, Bangkok, Thailand',
          rating: 4.0,
          user_ratings_total: 100,
        },
      ]);

      const result = await hotelMatching.matchHotelToGooglePlaces({
        name: 'Grand Hotel Paris',
        city: 'Paris',
        country: 'France',
      });

      expect(result.allMatches.length).toBe(0); // Below min threshold
    });

    test('returns empty result when no places found', async () => {
      mockSearchHotel.mockResolvedValueOnce([]);

      const result = await hotelMatching.matchHotelToGooglePlaces({
        name: 'Nonexistent Hotel',
        city: 'Atlantis',
        country: 'Underwater',
      });

      expect(result.bestMatch).toBeNull();
      expect(result.allMatches).toHaveLength(0);
      expect(result.autoLinkable).toBe(false);
    });

    test('handles API errors gracefully', async () => {
      mockSearchHotel.mockRejectedValueOnce(new Error('API Error'));

      const result = await hotelMatching.matchHotelToGooglePlaces({
        name: 'Test Hotel',
        city: 'Test City',
        country: 'Test Country',
      });

      expect(result.bestMatch).toBeNull();
      expect(result.allMatches).toHaveLength(0);
    });

    test('ranks multiple results by confidence', async () => {
      mockSearchHotel.mockResolvedValueOnce([
        {
          place_id: 'ChIJ_wrong',
          name: 'Different Hotel',
          formatted_address: 'Some address, Paris, France',
          rating: 4.8,
          user_ratings_total: 1000,
        },
        {
          place_id: 'ChIJ_best',
          name: 'Grand Hotel Paris',
          formatted_address: '123 Avenue des Champs, Paris, France',
          rating: 4.2,
          user_ratings_total: 200,
        },
        {
          place_id: 'ChIJ_partial',
          name: 'Hotel Grand Paris Luxury',
          formatted_address: '456 Rue de la Paix, Paris, France',
          rating: 4.5,
          user_ratings_total: 500,
        },
      ]);

      const result = await hotelMatching.matchHotelToGooglePlaces({
        name: 'Grand Hotel Paris',
        city: 'Paris',
        country: 'France',
      });

      // Should pick exact match first, not highest rating
      expect(result.bestMatch!.placeId).toBe('ChIJ_best');
      expect(result.allMatches.length).toBeGreaterThanOrEqual(1);
    });

    test('considers address when matching', async () => {
      mockSearchHotel.mockResolvedValueOnce([
        {
          place_id: 'ChIJ_without_address',
          name: 'Grand Hotel',
          formatted_address: '123 Main St, London, UK',
          rating: 4.5,
          user_ratings_total: 500,
        },
        {
          place_id: 'ChIJ_with_address',
          name: 'Grand Hotel',
          formatted_address: '123 Rue de Rivoli, Paris, France',
          rating: 4.2,
          user_ratings_total: 300,
        },
      ]);

      const result = await hotelMatching.matchHotelToGooglePlaces({
        name: 'Grand Hotel',
        address: '123 Rue de Rivoli',
        city: 'Paris',
        country: 'France',
      });

      // Should prefer the one in Paris
      expect(result.bestMatch!.placeId).toBe('ChIJ_with_address');
    });
  });

  describe('isAutoLinkable', () => {
    test('returns true for confidence >= 0.85', () => {
      expect(hotelMatching.isAutoLinkable(0.85)).toBe(true);
      expect(hotelMatching.isAutoLinkable(0.90)).toBe(true);
      expect(hotelMatching.isAutoLinkable(1.0)).toBe(true);
    });

    test('returns false for confidence < 0.85', () => {
      expect(hotelMatching.isAutoLinkable(0.84)).toBe(false);
      expect(hotelMatching.isAutoLinkable(0.5)).toBe(false);
      expect(hotelMatching.isAutoLinkable(0)).toBe(false);
    });
  });

  describe('formatConfidence', () => {
    test('formats confidence as percentage', () => {
      expect(hotelMatching.formatConfidence(0.85)).toBe('85%');
      expect(hotelMatching.formatConfidence(0.5)).toBe('50%');
      expect(hotelMatching.formatConfidence(1.0)).toBe('100%');
      expect(hotelMatching.formatConfidence(0.333)).toBe('33%');
    });
  });
});
