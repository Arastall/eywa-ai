/**
 * Unit tests for TripAdvisor service
 * 
 * Note: These tests mock the fetch API to avoid actual API calls.
 * For integration tests with real API, use a separate test suite.
 */

import {
  isTripAdvisorConfigured,
  parseRankingString,
} from '../services/tripadvisor.js';

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

describe('parseRankingString', () => {
  test('parses standard ranking format', () => {
    const result = parseRankingString('#15 of 234 Hotels in Paris');
    expect(result.position).toBe(15);
    expect(result.total).toBe(234);
    expect(result.context).toBe('of 234 Hotels in Paris');
  });

  test('parses ranking with different locations', () => {
    const result = parseRankingString('#3 of 50 Hotels in Bangkok');
    expect(result.position).toBe(3);
    expect(result.total).toBe(50);
    expect(result.context).toBe('of 50 Hotels in Bangkok');
  });

  test('handles unrecognized format', () => {
    const result = parseRankingString('Top Rated Hotel');
    expect(result.position).toBe(0);
    expect(result.total).toBe(0);
    expect(result.context).toBe('Top Rated Hotel');
  });

  test('handles empty string', () => {
    const result = parseRankingString('');
    expect(result.position).toBe(0);
    expect(result.total).toBe(0);
    expect(result.context).toBe('');
  });
});

describe('isTripAdvisorConfigured', () => {
  test('returns false when API key is not set', () => {
    delete process.env.TRIPADVISOR_API_KEY;
    const { isTripAdvisorConfigured: check } = require('../services/tripadvisor.js');
    expect(check()).toBe(false);
  });

  test('returns true when API key is set', () => {
    process.env.TRIPADVISOR_API_KEY = 'test-api-key';
    const { isTripAdvisorConfigured: check } = require('../services/tripadvisor.js');
    expect(check()).toBe(true);
  });
});

describe('TripAdvisor API mocked tests', () => {
  const mockFetch = jest.fn();
  global.fetch = mockFetch as any;

  beforeEach(() => {
    process.env.TRIPADVISOR_API_KEY = 'test-api-key';
    mockFetch.mockClear();
  });

  describe('searchHotel', () => {
    test('searches for hotels with correct query', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          data: [
            {
              location_id: '123456',
              name: 'Grand Hotel Paris',
              address_obj: {
                city: 'Paris',
                country: 'France',
                address_string: '123 Champs-Élysées, Paris',
              },
            },
          ],
        }),
      });

      const { searchHotel } = require('../services/tripadvisor.js');
      const results = await searchHotel('Grand Hotel', 'Paris', 'France');

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch.mock.calls[0][0]).toContain('location/search');
      expect(mockFetch.mock.calls[0][0]).toContain('searchQuery=Grand+Hotel');
      expect(mockFetch.mock.calls[0][0]).toContain('category=hotels');
      expect(results).toHaveLength(1);
      expect(results[0].location_id).toBe('123456');
    });

    test('returns empty array for no results', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          data: [],
        }),
      });

      const { searchHotel } = require('../services/tripadvisor.js');
      const results = await searchHotel('Nonexistent Hotel', 'City', 'Country');

      expect(results).toHaveLength(0);
    });

    test('throws error on API failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: () => Promise.resolve('Unauthorized'),
      });

      const { searchHotel } = require('../services/tripadvisor.js');
      
      await expect(searchHotel('Hotel', 'City', 'Country'))
        .rejects.toThrow('TripAdvisor API error');
    });
  });

  describe('getLocationDetails', () => {
    test('returns location details with rating and ranking', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          location_id: '123456',
          name: 'Grand Hotel Paris',
          web_url: 'https://tripadvisor.com/Hotel_Review-g123-d456',
          address_obj: {
            street1: '123 Champs-Élysées',
            city: 'Paris',
            country: 'France',
            address_string: '123 Champs-Élysées, Paris, France',
          },
          rating: '4.5',
          num_reviews: '1247',
          ranking_data: {
            ranking_string: '#15 of 234 Hotels in Paris',
            ranking_category: 'hotel',
          },
          price_level: '$$$$',
        }),
      });

      const { getLocationDetails } = require('../services/tripadvisor.js');
      const details = await getLocationDetails('123456');

      expect(details).not.toBeNull();
      expect(details.location_id).toBe('123456');
      expect(details.name).toBe('Grand Hotel Paris');
      expect(details.rating).toBe(4.5);
      expect(details.num_reviews).toBe(1247);
      expect(details.ranking_position).toBe(15);
      expect(details.ranking_total).toBe(234);
    });

    test('returns null for invalid location_id', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: () => Promise.resolve('Not Found'),
      });

      const { getLocationDetails } = require('../services/tripadvisor.js');
      const details = await getLocationDetails('invalid');

      expect(details).toBeNull();
    });

    test('handles missing ranking data gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          location_id: '123456',
          name: 'New Hotel',
          web_url: 'https://tripadvisor.com/Hotel_Review-g123-d456',
          address_obj: {},
          rating: '4.0',
          num_reviews: '5',
          // No ranking_data
        }),
      });

      const { getLocationDetails } = require('../services/tripadvisor.js');
      const details = await getLocationDetails('123456');

      expect(details).not.toBeNull();
      expect(details.ranking_position).toBe(0);
      expect(details.ranking_total).toBe(0);
    });
  });

  describe('getLocationReviews', () => {
    test('returns reviews for location', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          data: [
            {
              id: 'review123',
              title: 'Amazing Stay!',
              text: 'Best hotel in Paris. Highly recommended.',
              rating: 5,
              published_date: '2024-02-15',
              lang: 'en',
              user: {
                username: 'TravellerJohn',
                user_location: { name: 'New York, USA' },
                avatar: {
                  small: { url: 'https://example.com/avatar-small.jpg' },
                  medium: { url: 'https://example.com/avatar-medium.jpg' },
                },
              },
              trip_type: 'couples',
              travel_date: '2024-02',
              url: 'https://tripadvisor.com/ShowUserReviews-review123',
            },
          ],
        }),
      });

      const { getLocationReviews } = require('../services/tripadvisor.js');
      const reviews = await getLocationReviews('123456');

      expect(reviews).toHaveLength(1);
      expect(reviews[0].id).toBe('review123');
      expect(reviews[0].rating).toBe(5);
      expect(reviews[0].user.username).toBe('TravellerJohn');
      expect(reviews[0].trip_type).toBe('couples');
    });

    test('returns empty array for location with no reviews', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          data: [],
        }),
      });

      const { getLocationReviews } = require('../services/tripadvisor.js');
      const reviews = await getLocationReviews('123456');

      expect(reviews).toHaveLength(0);
    });

    test('returns empty array for non-existent location', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: () => Promise.resolve('Not Found'),
      });

      const { getLocationReviews } = require('../services/tripadvisor.js');
      const reviews = await getLocationReviews('invalid');

      expect(reviews).toHaveLength(0);
    });
  });

  describe('verifyLocationId', () => {
    test('returns high match score for exact name match', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          location_id: '123456',
          name: 'Grand Hotel Paris',
          web_url: 'https://tripadvisor.com/Hotel_Review-g123-d456',
          address_obj: {},
          rating: '4.5',
          num_reviews: '100',
          ranking_data: { ranking_string: '#15 of 234 Hotels in Paris' },
        }),
      });

      const { verifyLocationId } = require('../services/tripadvisor.js');
      const result = await verifyLocationId('123456', 'Grand Hotel Paris');

      expect(result.valid).toBe(true);
      expect(result.matchScore).toBe(1.0);
      expect(result.actualName).toBe('Grand Hotel Paris');
    });

    test('returns partial match for similar names', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          location_id: '123456',
          name: 'Grand Hotel Paris - City Center',
          web_url: 'https://tripadvisor.com/Hotel_Review-g123-d456',
          address_obj: {},
          rating: '4.5',
          num_reviews: '100',
          ranking_data: { ranking_string: '#15 of 234 Hotels in Paris' },
        }),
      });

      const { verifyLocationId } = require('../services/tripadvisor.js');
      const result = await verifyLocationId('123456', 'Grand Hotel Paris');

      expect(result.valid).toBe(true);
      expect(result.matchScore).toBe(0.7);
    });

    test('returns invalid for non-existent location', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: () => Promise.resolve('Not Found'),
      });

      const { verifyLocationId } = require('../services/tripadvisor.js');
      const result = await verifyLocationId('invalid', 'Some Hotel');

      expect(result.valid).toBe(false);
      expect(result.matchScore).toBe(0);
    });
  });

  describe('searchNearbyHotels', () => {
    test('searches for nearby hotels', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          data: [
            {
              location_id: '111',
              name: 'Hotel A',
              address_obj: { city: 'Paris' },
            },
            {
              location_id: '222',
              name: 'Hotel B',
              address_obj: { city: 'Paris' },
            },
          ],
        }),
      });

      const { searchNearbyHotels } = require('../services/tripadvisor.js');
      const results = await searchNearbyHotels('hotels in Paris', 5);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch.mock.calls[0][0]).toContain('radius=5');
      expect(mockFetch.mock.calls[0][0]).toContain('radiusUnit=km');
      expect(results).toHaveLength(2);
    });
  });

  describe('getFullLocationData', () => {
    test('fetches details and reviews in parallel', async () => {
      // Mock for details
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          location_id: '123456',
          name: 'Grand Hotel',
          web_url: 'https://tripadvisor.com/Hotel',
          address_obj: {},
          rating: '4.5',
          num_reviews: '100',
          ranking_data: { ranking_string: '#1 of 10 Hotels' },
        }),
      });

      // Mock for reviews
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          data: [
            {
              id: 'r1',
              title: 'Great!',
              text: 'Loved it',
              rating: 5,
              published_date: '2024-02-01',
              lang: 'en',
              user: { username: 'User1' },
              url: 'https://tripadvisor.com/review',
            },
          ],
        }),
      });

      const { getFullLocationData } = require('../services/tripadvisor.js');
      const result = await getFullLocationData('123456');

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(result.details).not.toBeNull();
      expect(result.details?.name).toBe('Grand Hotel');
      expect(result.reviews).toHaveLength(1);
      expect(result.reviews[0].title).toBe('Great!');
    });
  });
});

describe('Integration with Eywa Score', () => {
  test('TripAdvisor data structure is compatible with EywaScore', () => {
    // Verify the data structure matches what eywa-score.ts expects
    const mockTripAdvisorData = {
      rating: 4.5,
      num_reviews: 100,
    };

    const ratingSource = {
      source: 'tripadvisor' as const,
      rating: mockTripAdvisorData.rating,
      reviewCount: mockTripAdvisorData.num_reviews,
    };

    // Import eywa-score types to verify compatibility
    const { calculateEywaScore } = require('../services/eywa-score.js');
    
    const result = calculateEywaScore([ratingSource]);
    
    expect(result.tripadvisorRating).toBe(4.5);
    expect(result.tripadvisorConfidence).toBe(1.0); // 100 reviews = full confidence
    expect(result.sourcesUsed).toContain('tripadvisor');
  });
});
