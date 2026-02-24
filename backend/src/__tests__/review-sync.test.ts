/**
 * Unit tests for Review Sync Service
 */

// Mock dependencies
jest.mock('../utils/db.js', () => ({
  query: jest.fn(),
  pool: { query: jest.fn() },
}));

jest.mock('../services/google-places.js', () => ({
  getPlaceDetails: jest.fn(),
  isGooglePlacesConfigured: jest.fn().mockReturnValue(true),
}));

import * as reviewSync from '../services/review-sync.js';
import { query } from '../utils/db.js';
import * as googlePlaces from '../services/google-places.js';

const mockQuery = query as jest.Mock;
const mockGetPlaceDetails = googlePlaces.getPlaceDetails as jest.Mock;

describe('Review Sync Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getHotelsDueForSync', () => {
    test('returns hotels with linked sources needing sync', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            hotel_id: 'hotel-1',
            hotel_name: 'Test Hotel',
            sources: [{ source: 'google', externalId: 'ChIJ123' }],
          },
        ],
      });

      const hotels = await reviewSync.getHotelsDueForSync(10);

      expect(hotels).toHaveLength(1);
      expect(hotels[0].hotelId).toBe('hotel-1');
      expect(hotels[0].sources).toHaveLength(1);
    });

    test('returns empty array when no hotels need sync', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const hotels = await reviewSync.getHotelsDueForSync(10);

      expect(hotels).toHaveLength(0);
    });
  });

  describe('syncHotelReviews', () => {
    test('successfully syncs Google reviews', async () => {
      mockGetPlaceDetails.mockResolvedValueOnce({
        place_id: 'ChIJ123',
        name: 'Test Hotel',
        formatted_address: '123 Test St',
        rating: 4.5,
        user_ratings_total: 100,
        reviews: [
          {
            author_name: 'John Doe',
            author_url: 'https://example.com',
            profile_photo_url: 'https://example.com/photo.jpg',
            rating: 5,
            text: 'Great hotel!',
            language: 'en',
            relative_time_description: 'a week ago',
            time: 1709251200,
          },
        ],
        url: 'https://maps.google.com',
      });

      // Mock all the database queries
      mockQuery.mockResolvedValue({ rows: [] });

      const result = await reviewSync.syncHotelReviews(
        'hotel-1',
        [{ source: 'google', externalId: 'ChIJ123' }]
      );

      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(mockGetPlaceDetails).toHaveBeenCalledWith('ChIJ123');
    });

    test('handles sync errors gracefully', async () => {
      mockGetPlaceDetails.mockRejectedValueOnce(new Error('API Error'));
      mockQuery.mockResolvedValue({ rows: [] });

      const result = await reviewSync.syncHotelReviews(
        'hotel-1',
        [{ source: 'google', externalId: 'ChIJ123' }]
      );

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].errorMessage).toBe('API Error');
    });

    test('skips TripAdvisor sync (not implemented)', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const result = await reviewSync.syncHotelReviews(
        'hotel-1',
        [{ source: 'tripadvisor', externalId: '12345' }]
      );

      expect(result.errors).toHaveLength(0);
      consoleSpy.mockRestore();
    });

    test('handles missing place gracefully', async () => {
      mockGetPlaceDetails.mockResolvedValueOnce(null);
      mockQuery.mockResolvedValue({ rows: [] });

      const result = await reviewSync.syncHotelReviews(
        'hotel-1',
        [{ source: 'google', externalId: 'invalid-place' }]
      );

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].errorMessage).toContain('Place not found');
    });
  });

  describe('runSyncJob', () => {
    test('creates job record and syncs hotels', async () => {
      // Mock: 1. job creation, 2. hotels query, 3+ rest
      mockQuery
        .mockResolvedValueOnce({ rows: [{ id: 'job-123' }] }) // Insert job
        .mockResolvedValueOnce({ // Get hotels due for sync
          rows: [
            {
              hotel_id: 'hotel-1',
              hotel_name: 'Test Hotel',
              sources: [{ source: 'google', externalId: 'ChIJ123' }],
            },
          ],
        })
        .mockResolvedValue({ rows: [] }); // All subsequent queries

      // Mock Google Places details
      mockGetPlaceDetails.mockResolvedValueOnce({
        place_id: 'ChIJ123',
        name: 'Test Hotel',
        formatted_address: '123 Test St',
        rating: 4.5,
        user_ratings_total: 100,
        reviews: [],
        url: 'https://maps.google.com',
      });

      const result = await reviewSync.runSyncJob({
        triggeredBy: 'test',
        jobType: 'scheduled',
      });

      expect(result.jobId).toBe('job-123');
      expect(result.hotelsTotal).toBe(1);
      expect(result.hotelsSuccess).toBe(1);
    });
  });

  describe('getRecentSyncJobs', () => {
    test('returns recent sync jobs', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 'job-1',
            job_type: 'scheduled',
            status: 'completed',
            started_at: new Date(),
            completed_at: new Date(),
            hotels_total: 10,
            hotels_success: 10,
            hotels_failed: 0,
          },
        ],
      });

      const jobs = await reviewSync.getRecentSyncJobs(10);

      expect(jobs).toHaveLength(1);
      expect(jobs[0].job_type).toBe('scheduled');
    });
  });

  describe('getSyncJobErrors', () => {
    test('returns errors for a job', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 'error-1',
            job_id: 'job-1',
            hotel_id: 'hotel-1',
            hotel_name: 'Test Hotel',
            source: 'google',
            error_type: 'APIError',
            error_message: 'Rate limit exceeded',
          },
        ],
      });

      const errors = await reviewSync.getSyncJobErrors('job-1');

      expect(errors).toHaveLength(1);
      expect(errors[0].error_message).toBe('Rate limit exceeded');
    });
  });

  describe('getHotelSyncStatus', () => {
    test('returns sync status for hotel', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            source: 'google',
            external_id: 'ChIJ123',
            name: 'Test Hotel',
            is_verified: true,
            last_sync_at: new Date(),
            last_sync_status: 'success',
            sync_error_message: null,
            sync_error_count: 0,
            next_sync_at: new Date(),
          },
        ],
      });

      const status = await reviewSync.getHotelSyncStatus('hotel-1');

      expect(status).toHaveLength(1);
      expect(status[0].source).toBe('google');
      expect(status[0].last_sync_status).toBe('success');
    });
  });
});
