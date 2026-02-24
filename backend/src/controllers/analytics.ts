/**
 * Analytics Controller
 * 
 * Provides endpoints for:
 * - Dashboard widgets (summary, timeline, sentiment)
 * - Trend tracking
 * - Competitor analysis
 * - Market positioning
 * - Portfolio-level stats
 */

import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { query } from '../utils/db.js';
import * as analytics from '../services/analytics.js';

/**
 * GET /api/hotels/:id/analytics/summary
 * Returns all key metrics for dashboard display
 */
export const getSummary = async (req: AuthRequest, res: Response) => {
  try {
    const hotelId = req.params.id;

    // Verify the hotel belongs to the authenticated user
    if (req.user?.hotel_id !== hotelId) {
      return res.status(403).json({ error: 'Access denied to this hotel' });
    }

    // Get current Eywa score
    const scoreResult = await query(
      `SELECT * FROM hotel_eywa_scores 
       WHERE hotel_id = $1 
       ORDER BY computed_at DESC 
       LIMIT 1`,
      [hotelId]
    );

    // Get historical scores for trend calculation
    const historicalScores = await query(
      `SELECT eywa_score as score, computed_at as date 
       FROM hotel_eywa_scores 
       WHERE hotel_id = $1 
       AND computed_at >= NOW() - INTERVAL '90 days'
       ORDER BY computed_at ASC`,
      [hotelId]
    );

    // Get review counts
    const reviewStats = await query(
      `SELECT 
         COUNT(*) as total_reviews,
         COUNT(CASE WHEN rating >= 4 THEN 1 END) as positive,
         COUNT(CASE WHEN rating = 3 THEN 1 END) as neutral,
         COUNT(CASE WHEN rating < 3 THEN 1 END) as negative,
         AVG(rating) as avg_rating,
         COUNT(CASE WHEN published_at >= NOW() - INTERVAL '7 days' THEN 1 END) as last_7d,
         COUNT(CASE WHEN published_at >= NOW() - INTERVAL '30 days' THEN 1 END) as last_30d
       FROM hotel_reviews 
       WHERE hotel_id = $1`,
      [hotelId]
    );

    // Get source ratings
    const sourceRatings = await query(
      `SELECT DISTINCT ON (source) source, rating, review_count, fetched_at
       FROM hotel_ratings
       WHERE hotel_id = $1
       ORDER BY source, fetched_at DESC`,
      [hotelId]
    );

    // Calculate trends
    const scores = historicalScores.rows.map(r => ({
      score: parseFloat(r.score),
      date: new Date(r.date),
    }));

    const trend7d = analytics.calculateTrendFromScores(scores, '7d');
    const trend30d = analytics.calculateTrendFromScores(scores, '30d');
    const trend90d = analytics.calculateTrendFromScores(scores, '90d');

    const currentScore = scoreResult.rows[0];
    const stats = reviewStats.rows[0];

    res.json({
      hotelId,
      currentScore: {
        eywaScore: currentScore ? parseFloat(currentScore.eywa_score) : null,
        trend: currentScore?.trend || 'stable',
        trendDelta: currentScore?.trend_delta ? parseFloat(currentScore.trend_delta) : 0,
        computedAt: currentScore?.computed_at,
      },
      trends: {
        '7d': trend7d,
        '30d': trend30d,
        '90d': trend90d,
      },
      reviews: {
        total: parseInt(stats.total_reviews) || 0,
        positive: parseInt(stats.positive) || 0,
        neutral: parseInt(stats.neutral) || 0,
        negative: parseInt(stats.negative) || 0,
        averageRating: stats.avg_rating ? parseFloat(stats.avg_rating).toFixed(2) : null,
        last7Days: parseInt(stats.last_7d) || 0,
        last30Days: parseInt(stats.last_30d) || 0,
      },
      sources: sourceRatings.rows.reduce((acc, r) => {
        acc[r.source] = {
          rating: parseFloat(r.rating),
          reviewCount: r.review_count,
          lastUpdated: r.fetched_at,
        };
        return acc;
      }, {} as Record<string, any>),
    });
  } catch (err: any) {
    console.error('Error fetching analytics summary:', err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * GET /api/hotels/:id/analytics/timeline
 * Returns score history for chart display
 */
export const getTimeline = async (req: AuthRequest, res: Response) => {
  try {
    const hotelId = req.params.id;

    // Verify the hotel belongs to the authenticated user
    if (req.user?.hotel_id !== hotelId) {
      return res.status(403).json({ error: 'Access denied to this hotel' });
    }

    const period = (req.query.period as analytics.TrendPeriod) || '30d';
    const periodDays = parseInt(period);

    // Get score history
    const scoresResult = await query(
      `SELECT eywa_score as score, computed_at as date 
       FROM hotel_eywa_scores 
       WHERE hotel_id = $1 
       AND computed_at >= NOW() - INTERVAL '${periodDays} days'
       ORDER BY computed_at ASC`,
      [hotelId]
    );

    // Get review counts per day
    const reviewsResult = await query(
      `SELECT DATE(published_at) as date, COUNT(*) as count, AVG(rating) as avg_rating
       FROM hotel_reviews 
       WHERE hotel_id = $1 
       AND published_at >= NOW() - INTERVAL '${periodDays} days'
       GROUP BY DATE(published_at)
       ORDER BY DATE(published_at) ASC`,
      [hotelId]
    );

    const scores = scoresResult.rows.map(r => ({
      score: parseFloat(r.score),
      date: new Date(r.date),
    }));

    const timelineData = analytics.generateTimelineData(scores, period);

    res.json({
      hotelId,
      period,
      scores: timelineData,
      reviewActivity: reviewsResult.rows.map(r => ({
        date: r.date.toISOString().split('T')[0],
        count: parseInt(r.count),
        avgRating: parseFloat(r.avg_rating).toFixed(2),
      })),
    });
  } catch (err: any) {
    console.error('Error fetching timeline:', err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * GET /api/hotels/:id/analytics/review-sentiment
 * Returns sentiment breakdown of reviews
 */
export const getReviewSentiment = async (req: AuthRequest, res: Response) => {
  try {
    const hotelId = req.params.id;

    // Verify the hotel belongs to the authenticated user
    if (req.user?.hotel_id !== hotelId) {
      return res.status(403).json({ error: 'Access denied to this hotel' });
    }

    const period = (req.query.period as analytics.TrendPeriod) || '30d';
    const periodDays = parseInt(period);

    // Get reviews with ratings
    const reviewsResult = await query(
      `SELECT rating, source, published_at
       FROM hotel_reviews 
       WHERE hotel_id = $1 
       AND published_at >= NOW() - INTERVAL '${periodDays} days'`,
      [hotelId]
    );

    const reviews = reviewsResult.rows.map(r => ({
      rating: r.rating,
      source: r.source,
      publishedAt: r.published_at,
    }));

    const sentiment = analytics.calculateSentiment(reviews);

    // Breakdown by source
    const bySource: Record<string, analytics.SentimentBreakdown> = {};
    const sourceGroups = reviews.reduce((acc, r) => {
      if (!acc[r.source]) acc[r.source] = [];
      acc[r.source].push(r);
      return acc;
    }, {} as Record<string, typeof reviews>);

    for (const [source, sourceReviews] of Object.entries(sourceGroups)) {
      bySource[source] = analytics.calculateSentiment(sourceReviews);
    }

    // Rating distribution
    const ratingDistribution = [1, 2, 3, 4, 5].map(rating => ({
      rating,
      count: reviews.filter(r => r.rating === rating).length,
      percentage: reviews.length > 0 
        ? Math.round((reviews.filter(r => r.rating === rating).length / reviews.length) * 100)
        : 0,
    }));

    res.json({
      hotelId,
      period,
      overall: sentiment,
      bySource,
      ratingDistribution,
    });
  } catch (err: any) {
    console.error('Error fetching sentiment:', err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * GET /api/hotels/:id/analytics/alerts
 * Returns detected alerts for a hotel
 */
export const getAlerts = async (req: AuthRequest, res: Response) => {
  try {
    const hotelId = req.params.id;

    // Verify the hotel belongs to the authenticated user
    if (req.user?.hotel_id !== hotelId) {
      return res.status(403).json({ error: 'Access denied to this hotel' });
    }

    // Get current and previous scores
    const scoresResult = await query(
      `SELECT eywa_score, computed_at 
       FROM hotel_eywa_scores 
       WHERE hotel_id = $1 
       ORDER BY computed_at DESC 
       LIMIT 2`,
      [hotelId]
    );

    // Get recent reviews
    const reviewsResult = await query(
      `SELECT rating, published_at 
       FROM hotel_reviews 
       WHERE hotel_id = $1 
       AND published_at >= NOW() - INTERVAL '7 days'
       ORDER BY published_at DESC`,
      [hotelId]
    );

    // Calculate normal review rate (past 30 days)
    const reviewRateResult = await query(
      `SELECT COUNT(*) as count 
       FROM hotel_reviews 
       WHERE hotel_id = $1 
       AND published_at >= NOW() - INTERVAL '30 days'
       AND published_at < NOW() - INTERVAL '1 day'`,
      [hotelId]
    );

    const normalReviewRate = parseInt(reviewRateResult.rows[0].count) / 29; // reviews per day

    const currentScore = scoresResult.rows[0] ? parseFloat(scoresResult.rows[0].eywa_score) : 0;
    const previousScore = scoresResult.rows[1] ? parseFloat(scoresResult.rows[1].eywa_score) : null;

    const recentReviews = reviewsResult.rows.map(r => ({
      rating: r.rating,
      publishedAt: new Date(r.published_at),
    }));

    const alerts = analytics.detectAlerts(
      currentScore,
      previousScore,
      recentReviews,
      normalReviewRate
    );

    res.json({
      hotelId,
      alerts,
      alertCount: alerts.length,
      highPriority: alerts.filter(a => a.severity === 'high').length,
    });
  } catch (err: any) {
    console.error('Error fetching alerts:', err);
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

    // Get hotel location
    const hotelResult = await query(
      `SELECT city, country FROM hotels WHERE id = $1`,
      [hotelId]
    );

    if (hotelResult.rows.length === 0) {
      return res.status(404).json({ error: 'Hotel not found' });
    }

    const hotel = hotelResult.rows[0];

    // Get competitors in the same city (other hotels with reviews)
    // In production, this would use geolocation for proximity
    const competitorsResult = await query(
      `SELECT 
         h.id, h.name, h.city, h.country,
         es.eywa_score,
         es.trend,
         es.computed_at
       FROM hotels h
       LEFT JOIN LATERAL (
         SELECT * FROM hotel_eywa_scores 
         WHERE hotel_id = h.id 
         ORDER BY computed_at DESC 
         LIMIT 1
       ) es ON true
       WHERE h.city = $1 
       AND h.country = $2 
       AND h.id != $3
       AND es.eywa_score IS NOT NULL
       ORDER BY es.eywa_score DESC NULLS LAST
       LIMIT 10`,
      [hotel.city, hotel.country, hotelId]
    );

    res.json({
      hotelId,
      location: { city: hotel.city, country: hotel.country },
      competitors: competitorsResult.rows.map(c => ({
        id: c.id,
        name: c.name,
        eywaScore: c.eywa_score ? parseFloat(c.eywa_score) : null,
        trend: c.trend,
        lastUpdated: c.computed_at,
      })),
      competitorCount: competitorsResult.rows.length,
    });
  } catch (err: any) {
    console.error('Error fetching competitors:', err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * GET /api/hotels/:id/market-position
 * Returns ranking in local market
 */
export const getMarketPosition = async (req: AuthRequest, res: Response) => {
  try {
    const hotelId = req.params.id;

    // Verify the hotel belongs to the authenticated user
    if (req.user?.hotel_id !== hotelId) {
      return res.status(403).json({ error: 'Access denied to this hotel' });
    }

    // Get hotel's current score and location
    const hotelResult = await query(
      `SELECT h.city, h.country, h.name, es.eywa_score
       FROM hotels h
       LEFT JOIN LATERAL (
         SELECT eywa_score FROM hotel_eywa_scores 
         WHERE hotel_id = h.id 
         ORDER BY computed_at DESC 
         LIMIT 1
       ) es ON true
       WHERE h.id = $1`,
      [hotelId]
    );

    if (hotelResult.rows.length === 0) {
      return res.status(404).json({ error: 'Hotel not found' });
    }

    const hotel = hotelResult.rows[0];
    const hotelScore = hotel.eywa_score ? parseFloat(hotel.eywa_score) : 0;

    // Get competitor scores in the same city
    const competitorScoresResult = await query(
      `SELECT es.eywa_score
       FROM hotels h
       INNER JOIN LATERAL (
         SELECT eywa_score FROM hotel_eywa_scores 
         WHERE hotel_id = h.id 
         ORDER BY computed_at DESC 
         LIMIT 1
       ) es ON true
       WHERE h.city = $1 
       AND h.country = $2 
       AND h.id != $3
       AND es.eywa_score IS NOT NULL`,
      [hotel.city, hotel.country, hotelId]
    );

    const competitorScores = competitorScoresResult.rows.map(r => parseFloat(r.eywa_score));
    const position = analytics.calculateMarketPosition(hotelScore, competitorScores);

    // Get rating from TripAdvisor if available (includes city ranking)
    const tripAdvisorResult = await query(
      `SELECT ranking, ranking_context 
       FROM hotel_ratings 
       WHERE hotel_id = $1 AND source = 'tripadvisor'
       ORDER BY fetched_at DESC 
       LIMIT 1`,
      [hotelId]
    );

    const tripAdvisor = tripAdvisorResult.rows[0];

    res.json({
      hotelId,
      hotelName: hotel.name,
      location: { city: hotel.city, country: hotel.country },
      eywaScore: hotelScore,
      position: {
        eywaRank: position.rank,
        totalInMarket: position.totalCompetitors + 1,
        percentile: position.percentile,
        aboveAverage: position.aboveAverage,
        marketAverage: position.marketAverage,
      },
      tripAdvisorRanking: tripAdvisor ? {
        rank: tripAdvisor.ranking,
        context: tripAdvisor.ranking_context,
      } : null,
    });
  } catch (err: any) {
    console.error('Error fetching market position:', err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * GET /api/portfolio/stats
 * Returns aggregated stats across all hotels (for portfolio view)
 */
export const getPortfolioStats = async (req: AuthRequest, res: Response) => {
  try {
    // This endpoint requires admin or portfolio access
    // For now, we'll aggregate across all hotels the user has access to
    const userId = req.user?.id;

    // Get hotels accessible to user (for multi-hotel users)
    // Currently simplified to just the user's hotel
    const hotelId = req.user?.hotel_id;

    if (!hotelId) {
      return res.status(403).json({ error: 'No hotel access' });
    }

    // Get aggregated metrics
    const statsResult = await query(
      `SELECT 
         COUNT(DISTINCT hr.id) as total_reviews,
         AVG(es.eywa_score) as avg_eywa_score,
         MIN(es.eywa_score) as min_score,
         MAX(es.eywa_score) as max_score,
         COUNT(DISTINCT es.hotel_id) as hotels_with_scores
       FROM hotel_eywa_scores es
       LEFT JOIN hotel_reviews hr ON hr.hotel_id = es.hotel_id
       WHERE es.hotel_id = $1
       AND es.computed_at = (
         SELECT MAX(computed_at) FROM hotel_eywa_scores WHERE hotel_id = es.hotel_id
       )`,
      [hotelId]
    );

    // Get trend summary
    const trendResult = await query(
      `SELECT trend, COUNT(*) as count
       FROM hotel_eywa_scores
       WHERE hotel_id = $1
       AND computed_at = (
         SELECT MAX(computed_at) FROM hotel_eywa_scores WHERE hotel_id = $1
       )
       GROUP BY trend`,
      [hotelId]
    );

    // Get review volume trends
    const volumeResult = await query(
      `SELECT 
         COUNT(CASE WHEN published_at >= NOW() - INTERVAL '7 days' THEN 1 END) as last_7d,
         COUNT(CASE WHEN published_at >= NOW() - INTERVAL '30 days' THEN 1 END) as last_30d,
         COUNT(CASE WHEN published_at >= NOW() - INTERVAL '90 days' THEN 1 END) as last_90d
       FROM hotel_reviews
       WHERE hotel_id = $1`,
      [hotelId]
    );

    const stats = statsResult.rows[0];
    const volume = volumeResult.rows[0];

    res.json({
      portfolio: {
        hotelCount: 1, // Will increase when multi-hotel is implemented
        hotelsWithScores: parseInt(stats.hotels_with_scores) || 0,
      },
      scores: {
        average: stats.avg_eywa_score ? parseFloat(stats.avg_eywa_score).toFixed(2) : null,
        min: stats.min_score ? parseFloat(stats.min_score) : null,
        max: stats.max_score ? parseFloat(stats.max_score) : null,
      },
      trends: trendResult.rows.reduce((acc, r) => {
        acc[r.trend] = parseInt(r.count);
        return acc;
      }, {} as Record<string, number>),
      reviewVolume: {
        total: parseInt(stats.total_reviews) || 0,
        last7Days: parseInt(volume.last_7d) || 0,
        last30Days: parseInt(volume.last_30d) || 0,
        last90Days: parseInt(volume.last_90d) || 0,
      },
    });
  } catch (err: any) {
    console.error('Error fetching portfolio stats:', err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * GET /api/portfolio/trends
 * Returns trend data across all hotels
 */
export const getPortfolioTrends = async (req: AuthRequest, res: Response) => {
  try {
    const hotelId = req.user?.hotel_id;

    if (!hotelId) {
      return res.status(403).json({ error: 'No hotel access' });
    }

    const period = (req.query.period as analytics.TrendPeriod) || '30d';
    const periodDays = parseInt(period);

    // Get score history for portfolio
    const scoresResult = await query(
      `SELECT 
         DATE(computed_at) as date,
         AVG(eywa_score) as avg_score,
         MIN(eywa_score) as min_score,
         MAX(eywa_score) as max_score
       FROM hotel_eywa_scores
       WHERE hotel_id = $1
       AND computed_at >= NOW() - INTERVAL '${periodDays} days'
       GROUP BY DATE(computed_at)
       ORDER BY DATE(computed_at) ASC`,
      [hotelId]
    );

    res.json({
      period,
      data: scoresResult.rows.map(r => ({
        date: r.date.toISOString().split('T')[0],
        avgScore: parseFloat(r.avg_score).toFixed(2),
        minScore: parseFloat(r.min_score),
        maxScore: parseFloat(r.max_score),
      })),
    });
  } catch (err: any) {
    console.error('Error fetching portfolio trends:', err);
    res.status(500).json({ error: err.message });
  }
};
