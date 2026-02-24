/**
 * Review Sync Service
 * 
 * Handles scheduled and manual syncing of hotel reviews and ratings
 * from external sources (Google Places, TripAdvisor).
 */

import { query, pool } from '../utils/db.js';
import * as googlePlaces from './google-places.js';
import * as eywaScore from './eywa-score.js';

export interface SyncJobResult {
  jobId: string;
  status: 'completed' | 'failed' | 'partial';
  hotelsTotal: number;
  hotelsSuccess: number;
  hotelsFailed: number;
  duration: number; // ms
  errors: SyncError[];
}

export interface SyncError {
  hotelId: string;
  hotelName?: string;
  source: string;
  errorType: string;
  errorMessage: string;
}

export interface SyncOptions {
  triggeredBy: string; // user_id or 'cron'
  jobType: 'scheduled' | 'manual' | 'bulk';
  hotelIds?: string[]; // Optional: specific hotels to sync
}

// Sync interval in hours (default: 24 hours)
const DEFAULT_SYNC_INTERVAL_HOURS = 24;

/**
 * Get hotels that need syncing (have linked sources and haven't synced recently)
 */
export async function getHotelsDueForSync(limit: number = 100): Promise<Array<{
  hotelId: string;
  hotelName: string;
  sources: Array<{ source: string; externalId: string }>;
}>> {
  const result = await query(
    `SELECT 
       h.id as hotel_id,
       h.name as hotel_name,
       json_agg(json_build_object(
         'source', hrs.source,
         'externalId', hrs.external_id
       )) as sources
     FROM hotels h
     INNER JOIN hotel_review_sources hrs ON h.id = hrs.hotel_id
     WHERE (hrs.next_sync_at IS NULL OR hrs.next_sync_at <= NOW())
       AND (hrs.sync_error_count < 3 OR hrs.last_sync_at < NOW() - INTERVAL '7 days')
     GROUP BY h.id, h.name
     ORDER BY MIN(COALESCE(hrs.last_sync_at, '1970-01-01')) ASC
     LIMIT $1`,
    [limit]
  );
  
  return result.rows.map(row => ({
    hotelId: row.hotel_id,
    hotelName: row.hotel_name,
    sources: row.sources,
  }));
}

/**
 * Sync reviews and ratings for a single hotel
 */
export async function syncHotelReviews(
  hotelId: string,
  sources: Array<{ source: string; externalId: string }>,
  jobId?: string
): Promise<{ success: boolean; errors: SyncError[] }> {
  const errors: SyncError[] = [];
  let anySuccess = false;
  
  for (const { source, externalId } of sources) {
    try {
      if (source === 'google') {
        await syncGoogleReviews(hotelId, externalId);
        anySuccess = true;
        
        // Update sync status
        await query(
          `UPDATE hotel_review_sources 
           SET last_sync_at = NOW(),
               last_sync_status = 'success',
               sync_error_message = NULL,
               sync_error_count = 0,
               next_sync_at = NOW() + INTERVAL '${DEFAULT_SYNC_INTERVAL_HOURS} hours'
           WHERE hotel_id = $1 AND source = $2`,
          [hotelId, source]
        );
      } else if (source === 'tripadvisor') {
        // TODO: Implement TripAdvisor sync
        console.log(`TripAdvisor sync not yet implemented for hotel ${hotelId}`);
      }
    } catch (error: any) {
      const syncError: SyncError = {
        hotelId,
        source,
        errorType: error.name || 'SyncError',
        errorMessage: error.message || 'Unknown error',
      };
      errors.push(syncError);
      
      // Update sync status with error
      await query(
        `UPDATE hotel_review_sources 
         SET last_sync_at = NOW(),
             last_sync_status = 'failed',
             sync_error_message = $3,
             sync_error_count = COALESCE(sync_error_count, 0) + 1,
             next_sync_at = NOW() + INTERVAL '${DEFAULT_SYNC_INTERVAL_HOURS * 2} hours'
         WHERE hotel_id = $1 AND source = $2`,
        [hotelId, source, syncError.errorMessage]
      );
      
      // Log error to sync_errors table
      if (jobId) {
        await query(
          `INSERT INTO review_sync_errors (job_id, hotel_id, source, error_type, error_message)
           VALUES ($1, $2, $3, $4, $5)`,
          [jobId, hotelId, source, syncError.errorType, syncError.errorMessage]
        );
      }
    }
  }
  
  // Recompute Eywa Score if any source synced successfully
  if (anySuccess) {
    try {
      await computeAndStoreEywaScore(hotelId);
    } catch (error: any) {
      console.error(`Error computing Eywa score for hotel ${hotelId}:`, error);
    }
  }
  
  return {
    success: anySuccess && errors.length === 0,
    errors,
  };
}

/**
 * Sync Google Places reviews and ratings
 */
async function syncGoogleReviews(hotelId: string, placeId: string): Promise<void> {
  const details = await googlePlaces.getPlaceDetails(placeId);
  
  if (!details) {
    throw new Error(`Place not found: ${placeId}`);
  }
  
  // Store rating
  await query(
    `INSERT INTO hotel_ratings (hotel_id, source, rating, review_count, fetched_at)
     VALUES ($1, 'google', $2, $3, NOW())
     ON CONFLICT (hotel_id, source, DATE(fetched_at))
     DO UPDATE SET rating = $2, review_count = $3, fetched_at = NOW()`,
    [hotelId, details.rating, details.user_ratings_total]
  );
  
  // Store reviews (delta sync - only new reviews)
  for (const review of details.reviews) {
    const publishedAt = review.time ? new Date(review.time * 1000) : null;
    const externalReviewId = `google_${review.time}`;
    
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
        externalReviewId,
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

/**
 * Compute and store Eywa score for a hotel
 */
async function computeAndStoreEywaScore(hotelId: string): Promise<void> {
  // Get latest ratings from each source
  const ratingsResult = await query(
    `SELECT DISTINCT ON (source) source, rating, review_count
     FROM hotel_ratings
     WHERE hotel_id = $1
     ORDER BY source, fetched_at DESC`,
    [hotelId]
  );

  if (ratingsResult.rows.length === 0) {
    return;
  }

  // Build sources array
  const sources: eywaScore.RatingSource[] = ratingsResult.rows.map(r => ({
    source: r.source as 'google' | 'tripadvisor',
    rating: parseFloat(r.rating),
    reviewCount: r.review_count,
  }));

  // Calculate score
  const scoreResult = eywaScore.calculateEywaScore(sources);

  // Get previous score for trend calculation
  const previousResult = await query(
    `SELECT eywa_score FROM hotel_eywa_scores 
     WHERE hotel_id = $1 
     ORDER BY computed_at DESC 
     LIMIT 1`,
    [hotelId]
  );
  
  const previousScore = previousResult.rows[0]?.eywa_score 
    ? parseFloat(previousResult.rows[0].eywa_score) 
    : null;

  const trendResult = eywaScore.calculateTrend(scoreResult.eywaScore, previousScore);

  // Store the new score
  await query(
    `INSERT INTO hotel_eywa_scores (
       hotel_id, eywa_score, google_rating, google_weight, google_confidence,
       tripadvisor_rating, tripadvisor_weight, tripadvisor_confidence,
       trend, trend_delta, computed_at
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())`,
    [
      hotelId,
      scoreResult.eywaScore,
      scoreResult.googleRating,
      scoreResult.googleWeight,
      scoreResult.googleConfidence,
      scoreResult.tripadvisorRating,
      scoreResult.tripadvisorWeight,
      scoreResult.tripadvisorConfidence,
      trendResult.trend,
      trendResult.delta,
    ]
  );
}

/**
 * Run a full sync job for all hotels due for sync
 */
export async function runSyncJob(options: SyncOptions): Promise<SyncJobResult> {
  const startTime = Date.now();
  const allErrors: SyncError[] = [];
  let hotelsSuccess = 0;
  let hotelsFailed = 0;
  
  // Create job record
  const jobResult = await query(
    `INSERT INTO review_sync_jobs (job_type, status, triggered_by, details)
     VALUES ($1, 'running', $2, $3)
     RETURNING id`,
    [options.jobType, options.triggeredBy, JSON.stringify({ hotelIds: options.hotelIds })]
  );
  const jobId = jobResult.rows[0].id;
  
  try {
    // Get hotels to sync
    let hotelsToSync: Array<{ hotelId: string; hotelName: string; sources: any[] }>;
    
    if (options.hotelIds && options.hotelIds.length > 0) {
      // Sync specific hotels
      const result = await query(
        `SELECT 
           h.id as hotel_id,
           h.name as hotel_name,
           json_agg(json_build_object(
             'source', hrs.source,
             'externalId', hrs.external_id
           )) as sources
         FROM hotels h
         INNER JOIN hotel_review_sources hrs ON h.id = hrs.hotel_id
         WHERE h.id = ANY($1)
         GROUP BY h.id, h.name`,
        [options.hotelIds]
      );
      hotelsToSync = result.rows.map(row => ({
        hotelId: row.hotel_id,
        hotelName: row.hotel_name,
        sources: row.sources,
      }));
    } else {
      // Get all hotels due for sync
      hotelsToSync = await getHotelsDueForSync(100);
    }
    
    // Update job with total count
    await query(
      `UPDATE review_sync_jobs SET hotels_total = $1 WHERE id = $2`,
      [hotelsToSync.length, jobId]
    );
    
    // Sync each hotel
    for (const hotel of hotelsToSync) {
      const result = await syncHotelReviews(hotel.hotelId, hotel.sources, jobId);
      
      if (result.success) {
        hotelsSuccess++;
      } else {
        hotelsFailed++;
        // Add hotel name to errors
        for (const error of result.errors) {
          error.hotelName = hotel.hotelName;
        }
        allErrors.push(...result.errors);
      }
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Determine final status
    const status: 'completed' | 'failed' | 'partial' = 
      hotelsFailed === 0 ? 'completed' :
      hotelsSuccess === 0 ? 'failed' : 'partial';
    
    // Update job record
    await query(
      `UPDATE review_sync_jobs 
       SET status = $1, completed_at = NOW(), 
           hotels_success = $2, hotels_failed = $3
       WHERE id = $4`,
      [status, hotelsSuccess, hotelsFailed, jobId]
    );
    
    return {
      jobId,
      status,
      hotelsTotal: hotelsToSync.length,
      hotelsSuccess,
      hotelsFailed,
      duration: Date.now() - startTime,
      errors: allErrors,
    };
  } catch (error: any) {
    // Update job as failed
    await query(
      `UPDATE review_sync_jobs 
       SET status = 'failed', completed_at = NOW(), 
           error_message = $1, hotels_success = $2, hotels_failed = $3
       WHERE id = $4`,
      [error.message, hotelsSuccess, hotelsFailed, jobId]
    );
    
    throw error;
  }
}

/**
 * Get recent sync jobs
 */
export async function getRecentSyncJobs(limit: number = 10): Promise<any[]> {
  const result = await query(
    `SELECT 
       id, job_type, status, started_at, completed_at,
       hotels_total, hotels_success, hotels_failed,
       triggered_by, error_message
     FROM review_sync_jobs
     ORDER BY started_at DESC
     LIMIT $1`,
    [limit]
  );
  return result.rows;
}

/**
 * Get sync errors for a job
 */
export async function getSyncJobErrors(jobId: string): Promise<any[]> {
  const result = await query(
    `SELECT 
       rse.*, h.name as hotel_name
     FROM review_sync_errors rse
     LEFT JOIN hotels h ON rse.hotel_id = h.id
     WHERE rse.job_id = $1
     ORDER BY rse.created_at DESC`,
    [jobId]
  );
  return result.rows;
}

/**
 * Get sync status for a hotel
 */
export async function getHotelSyncStatus(hotelId: string): Promise<any> {
  const result = await query(
    `SELECT 
       source, external_id, name, is_verified,
       last_sync_at, last_sync_status, sync_error_message,
       sync_error_count, next_sync_at
     FROM hotel_review_sources
     WHERE hotel_id = $1`,
    [hotelId]
  );
  return result.rows;
}
