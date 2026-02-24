/**
 * Analytics Service for Eywa AI Reviews
 * 
 * Provides:
 * - Trend tracking (7/30/90 day periods)
 * - Historical score storage
 * - Significant change detection (alerts)
 * - Sentiment analysis helpers
 */

export type TrendPeriod = '7d' | '30d' | '90d';

export interface TrendData {
  period: TrendPeriod;
  startScore: number | null;
  endScore: number | null;
  change: number;
  changePercent: number;
  trend: 'up' | 'down' | 'stable';
  dataPoints: number;
}

export interface Alert {
  type: 'score_drop' | 'score_rise' | 'review_spike' | 'negative_review';
  severity: 'low' | 'medium' | 'high';
  message: string;
  data: Record<string, any>;
  detectedAt: Date;
}

export interface SentimentBreakdown {
  positive: number;
  neutral: number;
  negative: number;
  total: number;
  averageRating: number;
}

export interface MarketPosition {
  rank: number;
  totalCompetitors: number;
  percentile: number;
  aboveAverage: boolean;
  marketAverage: number;
}

// Thresholds for alert detection
export const ALERT_THRESHOLDS = {
  SCORE_DROP_MEDIUM: -0.3,   // Score drops by 0.3+ points
  SCORE_DROP_HIGH: -0.5,     // Score drops by 0.5+ points
  SCORE_RISE_MEDIUM: 0.3,    // Score rises by 0.3+ points
  SCORE_RISE_HIGH: 0.5,      // Score rises by 0.5+ points
  REVIEW_SPIKE_FACTOR: 2,    // 2x normal review rate
  NEGATIVE_REVIEW_RATING: 2, // Rating of 2 or below
};

/**
 * Calculate trend for a given period based on score history
 */
export function calculateTrendFromScores(
  scores: Array<{ score: number; date: Date }>,
  period: TrendPeriod
): TrendData {
  const now = new Date();
  const periodDays = parseInt(period);
  const startDate = new Date(now.getTime() - periodDays * 24 * 60 * 60 * 1000);
  
  // Filter scores within the period
  const periodScores = scores
    .filter(s => new Date(s.date) >= startDate)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  
  if (periodScores.length === 0) {
    return {
      period,
      startScore: null,
      endScore: null,
      change: 0,
      changePercent: 0,
      trend: 'stable',
      dataPoints: 0,
    };
  }
  
  const startScore = periodScores[0].score;
  const endScore = periodScores[periodScores.length - 1].score;
  const change = Math.round((endScore - startScore) * 100) / 100;
  const changePercent = startScore > 0 
    ? Math.round((change / startScore) * 100 * 10) / 10 
    : 0;
  
  let trend: 'up' | 'down' | 'stable' = 'stable';
  if (change > 0.1) trend = 'up';
  else if (change < -0.1) trend = 'down';
  
  return {
    period,
    startScore,
    endScore,
    change,
    changePercent,
    trend,
    dataPoints: periodScores.length,
  };
}

/**
 * Detect alerts based on recent activity
 */
export function detectAlerts(
  currentScore: number,
  previousScore: number | null,
  recentReviews: Array<{ rating: number; publishedAt: Date }>,
  normalReviewRate: number // reviews per day
): Alert[] {
  const alerts: Alert[] = [];
  const now = new Date();
  
  // Check for significant score changes
  if (previousScore !== null) {
    const scoreDelta = currentScore - previousScore;
    
    if (scoreDelta <= ALERT_THRESHOLDS.SCORE_DROP_HIGH) {
      alerts.push({
        type: 'score_drop',
        severity: 'high',
        message: `Eywa Score dropped by ${Math.abs(scoreDelta).toFixed(2)} points`,
        data: { currentScore, previousScore, delta: scoreDelta },
        detectedAt: now,
      });
    } else if (scoreDelta <= ALERT_THRESHOLDS.SCORE_DROP_MEDIUM) {
      alerts.push({
        type: 'score_drop',
        severity: 'medium',
        message: `Eywa Score dropped by ${Math.abs(scoreDelta).toFixed(2)} points`,
        data: { currentScore, previousScore, delta: scoreDelta },
        detectedAt: now,
      });
    } else if (scoreDelta >= ALERT_THRESHOLDS.SCORE_RISE_HIGH) {
      alerts.push({
        type: 'score_rise',
        severity: 'high',
        message: `Eywa Score improved by ${scoreDelta.toFixed(2)} points!`,
        data: { currentScore, previousScore, delta: scoreDelta },
        detectedAt: now,
      });
    } else if (scoreDelta >= ALERT_THRESHOLDS.SCORE_RISE_MEDIUM) {
      alerts.push({
        type: 'score_rise',
        severity: 'medium',
        message: `Eywa Score improved by ${scoreDelta.toFixed(2)} points`,
        data: { currentScore, previousScore, delta: scoreDelta },
        detectedAt: now,
      });
    }
  }
  
  // Check for review spikes (last 24 hours)
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const last24hReviews = recentReviews.filter(r => new Date(r.publishedAt) >= oneDayAgo);
  
  if (normalReviewRate > 0 && last24hReviews.length >= normalReviewRate * ALERT_THRESHOLDS.REVIEW_SPIKE_FACTOR) {
    alerts.push({
      type: 'review_spike',
      severity: 'medium',
      message: `Unusual activity: ${last24hReviews.length} reviews in the last 24 hours`,
      data: { count: last24hReviews.length, normalRate: normalReviewRate },
      detectedAt: now,
    });
  }
  
  // Check for negative reviews
  const negativeReviews = last24hReviews.filter(r => r.rating <= ALERT_THRESHOLDS.NEGATIVE_REVIEW_RATING);
  for (const review of negativeReviews) {
    alerts.push({
      type: 'negative_review',
      severity: review.rating === 1 ? 'high' : 'medium',
      message: `New ${review.rating}-star review received`,
      data: { rating: review.rating, publishedAt: review.publishedAt },
      detectedAt: now,
    });
  }
  
  return alerts;
}

/**
 * Calculate sentiment breakdown from reviews
 */
export function calculateSentiment(
  reviews: Array<{ rating: number }>
): SentimentBreakdown {
  if (reviews.length === 0) {
    return {
      positive: 0,
      neutral: 0,
      negative: 0,
      total: 0,
      averageRating: 0,
    };
  }
  
  let positive = 0;
  let neutral = 0;
  let negative = 0;
  let totalRating = 0;
  
  for (const review of reviews) {
    totalRating += review.rating;
    if (review.rating >= 4) positive++;
    else if (review.rating === 3) neutral++;
    else negative++;
  }
  
  return {
    positive,
    neutral,
    negative,
    total: reviews.length,
    averageRating: Math.round((totalRating / reviews.length) * 100) / 100,
  };
}

/**
 * Calculate market position based on competitor scores
 */
export function calculateMarketPosition(
  hotelScore: number,
  competitorScores: number[]
): MarketPosition {
  if (competitorScores.length === 0) {
    return {
      rank: 1,
      totalCompetitors: 0,
      percentile: 100,
      aboveAverage: true,
      marketAverage: hotelScore,
    };
  }
  
  // Include hotel in the ranking
  const allScores = [...competitorScores, hotelScore].sort((a, b) => b - a);
  const rank = allScores.indexOf(hotelScore) + 1;
  const total = allScores.length;
  const percentile = Math.round(((total - rank + 1) / total) * 100);
  const marketAverage = allScores.reduce((a, b) => a + b, 0) / total;
  
  return {
    rank,
    totalCompetitors: competitorScores.length,
    percentile,
    aboveAverage: hotelScore >= marketAverage,
    marketAverage: Math.round(marketAverage * 100) / 100,
  };
}

/**
 * Generate timeline data points for charts
 */
export function generateTimelineData(
  scores: Array<{ score: number; date: Date }>,
  period: TrendPeriod = '30d'
): Array<{ date: string; score: number }> {
  const periodDays = parseInt(period);
  const now = new Date();
  const startDate = new Date(now.getTime() - periodDays * 24 * 60 * 60 * 1000);
  
  // Filter and sort scores
  const periodScores = scores
    .filter(s => new Date(s.date) >= startDate)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  
  // Format for chart
  return periodScores.map(s => ({
    date: new Date(s.date).toISOString().split('T')[0],
    score: s.score,
  }));
}

/**
 * Calculate average review rate (reviews per day) over a period
 */
export function calculateReviewRate(
  reviews: Array<{ publishedAt: Date }>,
  days: number = 30
): number {
  const now = new Date();
  const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  
  const periodReviews = reviews.filter(r => new Date(r.publishedAt) >= startDate);
  return periodReviews.length / days;
}
