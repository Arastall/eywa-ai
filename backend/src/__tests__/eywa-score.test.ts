/**
 * Unit tests for Eywa Score calculation service
 */

import {
  calculateConfidence,
  calculateEywaScore,
  calculateTrend,
  formatEywaScore,
  getScoreColor,
  type RatingSource,
} from '../services/eywa-score.js';

describe('calculateConfidence', () => {
  test('returns 0 for 0 reviews', () => {
    expect(calculateConfidence(0)).toBe(0);
  });

  test('returns 0.5 for 50 reviews', () => {
    expect(calculateConfidence(50)).toBe(0.5);
  });

  test('returns 1.0 for 100 reviews', () => {
    expect(calculateConfidence(100)).toBe(1.0);
  });

  test('caps at 1.0 for more than 100 reviews', () => {
    expect(calculateConfidence(500)).toBe(1.0);
    expect(calculateConfidence(1000)).toBe(1.0);
  });
});

describe('calculateEywaScore', () => {
  test('returns zeros for empty sources', () => {
    const result = calculateEywaScore([]);
    expect(result.eywaScore).toBe(0);
    expect(result.sourcesUsed).toHaveLength(0);
  });

  test('calculates score from single Google source', () => {
    const sources: RatingSource[] = [
      { source: 'google', rating: 4.5, reviewCount: 100 },
    ];
    const result = calculateEywaScore(sources);
    
    // With single source at 4.5 rating, 100 reviews (full confidence)
    // Score = (4.5 * 0.5 * 1.0) / (0.5 * 1.0) * 2 = 9.0
    expect(result.eywaScore).toBe(9.0);
    expect(result.googleRating).toBe(4.5);
    expect(result.googleConfidence).toBe(1.0);
    expect(result.sourcesUsed).toContain('google');
  });

  test('calculates score from multiple sources', () => {
    const sources: RatingSource[] = [
      { source: 'google', rating: 4.5, reviewCount: 100 },
      { source: 'tripadvisor', rating: 4.0, reviewCount: 100 },
    ];
    const result = calculateEywaScore(sources);
    
    // Both sources with equal weight and full confidence
    // Score = ((4.5 * 0.5 * 1) + (4.0 * 0.5 * 1)) / ((0.5 * 1) + (0.5 * 1)) * 2
    // = (2.25 + 2.0) / 1.0 * 2 = 8.5
    expect(result.eywaScore).toBe(8.5);
    expect(result.googleRating).toBe(4.5);
    expect(result.tripadvisorRating).toBe(4.0);
    expect(result.sourcesUsed).toHaveLength(2);
  });

  test('lower confidence reduces contribution', () => {
    const sources: RatingSource[] = [
      { source: 'google', rating: 4.5, reviewCount: 100 },
      { source: 'tripadvisor', rating: 4.0, reviewCount: 50 }, // 50% confidence
    ];
    const result = calculateEywaScore(sources);
    
    // Google: 4.5 * 0.5 * 1.0 = 2.25
    // TA: 4.0 * 0.5 * 0.5 = 1.0
    // Total weight: 0.5 * 1.0 + 0.5 * 0.5 = 0.75
    // Score = (2.25 + 1.0) / 0.75 * 2 = 8.67
    expect(result.eywaScore).toBeCloseTo(8.67, 1);
    expect(result.tripadvisorConfidence).toBe(0.5);
  });

  test('respects custom weights', () => {
    const sources: RatingSource[] = [
      { source: 'google', rating: 5.0, reviewCount: 100, weight: 0.8 },
      { source: 'tripadvisor', rating: 3.0, reviewCount: 100, weight: 0.2 },
    ];
    const result = calculateEywaScore(sources);
    
    // Google dominates with 80% weight
    // Score = ((5.0 * 0.8 * 1) + (3.0 * 0.2 * 1)) / ((0.8 * 1) + (0.2 * 1)) * 2
    // = (4.0 + 0.6) / 1.0 * 2 = 9.2
    expect(result.eywaScore).toBe(9.2);
    expect(result.googleWeight).toBe(0.8);
    expect(result.tripadvisorWeight).toBe(0.2);
  });
});

describe('calculateTrend', () => {
  test('returns stable for no previous score', () => {
    const result = calculateTrend(8.5, null);
    expect(result.trend).toBe('stable');
    expect(result.delta).toBe(0);
  });

  test('returns up for significant increase', () => {
    const result = calculateTrend(8.5, 8.0);
    expect(result.trend).toBe('up');
    expect(result.delta).toBe(0.5);
  });

  test('returns down for significant decrease', () => {
    const result = calculateTrend(8.0, 8.5);
    expect(result.trend).toBe('down');
    expect(result.delta).toBe(-0.5);
  });

  test('returns stable for small changes', () => {
    const result = calculateTrend(8.05, 8.0);
    expect(result.trend).toBe('stable');
    expect(result.delta).toBe(0.05);
  });
});

describe('formatEywaScore', () => {
  test('formats score to one decimal place', () => {
    expect(formatEywaScore(8.5)).toBe('8.5');
    expect(formatEywaScore(9.0)).toBe('9.0');
    expect(formatEywaScore(7.333)).toBe('7.3');
    expect(formatEywaScore(7.567)).toBe('7.6');
  });
});

describe('getScoreColor', () => {
  test('returns green for high scores', () => {
    expect(getScoreColor(8.0)).toBe('green');
    expect(getScoreColor(9.5)).toBe('green');
    expect(getScoreColor(10.0)).toBe('green');
  });

  test('returns yellow for good scores', () => {
    expect(getScoreColor(6.0)).toBe('yellow');
    expect(getScoreColor(7.5)).toBe('yellow');
  });

  test('returns orange for average scores', () => {
    expect(getScoreColor(4.0)).toBe('orange');
    expect(getScoreColor(5.5)).toBe('orange');
  });

  test('returns red for low scores', () => {
    expect(getScoreColor(3.9)).toBe('red');
    expect(getScoreColor(2.0)).toBe('red');
    expect(getScoreColor(0)).toBe('red');
  });
});
