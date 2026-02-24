/**
 * Unit tests for Google Places service
 * 
 * Note: These tests mock the fetch API to avoid actual API calls.
 * For integration tests with real API, use a separate test suite.
 */

import {
  isGooglePlacesConfigured,
} from '../services/google-places.js';

// Store original env
const originalEnv = process.env;

beforeEach(() => {
  // Reset modules to pick up env changes
  jest.resetModules();
  process.env = { ...originalEnv };
});

afterAll(() => {
  process.env = originalEnv;
});

describe('isGooglePlacesConfigured', () => {
  test('returns false when API key is not set', () => {
    delete process.env.GOOGLE_PLACES_API_KEY;
    // Need to re-import after env change
    const { isGooglePlacesConfigured: check } = require('../services/google-places.js');
    expect(check()).toBe(false);
  });

  test('returns true when API key is set', () => {
    process.env.GOOGLE_PLACES_API_KEY = 'test-api-key';
    const { isGooglePlacesConfigured: check } = require('../services/google-places.js');
    expect(check()).toBe(true);
  });
});

describe('Google Places API mocked tests', () => {
  const mockFetch = jest.fn();
  global.fetch = mockFetch as any;

  beforeEach(() => {
    process.env.GOOGLE_PLACES_API_KEY = 'test-api-key';
    mockFetch.mockClear();
  });

  describe('searchHotel', () => {
    test('searches for hotels with correct query', async () => {
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({
          status: 'OK',
          results: [
            {
              place_id: 'ChIJ123',
              name: 'Test Hotel',
              formatted_address: '123 Test St, Paris, France',
              rating: 4.5,
              user_ratings_total: 100,
            },
          ],
        }),
      });

      const { searchHotel } = require('../services/google-places.js');
      const results = await searchHotel('Test Hotel', 'Paris', 'France');

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch.mock.calls[0][0]).toContain('textsearch');
      expect(mockFetch.mock.calls[0][0]).toContain('Test+Hotel'); // URLSearchParams uses + for spaces
      expect(results).toHaveLength(1);
      expect(results[0].place_id).toBe('ChIJ123');
    });

    test('returns empty array for no results', async () => {
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({
          status: 'ZERO_RESULTS',
          results: [],
        }),
      });

      const { searchHotel } = require('../services/google-places.js');
      const results = await searchHotel('Nonexistent Hotel', 'City', 'Country');

      expect(results).toHaveLength(0);
    });

    test('throws error on API failure', async () => {
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({
          status: 'REQUEST_DENIED',
          error_message: 'Invalid API key',
        }),
      });

      const { searchHotel } = require('../services/google-places.js');
      
      await expect(searchHotel('Hotel', 'City', 'Country'))
        .rejects.toThrow('Google Places API error');
    });
  });

  describe('getPlaceDetails', () => {
    test('returns place details with reviews', async () => {
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({
          status: 'OK',
          result: {
            place_id: 'ChIJ123',
            name: 'Test Hotel',
            formatted_address: '123 Test St',
            rating: 4.5,
            user_ratings_total: 100,
            reviews: [
              {
                author_name: 'John Doe',
                author_url: 'https://example.com/user',
                profile_photo_url: 'https://example.com/photo.jpg',
                rating: 5,
                text: 'Great hotel!',
                language: 'en',
                relative_time_description: 'a week ago',
                time: 1709251200,
              },
            ],
            url: 'https://maps.google.com/?cid=123',
            website: 'https://testhotel.com',
          },
        }),
      });

      const { getPlaceDetails } = require('../services/google-places.js');
      const details = await getPlaceDetails('ChIJ123');

      expect(details).not.toBeNull();
      expect(details.place_id).toBe('ChIJ123');
      expect(details.rating).toBe(4.5);
      expect(details.user_ratings_total).toBe(100);
      expect(details.reviews).toHaveLength(1);
      expect(details.reviews[0].author_name).toBe('John Doe');
    });

    test('returns null for invalid place_id', async () => {
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({
          status: 'NOT_FOUND',
        }),
      });

      const { getPlaceDetails } = require('../services/google-places.js');
      const details = await getPlaceDetails('invalid');

      expect(details).toBeNull();
    });
  });

  describe('verifyPlaceId', () => {
    test('returns high match score for exact name match', async () => {
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({
          status: 'OK',
          result: {
            place_id: 'ChIJ123',
            name: 'Grand Hotel Paris',
            formatted_address: '123 Test St',
            rating: 4.5,
            user_ratings_total: 100,
            reviews: [],
            url: 'https://maps.google.com/?cid=123',
          },
        }),
      });

      const { verifyPlaceId } = require('../services/google-places.js');
      const result = await verifyPlaceId('ChIJ123', 'Grand Hotel Paris');

      expect(result.valid).toBe(true);
      expect(result.matchScore).toBe(1.0);
      expect(result.actualName).toBe('Grand Hotel Paris');
    });

    test('returns partial match for similar names', async () => {
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({
          status: 'OK',
          result: {
            place_id: 'ChIJ123',
            name: 'Grand Hotel Paris - City Center',
            formatted_address: '123 Test St',
            rating: 4.5,
            user_ratings_total: 100,
            reviews: [],
            url: 'https://maps.google.com/?cid=123',
          },
        }),
      });

      const { verifyPlaceId } = require('../services/google-places.js');
      const result = await verifyPlaceId('ChIJ123', 'Grand Hotel Paris');

      expect(result.valid).toBe(true);
      expect(result.matchScore).toBe(0.7);
    });

    test('returns invalid for non-existent place', async () => {
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({
          status: 'NOT_FOUND',
        }),
      });

      const { verifyPlaceId } = require('../services/google-places.js');
      const result = await verifyPlaceId('invalid', 'Some Hotel');

      expect(result.valid).toBe(false);
      expect(result.matchScore).toBe(0);
    });
  });
});
