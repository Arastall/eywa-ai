"use strict";
/**
 * Unit tests for Analytics service
 */
Object.defineProperty(exports, "__esModule", { value: true });
const analytics_js_1 = require("../services/analytics.js");
describe('calculateTrendFromScores', () => {
    const now = new Date();
    const makeDate = (daysAgo) => {
        return new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
    };
    test('returns stable trend for empty scores', () => {
        const result = (0, analytics_js_1.calculateTrendFromScores)([], '7d');
        expect(result.trend).toBe('stable');
        expect(result.startScore).toBeNull();
        expect(result.endScore).toBeNull();
        expect(result.dataPoints).toBe(0);
    });
    test('calculates upward trend correctly', () => {
        const scores = [
            { score: 7.0, date: makeDate(6) },
            { score: 7.5, date: makeDate(3) },
            { score: 8.0, date: makeDate(0) },
        ];
        const result = (0, analytics_js_1.calculateTrendFromScores)(scores, '7d');
        expect(result.trend).toBe('up');
        expect(result.startScore).toBe(7.0);
        expect(result.endScore).toBe(8.0);
        expect(result.change).toBe(1.0);
        expect(result.dataPoints).toBe(3);
    });
    test('calculates downward trend correctly', () => {
        const scores = [
            { score: 8.5, date: makeDate(6) },
            { score: 8.0, date: makeDate(3) },
            { score: 7.5, date: makeDate(0) },
        ];
        const result = (0, analytics_js_1.calculateTrendFromScores)(scores, '7d');
        expect(result.trend).toBe('down');
        expect(result.startScore).toBe(8.5);
        expect(result.endScore).toBe(7.5);
        expect(result.change).toBe(-1.0);
    });
    test('calculates stable trend for small changes', () => {
        const scores = [
            { score: 8.0, date: makeDate(6) },
            { score: 8.05, date: makeDate(0) },
        ];
        const result = (0, analytics_js_1.calculateTrendFromScores)(scores, '7d');
        expect(result.trend).toBe('stable');
        expect(result.change).toBe(0.05);
    });
    test('filters scores by period correctly', () => {
        const scores = [
            { score: 6.0, date: makeDate(40) }, // Outside 30d
            { score: 7.0, date: makeDate(25) },
            { score: 8.0, date: makeDate(0) },
        ];
        const result = (0, analytics_js_1.calculateTrendFromScores)(scores, '30d');
        expect(result.dataPoints).toBe(2);
        expect(result.startScore).toBe(7.0);
        expect(result.endScore).toBe(8.0);
    });
    test('calculates change percent correctly', () => {
        const scores = [
            { score: 5.0, date: makeDate(6) },
            { score: 6.0, date: makeDate(0) },
        ];
        const result = (0, analytics_js_1.calculateTrendFromScores)(scores, '7d');
        expect(result.changePercent).toBe(20); // 20% increase
    });
});
describe('detectAlerts', () => {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const twoDaysAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);
    test('detects high severity score drop', () => {
        const alerts = (0, analytics_js_1.detectAlerts)(7.5, 8.1, [], 1);
        const scoreDropAlert = alerts.find(a => a.type === 'score_drop');
        expect(scoreDropAlert).toBeDefined();
        expect(scoreDropAlert?.severity).toBe('high');
    });
    test('detects medium severity score drop', () => {
        const alerts = (0, analytics_js_1.detectAlerts)(7.7, 8.1, [], 1);
        const scoreDropAlert = alerts.find(a => a.type === 'score_drop');
        expect(scoreDropAlert).toBeDefined();
        expect(scoreDropAlert?.severity).toBe('medium');
    });
    test('detects score rise', () => {
        const alerts = (0, analytics_js_1.detectAlerts)(8.6, 8.0, [], 1);
        const scoreRiseAlert = alerts.find(a => a.type === 'score_rise');
        expect(scoreRiseAlert).toBeDefined();
        expect(scoreRiseAlert?.severity).toBe('high');
    });
    test('does not alert for stable scores', () => {
        const alerts = (0, analytics_js_1.detectAlerts)(8.0, 8.05, [], 1);
        const scoreAlerts = alerts.filter(a => a.type === 'score_drop' || a.type === 'score_rise');
        expect(scoreAlerts).toHaveLength(0);
    });
    test('detects review spike', () => {
        const reviews = [
            { rating: 5, publishedAt: now },
            { rating: 4, publishedAt: now },
            { rating: 5, publishedAt: now },
            { rating: 4, publishedAt: now },
        ];
        const alerts = (0, analytics_js_1.detectAlerts)(8.0, null, reviews, 1); // Normal rate: 1/day
        const spikeAlert = alerts.find(a => a.type === 'review_spike');
        expect(spikeAlert).toBeDefined();
        expect(spikeAlert?.data.count).toBe(4);
    });
    test('detects negative review', () => {
        const reviews = [
            { rating: 1, publishedAt: now },
            { rating: 2, publishedAt: now },
        ];
        const alerts = (0, analytics_js_1.detectAlerts)(8.0, null, reviews, 1);
        const negativeAlerts = alerts.filter(a => a.type === 'negative_review');
        expect(negativeAlerts).toHaveLength(2);
        expect(negativeAlerts[0].severity).toBe('high'); // 1-star
        expect(negativeAlerts[1].severity).toBe('medium'); // 2-star
    });
    test('ignores old reviews for negative detection', () => {
        const reviews = [
            { rating: 1, publishedAt: twoDaysAgo },
        ];
        const alerts = (0, analytics_js_1.detectAlerts)(8.0, null, reviews, 1);
        const negativeAlerts = alerts.filter(a => a.type === 'negative_review');
        expect(negativeAlerts).toHaveLength(0);
    });
});
describe('calculateSentiment', () => {
    test('returns zeros for empty reviews', () => {
        const result = (0, analytics_js_1.calculateSentiment)([]);
        expect(result.total).toBe(0);
        expect(result.positive).toBe(0);
        expect(result.neutral).toBe(0);
        expect(result.negative).toBe(0);
        expect(result.averageRating).toBe(0);
    });
    test('categorizes ratings correctly', () => {
        const reviews = [
            { rating: 5 }, // positive
            { rating: 4 }, // positive
            { rating: 3 }, // neutral
            { rating: 2 }, // negative
            { rating: 1 }, // negative
        ];
        const result = (0, analytics_js_1.calculateSentiment)(reviews);
        expect(result.positive).toBe(2);
        expect(result.neutral).toBe(1);
        expect(result.negative).toBe(2);
        expect(result.total).toBe(5);
        expect(result.averageRating).toBe(3);
    });
    test('calculates average rating correctly', () => {
        const reviews = [
            { rating: 5 },
            { rating: 5 },
            { rating: 4 },
            { rating: 4 },
        ];
        const result = (0, analytics_js_1.calculateSentiment)(reviews);
        expect(result.averageRating).toBe(4.5);
    });
});
describe('calculateMarketPosition', () => {
    test('handles no competitors', () => {
        const result = (0, analytics_js_1.calculateMarketPosition)(8.0, []);
        expect(result.rank).toBe(1);
        expect(result.totalCompetitors).toBe(0);
        expect(result.percentile).toBe(100);
        expect(result.aboveAverage).toBe(true);
    });
    test('calculates rank correctly - top position', () => {
        const result = (0, analytics_js_1.calculateMarketPosition)(9.0, [8.0, 7.0, 6.0]);
        expect(result.rank).toBe(1);
        expect(result.totalCompetitors).toBe(3);
        expect(result.percentile).toBe(100);
        expect(result.aboveAverage).toBe(true);
    });
    test('calculates rank correctly - middle position', () => {
        const result = (0, analytics_js_1.calculateMarketPosition)(7.5, [9.0, 8.0, 7.0, 6.0]);
        expect(result.rank).toBe(3);
        expect(result.totalCompetitors).toBe(4);
    });
    test('calculates rank correctly - bottom position', () => {
        const result = (0, analytics_js_1.calculateMarketPosition)(5.0, [9.0, 8.0, 7.0]);
        expect(result.rank).toBe(4);
        expect(result.percentile).toBe(25);
        expect(result.aboveAverage).toBe(false);
    });
    test('calculates market average correctly', () => {
        const result = (0, analytics_js_1.calculateMarketPosition)(8.0, [8.0, 8.0, 8.0]);
        expect(result.marketAverage).toBe(8.0);
        expect(result.aboveAverage).toBe(true); // Equal to average counts as above
    });
});
describe('generateTimelineData', () => {
    const now = new Date();
    const makeDate = (daysAgo) => {
        return new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
    };
    test('returns empty array for no scores', () => {
        const result = (0, analytics_js_1.generateTimelineData)([], '7d');
        expect(result).toHaveLength(0);
    });
    test('formats dates correctly', () => {
        const scores = [
            { score: 8.0, date: makeDate(2) },
            { score: 8.5, date: makeDate(0) },
        ];
        const result = (0, analytics_js_1.generateTimelineData)(scores, '7d');
        expect(result).toHaveLength(2);
        expect(result[0].date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(result[0].score).toBe(8.0);
    });
    test('filters by period', () => {
        const scores = [
            { score: 7.0, date: makeDate(40) }, // Outside 30d
            { score: 8.0, date: makeDate(10) },
            { score: 8.5, date: makeDate(0) },
        ];
        const result = (0, analytics_js_1.generateTimelineData)(scores, '30d');
        expect(result).toHaveLength(2);
    });
    test('sorts scores by date', () => {
        const scores = [
            { score: 8.5, date: makeDate(0) },
            { score: 7.5, date: makeDate(5) },
            { score: 8.0, date: makeDate(2) },
        ];
        const result = (0, analytics_js_1.generateTimelineData)(scores, '7d');
        expect(result[0].score).toBe(7.5); // Oldest first
        expect(result[2].score).toBe(8.5); // Newest last
    });
});
describe('calculateReviewRate', () => {
    const now = new Date();
    const makeDate = (daysAgo) => {
        return new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
    };
    test('returns 0 for no reviews', () => {
        const result = (0, analytics_js_1.calculateReviewRate)([], 30);
        expect(result).toBe(0);
    });
    test('calculates rate correctly', () => {
        const reviews = [
            { publishedAt: makeDate(1) },
            { publishedAt: makeDate(5) },
            { publishedAt: makeDate(10) },
            { publishedAt: makeDate(15) },
            { publishedAt: makeDate(20) },
            { publishedAt: makeDate(25) },
        ];
        const result = (0, analytics_js_1.calculateReviewRate)(reviews, 30);
        expect(result).toBe(0.2); // 6 reviews / 30 days
    });
    test('excludes reviews outside period', () => {
        const reviews = [
            { publishedAt: makeDate(5) },
            { publishedAt: makeDate(10) },
            { publishedAt: makeDate(60) }, // Outside 30d period
        ];
        const result = (0, analytics_js_1.calculateReviewRate)(reviews, 30);
        expect(result).toBeCloseTo(2 / 30);
    });
});
describe('ALERT_THRESHOLDS', () => {
    test('thresholds are correctly defined', () => {
        expect(analytics_js_1.ALERT_THRESHOLDS.SCORE_DROP_MEDIUM).toBe(-0.3);
        expect(analytics_js_1.ALERT_THRESHOLDS.SCORE_DROP_HIGH).toBe(-0.5);
        expect(analytics_js_1.ALERT_THRESHOLDS.SCORE_RISE_MEDIUM).toBe(0.3);
        expect(analytics_js_1.ALERT_THRESHOLDS.SCORE_RISE_HIGH).toBe(0.5);
        expect(analytics_js_1.ALERT_THRESHOLDS.REVIEW_SPIKE_FACTOR).toBe(2);
        expect(analytics_js_1.ALERT_THRESHOLDS.NEGATIVE_REVIEW_RATING).toBe(2);
    });
});
