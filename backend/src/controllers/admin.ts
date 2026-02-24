/**
 * Admin Controller
 * 
 * Admin-only endpoints for managing reviews sync, hotel matching, and system status.
 */

import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { query } from '../utils/db.js';
import * as reviewSync from '../services/review-sync.js';
import * as hotelMatching from '../services/hotel-matching.js';
import * as cronScheduler from '../services/cron-scheduler.js';
import * as googlePlaces from '../services/google-places.js';

/**
 * POST /api/admin/sync/trigger
 * Manually trigger a bulk sync for all hotels
 */
export const triggerBulkSync = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id || 'unknown';
    
    const result = await cronScheduler.triggerManualSync(userId);
    
    res.json({
      message: 'Bulk sync completed',
      jobId: result.jobId,
      status: result.status,
      stats: {
        total: result.hotelsTotal,
        success: result.hotelsSuccess,
        failed: result.hotelsFailed,
        duration: `${result.duration}ms`,
      },
      errors: result.errors.length > 0 ? result.errors.slice(0, 10) : undefined,
    });
  } catch (err: any) {
    console.error('Error triggering bulk sync:', err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * POST /api/admin/sync/hotels
 * Manually sync specific hotels
 */
export const syncSpecificHotels = async (req: AuthRequest, res: Response) => {
  try {
    const { hotelIds } = req.body;
    
    if (!hotelIds || !Array.isArray(hotelIds) || hotelIds.length === 0) {
      return res.status(400).json({ error: 'hotelIds array is required' });
    }
    
    if (hotelIds.length > 50) {
      return res.status(400).json({ error: 'Maximum 50 hotels per request' });
    }
    
    const userId = req.user?.id || 'unknown';
    const result = await cronScheduler.triggerManualSync(userId, hotelIds);
    
    res.json({
      message: 'Sync completed',
      jobId: result.jobId,
      status: result.status,
      stats: {
        total: result.hotelsTotal,
        success: result.hotelsSuccess,
        failed: result.hotelsFailed,
        duration: `${result.duration}ms`,
      },
      errors: result.errors.length > 0 ? result.errors : undefined,
    });
  } catch (err: any) {
    console.error('Error syncing specific hotels:', err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * GET /api/admin/sync/jobs
 * Get recent sync job history
 */
export const getSyncJobs = async (req: AuthRequest, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const jobs = await reviewSync.getRecentSyncJobs(limit);
    
    res.json({ jobs });
  } catch (err: any) {
    console.error('Error fetching sync jobs:', err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * GET /api/admin/sync/jobs/:id/errors
 * Get errors for a specific sync job
 */
export const getSyncJobErrors = async (req: AuthRequest, res: Response) => {
  try {
    const jobId = req.params.id;
    const errors = await reviewSync.getSyncJobErrors(jobId);
    
    res.json({ jobId, errors });
  } catch (err: any) {
    console.error('Error fetching sync job errors:', err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * GET /api/admin/sync/pending
 * Get hotels that are pending sync
 */
export const getPendingSyncHotels = async (req: AuthRequest, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const hotels = await reviewSync.getHotelsDueForSync(limit);
    
    res.json({
      count: hotels.length,
      hotels: hotels.map(h => ({
        hotelId: h.hotelId,
        hotelName: h.hotelName,
        sources: h.sources.map((s: any) => s.source),
      })),
    });
  } catch (err: any) {
    console.error('Error fetching pending sync hotels:', err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * GET /api/admin/scheduler/status
 * Get cron scheduler status
 */
export const getSchedulerStatus = async (req: AuthRequest, res: Response) => {
  try {
    const tasks = cronScheduler.getSchedulerStatus();
    
    res.json({
      status: 'running',
      tasks,
    });
  } catch (err: any) {
    console.error('Error fetching scheduler status:', err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * POST /api/hotels/:id/auto-link
 * Auto-match hotel to Google Places and link if confidence is high enough
 */
export const autoLinkHotel = async (req: AuthRequest, res: Response) => {
  try {
    const hotelId = req.params.id;
    const { forceLink } = req.body; // Optional: force link even if confidence < 85%
    
    // Get hotel info
    const hotelResult = await query(
      'SELECT id, name, address, city, country FROM hotels WHERE id = $1',
      [hotelId]
    );
    
    if (hotelResult.rows.length === 0) {
      return res.status(404).json({ error: 'Hotel not found' });
    }
    
    const hotel = hotelResult.rows[0];
    
    // Check if Google Places is configured
    if (!googlePlaces.isGooglePlacesConfigured()) {
      return res.status(503).json({ error: 'Google Places API not configured' });
    }
    
    // Check if already linked
    const existingSource = await query(
      'SELECT * FROM hotel_review_sources WHERE hotel_id = $1 AND source = $2',
      [hotelId, 'google']
    );
    
    if (existingSource.rows.length > 0 && !forceLink) {
      return res.status(400).json({
        error: 'Hotel already linked to Google Places',
        existing: {
          placeId: existingSource.rows[0].external_id,
          name: existingSource.rows[0].name,
          isVerified: existingSource.rows[0].is_verified,
        },
      });
    }
    
    // Match hotel to Google Places
    const matchResult = await hotelMatching.matchHotelToGooglePlaces({
      name: hotel.name,
      address: hotel.address,
      city: hotel.city,
      country: hotel.country,
    });
    
    if (!matchResult.bestMatch) {
      return res.json({
        hotelId,
        matched: false,
        message: 'No matching places found on Google',
        searchQuery: matchResult.searchQuery,
      });
    }
    
    const bestMatch = matchResult.bestMatch;
    
    // Check if auto-linkable or forced
    if (!matchResult.autoLinkable && !forceLink) {
      return res.json({
        hotelId,
        matched: true,
        autoLinked: false,
        message: `Match found but confidence (${hotelMatching.formatConfidence(bestMatch.confidence)}) below auto-link threshold (85%). Use forceLink=true to override.`,
        searchQuery: matchResult.searchQuery,
        bestMatch: {
          placeId: bestMatch.placeId,
          name: bestMatch.name,
          address: bestMatch.formattedAddress,
          rating: bestMatch.rating,
          reviewCount: bestMatch.reviewCount,
          confidence: bestMatch.confidence,
          confidenceFormatted: hotelMatching.formatConfidence(bestMatch.confidence),
          matchDetails: bestMatch.matchDetails,
        },
        allMatches: matchResult.allMatches.slice(0, 5).map(m => ({
          placeId: m.placeId,
          name: m.name,
          address: m.formattedAddress,
          confidence: m.confidence,
          confidenceFormatted: hotelMatching.formatConfidence(m.confidence),
        })),
      });
    }
    
    // Link the hotel
    await query(
      `INSERT INTO hotel_review_sources (hotel_id, source, external_id, name, is_verified)
       VALUES ($1, 'google', $2, $3, $4)
       ON CONFLICT (hotel_id, source) 
       DO UPDATE SET external_id = $2, name = $3, is_verified = $4, updated_at = NOW()`,
      [hotelId, bestMatch.placeId, bestMatch.name, bestMatch.confidence >= 0.85]
    );
    
    // Fetch initial ratings and reviews
    const details = await googlePlaces.getPlaceDetails(bestMatch.placeId);
    if (details) {
      // Store rating
      await query(
        `INSERT INTO hotel_ratings (hotel_id, source, rating, review_count, fetched_at)
         VALUES ($1, 'google', $2, $3, NOW())
         ON CONFLICT (hotel_id, source, DATE(fetched_at))
         DO UPDATE SET rating = $2, review_count = $3, fetched_at = NOW()`,
        [hotelId, details.rating, details.user_ratings_total]
      );
      
      // Store reviews
      for (const review of details.reviews) {
        const publishedAt = review.time ? new Date(review.time * 1000) : null;
        await query(
          `INSERT INTO hotel_reviews (
             hotel_id, source, external_review_id, author_name, author_url,
             profile_photo_url, rating, text, language, relative_time_description, published_at
           ) VALUES ($1, 'google', $2, $3, $4, $5, $6, $7, $8, $9, $10)
           ON CONFLICT (hotel_id, source, external_review_id) 
           DO UPDATE SET 
             author_name = $3, rating = $6, text = $7, 
             relative_time_description = $9, fetched_at = NOW()`,
          [
            hotelId,
            `google_${review.time}`,
            review.author_name,
            review.author_url,
            review.profile_photo_url,
            review.rating,
            review.text,
            review.language,
            review.relative_time_description,
            publishedAt,
          ]
        );
      }
    }
    
    res.json({
      hotelId,
      matched: true,
      autoLinked: true,
      message: 'Hotel successfully linked to Google Places',
      searchQuery: matchResult.searchQuery,
      linkedPlace: {
        placeId: bestMatch.placeId,
        name: bestMatch.name,
        address: bestMatch.formattedAddress,
        rating: details?.rating || bestMatch.rating,
        reviewCount: details?.user_ratings_total || bestMatch.reviewCount,
        confidence: bestMatch.confidence,
        confidenceFormatted: hotelMatching.formatConfidence(bestMatch.confidence),
        isVerified: bestMatch.confidence >= 0.85,
      },
    });
  } catch (err: any) {
    console.error('Error auto-linking hotel:', err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * POST /api/admin/hotels/auto-link-batch
 * Auto-link multiple hotels in batch
 */
export const autoLinkHotelsBatch = async (req: AuthRequest, res: Response) => {
  try {
    const { hotelIds, forceLink } = req.body;
    
    if (!hotelIds || !Array.isArray(hotelIds)) {
      return res.status(400).json({ error: 'hotelIds array is required' });
    }
    
    if (hotelIds.length > 20) {
      return res.status(400).json({ error: 'Maximum 20 hotels per batch' });
    }
    
    const results: any[] = [];
    
    for (const hotelId of hotelIds) {
      try {
        // Get hotel info
        const hotelResult = await query(
          'SELECT id, name, address, city, country FROM hotels WHERE id = $1',
          [hotelId]
        );
        
        if (hotelResult.rows.length === 0) {
          results.push({ hotelId, status: 'not_found' });
          continue;
        }
        
        const hotel = hotelResult.rows[0];
        
        // Check if already linked
        const existingSource = await query(
          'SELECT * FROM hotel_review_sources WHERE hotel_id = $1 AND source = $2',
          [hotelId, 'google']
        );
        
        if (existingSource.rows.length > 0 && !forceLink) {
          results.push({
            hotelId,
            hotelName: hotel.name,
            status: 'already_linked',
            placeId: existingSource.rows[0].external_id,
          });
          continue;
        }
        
        // Match hotel
        const matchResult = await hotelMatching.matchHotelToGooglePlaces({
          name: hotel.name,
          address: hotel.address,
          city: hotel.city,
          country: hotel.country,
        });
        
        if (!matchResult.bestMatch) {
          results.push({
            hotelId,
            hotelName: hotel.name,
            status: 'no_match',
          });
          continue;
        }
        
        const bestMatch = matchResult.bestMatch;
        
        if (!matchResult.autoLinkable && !forceLink) {
          results.push({
            hotelId,
            hotelName: hotel.name,
            status: 'low_confidence',
            confidence: bestMatch.confidence,
            suggestedPlace: bestMatch.name,
          });
          continue;
        }
        
        // Link the hotel
        await query(
          `INSERT INTO hotel_review_sources (hotel_id, source, external_id, name, is_verified)
           VALUES ($1, 'google', $2, $3, $4)
           ON CONFLICT (hotel_id, source) 
           DO UPDATE SET external_id = $2, name = $3, is_verified = $4, updated_at = NOW()`,
          [hotelId, bestMatch.placeId, bestMatch.name, bestMatch.confidence >= 0.85]
        );
        
        results.push({
          hotelId,
          hotelName: hotel.name,
          status: 'linked',
          placeId: bestMatch.placeId,
          placeName: bestMatch.name,
          confidence: bestMatch.confidence,
        });
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (error: any) {
        results.push({
          hotelId,
          status: 'error',
          error: error.message,
        });
      }
    }
    
    // Summary
    const summary = {
      total: results.length,
      linked: results.filter(r => r.status === 'linked').length,
      alreadyLinked: results.filter(r => r.status === 'already_linked').length,
      noMatch: results.filter(r => r.status === 'no_match').length,
      lowConfidence: results.filter(r => r.status === 'low_confidence').length,
      errors: results.filter(r => r.status === 'error').length,
    };
    
    res.json({ summary, results });
  } catch (err: any) {
    console.error('Error in batch auto-link:', err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * GET /api/hotels/:id/sync-status
 * Get sync status for a hotel
 */
export const getHotelSyncStatus = async (req: AuthRequest, res: Response) => {
  try {
    const hotelId = req.params.id;
    const sources = await reviewSync.getHotelSyncStatus(hotelId);
    
    res.json({
      hotelId,
      sources: sources.map(s => ({
        source: s.source,
        externalId: s.external_id,
        name: s.name,
        isVerified: s.is_verified,
        lastSyncAt: s.last_sync_at,
        lastSyncStatus: s.last_sync_status,
        syncErrorMessage: s.sync_error_message,
        syncErrorCount: s.sync_error_count,
        nextSyncAt: s.next_sync_at,
      })),
    });
  } catch (err: any) {
    console.error('Error fetching hotel sync status:', err);
    res.status(500).json({ error: err.message });
  }
};
