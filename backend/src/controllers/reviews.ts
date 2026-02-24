/**
 * Reviews & Ratings Controller
 * 
 * Handles hotel reviews and ratings aggregation from multiple sources.
 */

import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { query } from '../utils/db.js';
import * as googlePlaces from '../services/google-places.js';
import * as tripAdvisor from '../services/tripadvisor.js';
import * as eywaScore from '../services/eywa-score.js';

/**
 * GET /api/hotels/:id/ratings
 * Returns aggregated ratings and Eywa score for a hotel
 */
export const getRatings = async (req: AuthRequest, res: Response) => {
  try {
    const hotelId = req.params.id;

    // Verify the hotel belongs to the authenticated user
    if (req.user?.hotel_id !== hotelId) {
      return res.status(403).json({ error: 'Access denied to this hotel' });
    }

    // Get latest Eywa score
    const eywaResult = await query(
      `SELECT * FROM hotel_eywa_scores 
       WHERE hotel_id = $1 
       ORDER BY computed_at DESC 
       LIMIT 1`,
      [hotelId]
    );

    // Get latest ratings from each source
    const ratingsResult = await query(
      `SELECT DISTINCT ON (source) *
       FROM hotel_ratings
       WHERE hotel_id = $1
       ORDER BY source, fetched_at DESC`,
      [hotelId]
    );

    // Format sources
    const sources: Record<string, any> = {};
    for (const rating of ratingsResult.rows) {
      sources[rating.source] = {
        rating: parseFloat(rating.rating),
        reviewCount: rating.review_count,
        ranking: rating.ranking,
        rankingContext: rating.ranking_context,
        lastUpdated: rating.fetched_at,
      };
    }

    const eywaData = eywaResult.rows[0];
    
    res.json({
      hotelId,
      eywaScore: eywaData ? parseFloat(eywaData.eywa_score) : null,
      trend: eywaData?.trend || null,
      trendDelta: eywaData?.trend_delta ? parseFloat(eywaData.trend_delta) : null,
      computedAt: eywaData?.computed_at || null,
      sources,
    });
  } catch (err: any) {
    console.error('Error fetching ratings:', err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * GET /api/hotels/:id/reviews
 * Returns reviews for a hotel
 */
export const getReviews = async (req: AuthRequest, res: Response) => {
  try {
    const hotelId = req.params.id;

    // Verify the hotel belongs to the authenticated user
    if (req.user?.hotel_id !== hotelId) {
      return res.status(403).json({ error: 'Access denied to this hotel' });
    }

    // Parse query params
    const source = req.query.source as string || 'all';
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);
    const language = req.query.language as string;

    // Build query
    let sql = `SELECT * FROM hotel_reviews WHERE hotel_id = $1`;
    const params: any[] = [hotelId];
    let paramIndex = 2;

    if (source !== 'all') {
      sql += ` AND source = $${paramIndex}`;
      params.push(source);
      paramIndex++;
    }

    if (language) {
      sql += ` AND language = $${paramIndex}`;
      params.push(language);
      paramIndex++;
    }

    sql += ` ORDER BY published_at DESC NULLS LAST, fetched_at DESC LIMIT $${paramIndex}`;
    params.push(limit);

    const reviewsResult = await query(sql, params);

    // Get total count
    let countSql = `SELECT COUNT(*) FROM hotel_reviews WHERE hotel_id = $1`;
    const countParams: any[] = [hotelId];
    if (source !== 'all') {
      countSql += ` AND source = $2`;
      countParams.push(source);
    }
    const countResult = await query(countSql, countParams);

    res.json({
      hotelId,
      reviews: reviewsResult.rows.map(r => ({
        id: r.id,
        source: r.source,
        author: r.author_name,
        authorUrl: r.author_url,
        profilePhoto: r.profile_photo_url,
        rating: r.rating,
        text: r.text,
        language: r.language,
        relativeTime: r.relative_time_description,
        publishedAt: r.published_at,
        fetchedAt: r.fetched_at,
      })),
      total: parseInt(countResult.rows[0].count),
    });
  } catch (err: any) {
    console.error('Error fetching reviews:', err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * POST /api/hotels/:id/link-reviews
 * Links a hotel to external review sources (Google Places, TripAdvisor)
 */
export const linkReviewSources = async (req: AuthRequest, res: Response) => {
  try {
    const hotelId = req.params.id;

    // Verify the hotel belongs to the authenticated user
    if (req.user?.hotel_id !== hotelId) {
      return res.status(403).json({ error: 'Access denied to this hotel' });
    }

    const { google, tripadvisor } = req.body;
    const linked: Record<string, any> = {};
    const errors: Record<string, string> = {};

    // Get hotel name for verification
    const hotelResult = await query('SELECT name FROM hotels WHERE id = $1', [hotelId]);
    const hotelName = hotelResult.rows[0]?.name || '';

    // Link Google Places
    if (google?.placeId) {
      try {
        // Verify the place_id is valid
        const verification = await googlePlaces.verifyPlaceId(google.placeId, hotelName);
        
        if (!verification.valid) {
          errors.google = 'Invalid Google Place ID';
        } else {
          // Upsert the review source
          await query(
            `INSERT INTO hotel_review_sources (hotel_id, source, external_id, name, is_verified)
             VALUES ($1, 'google', $2, $3, $4)
             ON CONFLICT (hotel_id, source) 
             DO UPDATE SET external_id = $2, name = $3, is_verified = $4, updated_at = NOW()`,
            [hotelId, google.placeId, verification.actualName, verification.matchScore >= 0.7]
          );

          // Fetch initial ratings and reviews
          const details = await googlePlaces.getPlaceDetails(google.placeId);
          if (details) {
            // Store rating
            await storeGoogleRating(hotelId, details);
            // Store reviews
            await storeGoogleReviews(hotelId, details);
          }

          linked.google = {
            placeId: google.placeId,
            name: verification.actualName,
            isVerified: verification.matchScore >= 0.7,
            matchScore: verification.matchScore,
          };
        }
      } catch (err: any) {
        console.error('Error linking Google Places:', err);
        errors.google = err.message;
      }
    }

    // Link TripAdvisor
    if (tripadvisor?.locationId) {
      try {
        if (!tripAdvisor.isTripAdvisorConfigured()) {
          errors.tripadvisor = 'TripAdvisor API not configured';
        } else {
          // Verify the location_id is valid
          const verification = await tripAdvisor.verifyLocationId(tripadvisor.locationId, hotelName);
          
          if (!verification.valid) {
            errors.tripadvisor = 'Invalid TripAdvisor Location ID';
          } else {
            // Upsert the review source
            await query(
              `INSERT INTO hotel_review_sources (hotel_id, source, external_id, name, is_verified)
               VALUES ($1, 'tripadvisor', $2, $3, $4)
               ON CONFLICT (hotel_id, source) 
               DO UPDATE SET external_id = $2, name = $3, is_verified = $4, updated_at = NOW()`,
              [hotelId, tripadvisor.locationId, verification.actualName, verification.matchScore >= 0.7]
            );

            // Fetch initial ratings and reviews
            const { details, reviews } = await tripAdvisor.getFullLocationData(tripadvisor.locationId);
            if (details) {
              // Store rating
              await storeTripAdvisorRating(hotelId, details);
              // Store reviews
              await storeTripAdvisorReviews(hotelId, reviews);
            }

            linked.tripadvisor = {
              locationId: tripadvisor.locationId,
              name: verification.actualName,
              isVerified: verification.matchScore >= 0.7,
              matchScore: verification.matchScore,
            };
          }
        }
      } catch (err: any) {
        console.error('Error linking TripAdvisor:', err);
        errors.tripadvisor = err.message;
      }
    }

    // Recompute Eywa Score if we linked at least one source
    if (Object.keys(linked).length > 0) {
      await computeAndStoreEywaScore(hotelId);
    }

    res.json({
      hotelId,
      linked,
      errors: Object.keys(errors).length > 0 ? errors : undefined,
    });
  } catch (err: any) {
    console.error('Error linking review sources:', err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * POST /api/hotels/:id/refresh-ratings
 * Manually refresh ratings from all linked sources
 */
export const refreshRatings = async (req: AuthRequest, res: Response) => {
  try {
    const hotelId = req.params.id;

    // Verify the hotel belongs to the authenticated user
    if (req.user?.hotel_id !== hotelId) {
      return res.status(403).json({ error: 'Access denied to this hotel' });
    }

    // Get linked sources
    const sourcesResult = await query(
      'SELECT * FROM hotel_review_sources WHERE hotel_id = $1',
      [hotelId]
    );

    const refreshed: string[] = [];
    const errors: Record<string, string> = {};

    for (const source of sourcesResult.rows) {
      try {
        if (source.source === 'google') {
          const details = await googlePlaces.getPlaceDetails(source.external_id);
          if (details) {
            await storeGoogleRating(hotelId, details);
            await storeGoogleReviews(hotelId, details);
            refreshed.push('google');
          }
        } else if (source.source === 'tripadvisor') {
          if (!tripAdvisor.isTripAdvisorConfigured()) {
            errors.tripadvisor = 'TripAdvisor API not configured';
          } else {
            const { details, reviews } = await tripAdvisor.getFullLocationData(source.external_id);
            if (details) {
              await storeTripAdvisorRating(hotelId, details);
              await storeTripAdvisorReviews(hotelId, reviews);
              refreshed.push('tripadvisor');
            }
          }
        }
      } catch (err: any) {
        errors[source.source] = err.message;
      }
    }

    // Recompute Eywa Score
    if (refreshed.length > 0) {
      await computeAndStoreEywaScore(hotelId);
    }

    res.json({
      hotelId,
      refreshed,
      errors: Object.keys(errors).length > 0 ? errors : undefined,
      refreshedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('Error refreshing ratings:', err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * GET /api/hotels/:id/review-sources
 * Returns linked review sources for a hotel
 */
export const getReviewSources = async (req: AuthRequest, res: Response) => {
  try {
    const hotelId = req.params.id;

    // Verify the hotel belongs to the authenticated user
    if (req.user?.hotel_id !== hotelId) {
      return res.status(403).json({ error: 'Access denied to this hotel' });
    }

    const result = await query(
      'SELECT * FROM hotel_review_sources WHERE hotel_id = $1',
      [hotelId]
    );

    res.json({
      hotelId,
      sources: result.rows.map(s => ({
        source: s.source,
        externalId: s.external_id,
        name: s.name,
        isVerified: s.is_verified,
        createdAt: s.created_at,
        updatedAt: s.updated_at,
      })),
      googlePlacesConfigured: googlePlaces.isGooglePlacesConfigured(),
      tripAdvisorConfigured: tripAdvisor.isTripAdvisorConfigured(),
    });
  } catch (err: any) {
    console.error('Error fetching review sources:', err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * POST /api/hotels/:id/search-places
 * Search for matching places on Google and TripAdvisor
 */
export const searchPlaces = async (req: AuthRequest, res: Response) => {
  try {
    const hotelId = req.params.id;

    // Verify the hotel belongs to the authenticated user
    if (req.user?.hotel_id !== hotelId) {
      return res.status(403).json({ error: 'Access denied to this hotel' });
    }

    // Get hotel info
    const hotelResult = await query(
      'SELECT name, city, country FROM hotels WHERE id = $1',
      [hotelId]
    );

    if (hotelResult.rows.length === 0) {
      return res.status(404).json({ error: 'Hotel not found' });
    }

    const hotel = hotelResult.rows[0];
    const searchQuery = `${hotel.name} ${hotel.city} ${hotel.country}`;
    
    const results: Record<string, any> = {
      query: searchQuery,
      google: [],
      tripadvisor: [],
    };
    const errors: Record<string, string> = {};

    // Search Google Places
    if (googlePlaces.isGooglePlacesConfigured()) {
      try {
        results.google = await googlePlaces.searchHotel(hotel.name, hotel.city, hotel.country);
      } catch (err: any) {
        errors.google = err.message;
      }
    } else {
      errors.google = 'Google Places API not configured';
    }

    // Search TripAdvisor
    if (tripAdvisor.isTripAdvisorConfigured()) {
      try {
        results.tripadvisor = await tripAdvisor.searchHotel(hotel.name, hotel.city, hotel.country);
      } catch (err: any) {
        errors.tripadvisor = err.message;
      }
    } else {
      errors.tripadvisor = 'TripAdvisor API not configured';
    }

    res.json({
      hotelId,
      ...results,
      errors: Object.keys(errors).length > 0 ? errors : undefined,
    });
  } catch (err: any) {
    console.error('Error searching places:', err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * GET /api/hotels/:id/competitors
 * Returns nearby competitor hotels with their ratings
 */
export const getCompetitors = async (req: AuthRequest, res: Response) => {
  try {
    const hotelId = req.params.id;

    // Verify the hotel belongs to the authenticated user
    if (req.user?.hotel_id !== hotelId) {
      return res.status(403).json({ error: 'Access denied to this hotel' });
    }

    // Get hotel info
    const hotelResult = await query(
      'SELECT name, city, country FROM hotels WHERE id = $1',
      [hotelId]
    );

    if (hotelResult.rows.length === 0) {
      return res.status(404).json({ error: 'Hotel not found' });
    }

    const hotel = hotelResult.rows[0];
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 25);
    const radius = parseInt(req.query.radius as string) || 5; // km

    // Get hotel's own ratings for comparison
    const ownRatingsResult = await query(
      `SELECT DISTINCT ON (source) source, rating, review_count, ranking, ranking_context
       FROM hotel_ratings
       WHERE hotel_id = $1
       ORDER BY source, fetched_at DESC`,
      [hotelId]
    );

    const ownRatings: Record<string, any> = {};
    for (const r of ownRatingsResult.rows) {
      ownRatings[r.source] = {
        rating: parseFloat(r.rating),
        reviewCount: r.review_count,
        ranking: r.ranking,
        rankingContext: r.ranking_context,
      };
    }

    // Get Eywa score
    const eywaResult = await query(
      `SELECT eywa_score FROM hotel_eywa_scores 
       WHERE hotel_id = $1 
       ORDER BY computed_at DESC 
       LIMIT 1`,
      [hotelId]
    );

    const competitors: any[] = [];
    const errors: Record<string, string> = {};

    // Search for nearby competitors on TripAdvisor
    if (tripAdvisor.isTripAdvisorConfigured()) {
      try {
        const locationQuery = `hotels in ${hotel.city} ${hotel.country}`;
        const nearbyResults = await tripAdvisor.searchNearbyHotels(locationQuery, radius);
        
        // Get details for each competitor (limit API calls)
        const limitedResults = nearbyResults.slice(0, limit);
        
        for (const result of limitedResults) {
          try {
            // Skip our own hotel if it appears in results
            if (result.name.toLowerCase() === hotel.name.toLowerCase()) {
              continue;
            }

            const details = await tripAdvisor.getLocationDetails(result.location_id);
            if (details) {
              competitors.push({
                name: details.name,
                source: 'tripadvisor',
                locationId: details.location_id,
                rating: details.rating,
                reviewCount: details.num_reviews,
                ranking: details.ranking_position,
                rankingTotal: details.ranking_total,
                rankingContext: details.ranking,
                webUrl: details.web_url,
                address: details.address_obj.address_string,
              });
            }
          } catch (err: any) {
            console.error(`Error fetching competitor details for ${result.location_id}:`, err);
          }
        }
      } catch (err: any) {
        errors.tripadvisor = err.message;
      }
    } else {
      errors.tripadvisor = 'TripAdvisor API not configured';
    }

    // Sort competitors by rating
    competitors.sort((a, b) => (b.rating || 0) - (a.rating || 0));

    res.json({
      hotelId,
      hotelName: hotel.name,
      location: `${hotel.city}, ${hotel.country}`,
      ownRatings,
      eywaScore: eywaResult.rows[0]?.eywa_score ? parseFloat(eywaResult.rows[0].eywa_score) : null,
      competitors: competitors.slice(0, limit),
      competitorCount: competitors.length,
      errors: Object.keys(errors).length > 0 ? errors : undefined,
    });
  } catch (err: any) {
    console.error('Error fetching competitors:', err);
    res.status(500).json({ error: err.message });
  }
};

// --- Helper Functions ---

async function storeGoogleRating(hotelId: string, details: googlePlaces.GooglePlaceDetails) {
  await query(
    `INSERT INTO hotel_ratings (hotel_id, source, rating, review_count, fetched_at)
     VALUES ($1, 'google', $2, $3, NOW())
     ON CONFLICT (hotel_id, source, DATE(fetched_at))
     DO UPDATE SET rating = $2, review_count = $3, fetched_at = NOW()`,
    [hotelId, details.rating, details.user_ratings_total]
  );
}

async function storeGoogleReviews(hotelId: string, details: googlePlaces.GooglePlaceDetails) {
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
        `google_${review.time}`, // Use timestamp as external ID
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

async function storeTripAdvisorRating(hotelId: string, details: tripAdvisor.TripAdvisorDetails) {
  const rankingInfo = tripAdvisor.parseRankingString(details.ranking);
  
  await query(
    `INSERT INTO hotel_ratings (hotel_id, source, rating, review_count, ranking, ranking_context, fetched_at)
     VALUES ($1, 'tripadvisor', $2, $3, $4, $5, NOW())
     ON CONFLICT (hotel_id, source, DATE(fetched_at))
     DO UPDATE SET rating = $2, review_count = $3, ranking = $4, ranking_context = $5, fetched_at = NOW()`,
    [hotelId, details.rating, details.num_reviews, rankingInfo.position, rankingInfo.context]
  );
}

async function storeTripAdvisorReviews(hotelId: string, reviews: tripAdvisor.TripAdvisorReview[]) {
  for (const review of reviews) {
    const publishedAt = review.published_date ? new Date(review.published_date) : null;
    
    await query(
      `INSERT INTO hotel_reviews (
         hotel_id, source, external_review_id, author_name, author_url,
         profile_photo_url, rating, text, language, relative_time_description, published_at
       ) VALUES ($1, 'tripadvisor', $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (hotel_id, source, external_review_id) 
       DO UPDATE SET 
         author_name = $3, rating = $6, text = $7, 
         relative_time_description = $9, fetched_at = NOW()`,
      [
        hotelId,
        `ta_${review.id}`, // Use TripAdvisor review ID
        review.user.username,
        review.url,
        review.user.avatar?.small?.url || '',
        review.rating,
        review.text,
        review.lang,
        review.travel_date || '',
        publishedAt,
      ]
    );
  }
}

async function computeAndStoreEywaScore(hotelId: string) {
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
