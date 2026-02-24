"use strict";
/**
 * Review Sync Service
 *
 * Handles scheduled and manual syncing of hotel reviews and ratings
 * from external sources (Google Places, TripAdvisor).
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getHotelsDueForSync = getHotelsDueForSync;
exports.syncHotelReviews = syncHotelReviews;
exports.runSyncJob = runSyncJob;
exports.getRecentSyncJobs = getRecentSyncJobs;
exports.getSyncJobErrors = getSyncJobErrors;
exports.getHotelSyncStatus = getHotelSyncStatus;
const db_js_1 = require("../utils/db.js");
const googlePlaces = __importStar(require("./google-places.js"));
const eywaScore = __importStar(require("./eywa-score.js"));
// Sync interval in hours (default: 24 hours)
const DEFAULT_SYNC_INTERVAL_HOURS = 24;
/**
 * Get hotels that need syncing (have linked sources and haven't synced recently)
 */
async function getHotelsDueForSync(limit = 100) {
    const result = await (0, db_js_1.query)(`SELECT 
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
     LIMIT $1`, [limit]);
    return result.rows.map(row => ({
        hotelId: row.hotel_id,
        hotelName: row.hotel_name,
        sources: row.sources,
    }));
}
/**
 * Sync reviews and ratings for a single hotel
 */
async function syncHotelReviews(hotelId, sources, jobId) {
    const errors = [];
    let anySuccess = false;
    for (const { source, externalId } of sources) {
        try {
            if (source === 'google') {
                await syncGoogleReviews(hotelId, externalId);
                anySuccess = true;
                // Update sync status
                await (0, db_js_1.query)(`UPDATE hotel_review_sources 
           SET last_sync_at = NOW(),
               last_sync_status = 'success',
               sync_error_message = NULL,
               sync_error_count = 0,
               next_sync_at = NOW() + INTERVAL '${DEFAULT_SYNC_INTERVAL_HOURS} hours'
           WHERE hotel_id = $1 AND source = $2`, [hotelId, source]);
            }
            else if (source === 'tripadvisor') {
                // TODO: Implement TripAdvisor sync
                console.log(`TripAdvisor sync not yet implemented for hotel ${hotelId}`);
            }
        }
        catch (error) {
            const syncError = {
                hotelId,
                source,
                errorType: error.name || 'SyncError',
                errorMessage: error.message || 'Unknown error',
            };
            errors.push(syncError);
            // Update sync status with error
            await (0, db_js_1.query)(`UPDATE hotel_review_sources 
         SET last_sync_at = NOW(),
             last_sync_status = 'failed',
             sync_error_message = $3,
             sync_error_count = COALESCE(sync_error_count, 0) + 1,
             next_sync_at = NOW() + INTERVAL '${DEFAULT_SYNC_INTERVAL_HOURS * 2} hours'
         WHERE hotel_id = $1 AND source = $2`, [hotelId, source, syncError.errorMessage]);
            // Log error to sync_errors table
            if (jobId) {
                await (0, db_js_1.query)(`INSERT INTO review_sync_errors (job_id, hotel_id, source, error_type, error_message)
           VALUES ($1, $2, $3, $4, $5)`, [jobId, hotelId, source, syncError.errorType, syncError.errorMessage]);
            }
        }
    }
    // Recompute Eywa Score if any source synced successfully
    if (anySuccess) {
        try {
            await computeAndStoreEywaScore(hotelId);
        }
        catch (error) {
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
async function syncGoogleReviews(hotelId, placeId) {
    const details = await googlePlaces.getPlaceDetails(placeId);
    if (!details) {
        throw new Error(`Place not found: ${placeId}`);
    }
    // Store rating
    await (0, db_js_1.query)(`INSERT INTO hotel_ratings (hotel_id, source, rating, review_count, fetched_at)
     VALUES ($1, 'google', $2, $3, NOW())
     ON CONFLICT (hotel_id, source, DATE(fetched_at))
     DO UPDATE SET rating = $2, review_count = $3, fetched_at = NOW()`, [hotelId, details.rating, details.user_ratings_total]);
    // Store reviews (delta sync - only new reviews)
    for (const review of details.reviews) {
        const publishedAt = review.time ? new Date(review.time * 1000) : null;
        const externalReviewId = `google_${review.time}`;
        await (0, db_js_1.query)(`INSERT INTO hotel_reviews (
         hotel_id, source, external_review_id, author_name, author_url,
         profile_photo_url, rating, text, language, relative_time_description, published_at
       ) VALUES ($1, 'google', $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (hotel_id, source, external_review_id) 
       DO UPDATE SET 
         author_name = $3, rating = $6, text = $7, 
         relative_time_description = $9, fetched_at = NOW()`, [
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
        ]);
    }
}
/**
 * Compute and store Eywa score for a hotel
 */
async function computeAndStoreEywaScore(hotelId) {
    // Get latest ratings from each source
    const ratingsResult = await (0, db_js_1.query)(`SELECT DISTINCT ON (source) source, rating, review_count
     FROM hotel_ratings
     WHERE hotel_id = $1
     ORDER BY source, fetched_at DESC`, [hotelId]);
    if (ratingsResult.rows.length === 0) {
        return;
    }
    // Build sources array
    const sources = ratingsResult.rows.map(r => ({
        source: r.source,
        rating: parseFloat(r.rating),
        reviewCount: r.review_count,
    }));
    // Calculate score
    const scoreResult = eywaScore.calculateEywaScore(sources);
    // Get previous score for trend calculation
    const previousResult = await (0, db_js_1.query)(`SELECT eywa_score FROM hotel_eywa_scores 
     WHERE hotel_id = $1 
     ORDER BY computed_at DESC 
     LIMIT 1`, [hotelId]);
    const previousScore = previousResult.rows[0]?.eywa_score
        ? parseFloat(previousResult.rows[0].eywa_score)
        : null;
    const trendResult = eywaScore.calculateTrend(scoreResult.eywaScore, previousScore);
    // Store the new score
    await (0, db_js_1.query)(`INSERT INTO hotel_eywa_scores (
       hotel_id, eywa_score, google_rating, google_weight, google_confidence,
       tripadvisor_rating, tripadvisor_weight, tripadvisor_confidence,
       trend, trend_delta, computed_at
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())`, [
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
    ]);
}
/**
 * Run a full sync job for all hotels due for sync
 */
async function runSyncJob(options) {
    const startTime = Date.now();
    const allErrors = [];
    let hotelsSuccess = 0;
    let hotelsFailed = 0;
    // Create job record
    const jobResult = await (0, db_js_1.query)(`INSERT INTO review_sync_jobs (job_type, status, triggered_by, details)
     VALUES ($1, 'running', $2, $3)
     RETURNING id`, [options.jobType, options.triggeredBy, JSON.stringify({ hotelIds: options.hotelIds })]);
    const jobId = jobResult.rows[0].id;
    try {
        // Get hotels to sync
        let hotelsToSync;
        if (options.hotelIds && options.hotelIds.length > 0) {
            // Sync specific hotels
            const result = await (0, db_js_1.query)(`SELECT 
           h.id as hotel_id,
           h.name as hotel_name,
           json_agg(json_build_object(
             'source', hrs.source,
             'externalId', hrs.external_id
           )) as sources
         FROM hotels h
         INNER JOIN hotel_review_sources hrs ON h.id = hrs.hotel_id
         WHERE h.id = ANY($1)
         GROUP BY h.id, h.name`, [options.hotelIds]);
            hotelsToSync = result.rows.map(row => ({
                hotelId: row.hotel_id,
                hotelName: row.hotel_name,
                sources: row.sources,
            }));
        }
        else {
            // Get all hotels due for sync
            hotelsToSync = await getHotelsDueForSync(100);
        }
        // Update job with total count
        await (0, db_js_1.query)(`UPDATE review_sync_jobs SET hotels_total = $1 WHERE id = $2`, [hotelsToSync.length, jobId]);
        // Sync each hotel
        for (const hotel of hotelsToSync) {
            const result = await syncHotelReviews(hotel.hotelId, hotel.sources, jobId);
            if (result.success) {
                hotelsSuccess++;
            }
            else {
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
        const status = hotelsFailed === 0 ? 'completed' :
            hotelsSuccess === 0 ? 'failed' : 'partial';
        // Update job record
        await (0, db_js_1.query)(`UPDATE review_sync_jobs 
       SET status = $1, completed_at = NOW(), 
           hotels_success = $2, hotels_failed = $3
       WHERE id = $4`, [status, hotelsSuccess, hotelsFailed, jobId]);
        return {
            jobId,
            status,
            hotelsTotal: hotelsToSync.length,
            hotelsSuccess,
            hotelsFailed,
            duration: Date.now() - startTime,
            errors: allErrors,
        };
    }
    catch (error) {
        // Update job as failed
        await (0, db_js_1.query)(`UPDATE review_sync_jobs 
       SET status = 'failed', completed_at = NOW(), 
           error_message = $1, hotels_success = $2, hotels_failed = $3
       WHERE id = $4`, [error.message, hotelsSuccess, hotelsFailed, jobId]);
        throw error;
    }
}
/**
 * Get recent sync jobs
 */
async function getRecentSyncJobs(limit = 10) {
    const result = await (0, db_js_1.query)(`SELECT 
       id, job_type, status, started_at, completed_at,
       hotels_total, hotels_success, hotels_failed,
       triggered_by, error_message
     FROM review_sync_jobs
     ORDER BY started_at DESC
     LIMIT $1`, [limit]);
    return result.rows;
}
/**
 * Get sync errors for a job
 */
async function getSyncJobErrors(jobId) {
    const result = await (0, db_js_1.query)(`SELECT 
       rse.*, h.name as hotel_name
     FROM review_sync_errors rse
     LEFT JOIN hotels h ON rse.hotel_id = h.id
     WHERE rse.job_id = $1
     ORDER BY rse.created_at DESC`, [jobId]);
    return result.rows;
}
/**
 * Get sync status for a hotel
 */
async function getHotelSyncStatus(hotelId) {
    const result = await (0, db_js_1.query)(`SELECT 
       source, external_id, name, is_verified,
       last_sync_at, last_sync_status, sync_error_message,
       sync_error_count, next_sync_at
     FROM hotel_review_sources
     WHERE hotel_id = $1`, [hotelId]);
    return result.rows;
}
